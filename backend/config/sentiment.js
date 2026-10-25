// ONE shared sentiment rule. Same file lives in frontend (src/) and backend (config/).
//
// Why: the old rule did `text.includes("positive")`. The analysis always has the heading
// "Positive Developments", so almost every stock came out Bullish. This rule:
//   1. splits the analysis into sections (positive / concerns / verdict)
//   2. reads the VERDICT section ("Overall Impact") first
//   3. if there is no clear verdict, compares positive vs negative cue words in the body
//   4. otherwise Neutral

const word = (w) => `\\b${w}(?:s|es|ed|d|ing)?\\b`;
const rx = (list) => list.map((w) => new RegExp(word(w), "i"));

const BULL = rx([
  "bullish", "positive", "optimistic", "favou?rable", "upside", "outperform",
  "uptrend", "constructive", "buy",
]);
const BEAR = rx([
  "bearish", "negative", "pessimistic", "unfavou?rable", "downside", "underperform",
  "downtrend", "cautious", "sell",
]);
const NEUT = rx([
  "neutral", "mixed", "balanced", "uncertain", "unclear", "limited", "minimal", "muted", "stable",
]);

// body cues, used only when there is no clear verdict
const POS_BODY = rx([
  "surge", "jump", "rally", "gain", "rise", "soar", "beat", "profit", "growth", "record",
  "upgrade", "strong", "boost", "expansion", "expand", "dividend", "rebound", "win",
]);
const NEG_BODY = rx([
  "fall", "drop", "plunge", "slump", "loss", "decline", "miss", "downgrade", "weak",
  "fraud", "probe", "penalty", "fine", "cut", "default", "lawsuit", "warning", "crash",
  "ban", "raid", "debt",
]);

const count = (list, text) =>
  list.reduce((n, re) => n + (text.match(new RegExp(re.source, "gi")) || []).length, 0);

const stripMarks = (l) =>
  l
    .replace(/^[\s>*#\-•\d.)]+/, "") // bullets, numbering, markdown
    .replace(/\*+/g, "")
    .trim();

// Is this line a section heading? returns "pos" | "con" | "impact" | null, plus any text after the colon
const readHeading = (line) => {
  const s = stripMarks(line);
  if (!s) return null;
  const m = s.match(/^([^:]{3,45}):\s*(.*)$/);
  const head = (m ? m[1] : s).replace(/[-–\s]+$/, "").trim();
  const rest = m ? m[2].trim() : "";

  const words = head.split(/\s+/).length;
  if (words > 5) return null;
  if (!m && /[.!?]$/.test(s)) return null; // a normal sentence, not a heading

  const h = head.toLowerCase();
  let kind = null;
  if (/(impact|verdict|overall|conclusion|summary|outlook|bottom line)/.test(h)) kind = "impact";
  else if (/(positive|green|upside|bright|strength)/.test(h)) kind = "pos";
  else if (/(concern|risk|red flag|challenge|negative|weakness|downside)/.test(h)) kind = "con";
  return kind ? { kind, rest } : null;
};

export const cleanAnalysis = (text) =>
  String(text || "").replace(/\[INST\][\s\S]*?\[\/INST\]/g, "").trim();

const splitSections = (text) => {
  const out = { impact: "", body: "", all: "" };
  let cur = "body";
  for (const raw of cleanAnalysis(text).split("\n")) {
    if (!raw.trim()) continue;
    const h = readHeading(raw);
    if (h) {
      cur = h.kind === "impact" ? "impact" : "body";
      if (h.rest) {
        out[cur] += ` ${h.rest}`;
        out.all += ` ${h.rest}`;
      }
      continue;
    }
    const line = stripMarks(raw);
    out[cur] += ` ${line}`;
    out.all += ` ${line}`;
  }
  return out;
};

// +1 bullish, 0 neutral, -1 bearish
export const sentimentScore = (text) => {
  const { impact, body, all } = splitSections(text);

  const verdict = impact.trim();
  if (verdict) {
    const b = count(BULL, verdict);
    const r = count(BEAR, verdict);
    if (b > r) return 1;
    if (r > b) return -1;
    if (count(NEUT, verdict) > 0) return 0;
  } else {
    // no verdict section: plain text like "Overall outlook is bullish"
    const b = count(BULL, all);
    const r = count(BEAR, all);
    if (b > r && b - r >= 1 && !/positive developments/i.test(cleanAnalysis(text))) return 1;
    if (r > b) return -1;
  }

  const pos = count(POS_BODY, `${body} ${verdict}`);
  const neg = count(NEG_BODY, `${body} ${verdict}`);
  if (pos - neg >= 2) return 1;
  if (neg - pos >= 2) return -1;
  return 0;
};

export const getSentiment = (text) => {
  if (!String(text || "").trim()) return { label: "Neutral", color: "#f59e0b", icon: "●", score: 0 };
  const s = sentimentScore(text);
  if (s > 0) return { label: "Bullish", color: "#10b981", icon: "▲", score: 1 };
  if (s < 0) return { label: "Bearish", color: "#ef4444", icon: "▼", score: -1 };
  return { label: "Neutral", color: "#f59e0b", icon: "●", score: 0 };
};