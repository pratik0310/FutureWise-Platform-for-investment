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

const MAX_SYMBOLS = 40;
const CACHE_MS = 30 * 1000;
const cache = new Map(); // yahooSymbol -> { t, data }
const SYMBOL_RE = /^[A-Za-z0-9&.\-]+$/;

const round = (n) => (n == null || Number.isNaN(n) ? null : Math.round(n * 100) / 100);

const toYahoo = (symbol, exchange) => {
  const s = String(symbol || '').trim().toUpperCase();
  if (/\.(NS|BO)$/.test(s)) return s;
  if (String(exchange || 'NSE').toUpperCase() === 'US') return s;
  return `${s}.NS`;
};

const fetchOne = async (ySym) => {
  const hit = cache.get(ySym);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.data;

  const q = await yf.quote(ySym);
  if (!q || q.regularMarketPrice == null) return null;

  const data = {
    price: round(q.regularMarketPrice),
    change: round(q.regularMarketChange),
    changePct: round(q.regularMarketChangePercent),
    prevClose: round(q.regularMarketPreviousClose),
    currency: q.currency || null,
    marketState: q.marketState || null,
  };
  cache.set(ySym, { t: Date.now(), data });
  return data;
};

// POST /api/quotes   body: { stocks: [{ symbol, exchange }] }
// -> { quotes: { "TATASTEEL|NSE": { price, change, changePct, prevClose, currency, marketState } }, at }
router.post('/quotes', limiter, async (req, res) => {
  try {
    const list = Array.isArray(req.body?.stocks) ? req.body.stocks : [];
    if (!list.length) return res.json({ quotes: {}, at: new Date().toISOString() });
    if (list.length > MAX_SYMBOLS)
      return res.status(400).json({ error: `Up to ${MAX_SYMBOLS} stocks at a time.` });

    const items = [];
    for (const s of list) {
      const symbol = String(s?.symbol || '').trim().toUpperCase();
      if (!symbol || symbol.length > 20 || !SYMBOL_RE.test(symbol)) continue;
      const exchange = String(s?.exchange || 'NSE').toUpperCase() === 'US' ? 'US' : 'NSE';
      items.push({ key: `${symbol}|${exchange}`, ySym: toYahoo(symbol, exchange) });
    }

    const quotes = {};
    await Promise.allSettled(
      items.map(async ({ key, ySym }) => {
        const d = await fetchOne(ySym);
        if (d) quotes[key] = d;
      })
    );

    res.json({ quotes, at: new Date().toISOString() });
  } catch (e) {
    console.error('Quotes error:', e.message);
    res.status(500).json({ error: 'Could not load prices.' });
  }
});

export default router;