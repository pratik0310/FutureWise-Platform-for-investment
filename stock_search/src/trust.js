// Heuristic "trust" + time-horizon scoring for one analysed stock.
// Uses only data already in the analysis: news[] (title, source, posted) and the analysis text.
// Trust = how well-supported the analysis is by its news. It is NOT a prediction-accuracy score.

import { sentimentScore } from "./sentiment.js";

const DAY_MS = 86400000;

const UNITS = {
  minute: 1 / 1440,
  min: 1 / 1440,
  hour: 1 / 24,
  hr: 1 / 24,
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

// "2 hours ago", "yesterday", "Oct 20, 2026" -> age in days (null if unknown)
export const ageInDays = (posted) => {
  if (!posted) return null;
  const s = String(posted).toLowerCase().trim();
  if (/just now|today|moments? ago/.test(s)) return 0;
  if (/yesterday/.test(s)) return 1;
  const m = s.match(/(\d+|an?)\s*(minute|min|hour|hr|day|week|month|year)s?\s*ago/);
  if (m) {
    const n = m[1].startsWith("a") ? 1 : Number(m[1]);
    return n * UNITS[m[2]];
  }
  const t = Date.parse(posted);
  if (!Number.isNaN(t)) return Math.max(0, (Date.now() - t) / DAY_MS);
  return null;
};

// word-prefix regexes: "surge" matches "surges", but "rise" does not match "enterprise"
const stems = (list) =>
  list.map((w) => new RegExp(`\\b${w.replace(/[-\s]/g, "[-\\s]?")}`, "i"));

const POS = stems([
  "surge", "jump", "rally", "gain", "rise", "soar", "beat", "profit", "growth",
  "record", "upgrade", "strong", "wins", "boost", "approval", "outperform",
  "dividend", "rebound",
]);
const NEG = stems([
  "fall", "drop", "plunge", "slump", "loss", "decline", "miss", "downgrade",
  "weak", "fraud", "probe", "penalty", "fine", "cut", "default", "lawsuit",
  "underperform", "warning", "crash", "ban", "raid",
]);

// quick-moving news: results, price moves, ratings
const SHORT = stems([
  "quarter", "q1", "q2", "q3", "q4", "result", "earning", "profit", "loss",
  "surge", "plunge", "jump", "rally", "slump", "target price", "upgrade",
  "downgrade", "dividend", "shares", "stock", "trading", "session",
  "block deal", "today", "week",
]);
// structural news: expansion, deals, strategy
const LONG = stems([
  "expan", "capacity", "capex", "acqui", "merger", "invest", "plant", "strateg",
  "long-term", "outlook", "roadmap", "partnership", "project", "commission",
  "transition", "policy", "demand", "pipeline", "debt", "joint venture",
  "multi-year", "decade",
]);

const hits = (text, list) => list.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);

const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

// Same shared rule as the sentiment badge in App.jsx, so both agree.
const analysisSentiment = sentimentScore;

const newsStats = (stock) => {
  const news = Array.isArray(stock?.news) ? stock.news : [];
  const sources = new Set(
    news.map((n) => String(n?.source || "").trim().toLowerCase()).filter(Boolean)
  );
  const ages = news.map((n) => ageInDays(n?.posted)).filter((a) => a !== null);
  const avgAge = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null;
  return { news, sources, avgAge };
};

export const trustLevel = (score) =>
  score >= 70
    ? { label: "High", color: "#10b981" }
    : score >= 40
    ? { label: "Medium", color: "#f59e0b" }
    : { label: "Low", color: "#ef4444" };

export const computeTrust = (stock) => {
  const { news, sources, avgAge } = newsStats(stock);
  const count = news.length;

  // 30 pts: how many articles back the analysis (5+ = full marks)
  const coverage = Math.round((Math.min(count, 5) / 5) * 30);
  // 25 pts: independent sources (3+ = full marks)
  const diversity = Math.round((Math.min(sources.size, 3) / 3) * 25);
  // 25 pts: freshness of the news
  const recency =
    count === 0 ? 0 : avgAge === null ? 8 : avgAge <= 2 ? 25 : avgAge <= 7 ? 18 : avgAge <= 30 ? 10 : 3;
  // 20 pts: do headlines point the same way as the analysis?
  let consistency = 0;
  if (count > 0) {
    const net = news.reduce((sum, n) => {
      const t = String(n?.title || "");
      return sum + sign(hits(t, POS) - hits(t, NEG));
    }, 0);
    const h = sign(net);
    const a = analysisSentiment(stock?.analysis);
    consistency = h === a ? 20 : h === 0 || a === 0 ? 10 : 0;
  }

  const score = coverage + diversity + recency + consistency;
  return {
    score,
    ...trustLevel(score),
    factors: [
      { key: "Coverage", pts: coverage, max: 30, note: `${count} article${count === 1 ? "" : "s"}` },
      { key: "Sources", pts: diversity, max: 25, note: `${sources.size} source${sources.size === 1 ? "" : "s"}` },
      {
        key: "Freshness",
        pts: recency,
        max: 25,
        note: avgAge === null ? "age unknown" : avgAge < 1 ? "under 1 day old" : `~${Math.round(avgAge)} day${Math.round(avgAge) === 1 ? "" : "s"} old`,
      },
      {
        key: "Agreement",
        pts: consistency,
        max: 20,
        note: count === 0 ? "no news" : consistency === 20 ? "headlines match" : consistency === 10 ? "partly match" : "headlines conflict",
      },
    ],
  };
};

// position 0 = short term ... 100 = long term
export const computeHorizon = (stock) => {
  const { news, avgAge } = newsStats(stock);
  let short = 0;
  let long = 0;
  for (const n of news) {
    const t = String(n?.title || "");
    short += hits(t, SHORT);
    long += hits(t, LONG);
  }
  if (avgAge !== null && avgAge <= 3) short += 1; // very fresh news = fast-moving story

  const total = short + long;
  if (total === 0)
    return { position: 50, label: "Unclear", span: "not enough signals", short, long };

  const position = Math.max(6, Math.min(94, Math.round(50 + (50 * (long - short)) / total)));
  if (position <= 35) return { position, label: "Short term", span: "days to a few weeks", short, long };
  if (position >= 65) return { position, label: "Long term", span: "months or more", short, long };
  return { position, label: "Mixed", span: "weeks to months", short, long };
};

// Quantity-weighted summary across the whole analysis
export const computeOverall = (results) => {
  const list = Array.isArray(results) ? results : [];
  if (!list.length) return null;
  let w = 0;
  let trust = 0;
  let pos = 0;
  for (const r of list) {
    const q = Number(r?.quantity) > 0 ? Number(r.quantity) : 1;
    w += q;
    trust += computeTrust(r).score * q;
    pos += computeHorizon(r).position * q;
  }
  const score = Math.round(trust / w);
  const position = Math.round(pos / w);
  const horizon =
    position <= 35 ? "Mostly short term" : position >= 65 ? "Mostly long term" : "Mixed horizon";
  return { score, ...trustLevel(score), horizon };
};