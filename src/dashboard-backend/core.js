// ──────────────────── Dashboard core (shared state) ────────────────────
// Module-level state shared by every dashboard part: the Discord client,
// credentials, rate limiters, sessions, the dash-user/config stores and
// the multer upload pipeline. Parts never mutate this state directly —
// they go through the exported functions.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { getDb } = require('../db');

// ──── Discord client + credentials ────
let client = null;
let dashboardPassword = '';

function setDashboardClient(c, password) {
    client = c;
    if (!password) {
        console.error('[Dashboard] DASHBOARD_PASSWORD is not set! Please set it in your .env file.');
    }
    dashboardPassword = password;
}

function getClient() {
    return client;
}

// Constant-time password check — hashes both sides so length/timing of the
// raw comparison can't leak information about DASHBOARD_PASSWORD.
function passwordMatches(candidate) {
    if (!candidate || !dashboardPassword) return false;
    const a = crypto.createHash('sha256').update(String(candidate)).digest();
    const b = crypto.createHash('sha256').update(String(dashboardPassword)).digest();
    return crypto.timingSafeEqual(a, b);
}

// ──── Login Rate Limiter ────
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max attempts per window

function checkRateLimit(ip) {
    const now = Date.now();
    let entry = loginAttempts.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        entry = { count: 1, windowStart: now };
        loginAttempts.set(ip, entry);
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// Clean up old entries every 5 minutes
const loginAttemptReaper = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts.entries()) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW * 2) {
            loginAttempts.delete(ip);
        }
    }
}, 5 * 60 * 1000);
loginAttemptReaper.unref();

// ──── Sessions ────
const sessions = new Map(); // token → { method: 'password'|'discord', userId?: string, accessToken?: string, expiresAt: number }

// Session lifetime — default 24h of inactivity (sliding renewal on each request).
// Override with DASHBOARD_SESSION_HOURS env var.
const SESSION_TTL_MS = (parseFloat(process.env.DASHBOARD_SESSION_HOURS) || 24) * 60 * 60 * 1000;

// Absolute cap — a session can never live longer than this, even with constant
// activity, so a stolen token can't be kept alive indefinitely by any traffic.
// Default 7 days. Override with DASHBOARD_SESSION_MAX_DAYS env var.
const SESSION_MAX_MS = Math.max(1, parseFloat(process.env.DASHBOARD_SESSION_MAX_DAYS) || 7) * 24 * 60 * 60 * 1000;

function generateSession() {
    return crypto.randomBytes(32).toString('base64url');
}

// Session cookies are HttpOnly (invisible to JS — kills XSS token theft),
// Secure when served over TLS, Strict SameSite (kills CSRF from other origins).
function sessionCookieOptions(req) {
    return {
        httpOnly: true,
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSION_TTL_MS,
    };
}

// Reap expired sessions every 10 minutes so the Map doesn't grow unbounded.
const sessionReaper = setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
        const pastMax = session.createdAt && now > session.createdAt + SESSION_MAX_MS;
        if (!session.expiresAt || now > session.expiresAt || pastMax) {
            sessions.delete(token);
        }
    }
}, 10 * 60 * 1000);
sessionReaper.unref();

// ──── Dashboard access-token hashing ────
// Tokens are never stored in plaintext: only their SHA-256 hex digest goes
// into dash_users.access_token. A leaked database backup therefore can't be
// used to log in as anyone (the raw token is shown exactly once at creation).
const TOKEN_HASH_RE = /^[0-9a-f]{64}$/;

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function safeEqualHex(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    try { return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')); }
    catch { return false; }
}

// Verify a candidate token against the stored value. Rows written before the
// hashing change hold plaintext — those upgrade in place (rehash) on the
// first successful login, so the migration needs no user action.
function verifyDashToken(row, candidate) {
    if (!row || !row.access_token || !candidate) return false;
    const stored = String(row.access_token);
    if (TOKEN_HASH_RE.test(stored)) {
        return safeEqualHex(stored, hashToken(candidate));
    }
    // Legacy plaintext row — constant-length guard before timingSafeEqual.
    if (!safeEqualHex(stored, String(candidate))) return false;
    try {
        getDb().prepare('UPDATE dash_users SET access_token = ? WHERE user_id = ?').run(hashToken(candidate), row.user_id);
    } catch { /* upgrade is best-effort; verification already succeeded */ }
    return true;
}

// ──── Dashboard Config (SQLite) ────
const DEFAULT_DASHBOARD_CONFIG = {
    accentColor: '#5865F2',
    title: 'Bot Dashboard',
    backgroundImage: null,
    backgroundType: 'none',
    backgroundBlur: 'md',
    showWidgets: {
        status: true, servers: true, reminders: true, quickActions: true,
        analytics: true, activity: true, system: true,
    },
    refreshInterval: 5,
    cardStyle: 'glass',
    backgroundStyle: 'none',
    layoutDensity: 'normal',
    animationPreset: 'smooth',
    animationSpeed: 1,
    cardGlow: true,
    ambientLight: true,
    headerStyle: 'minimal',
    borderRadius: 'rounded',
    borderStrength: 'normal',
    themePreset: 'discord',
    fontFamily: 'system',
    showDockLabels: true,
    botAvatarUrl: null,
    logoUrl: null,
    faviconUrl: null,
};

function getDashboardConfig() {
    const db = getDb();
    const row = db.prepare('SELECT config FROM dash_config WHERE id = 1').get();
    if (!row) {
        // First load — use defaults
        db.prepare('INSERT OR REPLACE INTO dash_config (id, config) VALUES (1, ?)').run(JSON.stringify(DEFAULT_DASHBOARD_CONFIG));
        return { ...DEFAULT_DASHBOARD_CONFIG };
    }
    try {
        const saved = JSON.parse(row.config);
        return { ...DEFAULT_DASHBOARD_CONFIG, ...saved };
    } catch {
        return { ...DEFAULT_DASHBOARD_CONFIG };
    }
}

function updateDashboardConfig(partial) {
    const current = getDashboardConfig();
    const updated = { ...current, ...partial };
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO dash_config (id, config) VALUES (1, ?)').run(JSON.stringify(updated));
    return updated;
}

// ──── Dashboard Users (SQLite) ────
function getDashUsers() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM dash_users WHERE active = 1').all();
    const result = {};
    for (const row of rows) {
        result[row.user_id] = {
            addedAt: row.added_at,
            addedBy: row.added_by,
            active: !!row.active,
            hasToken: !!row.access_token,
        };
    }
    return result;
}

function generateAccessToken() {
    return 'dash_' + crypto.randomBytes(24).toString('base64url');
}

function addDashUser(userId, addedBy) {
    const db = getDb();
    const token = generateAccessToken();
    // Store only the hash — the raw token is returned once to be shown in Discord/UI.
    db.prepare('INSERT OR REPLACE INTO dash_users (user_id, added_at, added_by, active, access_token) VALUES (?, ?, ?, 1, ?)')
        .run(userId, Date.now(), addedBy || 'unknown', hashToken(token));
    return { users: getDashUsers(), accessToken: token };
}

function removeDashUser(userId) {
    if (!userId) return false;
    const db = getDb();
    const result = db.prepare('DELETE FROM dash_users WHERE user_id = ?').run(userId);
    const removed = result.changes > 0;
    if (!removed) return false;
    // Drop their guild scopes too
    db.prepare('DELETE FROM dash_user_guilds WHERE user_id = ?').run(userId);
    // Invalidate all active sessions for this user — clear every session type
    for (const [token, session] of sessions.entries()) {
        if (session.userId === userId) {
            sessions.delete(token);
        }
    }
    return true;
}

function isDashUser(userId, accessToken) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM dash_users WHERE user_id = ? AND active = 1').get(userId);
    if (!row) return false;
    if (accessToken) {
        return verifyDashToken(row, accessToken);
    }
    return true;
}

// ──── File Upload Setup ────
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, 'bg-' + Date.now() + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

module.exports = {
    // client + credentials
    setDashboardClient, getClient, passwordMatches,
    // rate limiting (login)
    checkRateLimit,
    // sessions
    sessions, SESSION_TTL_MS, SESSION_MAX_MS, generateSession, sessionCookieOptions,
    // dash users + access tokens
    hashToken, verifyDashToken, getDashUsers, generateAccessToken, addDashUser, removeDashUser, isDashUser,
    // dashboard config store
    getDashboardConfig, updateDashboardConfig, DEFAULT_DASHBOARD_CONFIG,
    // uploads
    upload, uploadsDir,
};
