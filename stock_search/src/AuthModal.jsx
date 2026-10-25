import { useState } from "react";
import "./AuthModal.css";

const API = "http://localhost:3000";

export default function AuthModal({ initialMode = "signin", onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode); // "signin" | "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
          ×
        </button>

        <h2>{isSignup ? "Create account" : "Welcome back"}</h2>
        <p className="auth-sub">
          {isSignup
            ? "Sign up to save your portfolio and analysis."
            : "Sign in to load your saved portfolio."}
        </p>

        <button type="button" className="auth-google" onClick={googleLogin}>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <form onSubmit={submit} noValidate>
          {isSignup && (
            <label className="auth-field">
              <span>Name</span>
              <input
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={update("name")}
                className={errorField === "name" ? "has-error" : ""}
                autoFocus
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              className={errorField === "email" ? "has-error" : ""}
              autoFocus={!isSignup}
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={form.password}
              onChange={update("password")}
              className={errorField === "password" ? "has-error" : ""}
            />
            {isSignup && (
              <small>At least 8 characters, with a letter and a number.</small>
            )}
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Please wait..." : isSignup ? "Sign up" : "Sign in"}
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