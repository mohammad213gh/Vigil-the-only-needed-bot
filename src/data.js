const fs = require('fs');
const path = require('path');

// ──────────────────── Data Directory Helper ────────────────────
// All runtime data files (permissions, stats, dashboard config, etc.)
// are stored in this directory. Set DATA_DIR env var to a persistent
// path outside your project to prevent data loss on redeploy.
//
// Examples:
//   DATA_DIR=/data           (Docker volume mount)
//   DATA_DIR=./data          (local project directory, default)

function getDataDir() {
    const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch (err) {
            console.error('[Data] Failed to create data directory:', err.message);
        }
    }
    return dir;
}

function getDataPath(filename) {
    return path.join(getDataDir(), filename);
}

module.exports = { getDataDir, getDataPath };
