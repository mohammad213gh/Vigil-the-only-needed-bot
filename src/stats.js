const fs = require('fs');
const { getDataPath } = require('./data');

const STATS_PATH = getDataPath('stats.json');

// ─── Migration from old config.json ───
function findConfigPath() {
    if (process.env.CONFIG_PATH) return process.env.CONFIG_PATH;
    if (fs.existsSync('./config.json')) return './config.json';
    const dataPath = getDataPath('config.json');
    if (fs.existsSync(dataPath)) return dataPath;
    return './config.json';
}

function migrateFromConfig() {
    try {
        const configPath = findConfigPath();
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config._stats && Object.keys(config._stats).length > 0) {
            fs.writeFileSync(STATS_PATH, JSON.stringify(config._stats, null, 4));
            delete config._stats;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
            console.log('[Migration] Moved stats data to data/stats.json');
        }
    } catch { /* no migration needed */ }
}

function loadStats() {
    try {
        return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    } catch {
        migrateFromConfig();
        return {};
    }
}

function saveStats(stats) {
    try {
        fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 4));
    } catch (err) {
        console.error('[Stats] Failed to save:', err.message);
    }
}

function ensureGuild(guildId) {
    const stats = loadStats();
    if (!stats[guildId]) {
        stats[guildId] = {
            totalJoins: 0,
            totalLeaves: 0,
            dailySnapshots: [],
            lastSnapshotDate: '',
        };
        saveStats(stats);
    }
    return stats[guildId];
}

function getGuildStats(guildId) {
    return ensureGuild(guildId);
}

function recordJoin(guildId) {
    const stats = loadStats();
    if (!stats[guildId]) {
        stats[guildId] = { totalJoins: 0, totalLeaves: 0, dailySnapshots: [], lastSnapshotDate: '' };
    }
    stats[guildId].totalJoins++;
    const today = new Date().toISOString().slice(0, 10);
    const snapshots = stats[guildId].dailySnapshots;
    const lastSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    if (lastSnap && lastSnap.date === today) {
        lastSnap.joins++;
    } else {
        snapshots.push({ date: today, joins: 1, leaves: 0 });
        if (snapshots.length > 90) snapshots.shift();
    }
    saveStats(stats);
}

function recordLeave(guildId) {
    const stats = loadStats();
    if (!stats[guildId]) {
        stats[guildId] = { totalJoins: 0, totalLeaves: 0, dailySnapshots: [], lastSnapshotDate: '' };
    }
    stats[guildId].totalLeaves++;
    const today = new Date().toISOString().slice(0, 10);
    const snapshots = stats[guildId].dailySnapshots;
    const lastSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
    if (lastSnap && lastSnap.date === today) {
        lastSnap.leaves++;
    } else {
        snapshots.push({ date: today, joins: 0, leaves: 1 });
        if (snapshots.length > 90) snapshots.shift();
    }
    saveStats(stats);
}

module.exports = {
    loadStats,
    saveStats,
    getGuildStats,
    recordJoin,
    recordLeave,
};
