<div align="center">

# NLux Bot

**v1.0.0** ![GitHub package.json version](https://img.shields.io/github/package-json/v/mohammad213gh/Discord-bot)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue)](LICENSE)
![GitHub last commit](https://img.shields.io/github/last-commit/mohammad213gh/Discord-bot)
![GitHub repo size](https://img.shields.io/github/repo-size/mohammad213gh/Discord-bot)

**The self-hosted Discord management bot that refuses to put features behind a paywall**

> Logging · Moderation · Reaction Roles · Dashboard · Stats · Reminders · Customization

</div>

---

## Why?

I got tired of Discord bots locking basic moderation, logging, and server management features behind premium subscriptions. You know the drill—want to see who left? That's $5/month. Want reaction roles? That's another tier. Want a dashboard? Upgrade again.

Instead of paying monthly for features that should just *work*, I built everything my server needed from scratch. This is that bot—open-source, self-hosted, and free forever. No hidden tiers, no "premium only" buttons, no upsells. Run it yourself and own your data.

---

## How It Compares (Honestly)

This isn't meant to compete with long-established bots like MEE6, Dyno, or Carl-bot. Those projects have years of development behind them. The goal here is different: complete control, self-hosting, and no premium paywalls.

**You host it. You control it. You don't pay monthly.**

| Feature | NLux Bot | MEE6 | Dyno | Carl-bot |
|---|---|---|---|---|
| Moderation | ✅ Yes | ✅ Free tier | ✅ Free tier | ✅ Free tier |
| Logging | ✅ 16 categories | ✅ Free (limited) | ✅ Free (basic) | ✅ Free |
| Reaction Roles | ✅ Yes | ✅ Free (limited) | ✅ Free (modules) | ✅ Free |
| Reminders | ✅ Yes | ❌ | ❌ | ✅ Free |
| Fun Commands | ✅ Yes | ✅ Free | ✅ Free | ❌ |
| Web Dashboard | ✅ Yes | ✅ Free | 🔒 Premium | ❌ |
| Customization | ✅ Themes, colors, glass | ❌ | ❌ | ❌ |
| Prefix Commands | ✅ Yes | ❌ | ✅ Yes | ✅ Yes |
| Permission System | ✅ Yes | 🔒 Premium | 🔒 Premium | 🔒 Premium |
| Server Stats / Growth | ✅ Yes | 🔒 Premium | ❌ | ❌ |
| Self-Hosted (own your data) | ✅ Yes | ❌ Cloud | ❌ Cloud | ❌ Cloud |
| No Paywall | ✅ Yes | ❌ | ❌ | ❌ |

**The honest tradeoffs:**
- **Polished UI?** MEE6 and Dyno have better docs and sleeker UIs. They've been doing this longer.
- **Features?** Premium bots have niche stuff like leveling, music, giveaways, and ticket systems built in.
- **Reliability?** Cloud bots have 99.9% uptime. This one goes down when Railway goes down.
- **But** — I don't charge you a dime. You own your data. You can customize everything. And I built this alone for my own server, then shared it in case it helps someone else.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Commands](#commands)
- [Dashboard](#dashboard)
- [Architecture](#architecture)
- [Performance](#performance)
- [Security](#security)
- [Customization](#customization)
- [Hosting](#hosting)
- [Data Persistence](#data-persistence)
- [License](#license)
- [Found a bug?](#found-a-bug)

---

## Quick Start

### Prerequisites

1. **Node.js 20 or higher** — Required for modern Discord.js v14 features
2. **A Discord bot token** from the [Developer Portal](https://discord.com/developers/applications)<br>Make sure you enable these intents in the Bot tab: **Message Content**, **Guild Members**, and **Presence Intent**
3. **Somewhere to host it** (I recommend Railway, it's free and easy)

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
- `GUILD_ID` (optional, for instant commands)

---

## Commands

### Slash Commands (/) — the modern way
Type `/` and Discord shows you everything you can use. Clean, fast, and discoverable.

### Prefix Commands (;) — the classic way
Every command also works via text prefix (default `;`). Type `;help` to see the list, `;ping` to test it. Change the prefix per-server with `/prefix` or `;prefix !`.

Both systems work side-by-side. Use whatever feels natural.

### Anyone can use these
`/ping` `/status` `/botinfo` `/userinfo` `/avatar` `/stats server` `/stats growth` `/worldcup` `/8ball` `/coinflip` `/dice` `/rps` `/joke` `/fact` `/advice` `/quote` `/reverse` `/mock` `/random` `/remindme` `/reminders list` `/reminders cancel`

### Owner-only (unless you grant permissions)
**Logging:** `/log channel` `/log toggle` `/log list`
**Config:** `/embedconfig` `/presence` `/botavatar` `/botname`
**Moderation:** `/kick` `/ban` `/unban` `/timeout` `/untimeout` `/warn` `/warnings` `/clearwarnings` `/lock` `/unlock`
**Admin:** `/role` `/purge` `/slowmode` `/nickname` `/say` `/embed` `/deploy` `/track` `/poll` `/announce`
**Permissions:** `/perm grant` `/perm revoke` `/perm list` `/perm user`
**Reaction Roles:** `/reactionrole add` `/reactionrole remove` `/reactionrole list`
**Other:** `/dashboard` `/dashaccess` `/server_leave` `/shutdown` `/prefix`

Use `/perm grant @user command` to let trusted people use specific commands, or `/perm grant @user all` to grant everything at once.

> **After first deploy or any update, run `/deploy` in your server** to sync all commands so they show up correctly.

---

## Project Statistics

```
Features
├── 70+ Commands
├── 40 Discord events logged
├── 16 logging categories
├── Slash + Prefix support
├── Web dashboard with live stats
└── SQLite persistence (no external DB)
```

---

## Dashboard

The dashboard is a full web interface that runs alongside your bot. It's customizable, self-hosted, and gives you control over everything without touching a terminal.

```
Dashboard
├── Overview           — Live status, uptime, memory, member count
├── Logging            — Toggle 16 categories per server, set channels
├── Moderation         — Quick access to warn, kick, ban from browser
├── Audit Logs         — Browse recent events with filters
├── Customization      — Themes, colors, cards, animations
├── Statistics         — Growth charts, command usage, server trends
└── Account Settings   — Profile, tokens, session management
```

### URL Structure

```
/dashboard          → Login / landing
/dashboard/{id}     → Server overview
/dashboard/{id}/logs      → Logging config
/dashboard/{id}/moderation → Mod actions
/dashboard/{id}/audit      → Audit log viewer
/dashboard/{id}/settings   → Server customization
/dashboard/admin           → Bot-wide settings
```

---

## Architecture

```
Discord
  │
Discord.js v14
  │
┌─────────────────┐
│   Bot Process    │
│  (single thread) │
│  80–100 MB RAM   │
└─────────────────┘
  │
SQLite Database (better-sqlite3)
  │
Express Dashboard (web UI)
```

A single Node.js process handles both the Discord bot and the web dashboard. No microservices, no containers required—just one process, one database, and a flat file structure.

---

## Performance

- **SQLite** — No external database server needed. Everything lives in a single file inside your `DATA_DIR`.
- **Single process** — The bot and dashboard share one Node.js instance. No extra overhead.
- **Memory usage** — ~80–100 MB on a server with 200+ members. Tested and stable over weeks of uptime.
- **Graceful shutdown** — Catches SIGTERM/SIGINT, closes database connections cleanly, and writes pending data. No corruption on restart.
- **Designed for long-term hosting** — Runs for weeks without issues on Railway, Fly.io, or a $5 VPS.

### The Memory Leak That Almost Killed the Project

Early on, a single unremoved event listener caused memory to climb from 60 MB to 400+ MB within hours. It took ages to find, but it was one line. Almost scrapped the whole thing over it.

---

## Security

- **Rate-limited login** — The dashboard login endpoint is rate-limited per IP. Nobody can brute force your password.
- **Session tokens** — Dashboard sessions use cryptographically random tokens. Revoking a user's access immediately invalidates all their sessions.
- **Ephemeral commands** — Sensitive operations (permissions, deployment, shutdown, config) reply privately so only you see them.
- **Permission system** — Granular control over who can use which commands. No need to give out admin roles.
- **Force leave** — `/server_leave` lets you remove the bot from any server instantly.
- **No tracking** — No analytics, no telemetry, no external API calls except to Discord. Your data stays yours.

---

## Customization

The bot and dashboard are designed to look and feel the way *you* want.

**Dashboard customization includes:**
- **Themes** — Light, dark, and custom presets
- **Accent colors** — Pick any color for buttons, headers, and highlights
- **Background effects** — Gradients, patterns, or solid colors
- **Glassmorphism** — Frosted glass card styles
- **Card styles** — Flat, elevated, outlined, or glass
- **Animation speed** — Slow, normal, fast, or no animations
- **Rounded corners** — From sharp to fully pill-shaped

**Bot customization includes:**
- Change the bot's name, avatar, and presence status
- Per-server prefix configuration
- Per-server logging categories and channels

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

Everything saves to a single SQLite database (`bot.db`) inside your `DATA_DIR`. That means warnings, configs, stats, reminders, dashboard settings — they all survive redeploys as long as `DATA_DIR` is set to a persistent path.

On Railway this means setting up a volume. It takes 2 minutes and you never lose data again.

---

## Found a bug?

DM me on Discord: **.nlux.** (ID: 1200828694088917114)

---

## License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](LICENSE) file for details.

Basically: you can use, modify, and share it, but you have to keep the same license and give credit. No closed-source versions.

---

<div align="center">
Built for personal use, sharing in case it helps someone else.
</div>
