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

function logError(err, tag = 'general', extra = '', meta = {}) {
    if (!err) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp.slice(11, 19)}] [${tag}]`;
    const msg = err?.message || String(err);
    const stack = err?.stack;
    
    // Structured log entry with context
    const logEntry = {
        level: 'error',
        tag,
        message: msg,
        timestamp,
        ...meta,
    };
    
    if (extra) {
        const extraStr = typeof extra === 'object' ? JSON.stringify(extra) : extra;
        console.error(`${prefix} ${msg} (${extraStr})`);
        logEntry.extra = extraStr;
    } else {
        console.error(`${prefix} ${msg}`);
    }
    
    // Log first few lines of stack trace for debugging
    // Only print stack traces in non-production to avoid noisy logs
    if (stack) {
        logEntry.stack = stack.split('\n').slice(0, 5).join('\n');
        if (process.env.NODE_ENV !== 'production') {
            const lines = stack.split('\n').slice(0, 3).join('\n');
            console.error(`${prefix} Stack: ${lines}`);
        }
    }

    // Persist to the error_logs table so the dashboard can surface failures.
    // Lazy require + try/catch: logging must never throw, and this avoids any
    // startup-order / circular-dependency issues with the db module.
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

module.exports = { logError };
