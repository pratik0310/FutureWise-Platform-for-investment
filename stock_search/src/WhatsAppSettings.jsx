import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

export default function WhatsAppSettings({ onToast }) {
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [serverReady, setServerReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/api/whatsapp`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setPhone(d.phone || "");
        setOptIn(!!d.optIn);
        setServerReady(!!d.serverReady);
      })
      .catch(() => {});
  }, []);

  const call = async (url, method, body, okMsg) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API}${url}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Failed.");
      onToast?.(okMsg, "success");
      return d;
    } catch (e) {
      setError(e.message);
      onToast?.(e.message, "error");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const d = await call("/api/whatsapp", "PUT", { phone, optIn }, "WhatsApp settings saved.");
    if (d) {
      setPhone(d.phone || "");
      setOptIn(!!d.optIn);
    }
  };

  return (
    <div className="al-card">
      <div className="al-card-head">
        <h4>WhatsApp notifications</h4>
        <span className="al-card-hint">
          {serverReady ? "Server connected" : "Server WhatsApp offline"}
        </span>
      </div>

      <div className="al-form-row">
        <div className="al-target-wrap">
          <input
            type="tel"
            inputMode="numeric"
            placeholder="919876543210 (with country code)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="al-target-input"
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          Send me analysis + alerts
        </label>

        <button type="button" className="al-btn al-btn-solid" disabled={busy} onClick={save}>
          Save
        </button>
        <button
          type="button"
          className="al-btn al-btn-ghost"
          disabled={busy || !phone}
          onClick={() => call("/api/whatsapp/test", "POST", null, "Test message sent.")}
        >
          Send test
        </button>
      </div>

      {error && <div className="al-error">{error}</div>}

      <p className="al-note">
        Save first, then press Send test. Number must be on WhatsApp.
      </p>
    </div>
  );
}