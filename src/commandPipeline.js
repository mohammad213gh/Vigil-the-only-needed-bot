// ──────────────────── Command Pipeline ────────────────────
// The single execution path for BOTH command surfaces:
//   • slash interactions arrive straight from Discord (index.js)
//   • prefix messages arrive wrapped in an interaction shim
//     (src/prefixAdapter.js), parsed against the same deploy.js schema
// Pipeline: cooldown → owner guard → handler → usage tracking → friendly
// errors. Fixing behavior here fixes it everywhere; the two surfaces
// cannot drift apart.

const { commandRegistry, publicCommands } = require('./commands/registry');
const { ownerGuard } = require('./commands/_guard');
const { logError } = require('./logError');

// ──────────────────── Cooldown System (Persistent) ────────────────────

const DEFAULT_COOLDOWN = 3; // seconds
const COOLDOWN_OVERRIDES = {
    ping: 2,
    help: 2,
    status: 5,
    shutdown: 0,
    deploy: 30,
    purge: 5,
    say: 3,
    embed: 3,
    announce: 5,
    poll: 5,
    botname: 10,
    botavatar: 10,
    presence: 5,
};

// In-memory cache for hot cooldowns (falls back to DB)
const cooldownCache = new Map();

// `interaction` only needs { commandName, user: {id}, guild: {id} } —
// real interactions and prefix shims both qualify.
async function checkCooldown(commandName, userId, guildId) {
    const cooldownTime = (COOLDOWN_OVERRIDES[commandName] || DEFAULT_COOLDOWN) * 1000;

    if (cooldownTime <= 0) return true; // no cooldown

    const cacheKey = `${guildId}:${commandName}:${userId}`;
    const now = Date.now();

    // Check in-memory cache first
    const cached = cooldownCache.get(cacheKey);
    if (cached && now < cached.expiresAt) {
        const remaining = ((cached.expiresAt - now) / 1000).toFixed(1);
        return { remaining };
    }

    // Check database
    const { getDb } = require('./db');
    const db = getDb();
    const row = db.prepare('SELECT expires_at FROM command_cooldowns WHERE guild_id = ? AND command = ? AND user_id = ?')
        .get(guildId, commandName, userId);

    if (row && now < row.expires_at) {
        // Cache the result
        cooldownCache.set(cacheKey, { expiresAt: row.expires_at });
        const remaining = ((row.expires_at - now) / 1000).toFixed(1);
        return { remaining };
    }

    // No active cooldown — set new one
    const expiresAt = now + cooldownTime;
    db.prepare('INSERT OR REPLACE INTO command_cooldowns (guild_id, command, user_id, expires_at) VALUES (?, ?, ?, ?)')
        .run(guildId, commandName, userId, expiresAt);

    // Cache it
    cooldownCache.set(cacheKey, { expiresAt });

    // Periodic cleanup of expired cache entries
    if (cooldownCache.size > 500) {
        for (const [key, val] of cooldownCache.entries()) {
            if (val.expiresAt <= now) cooldownCache.delete(key);
        }
    }

    return true;
}

// ──────────────────── Friendly Error Messages ────────────────────

function getFriendlyError(err, commandName) {
    const msg = err.message || String(err);

    // Discord API errors
    if (msg.includes('Missing Access')) return '❌ The bot doesn\'t have access to that resource. Check permissions.';
    if (msg.includes('Missing Permissions')) return '❌ The bot doesn\'t have the required permission to do that.';
    if (msg.includes('rate limited') || msg.includes('rate limit')) return '❌ Too many requests. Please slow down.';
    if (msg.includes('Unknown User') || msg.includes('Unknown Member')) return '❌ That user was not found. They may have left the server.';
    if (msg.includes('Unknown Channel')) return '❌ That channel no longer exists.';
    if (msg.includes('Unknown Role')) return '❌ That role no longer exists.';
    if (msg.includes('Unknown Guild') || msg.includes('Unknown Server')) return '❌ That server was not found.';
    if (msg.includes('Cannot edit a message')) return '❌ Could not edit that message. It may have been deleted.';
    if (msg.includes('Target user is not a member')) return '❌ That user is not in this server.';
    if (msg.includes('Prune') || msg.includes('prune')) return '❌ Could not prune members. Check the bot\'s role position.';
    if (msg.includes('TIMEOUT') || msg.includes('timeout')) return '❌ The request timed out. Please try again.';
    if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED')) return '❌ Could not reach Discord. The bot may be reconnecting.';

    // Generic fallback — include the actual error for debugging
    console.error('[Unhandled] ' + commandName + ':', msg);
    return '❌ An error occurred while running `' + commandName + '`. The issue has been logged.';
}

// ──────────────────── Shared Dispatch ────────────────────
// Runs one command through cooldown → guard → handler → tracking → errors.
// `invoke` lets callers bypass the registry (used by the four bespoke
// prefix handlers); without it the registry is the source of handlers.
// Returns true if the command was recognized (even when blocked by
// cooldown/permission), false when unknown.

async function runCommand(interaction, invoke) {
    const commandName = interaction.commandName;

    let handler = invoke;
    if (!handler) handler = commandRegistry[commandName];
    if (!handler) return false;

    // Cooldown check
    const cooldownResult = await checkCooldown(commandName, interaction.user.id, interaction.guild.id);
    if (cooldownResult !== true) {
        await interaction.reply({
            content: '⏳ Please wait **' + cooldownResult.remaining + 's** before using `' + commandName + '` again.',
            ephemeral: true,
        });
        return true;
    }

    // Owner guard for non-public commands
    if (!publicCommands.includes(commandName) && !ownerGuard(interaction)) return true;

    try {
        await handler(interaction);
        // Track command usage (fire-and-forget)
        try {
            const { getDb } = require('./db');
            const db = getDb();
            db.prepare('INSERT INTO command_usage (guild_id, command, user_id, used_at) VALUES (?, ?, ?, ?)')
                .run(interaction.guild.id, commandName, interaction.user.id, Date.now());
        } catch {}
    } catch (err) {
        console.error('[Command Error] ' + commandName + ':', err);
        const errorMsg = getFriendlyError(err, commandName);
        const reply = interaction.deferred || interaction.replied
            ? interaction.editReply.bind(interaction)
            : interaction.reply.bind(interaction);
        reply({ content: errorMsg, ephemeral: true }).catch(e => logError(e, 'commands', 'reply_fallback'));
    }
    return true;
}

module.exports = { runCommand, checkCooldown, getFriendlyError };
