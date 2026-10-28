import 'dotenv/config'; // load .env BEFORE anything else runs

import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import passport from 'passport';
import cors from 'cors';

// Custom modules (passport.js registers local + google strategies)
import './config/passport.js';
import { startWhatsApp } from './config/whatsapp.js';
import authRoutes from './routes/auth.js';
import analyzeRoutes from './routes/analyze.js';
import chartRoutes from './routes/chart.js';
import alertRoutes, { startAlertScheduler } from './routes/alerts.js';
import quoteRoutes from './routes/quotes.js';
import whatsappRoutes from './routes/whatsapp.js';

// ---------------------------------------------------------------
// Fail fast if required env vars missing
// ---------------------------------------------------------------
const required = ['MONGODB_URI', 'SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

const app = express();

// Needed behind proxy (Render, Heroku, nginx) so rate limit + secure cookies work
if (isProd) app.set('trust proxy', 1);

// ---------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true, // allow session cookies
  })
);

app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------
// MongoDB
// ---------------------------------------------------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => {
    console.error('MongoDB Error:', err);
    process.exit(1);
  });

// ---------------------------------------------------------------
// Session
// ---------------------------------------------------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
    }),
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd, // HTTPS only in production
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// ---------------------------------------------------------------
// Routes
// ---------------------------------------------------------------
app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/api', analyzeRoutes);
app.use('/api', chartRoutes);
app.use('/api', alertRoutes);
app.use('/api', quoteRoutes);
app.use('/api', whatsappRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler (auth routes call next(err))
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: 'Something went wrong. Try again.' });
});

// ---------------------------------------------------------------
// Start
// ---------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);

  // WhatsApp must never crash the server. If it fails, email still works.
  startWhatsApp().catch((e) => console.error('WhatsApp start failed:', e.message));

  startAlertScheduler();
});