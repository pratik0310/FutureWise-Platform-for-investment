import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import YahooFinance from 'yahoo-finance2';
import Alert from '../models/Alert.js';
import { sendPriceAlert } from '../config/mailer.js';

const router = express.Router();

// yahoo-finance2 v3+ exports a class; older versions export a ready instance.
const yf = typeof YahooFinance === 'function' ? new YahooFinance() : YahooFinance;

const MAX_ACTIVE = 20;
const SYMBOL_RE = /^[A-Za-z0-9&.\-]+$/;

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in a minute.' },
});

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

const toYahoo = (symbol, exchange) => {
  const s = String(symbol || '').trim().toUpperCase();
  if (/\.(NS|BO)$/.test(s)) return s;
  if (String(exchange || 'NSE').toUpperCase() === 'US') return s;
  return `${s}.NS`;
};

const getPrice = async (ySym) => {
  const q = await yf.quote(ySym);
  if (!q || q.regularMarketPrice == null) return null;
  return { price: q.regularMarketPrice, currency: q.currency || null, name: q.shortName || q.longName || null };
};

// ---------------------------------------------------------------
// The checker: runs on a timer AND via /api/alerts/check (for external cron)
// ---------------------------------------------------------------
let running = false;

export const checkAlerts = async () => {
  if (running) return { skipped: true };
  running = true;
  try {
    const active = await Alert.find({ status: 'active' })
      .populate('userId', 'email displayName')
      .lean();
    if (!active.length) return { checked: 0, triggered: 0 };

    // one Yahoo call per unique symbol, not per alert
    const symbols = [...new Set(active.map((a) => toYahoo(a.symbol, a.exchange)))];
    const prices = new Map();
    await Promise.allSettled(
      symbols.map(async (s) => {
        const p = await getPrice(s);
        if (p) prices.set(s, p);
      })
    );

    let triggered = 0;
    for (const a of active) {
      const p = prices.get(toYahoo(a.symbol, a.exchange));
      if (!p) continue;

      const hit = a.direction === 'above' ? p.price >= a.targetPrice : p.price <= a.targetPrice;
      if (!hit) continue;

      const user = a.userId;
      if (!user?.email) continue; // user was deleted

      // Claim first (atomic) so two overlapping runs can never send twice.
      const claimed = await Alert.findOneAndUpdate(
        { _id: a._id, status: 'active' },
        { status: 'triggered', triggeredAt: new Date(), triggeredPrice: p.price, currency: p.currency },
        { new: true }
      );
      if (!claimed) continue;

      try {
        await sendPriceAlert(user, claimed, p.price, p.currency);
        triggered++;
      } catch (e) {
        console.error(`Alert email failed for ${a.symbol}:`, e.message);
        // put it back so the next run retries
        await Alert.updateOne(
          { _id: a._id },
          { status: 'active', $unset: { triggeredAt: 1, triggeredPrice: 1 } }
        );
      }
    }

    return { checked: active.length, triggered };
  } finally {
    running = false;
  }
};

// Local / always-on hosting: check every N minutes (ALERT_CHECK_MINUTES, default 5, 0 = off)
export const startAlertScheduler = () => {
  const mins = Number(process.env.ALERT_CHECK_MINUTES ?? 5);
  if (!mins || mins < 0) return;
  setInterval(() => {
    checkAlerts().catch((e) => console.error('Alert check failed:', e.message));
  }, mins * 60 * 1000);
  console.log(`Price alert checker running every ${mins} min`);
};

// ---------------------------------------------------------------
// GET/POST /api/alerts/check  - for cron-job.org etc. (needs CRON_SECRET)
// header: x-cron-secret: <secret>   or   ?key=<secret>
// ---------------------------------------------------------------
router.all('/alerts/check', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ error: 'CRON_SECRET not set on server.' });

  const given = String(req.get('x-cron-secret') || req.query.key || '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return res.status(401).json({ error: 'Bad key.' });

  try {
    res.json({ success: true, ...(await checkAlerts()) });
  } catch (e) {
    console.error('Alert check error:', e.message);
    res.status(500).json({ error: 'Check failed.' });
  }
});

// ---------------------------------------------------------------
// Current price helper for the form
// ---------------------------------------------------------------
router.get('/alerts/price', limiter, ensureAuthenticated, async (req, res) => {
  try {
    const symbol = String(req.query.symbol || '').trim();
    if (!symbol || symbol.length > 20 || !SYMBOL_RE.test(symbol))
      return res.status(400).json({ error: 'Invalid symbol.' });

    const p = await getPrice(toYahoo(symbol, req.query.exchange));
    if (!p) return res.status(404).json({ error: 'No price found for this stock.' });
    res.json(p);
  } catch (e) {
    console.error('Alert price error:', e.message);
    res.status(502).json({ error: 'Could not load price right now.' });
  }
});

// ---------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------
router.get('/alerts', ensureAuthenticated, async (req, res) => {
  try {
    const alerts = await Alert.find({ userId: req.user._id })
      .sort({ status: 1, createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ alerts });
  } catch (e) {
    console.error('Alerts list error:', e.message);
    res.status(500).json({ error: 'Could not load alerts.' });
  }
});

router.post('/alerts', limiter, ensureAuthenticated, async (req, res) => {
  try {
    const symbol = String(req.body.symbol || '').trim().toUpperCase();
    const exchange = String(req.body.exchange || 'NSE').toUpperCase() === 'US' ? 'US' : 'NSE';
    const direction = req.body.direction;
    const targetPrice = Number(req.body.targetPrice);
    const name = String(req.body.name || '').slice(0, 120);

    if (!symbol || symbol.length > 20 || !SYMBOL_RE.test(symbol))
      return res.status(400).json({ error: 'Pick a valid stock.' });
    if (!['above', 'below'].includes(direction))
      return res.status(400).json({ error: 'Choose above or below.' });
    if (!Number.isFinite(targetPrice) || targetPrice <= 0 || targetPrice > 1e9)
      return res.status(400).json({ error: 'Enter a valid target price.' });

    const activeCount = await Alert.countDocuments({ userId: req.user._id, status: 'active' });
    if (activeCount >= MAX_ACTIVE)
      return res.status(400).json({ error: `You can have up to ${MAX_ACTIVE} active alerts.` });

    const dup = await Alert.findOne({
      userId: req.user._id,
      symbol,
      direction,
      targetPrice,
      status: 'active',
    }).lean();
    if (dup) return res.status(409).json({ error: 'You already have this exact alert.' });

    // Refuse alerts that would fire instantly (price already past the target).
    // If Yahoo is down we still allow creating it.
    let currency = null;
    try {
      const p = await getPrice(toYahoo(symbol, exchange));
      if (p) {
        currency = p.currency;
        const already = direction === 'above' ? p.price >= targetPrice : p.price <= targetPrice;
        if (already)
          return res.status(400).json({
            error: `${symbol} is already ${direction} that price (now ${p.price}). Pick a ${
              direction === 'above' ? 'higher' : 'lower'
            } target.`,
          });
      }
    } catch (e) {
      console.error('Alert create price check failed:', e.message);
    }

    const alert = await Alert.create({
      userId: req.user._id,
      symbol,
      name,
      exchange,
      direction,
      targetPrice,
      currency,
    });
    res.status(201).json({ alert });
  } catch (e) {
    console.error('Alert create error:', e.message);
    res.status(500).json({ error: 'Could not create alert.' });
  }
});

router.delete('/alerts/:id', ensureAuthenticated, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Bad id.' });
    await Alert.deleteOne({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (e) {
    console.error('Alert delete error:', e.message);
    res.status(500).json({ error: 'Could not delete alert.' });
  }
});

export default router;