import 'dotenv/config';
import nodemailer from 'nodemailer';
import { getSentiment } from './sentiment.js';

let transporter = null;

const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  if (!transporter) {
    const port = Number(SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465, // true for 465, false for 587
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const cleanAnalysis = (text) =>
  String(text || '')
    .replace(/\[INST\][\s\S]*?\[\/INST\]/g, '')
    .trim();


const buildHtml = (name, results) => {
  const date = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  const stockBlocks = results
    .map((stock) => {
      const s = getSentiment(stock.analysis);

      const news =
        stock.news && stock.news.length
          ? stock.news
              .map(
                (n) =>
                  `<li style="margin-bottom:6px;">${esc(n.title)}<br>` +
                  `<span style="color:#888;font-size:12px;">${esc(n.source)} | ${esc(n.posted)}</span></li>`
              )
              .join('')
          : '<li style="color:#888;">No recent news found.</li>';

      const analysis = cleanAnalysis(stock.analysis)
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => `<p style="margin:4px 0;">${esc(l)}</p>`)
        .join('');

      return `
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:18px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <div style="font-size:18px;font-weight:700;">${esc(stock.symbol)}</div>
              <div style="color:#666;font-size:13px;">${esc(stock.company || '')} &middot; Qty: ${esc(stock.quantity)}</div>
            </td>
            <td align="right">
              <span style="background:${s.color}22;color:${s.color};border:1px solid ${s.color};
                           padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700;">
                ${s.icon} ${s.label}
              </span>
            </td>
          </tr></table>

          <h4 style="margin:14px 0 6px;font-size:14px;">Recent News</h4>
          <ul style="margin:0;padding-left:18px;font-size:13px;">${news}</ul>

          <h4 style="margin:14px 0 6px;font-size:14px;">Analysis</h4>
          <div style="font-size:13px;line-height:1.5;">${analysis}</div>
        </div>`;
    })
    .join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111;">
    <h2 style="margin-bottom:2px;">Portfolio Analysis Report</h2>
    <p style="color:#666;margin-top:0;">Hi ${esc(name || 'there')}, here is your latest analysis (${esc(date)}).</p>
    ${stockBlocks}
    <p style="color:#999;font-size:11px;">AI-generated insights. Not financial advice.</p>
  </div>`;
};

/**
 * Email the analysis report to the user. Never throws into the caller's flow
 * unless you await it - call it with .catch() so a mail failure can't break analysis.
 */
export const sendAnalysisReport = async (user, results) => {
  if (!user?.email || !Array.isArray(results) || results.length === 0) return;

  const t = getTransporter();
  if (!t) {
    console.warn('Email skipped: SMTP_HOST / SMTP_USER / SMTP_PASS not set.');
    return;
  }

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Your portfolio analysis report',
    html: buildHtml(user.displayName, results),
  });

  console.log(`Report emailed to ${user.email}`);
};

/**
 * Email a price alert. THROWS if SMTP is not configured, so the checker
 * can put the alert back to "active" and retry later instead of losing it.
 */
export const sendPriceAlert = async (user, alert, price, currency) => {
  const t = getTransporter();
  if (!t) throw new Error('SMTP_HOST / SMTP_USER / SMTP_PASS not set');

  const sym = (currency || alert.currency) === 'INR' ? '₹' : (currency || alert.currency) === 'USD' ? '$' : '';
  const fmt = (n) => sym + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const word = alert.direction === 'above' ? 'above' : 'below';
  const arrow = alert.direction === 'above' ? '▲' : '▼';
  const color = alert.direction === 'above' ? '#10b981' : '#ef4444';

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: `Price alert: ${alert.symbol} is ${word} ${fmt(alert.targetPrice)}`,
    html: `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#111;">
      <h2 style="margin-bottom:2px;">Price alert hit</h2>
      <p style="color:#666;margin-top:0;">Hi ${esc(user.displayName || 'there')},</p>
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;">
        <div style="font-size:20px;font-weight:700;">${esc(alert.symbol)}</div>
        <div style="color:#666;font-size:13px;">${esc(alert.name || '')}</div>
        <div style="margin-top:12px;font-size:28px;font-weight:800;color:${color};">${arrow} ${esc(fmt(price))}</div>
        <div style="color:#666;font-size:13px;margin-top:4px;">
          Your target: ${word} ${esc(fmt(alert.targetPrice))}
        </div>
      </div>
      <p style="color:#999;font-size:11px;">
        This alert is now done and will not repeat. Prices come from Yahoo Finance and may be delayed.
        Not financial advice.
      </p>
    </div>`,
  });

  console.log(`Price alert emailed to ${user.email} (${alert.symbol} ${alert.direction} ${alert.targetPrice})`);
};