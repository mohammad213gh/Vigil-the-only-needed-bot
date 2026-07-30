<div align="center">

# NLux Bot

**65+ Slash Commands · Full web dashboard · Complete source code · SQLite persistent · No monthly fees**

> **$39** · One-time payment · Full source code

![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

**The self-hosted Discord management bot that refuses to put features behind a paywall**

> Full logging (16 categories) · Moderation · Auto-Mod · Custom Web Dashboard · Invite Tracking · Staff Notes · Reaction Roles · Role Menus · Message Search · Advanced Polls · Reminders · Warning Thresholds · Welcome/Goodbye · Activity Insights · Temp Bans · Permission System · And more

</div>

---

## What Is This?

This is a complete Discord management bot, battle-tested in my own server. Fully self-hosted, persistent SQLite database, a full web dashboard with real-time events, and zero dependency on any third-party service.

You get the **full source code**. You host it yourself. You own every piece of it. No monthly fee.

It comes with **65+ slash commands** across moderation, auto-mod, logging, invite tracking, staff notes, message search, reaction roles, role menus, polls, reminders, fun, utility, and stats — but the real selling points are the ones you can't get from a premium bot: **your own dashboard, your own data, and no subscription.**

---

## Why?

I got tired of Discord bots locking basic features behind monthly subscriptions. Want to log who left? That's $5/month. Reaction roles? Another tier. A dashboard to manage your server? Upgrade again. Want to know who invited someone? That's premium only. Want auto-mod without paying extra? Good luck.

So I built my own. Everything my server needed, from scratch. 30+ rewrites of the dashboard alone until it felt right. One memory leak that took weeks to find and almost made me scrap the whole project.

I've been running this bot in my own server for a long time. It works. Now I'm selling the source code so others can run it too, without paying monthly for features that should just *work*.

---

## How It Compares (Honestly)

This isn't meant to compete with long-established bots like MEE6, Dyno, or Carl-bot. Those projects have years of development and teams behind them. The goal here is different: complete control, self-hosting, and no premium paywalls.

**You host it. You control it. You pay once.**

| Feature | NLux Bot | MEE6 | Dyno | Carl-bot |
|---|---|---|---|---|
| Moderation (kick/ban/timeout/warn) | ✅ Full suite | ✅ Free tier | ✅ Free tier | ✅ Free tier |
| Temp Bans (auto-unban) | ✅ Yes | ❌ | ❌ | ✅ Yes |
| Mod-Log Cases (numbered, searchable) | ✅ Yes | ❌ | ❌ | ❌ |
| **16 Logging Categories** | ✅ Yes | ✅ Free (limited) | ✅ Free (basic) | ✅ Free |
| Dynamic Channel Perms Logging | ✅ Yes | ❌ | ❌ | ❌ |
| Invite Tracking (detects exact code) | ✅ Yes | 🔒 Premium | ❌ | ❌ |
| Staff Notes (private, per-user) | ✅ Yes | ❌ | ❌ | ❌ |
| Log Search & Filtering | ✅ Yes | ❌ | ❌ | ❌ |
| Auto-Mod (5 rule types, 4 actions) | ✅ Yes | 🔒 Premium | 🔒 Premium | ✅ Free |
| Warning Thresholds (auto-punish) | ✅ Yes | ❌ | ❌ | ❌ |
| Reaction Roles | ✅ Yes | ✅ Free (limited) | ✅ Free (modules) | ✅ Free |
| Role Menus (Dropdown Select) | ✅ Yes | ❌ | ❌ | ✅ Free |
| Advanced Polls (multi/anonymous/timed) | ✅ Yes | ❌ | ❌ | ❌ |
| Reminders (DM-based, persistent) | ✅ Yes | ❌ | ❌ | ✅ Free |
| Fun Commands (12 games) | ✅ Yes | ✅ Free | ✅ Free | ❌ |
| **Web Dashboard** (full UI w/ auto-mod) | ✅ Yes | ✅ Free | 🔒 Premium | ❌ |
| Activity Insights (top users/channels) | ✅ Yes | ❌ | ❌ | ❌ |
| Growth Stats (daily + 90-day history) | ✅ Yes | ❌ | ❌ | ❌ |
| Command Usage Stats | ✅ Yes | ❌ | ❌ | ❌ |
| Customization (themes/colors/glass) | ✅ Yes | ❌ | ❌ | ❌ |
| Granular Permission System | ✅ Yes | 🔒 Premium | 🔒 Premium | 🔒 Premium |
| Audit Log Viewer (in dashboard) | ✅ Yes | ❌ | ❌ | ❌ |
| Self-Hosted (own your data) | ✅ Yes | ❌ Cloud | ❌ Cloud | ❌ Cloud |
| **One-Time Payment** | ✅ **$39** | ❌ $5–$12/mo | ❌ $5–$10/mo | ❌ $5–$10/mo |

**The honest tradeoffs:**
- **Polished UI?** MEE6 and Dyno have better docs and sleeker UIs. They've been doing this longer.
- **Features?** Premium bots have niche stuff like leveling, music, giveaways, and ticket systems built in.
- **Reliability?** Cloud bots have 99.9% uptime. This one goes down when your host goes down.
- **But** — you pay once, you own your data, you can customize everything, and you're not locked into a subscription.

---

## Commands

### Slash Commands (/) — the modern way
Type `/` and Discord shows you everything you can use. Clean, fast, and discoverable.

### Prefix Commands (;) — the classic way
Every command also works via text prefix (default `;`). Type `;help` to see the list, `;ping` to test it. Change the prefix per-server with `/prefix` or `;prefix !`.

Both systems work side-by-side. Use whatever feels natural.

### Full Command List by Category

**📋 Info (7)** — Public
`/help` `/ping` `/status` `/botinfo` `/userinfo` `/avatar` `/stats server/growth/commands`

**🎮 Fun (12)** — Public
`/8ball` `/coinflip` `/dice` `/rps` `/joke` `/fact` `/advice` `/quote` `/reverse` `/mock` `/random` `/worldcup`

**⏰ Reminders (2)** — Public
`/remindme` `/reminders list/cancel`

**🛡️ Moderation (14)** — Owner-only (grantable)
Kick (with confirm) · Ban (delete msg options + confirm) · Tempban (auto-unban) · Unban · Timeout · Untimeout · Warn (modal input or direct + auto-DM) · Warnings · Clearwarnings · Lock channel · Unlock channel · Purge (with confirm) · Slowmode · Nickname

**📜 Mod-Log Cases (3)** — Owner-only (grantable)
`/history` · `/case` · `/reason` — Full numbered case system

**📊 Admin (10)** — Owner-only (grantable)
Role add/remove/list · Say · Embed · Deploy · Track add/remove/list · Poll (multi/anonymous/timed) · Announce

**⚙️ Config (6)** — Owner-only
Log channel/toggle/list · Embedconfig footer/color/show · Presence · Botavatar · Botname · Prefix

**🔐 Permissions (4)** — Owner-only
`/perm grant/revoke/list/user` — Granular per-command access

**🔄 Reaction Roles (3)** — Owner-only
`/reactionrole add/remove/list`

**📋 Role Menus (5)** — Owner-only
`/rolemenu create/add/remove/publish/list` — Dropdown select menus

**🤖 Auto-Mod (4)** — Owner-only
`/automod config/list/filter/filters` — 5 rule types, 4 actions, import/export

**⚠️ Warning Thresholds (3)** — Owner-only
`/thresholds add/remove/list` — Auto-punish at X warnings

**👋 Welcome / Goodbye (26)** — Owner-only
Full per-field embed customization with 25+ placeholders

**📨 Invite Tracking (3)** — Owner-only (grantable)
`/invites check/top/stats`

**📝 Staff Notes (4)** — Owner-only (grantable)
`/note add/list/edit/remove`

**🔍 Log Search (1)** — Owner-only (grantable)
`/logs search` — Search by user, keyword, action type

**👑 Owner (4)** — Owner only
`/dashboard` `/dashaccess add/remove/list` `/server_leave` `/shutdown`

> 💡 Use `/perm grant @user command` to let trusted people use specific commands, or `/perm grant @user all` to grant everything at once.

> **After first deploy or any update, run `/deploy` in your server** to sync all commands.

---

## Project Statistics

```
Features
├── 65+ Slash Commands
├── 40+ Discord events logged across 16 categories
│   messages · reactions · members · roles · server (channels/perms) · voice
│   threads · bans · invites · emojis · stickers · stage · scheduled events
│   automod rules · webhooks · integrations
├── Custom auto-moderation — 5 rule types: spam, words, links, caps, mentions
│   Each with 4 action options: warn, delete, timeout, kick
├── Warning thresholds — auto punish at configurable warn counts
├── Temp bans with auto-unban (survives bot restarts)
├── Invite tracking — detects the exact invite code used per join
├── Staff notes — private per-user notes, full CRUD
├── Log search & filtering by user, keyword, action type
├── Self-assignable roles — reaction roles + dropdown role menus
├── Advanced polls — multi-vote, anonymous, timed auto-finalize
├── Reminder system — DM-based, persistent, auto-cleanup
├── Welcome/goodbye — fully customizable embeds + 25+ placeholders
├── Activity insights — top users, top channels by message count
├── Daily member growth snapshots (90 days of history)
├── Command usage stats (per-server + global)
├── Granular permission system (per-command per-user)
├── Slash + prefix command support (configurable per server)
├── Web dashboard with live stats, mod panel, audit viewer, auto-mod UI
├── Cooldown system, friendly error messages, graceful shutdown
├── SQLite persistence (no external database needed)
└── Docker + Discloud ready
```

---

## Dashboard

The dashboard is a full web interface that runs alongside your bot. It's customizable, self-hosted, and gives you control over everything without touching a terminal.

```
Dashboard
├── Overview              — Live status, uptime, memory, member count
├── Server View           — Per-server stats, prefix, role/channel browser
├── Logging               — Toggle all 16 categories, set per-category channels
├── Mod Tools             — Quick warn/kick/ban/timeout + staff notes + invites
├── Audit Log Viewer      — Browse Discord audit log with filters
├── Auto-Mod Panel        — Full rule config, word/link filters, channel/role rules
├── Welcome/Goodbye       — Visual config for every embed field
├── Customization         — Themes, colors, glassmorphism, animations, backgrounds
├── Statistics            — Growth charts, command usage, server trends
├── Activity Insights     — Top users & channels by message count
├── Commands Explorer     — Searchable command reference
├── Bot Settings          — Change name, avatar, presence live
├── Account / Sessions    — Profile, dashboard access management
└── Real-Time Events      — Live SSE feed for message deletes/edits
```

### URL Structure

```
/dashboard                    → Login / landing
/dashboard/{id}               → Server overview + Mod Tools
/dashboard/{id}/logs          → Logging configuration
/dashboard/{id}/moderation    → Mod action panel
/dashboard/{id}/audit         → Audit log viewer
/dashboard/{id}/settings      → Server & dashboard customization
/dashboard/{id}/automod       → Auto-mod configuration
/dashboard/{id}/greetings     → Welcome/goodbye config
/dashboard/admin              → Bot-wide settings & stats
```

### Screenshots

![Login Page](https://i.ibb.co/23dkJKj4/Screenshot-2026-07-16-225748.png)
*Dashboard login page*

![Dashboard Overview](https://i.ibb.co/LdYHjJ3f/Screenshot-2026-07-16-225843.png)
*Main dashboard — server overview, stats, and controls*

![Logging Output](https://i.ibb.co/PGQpDRxP/Screenshot-2026-07-16-225613.png)
*Logging panel — 16 categories of Discord events logged in real time*

---

## Under the Hood

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
  │   └── Rate-limited auth (password OR Discord token)
```

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Discord Library | Discord.js v14 |
| Web Server | Express |
| Database | SQLite (better-sqlite3) |
| File Uploads | Multer |
| Dashboard Frontend | Vanilla HTML/CSS/JS |
| Deployment | Docker · Railway · Discloud |

---

## Performance

- **SQLite** — No external database server needed. Everything lives in a single file inside your `DATA_DIR`.
- **Single process** — The bot and dashboard share one Node.js instance. No extra overhead.
- **Memory usage** — ~80–120 MB on a server with 200+ members. Tested and stable over weeks of uptime.
- **Cooldown system** — Per-command cooldowns prevent abuse and API rate limits.
- **Temp ban persistence** — Pending unbans survive bot restarts. Auto-restored on next boot.
- **Graceful shutdown** — Catches SIGTERM/SIGINT, closes database cleanly.
- **Designed for long-term hosting** — Runs for weeks on Railway, Fly.io, or a $5 VPS.

---

## Security

- **Rate-limited login** — The dashboard login endpoint is rate-limited per IP (10 attempts/min).
- **Dual auth** — Log in with a password OR your Discord ID + per-user access token.
- **Session tokens** — Cryptographically random tokens. Revoking access instantly invalidates all sessions.
- **Ephemeral commands** — Sensitive operations reply privately so only you see them.
- **Granular permission system** — Grant specific commands to specific users. No need to give out admin roles.
- **Force leave** — `/server_leave` removes the bot from any server instantly.
- **Cross-guild channel validation** — Prevents accidental cross-server log leaks.
- **No tracking** — No analytics, no telemetry, no external API calls except to Discord.

---

## Customization

**Dashboard customization includes:**
- **Themes** — Light, dark, and custom presets
- **Accent colors** — Any color for buttons, headers, highlights
- **Backgrounds** — Gradients, patterns, solids, or upload your own image
- **Glassmorphism** — Frosted glass card styles
- **Card styles** — Flat, elevated, outlined, or glass
- **Animation speed & presets** — Slow/normal/fast or disable completely
- **Rounded corners** — From sharp to fully pill-shaped
- **Layout density** — Compact, normal, or spacious
- **Card glow & ambient light** — Toggle visual effects

**Bot customization includes:**
- Change the bot's name, avatar, and presence status (dashboard + commands)
- Per-server prefix configuration
- Per-server logging categories/channels and embed colors
- Custom embed footer text and icon
- 25+ placeholders for welcome/goodbye messages

---

## What's Included

- **Full source code** (Node.js, Discord.js v14, Express, SQLite)
- **Web dashboard** (HTML/CSS/JS, self-hosted)
- **Dockerfile** for containerized deployment
- **discloud.config** for Discloud hosting
- **Free updates while the project is actively maintained**
- **Support** — DM me on Discord if something breaks

---

## Requirements

- **Node.js 20+** (required for Discord.js v14 features)
- **A Discord bot token** from the [Developer Portal](https://discord.com/developers/applications) — enable **Message Content**, **Guild Members**, **Presence Intent**, **Guild Messages**, **Guild Message Reactions**, **Voice States**, **Guild Scheduled Events**, **Guild Moderation**, and **Guild Expressions**
- **A hosting provider** — Railway (free tier works), any VPS, Fly.io, or Discloud

---

## Quick Start

```bash
# After you receive the source:
npm install

# Set up your .env file:
BOT_TOKEN=your_token
OWNER_ID=your_discord_id
DASHBOARD_PASSWORD=choose_a_password
DATA_DIR=./data
GUILD_ID=your_server_id   # optional, for instant command registration

npm start
```

Run `/deploy` in your Discord server after first launch to register all commands.

### Railway (recommended)

1. Push the code to a private GitHub repo and connect it on Railway
2. Go to **Volumes** → **Add Volume** → mount at `/data`
3. Set your env vars in Railway's dashboard:
   - `BOT_TOKEN`, `OWNER_ID`, `DASHBOARD_PASSWORD`, `DATA_DIR=/data`
4. Go to **Settings** → **Networking** → **Generate Domain** for the dashboard
5. Run `/deploy` in your server after deploy

### Docker

```bash
docker build -t discord-bot .
docker run -p 3000:3000 --env-file .env -v /host/data:/data -e DATA_DIR=/data discord-bot
```

---

## Data Persistence

Everything saves to a single SQLite database (`bot.db`) inside your `DATA_DIR`. Warnings, configs, stats, reminders, dashboard settings, poll votes, command usage, message history, activity counts, temp bans, staff notes, invite records, auto-mod rules, warning thresholds — they all survive restarts, redeploys, and crashes.

On Railway this means setting up a volume. Takes 2 minutes and you never lose data again.

---

## License & Terms

This software is distributed under a **Proprietary License**. See the [LICENSE](LICENSE) file for the full legal terms.

When you purchase NLux Bot Premium, you get:

✅ **You can:**
- Use the bot on your own Discord server(s)
- Modify the source code for your own use
- Host it anywhere you want
- Receive free updates while the project is actively maintained

❌ **You cannot:**
- Resell the source code (modified or unmodified)
- Share the source code with anyone who hasn't purchased a license
- Remove copyright notices from the source code
- Claim authorship of the original work

If you're sharing screenshots or showing the bot publicly, I'd appreciate if you mentioned **franc** or included my Discord tag **.nlux.** (ID: 1200828694088917114). No pressure — just helps people find me if they're interested too.

---

<div align="center">

**Built by franc · Discord: .nlux. (1200828694088917114)**

*One-time purchase. Full source code. No subscriptions. No upsells.*

*DM me on Discord to buy: **.nlux.** (ID: 1200828694088917114)*

</div>
