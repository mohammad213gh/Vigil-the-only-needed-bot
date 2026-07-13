const { loadConfig, saveConfig } = require('./config');

const STATS_KEY = '_stats';

function loadStats() {
    const config = loadConfig();
    if (!config[STATS_KEY]) {
        config[STATS_KEY] = {};
        saveConfig(config);
    }
    return config[STATS_KEY];
}

function saveStats(stats) {
    const config = loadConfig();
    config[STATS_KEY] = stats;
    saveConfig(config);
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
