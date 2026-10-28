import { useState, useEffect, useMemo, useRef } from "react";
import stocks from "./data/stocks.json";
import WhatsAppSettings from "./WhatsAppSettings";
import "./AlertsTab.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ---------- helpers ----------
const money = (v, cur) => {
  if (v == null) return "—";
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : "";
  return sym + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
};
const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const fmtPct = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const changeColor = (v) => (v > 0 ? "var(--lp-up)" : v < 0 ? "var(--lp-down)" : "var(--lp-muted)");

// how close is the price to the target?
const alertProgress = (alert, price) => {
  if (price == null) return null;
  const t = alert.targetPrice;
  const c = price;
  const reached = alert.direction === "above" ? c >= t : c <= t;
  let ratio;
  if (alert.direction === "above") ratio = c / t;
  else ratio = t / c;
  const distance = Math.abs(((t - c) / c) * 100);
  return {
    ratio: Math.max(0, Math.min(1, ratio)),
    reached,
    distance,
  };
};

// ---------- icons ----------
const I = {
  Search: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Bell: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  Plus: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Trash: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
  Refresh: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
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
  Clock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  ),
  Info: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  Spark: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5L12 3z" />
    </svg>
  ),
};

// ---------- animated number ----------
function AnimatedNumber({ value, duration = 650, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) { setDisplay(to); return; }
    const start = performance.now();
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
  }, [value, duration]);
  return <>{prefix}{Math.round(display)}{suffix}</>;
}

// ---------- confirm modal ----------
const ConfirmModal = ({ open, title, body, confirmLabel, busy, onCancel, onConfirm }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="al-modal-bg" onClick={onCancel}>
      <div className="al-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="al-modal-icon">
          <I.Bell width="22" height="22" />
        </div>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="al-modal-actions">
          <button type="button" className="al-btn al-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="al-btn al-btn-danger-solid" onClick={onConfirm} disabled={busy}>
            {busy ? "Removing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
export default function AlertsTab({ user, portfolio, onLogin, onToast }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");

  // form
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [stock, setStock] = useState(null);
  const [live, setLive] = useState(null);
  const [liveError, setLiveError] = useState("");
  const [direction, setDirection] = useState("above");
  const [target, setTarget] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // UI state
  const [filter, setFilter] = useState("all"); // all | active | triggered
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [alertPrices, setAlertPrices] = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);

  const notify = (msg, type = "info") => {
    if (onToast) onToast(msg, type);
    else alert(msg);
  };

  // ---------- search ----------
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return stocks
      .filter(
        (s) =>
          String(s.name || "").toLowerCase().includes(q) ||
          String(s.symbol || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [search]);

  useEffect(() => { setHighlighted(0); }, [search]);

  // ---------- load alerts ----------
  const load = () => {
    setLoading(true);
    setListError("");
    fetch(`${API}/api/alerts`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load alerts.");
        return r.json();
      })
      .then((d) => setAlerts(d.alerts || []))
      .catch((e) => setListError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---------- live price for the picked stock ----------
  useEffect(() => {
    setLive(null);
    setLiveError("");
    if (!stock) return;
    let cancelled = false;
    const qs = new URLSearchParams({
      symbol: stock.symbol,
      exchange: stock.exchange || "NSE",
    });
    fetch(`${API}/api/alerts/price?${qs}`, { credentials: "include" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not load price.");
        return d;
      })
      .then((d) => !cancelled && setLive(d))
      .catch((e) => !cancelled && setLiveError(e.message));
    return () => { cancelled = true; };
  }, [stock]);

  // ---------- batch live prices for active alerts ----------
  const activeList = useMemo(
    () => alerts.filter((a) => a.status === "active"),
    [alerts]
  );
  const activeKey = useMemo(
    () => activeList.map((a) => `${a.symbol}|${a.exchange || "NSE"}`).join(","),
    [activeList]
  );

  useEffect(() => {
    if (!user || !activeList.length) { setAlertPrices({}); return; }
    let cancelled = false;
    const loadPrices = async () => {
      setPricesLoading(true);
      try {
        const r = await fetch(`${API}/api/quotes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stocks: activeList.map((a) => ({ symbol: a.symbol, exchange: a.exchange || "NSE" })),
          }),
        });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!cancelled) setAlertPrices(d.quotes || {});
      } catch {
        /* silent — list still renders without prices */
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    };
    loadPrices();
    const id = setInterval(loadPrices, 60000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeKey, refreshTick]);

  // ---------- form actions ----------
  const pick = (s) => {
    setStock(s);
    setSearch(s.name);
    setShowResults(false);
    setFormError("");
  };

  const quickPick = (s) => pick(s);

  const clearStock = () => {
    setStock(null);
    setSearch("");
    setLive(null);
    setLiveError("");
  };

  const applyQuickTarget = (pct) => {
    if (!live || !live.price) return;
    const sign = direction === "above" ? 1 : -1;
    const next = live.price * (1 + (sign * pct) / 100);
    setTarget(next.toFixed(2));
  };

  const create = async (e) => {
    e.preventDefault();
    if (saving) return;
    setFormError("");

    if (!stock) return setFormError("Pick a stock first.");
    const price = Number(target);
    if (!Number.isFinite(price) || price <= 0) return setFormError("Enter a valid target price.");

    setSaving(true);
    try {
      const r = await fetch(`${API}/api/alerts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: stock.symbol,
          name: stock.name,
          exchange: stock.exchange || "NSE",
          direction,
          targetPrice: price,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not create alert.");
      setAlerts((prev) => [d.alert, ...prev]);
      setTarget("");
      clearStock();
      notify(`Alert created for ${d.alert.symbol}.`, "success");
    } catch (err) {
      setFormError(err.message);
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!confirmTarget) return;
    setConfirmBusy(true);
    setBusyId(confirmTarget);
    try {
      const r = await fetch(`${API}/api/alerts/${confirmTarget}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Could not delete.");
      setAlerts((prev) => prev.filter((a) => a._id !== confirmTarget));
      notify("Alert removed.", "info");
      setConfirmTarget(null);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setConfirmBusy(false);
      setBusyId(null);
    }
  };

  const recreate = (alert) => {
    const found = stocks.find(
      (s) =>
        s.symbol === alert.symbol &&
        (s.exchange || "NSE") === (alert.exchange || "NSE")
    );
    if (found) {
      pick(found);
      setDirection(alert.direction);
      setTarget("");
      notify("Stock loaded in the form — set a new target.", "info");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // ---------- derived ----------
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === "active"), [alerts]);
  const triggeredAlerts = useMemo(() => alerts.filter((a) => a.status === "triggered"), [alerts]);

  const filtered = useMemo(() => {
    if (filter === "active") return activeAlerts;
    if (filter === "triggered") return triggeredAlerts;
    return alerts;
  }, [alerts, activeAlerts, triggeredAlerts, filter]);

  const closest = useMemo(() => {
    if (!activeAlerts.length) return null;
    let best = null;
    activeAlerts.forEach((a) => {
      const p = alertPrices[`${a.symbol}|${a.exchange || "NSE"}`];
      if (!p) return;
      const prog = alertProgress(a, p.price);
      if (!prog) return;
      if (!best || prog.distance < best.distance) {
        best = { symbol: a.symbol, distance: prog.distance, currency: p.currency || a.currency };
      }
    });
    return best;
  }, [activeAlerts, alertPrices]);

  const quick = (portfolio || []).slice(0, 6);

  // form preview
  const preview = useMemo(() => {
    if (!stock || !target || !live) return null;
    const t = Number(target);
    if (!Number.isFinite(t) || t <= 0) return null;
    const reached = direction === "above" ? live.price >= t : live.price <= t;
    const distance = Math.abs(((t - live.price) / live.price) * 100);
    return { target: t, reached, distance, currency: live.currency };
  }, [stock, target, live, direction]);

  // ---------- guest ----------
  if (!user) {
    return (
      <div className="al-wrap">
        <header className="al-header">
          <div>
            <h1>Price Alerts</h1>
            <p>Get notified when a stock hits your target</p>
          </div>
        </header>
        <div className="al-empty-card">
          <div className="al-empty-icon"><I.Bell width="28" height="28" /></div>
          <h3>Sign in to set price alerts</h3>
          <p>We notify you the moment a stock crosses your target price, by email and WhatsApp. One alert per stock, fires once.</p>
          <button type="button" className="al-btn al-btn-solid" onClick={onLogin}>
            <I.Spark width="16" height="16" /> Sign in
          </button>
        </div>
      </div>
    );
  }

  // ---------- loading skeleton ----------
  if (loading) {
    return (
      <div className="al-wrap">
        <header className="al-header">
          <div>
            <h1>Price Alerts</h1>
            <p>Get notified when a stock hits your target</p>
          </div>
        </header>
        <div className="al-stats">
          {[0, 1, 2, 3].map((i) => <div key={i} className="al-stat al-skeleton" />)}
        </div>
        <div className="al-card al-skeleton-card">
          <div className="al-sk-line w-40" />
          <div className="al-sk-line w-90" />
          <div className="al-sk-line w-70" />
        </div>
        <div className="al-list">
          {[0, 1].map((i) => <div key={i} className="al-item al-skeleton al-skeleton-row" />)}
        </div>
      </div>
    );
  }

  // ---------- error ----------
  if (listError) {
    return (
      <div className="al-wrap">
        <header className="al-header">
          <div>
            <h1>Price Alerts</h1>
            <p>Get notified when a stock hits your target</p>
          </div>
        </header>
        <div className="al-empty-card al-empty-error">
          <div className="al-empty-icon al-empty-icon-error"><I.Info width="28" height="28" /></div>
          <h3>Couldn't load alerts</h3>
          <p>{listError}</p>
          <button type="button" className="al-btn al-btn-ghost" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  // ---------- main ----------
  return (
    <div className="al-wrap">
      <header className="al-header">
        <div>
          <h1>Price Alerts</h1>
          <p>Get notified when a stock hits your target. Each alert fires once.</p>
        </div>
        <div className="al-header-actions">
          <span className="al-pill">{activeAlerts.length} active</span>
          <button
            type="button"
            className={`al-btn al-btn-ghost al-btn-sm ${pricesLoading ? "is-loading" : ""}`}
            onClick={() => setRefreshTick((n) => n + 1)}
            disabled={pricesLoading || activeAlerts.length === 0}
            title="Refresh prices"
          >
            <I.Refresh width="14" height="14" />
            {pricesLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* stats */}
      <div className="al-stats">
        <div className="al-stat">
          <span className="al-stat-label">Active</span>
          <strong className="al-stat-value al-tone-accent">
            <AnimatedNumber value={activeAlerts.length} />
          </strong>
          <small className="al-stat-sub al-muted">waiting to fire</small>
        </div>
        <div className="al-stat">
          <span className="al-stat-label">Triggered</span>
          <strong className="al-stat-value al-tone-up">
            <AnimatedNumber value={triggeredAlerts.length} />
          </strong>
          <small className="al-stat-sub al-muted">past hits</small>
        </div>
        <div className="al-stat">
          <span className="al-stat-label">Total alerts</span>
          <strong className="al-stat-value">
            <AnimatedNumber value={alerts.length} />
          </strong>
          <small className="al-stat-sub al-muted">ever created</small>
        </div>
        <div className="al-stat">
          <span className="al-stat-label">Closest to target</span>
          <strong className="al-stat-value al-tone-warn">
            {closest ? (
              <>{closest.symbol} <span className="al-stat-small">{closest.distance.toFixed(1)}%</span></>
            ) : (
              <span className="al-muted">—</span>
            )}
          </strong>
          <small className="al-stat-sub al-muted">
            {closest ? "from triggering" : activeAlerts.length ? "loading prices…" : "no active alerts"}
          </small>
        </div>
      </div>

      {/* WhatsApp settings */}
      <WhatsAppSettings onToast={onToast} />

      {/* form */}
      <form className="al-card" onSubmit={create} noValidate>
        <div className="al-card-head">
          <h4>New alert</h4>
          <span className="al-card-hint">One per stock · fires once</span>
        </div>

        {/* quick picks */}
        {quick.length > 0 && !stock && (
          <div className="al-quick">
            <span className="al-quick-label">From your portfolio</span>
            <div className="al-quick-items">
              {quick.map((s) => (
                <button
                  type="button"
                  key={`${s.exchange}-${s.symbol}`}
                  className="al-quick-btn"
                  onClick={() => quickPick(s)}
                >
                  <span className="al-quick-sym">{s.symbol}</span>
                  <span className="al-quick-ex">{s.exchange || "NSE"}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* selected stock chip */}
        {stock && (
          <div className="al-selected">
            <div className="al-selected-info">
              <strong>{stock.symbol}</strong>
              <span>{stock.name}</span>
              <span className="al-ex-badge">{stock.exchange || "NSE"}</span>
            </div>
            <button type="button" className="al-selected-clear" onClick={clearStock} aria-label="Clear stock">
              <I.X width="14" height="14" />
            </button>
          </div>
        )}

        {/* search */}
        {!stock && (
          <div className="al-search">
            <I.Search width="16" height="16" />
            <input
              type="text"
              placeholder="Search a stock…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((i) => Math.min(i + 1, results.length - 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((i) => Math.max(i - 1, 0)); }
                else if (e.key === "Enter" && results[highlighted]) { e.preventDefault(); pick(results[highlighted]); }
                else if (e.key === "Escape") setShowResults(false);
              }}
            />
            {showResults && search && results.length > 0 && !stock && (
              <div className="al-results" onMouseDown={(e) => e.preventDefault()}>
                {results.map((s, i) => (
                  <button
                    type="button"
                    key={`${s.exchange}-${s.symbol}`}
                    className={`al-result ${i === highlighted ? "is-hl" : ""}`}
                    onMouseEnter={() => setHighlighted(i)}
                    onClick={() => pick(s)}
                  >
                    <div className="al-result-main">
                      <span className="al-result-name">{s.name}</span>
                      <span className="al-result-sub">{s.symbol}</span>
                    </div>
                    <span className="al-ex-badge">{s.exchange || "NSE"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* live price */}
        {stock && (
          <div className="al-live">
            {live ? (
              <>
                <span className="al-live-label">Current price</span>
                <strong className="al-live-value">{money(live.price, live.currency)}</strong>
                {live.changePct != null && (
                  <span className="al-live-delta" style={{ color: changeColor(live.changePct) }}>
                    {live.changePct >= 0 ? "▲" : "▼"} {fmtPct(live.changePct)}
                  </span>
                )}
              </>
            ) : liveError ? (
              <span className="al-error-inline">{liveError}</span>
            ) : (
              <span className="al-muted">Loading price…</span>
            )}
          </div>
        )}

        {/* direction + target + submit */}
        <div className="al-form-row">
          <div className="al-segmented" role="tablist" aria-label="Direction">
            <button
              type="button"
              className={`al-segment ${direction === "above" ? "is-active al-segment-up" : ""}`}
              onClick={() => setDirection("above")}
              aria-selected={direction === "above"}
            >
              <I.TrendUp width="14" height="14" /> Goes above
            </button>
            <button
              type="button"
              className={`al-segment ${direction === "below" ? "is-active al-segment-down" : ""}`}
              onClick={() => setDirection("below")}
              aria-selected={direction === "below"}
            >
              <I.TrendDown width="14" height="14" /> Falls below
            </button>
          </div>

          <div className="al-target-wrap">
            <span className="al-target-prefix">{money(0, live?.currency || "INR").replace(/[\d.,]/g, "")}</span>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="Target price"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="al-target-input"
            />
          </div>

          <button type="submit" className="al-btn al-btn-solid al-btn-create" disabled={saving || !stock}>
            <I.Plus width="16" height="16" /> {saving ? "Saving…" : "Create alert"}
          </button>
        </div>

        {/* quick target % */}
        {stock && live?.price && (
          <div className="al-quick-targets">
            <span className="al-quick-targets-label">Quick set</span>
            {[1, 2, 5, 10].map((p) => (
              <button
                type="button"
                key={p}
                className="al-quick-target"
                onClick={() => applyQuickTarget(p)}
              >
                {direction === "above" ? "+" : "−"}{p}%
              </button>
            ))}
          </div>
        )}

        {/* preview */}
        {preview && (
          <div className={`al-preview ${preview.reached ? "is-reached" : ""}`}>
            <div className="al-preview-icon">
              {preview.reached ? <I.Check width="16" height="16" /> : <I.Bell width="16" height="16" />}
            </div>
            <div className="al-preview-text">
              <strong>
                Alert fires when {stock.symbol} goes {direction === "above" ? "above" : "below"}{" "}
                {money(preview.target, preview.currency)}
              </strong>
              <span>
                {preview.reached
                  ? "Price has already reached your target — pick a new level."
                  : `You're ${preview.distance.toFixed(2)}% away from the trigger.`}
              </span>
            </div>
          </div>
        )}

        {formError && <div className="al-error">{formError}</div>}

        <p className="al-note">
          <I.Info width="14" height="14" /> Alerts go to your account email, plus WhatsApp if
          enabled above. Prices are checked regularly from Yahoo Finance and may be delayed.
          After market close the price is the last close.
        </p>
      </form>

      {/* filter chips */}
      {alerts.length > 0 && (
        <div className="al-filters">
          {[
            { id: "all", label: "All", count: alerts.length },
            { id: "active", label: "Active", count: activeAlerts.length },
            { id: "triggered", label: "Triggered", count: triggeredAlerts.length },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              className={`al-chip ${filter === f.id ? "is-active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="al-chip-count">{f.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* empty (no alerts at all) */}
      {alerts.length === 0 && (
        <div className="al-empty-card">
          <div className="al-empty-icon"><I.Bell width="26" height="26" /></div>
          <h3>No alerts yet</h3>
          <p>Create your first price alert above — we'll notify you the moment it's hit.</p>
        </div>
      )}

      {/* filter-empty */}
      {alerts.length > 0 && filtered.length === 0 && (
        <div className="al-empty-card al-empty-filter">
          <div className="al-empty-icon"><I.Search width="24" height="24" /></div>
          <h3>Nothing to show</h3>
          <p>No {filter} alerts right now.</p>
          <button type="button" className="al-btn al-btn-ghost" onClick={() => setFilter("all")}>
            Show all
          </button>
        </div>
      )}

      {/* alert list */}
      {filtered.length > 0 && (
        <div className="al-list">
          {filtered.map((a) => {
            const key = `${a.symbol}|${a.exchange || "NSE"}`;
            const p = alertPrices[key];
            const prog = a.status === "active" && p ? alertProgress(a, p.price) : null;
            const isTriggered = a.status === "triggered";
            const busy = busyId === a._id;

            const ratioPct = prog ? Math.round(prog.ratio * 100) : 0;
            const tone = isTriggered ? "up" : prog?.reached ? "warn" : "accent";

            return (
              <div className={`al-item ${isTriggered ? "is-triggered" : ""} ${busy ? "is-busy" : ""}`} key={a._id}>
                <div className="al-item-head">
                  <div className="al-item-title">
                    <strong>{a.symbol}</strong>
                    <span className="al-ex-badge">{a.exchange || "NSE"}</span>
                    {isTriggered && (
                      <span className="al-status-badge al-status-triggered">
                        <I.Check width="11" height="11" /> Triggered
                      </span>
                    )}
                  </div>
                  <span className="al-item-name">{a.name}</span>
                </div>

                <div className="al-item-body">
                  <div className="al-item-price-info">
                    <div className="al-price-row">
                      <span className="al-price-label">Target</span>
                      <strong>{money(a.targetPrice, a.currency)}</strong>
                    </div>
                    <div className="al-price-row">
                      <span className="al-price-label">Direction</span>
                      <span className={`al-dir al-dir-${a.direction}`}>
                        {a.direction === "above" ? "▲ Goes above" : "▼ Falls below"}
                      </span>
                    </div>
                    {!isTriggered && (
                      <div className="al-price-row">
                        <span className="al-price-label">Current</span>
                        <strong className={p ? "" : "al-muted"}>
                          {p ? money(p.price, p.currency) : "—"}
                        </strong>
                      </div>
                    )}
                    {isTriggered && a.triggeredPrice != null && (
                      <div className="al-price-row">
                        <span className="al-price-label">Hit at</span>
                        <strong className="al-tone-up">{money(a.triggeredPrice, a.currency)}</strong>
                      </div>
                    )}
                  </div>

                  {!isTriggered && prog && (
                    <div className="al-progress-block">
                      <div className="al-progress-head">
                        <span className="al-muted">
                          {prog.reached ? "Ready to trigger" : `${prog.distance.toFixed(2)}% away`}
                        </span>
                        <span className={`al-tone-${tone}`}>{ratioPct}%</span>
                      </div>
                      <div className="al-progress-track">
                        <div
                          className={`al-progress-fill al-progress-${tone}`}
                          style={{ width: `${ratioPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="al-item-foot">
                  <small className="al-muted">
                    <I.Clock width="11" height="11" />
                    {isTriggered
                      ? `Hit ${fmtDate(a.triggeredAt || a.createdAt)}`
                      : `Created ${fmtDate(a.createdAt)}`}
                  </small>
                  <div className="al-item-actions">
                    {isTriggered && (
                      <button
                        type="button"
                        className="al-btn al-btn-ghost al-btn-sm"
                        onClick={() => recreate(a)}
                      >
                        <I.Plus width="12" height="12" /> Recreate
                      </button>
                    )}
                    <button
                      type="button"
                      className="al-btn al-btn-ghost al-btn-danger al-btn-sm al-btn-icon"
                      disabled={busy}
                      onClick={() => setConfirmTarget(a._id)}
                      aria-label="Delete alert"
                      title="Delete"
                    >
                      <I.Trash width="14" height="14" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmTarget}
        title="Delete this alert?"
        body="You won't be notified about this target anymore. This can't be undone."
        confirmLabel="Delete"
        busy={confirmBusy}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={doDelete}
      />
    </div>
  );
}