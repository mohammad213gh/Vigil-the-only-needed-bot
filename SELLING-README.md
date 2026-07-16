<div align="center">

# NLux Bot

**A complete Discord management bot — source code included**

> **$39** · One-time payment · Full source code

![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

**Self-Hosted · Full Source Code · Web Dashboard · Own Your Data · No Subscription**

*Built by **franc** (`.nlux.`) — DM me on Discord to buy: **.nlux.** (ID: 1200828694088917114)*

</div>

---

## What Is This?

This is a complete Discord management bot, battle-tested in my own server. Fully self-hosted, persistent SQLite database, a full web dashboard, and zero dependency on any third-party service.

You get the **full source code**. You host it yourself. You own every piece of it. No monthly fee.

**Logging · Moderation · Reaction Roles · Dashboard · Stats · Reminders · Customization**

It comes with 70+ commands across moderation, logging, reaction roles, fun, utility, and stats — but the real selling points are the ones you can't get from a premium bot: **your own dashboard, your own data, and no subscription.**

---

## Why?

I got tired of Discord bots locking basic features behind monthly subscriptions. Want to log who left? That's $5/month. Reaction roles? Another tier. A dashboard to manage your server? Upgrade again.

So I built my own. Everything my server needed, from scratch. 30+ rewrites of the dashboard alone until it felt right. One memory leak that took weeks to find and almost made me scrap the whole project.

I've been running this bot in my own server for a long time. It works. Now I'm selling the source code so others can run it too, without paying monthly for features that should just *work*.

---

## How It Compares (Honestly)

This isn't meant to compete with long-established bots like MEE6, Dyno, or Carl-bot. Those projects have years of development and teams behind them. The goal here is different: complete control, self-hosting, and no premium paywalls.

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
| Self-Hosted (own data) | ✅ Yes | ❌ Cloud | ❌ Cloud | ❌ Cloud |
| **One-Time Payment** | ✅ **$39** | ❌ $5–$12/mo | ❌ $5–$10/mo | ❌ $5–$10/mo |

**The honest tradeoffs:**
- **Polished UI?** MEE6 and Dyno have better docs and sleeker UIs. They've been doing this longer.
- **Features?** Premium bots have niche stuff like leveling, music, giveaways, and ticket systems built in.
- **Reliability?** Cloud bots have 99.9% uptime. This one goes down when Railway goes down.
- **But** — you pay once, you own your data, you can customize everything, and you're not locked into a subscription.

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

> **After first deploy or any update, run `/deploy` in your server** to sync all commands.

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

### Screenshots

![Login Page](https://i.ibb.co/23dkJKj4/Screenshot-2026-07-16-225748.png)
*Dashboard login page*

![Dashboard Overview](https://i.ibb.co/LdYHjJ3f/Screenshot-2026-07-16-225843.png)
*Main dashboard — server overview, stats, and controls*

![Logging Output](https://i.ibb.co/PGQpDRxP/Screenshot-2026-07-16-225613.png)
*Logging panel — 16 categories of Discord events logged in real time*

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

### Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Discord Library | Discord.js v14 |
| Web Server | Express |
| Database | SQLite (better-sqlite3) |
| File Uploads | Multer |
| Dashboard Frontend | Vanilla HTML/CSS/JS |

---

## Performance

- **SQLite** — No external database server needed. Everything lives in a single file inside your `DATA_DIR`.
- **Single process** — The bot and dashboard share one Node.js instance. No extra overhead.
- **Memory usage** — ~80–100 MB on a server with 200+ members. Tested and stable over weeks of uptime.
- **Graceful shutdown** — Catches SIGTERM/SIGINT, closes database connections cleanly, and writes pending data. No corruption on restart.
- **Designed for long-term hosting** — Runs for weeks without issues on Railway, Fly.io, or a $5 VPS.

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
- **A Discord bot token** from the [Developer Portal](https://discord.com/developers/applications) — enable **Message Content**, **Guild Members**, and **Presence Intent**
- **A hosting provider** — I recommend Railway (free tier works), but any VPS, Fly.io, or Discloud works too

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
3. Set your env vars in Railway's dashboard (not a .env file):
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

Everything saves to a single SQLite database (`bot.db`) inside your `DATA_DIR`. That means warnings, configs, stats, reminders, dashboard settings — they all survive restarts, redeploys, and crashes as long as `DATA_DIR` points to persistent storage.

On Railway this means setting up a volume. Takes 2 minutes and you never lose data again.

---

## License & Terms

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
