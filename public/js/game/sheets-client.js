/**
 * Chrono-Front: Galactic War — Google Sheets Client
 *
 * Replaces the Firebase frontend client entirely.
 * All game data is stored in Google Sheets via the deployed
 * Apps Script web-app endpoint (GOOGLE_APPS_SCRIPT_URL from .env,
 * served as /api/sheets-url by the Express server).
 *
 * DATA STORED
 * ───────────
 * Sheet: "Accounts"
 *   A: uid (username used as uid), B: username, C: email,
 *   D: joined_at, E: last_login, F: level, G: cards_collected
 *
 * Sheet: "Progression"
 *   A: uid, B: progression_json (full JSON blob of player state)
 *
 * Sheet: "HighScores"
 *   A: uid, B: mode, C: wave, D: score, E: saved_at
 *
 * DESIGN
 * ──────
 * • All calls are fire-and-forget (the game never waits on Sheets).
 * • localStorage is the primary store; Sheets is the backup sync.
 * • safePost() wraps all network calls — never throws to the game.
 * • The Apps Script URL is fetched once from /api/sheets-url.
 */

/* global GW */

GW.SheetsClient = class SheetsClient {
  constructor() {
    this._url   = null;   // Apps Script web-app URL (loaded once)
    this._apiBase = '';
    this.ready  = false;
    this._queue = [];     // pending calls before init completes
  }

  // ── Initialise ─────────────────────────────────────────────────────────────
  async init() {
    if (this.ready) return;
    try {
      // Resolve the API base first so we never probe a hardcoded foreign port.
      if (window.GWNet && window.GWNet.probeBackend) await window.GWNet.probeBackend();
      const apiBase = (window.GWNet && window.GWNet.state) ? window.GWNet.state.apiBase : '';
      this._apiBase = apiBase;
      const res  = await fetch(apiBase + '/api/sheets-url');
      const data = await res.json();
      if (!data.url) throw new Error('No Sheets URL returned from server');
      this._url  = data.url;
      this.ready = true;
      // Flush any queued calls
      this._queue.forEach(fn => fn());
      this._queue = [];
      const progression = window.GW && window.GW.progression;
      if (progression && progression.state && !progression.isGuest) {
        const user = (() => { try { return JSON.parse(localStorage.getItem('gw_user') || '{}'); } catch (_) { return {}; } })();
        this.saveProgression(user.email || progression.state.playerName, progression.state);
      }
      console.log('[Sheets] Client ready.');
    } catch (e) {
      try {
        this._url = window.GWNet && await window.GWNet.resolveAppsScript();
        this.ready = !!this._url;
      } catch (_) { this.ready = false; }
      if (!this.ready) console.warn('[Sheets] Init failed — data will be localStorage-only.', e.message);
    }
  }

  // ── Internal POST ──────────────────────────────────────────────────────────
  async safePost(payload) {
    if (!this._url) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    try {
      await fetch(this._url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body:    JSON.stringify(payload),
        signal:  controller.signal,
      });
    } catch (e) {
      console.warn('[Sheets] POST failed (non-fatal):', e.message);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  // ── Progression ────────────────────────────────────────────────────────────
  /** Save player progression. Always writes localStorage; syncs Sheets if ready. */
  async saveProgression(uid, state) {
    if (!uid || !state) return;
    // localStorage is always the fast primary store
    try { localStorage.setItem('gwr_progression_v2', JSON.stringify(state)); } catch (_) {}
    if (!this.ready) return;
    const token = localStorage.getItem('gw_session_token') || localStorage.getItem('gw_id_token');
    const backend = window.GWNet && window.GWNet.state && window.GWNet.state.backend;
    if (backend && token) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 2500);
      try {
        await fetch(this._apiBase + '/api/auth/progression', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({ token, progression: state }),
          signal: controller.signal,
        });
      } catch (_) {
      } finally {
        window.clearTimeout(timeout);
      }
    } else {
      const user = (() => { try { return JSON.parse(localStorage.getItem('gw_user') || '{}'); } catch (_) { return {}; } })();
      await this.safePost({
        action: 'saveProgression',
        uid: user.email || uid,
        commanderName: state.playerName || '',
        progression_json: JSON.stringify(state),
        saved_at: new Date().toISOString(),
      });
    }
  }

  /** Load progression — always from localStorage (Sheets is write-only for speed). */
  async loadProgression(uid) {
    try {
      const raw = localStorage.getItem('gwr_progression_v2');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  // ── High Scores ────────────────────────────────────────────────────────────
  async saveHighScore(uid, mode, data) {
    if (!this.ready) return;
    this.safePost({
      action:   'saveHighScore',
      uid,
      mode,
      wave:     data.wave  || 0,
      score:    data.score || 0,
      saved_at: new Date().toISOString(),
    });
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  async saveEvent(uid, eventType, data) {
    if (!this.ready) return;
    this.safePost({
      action:    'saveEvent',
      uid,
      eventType,
      ...data,
      saved_at:  new Date().toISOString(),
    });
  }

  // ── Coins (Galactic Currency) ───────────────────────────────────────────────
  async saveCoins(uid, totalCoins) {
    if (!this.ready) return;
    this.safePost({
      action:      'saveCoins',
      uid,
      totalCoins,
      saved_at:    new Date().toISOString(),
    });
  }
};

// Global singleton — replaces GW.firebaseClient
GW.sheetsClient   = new GW.SheetsClient();
// Alias for backwards compat with any code that checks GW.firebaseClient
GW.firebaseClient = GW.sheetsClient;
