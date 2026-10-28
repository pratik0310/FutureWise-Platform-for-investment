import express from 'express';
import rateLimit from 'express-rate-limit';
import { normalizePhone, sendWhatsApp, isWhatsAppReady } from '../config/whatsapp.js';

const router = express.Router();

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

// Test button must not become a spam cannon.
const testLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many test messages. Try again in a minute.' },
});

// current settings
router.get('/whatsapp', ensureAuthenticated, (req, res) => {
  res.json({
    phone: req.user.phone || '',
    optIn: !!req.user.whatsappOptIn,
    serverReady: isWhatsAppReady(),
  });
});

// save phone + opt-in
router.put('/whatsapp', ensureAuthenticated, async (req, res) => {
  try {
    const raw = String(req.body.phone || '').trim();
    const optIn = !!req.body.optIn;
    const num = raw ? normalizePhone(raw) : '';

    if (raw && !num)
      return res.status(400).json({ error: 'Enter a valid number with country code, e.g. 919876543210.' });
    if (optIn && !num)
      return res.status(400).json({ error: 'Add your phone number to turn notifications on.' });

    req.user.phone = num || '';
    req.user.whatsappOptIn = optIn;
    await req.user.save();

    res.json({ success: true, phone: req.user.phone, optIn: req.user.whatsappOptIn });
  } catch (e) {
    console.error('WhatsApp save error:', e.message);
    res.status(500).json({ error: 'Could not save.' });
  }
});

// send a test message to saved number
router.post('/whatsapp/test', testLimiter, ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user.phone) return res.status(400).json({ error: 'Save your phone number first.' });
    if (!isWhatsAppReady())
      return res.status(503).json({ error: 'WhatsApp is offline on the server. Try again later.' });

    await sendWhatsApp(req.user.phone, '✅ WhatsApp notifications are connected.');
    res.json({ success: true });
  } catch (e) {
    console.error('WhatsApp test error:', e.message);
    res.status(500).json({ error: e.message || 'Could not send.' });
  }
});

export default router;