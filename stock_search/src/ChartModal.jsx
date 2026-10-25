import { useState, useEffect, useRef } from "react";
import * as LW from "lightweight-charts"; // works with v4 and v5
import "./ChartModal.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

const RANGES = ["1M", "3M", "6M", "1Y", "5Y"];

const UP = "#10b981";
const DOWN = "#ef4444";

// v5 uses chart.addSeries(Type, opts); v4 uses chart.addXxxSeries(opts)
const addCandles = (chart, opts) =>
  LW.CandlestickSeries ? chart.addSeries(LW.CandlestickSeries, opts) : chart.addCandlestickSeries(opts);
const addLine = (chart, opts) =>
  LW.LineSeries ? chart.addSeries(LW.LineSeries, opts) : chart.addLineSeries(opts);
const addHist = (chart, opts) =>
  LW.HistogramSeries ? chart.addSeries(LW.HistogramSeries, opts) : chart.addHistogramSeries(opts);

const money = (v, cur) => {
  if (v == null) return "—";
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : "";
  return sym + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

export default function ChartModal({ stock, onClose }) {
  const [range, setRange] = useState("1Y");
  const [type, setType] = useState("candles"); // "candles" | "line"
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const boxRef = useRef(null);

  // load data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const qs = new URLSearchParams({
      symbol: stock.symbol,
      exchange: stock.exchange || "NSE",
      range: range.toLowerCase(),
    });

    fetch(`${API}/api/chart?${qs}`, { credentials: "include" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Could not load chart.");
        return d;
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setError(e.message);
        }
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [stock.symbol, stock.exchange, range]);

  // draw chart
  useEffect(() => {
    if (!data || !boxRef.current) return;

    const chart = LW.createChart(boxRef.current, {
      autoSize: true,
      layout: { background: { color: "#11131a" }, textColor: "#aab2c5" },
      grid: { vertLines: { color: "#1c1f2e" }, horzLines: { color: "#1c1f2e" } },
      rightPriceScale: { borderColor: "#2a2d3a" },
      timeScale: { borderColor: "#2a2d3a" },
    });

    if (type === "candles") {
      const s = addCandles(chart, {
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
      });
      s.setData(data.candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
    } else {
      const s = addLine(chart, { color: "#6c63ff", lineWidth: 2 });
      s.setData(data.candles.map((c) => ({ time: c.time, value: c.close })));
    }

    // volume bars along the bottom
    if (data.candles.some((c) => c.volume > 0)) {
      const vol = addHist(chart, { priceFormat: { type: "volume" }, priceScaleId: "" });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      vol.setData(
        data.candles.map((c) => ({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)",
        }))
      );
    }

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [data, type]);

  const up = data ? data.changePct >= 0 : true;

  return (
    <div className="chart-overlay" onMouseDown={onClose}>
      <div className="chart-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="chart-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <h2>
          {stock.name} <span className="chart-sym">{stock.symbol}</span>
        </h2>

        {data && (
          <div className="chart-stats">
            <div>
              <span>Last</span>
              <strong>{money(data.last, data.currency)}</strong>
            </div>
            <div>
              <span>{range} change</span>
              <strong style={{ color: up ? UP : DOWN }}>
                {up ? "▲" : "▼"} {Math.abs(data.changePct).toFixed(2)}%
              </strong>
            </div>
            <div>
              <span>{range} high</span>
              <strong>{money(data.high, data.currency)}</strong>
            </div>
            <div>
              <span>{range} low</span>
              <strong>{money(data.low, data.currency)}</strong>
            </div>
          </div>
        )}

        <div className="chart-controls">
          <div className="chart-seg">
            {RANGES.map((r) => (
              <button key={r} className={r === range ? "on" : ""} onClick={() => setRange(r)}>
                {r}
              </button>
            ))}
          </div>
          <div className="chart-seg">
            <button className={type === "candles" ? "on" : ""} onClick={() => setType("candles")}>
              Candles
            </button>
            <button className={type === "line" ? "on" : ""} onClick={() => setType("line")}>
              Line
            </button>
          </div>
        </div>

        <div className="chart-area">
          {error ? (
            <p className="chart-error">{error}</p>
          ) : (
            <>
              <div ref={boxRef} className="chart-box" />
              {loading && <div className="chart-loading">Loading chart...</div>}
            </>
          )}
        </div>

        <p className="chart-note">
          Market data from Yahoo Finance, may be delayed. Weekly candles on 5Y. Not financial advice.
        </p>
      </div>
    </div>
  );
}