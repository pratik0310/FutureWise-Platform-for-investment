import { useState } from "react";
import "./AuthModal.css";

const API = "http://localhost:3000";

// ---------- Icons ----------
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const MailIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

export default function AuthModal({ initialMode = "signin", onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode); // "signin" | "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSignup = mode === "signup";

  const update = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errorField === key) {
      setError("");
      setErrorField("");
    }
  };

  const switchMode = () => {
    setMode(isSignup ? "signin" : "signup");
    setError("");
    setErrorField("");
    setShowPassword(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setErrorField("");

    try {
      const res = await fetch(`${API}/auth/${isSignup ? "signup" : "signin"}`, {
        method: "POST",
        credentials: "include", // session cookie
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup
            ? { name: form.name, email: form.email, password: form.password }
            : { email: form.email, password: form.password }
        ),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        setErrorField(data.field || "");
        return;
      }

      onSuccess(data.user);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  const googleLogin = () => {
    window.location.href = `${API}/auth/google`;
  };

  return (
    <div className="auth-overlay" onMouseDown={onClose}>
      <div className="auth-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>

        <div className="auth-header">
          <h2>{isSignup ? "Create account" : "Welcome back"}</h2>
          <p className="auth-sub">
            {isSignup
              ? "Sign up to save your portfolio and AI insights."
              : "Sign in to load your saved portfolio."}
          </p>
        </div>

        <button type="button" className="auth-google" onClick={googleLogin}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={submit} noValidate>
          {isSignup && (
            <label className="auth-field">
              <span>Name</span>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><UserIcon /></span>
                <input
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={update("name")}
                  className={errorField === "name" ? "has-error" : ""}
                  placeholder="John Doe"
                  autoFocus
                />
              </div>
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <div className="auth-input-wrap">
              <span className="auth-input-icon"><MailIcon /></span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={update("email")}
                className={errorField === "email" ? "has-error" : ""}
                placeholder="you@example.com"
                autoFocus={!isSignup}
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-input-wrap">
              <span className="auth-input-icon"><LockIcon /></span>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={form.password}
                onChange={update("password")}
                className={errorField === "password" ? "has-error" : ""}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {isSignup && (
              <small>At least 8 characters, with a letter and a number.</small>
            )}
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <button type="button" onClick={switchMode}>
            {isSignup ? "Sign in" : "Create account"}
          </button>
        </p>
      </div>
    </div>
  );
}