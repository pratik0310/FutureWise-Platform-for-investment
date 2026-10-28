import { useId } from "react";
import "./Logo.css";

// Wallet body (same silhouette idea as before, softer corners)
const WALLET =
  "M9 22C9 17.6 12.6 14 17 14H43C47.4 14 51 17.6 51 22V49C51 53.4 47.4 57 43 57H17C12.6 57 9 53.4 9 49V22Z";

/* The mark on its own: use it for favicons, avatars, loaders. */
export function LogoMark({ size = 40, className = "" }) {
  // unique gradient ids so several logos can live on one page
  const uid = useId().replace(/:/g, "");
  const body = `fw-body-${uid}`;
  const flap = `fw-flap-${uid}`;
  const card = `fw-card-${uid}`;
  const shine = `fw-shine-${uid}`;

  return (
    <svg
      className={`fw-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={body} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D94800" />
          <stop offset="100%" stopColor="#FAA307" />
        </linearGradient>
        <linearGradient id={flap} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FAA307" />
          <stop offset="100%" stopColor="#D94800" />
        </linearGradient>
        <linearGradient id={card} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFD58A" />
          <stop offset="100%" stopColor="#FAA307" />
        </linearGradient>
        <linearGradient id={shine} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Card peeking out of the wallet */}
      <rect x="15" y="8" width="24" height="14" rx="3.5" fill={`url(#${card})`} />
      <rect x="19" y="12" width="9" height="2.6" rx="1.3" fill="#D94800" opacity="0.55" />

      {/* Wallet body + gloss */}
      <path d={WALLET} fill={`url(#${body})`} />
      <path d={WALLET} fill={`url(#${shine})`} />

      {/* Clasp tab straddling the right edge */}
      <rect x="36" y="44" width="20" height="11" rx="5.5" fill={`url(#${flap})`} stroke="#fff" strokeWidth="2.5" />
      <circle cx="43" cy="49.5" r="2" fill="#fff" />

      {/* Chart line: a rising "W" for FutureWise (soft shadow first, then white line) */}
      <path
        d="M14 34L20 43L27 32L33 41L43.7 28.4"
        stroke="#7A2800"
        strokeOpacity="0.28"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0 1.2)"
      />
      <path
        className="fw-line"
        d="M14 34L20 43L27 32L33 41L43.7 28.4"
        pathLength="100"
        stroke="#fff"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Arrow head follows the last segment's angle */}
      <g className="fw-arrow">
        <polygon
          points="0,0 -10,-6.6 -10,6.6"
          transform="translate(50 21) rotate(-49.6)"
          fill="#fff"
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>

      {/* Spark: the "future" */}
      <path
        className="fw-spark"
        d="M57 4L58.6 8.4L63 10L58.6 11.6L57 16L55.4 11.6L51 10L55.4 8.4Z"
        fill="#FFC857"
      />
    </svg>
  );
}

/* Full logo: mark + wordmark. Drop-in replacement for your old <a className="app-logo"> block. */
export default function Logo({ href = "#top", size = 40, showText = true, tagline = "" }) {
  return (
    <a href={href} className="app-logo" aria-label="FutureWise home">
      <LogoMark size={size} />
      {showText && (
        <span className="app-logo-text">
          <span className="app-logo-name">
            <span className="app-logo-future">FUTURE</span>
            <span className="app-logo-wise">WISE</span>
          </span>
          {tagline && <small className="app-logo-tagline">{tagline}</small>}
        </span>
      )}
    </a>
  );
}
