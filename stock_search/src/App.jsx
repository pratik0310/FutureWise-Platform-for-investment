import { useState, useEffect, useRef } from "react";
import stocks from "./data/stocks.json";
import AuthModal from "./AuthModal";
import HistoryTab from "./HistoryTab";
import AlertsTab from "./AlertsTab";
import ChartModal from "./ChartModal";
import TrustMeter, { OverallTrust } from "./TrustMeter";
import { getSentiment } from "./sentiment";
import "./App.css";
import "./PortfolioValue.css";

const API = "http://localhost:3000";

const CHART_COLORS = [
  "#6c63ff", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f472b6", "#34d399", "#fbbf24", "#60a5fa",
];

// ---- price formatting helpers ----
const curSymbol = (cur) => (cur === "INR" ? "₹" : cur === "USD" ? "$" : "");

const fmtMoney = (v, cur) =>
  v == null || Number.isNaN(v)
    ? "—"
    : curSymbol(cur) +
      Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (v) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);

const changeColor = (v) => (v == null || v === 0 ? "#6a7288" : v > 0 ? "#10b981" : "#ef4444");

// short number for the donut centre: 1.2L, 3.4Cr, 12.5K
const compactNum = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n);
  if (v >= 1e7) return `${(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(2)}L`;
  if (v >= 1e4) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v * 100) / 100);
};
const identity = (n) => n;

// PIE CHART COMPONENT (Canvas-based). Defined OUTSIDE App so it does not remount on every render.
const PieChart = ({ data, size = 250, fmt = identity, centerLabel = "Total" }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    const total = data.reduce((sum, item) => sum + item.value, 0);

    if (total === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#5a6278";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data", centerX, centerY + 6);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let startAngle = -Math.PI / 2;

    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      const color = CHART_COLORS[index % CHART_COLORS.length];

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#1a1d27";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (sliceAngle > 0.1) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelRadius = radius * 0.65;
        const labelX = centerX + Math.cos(midAngle) * labelRadius;
        const labelY = centerY + Math.sin(midAngle) * labelRadius;

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const percentage = ((item.value / total) * 100).toFixed(1);
        const label = `${item.label} (${percentage}%)`;

        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.fillText(label, labelX, labelY);
        ctx.shadowBlur = 0;
      }
      startAngle += sliceAngle;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.35, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a1d27";
    ctx.fill();
    ctx.strokeStyle = "#2a2d3a";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#e8edf5";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fmt(total), centerX, centerY - 4);
    ctx.fillStyle = "#6a7288";
    ctx.font = "10px sans-serif";
    ctx.fillText(centerLabel, centerX, centerY + 14);
  }, [data, size, fmt, centerLabel]);

  const total = data.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="pie-chart-container">
      <canvas ref={canvasRef} width={size} height={size} className="pie-chart-canvas" />
      <div className="pie-legend">
        {data.map((item, index) => {
          const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
          return (
            <div className="legend-item" key={index}>
              <span
                className="legend-color"
                style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="legend-label">{item.label}</span>
              <span className="legend-value">{fmt(item.value)} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function App() {
  const [search, setSearch] = useState("");
  const [selectedStock, setSelectedStock] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [portfolio, setPortfolio] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // --- User Authentication State ---
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAuth, setShowAuth] = useState(null); // null | "signin" | "signup"
  const [tab, setTab] = useState("portfolio"); // "portfolio" | "history"
  const [chartFor, setChartFor] = useState(null); // stock to show chart for

  // --- live prices ---
  const [quotes, setQuotes] = useState({}); // "SYMBOL|EXCHANGE" -> { price, change, changePct, prevClose, currency }
  const [quotesAt, setQuotesAt] = useState(null);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // true only after saved portfolio is loaded from DB (blocks early autosave that would wipe DB)
  const portfolioHydrated = useRef(false);

  // Check login on page load + restore saved portfolio and last analysis
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not logged in");
      })
      .then((data) => {
        setUser(data.user);
        setPortfolio(data.user.portfolio || []);
        // backend stores full response {success, results}; UI needs the results array
        setAnalysis(data.user.lastAnalysis?.results || null);
        portfolioHydrated.current = true;
      })
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  // Autosave portfolio to DB (debounced). Only when logged in and after hydrate.
  useEffect(() => {
    if (!user || !portfolioHydrated.current) return;

    const timer = setTimeout(() => {
      fetch(`${API}/api/portfolio`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio }),
      }).catch((e) => console.error("Autosave failed:", e));
    }, 800);

    return () => clearTimeout(timer);
  }, [portfolio, user]);

  // Debug: Check stocks
  useEffect(() => {
    console.log("📊 Total stocks loaded:", stocks?.length || 0);
    const nseCount = stocks?.filter((s) => s.exchange === "NSE").length || 0;
    const usCount = stocks?.filter((s) => s.exchange === "US").length || 0;
    console.log(`   🇮🇳 NSE: ${nseCount}, 🇺🇸 US: ${usCount}`);
  }, []);

  // Search results
  const results =
    search.trim() === ""
      ? []
      : stocks
          .filter((stock) => {
            const query = search.toLowerCase();
            const name = String(stock.name || "").toLowerCase();
            const symbol = String(stock.symbol || "").toLowerCase();
            return name.includes(query) || symbol.includes(query);
          })
          .slice(0, 15);

  const selectStock = (stock) => {
    setSelectedStock(stock);
    setSearch(stock.name);
    setShowResults(false);
  };

  const addToPortfolio = () => {
    if (!selectedStock) {
      alert("Please select a stock.");
      return;
    }

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    const existingStock = portfolio.find(
      (item) => item.symbol === selectedStock.symbol
    );

    if (existingStock) {
      setPortfolio(
        portfolio.map((item) =>
          item.symbol === selectedStock.symbol
            ? { ...item, quantity: item.quantity + qty }
            : item
        )
      );
    } else {
      setPortfolio([
        ...portfolio,
        {
          symbol: selectedStock.symbol,
          name: selectedStock.name,
          exchange: selectedStock.exchange || "NSE",
          quantity: qty,
        },
      ]);
    }

    setQuantity("");
    setSearch("");
    setSelectedStock(null);
    setShowResults(false);
  };

  const removeStock = (symbol) => {
    setPortfolio(portfolio.filter((stock) => stock.symbol !== symbol));
  };

  const totalQuantity = portfolio.reduce(
    (total, stock) => total + stock.quantity,
    0
  );

  // ---- live prices: load now, then every 60s while the tab is visible ----
  const qKey = (s) => `${s.symbol}|${s.exchange || "NSE"}`;
  const portfolioKey = portfolio.map(qKey).join(",");

  useEffect(() => {
    if (portfolio.length === 0) {
      setQuotes({});
      setQuotesAt(null);
      return;
    }

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
        if (!r.ok) throw new Error("quotes failed");
        const d = await r.json();
        if (!cancelled) {
          setQuotes(d.quotes || {});
          setQuotesAt(d.at || new Date().toISOString());
          setQuotesError(false);
        }
      } catch {
        if (!cancelled) setQuotesError(true);
      } finally {
        if (!cancelled) setQuotesLoading(false);
      }
    };

    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioKey, refreshTick]);

  // per-holding price/value, plus totals per currency (never mixes INR and USD)
  const holdings = portfolio.map((stock) => {
    const q = quotes[qKey(stock)] || null;
    return {
      stock,
      q,
      value: q ? q.price * stock.quantity : null,
    };
  });

  const totals = {};
  holdings.forEach(({ stock, q, value }) => {
    if (!q) return;
    const cur = q.currency || "INR";
    if (!totals[cur]) totals[cur] = { value: 0, day: 0, prev: 0 };
    totals[cur].value += value;
    const chg = q.change ?? 0;
    totals[cur].day += chg * stock.quantity;
    totals[cur].prev += (q.prevClose ?? q.price - chg) * stock.quantity;
  });
  const curList = Object.keys(totals);
  const missingPrices = holdings.filter((h) => !h.q).length;
  const pieByValue = holdings.length > 0 && missingPrices === 0 && curList.length === 1;
  const pieCur = curList[0];

  // Call our Node backend, not ngrok directly
  const analyzePortfolio = async () => {
    if (portfolio.length === 0) {
      alert("Add at least one stock to your portfolio.");
      return;
    }

    if (!user) {
      setShowAuth("signin");
      return;
    }

    setLoading(true);
    setAnalysis(null);

    try {
      const response = await fetch(`${API}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ portfolio }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      console.log("FinGPT API response via backend:");
      console.log(data);

      if (!data.success) {
        throw new Error(data.error || "Portfolio analysis failed.");
      }

      setAnalysis(data.results);
    } catch (error) {
      console.error("Portfolio analysis error:", error);
      alert(error.message || "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  // --- Auth Handlers ---
  const handleAuthSuccess = (u) => {
    setUser(u);
    setPortfolio(u.portfolio || []);
    setAnalysis(u.lastAnalysis?.results || null);
    portfolioHydrated.current = true;
    setShowAuth(null);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("Logout failed:", e);
    }
    setUser(null);
    setPortfolio([]);
    setAnalysis(null);
    portfolioHydrated.current = false;
    setTab("portfolio");
  };

  // "View" on a history item: show that old analysis on the Portfolio tab
  const viewFromHistory = (results) => {
    setAnalysis(results);
    setTab("portfolio");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // donut shows share of money once every stock has a price; before that, share of quantity
  const pieData = holdings.map(({ stock, value }) => ({
    label: stock.symbol,
    value: pieByValue ? value : stock.quantity,
  }));
  const pieFmt = pieByValue ? (n) => curSymbol(pieCur) + compactNum(n) : identity;

  const parseAnalysis = (text) => {
    if (!text) return null;
    let cleanText = text.replace(/\[INST\][\s\S]*?\[\/INST\]/g, "").trim();
    const sections = { overall: "", positive: [], concerns: [], impact: "" };
    const lines = cleanText.split("\n").filter((line) => line.trim());
    let currentSection = "overall";
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes("positive") || lower.includes("green") || lower.includes("upside")) {
        currentSection = "positive";
        continue;
      } else if (lower.includes("concern") || lower.includes("red") || lower.includes("risk") || lower.includes("flag")) {
        currentSection = "concerns";
        continue;
      } else if (lower.includes("impact") || lower.includes("verdict") || lower.includes("overall")) {
        currentSection = "impact";
        continue;
      }
      const cleanLine = line.replace(/^\d\.\s*/, "").trim();
      if (cleanLine) {
        if (currentSection === "positive") sections.positive.push(cleanLine);
        else if (currentSection === "concerns") sections.concerns.push(cleanLine);
        else if (currentSection === "impact")
          sections.impact += (sections.impact ? " " : "") + cleanLine;
        else sections.overall += (sections.overall ? " " : "") + cleanLine;
      }
    }
    return sections;
  };


  const getExchangeColor = (exchange) => {
    if (exchange === "NSE") return "#6c63ff";
    if (exchange === "US") return "#10b981";
    return "#6c63ff";
  };

  // Don't render the app until we know if the user is logged in
  if (checkingAuth)
    return (
      <div style={{ color: "white", textAlign: "center", marginTop: "50px" }}>
        Loading...
      </div>
    );

  return (
    <div className="app">
      {/* Authentication Header */}
      <div
        className="header"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "15px 30px",
          background: "#1a1d27",
          borderBottom: "1px solid #2a2d3a",
        }}
      >
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "15px", color: "white" }}>
            {user.photo && (
              <img src={user.photo} alt="Profile" style={{ width: "35px", borderRadius: "50%" }} />
            )}
            <span style={{ fontWeight: "bold" }}>{user.displayName}</span>
            <button
              onClick={handleLogout}
              style={{
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "5px",
                background: "transparent",
                color: "#ef4444",
                border: "1px solid #ef4444",
              }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setShowAuth("signin")}
              style={{
                cursor: "pointer",
                padding: "8px 16px",
                background: "transparent",
                color: "white",
                border: "1px solid #2a2d3a",
                borderRadius: "5px",
                fontWeight: "bold",
              }}
            >
              Sign in
            </button>
            <button
              onClick={() => setShowAuth("signup")}
              style={{
                cursor: "pointer",
                padding: "8px 16px",
                background: "#6c63ff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                fontWeight: "bold",
              }}
            >
              Sign up
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "portfolio" ? "active" : ""}`}
          onClick={() => setTab("portfolio")}
        >
          Portfolio
        </button>
        <button
          className={`tab-btn ${tab === "history" ? "active" : ""}`}
          onClick={() => setTab("history")}
        >
          History
        </button>
        <button
          className={`tab-btn ${tab === "alerts" ? "active" : ""}`}
          onClick={() => setTab("alerts")}
        >
          Alerts
        </button>
      </div>

      {tab === "portfolio" && (
      <>
      {/* Search Section */}
      <div className="search-container">
        <div className="search-box">
          <span className="search-label">Search Stocks</span>
          <input
            type="text"
            placeholder="Type company name or symbol..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedStock(null);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
          />
        </div>

        {showResults && search && results.length > 0 && (
          <div className="results">
            {results.map((stock) => (
              <div
                className="stock-item"
                key={stock.symbol}
                onClick={() => selectStock(stock)}
              >
                <div className="stock-info">
                  <div className="stock-name">{stock.name}</div>
                  <div className="stock-symbol">{stock.symbol}</div>
                </div>
                <span
                  className="exchange"
                  style={{
                    background: getExchangeColor(stock.exchange),
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "bold",
                  }}
                >
                  {stock.exchange || "NSE"}
                </span>
              </div>
            ))}
          </div>
        )}

        {showResults && search && results.length === 0 && (
          <div className="no-results">
            <span className="no-results-query">"{search}"</span>
            <span> did not match any stocks.</span>
            <span className="no-results-hint">Try a different company name or symbol.</span>
          </div>
        )}
      </div>

      {/* Selected Stock */}
      {selectedStock && (
        <div className="selected-stock">
          <div className="selected-stock-left">
            <h2>{selectedStock.name}</h2>
            <div className="stock-details">
              <p>Symbol: <strong>{selectedStock.symbol}</strong></p>
              <p>Exchange: <strong>{selectedStock.exchange || "NSE"}</strong></p>
            </div>
          </div>
          <div className="quantity-section">
            <input
              type="number"
              min="1"
              placeholder="Quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <button onClick={addToPortfolio}>Add to Portfolio</button>
            <button className="chart-btn" onClick={() => setChartFor(selectedStock)}>
              Chart
            </button>
          </div>
        </div>
      )}

      {/* Portfolio Section */}
      <div className="portfolio">
        <div className="portfolio-header">
          <div>
            <h1>My Portfolio</h1>
            <p>Manage your stock holdings</p>
          </div>
          <span>{portfolio.length} Stocks</span>
        </div>

        {portfolio.length === 0 ? (
          <div className="empty-portfolio">
            <h3>Your portfolio is empty</h3>
            <p>Search for a stock above and add it to your portfolio.</p>
          </div>
        ) : (
          <div className="portfolio-layout">
            <div className="portfolio-chart">
              <h4>Portfolio Allocation</h4>
              <PieChart
                data={pieData}
                size={250}
                fmt={pieFmt}
                centerLabel={pieByValue ? "Value" : "Total qty"}
              />
            </div>

            <div className="portfolio-list-section">
              {/* Total value, like a brokerage app */}
              <div className="pv-wrap">
                {curList.map((cur) => {
                  const t = totals[cur];
                  const dayPct = t.prev > 0 ? (t.day / t.prev) * 100 : null;
                  return (
                    <div className="pv-card" key={cur}>
                      <span>Portfolio value{curList.length > 1 ? ` (${cur})` : ""}</span>
                      <strong className="pv-value">{fmtMoney(t.value, cur)}</strong>
                      <small style={{ color: changeColor(t.day) }}>
                        {t.day >= 0 ? "▲" : "▼"} {fmtMoney(Math.abs(t.day), cur)} ({fmtPct(dayPct)}) today
                      </small>
                    </div>
                  );
                })}
                {curList.length === 0 && (
                  <div className="pv-card">
                    <span>Portfolio value</span>
                    <strong className="pv-value">{quotesError ? "—" : "Loading..."}</strong>
                  </div>
                )}
              </div>
              <div className="pv-meta">
                {quotesError
                  ? "Could not load prices."
                  : quotesAt
                  ? `Prices updated ${new Date(quotesAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}, refresh every 60s. May be delayed.`
                  : "Loading prices..."}
                {missingPrices > 0 && curList.length > 0 && ` ${missingPrices} stock(s) have no price yet.`}{" "}
                <button
                  type="button"
                  className="pv-refresh"
                  disabled={quotesLoading}
                  onClick={() => setRefreshTick((n) => n + 1)}
                >
                  {quotesLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div className="portfolio-summary">
                <div className="summary-card">
                  <span>Total Holdings</span>
                  <strong>{portfolio.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Total Quantity</span>
                  <strong>{totalQuantity}</strong>
                </div>
              </div>

              <div className="portfolio-list">
                {holdings.map(({ stock, q, value }) => {
                  // share of money (same currency) when priced, else share of quantity
                  const curTotal = q ? totals[q.currency || "INR"]?.value : 0;
                  const allocation =
                    q && curTotal > 0
                      ? ((value / curTotal) * 100).toFixed(1)
                      : totalQuantity > 0
                      ? ((stock.quantity / totalQuantity) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <div className="portfolio-stock" key={stock.symbol}>
                      <div className="portfolio-stock-info">
                        <h3>{stock.symbol}</h3>
                        <p>{stock.name}</p>
                        <span
                          style={{
                            fontSize: "11px",
                            color: getExchangeColor(stock.exchange),
                            fontWeight: "bold",
                          }}
                        >
                          {stock.exchange || "NSE"}
                        </span>
                      </div>
                      <div className="holding">
                        <span>Quantity</span>
                        <strong>{stock.quantity}</strong>
                      </div>
                      <div className="holding">
                        <span>Price</span>
                        <strong>{q ? fmtMoney(q.price, q.currency) : "—"}</strong>
                        {q && (
                          <small style={{ color: changeColor(q.changePct) }}>
                            {q.change >= 0 ? "▲" : "▼"} {fmtPct(q.changePct)}
                          </small>
                        )}
                      </div>
                      <div className="holding">
                        <span>Value</span>
                        <strong>{q ? fmtMoney(value, q.currency) : "—"}</strong>
                      </div>
                      <div className="allocation">
                        <span>Allocation</span>
                        <strong>{allocation}%</strong>
                      </div>
                      <button className="chart-btn" onClick={() => setChartFor(stock)}>
                        Chart
                      </button>
                      <button className="remove" onClick={() => removeStock(stock.symbol)}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Analyze Button */}
        {portfolio.length > 0 && (
          <button className="analyze-button" onClick={analyzePortfolio} disabled={loading}>
            {loading ? "Analyzing Portfolio..." : "Analyze Portfolio"}
          </button>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="loading-indicator">
            <div className="loading-spinner"></div>
            <p>Fetching news and analyzing sentiment...</p>
          </div>
        )}

        {/* Analysis Result */}
        {analysis && (
          <div className="analysis-card">
            <div className="analysis-header">
              <div>
                <h2>Portfolio Analysis</h2>
                <p>Recent market news and AI-driven insights</p>
              </div>
              <span>FinGPT</span>
            </div>

            <OverallTrust results={analysis} />

            {analysis.map((stock) => {
              const parsed = parseAnalysis(stock.analysis);
              const sentiment = getSentiment(stock.analysis);
              return (
                <div className="stock-analysis" key={stock.symbol}>
                  <div className="stock-analysis-header">
                    <div>
                      <h3>{stock.symbol}</h3>
                      <p>{stock.company}</p>
                    </div>
                    <div className="analysis-badges">
                      <span className="analysis-quantity">Quantity: {stock.quantity}</span>
                      <span
                        className="sentiment-badge"
                        style={{
                          background: `${sentiment.color}22`,
                          color: sentiment.color,
                          borderColor: sentiment.color,
                        }}
                      >
                        {sentiment.icon} {sentiment.label}
                      </span>
                    </div>
                  </div>

                  <TrustMeter stock={stock} />

                  <div className="news-section">
                    <h4>Recent News</h4>
                    {stock.news && stock.news.length > 0 ? (
                      stock.news.map((article, index) => (
                        <div className="news-item" key={index}>
                          <strong>{article.title}</strong>
                          <small>{article.source} | {article.posted}</small>
                        </div>
                      ))
                    ) : (
                      <p className="no-news">No recent news found.</p>
                    )}
                  </div>

                  <div className="analysis-sections">
                    {parsed && parsed.positive.length > 0 && (
                      <div className="analysis-section positive-section">
                        <h4 className="section-title positive-title">Positive Developments</h4>
                        <ul className="section-list">
                          {parsed.positive.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed && parsed.concerns.length > 0 && (
                      <div className="analysis-section concerns-section">
                        <h4 className="section-title concerns-title">Potential Concerns</h4>
                        <ul className="section-list">
                          {parsed.concerns.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {parsed && parsed.impact && (
                      <div className="analysis-section impact-section">
                        <h4 className="section-title impact-title">Overall Impact</h4>
                        <p className="impact-text">{parsed.impact}</p>
                      </div>
                    )}
                    {(!parsed ||
                      (!parsed.positive.length && !parsed.concerns.length && !parsed.impact)) && (
                      <div className="analysis-section">
                        <div className="analysis-content">
                          {(stock.analysis || "")
                            .replace(/\[INST\][\s\S]*?\[\/INST\]/g, "")
                            .trim()
                            .split("\n")
                            .map((line, idx) => (
                              <p key={idx}>{line}</p>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      </>
      )}

      {tab === "history" && (
        <HistoryTab
          user={user}
          onView={viewFromHistory}
          onLogin={() => setShowAuth("signin")}
        />
      )}

      {tab === "alerts" && (
        <AlertsTab
          user={user}
          portfolio={portfolio}
          onLogin={() => setShowAuth("signin")}
        />
      )}

      {/* Stock chart modal */}
      {chartFor && <ChartModal stock={chartFor} onClose={() => setChartFor(null)} />}

      {/* Sign in / Sign up modal */}
      {showAuth && (
        <AuthModal
          initialMode={showAuth}
          onClose={() => setShowAuth(null)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}

export default App;