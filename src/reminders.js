const fs = require('fs');
const path = require('path');

const REMINDERS_PATH = './reminders.json';

let client = null;
let checkInterval = null;

function setReminderClient(c) {
    client = c;
}

// ──────────────────── Data Persistence ────────────────────

function loadReminders() {
    try {
        return JSON.parse(fs.readFileSync(REMINDERS_PATH, 'utf8'));
    } catch {
        return [];
    }
}

function saveReminders(reminders) {
    try {
        fs.writeFileSync(REMINDERS_PATH, JSON.stringify(reminders, null, 4));
    } catch (err) {
        console.error('[Reminders] Failed to save:', err.message);
    }
}

// ──────────────────── Manage Reminders ────────────────────

function addReminder(userId, channelId, text, durationMs) {
    const reminders = loadReminders();
    const remindAt = Date.now() + durationMs;

    const reminder = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        userId,
        channelId,
        text,
        createdAt: Date.now(),
        remindAt,
        notified: false,
    };

    reminders.push(reminder);
    saveReminders(reminders);
    return reminder;
}

function removeReminder(reminderId, userId) {
    const reminders = loadReminders();
    const filtered = reminders.filter(r => !(r.id === reminderId && r.userId === userId));
    if (filtered.length === reminders.length) return false;
    saveReminders(filtered);
    return true;
}

function getUserReminders(userId) {
    const reminders = loadReminders();
    return reminders
        .filter(r => r.userId === userId && !r.notified)
        .sort((a, b) => a.remindAt - b.remindAt);
}

function getAllPending() {
    return loadReminders().filter(r => !r.notified);
}

// ──────────────────── Check Loop ────────────────────

function startReminderChecker() {
    if (checkInterval) clearInterval(checkInterval);

    checkInterval = setInterval(async () => {
        const reminders = loadReminders();
        const now = Date.now();
        let changed = false;

        for (const reminder of reminders) {
            if (reminder.notified) continue;
            if (reminder.remindAt <= now) {
                reminder.notified = true;
                changed = true;

                // Try to DM the user
                try {
                    const user = await client.users.fetch(reminder.userId).catch(() => null);
                    if (user) {
                        await user.send({
                            embeds: [{
                                color: 0x5865F2,
                                title: '⏰ Reminder',
                                description: reminder.text,
                                footer: { text: 'Set ' + new Date(reminder.createdAt).toLocaleString() },
                                timestamp: new Date().toISOString(),
                            }],
                        });
                    }
                } catch { /* if DMs are closed, silently fail */ }
            }
        }

        if (changed) saveReminders(reminders);

        // Prune notified reminders older than 24 hours
        const oneDayAgo = Date.now() - 86400000;
        const pruned = reminders.filter(r => !r.notified || r.remindAt > oneDayAgo);
        if (pruned.length !== reminders.length) saveReminders(pruned);
    }, 15000); // Check every 15 seconds

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
