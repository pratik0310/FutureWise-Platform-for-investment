import { useState, useEffect, useRef } from "react";
import "./HistoryTab.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

const scoreColor = (s) => (s > 15 ? "#10b981" : s < -15 ? "#ef4444" : "#f59e0b");
const scoreLabel = (s) => (s > 15 ? "Bullish" : s < -15 ? "Bearish" : "Neutral");

const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// Line chart of sentiment score over time (Canvas, no library)
const ScoreChart = ({ points }) => {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const pad = { l: 44, r: 18, t: 16, b: 30 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    const y = (v) => pad.t + ((100 - v) / 200) * innerH;
    const x = (i) =>
      points.length === 1 ? pad.l + innerW / 2 : pad.l + (i / (points.length - 1)) * innerW;

    ctx.clearRect(0, 0, W, H);

    // grid + y labels
    ctx.font = "11px sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    [-100, -50, 0, 50, 100].forEach((v) => {
      ctx.beginPath();
      ctx.moveTo(pad.l, y(v));
      ctx.lineTo(W - pad.r, y(v));
      ctx.strokeStyle = v === 0 ? "#3a3e50" : "#23263a";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#6a7288";
      ctx.fillText(String(v), pad.l - 8, y(v));
    });

    if (!points.length) return;

    // line
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(x(i), y(p.score));
      else ctx.lineTo(x(i), y(p.score));
    });
    ctx.strokeStyle = "#6c63ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(x(i), y(p.score), 4, 0, Math.PI * 2);
      ctx.fillStyle = scoreColor(p.score);
      ctx.fill();
      ctx.strokeStyle = "#1a1d27";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // x labels (first + last)
    ctx.fillStyle = "#6a7288";
    ctx.textBaseline = "alphabetic";
    const short = (d) =>
      new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    ctx.textAlign = "left";
    ctx.fillText(short(points[0].createdAt), pad.l, H - 8);
    if (points.length > 1) {
      ctx.textAlign = "right";
      ctx.fillText(short(points[points.length - 1].createdAt), W - pad.r, H - 8);
    }
  }, [points]);

  return <canvas ref={ref} width={760} height={260} className="hist-canvas" />;
};

export default function HistoryTab({ user, onView, onLogin }) {
  const [items, setItems] = useState([]); // newest first
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

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

  const view = async (id) => {
    setBusyId(id);
    try {
      const r = await fetch(`${API}/api/history/${id}`, { credentials: "include" });
      if (!r.ok) throw new Error("Could not open this analysis.");
      const d = await r.json();
      onView(d.results);
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this analysis from history?")) return;
    setBusyId(id);
    try {
      const r = await fetch(`${API}/api/history/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Could not delete.");
      setItems((prev) => prev.filter((i) => i._id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!user)
    return (
      <div className="hist-wrap">
        <div className="hist-empty">
          <h3>Sign in to see your history</h3>
          <p>Every analysis you run is saved to your account.</p>
          <button className="hist-btn primary" onClick={onLogin}>
            Sign in
          </button>
        </div>
      </div>
    );

  if (loading)
    return (
      <div className="hist-wrap">
        <p className="hist-muted">Loading history...</p>
      </div>
    );

  if (error)
    return (
      <div className="hist-wrap">
        <p className="hist-error">{error}</p>
      </div>
    );

  if (items.length === 0)
    return (
      <div className="hist-wrap">
        <div className="hist-empty">
          <h3>No analyses yet</h3>
          <p>Run "Analyze Portfolio" and it will show up here.</p>
        </div>
      </div>
    );

  const asc = [...items].reverse(); // oldest -> newest for chart
  const scores = items.map((i) => i.summary?.score ?? 0);
  const latest = scores[0];
  const prev = scores.length > 1 ? scores[1] : null;
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const best = Math.max(...scores);
  const delta = prev === null ? null : latest - prev;

  return (
    <div className="hist-wrap">
      <div className="hist-header">
        <div>
          <h1>History</h1>
          <p>Your past analyses and sentiment trend</p>
        </div>
        <span>{items.length} saved</span>
      </div>

      <div className="hist-stats">
        <div className="hist-stat">
          <span>Latest score</span>
          <strong style={{ color: scoreColor(latest) }}>{latest}</strong>
          {delta !== null && (
            <small style={{ color: delta >= 0 ? "#10b981" : "#ef4444" }}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} vs previous
            </small>
          )}
        </div>
        <div className="hist-stat">
          <span>Average</span>
          <strong style={{ color: scoreColor(avg) }}>{avg}</strong>
        </div>
        <div className="hist-stat">
          <span>Best</span>
          <strong style={{ color: scoreColor(best) }}>{best}</strong>
        </div>
        <div className="hist-stat">
          <span>Analyses</span>
          <strong>{items.length}</strong>
        </div>
      </div>

      <div className="hist-card">
        <h4>Portfolio sentiment over time</h4>
        <p className="hist-muted small">
          Score = sentiment of each stock weighted by quantity. +100 all bullish, -100 all
          bearish. This is news sentiment, not price return.
        </p>
        <ScoreChart points={asc.map((i) => ({ createdAt: i.createdAt, score: i.summary?.score ?? 0 }))} />
      </div>

      <div className="hist-list">
        {items.map((it) => {
          const s = it.summary || {};
          const syms = s.symbols || [];
          return (
            <div className="hist-item" key={it._id}>
              <div className="hist-item-main">
                <div className="hist-item-date">{fmtDate(it.createdAt)}</div>
                <div className="hist-item-syms">
                  {syms.slice(0, 6).join(", ")}
                  {syms.length > 6 ? ` +${syms.length - 6} more` : ""}
                </div>
                <div className="hist-item-counts">
                  <span style={{ color: "#10b981" }}>▲ {s.bullish ?? 0}</span>
                  <span style={{ color: "#f59e0b" }}>● {s.neutral ?? 0}</span>
                  <span style={{ color: "#ef4444" }}>▼ {s.bearish ?? 0}</span>
                  <span className="hist-muted">Qty {s.totalQuantity ?? 0}</span>
                </div>
              </div>

              <div
                className="hist-score"
                style={{
                  color: scoreColor(s.score ?? 0),
                  borderColor: scoreColor(s.score ?? 0),
                  background: `${scoreColor(s.score ?? 0)}22`,
                }}
              >
                <strong>{s.score ?? 0}</strong>
                <small>{scoreLabel(s.score ?? 0)}</small>
              </div>

              <div className="hist-actions">
                <button
                  className="hist-btn primary"
                  disabled={busyId === it._id}
                  onClick={() => view(it._id)}
                >
                  View
                </button>
                <button
                  className="hist-btn danger"
                  disabled={busyId === it._id}
                  onClick={() => remove(it._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}