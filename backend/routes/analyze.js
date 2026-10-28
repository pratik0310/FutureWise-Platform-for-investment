import express from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import Analysis from '../models/Analysis.js';
import { sendAnalysisReport } from '../config/mailer.js';
import { sendWhatsApp, buildAnalysisMessage } from '../config/whatsapp.js';
import { sentimentScore } from '../config/sentiment.js';

const router = express.Router();

const MAX_HISTORY = 100; // keep newest N analyses per user

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

// Same shared rule as the frontend badge and the email, so History matches what the user saw.
const sentimentOf = sentimentScore;

const summarize = (results) => {
  let bullish = 0;
  let neutral = 0;
  let bearish = 0;
  let weighted = 0;
  let totalQuantity = 0;

  for (const r of results) {
    const s = sentimentOf(r.analysis);
    const q = Number(r.quantity) || 0;
    if (s > 0) bullish++;
    else if (s < 0) bearish++;
    else neutral++;
    weighted += s * q;
    totalQuantity += q;
  }

  const score = totalQuantity
    ? Math.round((weighted / totalQuantity) * 100)
    : Math.round(((bullish - bearish) / (results.length || 1)) * 100);

  return {
    score,
    bullish,
    neutral,
    bearish,
    stocks: results.length,
    totalQuantity,
    symbols: results.map((r) => r.symbol),
  };
};

// load saved state (React calls on page load)
router.get('/portfolio', ensureAuthenticated, (req, res) => {
  res.json({
    portfolio: req.user.portfolio || [],
    lastAnalysis: req.user.lastAnalysis || null,
    lastAnalysisAt: req.user.lastAnalysisAt || null,
  });
});

// autosave portfolio (no analysis)
router.put('/portfolio', ensureAuthenticated, async (req, res) => {
  try {
    req.user.portfolio = req.body.portfolio || [];
    req.user.markModified('portfolio');
    await req.user.save();
    res.json({ success: true });
  } catch (e) {
    console.error('Save error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---------------------------------------------------------------
// History
// ---------------------------------------------------------------

// list (light: no full results) newest first
router.get('/history', ensureAuthenticated, async (req, res) => {
  try {
    const history = await Analysis.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(MAX_HISTORY)
      .select('createdAt summary')
      .lean();
    res.json({ history });
  } catch (e) {
    console.error('History error:', e.message);
    res.status(500).json({ error: 'Could not load history.' });
  }
});

// one full analysis
router.get('/history/:id', ensureAuthenticated, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Bad id.' });

    const item = await Analysis.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!item) return res.status(404).json({ error: 'Not found.' });
    res.json({ id: item._id, createdAt: item.createdAt, results: item.results });
  } catch (e) {
    console.error('History item error:', e.message);
    res.status(500).json({ error: 'Could not load analysis.' });
  }
});

// delete one
router.delete('/history/:id', ensureAuthenticated, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ error: 'Bad id.' });

    await Analysis.deleteOne({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch (e) {
    console.error('History delete error:', e.message);
    res.status(500).json({ error: 'Could not delete.' });
  }
});

// ---------------------------------------------------------------
// analyze via Colab
// ---------------------------------------------------------------
router.post('/analyze', ensureAuthenticated, async (req, res) => {
  try {
    const { portfolio } = req.body;

    req.user.portfolio = portfolio;
    req.user.markModified('portfolio');
    await req.user.save();

    const base = (process.env.COLAB_NGROK_URL || '').trim().replace(/\/+$/, '');
    const colabUrl = `${base}/analyze-portfolio`;
    console.log('URL:', JSON.stringify(colabUrl));

    const response = await axios.post(
      colabUrl,
      { portfolio },
      {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        timeout: 600000,
      }
    );

    // save result so it survives re-login
    req.user.lastAnalysis = response.data;
    req.user.lastAnalysisAt = new Date();
    req.user.markModified('lastAnalysis');
    await req.user.save();

    const results = response.data?.results;

    // Save to history. Failure here must not break the analysis response.
    if (Array.isArray(results) && results.length) {
      try {
        await Analysis.create({
          userId: req.user._id,
          results,
          summary: summarize(results),
        });

        // keep only newest MAX_HISTORY
        const old = await Analysis.find({ userId: req.user._id })
          .sort({ createdAt: -1 })
          .skip(MAX_HISTORY)
          .select('_id')
          .lean();
        if (old.length)
          await Analysis.deleteMany({ _id: { $in: old.map((o) => o._id) } });
      } catch (e) {
        console.error('History save failed:', e.message);
      }
    }

    // Auto-email the report. Fire and forget.
    sendAnalysisReport(req.user, results).catch((e) =>
      console.error('Email failed:', e.message)
    );

    // WhatsApp summary. Fire and forget. Only if user opted in.
    if (req.user.whatsappOptIn && req.user.phone && Array.isArray(results) && results.length) {
      sendWhatsApp(req.user.phone, buildAnalysisMessage(req.user, results)).catch((e) =>
        console.error('WhatsApp failed:', e.message)
      );
    }

    res.json(response.data);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Body:', error.response?.data);
    res.status(500).json({ success: false, error: 'Failed to analyze portfolio via Colab.' });
  }
});

export default router;