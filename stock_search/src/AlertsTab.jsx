import { useState, useEffect, useMemo } from "react";
import stocks from "./data/stocks.json";
import "./AlertsTab.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

const money = (v, cur) => {
  if (v == null) return "—";
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : "";
  return sym + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default function AlertsTab({ user, portfolio, onLogin }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");

  // form
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [stock, setStock] = useState(null);
  const [live, setLive] = useState(null); // { price, currency }
  const [liveError, setLiveError] = useState("");
  const [direction, setDirection] = useState("above");
  const [target, setTarget] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

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
  }, [user]);

  // current price for the picked stock
  useEffect(() => {
    setLive(null);
    setLiveError("");
    if (!stock) return;
    let cancelled = false;
    const qs = new URLSearchParams({ symbol: stock.symbol, exchange: stock.exchange || "NSE" });
    fetch(`${API}/api/alerts/price?${qs}`, { credentials: "include" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not load price.");
        return d;
      })
      .then((d) => !cancelled && setLive(d))
      .catch((e) => !cancelled && setLiveError(e.message));
    return () => {
      cancelled = true;
    };
  }, [stock]);

  const pick = (s) => {
    setStock(s);
    setSearch(s.name);
    setShowResults(false);
    setFormError("");
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
      setSearch("");
      setStock(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setBusyId(id);
    try {
      const r = await fetch(`${API}/api/alerts/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error("Could not delete.");
      setAlerts((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!user)
    return (
      <div className="al-wrap">
        <div className="al-empty">
          <h3>Sign in to set price alerts</h3>
          <p>We email you when a stock crosses your target price.</p>
          <button className="al-btn primary" onClick={onLogin}>
            Sign in
          </button>
        </div>
      </div>
    );

  const active = alerts.filter((a) => a.status === "active");
  const done = alerts.filter((a) => a.status === "triggered");
  const quick = (portfolio || []).slice(0, 8);

  return (
    <div className="al-wrap">
      <div className="al-header">
        <div>
          <h1>Price Alerts</h1>
          <p>Get an email when a stock hits your target. Each alert fires once.</p>
        </div>
        <span>{active.length} active</span>
      </div>

      <form className="al-card" onSubmit={create} noValidate>
        <h4>New alert</h4>

        {quick.length > 0 && !stock && (
          <div className="al-quick">
            <span>From your portfolio:</span>
            {quick.map((s) => (
              <button type="button" key={s.symbol} onClick={() => pick(s)}>
                {s.symbol}
              </button>
            ))}
          </div>
        )}

        <div className="al-search">
          <input
            type="text"
            placeholder="Search a stock..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setStock(null);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
          />
          {showResults && search && results.length > 0 && !stock && (
            <div className="al-results">
              {results.map((s) => (
                <div key={`${s.exchange}-${s.symbol}`} onMouseDown={() => pick(s)}>
                  <span>{s.name}</span>
                  <small>
                    {s.symbol} · {s.exchange || "NSE"}
                  </small>
                </div>
              ))}
            </div>
          )}
        </div>

        {stock && (
          <div className="al-live">
            {live ? (
              <>
                {stock.symbol} now: <strong>{money(live.price, live.currency)}</strong>
              </>
            ) : liveError ? (
              <span className="al-err">{liveError}</span>
            ) : (
              "Loading price..."
            )}
          </div>
        )}

        <div className="al-row">
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            <option value="above">Goes above</option>
            <option value="below">Falls below</option>
          </select>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Target price"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <button type="submit" className="al-btn primary" disabled={saving}>
            {saving ? "Saving..." : "Create alert"}
          </button>
        </div>

        {formError && <div className="al-error">{formError}</div>}
        <p className="al-note">
          Mail goes to your account email. Prices are checked about every 5 minutes from Yahoo
          Finance and may be delayed. After market close the price is the last close.
        </p>
      </form>

      {loading && <p className="al-muted">Loading alerts...</p>}
      {listError && <p className="al-err">{listError}</p>}

      {!loading && !listError && alerts.length === 0 && (
        <div className="al-empty">
          <h3>No alerts yet</h3>
          <p>Create one above.</p>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h3 className="al-sub">Active</h3>
          <div className="al-list">
            {active.map((a) => (
              <div className="al-item" key={a._id}>
                <div className="al-item-main">
                  <strong>{a.symbol}</strong>
                  <span className="al-muted">{a.name}</span>
                  <div>
                    <span className={`al-dir ${a.direction}`}>
                      {a.direction === "above" ? "▲ above" : "▼ below"}
                    </span>{" "}
                    <strong>{money(a.targetPrice, a.currency)}</strong>
                  </div>
                  <small className="al-muted">Created {fmtDate(a.createdAt)}</small>
                </div>
                <button
                  className="al-btn danger"
                  disabled={busyId === a._id}
                  onClick={() => remove(a._id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <h3 className="al-sub">Triggered</h3>
          <div className="al-list">
            {done.map((a) => (
              <div className="al-item done" key={a._id}>
                <div className="al-item-main">
                  <strong>{a.symbol}</strong>
                  <span className="al-muted">{a.name}</span>
                  <div>
                    {a.direction === "above" ? "Went above" : "Fell below"}{" "}
                    <strong>{money(a.targetPrice, a.currency)}</strong>
                    {a.triggeredPrice != null && (
                      <> · hit at <strong>{money(a.triggeredPrice, a.currency)}</strong></>
                    )}
                  </div>
                  {a.triggeredAt && <small className="al-muted">{fmtDate(a.triggeredAt)}</small>}
                </div>
                <button
                  className="al-btn danger"
                  disabled={busyId === a._id}
                  onClick={() => remove(a._id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}