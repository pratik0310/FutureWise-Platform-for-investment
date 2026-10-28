import { useState, useEffect, useRef, useMemo } from "react";
import "./HistoryTab.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ---------- helpers ----------
const scoreLabel = (s) => (s > 15 ? "Bullish" : s < -15 ? "Bearish" : "Neutral");
const scoreTone = (s) => (s > 15 ? "up" : s < -15 ? "down" : "warn");

const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const shortDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const relDay = (d) => {
  const dt = new Date(d);
  const now = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const days = Math.floor((start(now) - start(dt)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  if (days < 30) return "This month";
  return "Earlier";
};

// ---------- icons ----------
const I = {
  Spark: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5L12 3z" />
    </svg>
  ),
  Eye: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Trash: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  Clock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  TrendUp: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" />
    </svg>
  ),
  TrendDown: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m22 17-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" />
    </svg>
  ),
  Search: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Download: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  List: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  Grid: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  Timeline: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
      <path d="M12 7v3M12 14v3" />
    </svg>
  ),
  Compare: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M16 3h5v5M8 21H3v-5M21 3l-7 7M3 21l7-7" />
    </svg>
  ),
  Info: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  Flame: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 2c0 3-2 5-2 7a2 2 0 0 0 4 0c0-1 0-2 .5-3 1 2 3.5 4 3.5 8a6 6 0 0 1-12 0c0-2 1-4 3-6 0 1 .5 2 1.5 2 0-2 1.5-5 1.5-8z" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  ),
};

// ---------- animated number ----------
function AnimatedNumber({ value, duration = 650, prefix = "", suffix = "" }) {
  const [d, setD] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) { setD(to); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setD(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{prefix}{Math.round(d)}{suffix}</>;
}

// ---------- score ring ----------
const ScoreRing = ({ score, size = 60 }) => {
  const pct = Math.max(0, Math.min(100, (score + 100) / 2));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (c * pct) / 100;
  const tone = scoreTone(score);
  return (
    <svg width={size} height={size} className="hist-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--lp-line)" strokeWidth="5" opacity="0.6" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={`var(--lp-${tone})`} strokeWidth="5"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        fontFamily="var(--app-head, system-ui, sans-serif)" fontSize={size * 0.34}
        fontWeight="700" fill={`var(--lp-${tone})`}>
        {score}
      </text>
    </svg>
  );
};

// ---------- sentiment donut ----------
const SentimentDonut = ({ counts, size = 140 }) => {
  const total = counts.bullish + counts.neutral + counts.bearish;
  const data = [
    { label: "Bullish", value: counts.bullish, color: "var(--lp-up)" },
    { label: "Neutral", value: counts.neutral, color: "var(--lp-warn)" },
    { label: "Bearish", value: counts.bearish, color: "var(--lp-down)" },
  ].filter((d) => d.value > 0);

  if (total === 0) {
    return (
      <div className="hist-donut hist-donut-empty" style={{ width: size, height: size }}>
        <span>—</span>
      </div>
    );
  }

  let startAngle = -Math.PI / 2;
  const r = size / 2 - 8;
  const cx = size / 2, cy = size / 2;
  const paths = data.map((d) => {
    const slice = (d.value / total) * 2 * Math.PI;
    const x1 = cx + Math.cos(startAngle) * r;
    const y1 = cy + Math.sin(startAngle) * r;
    const endAngle = startAngle + slice;
    const x2 = cx + Math.cos(endAngle) * r;
    const y2 = cy + Math.sin(endAngle) * r;
    const large = slice > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    const el = (
      <path key={d.label} d={path} fill={d.color} opacity="0.85">
        <title>{d.label}: {d.value} ({Math.round((d.value / total) * 100)}%)</title>
      </path>
    );
    startAngle = endAngle;
    return el;
  });

  return (
    <div className="hist-donut" style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>{paths}</svg>
      <div className="hist-donut-hole">
        <strong>{total}</strong>
        <small>runs</small>
      </div>
    </div>
  );
};

// ---------- main line chart ----------
const ScoreChart = ({ points, onPointClick }) => {
  const canvasRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    const root = document.querySelector(".app-lp") || document.documentElement;
    const obs = new MutationObserver(() => setThemeTick((v) => v + 1));
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const cs = getComputedStyle(canvas);
    const pick = (name, fb) => (cs.getPropertyValue(name) || "").trim() || fb;
    const accent = pick("--lp-accent", "#6c63ff");
    const up = pick("--lp-up", "#10b981");
    const down = pick("--lp-down", "#ef4444");
    const warn = pick("--lp-warn", "#f59e0b");
    const muted = pick("--lp-muted", "#9aa3b8");
    const line = pick("--lp-line", "#2a2d3a");
    const panel = pick("--lp-panel", "#1a1d27");

    const W = canvas.width, H = canvas.height;
    const pad = { l: 52, r: 24, t: 22, b: 38 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    const y = (v) => pad.t + ((100 - v) / 200) * innerH;
    const x = (i) =>
      points.length === 1 ? pad.l + innerW / 2 : pad.l + (i / (points.length - 1)) * innerW;

    let raf;
    const start = performance.now();
    const dur = 850;

    const draw = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      ctx.clearRect(0, 0, W, H);

      // grid
      ctx.font = "11px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      [-100, -50, 0, 50, 100].forEach((v) => {
        ctx.beginPath();
        ctx.moveTo(pad.l, y(v));
        ctx.lineTo(W - pad.r, y(v));
        ctx.strokeStyle = v === 0 ? muted : line;
        ctx.globalAlpha = v === 0 ? 0.55 : 0.45;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = muted;
        ctx.fillText(String(v), pad.l - 10, y(v));
      });

      if (!points.length) return;

      const revealX = pad.l + innerW * eased;

      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.l - 2, 0, revealX - pad.l + 2, H);
      ctx.clip();

      // area fill
      ctx.beginPath();
      ctx.moveTo(x(0), y(points[0].score));
      points.forEach((p, i) => { if (i > 0) ctx.lineTo(x(i), y(p.score)); });
      ctx.lineTo(x(points.length - 1), y(-100));
      ctx.lineTo(x(0), y(-100));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
      grad.addColorStop(0, `${accent}55`);
      grad.addColorStop(1, `${accent}00`);
      ctx.fillStyle = grad;
      ctx.fill();

      // line
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(x(i), y(p.score));
        else ctx.lineTo(x(i), y(p.score));
      });
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      // dots
      points.forEach((p, i) => {
        if (x(i) > revealX + 1) return;
        const isHover = hover?.idx === i;
        ctx.beginPath();
        ctx.arc(x(i), y(p.score), isHover ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = p.score > 15 ? up : p.score < -15 ? down : warn;
        ctx.fill();
        ctx.strokeStyle = panel;
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      ctx.restore();

      // x labels
      if (t > 0.35) {
        ctx.fillStyle = muted;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.fillText(shortDate(points[0].createdAt), pad.l, H - 12);
        if (points.length > 1) {
          ctx.textAlign = "right";
          ctx.fillText(shortDate(points[points.length - 1].createdAt), W - pad.r, H - 12);
        }
      }

      if (t < 1) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [points, themeTick, hover]);

  const onMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !points.length) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;

    const pad = { l: 52, r: 24, t: 22, b: 38 };
    const innerW = canvas.width - pad.l - pad.r;
    const innerH = canvas.height - pad.t - pad.b;

    let best = 0, bestDist = Infinity;
    points.forEach((p, i) => {
      const px =
        points.length === 1
          ? pad.l + innerW / 2
          : pad.l + (i / (points.length - 1)) * innerW;
      const dd = Math.abs(px - mx);
      if (dd < bestDist) { bestDist = dd; best = i; }
    });

    const px =
      points.length === 1
        ? pad.l + innerW / 2
        : pad.l + (best / (points.length - 1)) * innerW;
    const py = pad.t + ((100 - points[best].score) / 200) * innerH;

    setHover({
      idx: best,
      px: px / scaleX,
      py: py / scaleY,
      score: points[best].score,
      date: points[best].createdAt,
      id: points[best].id,
    });
  };

  const onClick = () => {
    if (hover && onPointClick && hover.id) onPointClick(hover.id);
  };

  return (
    <div
      className="hist-chart-wrap"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onClick={onClick}
    >
      <canvas ref={canvasRef} width={1200} height={340} className="hist-canvas" />
      {hover && (
        <div
          className="hist-chart-tip"
          style={{ left: `${hover.px}px`, top: `${hover.py}px` }}
        >
          <strong style={{ color: `var(--lp-${scoreTone(hover.score)})` }}>
            {hover.score > 0 ? "+" : ""}{hover.score} · {scoreLabel(hover.score)}
          </strong>
          <small>{fmtDate(hover.date)}</small>
          {onPointClick && hover.id && <span className="hist-chart-tip-hint">Click to open →</span>}
        </div>
      )}
    </div>
  );
};

// ---------- sparkline ----------
const Sparkline = ({ values, width = 80, height = 24 }) => {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values, -100);
  const max = Math.max(...values, 100);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  const last = values[values.length - 1];
  const color = last > 15 ? "var(--lp-up)" : last < -15 ? "var(--lp-down)" : "var(--lp-warn)";
  return (
    <svg width={width} height={height} className="hist-spark">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ---------- confirm modal ----------
const ConfirmModal = ({ open, title, body, confirmLabel, busy, count, onCancel, onConfirm }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="hist-modal-bg" onClick={onCancel}>
      <div className="hist-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="hist-modal-icon">
          <I.Trash width="22" height="22" />
        </div>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="hist-modal-actions">
          <button type="button" className="hist-btn hist-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="hist-btn hist-btn-danger-solid" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : `${confirmLabel}${count ? ` (${count})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- compare panel ----------
const ComparePanel = ({ a, b, onClose }) => {
  const [left, right] = [a, b];
  const sa = left.summary || {};
  const sb = right.summary || {};
  const delta = (sb.score ?? 0) - (sa.score ?? 0);
  const rows = [
    { label: "Score", a: sa.score ?? 0, b: sb.score ?? 0, delta: (sb.score ?? 0) - (sa.score ?? 0), tone: true },
    { label: "Bullish", a: sa.bullish ?? 0, b: sb.bullish ?? 0, delta: (sb.bullish ?? 0) - (sa.bullish ?? 0) },
    { label: "Neutral", a: sa.neutral ?? 0, b: sb.neutral ?? 0, delta: (sb.neutral ?? 0) - (sa.neutral ?? 0) },
    { label: "Bearish", a: sa.bearish ?? 0, b: sb.bearish ?? 0, delta: (sb.bearish ?? 0) - (sa.bearish ?? 0) },
    { label: "Holdings", a: (sa.symbols || []).length, b: (sb.symbols || []).length, delta: (sb.symbols || []).length - (sa.symbols || []).length },
    { label: "Qty", a: sa.totalQuantity ?? 0, b: sb.totalQuantity ?? 0, delta: (sb.totalQuantity ?? 0) - (sa.totalQuantity ?? 0) },
  ];
  return (
    <div className="hist-compare">
      <div className="hist-compare-head">
        <div>
          <h4>Comparing two analyses</h4>
          <p>Left = older · Right = newer</p>
        </div>
        <button type="button" className="hist-btn hist-btn-ghost hist-btn-sm" onClick={onClose}>
          <I.X width="14" height="14" /> Close
        </button>
      </div>
      <div className="hist-compare-cols">
        <div className="hist-compare-col">
          <small className="hist-muted">{fmtDate(left.createdAt)}</small>
          <strong className={`hist-tone-${scoreTone(sa.score ?? 0)}`}>
            {sa.score ?? 0} · {scoreLabel(sa.score ?? 0)}
          </strong>
        </div>
        <div className="hist-compare-col">
          <small className="hist-muted">{fmtDate(right.createdAt)}</small>
          <strong className={`hist-tone-${scoreTone(sb.score ?? 0)}`}>
            {sb.score ?? 0} · {scoreLabel(sb.score ?? 0)}
          </strong>
        </div>
      </div>
      <table className="hist-compare-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Older</th>
            <th>Newer</th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const good = r.label === "Bearish" ? r.delta < 0 : r.delta > 0;
            const tone = r.delta === 0 ? "muted" : good ? "up" : "down";
            return (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className={r.tone ? `hist-tone-${scoreTone(r.a)}` : ""}>{r.a}</td>
                <td className={r.tone ? `hist-tone-${scoreTone(r.b)}` : ""}>{r.b}</td>
                <td className={`hist-tone-${tone}`}>
                  {r.delta === 0 ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hist-compare-note">
        Overall score moved <strong className={`hist-tone-${delta >= 0 ? "up" : "down"}`}>
          {delta >= 0 ? "+" : ""}{delta}
        </strong> between these runs.
      </p>
    </div>
  );
};

// ============================================================
export default function HistoryTab({ user, onView, onLogin, onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  // UI
  const [filter, setFilter] = useState("all"); // all | bullish | neutral | bearish
  const [sort, setSort] = useState("newest");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // list | grid | timeline
  const [selected, setSelected] = useState([]); // for compare / bulk
  const [confirmTarget, setConfirmTarget] = useState(null); // id | "bulk" | null
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const notify = (msg, type = "info") => {
    if (onToast) onToast(msg, type);
    else alert(msg);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError("");
    fetch(`${API}/api/history`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load history.");
        return r.json();
      })
      .then((d) => setItems(d.history || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const view_item = async (id) => {
    setBusyId(id);
    try {
      const r = await fetch(`${API}/api/history/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("Could not open this analysis.");
      const d = await r.json();
      onView(d.results);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    try {
      if (confirmTarget === "bulk") {
        await Promise.all(
          selected.map((id) =>
            fetch(`${API}/api/history/${id}`, { method: "DELETE", credentials: "include" })
          )
        );
        setItems((prev) => prev.filter((i) => !selected.includes(i._id)));
        notify(`${selected.length} analyses deleted.`, "info");
        setSelected([]);
      } else {
        setBusyId(confirmTarget);
        const r = await fetch(`${API}/api/history/${confirmTarget}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!r.ok) throw new Error("Could not delete.");
        setItems((prev) => prev.filter((i) => i._id !== confirmTarget));
        notify("Analysis removed from history.", "info");
      }
      setConfirmTarget(null);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setConfirmBusy(false);
      setBusyId(null);
    }
  };

  const exportJSON = () => {
    try {
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analysis-history-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify(`Exported ${items.length} analyses.`, "success");
    } catch {
      notify("Export failed.", "error");
    }
  };

  // ---------- derived ----------
  const counts = useMemo(() => {
    let bullish = 0, neutral = 0, bearish = 0;
    items.forEach((it) => {
      const sc = it.summary?.score ?? 0;
      if (sc > 15) bullish++;
      else if (sc < -15) bearish++;
      else neutral++;
    });
    return { all: items.length, bullish, neutral, bearish };
  }, [items]);

  const stats = useMemo(() => {
    const scores = items.map((i) => i.summary?.score ?? 0);
    if (!scores.length) return null;
    const latest = scores[0];
    const prev = scores.length > 1 ? scores[1] : null;
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const best = Math.max(...scores);
    const delta = prev === null ? null : latest - prev;
    // streak
    let streak = 0;
    for (const s of scores) {
      if (s > 15) streak++;
      else break;
    }
    let streakDown = 0;
    for (const s of scores) {
      if (s < -15) streakDown++;
      else break;
    }
    return { latest, avg, best, delta, count: items.length, streak, streakDown };
  }, [items]);

  // top symbols
  const topSymbols = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      (it.summary?.symbols || []).forEach((s) => {
        map.set(s, (map.get(s) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [items]);

  // insights
  const insights = useMemo(() => {
    if (items.length < 2) return [];
    const out = [];
    if (stats.streak >= 2) out.push({ icon: "🔥", text: `${stats.streak} bullish runs in a row`, tone: "up" });
    if (stats.streakDown >= 2) out.push({ icon: "⚠️", text: `${stats.streakDown} bearish runs in a row`, tone: "down" });
    const delta = stats.delta;
    if (delta != null) {
      if (delta > 20) out.push({ icon: "📈", text: `Jumped +${delta} vs previous run`, tone: "up" });
      else if (delta < -20) out.push({ icon: "📉", text: `Dropped ${delta} vs previous run`, tone: "down" });
    }
    if (counts.bullish > counts.bearish * 2 && counts.bullish >= 3)
      out.push({ icon: "✅", text: "Most runs skewed bullish", tone: "up" });
    if (counts.bearish > counts.bullish * 2 && counts.bearish >= 3)
      out.push({ icon: "🚨", text: "Most runs skewed bearish", tone: "down" });
    if (topSymbols.length > 0)
      out.push({ icon: "⭐", text: `${topSymbols[0][0]} appears in ${topSymbols[0][1]} runs`, tone: "accent" });
    return out.slice(0, 4);
  }, [items.length, stats, counts, topSymbols]);

  // filtered + sorted
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = items.filter((it) => {
      const s = it.summary || {};
      if (filter === "bullish" && (s.score ?? 0) <= 15) return false;
      if (filter === "bearish" && (s.score ?? 0) >= -15) return false;
      if (filter === "neutral") {
        const sc = s.score ?? 0;
        if (sc > 15 || sc < -15) return false;
      }
      if (q) {
        const syms = (s.symbols || []).map((x) => String(x).toLowerCase());
        if (!syms.some((x) => x.includes(q))) return false;
      }
      return true;
    });
    out = [...out];
    if (sort === "newest") out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort === "oldest") out.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (sort === "scoreHigh") out.sort((a, b) => (b.summary?.score ?? 0) - (a.summary?.score ?? 0));
    else if (sort === "scoreLow") out.sort((a, b) => (a.summary?.score ?? 0) - (b.summary?.score ?? 0));
    return out;
  }, [items, filter, sort, query]);

  const groups = useMemo(() => {
    if (view === "grid") return [["All results", filtered]];
    const m = new Map();
    filtered.forEach((it) => {
      const k = relDay(it.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    });
    return Array.from(m.entries());
  }, [filtered, view]);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openCompare = () => {
    if (selected.length !== 2) return;
    setCompareOpen(true);
  };

  const comparePair = useMemo(() => {
    if (selected.length !== 2) return null;
    const a = items.find((i) => i._id === selected[0]);
    const b = items.find((i) => i._id === selected[1]);
    if (!a || !b) return null;
    const [older, newer] = new Date(a.createdAt) < new Date(b.createdAt) ? [a, b] : [b, a];
    return [older, newer];
  }, [selected, items]);

  // ---------- guards ----------
  if (!user) {
    return (
      <div className="hist-wrap">
        <header className="hist-header">
          <div>
            <h1>History</h1>
            <p>Your past analyses and sentiment trend</p>
          </div>
        </header>
        <div className="hist-empty-card">
          <div className="hist-empty-icon"><I.Clock width="28" height="28" /></div>
          <h3>Sign in to see your history</h3>
          <p>Every analysis you run is saved to your account, ready to revisit anytime.</p>
          <button type="button" className="hist-btn hist-btn-solid" onClick={onLogin}>
            <I.Spark width="16" height="16" /> Sign in
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="hist-wrap">
        <header className="hist-header">
          <div>
            <h1>History</h1>
            <p>Your past analyses and sentiment trend</p>
          </div>
        </header>
        <div className="hist-layout">
          <aside className="hist-side">
            <div className="hist-panel hist-skeleton" style={{ height: 220 }} />
            <div className="hist-panel hist-skeleton" style={{ height: 180 }} />
            <div className="hist-panel hist-skeleton" style={{ height: 180 }} />
          </aside>
          <div className="hist-main">
            <div className="hist-panel hist-skeleton" style={{ height: 320 }} />
            <div className="hist-panel hist-skeleton" style={{ height: 120 }} />
            <div className="hist-panel hist-skeleton" style={{ height: 100 }} />
            <div className="hist-panel hist-skeleton" style={{ height: 100 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hist-wrap">
        <header className="hist-header">
          <div>
            <h1>History</h1>
            <p>Your past analyses and sentiment trend</p>
          </div>
        </header>
        <div className="hist-empty-card hist-empty-error">
          <div className="hist-empty-icon hist-empty-icon-error"><I.Info width="28" height="28" /></div>
          <h3>Couldn't load history</h3>
          <p>{error}</p>
          <button type="button" className="hist-btn hist-btn-ghost" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="hist-wrap">
        <header className="hist-header">
          <div>
            <h1>History</h1>
            <p>Your past analyses and sentiment trend</p>
          </div>
        </header>
        <div className="hist-empty-card">
          <div className="hist-empty-icon"><I.Spark width="28" height="28" /></div>
          <h3>No analyses yet</h3>
          <p>Run "Analyze Portfolio" on the Portfolio tab and it will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hist-wrap">
      {/* header */}
      <header className="hist-header">
        <div>
          <h1>History</h1>
          <p>Your past analyses and sentiment trend</p>
          {stats?.streak >= 2 && (
            <span className="hist-streak hist-tone-up">
              <I.Flame width="12" height="12" /> {stats.streak} bullish in a row
            </span>
          )}
          {stats?.streakDown >= 2 && (
            <span className="hist-streak hist-tone-down">
              <I.Flame width="12" height="12" /> {stats.streakDown} bearish in a row
            </span>
          )}
        </div>
        <div className="hist-header-actions">
          <span className="hist-pill">{items.length} saved</span>
          <button
            type="button"
            className="hist-btn hist-btn-ghost hist-btn-sm"
            onClick={exportJSON}
            title="Download as JSON"
          >
            <I.Download width="14" height="14" /> Export
          </button>
        </div>
      </header>

      {/* stats */}
      {stats && (
        <div className="hist-stats">
          <button
            type="button"
            className={`hist-stat hist-stat-click ${filter === "all" ? "is-active" : ""}`}
            onClick={() => setFilter("all")}
          >
            <span className="hist-stat-label">Latest score</span>
            <strong className={`hist-stat-value hist-tone-${scoreTone(stats.latest)}`}>
              <AnimatedNumber value={stats.latest} />
            </strong>
            {stats.delta !== null ? (
              <small className={`hist-stat-sub hist-tone-${stats.delta >= 0 ? "up" : "down"}`}>
                {stats.delta >= 0 ? <I.TrendUp width="11" height="11" /> : <I.TrendDown width="11" height="11" />}
                {Math.abs(stats.delta)} vs previous
              </small>
            ) : (
              <small className="hist-stat-sub hist-muted">first analysis</small>
            )}
          </button>
          <div className="hist-stat">
            <span className="hist-stat-label">Average</span>
            <strong className={`hist-stat-value hist-tone-${scoreTone(stats.avg)}`}>
              <AnimatedNumber value={stats.avg} />
            </strong>
            <small className="hist-stat-sub hist-muted">across all runs</small>
          </div>
          <div className="hist-stat">
            <span className="hist-stat-label">Best</span>
            <strong className={`hist-stat-value hist-tone-${scoreTone(stats.best)}`}>
              <AnimatedNumber value={stats.best} />
            </strong>
            <small className="hist-stat-sub hist-muted">peak sentiment</small>
          </div>
          <div className="hist-stat">
            <span className="hist-stat-label">Total runs</span>
            <strong className="hist-stat-value">
              <AnimatedNumber value={stats.count} />
            </strong>
            <small className="hist-stat-sub hist-muted">all analyses</small>
          </div>
        </div>
      )}

      {/* two-column layout */}
      <div className="hist-layout">
        {/* sidebar */}
        <aside className="hist-side">
          {/* donut */}
          <div className="hist-panel">
            <div className="hist-panel-head">
              <h4>Sentiment split</h4>
            </div>
            <div className="hist-donut-wrap">
              <SentimentDonut counts={counts} size={140} />
              <div className="hist-donut-legend">
                <button
                  type="button"
                  className={`hist-legend-row ${filter === "bullish" ? "is-active" : ""}`}
                  onClick={() => setFilter(filter === "bullish" ? "all" : "bullish")}
                >
                  <span className="hist-legend-dot hist-tone-up-bg" />
                  <span>Bullish</span>
                  <strong>{counts.bullish}</strong>
                </button>
                <button
                  type="button"
                  className={`hist-legend-row ${filter === "neutral" ? "is-active" : ""}`}
                  onClick={() => setFilter(filter === "neutral" ? "all" : "neutral")}
                >
                  <span className="hist-legend-dot hist-tone-warn-bg" />
                  <span>Neutral</span>
                  <strong>{counts.neutral}</strong>
                </button>
                <button
                  type="button"
                  className={`hist-legend-row ${filter === "bearish" ? "is-active" : ""}`}
                  onClick={() => setFilter(filter === "bearish" ? "all" : "bearish")}
                >
                  <span className="hist-legend-dot hist-tone-down-bg" />
                  <span>Bearish</span>
                  <strong>{counts.bearish}</strong>
                </button>
              </div>
            </div>
          </div>

          {/* insights */}
          {insights.length > 0 && (
            <div className="hist-panel">
              <div className="hist-panel-head">
                <h4>Insights</h4>
              </div>
              <ul className="hist-insights">
                {insights.map((ins, i) => (
                  <li key={i} className={`hist-insight hist-tone-${ins.tone}-bg`}>
                    <span className="hist-insight-icon">{ins.icon}</span>
                    <span>{ins.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* top symbols */}
          {topSymbols.length > 0 && (
            <div className="hist-panel">
              <div className="hist-panel-head">
                <h4>Top symbols</h4>
              </div>
              <ul className="hist-top-symbols">
                {topSymbols.map(([sym, cnt], i) => {
                  const pct = (cnt / items.length) * 100;
                  return (
                    <li key={sym}>
                      <span className="hist-top-rank">{i + 1}</span>
                      <span className="hist-top-sym">{sym}</span>
                      <span className="hist-top-bar">
                        <span style={{ width: `${pct}%` }} />
                      </span>
                      <small className="hist-muted">{cnt}</small>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </aside>

        {/* main */}
        <div className="hist-main">
          {/* chart */}
          <div className="hist-panel">
            <div className="hist-panel-head">
              <div>
                <h4>Sentiment over time</h4>
                <p className="hist-panel-sub">
                  +100 all bullish · −100 all bearish · click a point to open
                </p>
              </div>
            </div>
            <ScoreChart
              points={[...items].reverse().map((i) => ({
                createdAt: i.createdAt,
                score: i.summary?.score ?? 0,
                id: i._id,
              }))}
              onPointClick={view_item}
            />
          </div>

          {/* toolbar */}
          <div className="hist-toolbar">
            <div className="hist-chips">
              {[
                { id: "all", label: "All", count: counts.all },
                { id: "bullish", label: "Bullish", count: counts.bullish },
                { id: "neutral", label: "Neutral", count: counts.neutral },
                { id: "bearish", label: "Bearish", count: counts.bearish },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`hist-chip ${filter === f.id ? "is-active" : ""} hist-chip-${f.id}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  <span className="hist-chip-count">{f.count}</span>
                </button>
              ))}
            </div>

            <div className="hist-tools">
              <div className="hist-search">
                <I.Search width="14" height="14" />
                <input
                  type="text"
                  placeholder="Filter by symbol…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button type="button" className="hist-search-clear" onClick={() => setQuery("")} aria-label="Clear">
                    <I.X width="12" height="12" />
                  </button>
                )}
              </div>

              <select
                className="hist-sort"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="scoreHigh">Score: high → low</option>
                <option value="scoreLow">Score: low → high</option>
              </select>

              <div className="hist-view-toggle" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={view === "list" ? "is-active" : ""}
                  onClick={() => setView("list")}
                  title="List view"
                  aria-label="List view"
                >
                  <I.List width="15" height="15" />
                </button>
                <button
                  type="button"
                  className={view === "grid" ? "is-active" : ""}
                  onClick={() => setView("grid")}
                  title="Grid view"
                  aria-label="Grid view"
                >
                  <I.Grid width="15" height="15" />
                </button>
                <button
                  type="button"
                  className={view === "timeline" ? "is-active" : ""}
                  onClick={() => setView("timeline")}
                  title="Timeline view"
                  aria-label="Timeline view"
                >
                  <I.Timeline width="15" height="15" />
                </button>
              </div>
            </div>
          </div>

          {/* bulk bar */}
          {selected.length > 0 && (
            <div className="hist-bulk">
              <span>{selected.length} selected</span>
              <div className="hist-bulk-actions">
                {selected.length === 2 && (
                  <button type="button" className="hist-btn hist-btn-ghost hist-btn-sm" onClick={openCompare}>
                    <I.Compare width="14" height="14" /> Compare
                  </button>
                )}
                <button
                  type="button"
                  className="hist-btn hist-btn-danger hist-btn-sm"
                  onClick={() => setConfirmTarget("bulk")}
                >
                  <I.Trash width="14" height="14" /> Delete
                </button>
                <button type="button" className="hist-btn hist-btn-ghost hist-btn-sm" onClick={() => setSelected([])}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* compare panel */}
          {compareOpen && comparePair && (
            <ComparePanel
              a={comparePair[0]}
              b={comparePair[1]}
              onClose={() => { setCompareOpen(false); setSelected([]); }}
            />
          )}

          {/* empty filtered */}
          {filtered.length === 0 ? (
            <div className="hist-empty-card hist-empty-filter">
              <div className="hist-empty-icon"><I.Search width="26" height="26" /></div>
              <h3>No matching analyses</h3>
              <p>Try a different filter{query ? ` or clear "${query}"` : ""}.</p>
              <button
                type="button"
                className="hist-btn hist-btn-ghost"
                onClick={() => { setFilter("all"); setQuery(""); }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            groups.map(([label, group]) => (
              <section className="hist-group" key={label}>
                <div className="hist-group-label">
                  <span>{label}</span>
                  <span className="hist-group-count">{group.length}</span>
                </div>
                <div className={`hist-list hist-list-${view}`}>
                  {group.map((it) => {
                    const s = it.summary || {};
                    const syms = s.symbols || [];
                    const sc = s.score ?? 0;
                    const tone = scoreTone(sc);
                    const busy = busyId === it._id;
                    const isSelected = selected.includes(it._id);
                    // sparkline values: use last runs up to this one
                    const idx = items.findIndex((x) => x._id === it._id);
                    const sparkVals = items.slice(idx, Math.max(idx - 5, -1)).reverse()
                      .map((x) => x.summary?.score ?? 0);

                    return (
                      <div
                        className={`hist-item ${busy ? "is-busy" : ""} ${isSelected ? "is-selected" : ""} hist-item-${view}`}
                        key={it._id}
                      >
                        <label className="hist-item-check" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(it._id)}
                            aria-label={`Select analysis from ${fmtDate(it.createdAt)}`}
                          />
                        </label>

                        <button
                          type="button"
                          className="hist-item-body"
                          onClick={() => !busy && view_item(it._id)}
                          disabled={busy}
                        >
                          <ScoreRing score={sc} size={view === "grid" ? 72 : 62} />

                          <div className="hist-item-main">
                            <div className="hist-item-top">
                              <span className="hist-item-date">
                                <I.Clock width="12" height="12" />
                                {fmtDate(it.createdAt)}
                              </span>
                              <span className={`hist-item-tone hist-tone-${tone}-bg`}>
                                {scoreLabel(sc)}
                              </span>
                            </div>
                            <div className="hist-item-syms">
                              {syms.slice(0, view === "grid" ? 4 : 6).join(", ")}
                              {syms.length > (view === "grid" ? 4 : 6) &&
                                ` +${syms.length - (view === "grid" ? 4 : 6)} more`}
                            </div>
                            <div className="hist-item-counts">
                              <span className="hist-tone-up">▲ {s.bullish ?? 0}</span>
                              <span className="hist-tone-warn">● {s.neutral ?? 0}</span>
                              <span className="hist-tone-down">▼ {s.bearish ?? 0}</span>
                              <span className="hist-muted">Qty {s.totalQuantity ?? 0}</span>
                            </div>
                            {sparkVals.length > 1 && (
                              <div className="hist-item-spark">
                                <span className="hist-muted">Trend</span>
                                <Sparkline values={sparkVals} width={view === "grid" ? 120 : 90} height={22} />
                              </div>
                            )}
                          </div>
                        </button>

                        <div className="hist-item-actions">
                          <button
                            type="button"
                            className="hist-btn hist-btn-ghost hist-btn-sm hist-btn-icon"
                            disabled={busy}
                            onClick={() => setConfirmTarget(it._id)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            <I.Trash width="14" height="14" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirmTarget}
        title={confirmTarget === "bulk" ? "Delete selected analyses?" : "Delete this analysis?"}
        body={
          confirmTarget === "bulk"
            ? `This removes ${selected.length} analyses from your history permanently.`
            : "This removes it from your history permanently. The saved portfolio is unaffected."
        }
        confirmLabel={confirmTarget === "bulk" ? "Delete all" : "Delete"}
        count={confirmTarget === "bulk" ? selected.length : undefined}
        busy={confirmBusy}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}