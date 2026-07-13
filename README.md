<div align="center">

# 🤖 Premium Discord Bot

**A feature-rich Discord bot with web dashboard, logging, moderation, and server management**

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
- **Customizable UI** — Themes, accent colors, background effects, card styles, animation presets
- **Access Control** — Secure password + Discord ID + access token authentication
- **Export Data** — Download growth analytics as JSON

### 📝 Advanced Logging
- **6 categories** — Messages, Reactions, Members, Roles, Server, Voice
- **Per-category channels** — Route different log types to different channels
- **Toggle system** — Enable/disable categories on the fly
- **Channel tracking** — Filter logs to specific channels only
- **Rich embed format** — Beautiful, color-coded event messages

### 🛡️ Moderation Suite
- **Kick / Ban / Unban** — Full member removal toolkit
- **Timeout / Untimeout** — Temporary and permanent mute
- **Warn System** — Track warnings with reason and history
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
# Clone or download the bot
git clone <your-repo-url>
cd discord-bot

# Install dependencies
npm install

# Create your environment file
cp .env.example .env
```

### 2. Configure `.env`

Open `.env` and fill in your values:

```env
# ── Required ───
BOT_TOKEN=your_discord_bot_token_here
OWNER_ID=your_discord_user_id_here
DASHBOARD_PASSWORD=choose_a_strong_password

# ── Optional ───
DASHBOARD_URL=https://your-bot-dashboard.com
PORT=3000
GUILD_ID=your_test_server_id
```

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
| `OWNER_ID` | ✅ | — | Your Discord user ID (grants full command access) |
| `DASHBOARD_PASSWORD` | ✅ | — | Password for the web dashboard |
| `DASHBOARD_URL` | ❌ | — | Public URL of your dashboard (shown in `/dashboard` command) |
| `PORT` | ❌ | `3000` | Port for the web dashboard |
| `GUILD_ID` | ❌ | — | Server ID for instant command registration |
| `CONFIG_PATH` | ❌ | `./config.json` | Path to the config file |
| `REMINDERS_PATH` | ❌ | `./reminders.json` | Path to the reminders file |
| `UPLOADS_DIR` | ❌ | `./uploads` | Directory for dashboard file uploads |
| `LOG_CHANNEL_ID` | ❌ | — | Default channel for logging (fallback) |

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
| **Overview** | Live status cards, uptime, memory, server count, net growth chart |
| **Analytics** | 30-day growth chart, total joins/leaves, export data as JSON |
| **Servers** | Searchable server list, per-server detail view with growth charts |
| **Server Mgmt** | **Roles** tab — view all roles with colors and member counts |
| | **Channels** tab — view all channels with types and settings |
| | **Logging** tab — toggle log categories on/off per server |
| **Activity** | Recent join/leave events across all servers |
| **Reminders** | All pending reminders with countdown timers |
| **System** | Host info, CPU, memory usage (RSS + heap), uptime |
| **Customize** | Themes, accent color, background effects, card styles, animation presets, dock navigation |

### Customization Options
- **12 preset themes** — Purple, Blue, Green, Cyan, Pink, Orange, Red, White, Amber, Lime, Teal, Rose
- **5 background engines** — Dots, Shapes, Glitch, Liquid, Grid (all interactive)
- **Custom background** — URL or upload with blur control
- **3 card styles** — Glass, Solid, Border Only
- **3 layout densities** — Compact, Normal, Comfortable
- **3 animation presets** — Subtle, Smooth, Energetic
- **Dock navigation** — Enable/disable, macOS-style magnification
- **Card glow** — Mouse-tracking border glow effect
- **Ambient light** — Mouse-following radial highlight

---

## 🚢 Deployment

### Railway (Recommended)

1. Push to a GitHub repo and connect to Railway
2. Add your environment variables in Railway Dashboard → Variables
3. Railway auto-sets `RAILWAY_PUBLIC_DOMAIN` — the `/dashboard` command will work automatically
4. Go to Settings → Networking → Generate Domain for public access

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
docker run -p 3000:3000 --env-file .env discord-bot
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
  -# dm me in discord if you find any bugs .nlux.
if theres any issues found dm me in discord
.nlux.
</div>
