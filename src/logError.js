/**
 * Shared error logging utility.
 * Provides consistent error logging across the entire bot.
 *
 * Usage:
 *   logError(err, 'tag')           // Log error with context tag
 *   logError(err, 'tag', 'extra')  // Log error with tag and extra info
 */

function logError(err, tag = 'general', extra = '') {
    if (!err) return;
    const timestamp = new Date().toISOString().slice(11, 19);
    const prefix = `[${timestamp}] [${tag}]`;
    const msg = err?.message || String(err);
    const stack = err?.stack;
    if (extra) {
        console.error(`${prefix} ${msg} (${extra})`);
    } else {
        console.error(`${prefix} ${msg}`);
    }
    // Log first line of stack trace for debugging, but skip noisy internals
    if (stack && process.env.NODE_ENV !== 'production') {
        const lines = stack.split('\n').slice(0, 3).join('\n');
        console.error(`${prefix} ${lines}`);
    }
}

module.exports = { logError };
