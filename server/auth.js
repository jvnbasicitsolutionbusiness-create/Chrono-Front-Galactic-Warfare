/**
 * Chrono-Front: Galactic War — Auth Router
 *
 * DATABASE
 * ────────
 * Accounts live in Google Sheets (tab "GalacticWarfare") via a deployed
 * Apps Script web-app.  The Apps Script owns ALL password hashing — this
 * server forwards the plaintext password over HTTPS to the Apps Script,
 * which salts + SHA-256 hashes it before writing to the sheet.
 *
 * COLUMN LAYOUT (Apps Script / spreadsheet)
 *   A  Email
 *   B  Password  (salt:base64-SHA256)
 *   C  Command_N
 *   D  Modes Unlock
 *   E  Level
 *   F  Coins Collected
 *
 * SESSION TOKENS
 * ──────────────
 * Format : base64(email:commanderName:expiry) + "." + HMAC-SHA256(payload, APP_SECRET)
 * Expiry : 30 days.
 * Verified server-side on POST /api/auth/verify.
 *
 * PAYLOAD SENT TO APPS SCRIPT
 * ───────────────────────────
 * register : { action, email, password, commanderName }
 * login    : { action, email, password }
 *
 * APPS SCRIPT RESPONSES
 * ─────────────────────
 * { success: true,  progress: { commanderName, modesUnlock, level, coinsCollected } }
 * { success: false, message: "...", duplicate?: true }
 */

'use strict';

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

// ─── Token helpers ────────────────────────────────────────────────────────────

function makeToken(email, commanderName) {
  const secret  = process.env.APP_SECRET || 'dev_secret_change_me';
  const expiry  = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30; // 30 days
  const payload = Buffer.from(`${email}:${commanderName}:${expiry}`).toString('base64url');
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const secret  = process.env.APP_SECRET || 'dev_secret_change_me';
    const dotIdx  = token.lastIndexOf('.');
    if (dotIdx < 0) return null;
    const payload = token.slice(0, dotIdx);
    const sig     = token.slice(dotIdx + 1);
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    // Format: email:commanderName:expiry
    // email may contain ':', so split from the RIGHT
    const lastColon   = decoded.lastIndexOf(':');
    const secondColon = decoded.lastIndexOf(':', lastColon - 1);
    if (secondColon < 0) return null;
    const email         = decoded.slice(0, secondColon);
    const commanderName = decoded.slice(secondColon + 1, lastColon);
    const expiry        = parseInt(decoded.slice(lastColon + 1), 10);
    if (!email || !commanderName || isNaN(expiry)) return null;
    if (expiry < Math.floor(Date.now() / 1000)) return null;
    return { email, commanderName, expiry };
  } catch {
    return null;
  }
}

// ─── Apps Script communication ────────────────────────────────────────────────
//
// Node 18+ fetch() follows the Apps Script 302 redirect automatically,
// preserving the POST method and body so doPost() always receives the payload.

async function sheetsPost(payload) {
  const url = (process.env.GOOGLE_APPS_SCRIPT_URL || '').trim();
  if (!url || url.includes('YOUR_DEPLOYMENT_ID')) {
    console.warn('[Auth] GOOGLE_APPS_SCRIPT_URL not configured.');
    return null;
  }

  try {
    const res = await fetch(url, {
      method:   'POST',
      headers:  { 'Content-Type': 'application/json' },
      body:     JSON.stringify(payload),
      redirect: 'follow',
      signal:   AbortSignal.timeout(15000),
    });

    const text = await res.text();

    if (!res.ok) {
      console.warn('[Auth] Sheets HTTP', res.status, text.slice(0, 120));
      return null;
    }
    if (!text.trim()) return null;

    try {
      return JSON.parse(text);
    } catch {
      console.warn('[Auth] Sheets non-JSON:', text.slice(0, 120));
      return null;
    }
  } catch (err) {
    console.warn('[Auth] Sheets POST failed:', err.message);
    return null;
  }
}

// ─── Rate limiter (in-memory) ─────────────────────────────────────────────────

const _attempts = new Map();

function checkRateLimit(ip, limit, windowMs) {
  const now   = Date.now();
  const entry = _attempts.get(ip) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
  entry.count++;
  _attempts.set(ip, entry);
  return entry.count <= limit;
}

// ─── Validators ───────────────────────────────────────────────────────────────

const validEmail = e =>
  typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const validPassword = p =>
  typeof p === 'string' && p.length >= 8;

const validCommanderName = n =>
  typeof n === 'string' &&
  n.trim().length >= 3 && n.trim().length <= 24 &&
  /^[a-zA-Z0-9_\- ]+$/.test(n.trim());

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/register
//
//  Flow:
//    1. Validate inputs server-side.
//    2. POST { action, email, password, commanderName } to Apps Script.
//    3. Apps Script hashes password, checks duplicate, appends row.
//    4. Return 201 ONLY when Apps Script confirms success:true.
//    5. On any failure return the error — never issue a ghost token.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    // Rate limit: 10 registrations / IP / hour (was 5 — too aggressive for real use)
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(ip, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many registration attempts. Please wait an hour.' });
    }

    // Accept either 'username' or 'commanderName' from the frontend
    const email         = String(req.body?.email         || '').trim();
    const password      = String(req.body?.password      || '');
    const commanderName = String(req.body?.commanderName || req.body?.username || '').trim();

    if (!validEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (!validCommanderName(commanderName)) {
      return res.status(400).json({ error: 'Commander name must be 3–24 characters (letters, numbers, spaces, _ or -).' });
    }

    // ── Call Apps Script ─────────────────────────────────────────────────────
    const result = await sheetsPost({
      action:        'register',
      email:         email.toLowerCase(),
      password,               // Apps Script salts + hashes this
      commanderName,
    });

    // ── Handle Sheets being unreachable ───────────────────────────────────────
    if (result === null) {
      console.error('[Auth] Sheets unreachable during registration — refusing ghost token.');
      return res.status(503).json({
        error: 'The database is temporarily unavailable. Please try again in a moment.',
      });
    }

    // ── Duplicate account ─────────────────────────────────────────────────────
    // Detect via explicit flag OR message text (covers old and new Apps Script versions)
    const isDuplicate =
      result.duplicate === true ||
      (result.success === false &&
        /already exist|duplicate|registered/i.test(result.message || ''));

    if (isDuplicate) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // ── Any other Apps Script failure ─────────────────────────────────────────
    if (result.success !== true) {
      console.warn('[Auth] Sheets register rejected:', result.message);
      return res.status(400).json({ error: result.message || 'Registration failed. Please try again.' });
    }

    // ── Success — issue session token ─────────────────────────────────────────
    const token    = makeToken(email.toLowerCase(), commanderName);
    const progress = result.progress || {
      commanderName,
      modesUnlock:    'Adventure',
      level:          1,
      coinsCollected: 0,
    };

    return res.status(201).json({
      ok:   true,
      email: email.toLowerCase(),
      commanderName,
      token,
      progress,
    });

  } catch (err) {
    console.error('[Auth] /register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/login
//
//  Flow:
//    1. POST { action, email, password } to Apps Script.
//    2. Apps Script finds the row, re-hashes with stored salt, compares.
//    3. On success return a signed token + progress.
//    4. On failure return 401.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(ip, 10, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes.' });
    }

    const email    = String(req.body?.email    || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await sheetsPost({
      action:   'login',
      email:    email.toLowerCase(),
      password,
    });

    // ── Sheets unreachable ────────────────────────────────────────────────────
    if (result === null) {
      return res.status(503).json({
        error: 'The database is temporarily unavailable. Please try again in a moment.',
      });
    }

    // ── Wrong credentials ─────────────────────────────────────────────────────
    if (result.success !== true) {
      return res.status(401).json({ error: result.message || 'Incorrect email or password.' });
    }

    // ── Success ───────────────────────────────────────────────────────────────
    const commanderName = result.progress?.commanderName || email.split('@')[0];
    const token         = makeToken(email.toLowerCase(), commanderName);

    return res.status(200).json({
      ok:   true,
      email: email.toLowerCase(),
      commanderName,
      token,
      progress: result.progress || {},
    });

  } catch (err) {
    console.error('[Auth] /login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/verify
// ─────────────────────────────────────────────────────────────────────────────
router.post('/verify', (req, res) => {
  try {
    const t = req.body?.token || req.body?.idToken || '';
    if (!t) return res.status(401).json({ error: 'No token provided.' });

    const decoded = verifyToken(t);
    if (!decoded) return res.status(401).json({ error: 'Invalid or expired session.' });

    return res.status(200).json({
      ok:             true,
      email:          decoded.email,
      commanderName:  decoded.commanderName,
      // Keep 'username' alias so existing index.html / game.html guards work
      username:       decoded.commanderName,
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.status(200).json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/register-confirm  (legacy no-op)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/register-confirm', (_req, res) => {
  res.status(200).json({ ok: true });
});

module.exports = router;
