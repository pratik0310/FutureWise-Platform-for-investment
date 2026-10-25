
import "./TrustMeter.css";
import { computeTrust, computeHorizon, computeOverall } from "./trust.js";

// Semicircle gauge with a needle. score 0..100
const Gauge = ({ score, color }) => {
  const len = Math.PI * 50; // arc length for radius 50
  const a = Math.PI * (1 - score / 100);
  const nx = 60 + 38 * Math.cos(a);
  const ny = 60 - 38 * Math.sin(a);
  const arc = "M10 60 A50 50 0 0 1 110 60";

  return (
    <svg
      viewBox="0 0 120 70"
      className="tm-gauge"
      role="img"
      aria-label={`Trust score ${score} out of 100`}
    >
      <path d={arc} fill="none" stroke="#2a2d3a" strokeWidth="10" strokeLinecap="round" />
      <path
        d={arc}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${(len * score) / 100} ${len}`}
      />
      <line x1="60" y1="60" x2={nx} y2={ny} stroke="#e8edf5" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="60" r="4" fill="#e8edf5" />
    </svg>
  );
};

export default function TrustMeter({ stock }) {
  const t = computeTrust(stock);
  const h = computeHorizon(stock);

  return (
    <div className="tm-wrap">
      <div className="tm-box">
        <div className="tm-title">Trustometer</div>
        <Gauge score={t.score} color={t.color} />
        <div className="tm-score" style={{ color: t.color }}>
          {t.score}
          <small>/100</small>
        </div>
        <div className="tm-label" style={{ color: t.color }}>
          {t.label} trust
        </div>
      </div>

      <div className="tm-box tm-grow">
        <div className="tm-title">Analysis horizon</div>
        <div className="tm-hbar">
          <div className="tm-hmark" style={{ left: `${h.position}%` }} />
        </div>
        <div className="tm-hends">
          <span>Short term</span>
          <span>Long term</span>
        </div>
        <div className="tm-hlabel">
          {h.label} <small>{h.span}</small>
        </div>
        <div className="tm-hcues">
          Short-term cues: {h.short} &middot; Long-term cues: {h.long}
        </div>
      </div>

      <details className="tm-details">
        <summary>Why this score?</summary>
        <div className="tm-factors">
          {t.factors.map((f) => (
            <div className="tm-factor" key={f.key}>
              <span className="tm-fname">{f.key}</span>
              <div className="tm-fbar">
                <div
                  className="tm-ffill"
                  style={{ width: `${(f.pts / f.max) * 100}%`, background: t.color }}
                />
              </div>
              <span className="tm-fpts">
                {f.pts}/{f.max}
              </span>
              <span className="tm-fnote">{f.note}</span>
            </div>
          ))}
        </div>
        <p className="tm-note">
          Trust shows how well the news backs this analysis (amount, variety, freshness, agreement).
          It does not measure how accurate the call will be. The horizon is a guess from the kind of
          headlines, not a forecast. Not financial advice.
        </p>
      </details>
    </div>
  );
}

// One-line summary shown at the top of the whole analysis
export function OverallTrust({ results }) {
  const o = computeOverall(results);
  if (!o) return null;

  return (
    <div className="tm-overall">
      <span className="tm-overall-dot" style={{ background: o.color }} />
      <span>
        Overall trust{" "}
        <strong style={{ color: o.color }}>
          {o.score}/100 ({o.label})
        </strong>
      </span>
      <span className="tm-sep">&middot;</span>
      <span>{o.horizon}</span>
    </div>
  );
}