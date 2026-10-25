import express from 'express';
import rateLimit from 'express-rate-limit';
import YahooFinance from 'yahoo-finance2';

const router = express.Router();

// yahoo-finance2 v3+ exports a class; older versions export a ready instance.
const yf = typeof YahooFinance === 'function' ? new YahooFinance() : YahooFinance;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in a minute.' },
});

const DAY = 86400000;
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map(); // key -> { t, data }

const RANGES = {
  '1m': { days: 31, interval: '1d' },
  '3m': { days: 93, interval: '1d' },
  '6m': { days: 186, interval: '1d' },
  '1y': { days: 366, interval: '1d' },
  '5y': { days: 1830, interval: '1wk' },
};

const round = (n) => (n == null || Number.isNaN(n) ? null : Math.round(n * 100) / 100);
const iso = (d) => new Date(d).toISOString().slice(0, 10);

const toYahoo = (symbol, exchange) => {
  const s = String(symbol || '').trim().toUpperCase();
  if (/\.(NS|BO)$/.test(s)) return s;
  if (String(exchange || 'NSE').toUpperCase() === 'US') return s;
  return `${s}.NS`;
};

// GET /api/chart?symbol=TATASTEEL&exchange=NSE&range=1y
router.get('/chart', limiter, async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim();
    if (!symbol || symbol.length > 20 || !/^[A-Za-z0-9&.\-]+$/.test(symbol))
      return res.status(400).json({ error: 'Invalid symbol.' });

    const range = String(req.query.range || '1y').toLowerCase();
    const cfg = RANGES[range];
    if (!cfg) return res.status(400).json({ error: 'Invalid range.' });

    const ySym = toYahoo(symbol, req.query.exchange);
    const key = `${ySym}|${range}`;

    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_MS) return res.json(hit.data);

    const result = await yf.chart(ySym, {
      period1: new Date(Date.now() - cfg.days * DAY),
      interval: cfg.interval,
    });

    // clean + ascending + unique dates (required by the chart library)
    const seen = new Set();
    const candles = [];
    for (const q of result?.quotes || []) {
      if (!q || !q.date || q.open == null || q.high == null || q.low == null || q.close == null)
        continue;
      const time = iso(q.date);
      if (seen.has(time)) continue;
      seen.add(time);
      candles.push({
        time,
        open: round(q.open),
        high: round(q.high),
        low: round(q.low),
        close: round(q.close),
        volume: q.volume || 0,
      });
    }
    candles.sort((a, b) => (a.time < b.time ? -1 : 1));

    if (candles.length < 2)
      return res.status(404).json({ error: 'No chart data found for this stock.' });

    const first = candles[0];
    const last = candles[candles.length - 1];

    const data = {
      symbol: ySym.replace(/\.(NS|BO)$/, ''),
      name: result?.meta?.shortName || result?.meta?.longName || symbol,
      currency: result?.meta?.currency || null,
      range,
      candles,
      last: last.close,
      changePct: round((last.close / first.close - 1) * 100),
      high: Math.max(...candles.map((c) => c.high)),
      low: Math.min(...candles.map((c) => c.low)),
    };

    cache.set(key, { t: Date.now(), data });
    res.json(data);
  } catch (e) {
    console.error('Chart error:', e.message);
    res.status(500).json({ error: 'Could not load chart data.' });
  }
});

export default router;