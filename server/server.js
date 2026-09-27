/**
 * Chrono-Front: Galactic War — Express Server
 *
 * Database: Google Sheets via Apps Script web-app (no Firebase).
 *
 * API endpoints:
 *   GET  /api/health          — health check
 *   GET  /api/sheets-url      — serves the Apps Script URL to the client
 *   GET  /api/version         — version info
 *   POST /api/auth/register   — account registration → Sheets
 *   POST /api/auth/login      — account login → Sheets
 *   POST /api/auth/verify     — session token check
 *   POST /api/auth/logout     — client token drop
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const authRouter = require('./auth');

const app      = express();
const PORT     = process.env.PORT     || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Startup validation ───────────────────────────────────────────────────────
// Warn loudly if critical env vars are missing so the cause of auth
// failures is obvious in the server log rather than hidden in 500 errors.
(function validateEnv() {
  const warnings = [];

  if (!process.env.APP_SECRET || process.env.APP_SECRET.startsWith('REPLACE_')) {
    warnings.push('  APP_SECRET is not set — tokens are signed with the insecure default.');
  }

  const sheetsUrl = (process.env.GOOGLE_APPS_SCRIPT_URL || '').trim();
  if (!sheetsUrl || sheetsUrl.includes('YOUR_DEPLOYMENT_ID')) {
    warnings.push('  GOOGLE_APPS_SCRIPT_URL is not set — account data will NOT be saved to Sheets.');
  }

  if (warnings.length) {
    console.warn('');
    console.warn('⚠  CONFIGURATION WARNINGS:');
    warnings.forEach(w => console.warn(w));
    console.warn('   → Update your .env file to resolve these.');
    console.warn('');
  }
})();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          // Phaser CDN
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
          // Google Fonts
          'https://fonts.googleapis.com',
        ],
        connectSrc: [
          "'self'",
          // Google Apps Script (Sheets sync)
          'https://script.google.com',
          'https://script.googleusercontent.com',
          // Local dev
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ],
        styleSrc:  ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:   ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:    ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        frameSrc:  ["'none'"],
        upgradeInsecureRequests: NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000', 'http://127.0.0.1:3000',
      'http://localhost:5500', 'http://127.0.0.1:5500',
      'http://localhost:5501', 'http://127.0.0.1:5501',
    ];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ─── Static Files ─────────────────────────────────────────────────────────────
// Serve assets, CSS, JS from public/
app.use(express.static(path.join(__dirname, '..', 'public')));
// Serve HTML pages (auth.html, index.html, game.html) from the project root
app.use(express.static(path.join(__dirname, '..')));

// ─── Auth Routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// ─── API Routes ───────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status:      'ok',
    game:        'Chrono-Front: Galactic War',
    version:     '1.0.0',
    environment: NODE_ENV,
    database:    'Google Sheets',
    timestamp:   new Date().toISOString(),
  });
});

// Serve the Apps Script URL to client-side JS (keeps it out of source code).
// The client uses this to sync progression/coins directly to Sheets.
app.get('/api/sheets-url', (_req, res) => {
  const url = (process.env.GOOGLE_APPS_SCRIPT_URL || '').trim();
  if (!url || url.includes('YOUR_DEPLOYMENT_ID')) {
    return res.status(503).json({ error: 'Google Sheets not configured. Set GOOGLE_APPS_SCRIPT_URL in .env.' });
  }
  res.json({ url });
});

app.get('/api/version', (_req, res) => {
  res.json({ version: '1.0.0', phase: 'part-1', database: 'google-sheets' });
});

// ─── Catch unmatched /api/* ───────────────────────────────────────────────────
// Returns JSON 404 so POST requests never hit the SPA GET fallback (which
// would cause a 405 Method Not Allowed from Express's route layer).
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.path}` });
});

// ─── SPA Fallback ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Chrono-Front: Galactic War — Server    ║');
  console.log(`║   http://localhost:${PORT}                   ║`);
  console.log(`║   Environment: ${NODE_ENV.padEnd(26)}║`);
  console.log('║   Database:    Google Sheets             ║');
  console.log('╚══════════════════════════════════════════╝');
});

module.exports = app;
