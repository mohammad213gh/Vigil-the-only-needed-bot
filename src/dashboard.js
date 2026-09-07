// ──────────────────── Dashboard (entry) ────────────────────
// The 3,300-line monolith lives on as src/dashboard-backend/ — same split
// convention as the frontend's src/dashboard/parts/*.mjs modules:
//
//   core.js                      shared state (client, sessions, stores, uploads)
//   parts/02-auth.js             sessions, rate limits, login, guards, tenant scoping
//   parts/03-dash-admin.js       dash users, uploads, dash config, bot customization
//   parts/04-servers.js          server list/settings/roles/channels/webhooks/members
//   parts/05-moderation.js       mod actions, notes, thresholds, appeals, audit log
//   parts/06-engagement.js       reaction roles, role menus, reminders, giveaways, polls
//   parts/07-voice.js            voice presence, temp voice
//   parts/08-automod.js          auto-moderation
//   parts/09-tickets.js          ticket panels & types
//   parts/10-insights.js         SSE events, analytics, stats, system, commands
//   parts/11-ops.js              tokens, backups, export/import, health, frontend shell
//
// Backend modules deliberately live OUTSIDE src/dashboard/: that directory
// is served publicly at /static, so server code must not sit under it.
//
// Route registration order is preserved exactly; see dashboard-backend/index.js.

module.exports = require('./dashboard-backend');
