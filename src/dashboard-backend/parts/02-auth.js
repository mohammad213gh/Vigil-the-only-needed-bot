// ──────────────────── Part 02: Auth & middleware ────────────────────
// Session resolution, the global API rate limiter, login/logout/branding,
// and every access guard (requireAuth/requireOwner/checkOwner) plus the
// fail-closed tenant scoping that all later parts consume via ctx.

const {
    passwordMatches, checkRateLimit,
    sessions, SESSION_TTL_MS, SESSION_MAX_MS, generateSession, sessionCookieOptions,
    getDashUsers, isDashUser,
} = require('../core');

// ── Auth (password OR Discord ID + Access Token) ──
function register(app, ctx) {
    // Session middleware — resolves the cookie into req.authenticated and
    // re-verifies Discord sessions against dash_users on every request.
    app.use((req, res, next) => {
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (token && sessions.has(token)) {
            const session = sessions.get(token);
            // Expired session (idle TTL or absolute max) — drop and treat as unauthenticated
            const pastMax = session.createdAt && Date.now() > session.createdAt + SESSION_MAX_MS;
            if (!session.expiresAt || Date.now() > session.expiresAt || pastMax) {
                sessions.delete(token);
                req.authenticated = false;
                return next();
            }
            // Re-verify Discord-logged-in users against the dash_users table
            if (session.method === 'discord' && session.userId) {
                if (!isDashUser(session.userId, session.accessToken)) {
                    sessions.delete(token);
                    req.authenticated = false;
                    return next();
                }
            }
            // Sliding renewal — reset the expiry on every authenticated request
            session.expiresAt = Date.now() + SESSION_TTL_MS;
            req.discordUserId = session.userId || null;
            req.sessionMethod = session.method;
            req.authenticated = true;
        } else {
            req.authenticated = false;
        }
        next();
    });

    // ── Global API Rate Limiter (applies to all authenticated endpoints) ──
    const apiLimiter = new Map();
    const API_LIMIT_WINDOW = 60 * 1000; // 1 minute
    const API_LIMIT_MAX = 120; // 120 requests per minute per IP

    function checkApiRateLimit(ip) {
        const now = Date.now();
        let entry = apiLimiter.get(ip);
        if (!entry || now - entry.windowStart > API_LIMIT_WINDOW) {
            entry = { count: 1, windowStart: now };
            apiLimiter.set(ip, entry);
            return { allowed: true, remaining: API_LIMIT_MAX - 1 };
        }
        entry.count++;
        if (entry.count > API_LIMIT_MAX) {
            return { allowed: false, remaining: 0 };
        }
        return { allowed: true, remaining: API_LIMIT_MAX - entry.count };
    }

    // Clean up old entries every 5 minutes
    const apiLimiterReaper = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of apiLimiter.entries()) {
            if (now - entry.windowStart > API_LIMIT_WINDOW * 2) {
                apiLimiter.delete(ip);
            }
        }
    }, 5 * 60 * 1000);
    apiLimiterReaper.unref();

    // Apply rate limiting to all /api/ routes except login, branding, health
    app.use('/api/', (req, res, next) => {
        const exempt = ['/api/login', '/api/branding', '/api/logout'];
        if (exempt.includes(req.path)) return next();

        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const rateCheck = checkApiRateLimit(ip);
        if (!rateCheck.allowed) {
            console.warn('[Dashboard] API rate limit hit for IP:', ip);
            return res.status(429).json({ success: false, error: 'Too many requests. Please slow down.' });
        }
        res.setHeader('X-RateLimit-Limit', API_LIMIT_MAX);
        res.setHeader('X-RateLimit-Remaining', rateCheck.remaining);
        next();
    });

    app.post('/api/login', (req, res) => {
        // Rate limiting by IP
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const rateCheck = checkRateLimit(ip);
        if (!rateCheck.allowed) {
            console.warn('[Dashboard] Rate limit hit for IP:', ip);
            return res.status(429).json({ success: false, error: 'Too many attempts. Please wait a minute.' });
        }
        const { password, discordId, accessToken } = req.body;
        const now = Date.now();
        const expiresAt = now + SESSION_TTL_MS;
        if (password && passwordMatches(password)) {
            const token = generateSession();
            sessions.set(token, { method: 'password', expiresAt, createdAt: now });
            res.cookie('session', token, sessionCookieOptions(req));
            return res.json({ success: true });
        }
        if (discordId && accessToken) {
            // Check if user exists but has no access token (legacy user)
            const users = getDashUsers();
            const existing = users[discordId];
            if (existing && existing.active && !existing.hasToken) {
                return res.status(401).json({ success: false, error: 'This user needs a new access token. Run /dashaccess remove ' + discordId + ' then /dashaccess add @user again.' });
            }
            if (isDashUser(discordId, accessToken)) {
                const token = generateSession();
                sessions.set(token, { method: 'discord', userId: discordId, accessToken, expiresAt, createdAt: now });
                res.cookie('session', token, sessionCookieOptions(req));
                return res.json({ success: true, method: 'discord' });
            }
        }
        res.status(401).json({ success: false, error: 'Invalid credentials' });
    });

    app.post('/api/logout', (req, res) => {
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (token) sessions.delete(token);
        res.clearCookie('session', { path: '/' });
        res.json({ success: true });
    });

    // Public branding — safe subset, no auth needed (login page uses it).
    app.get('/api/branding', (req, res) => {
        const { getDashboardConfig } = require('../core');
        const c = getDashboardConfig();
        res.json({
            title: c.title || 'Vigil',
            accentColor: c.accentColor || '#5865F2',
            logoUrl: c.logoUrl || null,
            faviconUrl: c.faviconUrl || null,
        });
    });

    function requireAuth(req, res, next) {
        if (!req.authenticated) return res.status(401).json({ error: 'Not authenticated' });
        next();
    }

    function checkOwner(req, _res) {
        // For password-authenticated sessions, allow mod actions
        // For Discord-authenticated sessions, check if the user is the bot owner
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (!token || !sessions.has(token)) return false;
        const session = sessions.get(token);
        if (session.method === 'password') return true; // password = full access
        if (session.method === 'discord' && session.userId === process.env.OWNER_ID) return true;
        return false;
    }

    function getSessionUser(req) {
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        if (!token || !sessions.has(token)) return 'unknown';
        const session = sessions.get(token);
        return session.userId || process.env.OWNER_ID || 'dashboard';
    }

    // ── Tenant scoping ──
    // Password sessions and the OWNER_ID discord session see every server.
    // Any other dash user only sees servers explicitly granted to them in
    // dash_user_guilds. Fail-closed: unknown sessions are treated as scoped
    // with zero grants.
    function getScopedGuildIds(req) {
        if (checkOwner(req)) return null;
        const token = req.headers.cookie?.match(/session=([^;]+)/)?.[1];
        const session = token ? sessions.get(token) : null;
        if (!session || session.method !== 'discord' || !session.userId) return new Set();
        const db = require('../../db').getDb();
        return new Set(db.prepare('SELECT guild_id FROM dash_user_guilds WHERE user_id = ?')
            .all(session.userId).map(r => r.guild_id));
    }

    function canAccessGuild(req, guildId) {
        if (!guildId) return false;
        const scoped = getScopedGuildIds(req);
        if (scoped === null) return true;
        return scoped.has(String(guildId));
    }

    function filterByScope(req, rows, key) {
        const scoped = getScopedGuildIds(req);
        if (scoped === null) return rows;
        return rows.filter(r => scoped.has(String(r[key])));
    }

    function requireOwner(req, res, next) {
        if (!checkOwner(req)) return res.status(403).json({ error: 'Only the bot owner can do that' });
        next();
    }

    // Tenant guard — covers EVERY /api/server/:id/* route in one place so a
    // new route can never accidentally skip the scope check. Must run before
    // any server route from the later parts registers.
    app.use((req, res, next) => {
        const m = req.path.match(/^\/api\/server\/([^/]+)/);
        if (m && !canAccessGuild(req, m[1])) {
            return res.status(403).json({ error: 'You do not have access to this server' });
        }
        next();
    });

    // Share the guards with the later parts
    ctx.requireAuth = requireAuth;
    ctx.requireOwner = requireOwner;
    ctx.checkOwner = checkOwner;
    ctx.getSessionUser = getSessionUser;
    ctx.getScopedGuildIds = getScopedGuildIds;
    ctx.canAccessGuild = canAccessGuild;
    ctx.filterByScope = filterByScope;
}

module.exports = { register };
