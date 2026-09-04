<div align="center">

# NLux Bot

**v1.0.0** ![Version](https://img.shields.io/badge/version-1.0.0-5865F2)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)
![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/tests-130%20passing-3ba55c)

**The self-hosted Discord management bot that refuses to put features behind a paywall**

> Full logging (16 categories) · Moderation · Temp Bans · Mod-Log Cases · Auto-Mod · Custom Web Dashboard · Invite Tracking · Staff Notes · Reaction Roles · Role Menus · Tickets · Ban Appeals · Temp Voice Channels · Message Search · Polls · Reminders · Warning Thresholds · Welcome/Goodbye · Activity Insights · Command Heatmaps · Rate-Limit Controls · And a lot more

</div>

---

## Why?

I got tired of Discord bots locking basic moderation, logging, and server management features behind premium subscriptions. You know the drill—want to see who left? That's $5/month. Want reaction roles? That's another tier. Want a dashboard? Upgrade again.

Instead of paying monthly for features that should just *work*, I built everything my server needed from scratch. This is that bot—self-hosted, source-available, and free from monthly subscriptions. No hidden tiers, no "premium only" buttons, no upsells. Run it yourself and own your data.

---

## How It Compares (Honestly)

This isn't meant to compete with long-established bots like MEE6, Dyno, or Carl-bot. Those projects have years of development behind them. The goal here is different: complete control, self-hosting, and no premium paywalls.

**You host it. You control it. You pay once.**

| Feature | NLux Bot | MEE6 | Dyno | Carl-bot |
|---|---|---|---|---|
| Moderation (kick/ban/timeout/warn) | ✅ Full suite | ✅ Free tier | ✅ Free tier | ✅ Free tier |
| Temp Bans (auto-unban) | ✅ Yes | ❌ | ❌ | ✅ Yes |
| Mod-Log Cases (numbered) | ✅ Yes | ❌ | ❌ | ❌ |
| **16 Logging Categories** | ✅ Yes | ✅ Free (limited) | ✅ Free (basic) | ✅ Free |
| Dynamic Channel Perms Logging | ✅ Yes | ❌ | ❌ | ❌ |
| Invite Tracking (per-inviter) | ✅ Yes | 🔒 Premium | ❌ | ❌ |
| Staff Notes (private per-user) | ✅ Yes | ❌ | ❌ | ❌ |
| Log Search & Filtering | ✅ Yes | ❌ | ❌ | ❌ |
| Auto-Moderation (5 rule types) | ✅ Yes | 🔒 Premium | 🔒 Premium | ✅ Free |
| Warning Thresholds (auto-punish) | ✅ Yes | ❌ | ❌ | ❌ |
| Reaction Roles | ✅ Yes | ✅ Free (limited) | ✅ Free (modules) | ✅ Free |
| Role Menus (Dropdowns) | ✅ Yes | ❌ | ❌ | ✅ Free |
| Advanced Polls (multi/anonymous/timed) | ✅ Yes | ❌ | ❌ | ❌ |
| Reminders (DM-based) | ✅ Yes | ❌ | ❌ | ✅ Free |
| Ticket System | ✅ Yes | 🔒 Premium | 🔒 Premium | ✅ Free |
| Ban Appeals (dashboard) | ✅ Yes | ❌ | ❌ | ❌ |
| Temp Voice Channels | ✅ Yes | ❌ | ❌ | ❌ |
| Fun Commands (12 games) | ✅ Yes | ✅ Free | ✅ Free | ❌ |
| **Web Dashboard** (full UI) | ✅ Yes | ✅ Free | 🔒 Premium | ❌ |
| Activity Insights (top users/channels) | ✅ Yes | ❌ | ❌ | ❌ |
| Growth Stats (daily snapshots) | ✅ Yes | ❌ | ❌ | ❌ |
| Command Usage Stats & Heatmap | ✅ Yes | ❌ | ❌ | ❌ |
| Customization (themes/colors/glass) | ✅ Yes | ❌ | ❌ | ❌ |
| Per-Server Prefix | ✅ Yes | ❌ | ✅ Yes | ✅ Yes |
| Permission System (granular) | ✅ Yes | 🔒 Premium | 🔒 Premium | 🔒 Premium |
| Audit Log Viewer (dashboard) | ✅ Yes | ❌ | ❌ | ❌ |
| Self-Hosted (own your data) | ✅ Yes | ❌ Cloud | ❌ Cloud | ❌ Cloud |
| No Paywall / No Upsells | ✅ Yes | ❌ | ❌ | ❌ |

**The honest tradeoffs:**
- **Polished UI?** MEE6 and Dyno have better docs and sleeker UIs. They've been doing this longer.
- **Features?** Premium bots have niche stuff like leveling, music, giveaways, and calendar events built in. This bot doesn't do music, economy, or leveling at all.
- **Reliability?** Cloud bots have 99.9% uptime. This one goes down when your host goes down, and it's a single Node.js process — a bad deploy is a full outage.
- **Maintainability?** It's a solo project that grew fast. The command layer is ~2,000 lines, the dashboard server ~3,300, and large parts of the frontend are still written in legacy style (see [Current State](#current-state-honest)).
- **But** — you pay once, not every month. You own your data. You can customize everything. And I built this alone for my own server.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Commands](#commands)
- [Dashboard](#dashboard)
- [Architecture](#architecture)
- [Engineering & CI](#engineering--ci)
- [Testing](#testing)
- [Performance](#performance)
- [Security](#security)
- [Current State (Honest)](#current-state-honest)
- [Customization](#customization)
- [Hosting](#hosting)
- [Data Persistence](#data-persistence)
- [License](#license)
- [Found a bug?](#found-a-bug)

---

## Quick Start

### Prerequisites

1. **Node.js 20 or higher** — Required for modern Discord.js v14 features. A `.nvmrc` and `"engines": ">=20"` are pinned so local, CI, and Docker all agree.
2. **A Discord bot token** from the [Developer Portal](https://discord.com/developers/applications)<br>Make sure you enable these intents in the Bot tab: **Message Content**, **Guild Members**, **Presence Intent**, **Guild Messages**, **Guild Message Reactions**, **Voice States**, **Guild Scheduled Events**, **Guild Moderation**, **Guild Expressions**
3. **Somewhere to host it** (Railway, Fly.io, a $5 VPS, or Docker)

### Local Testing

```bash
git clone <your-repo-url>
cd discord-bot
npm install
cp .env.example .env
```

Open `.env` and fill in your token, user ID, and dashboard password. Then:

```bash
npm start
```

### Railway (what I use)

Railway doesn't use .env files — you add variables in their dashboard. Skip the `.env` step and add them here instead:

Go to your Railway project → **Variables** tab → add:
- `BOT_TOKEN`
- `OWNER_ID`
- `DASHBOARD_PASSWORD`
- `DATA_DIR` = `/data` (after setting up a volume)
- `GUILD_ID` (optional, for instant command registration)

---

## Commands

### Slash Commands (/) — the modern way
Type `/` and Discord shows you everything you can use. Clean, fast, and discoverable.

### Prefix Commands (;) — the classic way
Every command also works via text prefix (default `;`). Type `;help` to see the list, `;ping` to test it. Change the prefix per-server with `/prefix` or `;prefix !`.

Both systems work side-by-side. Use whatever feels natural.

### Full Command List by Category

**📋 Info** — Public
`/help` `/ping` `/status` `/botinfo` `/userinfo` `/avatar` `/stats server` `/stats growth` `/stats commands`

**🎮 Fun** — Public
`/8ball` `/coinflip` `/dice` `/rps` `/joke` `/fact` `/advice` `/quote` `/reverse` `/mock` `/random` `/worldcup`

**⏰ Reminders** — Public
`/remindme` `/reminders list` `/reminders cancel`

**🛡️ Moderation** — Owner-only (grantable)
`/kick` (with confirm dialog) · `/ban` (with delete-message options + confirm) · `/tempban` (auto-unban after duration) · `/unban` · `/timeout` · `/untimeout` · `/warn` (with modal input or direct reason + DM) · `/warnings` · `/clearwarnings` · `/lock` · `/unlock` · `/purge` (with confirm dialog) · `/slowmode` · `/nickname`

**📜 Mod-Log (Cases)** — Owner-only (grantable)
`/history` — View full moderation history for any user<br>
`/case` — View specific case details<br>
`/reason` — Update the reason on any existing case<br>

**📊 Admin** — Owner-only (grantable)
`/role add` `/role remove` `/role list` · `/say` · `/embed` · `/deploy` · `/track add` `/track remove` `/track list` · `/poll` (multi-vote/anonymous/timed) · `/announce`

**⚙️ Config** — Owner-only
`/log channel` `/log toggle` `/log list` · `/embedconfig footer` `/embedconfig color` `/embedconfig show` · `/presence` · `/botavatar` · `/botname` · `/prefix`

**🔐 Permissions** — Owner-only
`/perm grant` `/perm revoke` `/perm list` `/perm user`

**🔄 Reaction Roles** — Owner-only
`/reactionrole add` `/reactionrole remove` `/reactionrole list`

**📋 Role Menus** — Owner-only
`/rolemenu create` `/rolemenu add` `/rolemenu remove` `/rolemenu publish` `/rolemenu list`

**🤖 Auto-Mod** — Owner-only
`/automod config` `/automod list` `/automod filter` `/automod filters` (import/export)

**⚠️ Warning Thresholds** — Owner-only
`/thresholds add` `/thresholds remove` `/thresholds list` (auto-punish at X warns)

**👋 Welcome / Goodbye** — Owner-only
`/welcome channel` `/welcome toggle` `/welcome message` `/welcome title` `/welcome description` `/welcome color` `/welcome footer` `/welcome thumbnail` `/welcome image` `/welcome author` `/welcome show` `/welcome test` `/welcome reset`
`/goodbye channel` `/goodbye toggle` `/goodbye message` `/goodbye title` `/goodbye description` `/goodbye color` `/goodbye footer` `/goodbye thumbnail` `/goodbye image` `/goodbye author` `/goodbye show` `/goodbye test` `/goodbye reset`

**📨 Invite Tracking** — Owner-only (grantable)
`/invites check` `/invites top` `/invites stats`

**📝 Staff Notes** — Owner-only (grantable)
`/note add` `/note list` `/note edit` `/note remove`

**🔍 Log Search** — Owner-only (grantable)
`/logs search` — Search deleted/edited messages by user, keyword, or action type

**👑 Owner** — Owner only
`/dashboard` `/dashaccess add` `/dashaccess remove` `/dashaccess list` `/server_leave` `/shutdown`

> 💡 Use `/perm grant @user command` to let trusted people use specific commands, or `/perm grant @user all` to grant everything at once.

> **After first deploy or any update, run `/deploy` in your server** to sync all commands so they show up correctly.

---

## Project Statistics

```
Features
├── 68+ Slash Commands (+ full prefix equivalents)
├── 40+ Discord events logged across 16 categories
├── Full logging: messages, reactions, members, roles, server (channels/perms),
│   voice, threads, bans, invites, emojis, stickers, stage, scheduled events,
│   automod rules, webhooks, integrations
├── Custom auto-moderation (spam, words, links, caps, mentions — 4 actions each)
├── Warning thresholds (auto-timeout/kick/ban at X warns)
├── Temp bans with auto-unban (persistent across restarts)
├── Invite tracking (detects exact invite code used per join)
├── Staff notes (private per-user, full CRUD)
├── Log/message search & filtering
├── Self-assignable roles (reaction roles + dropdown role menus)
├── Advanced polls (multi-vote, anonymous, timed with auto-finalize)
├── Reminder system (DM-based, persistent, auto-prune)
├── Welcome/goodbye messages (fully customizable embeds + placeholders)
├── Ticket system (panels, types, custom questions, transcripts, claiming)
├── Ban appeals (users appeal a ban; you review + resolve from the dashboard)
├── Temp voice channels (auto-create/rename/delete per user)
├── Activity insights (top users, top channels by message count)
├── Daily member growth snapshots (90-day history)
├── Command usage stats (per-server + global) + per-command heatmap
├── Server comparison + rate-limit controls + webhook/API-token management
├── Granular permission system (per-command per-user)
├── Slash + Prefix command support (configurable prefix)
├── Web dashboard with live stats, mod panel, audit viewer, & more
├── MySQL-free — SQLite persistence (no external database)
└── Docker + discloud ready
```

---

## Dashboard

The dashboard is a full web interface that runs alongside your bot. It's a single-page app (one URL, no page reloads) served by the same Express process as the bot. Everything below is configurable from the UI — no terminal required.

```
Dashboard (single page at /, sections switch in-place)
├── Overview          — Live status, uptime, memory, member count, server list
├── Analytics         — Growth charts, aggregate stats, server comparison
├── Servers           — Per-server stats, prefix, role/channel browser, notes,
│                       mod tools, logging, audit log, greetings, settings
├── Audit Log         — Browse recent Discord audit log entries
├── Moderation        — Quick warn/kick/ban/timeout + member profile lookup
├── Activity          — Live member join/leave feed
├── Insights          — Top users & channels by message count
├── Invites           — Per-inviter stats
├── Giveaways         — Create/end/reroll giveaways
├── Auto-Mod          — Rule config, word/link filters, channel/role scoping, import/export
├── Tickets           — Panels, types, questions, transcripts, claim system
├── Commands          — Browse all commands with usage info
├── Reminders         — View/cancel pending reminders
├── Ban Appeals       — Review, approve, or deny ban appeals
├── Temp Voice        — Channel name templates, triggers, cleanup
├── Warning Thresholds— Auto-punish rules
├── Prefix Commands   — Per-server prefix + command config
├── Rate Limits       — Per-command cooldown controls
├── Webhooks & API Tokens — Manage webhooks and scoped API tokens
├── Bot Activity      — Presence status, bot name/avatar
├── Command Heatmap   — Usage by command × time
├── Errors            — Live error log with filters, stack toggles, clear
├── System            — Host stats, backups (create/download/restore), error alert
└── Customize         — Themes, accent colors, glassmorphism, animations,
                        backgrounds, look switcher, branding, layout density
```

There's also a **command palette** (Ctrl+K), **message search**, **real-time SSE events** (message deletes/edits/toasts), **keyboard shortcuts**, and a **responsive mobile layout**.

### URL Structure

```
/            → The dashboard (login-gated single page)
/login       → Login screen
/health      → Health check (for uptime monitors)
/metrics     → Basic metrics endpoint
/static/...  → Static assets (the frontend modules live under /static/parts/)
/api/*       → JSON API backing the whole UI
```

---

## Architecture

```
Discord
  │
Discord.js v14 (9 intents, 4 partials)
  │
┌──────────────────────────────┐
│      Bot Process             │
│   (single-threaded Node.js)  │
│   80–120 MB RAM (typical)    │
│   Cooldown system            │
│   Friendly error handling    │
│   Graceful shutdown (SIG*)   │
└──────────────────────────────┘
  │
SQLite Database (better-sqlite3)
  │   └── bot.db stores everything
  │
Express Dashboard (web UI)
  │   └── SSE real-time events
  │   └── Multer file uploads
  │   └── Rate-limited auth
```

A single Node.js process handles both the Discord bot and the web dashboard. No microservices, no containers required—just one process, one database, and a flat file structure.

**The frontend is real ES modules** — the old 4,146-line single-file dashboard was split into 10 ordered modules under `src/dashboard/parts/` with explicit `export`/`import` boundaries. `00-entry.mjs` imports every part in order and attaches a small **window bridge** for the inline `onclick="..."` handlers in the HTML (module scope isn't the global scope). This was a mechanical conversion: every cross-part reference is now an explicit import, the module graph is verified acyclic, and the boot sequence is executed in CI (see [Testing](#testing)).

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (pinned via `.nvmrc` + `engines`) |
| Discord Library | Discord.js v14 |
| Web Server | Express |
| Database | SQLite (better-sqlite3) |
| File Uploads | Multer |
| Dashboard Frontend | Vanilla HTML/CSS/JS — ES modules, no framework |
| CI | GitHub Actions (lint + tests on Node 20 and 22) |
| Linting | ESLint 10 (flat config) |
| Testing | node:test + jsdom |
| Deployment | Docker · Railway · Discloud |

---

## Engineering & CI

Every push to `main` and every pull request runs, on **both Node 20 and Node 22**:

1. **ESLint** — errors for real bugs (`no-undef`, `no-redeclare`, `no-const-assign`), warnings for style. This has caught live bugs before they shipped: dashboard routes referencing unimported functions (they would have 500'd), an unimported `logWarn`, and a poll-voters crash past 15 voters.
2. **The full test suite** — 130 tests.

Tooling that keeps the project honest:

- `scripts/analyze-modules.mjs` — scope-aware analyzer for the dashboard frontend: strict-mode parse gate, cross-part references, import-graph cycles, implicit-global writes, and the inline-handler inventory (everything an `onclick` calls must resolve to exactly one module).
- `scripts/convert-modules.mjs` — the one-shot converter that produced the module split (kept for reference; parts are now edited directly).

---

## Testing

130 automated tests across the core systems:

| Area | Coverage |
|---|---|
| Database | Migration, queries, **retention pruning** (see Data Persistence), backups |
| Moderation | Ban appeals, tickets, cases, permissions, automod rules |
| Commands | Prefix command dispatcher + permission gating |
| Dashboard (server) | Auth, routes, tenant scoping |
| Dashboard (frontend) | Every module parses as ES module; graph has no cycles/unresolved names; **the real module graph boots end-to-end in a DOM** (jsdom) with no uncaught errors |

**What tests do NOT cover (yet):** no browser-level end-to-end clicks, and the two biggest server files (`src/dashboard.js`, `src/interactions.js`) still have large untested surfaces. The boot test executes the real frontend code, but it runs in jsdom with stubbed network — not a real browser against a live server. Don't mistake green CI for a guarantee that a new feature *works*; it's a guarantee that it doesn't obviously crash.

---

## Performance

- **SQLite** — No external database server needed. Everything lives in a single file inside your `DATA_DIR`.
- **Single process** — The bot and dashboard share one Node.js instance. No extra overhead.
- **Memory usage** — ~80–120 MB on a server with 200+ members. Tested and stable over weeks of uptime.
- **Bounded caches** — Auto-mod spam tracking, prefix cache, and permission lookups are size/TTL-capped instead of growing forever.
- **Database retention** — Three unbounded tables are pruned daily: command usage older than 180 days, member activity not seen in 180 days, and ticket messages from tickets closed over a year ago (transcripts are snapshotted at close, so nothing is lost). Invite records are kept indefinitely because stats are computed straight off them.
- **Cooldown system** — Per-command cooldowns prevent abuse and API rate limits.
- **Graceful shutdown** — Catches SIGTERM/SIGINT, closes database connections cleanly, writes pending data, and schedules temp-ban restores on next boot.
- **Temp ban persistence** — Pending unban timers survive bot restarts. On boot, they're restored and re-scheduled.
- **Designed for long-term hosting** — Runs for weeks without issues on Railway, Fly.io, or a $5 VPS.

### The Memory Leak That Almost Killed the Project

Early on, a single unremoved event listener caused memory to climb from 60 MB to 400+ MB within hours. It took ages to find, but it was one line. Almost scrapped the whole thing over it.

---

## Security

- **Rate-limited login** — The dashboard login endpoint is rate-limited per IP (10 attempts/minute). Nobody can brute force your password.
- **Dual auth** — Log in with a password OR your Discord ID + a per-user access token (manageable via `/dashaccess`).
- **Constant-time password comparison** — No naive `===` on the auth secret.
- **Fail-closed tenant scoping** — Server-scoped dashboard routes verify ownership before returning data; cross-server leaks are designed out, not hoped away.
- **Parameterized SQL everywhere** — No string-built queries against the database.
- **Session tokens** — Dashboard sessions use cryptographically random tokens. Revoking a user's access immediately invalidates all their sessions.
- **Ephemeral commands** — Sensitive operations (permissions, deployment, shutdown, config) reply privately so only you see them.
- **Permission system** — Granular control over who can use which commands. No need to give out admin roles.
- **Force leave** — `/server_leave` lets you remove the bot from any server instantly.
- **Cross-guild channel validation** — Logging verifies the target channel belongs to the same guild before sending, preventing cross-server leaks.
- **No tracking** — No analytics, no telemetry, no external API calls except to Discord. Your data stays yours.

**Honest limits:** the primary dashboard auth is a single shared password from an env var (plus per-user tokens for secondary users); sessions live in memory and are dropped on restart; there's no per-user rate limiting beyond login. Good enough for a self-hosted server — not enterprise auth.

---

## Current State (Honest)

This is the part nobody writes in a README, so here it is:

- **It works, and it's yours.** Everything in this README is running on at least two real servers.
- **The codebase is a solo project that grew fast.** `src/dashboard.js` (~3,300 lines) and `src/interactions.js` (~1,100) are still big single files. The dashboard frontend was recently split into ES modules, but the code *inside* those modules is still legacy style — `var`, single-letter names, enormous string-built HTML. It's navigable now, not yet clean.
- **The test suite is a safety net, not a proof.** 130 tests cover the critical paths and the frontend boots cleanly in jsdom, but there's no real-browser e2e coverage and no click-through automation. A bug that only shows in a real browser can still ship (the dashboard routes that referenced unimported functions were found by static analysis — after months in production).
- **Version 1.0.0 means "it runs," not "it's done."** No leveling, no music, no economy. Tickets and ban appeals work but could be deeper (no ticket priority/scheduling, appeals are dashboard-only).
- **You are the SLA.** Uptime, backups, and security are your responsibility. The bot restarts on deploy; sessions and caches reset; anything not in SQLite is gone.

If that sounds like a fair trade for owning everything and paying nothing monthly — welcome.

---

## Customization

The bot and dashboard are designed to look and feel the way *you* want.

**Dashboard customization includes:**
- **Themes** — Light, dark, and custom presets
- **Accent colors** — Pick any color for buttons, headers, and highlights
- **Background effects** — Gradients, patterns, solid colors, or upload your own image (jpg/png/gif/webp)
- **Glassmorphism** — Frosted glass card styles
- **Card styles** — Flat, elevated, outlined, or glass
- **Animation speed & presets** — Slow/normal/fast, or complete disable
- **Rounded corners** — From sharp to fully pill-shaped
- **Layout density** — Compact, normal, or spacious
- **Look switcher** — Neo (modern), Classic, and Minimal layouts
- **Header style** — Minimal or full
- **Widget visibility** — Show/hide individual dashboard panels
- **Card glow & ambient light** — Toggle visual effects

**Bot customization includes:**
- Change the bot's name, avatar, and presence status (from dashboard or commands)
- Per-server prefix configuration
- Per-server logging categories, channels, and embed colors
- Custom embed footer text and icon
- 25+ placeholder variables for welcome/goodbye messages

### Why It Looks the Way It Does

I like things minimal and clean, so I built the dashboard around my own vision. Rewrote it from scratch over 30 times until it felt right. What you see now is the result of not settling.

---

## Hosting

### Railway (what I use)
1. Push to GitHub and connect the repo on Railway
2. Go to **Volumes** → **Add Volume** → mount at `/data`
3. Set your env vars: `BOT_TOKEN`, `OWNER_ID`, `DASHBOARD_PASSWORD`, `DATA_DIR=/data`
4. Go to **Settings** → **Networking** → **Generate Domain** for the dashboard
5. **After deploying, run `/deploy` in your Discord server** to register all commands so they show up correctly

> ⚠️ **Every time you update your bot** (add new commands, change permissions, etc.), run `/deploy` again to sync the changes. Skip this and commands might not work.

### Docker
```bash
docker build -t discord-bot .
docker run -p 3000:3000 --env-file .env -v /host/data:/data -e DATA_DIR=/data discord-bot
```

### Fly.io or Discloud
Should work fine. Just set the env vars and make sure `DATA_DIR` points to persistent storage.

---

## Data Persistence

Everything saves to a single SQLite database (`bot.db`) inside your `DATA_DIR`. Warnings, configs, stats, reminders, dashboard settings, poll votes, command usage, message history, activity counts, temp bans, staff notes, invite records, auto-mod rules, warning thresholds, tickets, ban appeals, rate limits — they all survive restarts, redeploys, and crashes as long as `DATA_DIR` points to persistent storage.

On Railway this means setting up a volume. It takes 2 minutes and you never lose data again.

A daily retention sweeper keeps the unbounded tables in check (see [Performance](#performance)). Backups are one click in the dashboard (System → Backups), with integrity checks on restore.

---

## Found a bug?

DM me on Discord: **.nlux.** (ID: 1200828694088917114)

---

## License

This project is distributed under a **Proprietary License**. All rights reserved.

See the [LICENSE](LICENSE) file for the full terms and conditions. In short:

- ✅ You can use the bot on your own Discord server(s)
- ✅ You can modify the source code for your own use
- ❌ You cannot share the source code with anyone who hasn't purchased a license
- ❌ You cannot resell the source code (modified or unmodified)
- ❌ You cannot claim authorship of the original work

Unauthorized copying, distribution, or use of this software is strictly prohibited.

---

<div align="center">
Built by franc · Discord: .nlux. (1200828694088917114)
</div>