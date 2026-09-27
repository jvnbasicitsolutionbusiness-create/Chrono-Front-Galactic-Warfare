/**
 * Chrono-Front: Galactic War — Client-side Auth
 *
 * REGISTRATION FLOW
 * ─────────────────
 * 1. Client-side validation (email, password ≥ 8 chars, commander name 3-24 chars,
 *    passwords match).
 * 2. POST /api/auth/register  { email, password, commanderName }
 *    → Server forwards to Apps Script → Apps Script hashes password, writes row.
 *    → Server returns 201 ONLY after Apps Script confirms success:true.
 * 3. Store token + user in localStorage → redirect to index.html.
 *
 * LOGIN FLOW
 * ──────────
 * 1. POST /api/auth/login  { email, password }
 *    → Server forwards to Apps Script → Apps Script re-hashes, compares.
 * 2. Store token + user → redirect to index.html.
 *
 * SESSION CHECK
 * ─────────────
 * POST /api/auth/verify  { token }
 * Success → skip auth page.  Failure → clear session, show form.
 *
 * TOKEN STORAGE
 * ─────────────
 * localStorage key 'gw_session_token'  — HMAC-signed server token
 * localStorage key 'gw_user'           — { email, commanderName }
 * localStorage key 'gw_id_token'       — alias kept for auth guards in
 *                                         index.html / game.html
 */

'use strict';

(function () {

  /* ── Constants ─────────────────────────────────────────── */
  const TOKEN_KEY    = 'gw_session_token';
  const USER_KEY     = 'gw_user';
  const REDIRECT_URL = 'index.html';

  // Express always runs on port 3000.
  // When served via Live Server (5500/5501) or file://, use absolute URL.
  const EXPRESS_PORT = 3000;
  const API_BASE = (
    window.location.port === String(EXPRESS_PORT) ||
    window.location.protocol === 'https:'
  ) ? '' : `http://localhost:${EXPRESS_PORT}`;

  /* ── DOM refs ──────────────────────────────────────────── */
  let tabLogin, tabRegister, sectionLogin, sectionRegister;
  let formLogin,    loginEmail,   loginPassword,  loginStatus,  loginBtn;
  let formRegister, regUsername,  regEmail,       regPassword,  regConfirm;
  let regStrengthBar, regStatus,  regBtn;

  /* ══════════════════════════════════════════════════════════
     SAFE FETCH — never throws; always returns { ok, status, data, networkError }
  ══════════════════════════════════════════════════════════ */
  async function safePost(url, body) {
    try {
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      let data = {};
      try {
        const text = await resp.text();
        if (text.trim()) data = JSON.parse(text);
      } catch { /* non-JSON body — leave data as {} */ }
      return { ok: resp.ok, status: resp.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: {}, networkError: e.message };
    }
  }

  /* ══════════════════════════════════════════════════════════
     ENTRY POINT
  ══════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindDomRefs();
    bindTabs();
    bindForms();

    // Deep-link: auth.html?tab=register
    if (new URLSearchParams(window.location.search).get('tab') === 'register') {
      switchTab('register');
    }

    // Already logged in → skip to game
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) {
      const ok = await verifyTokenQuiet(saved);
      if (ok) { window.location.replace(REDIRECT_URL); return; }
      clearSession();
    }
  }

  /* ══════════════════════════════════════════════════════════
     DOM BINDING
  ══════════════════════════════════════════════════════════ */
  function bindDomRefs() {
    tabLogin        = document.getElementById('tabLogin');
    tabRegister     = document.getElementById('tabRegister');
    sectionLogin    = document.getElementById('sectionLogin');
    sectionRegister = document.getElementById('sectionRegister');

    formLogin     = document.getElementById('formLogin');
    loginEmail    = document.getElementById('loginEmail');
    loginPassword = document.getElementById('loginPassword');
    loginStatus   = document.getElementById('loginStatus');
    loginBtn      = document.getElementById('loginBtn');

    formRegister   = document.getElementById('formRegister');
    regUsername    = document.getElementById('regUsername');   // Commander Name input
    regEmail       = document.getElementById('regEmail');
    regPassword    = document.getElementById('regPassword');
    regConfirm     = document.getElementById('regConfirm');
    regStrengthBar = document.getElementById('regStrengthBar');
    regStatus      = document.getElementById('regStatus');
    regBtn         = document.getElementById('regBtn');
  }

  function bindTabs() {
    tabLogin?.addEventListener('click',    () => switchTab('login'));
    tabRegister?.addEventListener('click', () => switchTab('register'));
  }

  function switchTab(tab) {
    const isLogin = (tab === 'login');
    tabLogin?.classList.toggle('active',  isLogin);
    tabRegister?.classList.toggle('active', !isLogin);
    sectionLogin?.classList.toggle('active',  isLogin);
    sectionRegister?.classList.toggle('active', !isLogin);
    clearStatus(loginStatus);
    clearStatus(regStatus);
  }

  function bindForms() {
    regPassword?.addEventListener('input', () => updateStrength(regPassword.value));
    formLogin?.addEventListener('submit',    async e => { e.preventDefault(); await handleLogin(); });
    formRegister?.addEventListener('submit', async e => { e.preventDefault(); await handleRegister(); });
  }

  /* ══════════════════════════════════════════════════════════
     LOGIN
  ══════════════════════════════════════════════════════════ */
  async function handleLogin() {
    clearStatus(loginStatus);

    const email    = loginEmail?.value.trim()  || '';
    const password = loginPassword?.value       || '';

    if (!email || !password) {
      showStatus(loginStatus, 'Please enter your email and password.', 'error');
      return;
    }

    setLoading(loginBtn, true);

    const { ok, status, data, networkError } =
      await safePost(API_BASE + '/api/auth/login', { email, password });

    setLoading(loginBtn, false);

    if (networkError) {
      showStatus(loginStatus, 'Cannot reach the server. Is it running?', 'error');
      return;
    }

    if (status === 503) {
      showStatus(loginStatus, 'The database is temporarily unavailable. Please try again.', 'error');
      return;
    }

    if (!ok) {
      showStatus(loginStatus, data.error || 'Incorrect email or password.', 'error');
      return;
    }

    // Server returns { ok, email, commanderName, token, progress }
    const commanderName = data.commanderName || data.username || email.split('@')[0];
    persistSession(data.token, { email: data.email || email, commanderName });

    showStatus(loginStatus, `Welcome back, ${commanderName}. Establishing uplink…`, 'success');
    setTimeout(() => window.location.replace(REDIRECT_URL), 800);
  }

  /* ══════════════════════════════════════════════════════════
     REGISTER
  ══════════════════════════════════════════════════════════ */
  async function handleRegister() {
    clearStatus(regStatus);

    // The "Commander Name" input is bound to regUsername DOM element
    const commanderName = regUsername?.value.trim() || '';
    const email         = regEmail?.value.trim()    || '';
    const password      = regPassword?.value         || '';
    const confirm       = regConfirm?.value           || '';

    /* ── Client-side validation ─────────────────────────── */
    if (!commanderName || commanderName.length < 3 || commanderName.length > 24) {
      showStatus(regStatus, 'Commander name must be 3–24 characters.', 'error');
      regUsername?.focus(); return;
    }
    if (!/^[a-zA-Z0-9_\- ]+$/.test(commanderName)) {
      showStatus(regStatus, 'Commander name: letters, numbers, spaces, _ or - only.', 'error');
      regUsername?.focus(); return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showStatus(regStatus, 'Please enter a valid email address.', 'error');
      regEmail?.focus(); return;
    }
    if (password.length < 8) {
      showStatus(regStatus, 'Password must be at least 8 characters.', 'error');
      regPassword?.focus(); return;
    }
    if (password !== confirm) {
      showStatus(regStatus, 'Passwords do not match.', 'error');
      regConfirm?.focus(); return;
    }

    setLoading(regBtn, true);

    // Send commanderName — server/auth.js accepts both 'commanderName' and 'username'
    const { ok, status, data, networkError } =
      await safePost(API_BASE + '/api/auth/register', { email, password, commanderName });

    setLoading(regBtn, false);

    if (networkError) {
      showStatus(regStatus, 'Cannot reach the server. Is it running?', 'error');
      return;
    }

    if (status === 503) {
      showStatus(regStatus, 'The database is temporarily unavailable. Please try again in a moment.', 'error');
      return;
    }

    if (status === 409) {
      showStatus(regStatus, 'An account with that email already exists.', 'error');
      return;
    }

    if (!ok) {
      // Show the exact error from the server / Apps Script (e.g. validation messages)
      showStatus(regStatus, data.error || 'Registration failed. Please try again.', 'error');
      return;
    }

    // Registration confirmed by Sheets — persist session and redirect
    const resolvedName = data.commanderName || commanderName;
    persistSession(data.token, { email: data.email || email, commanderName: resolvedName });

    showStatus(regStatus, `Account created, ${resolvedName}! Deploying you to the frontline…`, 'success');
    setTimeout(() => window.location.replace(REDIRECT_URL), 900);
  }

  /* ══════════════════════════════════════════════════════════
     SESSION HELPERS
  ══════════════════════════════════════════════════════════ */
  function persistSession(token, user) {
    localStorage.setItem(TOKEN_KEY,      token || '');
    localStorage.setItem('gw_id_token',  token || '');   // auth-guard alias
    localStorage.setItem(USER_KEY,       JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('gw_id_token');
    localStorage.removeItem(USER_KEY);
  }

  async function verifyTokenQuiet(token) {
    const { ok, data } = await safePost(API_BASE + '/api/auth/verify', { token });
    if (ok && data.ok) {
      // Refresh stored user so commanderName is always up-to-date
      const stored = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
      if (data.commanderName) stored.commanderName = data.commanderName;
      if (data.username)      stored.commanderName = stored.commanderName || data.username;
      localStorage.setItem(USER_KEY, JSON.stringify(stored));
    }
    return !!(ok && data.ok);
  }

  /* ══════════════════════════════════════════════════════════
     PASSWORD STRENGTH INDICATOR
  ══════════════════════════════════════════════════════════ */
  function updateStrength(pw) {
    if (!regStrengthBar) return;
    let score = 0;
    if (pw.length >= 8)            score++;
    if (pw.length >= 12)           score++;
    if (/[A-Z]/.test(pw))          score++;
    if (/[0-9]/.test(pw))          score++;
    if (/[^A-Za-z0-9]/.test(pw))   score++;
    const colors = ['#ef4444', '#f97316', '#eab308', '#22d3ee', '#4ade80'];
    regStrengthBar.style.width      = `${(score / 5) * 100}%`;
    regStrengthBar.style.background = colors[Math.max(0, score - 1)] || '#ef4444';
  }

  /* ══════════════════════════════════════════════════════════
     UI HELPERS
  ══════════════════════════════════════════════════════════ */
  function setLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
  }

  function showStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className   = 'auth-status visible ' + (type || 'error');
  }

  function clearStatus(el) {
    if (!el) return;
    el.textContent = '';
    el.className   = 'auth-status';
  }

})();
