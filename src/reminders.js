const { EmbedBuilder } = require('discord.js');
const { getDb } = require('./db');
const { logError } = require('./logError');

let client = null;
let checkInterval = null;

function setReminderClient(c) {
    client = c;
}

// ──────────────────── Manage Reminders (SQLite) ────────────────────

function addReminder(userId, channelId, text, durationMs) {
    const db = getDb();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const remindAt = Date.now() + durationMs;

    db.prepare('INSERT INTO reminders (id, user_id, channel_id, text, created_at, remind_at, notified) VALUES (?, ?, ?, ?, ?, ?, 0)')
        .run(id, userId, channelId || null, text, Date.now(), remindAt);

    return {
        id,
        userId,
        channelId,
        text,
        createdAt: Date.now(),
        remindAt,
        notified: false,
    };
}

function removeReminder(reminderId, userId) {
    const db = getDb();
    const result = db.prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?')
        .run(reminderId, userId);
    return result.changes > 0;
}

function getUserReminders(userId) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM reminders WHERE user_id = ? AND notified = 0 ORDER BY remind_at ASC')
        .all(userId);
    return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        channelId: r.channel_id,
        text: r.text,
        createdAt: r.created_at,
        remindAt: r.remind_at,
        notified: !!r.notified,
    }));
}

function getAllPending() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM reminders WHERE notified = 0 ORDER BY remind_at ASC').all();
    return rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        channelId: r.channel_id,
        text: r.text,
        createdAt: r.created_at,
        remindAt: r.remind_at,
        notified: !!r.notified,
    }));
}

// ──────────────────── Check Loop ────────────────────

function startReminderChecker() {
    if (checkInterval) clearInterval(checkInterval);

    checkInterval = setInterval(async () => {
        const db = getDb();
        const now = Date.now();

        try {
            // Find all due reminders
            const due = db.prepare('SELECT * FROM reminders WHERE notified = 0 AND remind_at <= ?').all(now);

            if (due.length === 0) return;

            const markNotified = db.prepare('UPDATE reminders SET notified = 1 WHERE id = ?');

            const tx = db.transaction(() => {
                for (const reminder of due) {
                    markNotified.run(reminder.id);
                }
            });
            tx();

            // Send DMs outside the transaction (async)
            for (const reminder of due) {
                try {
                    const user = await client.users.fetch(reminder.user_id).catch(() => null);
                    if (user) {
                        const embed = new EmbedBuilder()
                            .setColor(0x5865F2)
                            .setTitle('⏰ Reminder')
                            .setDescription(reminder.text)
                            .setFooter({ text: 'Set ' + new Date(reminder.created_at).toLocaleString() })
                            .setTimestamp();
                        await user.send({ embeds: [embed] });
                    }
                } catch {
                    /* DMs closed, skip silently */
                }
            }

            // Prune notified reminders older than 24 hours
            const oneDayAgo = Date.now() - 86400000;
            db.prepare('DELETE FROM reminders WHERE notified = 1 AND remind_at < ?').run(oneDayAgo);

        } catch (err) {
            logError(err, 'reminders', 'check');
        }
    }, 15000);

    return checkInterval;
}

function stopReminderChecker() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}

module.exports = {
    setReminderClient,
    addReminder,
    removeReminder,
    getUserReminders,
    getAllPending,
    startReminderChecker,
    stopReminderChecker,
};
