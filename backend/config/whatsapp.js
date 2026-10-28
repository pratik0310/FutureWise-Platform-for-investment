import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import { sentimentScore } from './sentiment.js';

const AUTH_DIR = process.env.WA_AUTH_DIR || './wa_auth';

let sock = null;
let ready = false;
let connecting = false;
let queue = Promise.resolve();

export const isWhatsAppReady = () => ready;

// ---------------------------------------------------------------
// Connection. Call once on server boot.
// First run prints QR in terminal. Scan: WhatsApp > Linked devices.
// ---------------------------------------------------------------
export async function startWhatsApp() {
  if (connecting) return;
  connecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['StockApp', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        console.log('Scan this QR: WhatsApp > Linked devices > Link a device');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        ready = true;
        connecting = false;
        console.log('WhatsApp connected');
      }

      if (connection === 'close') {
        ready = false;
        connecting = false;
        const code = lastDisconnect?.error?.output?.statusCode;

        if (code === DisconnectReason.loggedOut) {
          console.error('WhatsApp logged out. Delete the wa_auth folder and restart to scan QR again.');
          return;
        }
        // 515 "restart required" after QR scan is normal. Reconnect for any other drop too.
        setTimeout(() => {
          startWhatsApp().catch((e) => console.error('WhatsApp reconnect failed:', e.message));
        }, 3000);
      }
    });
  } catch (e) {
    connecting = false;
    throw e;
  }
}

// ---------------------------------------------------------------
// Phone helpers
// "98765 43210" / "+91 98765 43210" -> "919876543210"
// Returns null if it does not look like a real number.
// ---------------------------------------------------------------
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) d = '91' + d; // India default
  return d.length >= 11 && d.length <= 15 ? d : null;
}

// ---------------------------------------------------------------
// Send. Serialized + 1.5s gap between messages = less ban risk.
// Rejects if socket down, number bad, or number not on WhatsApp.
// ---------------------------------------------------------------
export function sendWhatsApp(phone, text) {
  const num = normalizePhone(phone);
  if (!num) return Promise.reject(new Error('Bad phone number'));
  if (!ready || !sock) return Promise.reject(new Error('WhatsApp not connected'));

  const job = queue.then(async () => {
    const [info] = (await sock.onWhatsApp(num)) || [];
    if (!info?.exists) throw new Error(`${num} is not on WhatsApp`);
    await sock.sendMessage(info.jid, { text });
    await new Promise((r) => setTimeout(r, 1500));
  });

  queue = job.catch(() => {}); // keep queue alive after a failure
  return job;
}

// ---------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------
export function buildAnalysisMessage(user, results) {
  const label = (s) => (s > 0 ? '🟢 Bullish' : s < 0 ? '🔴 Bearish' : '🟡 Neutral');
  const lines = results.map((r) => `• *${r.symbol}* — ${label(sentimentScore(r.analysis))}`);

  return [
    '📊 *Portfolio analysis ready*',
    `Hi ${user.displayName || 'there'},`,
    '',
    ...lines,
    '',
    'Open the app for the full report.',
    '_AI-generated. Not financial advice._',
  ].join('\n');
}

export function buildAlertMessage(alert, price, currency) {
  const cur = currency || alert.currency;
  const sym = cur === 'INR' ? '₹' : cur === 'USD' ? '$' : '';
  const fmt = (n) => sym + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const arrow = alert.direction === 'above' ? '▲' : '▼';
  const word = alert.direction === 'above' ? 'above' : 'below';

  return [
    `🔔 *Price alert hit: ${alert.symbol}*`,
    `${arrow} Now: *${fmt(price)}*`,
    `Your target: ${word} ${fmt(alert.targetPrice)}`,
    '',
    'This alert is done and will not repeat.',
  ].join('\n');
}