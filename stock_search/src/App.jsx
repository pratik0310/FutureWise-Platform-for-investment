import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import stocks from "./data/stocks.json";
import AuthModal from "./AuthModal";
import HistoryTab from "./HistoryTab";
import AlertsTab from "./AlertsTab";
import ChartModal from "./ChartModal";
import TrustMeter, { OverallTrust } from "./TrustMeter";
import { getSentiment } from "./sentiment";
import "./App.css";
import "./PortfolioValue.css";
import LandingPage from "./LandingPage";
import Logo from "./Logo";

const API = "http://localhost:3000";

// ---- chart palette (leads with orange to match the brand CTA) ----
const CHART_COLORS = [
  "#E8751A", "#6c63ff", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#f472b6", "#34d399", "#fbbf24", "#60a5fa",
];

// ---- formatting helpers ----
const curSymbol = (cur) => (cur === "INR" ? "₹" : cur === "USD" ? "$" : "");
const fmtMoney = (v, cur) =>
  v == null || Number.isNaN(v)
    ? "—"
    : curSymbol(cur) +
    Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const changeColor = (v) =>
  v == null || v === 0 ? "var(--lp-muted)" : v > 0 ? "var(--lp-up)" : "var(--lp-down)";
const compactNum = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e4) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v * 100) / 100);
};
const identity = (n) => n;

// ---- inline icons ----
const SearchIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);
const PlusIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const ChartIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" />
  </svg>
);
const TrashIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
const RefreshIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
  </svg>
);
const SparklesIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5L12 3z" />
  </svg>
);
const TrendUpIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" />
  </svg>
);
const TrendDownIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m22 17-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" />
  </svg>
);
const SunIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

// ---- Animated number ----
function AnimatedNumber({ value, format }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now();
    const duration = 650;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format ? format(display) : Math.round(display)}</>;
}

// ---- Pie chart ----
const PieChart = ({
  data, size = 250, fmt = identity, centerLabel = "Total",
  bgColor = "#1a1d27", textColor = "#e8edf5", mutedColor = "#9aa3b8",
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;
    const ctx = canvas.getContext("2d");
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 8;
    const total = data.reduce((s, i) => s + i.value, 0);

    let raf;
    const start = performance.now();
    const duration = 900;

    const draw = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (total === 0) {
        ctx.fillStyle = mutedColor;
        ctx.font = "600 14px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No data", cx, cy);
        return;
      }

      const revealEnd = -Math.PI / 2 + 2 * Math.PI * eased;
      let cum = -Math.PI / 2;

      data.forEach((item, i) => {
        const slice = (item.value / total) * 2 * Math.PI;
        const sliceEnd = cum + slice;
        const drawEnd = Math.min(sliceEnd, revealEnd);
        if (drawEnd > cum) {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, radius, cum, drawEnd);
          ctx.closePath();
          ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
          ctx.fill();
          ctx.strokeStyle = bgColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        cum = sliceEnd;
      });

      if (eased > 0.92) {
        let lc = -Math.PI / 2;
        data.forEach((item) => {
          const slice = (item.value / total) * 2 * Math.PI;
          const mid = lc + slice / 2;
          lc += slice;
          if (slice > 0.16) {
            const r = radius * 0.68;
            const x = cx + Math.cos(mid) * r;
            const y = cy + Math.sin(mid) * r;
            ctx.fillStyle = "#ffffff";
            ctx.font = "600 11px system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = "rgba(0,0,0,.55)";
            ctx.shadowBlur = 4;
            ctx.fillText(`${item.label} ${((item.value / total) * 100).toFixed(0)}%`, x, y);
            ctx.shadowBlur = 0;
          }
        });
      }

      // donut hole
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.4, 0, 2 * Math.PI);
      ctx.fillStyle = bgColor;
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.font = "700 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fmt(total), cx, cy - 3);

      ctx.fillStyle = mutedColor;
      ctx.font = "500 10px system-ui, sans-serif";
      ctx.fillText(centerLabel, cx, cy + 15);

      if (p < 1) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data, size, fmt, centerLabel, bgColor, textColor, mutedColor]);

  const total = data.reduce((s, i) => s + i.value, 0);
  return (
    <div className="pie-chart-container">
      <canvas ref={canvasRef} width={size} height={size} className="pie-chart-canvas" />
      <div className="pie-legend">
        {data.map((item, i) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
          return (
            <div className="legend-item" key={i}>
              <span className="legend-color" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="legend-label">{item.label}</span>
              <span className="legend-value">{fmt(item.value)} · {pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---- AI analysis text parser ----
const parseAnalysis = (text) => {
  if (!text) return null;
  const cleanText = text.replace(/\[INST\][\s\S]*?\[\/INST\]/g, "").trim();
  const sections = { overall: "", positive: [], concerns: [], impact: "" };
  let current = "overall";
  for (const line of cleanText.split("\n").filter((l) => l.trim())) {
    const lower = line.toLowerCase();
    if (lower.includes("positive") || lower.includes("green") || lower.includes("upside")) {
      current = "positive"; continue;
    } else if (lower.includes("concern") || lower.includes("red") || lower.includes("risk") || lower.includes("flag")) {
      current = "concerns"; continue;
    } else if (lower.includes("impact") || lower.includes("verdict") || lower.includes("overall")) {
      current = "impact"; continue;
    }
    const c = line.replace(/^\d\.\s*/, "").trim();
    if (!c) continue;
    if (current === "positive") sections.positive.push(c);
    else if (current === "concerns") sections.concerns.push(c);
    else if (current === "impact") sections.impact += (sections.impact ? " " : "") + c;
    else sections.overall += (sections.overall ? " " : "") + c;
  }
  return sections;
};

// ============================================================
function App() {
  const [search, setSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [portfolio, setPortfolio] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAuth, setShowAuth] = useState(null);
  const [tab, setTab] = useState("portfolio");
  const [chartFor, setChartFor] = useState(null);
  const [entered, setEntered] = useState(false);

  const [quotes, setQuotes] = useState({});
  const [quotesAt, setQuotesAt] = useState(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [flash, setFlash] = useState(false);

  const portfolioHydrated = useRef(false);

  // theme — same localStorage key as LandingPage so it persists across views
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("lp-theme") || "dark"; } catch { return "dark"; }
  });
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try { localStorage.setItem("lp-theme", next); } catch { /* ignore */ }
  };

  // allow the app shell to use the full width (same trick as LandingPage)
  useEffect(() => {
    document.documentElement.classList.add("app-active");
    return () => document.documentElement.classList.remove("app-active");
  }, []);

  // toasts
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "info") => {
    const id = String(Date.now() + Math.random());
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // restore auth
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((res) => { if (res.ok) return res.json(); throw new Error(); })
      .then((data) => {
        setUser(data.user);
        setPortfolio(data.user.portfolio || []);
        setAnalysis(data.user.lastAnalysis?.results || null);
        portfolioHydrated.current = true;
      })
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  // autosave
  useEffect(() => {
    if (!user || !portfolioHydrated.current) return;
    const t = setTimeout(() => {
      fetch(`${API}/api/portfolio`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio }),
      }).catch((e) => console.error("Autosave failed:", e));
    }, 800);
    return () => clearTimeout(t);
  }, [portfolio, user]);

  // search
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return stocks
      .filter((s) =>
        String(s.name || "").toLowerCase().includes(q) ||
        String(s.symbol || "").toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [search]);

  useEffect(() => { setHighlighted(0); }, [search]);

  const selectStock = (stock) => {
    setSelectedStock(stock);
    setSearch(stock.name);
    setShowResults(false);
  };

  const addToPortfolio = () => {
    if (!selectedStock) return showToast("Pick a stock first.", "warn");
    const qty = Number(quantity);
    if (!qty || qty <= 0) return showToast("Enter a valid quantity.", "warn");
    const existing = portfolio.find((i) => i.symbol === selectedStock.symbol);
    if (existing) {
      setPortfolio(portfolio.map((i) =>
        i.symbol === selectedStock.symbol ? { ...i, quantity: i.quantity + qty } : i
      ));
      showToast(`${qty} more ${selectedStock.symbol} added.`, "success");
    } else {
      setPortfolio([...portfolio, {
        symbol: selectedStock.symbol,
        name: selectedStock.name,
        exchange: selectedStock.exchange || "NSE",
        quantity: qty,
      }]);
      showToast(`${selectedStock.symbol} added to portfolio.`, "success");
    }
    setQuantity(""); setSearch(""); setSelectedStock(null); setShowResults(false);
  };

  const removeStock = (symbol) => {
    setPortfolio(portfolio.filter((s) => s.symbol !== symbol));
    showToast(`${symbol} removed.`, "info");
  };

  // quotes
  const qKey = (s) => `${s.symbol}|${s.exchange || "NSE"}`;
  const portfolioKey = useMemo(
    () => portfolio.map((s) => `${s.symbol}|${s.exchange || "NSE"}`).join(","),
    [portfolio]
  );

  useEffect(() => {
    if (portfolio.length === 0) { setQuotes({}); setQuotesAt(null); return; }
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      setQuotesLoading(true);
      try {
        const r = await fetch(`${API}/api/quotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stocks: portfolio.map((s) => ({ symbol: s.symbol, exchange: s.exchange || "NSE" })),
          }),
        });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled) {
          setQuotes(d.quotes || {});
          setQuotesAt(d.at || new Date().toISOString());
          setQuotesError(false);
        }
      } catch { if (!cancelled) setQuotesError(true); }
      finally { if (!cancelled) setQuotesLoading(false); }
    };
    load();
    const id = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioKey, refreshTick]);

  useEffect(() => {
    if (!quotesAt) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [quotesAt]);

  // derived data
  const holdings = useMemo(
    () => portfolio.map((stock) => {
      const q = quotes[qKey(stock)] || null;
      return { stock, q, value: q ? q.price * stock.quantity : null };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [portfolio, quotes]
  );

  const totals = useMemo(() => {
    const out = {};
    holdings.forEach(({ stock, q, value }) => {
      if (!q) return;
      const cur = q.currency || "INR";
      if (!out[cur]) out[cur] = { value: 0, day: 0, prev: 0 };
      out[cur].value += value;
      const chg = q.change ?? 0;
      out[cur].day += chg * stock.quantity;
      out[cur].prev += (q.prevClose ?? q.price - chg) * stock.quantity;
    });
    return out;
  }, [holdings]);

  const curList = Object.keys(totals);
  const missingPrices = holdings.filter((h) => !h.q).length;
  const pieByValue = holdings.length > 0 && missingPrices === 0 && curList.length === 1;
  const pieCur = curList[0];

  const totalQuantity = useMemo(
    () => portfolio.reduce((t, s) => t + s.quantity, 0),
    [portfolio]
  );

  const pieData = useMemo(
    () => holdings.map(({ stock, value }) => ({
      label: stock.symbol,
      value: pieByValue ? value : stock.quantity,
    })),
    [holdings, pieByValue]
  );

  const pieFmt = useMemo(
    () => (pieByValue ? (n) => curSymbol(pieCur) + compactNum(n) : identity),
    [pieByValue, pieCur]
  );

  // analyze
  const analyzePortfolio = async () => {
    if (portfolio.length === 0) return showToast("Add at least one stock.", "warn");
    if (!user) { setShowAuth("signin"); return; }
    setLoading(true); setAnalysis(null);
    try {
      const res = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ portfolio }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Analysis failed.");
      setAnalysis(data.results);
      showToast("Analysis complete.", "success");
    } catch (e) {
      console.error(e);
      showToast(e.message || "Could not connect to the server.", "error");
    } finally { setLoading(false); }
  };

  // auth
  const handleAuthSuccess = (u) => {
    setUser(u);
    setPortfolio(u.portfolio || []);
    setAnalysis(u.lastAnalysis?.results || null);
    portfolioHydrated.current = true;
    setShowAuth(null);
    showToast(`Welcome, ${u.displayName || "there"}!`, "success");
  };

  const handleLogout = async () => {
    try { await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }); } catch { /* ignore */ }
    setUser(null); setPortfolio([]); setAnalysis(null);
    portfolioHydrated.current = false;
    setTab("portfolio"); setEntered(false);
    showToast("Signed out.", "info");
  };

  const viewFromHistory = (results) => {
    setAnalysis(results); setTab("portfolio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const exchangeTone = (ex) => (ex === "US" ? "us" : "nse");

  // ---- guards ----
  if (checkingAuth) {
    return (
      <div className="app-lp" data-theme={theme}>
        <div className="app-boot">
          <div className="app-boot-spinner" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user && !entered) {
    return (
      <LandingPage
        onSignIn={() => { setEntered(true); setShowAuth("signin"); }}
        onSignUp={() => { setEntered(true); setShowAuth("signup"); }}
        onStart={() => setEntered(true)}
      />
    );
  }

  return (
    <div className="app-lp" data-theme={theme}>
      {/* ============ NAV ============ */}
      <header className="app-nav">
        <div className="app-in app-nav-in">
          {/* Logo */}
          <Logo />

          {/* Tabs */}
          <nav className="app-tabs" aria-label="Main sections">
            {[
              {
                id: "portfolio", label: "Portfolio", icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
                )
              },
              {
                id: "history", label: "History", icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                )
              },
              {
                id: "alerts", label: "Alerts", icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                )
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`app-tab ${tab === t.id ? "is-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className="app-tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="app-nav-actions">
            <button
              type="button"
              className="app-theme"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
              )}
            </button>

            {user ? (
              <div className="app-user">
                <div className="app-avatar-wrap">
                  {user.photo ? (
                    <img src={user.photo} alt="" className="app-avatar-img" />
                  ) : (
                    <span className="app-avatar">
                      {(user.displayName || "?")[0].toUpperCase()}
                    </span>
                  )}
                  <span className="app-avatar-status" />
                </div>
                <span className="app-user-name">{user.displayName}</span>
                <div className="app-user-divider" />
                <button type="button" className="app-btn app-btn-ghost app-btn-sm app-logout-btn" onClick={handleLogout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                  Logout
                </button>
              </div>
            ) : (
              <div className="app-auth-actions">
                <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => setShowAuth("signin")}>
                  Sign in
                </button>
                <button type="button" className="app-btn app-btn-solid app-btn-sm" onClick={() => setShowAuth("signup")}>
                  Sign up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="app-main" id="top">
        {tab === "portfolio" && (
          <div className="app-in">

            {/* ============ SEARCH ============ */}
            <section className="app-search-section">
              <h1 className="app-h1">Your Portfolio</h1>
              <p className="app-sub">Search, track, and understand every holding in one view.</p>

              <div className="app-search">
                <div className="app-search-field">
                  <SearchIcon width="18" height="18" />
                  <input
                    type="text"
                    placeholder="Search company or symbol…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSelectedStock(null); setShowResults(true); }}
                    onFocus={() => setShowResults(true)}
                    onBlur={() => setTimeout(() => setShowResults(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((i) => Math.min(i + 1, results.length - 1)); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((i) => Math.max(i - 1, 0)); }
                      else if (e.key === "Enter" && results[highlighted]) { selectStock(results[highlighted]); }
                      else if (e.key === "Escape") setShowResults(false);
                    }}
                  />
                  <span className="app-search-kbd">/</span>
                </div>

                {showResults && search && (
                  <div className="app-search-results" onMouseDown={(e) => e.preventDefault()}>
                    {results.length === 0 ? (
                      <div className="app-search-empty">
                        <strong>"{search}"</strong> didn't match any stocks.
                        <small>Try a different name or symbol.</small>
                      </div>
                    ) : (
                      results.map((s, i) => (
                        <button
                          key={s.symbol}
                          type="button"
                          className={`app-search-item ${i === highlighted ? "is-hl" : ""}`}
                          onMouseEnter={() => setHighlighted(i)}
                          onClick={() => selectStock(s)}
                        >
                          <div className="app-search-item-main">
                            <span className="app-search-item-name">{s.name}</span>
                            <span className="app-search-item-sub">{s.symbol}</span>
                          </div>
                          <span className={`app-exchange app-exchange-${exchangeTone(s.exchange)}`}>
                            {s.exchange || "NSE"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ============ SELECTED STOCK ============ */}
            {selectedStock && (
              <section className="app-selected fade-up">
                <div className="app-selected-info">
                  <h2>{selectedStock.name}</h2>
                  <p>
                    <strong>{selectedStock.symbol}</strong>
                    <span className="app-sep">·</span>
                    {selectedStock.exchange || "NSE"}
                  </p>
                </div>
                <div className="app-selected-actions">
                  <input
                    type="number"
                    min="1"
                    placeholder="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <button type="button" className="app-btn app-btn-solid" onClick={addToPortfolio}>
                    <PlusIcon width="16" height="16" /> Add
                  </button>
                  <button type="button" className="app-btn app-btn-ghost" onClick={() => setChartFor(selectedStock)}>
                    <ChartIcon width="16" height="16" /> Chart
                  </button>
                </div>
              </section>
            )}

            {/* ============ PORTFOLIO ============ */}
            <section className="app-panel">
              <div className="app-panel-head">
                <div>
                  <h2>Holdings</h2>
                  <p>
                    {portfolio.length} stock{portfolio.length === 1 ? "" : "s"}
                    {totalQuantity > 0 && ` · ${totalQuantity} total qty`}
                  </p>
                </div>
                <button
                  type="button"
                  className={`app-btn app-btn-ghost app-btn-sm ${quotesLoading ? "is-loading" : ""}`}
                  onClick={() => setRefreshTick((n) => n + 1)}
                  disabled={quotesLoading}
                >
                  <RefreshIcon width="14" height="14" /> {quotesLoading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {portfolio.length === 0 ? (
                <div className="app-empty">
                  <div className="app-empty-icon"><ChartIcon width="40" height="40" /></div>
                  <h3>No stocks yet</h3>
                  <p>Search for a stock above to start tracking live prices and AI analysis.</p>
                </div>
              ) : (
                <>
                  {/* value cards */}
                  <div className="app-value-grid">
                    {curList.length === 0 && !quotesError && (
                      <>
                        <div className="app-value-card app-skeleton" />
                        <div className="app-value-card app-skeleton" />
                      </>
                    )}
                    {curList.length === 0 && quotesError && (
                      <div className="app-value-card">
                        <span className="app-value-label">Portfolio value</span>
                        <strong className="app-value-num">—</strong>
                        <small className="app-value-delta">Could not load prices</small>
                      </div>
                    )}
                    {curList.map((cur) => {
                      const t = totals[cur];
                      const dayPct = t.prev > 0 ? (t.day / t.prev) * 100 : null;
                      const up = t.day >= 0;
                      return (
                        <div className="app-value-card" key={cur}>
                          <span className="app-value-label">
                            Portfolio value {curList.length > 1 ? `(${cur})` : ""}
                          </span>
                          <strong className="app-value-num">
                            <AnimatedNumber value={t.value} format={(n) => fmtMoney(n, cur)} />
                          </strong>
                          <small className="app-value-delta" style={{ color: changeColor(t.day) }}>
                            {up ? <TrendUpIcon width="12" height="12" /> : <TrendDownIcon width="12" height="12" />}
                            {fmtMoney(Math.abs(t.day), cur)} ({fmtPct(dayPct)}) today
                          </small>
                        </div>
                      );
                    })}
                  </div>

                  <div className="app-meta">
                    <span className={`app-live ${quotesLoading ? "is-pulse" : ""}`} />
                    {quotesError
                      ? "Could not load prices."
                      : quotesAt
                        ? `Updated ${new Date(quotesAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · auto-refresh every 60s`
                        : "Loading prices…"}
                    {missingPrices > 0 && curList.length > 0 && ` · ${missingPrices} pending`}
                  </div>

                  {/* pie + holdings */}
                  <div className="app-portfolio-layout">
                    <div className="app-pie-card">
                      <h4>Allocation</h4>
                      <PieChart
                        data={pieData}
                        size={240}
                        fmt={pieFmt}
                        centerLabel={pieByValue ? "Value" : "Total qty"}
                        bgColor={theme === "dark" ? "#1a1d27" : "#ffffff"}
                        textColor={theme === "dark" ? "#e8edf5" : "#14161f"}
                        mutedColor={theme === "dark" ? "#9aa3b8" : "#566079"}
                      />
                    </div>

                    <div className="app-holdings">
                      {holdings.map(({ stock, q, value }) => {
                        const curTotal = q ? totals[q.currency || "INR"]?.value : 0;
                        const alloc = q && curTotal > 0
                          ? ((value / curTotal) * 100).toFixed(1)
                          : totalQuantity > 0
                            ? ((stock.quantity / totalQuantity) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <div className="app-holding" key={stock.symbol}>
                            <div className="app-holding-id">
                              <h3>{stock.symbol}</h3>
                              <p>{stock.name}</p>
                              <span className={`app-exchange app-exchange-${exchangeTone(stock.exchange)}`}>
                                {stock.exchange || "NSE"}
                              </span>
                            </div>
                            <div className="app-holding-cell">
                              <span>Qty</span>
                              <strong>{stock.quantity}</strong>
                            </div>
                            <div className="app-holding-cell">
                              <span>Price</span>
                              <strong className={flash && q ? "is-flash" : ""}>
                                {q ? fmtMoney(q.price, q.currency) : "—"}
                              </strong>
                              {q && (
                                <small style={{ color: changeColor(q.changePct) }}>
                                  {q.change >= 0 ? "▲" : "▼"} {fmtPct(q.changePct)}
                                </small>
                              )}
                            </div>
                            <div className="app-holding-cell">
                              <span>Value</span>
                              <strong className={flash && q ? "is-flash" : ""}>
                                {q ? fmtMoney(value, q.currency) : "—"}
                              </strong>
                            </div>
                            <div className="app-holding-cell">
                              <span>Alloc</span>
                              <strong>{alloc}%</strong>
                            </div>
                            <div className="app-holding-tools">
                              <button
                                type="button"
                                className="app-icon-btn"
                                onClick={() => setChartFor(stock)}
                                title="Chart"
                              >
                                <ChartIcon width="15" height="15" />
                              </button>
                              <button
                                type="button"
                                className="app-icon-btn app-icon-danger"
                                onClick={() => removeStock(stock.symbol)}
                                title="Remove"
                              >
                                <TrashIcon width="15" height="15" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="app-analyze-btn"
                    onClick={analyzePortfolio}
                    disabled={loading}
                  >
                    <SparklesIcon width="18" height="18" />
                    {loading ? "Analyzing portfolio…" : "Analyze Portfolio with FinGPT"}
                  </button>
                </>
              )}
            </section>

            {/* ============ LOADING SKELETON ============ */}
            {loading && (
              <section className="app-panel app-skeleton-panel">
                <div className="app-sk-line w-40" />
                <div className="app-sk-line w-90" />
                <div className="app-sk-line w-70" />
                <div className="app-sk-line w-85" />
                <div className="app-sk-line w-60" />
              </section>
            )}

            {/* ============ ANALYSIS ============ */}
            {analysis && !loading && (
              <section className="app-analysis fade-up">
                <div className="app-analysis-head">
                  <div>
                    <h2>Portfolio Analysis</h2>
                    <p>Recent news and AI-driven insights for your holdings</p>
                  </div>
                  <span className="app-pill">FinGPT</span>
                </div>

                <OverallTrust results={analysis} />

                {analysis.map((stock) => {
                  const parsed = parseAnalysis(stock.analysis);
                  const sentiment = getSentiment(stock.analysis);
                  return (
                    <article className="app-analysis-stock" key={stock.symbol}>
                      <header className="app-analysis-stock-head">
                        <div>
                          <h3>{stock.symbol}</h3>
                          <p>{stock.company}</p>
                        </div>
                        <div className="app-analysis-badges">
                          <span className="app-qty-badge">Qty {stock.quantity}</span>
                          <span
                            className="app-sentiment-badge"
                            style={{
                              background: `${sentiment.color}1f`,
                              color: sentiment.color,
                              borderColor: `${sentiment.color}66`,
                            }}
                          >
                            {sentiment.icon} {sentiment.label}
                          </span>
                        </div>
                      </header>

                      <TrustMeter stock={stock} />

                      <div className="app-news-block">
                        <h4>Recent news</h4>
                        {stock.news && stock.news.length > 0 ? (
                          <ul className="app-news-list">
                            {stock.news.map((n, i) => (
                              <li key={i}>
                                <strong>{n.title}</strong>
                                <small>{n.source} · {n.posted}</small>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="app-muted">No recent news found.</p>
                        )}
                      </div>

                      {parsed && (parsed.positive.length || parsed.concerns.length || parsed.impact) ? (
                        <div className="app-analysis-sections">
                          {parsed.positive.length > 0 && (
                            <div className="app-note app-note-up">
                              <h4>Positive developments</h4>
                              <ul>
                                {parsed.positive.map((t, i) => <li key={i}>{t}</li>)}
                              </ul>
                            </div>
                          )}
                          {parsed.concerns.length > 0 && (
                            <div className="app-note app-note-down">
                              <h4>Potential concerns</h4>
                              <ul>
                                {parsed.concerns.map((t, i) => <li key={i}>{t}</li>)}
                              </ul>
                            </div>
                          )}
                          {parsed.impact && (
                            <div className="app-note app-note-info">
                              <h4>Overall impact</h4>
                              <p>{parsed.impact}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="app-note app-note-info">
                          <div className="app-analysis-text">
                            {(stock.analysis || "")
                              .replace(/\[INST\][\s\S]*?\[\/INST\]/g, "")
                              .trim()
                              .split("\n")
                              .map((l, i) => <p key={i}>{l}</p>)}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="app-in">
            <HistoryTab
              user={user}
              onView={viewFromHistory}
              onLogin={() => setShowAuth("signin")}
              onToast={showToast}
            />
          </div>
        )}

        {tab === "alerts" && (
          <div className="app-in">
            <AlertsTab user={user} portfolio={portfolio} onLogin={() => setShowAuth("signin")} />
          </div>
        )}
      </main>

      {/* Modals */}
      {chartFor && <ChartModal stock={chartFor} onClose={() => setChartFor(null)} />}
      {showAuth && (
        <AuthModal
          initialMode={showAuth}
          onClose={() => setShowAuth(null)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* Toasts */}
      <div className="app-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`app-toast app-toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;