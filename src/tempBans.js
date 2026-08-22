const { getDb } = require('./db');
const { logError } = require('./logError');

let client = null;
let sweepInterval = null;

const UNKNOWN_BAN_CODE = 10026;

function setTempBanClient(discordClient) {
    client = discordClient;
}

function sweepExpiredTempBans() {
    if (!client) return;
    const db = getDb();
    const due = db.prepare('SELECT * FROM temp_bans WHERE unban_at <= ?').all(Date.now());

    for (const tb of due) {
        const guild = client.guilds.cache.get(tb.guild_id);
        if (!guild) {
            db.prepare('DELETE FROM temp_bans WHERE user_id = ? AND guild_id = ?').run(tb.user_id, tb.guild_id);
            continue;
        }

        guild.bans.remove(tb.user_id, 'Temp ban expired')
            .then(() => {
                db.prepare('DELETE FROM temp_bans WHERE user_id = ? AND guild_id = ?').run(tb.user_id, tb.guild_id);
                console.log('[TempBan] Auto-unbanned', tb.user_id, 'in', tb.guild_id);
            })
            .catch((err) => {
                if (err && err.code === UNKNOWN_BAN_CODE) {
                    db.prepare('DELETE FROM temp_bans WHERE user_id = ? AND guild_id = ?').run(tb.user_id, tb.guild_id);
                }
                logError(err, 'tempBans', 'autoUnban');
            });
    }
}

function startTempBanSweeper() {
    if (sweepInterval) clearInterval(sweepInterval);
    sweepExpiredTempBans();
    sweepInterval = setInterval(() => {
        try {
            sweepExpiredTempBans();
        } catch (err) {
            logError(err, 'tempBans', 'sweep');
        }
    }, 30 * 1000);
}

function stopTempBanSweeper() {
    if (sweepInterval) clearInterval(sweepInterval);
    sweepInterval = null;
}

module.exports = { setTempBanClient, startTempBanSweeper, stopTempBanSweeper };
