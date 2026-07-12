const fs = require('fs');

const STATS_PATH = './stats.json';

function loadStats() {
    try {
        return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveStats(stats) {
    try {
        fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 4));
    } catch (err) {
        console.error('[Stats] Failed to save stats.json:', err.message);
    }
}

function getGuildStats(guildId) {
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
