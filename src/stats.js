const { getDb } = require('./db');

// ─── Public API ───

function getGuildStats(guildId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM guild_stats WHERE guild_id = ?').get(guildId);
    const snapshots = db.prepare('SELECT * FROM stats_snapshots WHERE guild_id = ? ORDER BY date ASC').all(guildId);
    return {
        totalJoins: row?.total_joins || 0,
        totalLeaves: row?.total_leaves || 0,
        dailySnapshots: snapshots.map(s => ({ date: s.date, joins: s.joins, leaves: s.leaves })),
        lastSnapshotDate: snapshots.length > 0 ? snapshots[snapshots.length - 1].date : '',
    };
}

function recordJoin(guildId) {
    const db = getDb();

    // Upsert guild_stats
    db.prepare(`
        INSERT INTO guild_stats (guild_id, total_joins, total_leaves) VALUES (?, 1, 0)
        ON CONFLICT(guild_id) DO UPDATE SET total_joins = total_joins + 1
    `).run(guildId);

    // Update or insert daily snapshot
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
        INSERT INTO stats_snapshots (guild_id, date, joins, leaves) VALUES (?, ?, 1, 0)
        ON CONFLICT(guild_id, date) DO UPDATE SET joins = joins + 1
    `).run(guildId, today);

    // Prune old snapshots (keep last 90 days)
    db.prepare(`
        DELETE FROM stats_snapshots WHERE guild_id = ? AND date NOT IN (
            SELECT date FROM stats_snapshots WHERE guild_id = ? ORDER BY date DESC LIMIT 90
        )
    `).run(guildId, guildId);
}

function recordLeave(guildId) {
    const db = getDb();

    db.prepare(`
        INSERT INTO guild_stats (guild_id, total_joins, total_leaves) VALUES (?, 0, 1)
        ON CONFLICT(guild_id) DO UPDATE SET total_leaves = total_leaves + 1
    `).run(guildId);

    const today = new Date().toISOString().slice(0, 10);
    db.prepare(`
        INSERT INTO stats_snapshots (guild_id, date, joins, leaves) VALUES (?, ?, 0, 1)
        ON CONFLICT(guild_id, date) DO UPDATE SET leaves = leaves + 1
    `).run(guildId, today);

    db.prepare(`
        DELETE FROM stats_snapshots WHERE guild_id = ? AND date NOT IN (
            SELECT date FROM stats_snapshots WHERE guild_id = ? ORDER BY date DESC LIMIT 90
        )
    `).run(guildId, guildId);
}

function loadStats() {
    // Legacy: return the old nested format
    const db = getDb();
    const rows = db.prepare('SELECT * FROM guild_stats').all();
    const result = {};
    for (const row of rows) {
        const gs = getGuildStats(row.guild_id);
        result[row.guild_id] = gs;
    }
    return result;
}

function saveStats(stats) {
    // Legacy: accept old nested format and persist to DB
    const db = getDb();
    const upsertStats = db.prepare(`
        INSERT INTO guild_stats (guild_id, total_joins, total_leaves) VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET total_joins = excluded.total_joins, total_leaves = excluded.total_leaves
    `);
    const upsertSnap = db.prepare(`
        INSERT INTO stats_snapshots (guild_id, date, joins, leaves) VALUES (?, ?, ?, ?)
        ON CONFLICT(guild_id, date) DO UPDATE SET joins = excluded.joins, leaves = excluded.leaves
    `);
    const tx = db.transaction(() => {
        for (const [guildId, s] of Object.entries(stats)) {
            upsertStats.run(guildId, s.totalJoins || 0, s.totalLeaves || 0);
            if (s.dailySnapshots) {
                for (const snap of s.dailySnapshots) {
                    upsertSnap.run(guildId, snap.date, snap.joins || 0, snap.leaves || 0);
                }
            }
        }
    });
    tx();
}

module.exports = {
    loadStats,
    saveStats,
    getGuildStats,
    recordJoin,
    recordLeave,
};
