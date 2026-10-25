import dotenv from 'dotenv';
dotenv.config(); // <-- THIS MUST BE AT THE VERY TOP

import passport from 'passport';
import pkg from 'passport-google-oauth20';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const { Strategy: GoogleStrategy } = pkg;

// Used so an unknown email takes as long to reject as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

// ---------------------------------------------------------------
// Email + password (sign in)
// ---------------------------------------------------------------
passport.use(
  new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await User.findOne({
          email: String(email).trim().toLowerCase(),
        }).select('+password');

        if (!user) {
          await bcrypt.compare(password, DUMMY_HASH);
          return done(null, false, { message: 'Incorrect email or password.' });
        }

        // Account was created with Google and has no password yet.
        if (!user.password) {
          return done(null, false, {
            message: 'This account uses Google. Continue with Google.',
          });
        }

        const ok = await user.comparePassword(password);
        if (!ok) {
          return done(null, false, { message: 'Incorrect email or password.' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ---------------------------------------------------------------
// Google (unchanged, plus a verified-email check)
// ---------------------------------------------------------------
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();

        // Only trust Google accounts whose email Google has verified.
        if (!email || profile._json?.email_verified === false) {
          return done(null, false);
        }

        let user = await User.findOne({ googleId: profile.id });
        if (!user) {
          user = await User.findOne({ email });
          if (user) {
            user.googleId = profile.id;
            if (!user.photo) user.photo = profile.photos?.[0]?.value;
            await user.save();
          } else {
            user = await User.create({
              googleId: profile.id,
              email,
              displayName: profile.displayName,
              photo: profile.photos?.[0]?.value,
            });
          }
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

export default passport;