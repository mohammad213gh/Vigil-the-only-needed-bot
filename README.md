<div align="center">

# 🤖 Discord Bot

**A server management bot with comprehensive logging, moderation, web dashboard, and data persistence**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-5865F2.svg)](https://discord.js.org)

</div>

---

## ✨ Features

### 📊 Web Dashboard
- **Real-time monitoring** — Live bot status, server metrics, and system resources
- **macOS-style Dock** — Intuitive bottom navigation with icon magnification
- **Server Management** — Browse servers, manage roles, channels, and logging config
- **Customizable UI** — 12 themes, accent colors, 5 background engines, card styles, animation presets
- **Access Control** — Password + Discord ID + token authentication with rate limiting
- **Export Data** — Download growth analytics as JSON

### 📝 Advanced Logging
- **16 categories** — Messages, Reactions, Members, Roles, Server, Voice, Threads, Emojis, Bans, Invites, Stickers, AutoMod, Scheduled Events, Stage, Webhooks, Integrations
- **Per-category channels** — Route different log types to different channels
- **Toggle system** — Enable/disable categories on the fly
- **Channel tracking** — Filter logs to specific channels only
- **Rich embed format** — Beautiful, color-coded event messages with audit log attribution

### 🛡️ Moderation Suite
- **Kick / Ban / Unban** — Full member removal toolkit
- **Timeout / Untimeout** — Temporary and permanent mute
- **Warn System** — Track warnings with reason and history (persistent with SQLite)
- **Lock / Unlock** — Prevent or allow messages in a channel
- **Purge** — Bulk delete up to 100 messages
- **Slowmode** — Per-channel rate limiting

### 👥 Role & Permission Management
- **Role** — Add, remove, and list roles
- **Permission System** — Grant/revoke command access to trusted users
- **Reaction Roles** — Self-assignable roles via emoji reactions

### 🎮 Fun Commands
- **World Cup Predictor** — Simulate match scores between any two countries
- **8-Ball / Coinflip / Dice / RPS** — Classic games
- **Jokes / Facts / Advice / Quotes** — Fresh content daily
- **Reverse / Mock / Random** — Utility fun

### ⏰ Reminders
- **Set reminders** via DM with natural durations (30s, 5m, 2h, 1d)
- **Automatic DM delivery** when time's up
- **List and cancel** from Discord or dashboard

### 🛠️ Server Tools
- **Nickname** — Change member nicknames
- **Say / Embed** — Send messages as the bot
- **Poll** — Create multi-option polls
- **Announce** — Formatted announcements with pings
- **Stats** — Server growth tracking with daily snapshots

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Data Persistence](#-data-persistence)
- [Commands](#-commands)
- [Dashboard Features](#-dashboard-features)
- [Deployment](#-deployment)
- [License](#-license)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** installed
- A **Discord Application** with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A hosting service (Railway, Fly.io, Discloud, or your own VPS)

### 1. Setup

```bash
git clone <your-repo-url>
cd discord-bot
npm install
cp .env.example .env
```

### 2. Configure `.env`

Open `.env` and fill in your values (see [Environment Variables](#-environment-variables) below).

### 3. Start the Bot

```bash
npm start
```

The bot will:
1. Log in to Discord
2. Register all slash commands (instantly if `GUILD_ID` is set)
3. Start the web dashboard on the configured port

### 4. Access the Dashboard

Open `http://localhost:3000` (or your `DASHBOARD_URL`) and sign in with your `DASHBOARD_PASSWORD`.

---

## 🔐 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BOT_TOKEN` | ✅ | — | Your Discord bot token from the Developer Portal |
| `OWNER_ID` | ✅ | — | Your Discord user ID (grants full command access + dashboard) |
| `DASHBOARD_PASSWORD` | ✅ | — | Password for the web dashboard login |
| `DATA_DIR` | ⚠️ | `./data/` | **Persistent data directory** — stores all bot data in SQLite. Set to `/data` on Railway with a volume mount to prevent data loss on redeploy |
| `GUILD_ID` | ❌ | — | Server ID for **instant** slash command registration. Without this, commands register globally (takes ~1 hour) |
| `DASHBOARD_URL` | ❌ | — | Public URL of your dashboard (displayed by `/dashboard` command) |
| `PORT` | ❌ | `3000` | Port for the web dashboard |
| `BRAND_NAME` | ❌ | — | Custom brand name shown in dashboard footer |
| `UPLOADS_DIR` | ❌ | `./uploads` | Directory for dashboard background image uploads |

---

## 💾 Data Persistence

All bot data is stored in a **single SQLite database** (`bot.db`) inside `DATA_DIR`:

| Data | Storage |
|------|---------|
| Guild configs (log channels, categories) | SQLite |
| User permissions per command | SQLite |
| Reaction role configurations | SQLite |
| Warnings history | SQLite |
| Pending reminders | SQLite |
| Member join/leave stats + daily snapshots | SQLite |
| Dashboard theme customization | SQLite |
| Dashboard users + access tokens | SQLite |

### Preventing Data Loss

Set `DATA_DIR` to a **persistent path** outside your project directory:

- **Railway:** Create a volume mounted at `/data` → set `DATA_DIR=/data`
- **Docker:** `docker run -v /host/path:/data -e DATA_DIR=/data ...`
- **VPS:** Set `DATA_DIR=/var/lib/discord-bot`

> On first boot, the bot automatically migrates any existing JSON data files into SQLite. Old files are backed up with a `.bak` extension and renamed to `.migrated`.

---

## 📜 Commands

### Public Commands (anyone can use)

| Command | Description |
|---------|-------------|
| `/ping` | Check bot latency |
| `/status` | View bot status and resources |
| `/botinfo` | Bot information |
| `/userinfo [user]` | Get user details |
| `/avatar [user]` | View a user's avatar |
| `/stats server` | Server statistics |
| `/stats growth` | Member growth over time |
| `/worldcup <team1> <team2>` | Predict a match score |
| `/8ball <question>` | Ask the magic 8-ball |
| `/coinflip` | Flip a coin |
| `/dice [sides]` | Roll dice |
| `/rps <choice>` | Rock-paper-scissors |
| `/joke` | Random joke |
| `/fact` | Random fact |
| `/advice` | Random advice |
| `/quote` | Inspirational quote |
| `/reverse <text>` | Reverse text |
| `/mock <text>` | Spongebob-case text |
| `/random <min> <max>` | Random number |
| `/remindme <time> <text>` | Set a reminder |
| `/reminders list` | List your reminders |
| `/reminders cancel <id>` | Cancel a reminder |

### Owner Commands (only you or granted users)

| Category | Commands |
|----------|----------|
| **Logging** | `/log channel`, `/log toggle`, `/log list` |
| **Config** | `/embedconfig`, `/presence`, `/botavatar`, `/botname` |
| **Moderation** | `/kick`, `/ban`, `/unban`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clearwarnings`, `/lock`, `/unlock` |
| **Admin** | `/role`, `/purge`, `/slowmode`, `/nickname`, `/say`, `/embed`, `/deploy`, `/track`, `/poll`, `/announce` |
| **Permissions** | `/perm grant`, `/perm revoke`, `/perm list`, `/perm user` |
| **Reaction Roles** | `/reactionrole add`, `/reactionrole remove`, `/reactionrole list` |
| **Dashboard** | `/dashboard` — Get the dashboard link |
| **Access** | `/dashaccess add`, `/dashaccess remove`, `/dashaccess list` |
| **System** | `/shutdown` — Graceful bot shutdown |

Use `/perm grant @user <command>` to give trusted users access to specific commands without making them the owner.

---

## 🖥️ Dashboard Features

The web dashboard is a full interface for monitoring and managing your bot:

| Section | Features |
|---------|----------|
| **Overview** | Live status cards, uptime, memory, server count, net growth mini-chart |
| **Analytics** | 30-day growth chart with SVG line graph, total joins/leaves/net, export as JSON |
| **Servers** | Searchable server list with sort (members/name/boosts) |
| **Server Detail** | Per-server stats, growth bar chart |
| | **Roles** tab — view all roles with colors and member counts |
| | **Channels** tab — view all channels with types and settings |
| | **Logging** tab — toggle categories on/off, set per-category channels, channel filter |
| | **Audit Log** tab — recent Discord audit log entries |
| **Activity** | Recent join/leave events across all servers |
| **Reminders** | All pending reminders with countdown timers |
| **System** | Host info, platform, Node version, CPU, memory (RSS + heap), uptime |
| **Customize** | 12 theme presets, accent color, dashboard title, bot avatar |
| | 5 interactive background engines (Dots, Shapes, Glitch, Liquid, Grid) |
| | Custom background (URL or upload) with blur control |
| | Card styles (Glass/Solid/Border), layout density (Compact/Normal/Comfortable) |
| | Animation presets (Subtle/Smooth/Energetic) + speed control |
| | macOS Dock toggle, card glow effect, ambient light effect |
| | Bot presence, username, and avatar management |
| | Refresh interval, visible section toggles |

> The dashboard saves all customization settings to SQLite — they survive redeploys.

---

## 🚢 Deployment

### Railway (Recommended)

1. Push this repo to GitHub and connect it to Railway
2. Go to **Volumes** tab → **Add Volume** → mount at `/data`
3. Go to **Variables** tab and add:
   - `BOT_TOKEN`, `OWNER_ID`, `DASHBOARD_PASSWORD`, `DATA_DIR=/data`
4. Go to **Settings** → **Networking** → **Generate Domain** for public dashboard access
5. Railway auto-sets `RAILWAY_PUBLIC_DOMAIN` — the `/dashboard` command will detect it automatically

### Fly.io

1. Install the Fly CLI and run `fly launch`
2. Set environment variables with `fly secrets set`
3. Set `DASHBOARD_URL` manually to your Fly domain

### Discloud

1. Edit `discloud.config` with your bot name and RAM
2. Set `DASHBOARD_URL` to your Discloud domain
3. Upload via the Discloud dashboard

### Docker

```bash
docker build -t discord-bot .
docker run -p 3000:3000 --env-file .env -v /host/data:/data discord-bot
```

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](LICENSE) file for details.

**What this means:**
- ✅ You can use this bot for personal or commercial purposes
- ✅ You can modify the code for your own use
- ✅ You can redistribute it — but you must share the source code under the same license
- ❌ You cannot distribute closed-source versions
- ❌ You cannot claim it as your own original work

---

<div align="center">
Made with ❤️ for the Discord community

Found a bug? DM **.nlux.** on Discord.
</div>
