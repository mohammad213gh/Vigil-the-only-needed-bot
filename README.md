<div align="center">

# NLux Bot

**v1.0.0** · The self-hosted Discord bot that doesn't charge you monthly for basic features

![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/130%20tests%20passing-3ba55c)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

**68+ slash commands · full web dashboard · own your data · no subscription, ever**

Logging · Moderation · Tickets · Ban Appeals · Auto-Mod · Invite Tracking · Reaction Roles · Polls · Reminders · Temp Voice · and a lot more

</div>

---

## The short version

I run a Discord server, and I got tired of paying monthly for bots that charge you extra to *see who left* or *add a reaction role*. So I built my own — everything my server needed, from scratch, over a long time of actually running it.

This is that bot. You host it, you own it, you pay once (or nothing, if you're me). There's no "premium tier" hiding the good stuff, because there's no company behind it trying to upsell you. It's a single Node.js process with a SQLite database and a full web dashboard, and it does a genuinely absurd amount for something you run yourself.

**What you won't find here:** music, leveling, or an economy. I never needed them, so I never built them.

---

## What it does

### 🛡️ Moderation & logging

- **The usual suite, done properly** — kick, ban, temp bans that auto-unban even across restarts, timeouts, warnings with DMs, lock/unlock, purge with a confirm dialog, slowmode, nickname. Everything logs to a **numbered case system** (`/history`, `/case`, `/reason`) so you can point at exactly what happened and why.
- **16 logging categories, ~40 events** — message edits/deletes, reactions, joins/leaves, role changes, channel and permission changes, voice, threads, bans, invites, emojis, stickers, stage, scheduled events, automod actions, webhooks. Per-category channels, per-server toggles, embed colors — all configurable.
- **Invite tracking** that detects the *exact* invite code someone used to join — no "guessed by first join after" nonsense.
- **Log search** — find a deleted or edited message by user, keyword, or action.
- **Staff notes** — private per-user notes for your mod team, full CRUD.

### 🤖 Auto-mod & protections

- Spam, banned words, link filters, caps spam, mention spam — each with its own action (warn, timeout, kick, or delete).
- **Warning thresholds** — hit X warnings and the bot acts automatically. You set the escalation ladder.
- A granular **permission system** so trusted people get specific commands (`/perm grant @user /ban`) without you handing out roles you'll regret.

### 👥 Community features

- **Reaction roles** and **dropdown role menus** — self-assignable, publishable from the dashboard.
- **Tickets** — panels, ticket types with custom questions, support roles, transcripts, and a claim system. Honestly the deepest part of the bot.
- **Ban appeals** — banned users can appeal; you review and approve or deny from the dashboard.
- **Polls** — multi-vote, anonymous, or timed with auto-finalize. Plus announcements.
- **Reminders** — DM-based, persistent, `/remindme 30s drink water`.
- **Welcome / goodbye messages** — fully customizable embeds with 25+ placeholders.
- **Temp voice channels** — auto-create, rename, and clean up.
- **Activity insights** — top users and channels, member growth over 90 days, command usage stats and heatmaps.
- A dozen **fun commands** for when the server's quiet.

Every command works as a **slash command** *and* a **prefix command** (default `;`), so old habits and new UI coexist.

---

## The dashboard

The dashboard is where this stops feeling like a hobby bot. It's a full web UI — one single-page app, no reloads — that runs from the same process as the bot. Log in from a browser and you can run your whole server without touching Discord or a terminal:

- Live overview — uptime, memory, members, everything at a glance
- Per-server panels: roles, channels, **audit log viewer**, mod tools, logging config, greetings
- **Ticket management**, ban appeals, temp-voice config, warning thresholds
- Auto-mod rule builder with import/export, word/link filter management
- Command usage charts, server comparison, **command heatmap**
- The **error log** — the bot's own console, searchable, with a clear button
- One-click **database backups** with integrity checks
- Rate-limit controls, webhook and API-token management, bot name/avatar/presence
- Deep **customization**: themes, accent colors, backgrounds, animations, glassmorphism, a look switcher (Neo/Classic/Minimal)
- Ctrl+K **command palette**, keyboard shortcuts, a mobile layout, and live SSE events so you see message deletions as they happen

It's not a thin remote control for a handful of settings. The dashboard is where most of the bot is actually operated.

---

## Quick start

You need **Node.js 20+** and a bot token from the [Discord Developer Portal](https://discord.com/developers/applications) with the guild intents enabled (Message Content, Guild Members, Presence, Voice States, and friends — the bot tells you if something's missing).

```bash
git clone <your-repo-url>
cd discord-bot
npm install
cp .env.example .env      # then fill in BOT_TOKEN, OWNER_ID, DASHBOARD_PASSWORD
npm start
```

Run `/deploy` in your server once — and again after every update — so the command list stays in sync.

**Railway** (what I actually use): skip `.env`, add `BOT_TOKEN`, `OWNER_ID`, `DASHBOARD_PASSWORD`, and `DATA_DIR=/data` (after mounting a volume), then generate a domain for the dashboard. **Docker** works too:

```bash
docker build -t discord-bot .
docker run -p 3000:3000 --env-file .env -v /host/data:/data -e DATA_DIR=/data discord-bot
```

Discloud and Fly.io work fine as well — it's just Node + a persistent folder.

---

## What's under the hood

One process. That's the whole architecture.

```
Discord ← discord.js v14 →  bot logic  →  SQLite (better-sqlite3)
                             ↕ shared
                        Express dashboard
```

The bot and the dashboard run in the same Node.js process, sharing one SQLite file. ~80–120 MB of RAM on a server with a few hundred members. No microservices, no separate database server, no containers required. It's deliberately boring.

A few things worth knowing if you're going to read the code:

- **The frontend is real ES modules.** The dashboard used to be one ~4,100-line file — it's now 10 modules under `src/dashboard/parts/` with explicit import/export boundaries and a small window bridge for the HTML's inline handlers. The conversion was mechanical and verified (acyclic graph, no unresolved references).
- **CI runs on every push** — ESLint plus 130 tests on Node 20 *and* 22, so a breaking change fails on GitHub before it reaches your server.
- **The database doesn't grow forever.** A daily sweeper prunes command usage after 180 days, inactive member activity after 180 days, and ticket messages from tickets closed over a year ago (transcripts are saved at close, so nothing real is lost).
- Bounded caches, graceful shutdown, temp-ban timers that survive restarts, and a **circuit breaker** around Discord API calls so a rate limit doesn't cascade.

### The memory leak that almost killed the project

Early on, one unremoved event listener made memory climb from 60 MB to 400+ MB within hours. Weeks of hunting, and it was one line. I nearly scrapped the whole thing over it. It's fixed — but it's also why this bot takes graceful shutdown and cleanup seriously, and why "it works on my machine for a day" was never an acceptable bar.

---

## Testing: honest coverage

130 tests cover the database (migrations, retention pruning, backups), ban appeals, tickets, permissions, the prefix command dispatcher, the dashboard's auth and routes, and — importantly — the **real frontend module graph boots end-to-end in a DOM** with no uncaught errors.

What that does *not* mean: there's no real-browser end-to-end testing, no click-through automation, and two of the biggest server files still have large untested surfaces. Green CI means *it doesn't obviously crash*, not *the new feature works in every browser*. The bot has shipped bugs that only showed up in production — one set of dashboard routes referenced functions that didn't exist, and static analysis found them months later. Take that as a fair warning about what "tested" means here.

---

## Security

The dashboard is the sensitive part, and it gets real treatment:

- Rate-limited login (10 attempts/min per IP)
- Password **or** your Discord ID + a per-user access token
- Constant-time password comparison, random session tokens, sessions invalidated on access revocation
- Fail-closed tenant scoping on server routes, parameterized SQL everywhere
- Ephemeral replies for sensitive commands, a granular permission system, `/server_leave` to cut a server loose instantly

**The honest limits:** the primary auth is a shared dashboard password from an env var, sessions live in memory (gone on restart), and there's no per-user rate limiting beyond login. That's fine for a self-hosted bot; it is not enterprise SSO.

---

## Reality check

Since the internet is full of READMEs that overpromise, here's the part nobody writes:

- **It works — and it's actually running.** This bot has been live in real servers for a long time.
- **It's a solo project that grew fast.** Some files are huge, and parts of the frontend are still legacy-style (`var`, single-letter names, HTML built by string concatenation). It's navigable and it works; it is not a showcase of perfect architecture.
- **1.0.0 means "it runs," not "it's done."** No leveling, no music, no economy. Tickets and appeals work but could go deeper.
- **You are the SLA.** When it goes down, it's your host that went down. Backups, uptime, and security are yours to own — which is the whole point of self-hosting, but don't pretend otherwise.
- It's **proprietary** — you can run it and modify it for yourself, but not redistribute it. See the license.

If that trade sounds fair — owning everything, paying nothing monthly, in exchange for running it yourself — welcome. It's a good bot.

---

## Support

Found a bug or want something added? DM me on Discord: **.nlux.** (ID: 1200828694088917114).

---

## License

This project is distributed under a **Proprietary License**. All rights reserved. See [LICENSE](LICENSE) for the full terms.

In short:
- ✅ Run it on your own Discord server(s), modify it for your own use
- ❌ Share or resell the source code

---

<div align="center">
Built by franc · Discord: .nlux. (1200828694088917114)
</div>