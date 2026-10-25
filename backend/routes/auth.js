import express from 'express';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// NEW: limit repeated sign up / sign in attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

const fail = (res, status, error, field) =>
  res.status(status).json({ error, ...(field && { field }) });

// ---------------------------------------------------------------
// NEW: Sign up with email + password
// ---------------------------------------------------------------
router.post('/signup', authLimiter, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name) return fail(res, 400, 'Enter your name.', 'name');
    if (!EMAIL_RE.test(email))
      return fail(res, 400, 'Enter a valid email address.', 'email');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
      return fail(
        res,
        400,
        'Use at least 8 characters, with a letter and a number.',
        'password'
      );
    if (Buffer.byteLength(password) > 72)
      return fail(res, 400, 'Use 72 characters or fewer.', 'password');

    const existing = await User.findOne({ email }).select('+password');
    if (existing) {
      const msg = existing.password
        ? 'An account with this email already exists. Sign in instead.'
        : 'This email is registered with Google. Continue with Google instead.';
      return fail(res, 409, msg, 'email');
    }

    const user = await User.create({ displayName: name, email, password });

    // Sign the new user in right away (creates the session cookie).
    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json({ user });
    });
  } catch (err) {
    if (err.code === 11000)
      return fail(res, 409, 'An account with this email already exists.', 'email');
    next(err);
  }
});

// ---------------------------------------------------------------
// NEW: Sign in with email + password
// ---------------------------------------------------------------
router.post('/signin', authLimiter, (req, res, next) => {
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  if (!email || !password)
    return fail(res, 400, 'Enter your email and password.');

  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user)
      return fail(res, 401, info?.message || 'Incorrect email or password.');

    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ user });
    });
  })(req, res, next);
});

// ---------------------------------------------------------------
// Start Google Login (unchanged)
// ---------------------------------------------------------------
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Callback (unchanged)
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173' }),
  (req, res) => {
    // Redirect back to your React frontend after successful login
    res.redirect('http://localhost:5173');
  }
);

// Logout (unchanged link version, used by <a href>)
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('http://localhost:5173');
  });
});

// NEW: Logout for fetch/axios (returns JSON instead of redirecting)
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
});

// Check current user (called by React on load) (unchanged)
router.get('/me', (req, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

export default router;