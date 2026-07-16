<div align="center">

# NLux Bot

**A premium Discord management bot — source code included**

> **$39 — $49** · One-time payment · Full source code · Lifetime updates

![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)

**Logging · Moderation · Reaction Roles · Dashboard · Stats · Reminders · Customization**

*Built by franc (`.nlux.`) — DM me on Discord to purchase: **.nlux.** (ID: 1200828694088917114)*

</div>

---

## What Is This?

This is a complete, production-ready Discord management bot that I built from scratch — fully self-hosted, persistent SQLite database, 70+ commands, 16 logging categories, a full web dashboard, and zero dependency on any third-party service.

You get the **full source code**. Host it yourself. Run it on your own server. Own every piece of it.

---

## Why I Built It

I was tired of Discord bots locking basic features behind monthly subscriptions. Want to log who left? That's $5/month. Reaction roles? Another tier. A dashboard to manage your server? Upgrade again.

So I built my own. Everything my server needed, from scratch. 30+ rewrites of the dashboard alone until it felt right. One memory leak that made me almost scrap the whole project. But I stuck with it, and this is what came out of it.

I've been using this in my own server for a long time. It works. Now I'm selling the source so others can run it too.

---

## What You Get (The Full List)

**70+ Commands across 8 categories:**

| Category | Commands |
|---|---|
| Moderation | `/kick`, `/ban`, `/unban`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clearwarnings`, `/lock`, `/unlock` |
| Logging | 16 categories — messages, members, voice, roles, channels, bans, invites, emojis, stickers, threads, automod, server, stage, mentions, boosts, moderation |
| Permissions | `/perm grant`, `/perm revoke`, `/perm list`, `/perm user` — granular control over who can use what |
| Reaction Roles | `/reactionrole add`, `/remove`, `/list` — embed-based, fully customizable |
| Fun | `/8ball`, `/coinflip`, `/dice`, `/rps`, `/joke`, `/fact`, `/advice`, `/quote`, `/reverse`, `/mock`, `/random`, `/worldcup` |
| Utility | `/ping`, `/status`, `/botinfo`, `/userinfo`, `/avatar`, `/remindme`, `/reminders`, `/poll`, `/announce`, `/say`, `/embed` |
| Stats | `/stats server`, `/stats growth`, `/stats topmembers`, `/track` — server analytics with charts |
| Owner | `/dashboard`, `/dashaccess`, `/deploy`, `/shutdown`, `/server_leave`, `/prefix`, `/embedconfig`, `/presence`, `/botavatar`, `/botname` |

**Both slash commands (/)** and **prefix commands (;)** work side-by-side. Use whatever feels natural.

**40 Discord events logged** — Every meaningful server event is captured and logged to your configured channel.

**Full web dashboard** — A complete self-hosted dashboard with:
- Live server overview (status, uptime, memory, member count)
- Logging configuration (toggle categories, set channels per server)
- Moderation panel (warn, kick, ban from browser)
- Audit log browser with filters
- Statistics with growth charts and trends
- Full customization (themes, accent colors, glassmorphism, animations)
- Account and session management

**SQLite persistence** — Everything saves to a single database file. Warnings, configs, stats, reminders, settings — all survive restarts, redeploys, and crashes. No external database needed.

**Performance** — ~80–100 MB RAM with 200+ members. Runs for weeks without issues on Railway, Fly.io, or a $5 VPS.

---

## What It's Not

Let me be straight with you:

- **Not a competitor to MEE6 or Dyno.** Those bots have years of dev time, teams, and polished UIs. This is one person's project.
- **No leveling system, no music, no giveaways, no ticket system.** I didn't build those because better bots already do them.
- **Not cloud-hosted.** You host it yourself. That means you're responsible for uptime, backups, and updates.
- **The dashboard is minimal and custom.** I built it for my own taste — clean, glassmorphic, dark. You can customize colors and themes, but it's not a drag-and-drop builder.

If you need a polished all-in-one with 99.9% uptime and a team behind it, go with a premium bot. If you want **full control, your own data, and no monthly fees**, this is it.

---

## What's Included

- **Full source code** (Node.js, Discord.js v14, Express, SQLite)
- **Web dashboard** (HTML/CSS/JS, self-hosted)
- **Dockerfile** for containerized deployment
- **discloud.config** for Discloud hosting
- **Lifetime updates** — any improvements I make, you get
- **Support** — DM me on Discord if something breaks

---

## How to Get It

**DM me on Discord: `.nlux.` (ID: 1200828694088917114)**

Price: **$39 — $49** (one-time, full source, lifetime updates)

Payment methods: I'll work with you on this. DM me and we'll sort it out.

After payment, you'll get:
1. The full source code
2. Instructions for setup and hosting
3. Any future updates

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
GUILD_ID=your_server_id  # optional, for instant commands
npm start
```

Run `/deploy` in your Discord server after first launch to register all commands.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Discord Library | Discord.js v14 |
| Web Server | Express |
| Database | SQLite (better-sqlite3) |
| File Uploads | Multer |
| Dashboard | Vanilla HTML/CSS/JS |

---

## License & Terms

When you purchase NLux Bot, you get:

✅ **You can:**
- Use the bot on your own Discord server(s)
- Modify the source code for your own use
- Host it anywhere you want
- Get lifetime updates

❌ **You cannot:**
- Resell the source code (modified or not)
- Share the source code with others who haven't purchased it
- Claim it as your own creation

**Credit must be given** — If you use this bot, you must credit the original developer:
- Mention **franc** or
- Include the Discord tag **.nlux.** (ID: 1200828694088917114)

---

<div align="center">

**Built by franc · Discord: .nlux. (1200828694088917114)**

*One person's project, shared for a fair price. No subscriptions. No upsells. Just the bot.*

</div>
