/**
 * Shared error logging utility.
 * Provides consistent error logging across the entire bot.
 * Follows the ECC error-handling principle:
 *   - Never swallow errors silently
 *   - Log full context server-side
 *   - Use structured log entries
 *
 * Usage:
 *   logError(err, 'tag')                  // Log error with context tag
 *   logError(err, 'tag', 'extra')         // Log error with tag and extra info
 *   logError(err, 'tag', null, { userId }) // Log error with structured metadata
 */

// Subscribers are notified after an error is persisted (e.g. the Discord
// alert notifier in index.js). Callbacks must never throw.
const errorListeners = [];

// Log levels in order of severity
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
// Minimum level to output to console (controlled by LOG_LEVEL env var, default 'info')
const MIN_CONSOLE_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;
// Always persist these levels to DB (cannot be disabled)
const PERSIST_LEVELS = new Set(['warn', 'error']);

function setErrorListener(fn) {
    if (typeof fn === 'function') errorListeners.push(fn);
}

function logError(err, tag = 'general', extra = '', meta = {}) {
    if (!err) return;
    logInternal('error', err, tag, extra, meta);
}

function logInternal(level, err, tag, extra, meta) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp.slice(11, 19)}] [${level.toUpperCase()}] [${tag}]`;
    const msg = err?.message || String(err);
    const stack = err?.stack;

    // Structured log entry
    const logEntry = {
        level,
        tag,
        message: msg,
        timestamp,
        ...meta,
    };

    if (extra) {
        const extraStr = typeof extra === 'object' ? JSON.stringify(extra) : extra;
        logEntry.extra = extraStr;
    }

    // Console output based on configured level
    if (LOG_LEVELS[level] >= MIN_CONSOLE_LEVEL) {
        const extraStr = logEntry.extra ? ` (${logEntry.extra})` : '';
        console[level === 'debug' ? 'log' : level](`${prefix} ${msg}${extraStr}`);
    }

    // Stack trace handling
    if (stack) {
        logEntry.stack = stack.split('\n').slice(0, 15).join('\n');
        if (LOG_LEVELS[level] >= MIN_CONSOLE_LEVEL) {
            const lines = stack.split('\n').slice(0, 3).join('\n');
            console[level === 'debug' ? 'log' : level](`${prefix} Stack: ${lines}`);
        }
    }

    // Persist to DB for warn/error levels
    if (PERSIST_LEVELS.has(level)) {
        try {
            const { recordErrorLog } = require('./db');
            recordErrorLog({
                tag,
                message: msg,
                extra: typeof extra === 'object' ? JSON.stringify(extra) : (extra || null),
                meta: Object.keys(meta).length ? JSON.stringify(meta) : null,
                stack: stack ? stack.split('\n').slice(0, 15).join('\n') : null,
                timestamp,
            });
        } catch { /* persistence must never break logging */ }
    }

    // Notify subscribers (e.g. the Discord error-alert notifier)
    if (level === 'error') {
        try {
            for (const fn of errorListeners) {
                fn({ tag, message: msg, stack: logEntry.stack || null, timestamp });
            }
        } catch { /* a bad listener must never break logging */ }
    }
}

// Convenience methods
function logDebug(message, tag = 'general', meta = {}) {
    logInternal('debug', new Error(message), tag, '', meta);
}

function logInfo(message, tag = 'general', meta = {}) {
    logInternal('info', new Error(message), tag, '', meta);
}

function logWarn(message, tag = 'general', extra = '', meta = {}) {
    logInternal('warn', new Error(message), tag, extra, meta);
}

module.exports = { logError, setErrorListener, logDebug, logInfo, logWarn, LOG_LEVELS };
