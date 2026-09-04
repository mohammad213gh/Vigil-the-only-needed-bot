<div align="center">

# NLux Bot

**v1.0.0** · The self-hosted Discord bot that doesn't charge you monthly for basic features

![Node](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?logo=discord&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/130%20tests%20passing-3ba55c)
[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

**70 slash commands · full web dashboard · own your data · no subscription, ever**

Logging · Moderation · Tickets · Ban Appeals · Auto-Mod · Invite Tracking · Reaction Roles · Polls · Reminders · Temp Voice · and a lot more

</div>

---

## Contents

1. [The short version](#the-short-version)
2. [What it does — every feature, explained](#what-it-does--every-feature-explained)
3. [The command reference](#the-command-reference)
4. [The dashboard](#the-dashboard)
5. [Quick start](#quick-start)
6. [Configuration](#configuration)
7. [Data, storage & backups](#data-storage--backups)
8. [Architecture](#architecture)
9. [Testing](#testing)
10. [Security](#security)
11. [Deploying](#deploying)
12. [Troubleshooting & FAQ](#troubleshooting--faq)
13. [What it deliberately is not](#what-it-deliberately-is-not)
14. [Reality check](#reality-check)
15. [Support & license](#support--license)

---

## The short version

I run a Discord server, and I got tired of paying monthly for bots that charge you extra to *see who left* or *add a reaction role*. So I built my own — everything my server needed, from scratch, over a long time of actually running it.

This is that bot. You host it, you own it, you pay once (or nothing, if you're me). There's no "premium tier" hiding the good stuff, because there's no company behind it trying to upsell you. It's a single Node.js process with a SQLite database and a full web dashboard, and it does a genuinely absurd amount for something you run yourself.

**What you won't find here:** music, leveling, or an economy. I never needed them, so I never built them.

---

## What it does — every feature, explained

### 🛡️ Moderation, done properly

**The usual suite — kick, ban, temp bans, timeouts, warnings:**

| Command | What it does |
|---|---|
| `/kick` | Kick a member with an optional reason |
| `/ban` | Ban a member, optionally deleting their recent messages |
| `/tempban` | Ban for a duration (e.g. `2d`). The unban **survives restarts** — a background sweeper tracks when each ban expires and lifts it even if the bot was offline at the deadline |
| `/unban` | Unban a user by ID |
| `/timeout` / `/untimeout` | Time a member out for a duration, or lift it |
| `/warn` | Warn a member (they get a DM), optionally with an interactive form for the reason |
| `/warnings` / `/clearwarnings` | View or clear a member's warning history |
| `/lock` / `/unlock` | Lock a channel so nobody can send, then unlock it |
| `/purge` | Bulk-delete up to 100 messages |
| `/slowmode` | Set a channel slowmode in seconds |
| `/nickname` | Change a member's nickname |

**Every single action is recorded in a numbered case system.** When you warn, kick, ban, or timeout someone, the bot opens a case: who did it, who it was done to, when, why, and what was done. Then:

- `/history @user` — that user's full moderation history
- `/case 12` — details of one specific case
- `/reason 12 appeal approved, lifted early` — update the reason later, which is how you keep your audit trail honest when a punishment is reversed

Temp bans that auto-unban **even across restarts** were the original pain point that justified the whole design — timers that live in memory die with the process, so expiry dates live in the database and a sweeper checks them.

### 📜 Logging — 16 categories, ~40 event types

The bot watches your server and writes a log entry for almost everything that happens, grouped into 16 independently-configured categories:

`messages` · `reactions` · `members` · `roles` · `server` · `voice` · `threads` · `emojis` · `bans` · `invites` · `stickers` · `automod` · `scheduled` · `stage` · `webhooks` · `integrations`

For each category you decide, independently:

- **Where it goes** — `/log channel type:messages #mod-logs` routes that category to its own channel, or leave it unset to use the default
- **Whether it's on** — `/log toggle category:messages enabled:true`
- **What it looks like** — every log embed inherits your server's embed config (color, footer)

What gets logged includes message edits/deletes (with before → after content), reaction changes, joins/leaves, role changes, channel & permission changes, voice moves, threads, bans, invite use, emoji/sticker changes, and automod actions. Logged **deleted messages stay searchable** after the fact via `/logs` or the dashboard — Discord gives you nothing for free there.

### 🔍 Log search

`/logs search` digs through the stored message log by:

- **User** — everything a specific person said, including deleted messages
- **Keyword** — every logged message containing a phrase
- **Action** — filter to deleted or edited only
- **Limit** — up to 50 results

This is the "someone said something awful and deleted it" feature. It has settled real disputes.

### 🤖 Auto-mod & protections

Five independent rules, each with its own trigger and its own action:

| Rule | Trigger | Options |
|---|---|---|
| **Spam** | X messages in Y seconds | threshold, time window |
| **Mass mentions** | more than X mentions in one message | threshold |
| **Banned words** | a word on your blocklist | pattern list |
| **Links** | any link (or a link not on your allowlist) | allowlist |
| **Excessive caps** | message is >70% caps and >20 chars | threshold % |

Each rule can take one of four actions: **warn** the user, **delete** the message, **timeout** them, or **kick** them — and timeout actions can carry a duration.

Words and links are managed as **filters**: `/automod filter type:words pattern:spam` adds a banned word, `/automod filter type:links pattern:youtube.com` adds a link-allowlist entry. There's also a **channel/role exemption system** — choose channels where automod doesn't run and roles that are above the rules — all configurable from the dashboard with an import/export for your whole rule set.

### ⚖️ Warning thresholds — an escalation ladder

Warnings are only as good as what happens when someone collects them. The thresholds system turns warning counts into automatic action:

- `/thresholds add warnings:3 action:timeout duration:60` — three warnings = 1-hour timeout
- `/thresholds add warnings:5 action:kick`
- `/thresholds add warnings:7 action:ban`

Each server builds its own ladder (timeout → kick → ban), and it's all configurable from the dashboard too.

### 🔐 The permissions model

Instead of "trusted role can do everything," this bot does command-level grants:

- **The bot owner** (from `OWNER_ID`) can always use anything.
- **`/perm grant @user /ban`** gives one specific person one specific command. `/perm revoke`, `/perm list`, and `/perm user` manage it.
- Grants are **per-server** (they live in the database keyed by guild ID) and cached for 30 seconds, so a revoke takes effect almost immediately.

This is how you let a moderator kick without handing them the ability to change the bot's avatar or wipe the warning history. There's no "half-admin" role that secretly does too much.

### 🎫 Tickets — the deepest feature in the bot

The ticket system is built around **panels and types**. A panel is a message (or dashboard widget) that people click to open a ticket; a panel contains one or more **types**, which are different flavors of ticket.

**Setting up:**

- `/ticket panel_create name:Support` — create a panel
- `/ticket type_add panel:Support name:General` — add a type to it (emoji optional)
- `/ticket type_category` — which category spawned ticket channels live in
- `/ticket type_role` — which support role can see this type's tickets (per-type support teams!)
- `/ticket type_welcome` — the message posted inside the ticket when it opens
- `/ticket type_question` — custom questions users answer before the ticket opens (e.g. "What's your issue?", required or optional). Answers appear in the ticket
- `/ticket panel_send` — post the panel to a channel

**During a ticket's life:**

- `/ticket claim` — take responsibility for the ticket (it's visibly yours now)
- `/ticket add @user` / `/ticket remove @user` — manage who's in the channel
- `/ticket rename` — rename the channel
- `/ticket close` — close and archive the ticket with an optional reason

**Rules and cleanup:**

- `/ticket blacklist_add @user` — stop someone from opening tickets entirely
- `/ticket type_inactivity hours:24` — auto-close tickets for a type after inactivity
- `/ticket close_on_leave` — auto-close open tickets when the member leaves the server
- `/ticket log_channel` — where transcripts go when tickets close

When a ticket closes, the bot **snapshots the full transcript** into the database (message-by-message, with authors and timestamps), so a closed ticket is a permanent record — not a deleted channel.

The dashboard takes this further: visual panel builders, clone panel, drag-free reordering of types, a "frequently used configs" system, an unsaved-changes bar, and a live preview of what the panel will look like. (Details in the dashboard section.)

### ⚖️ Ban appeals

Banned users can appeal — no access to your server required. The appeal lands in the **dashboard** (there's no slash command for it by design: appealing users are banned, so Discord commands are off the table):

1. The banned user opens the appeal URL and writes their side.
2. You see open appeals in the dashboard with the original ban reason and the ban case.
3. You approve (the ban is lifted) or deny — the user sees the outcome.

### 🌟 Reaction roles & role menus

Two ways to let people self-assign roles:

- **Reaction roles** — a message with emoji reactions; clicking the emoji toggles the role. `/reactionrole add channel:#roles role:@Pingable emoji:🔔` or build it in the dashboard with drag-and-drop preview.
- **Role menus** — a dropdown select on a message; users pick from the list. `/rolemenu create`, then `add` roles with labels and emoji, then `publish` to turn it into a working dropdown.

Both support add/remove/list management and per-option labels and emoji. The dashboard version lets you compose the whole thing visually and publish it without touching a command.

### 👋 Welcome & goodbye messages

Fully customizable embeds for join and leave events. `/welcome` and `/goodbye` each expose: `channel`, `toggle`, `message` (plain text above the embed), `title`, `description`, `color`, `footer` (text + icon), `thumbnail`, `image`, `author`, `show`, `test`, `reset`.

Messages support **8 placeholders**:

| Placeholder | Becomes |
|---|---|
| `{user}` | Mention of the new member |
| `{username}` | Their `name#0000` |
| `{userid}` | Their Discord ID |
| `{server}` | Server name |
| `{membercount}` | Total members |
| `{members}` | Same as `{membercount}` |
| `{age}` | How old the account is (e.g. `2y 3m`) |
| `{created}` | Account creation date (relative timestamp) |

So `Welcome {user} to **{server}**! We now have {membercount} members` becomes a real, rendered message. The dashboard has a **live preview** editor with a clickable placeholder reference, so you never guess.

### 📨 Invite tracking

The bot records every invite it sees and — crucially — **which invite code actually brought each member in**. `/invites check @user` shows their invites; `/invites top` ranks your best inviters; `/invites stats` gives server totals. When someone joins with a fake/vanity code, the log shows the real code.

### 🎁 Giveaways

`/giveaway start` with prize, duration (`1h`, `2d`, `1h30m`), number of winners, optional description, entry color, image, and — the useful bit — a **required role** and a **banned role** (e.g. "must have @Member", "no @Suspicious"). Then `end` (early), `reroll`, `cancel`, `list`. Winner picking is stored and audited, and giveaways survive restarts — the giveaway state lives in the database with its own check loop.

### 📊 Polls & announcements

`/poll` takes a question and up to 4 options, with `multi` (multi-vote) and `anonymous` toggles and an optional `duration` for timed auto-finalize. `/announce` posts a titled, colored announcement embed to a channel of your choice.

### ⏰ Reminders

`/remindme 30s drink water` — the bot DMs you when the time is up. Durations parse naturally (`30s`, `5m`, `2h`, `1d`, `1h30m`). `/reminders list` and `/reminders cancel` manage them, and they're **persistent** — stored in the database, so a restart doesn't eat your reminders.

### 🎧 Temp voice channels

The "join to create" pattern:

1. `/tempvc set channel:#Join-To-Create` — designate a trigger channel (optionally a category where spawned channels go)
2. When someone joins it, the bot **spawns a private channel for them** named by your template (`/tempvc name template:"{name}'s channel"` — `{name}` and `{number}` available)
3. The owner controls it: `/tempvc rename`, `/tempvc limit`, `/tempvc lock` / `unlock`, and `/tempvc claim` if the original owner left

There's also a **button control panel** (`/tempvc panel`) that gives the channel owner clickable rename/lock/limit buttons instead of commands, and the whole thing auto-cleans: when everyone leaves an empty temp channel, it's deleted and the trigger channel is free again.

### 🎙️ Voice presence

`/vc` (owner only) makes the bot itself chill in a voice channel — join, move it around, leave — with an optional `status` text that shows as "Listening to …". Useful for a bot that should appear present in a community VC, and it's wired through `@discordjs/voice` with rejoin logic if the bot gets disconnected.

### 📈 Server stats channels

`/serverstats add` turns a channel name into a **live counter**. Pick a type — members, humans, bots, online, boosting, boost tier, channels, roles, or emojis — and the bot keeps the channel name current as the number changes. `/serverstats remove` and `list` manage them.

### 📝 Staff notes

Private notes about users, visible only to your team: `/note add @user`, `/note list`, `/note edit`, `/note remove`. Notes are per-server and never shown to the user. Great for "appealed a ban three times," "previously traded nitro," or "actually the victim, do not bait."

### 📊 Stats & activity

The bot tracks what actually happens in your server:

- **Member growth** — daily join/leave snapshots, kept for 90 days, charted in the dashboard
- **Command usage** — every command run, per server, per command, timestamped — charted as totals and as a **heatmap** (hour × weekday) that shows when your server is alive
- **Activity counts** — top users and channels over time
- **Server comparison** — how your servers stack up against each other (dashboard)
- **Bot activity** — uptime, memory, message/command counters (dashboard)

`/stats server` and `/stats growth` cover the basics in Discord; the interesting stuff lives in the dashboard.

### 🎮 Fun commands

A dozen of them, for when the server's quiet: `8ball`, `coinflip`, `dice`, `rps`, `joke`, `fact`, `advice`, `quote`, `reverse`, `mock`, `random`, and `worldcup` (predict a match score).

### 👑 Owner commands

- `/deploy` — re-register all slash commands (run after updates)
- `/dashboard` — get your dashboard link
- `/dashaccess` — grant/revoke/list Discord-ID-based dashboard access
- `/server_leave` — force-leave a server by ID
- `/shutdown` — graceful shutdown
- `/presence`, `/botavatar`, `/botname` — the bot's public identity
- `/embedconfig` — default embed footer + color for your server's embeds
- `/prefix` — view/change the prefix for prefix commands (default `;`)
- `/track` — manage tracked channels (owner-only logging helpers)
- `/status`, `/botinfo` — health and info

**Every command works as a slash command *and* a prefix command** (default prefix `;`, per-server configurable), so old habits and new UI coexist.

---

## The command reference

All **70 top-level slash commands**, grouped as `/help` groups them. Commands marked 🔓 are public (anyone in the server); everything else requires the bot owner or a `/perm` grant. `G` marks commands that also gate on the guild/perm layer.

### ℹ️ Info — 🔓 public

| Command | Description |
|---|---|
| `/help` | Show all commands, a category, or help for one command |
| `/ping` | Bot + API latency |
| `/status` | Bot status, uptime, memory, server count |
| `/botinfo` | Version, library, invite info |
| `/userinfo` | Member info: joined, created, roles, permissions |
| `/avatar` | A user's avatar |
| `/stats` | Server / growth / command-usage statistics |

### 🎮 Fun — 🔓 public

| Command | Description |
|---|---|
| `/8ball` · `/coinflip` · `/dice [sides]` · `/rps` | Classic games |
| `/joke` · `/fact` · `/advice` · `/quote` | Random content |
| `/reverse` · `/mock` · `/random min max` | Text & number toys |
| `/worldcup team1 team2` | Predict a match score |

### ⏰ Reminders — 🔓 public

| Command | Description |
|---|---|
| `/remindme time text` | DM reminder (`30s`, `5m`, `2h`, `1d`, `1h30m`) |
| `/reminders list` / `cancel` | Manage your reminders |

### 🛠️ Admin & utility

| Command | Description |
|---|---|
| `/role add / remove / list` | Manage a user's roles |
| `/purge [amount]` | Bulk delete messages |
| `/slowmode [seconds]` | Channel slowmode |
| `/nickname user nickname` | Change a member's nickname |
| `/say` / `/embed` | Make the bot say or embed something |
| `/announce channel title message color` | Formatted announcements |
| `/poll question option1-4 multi anonymous duration` | Polls |
| `/deploy` | Re-register slash commands (owner) |
| `/track add/remove/list` | Tracked channels (owner) |
| `/log channel/toggle/list` | Logging config |
| `/prefix [new_prefix]` | Per-server prefix |

### 🛡️ Moderation & cases

| Command | Description |
|---|---|
| `/kick` · `/ban` · `/unban` | Standard actions |
| `/tempban user duration` | Time-based ban, survives restarts |
| `/timeout` / `/untimeout` | Timeout management |
| `/warn` · `/warnings` · `/clearwarnings` | The warning system |
| `/lock` / `/unlock` | Channel lockdown |
| `/history user` | Full moderation history |
| `/case id` | One case's details |
| `/reason id text` | Amend a case's reason |

### ⚙️ Config & customization

| Command | Description |
|---|---|
| `/embedconfig footer/color/show` | Embed appearance |
| `/presence type text` | Bot activity status |
| `/botavatar url` · `/botname name` | Bot identity |
| `/automod config/filter/filters/list` | Auto-mod rules & word/link filters |
| `/thresholds add/remove/list` | Warning escalation ladder |
| `/perm grant/revoke/list/user` | Command-level permissions |
| `/welcome` · `/goodbye` | Join/leave embeds |
| `/rolemenu create/add/remove/publish/list` | Dropdown role menus |
| `/reactionrole add/remove/list` | Emoji reaction roles |
| `/invites check/top/stats` | Invite tracking |
| `/note add/list/edit/remove` | Staff notes |
| `/logs search` | Message-log search |

### 🎫 Tickets, temp voice & voice

| Command | Description |
|---|---|
| `/ticket` | Full panel/type system — `panel_create/delete/list/send`, `type_add/remove/list/category/role/welcome/question/question_remove/inactivity`, `blacklist_add/remove/list`, `config_show`, `toggle`, `close_on_leave`, `log_channel`, `add`, `remove`, `close`, `claim`, `rename` |
| `/tempvc` | `set/unset/name/list/panel/rename/limit/lock/unlock/claim` |
| `/vc` | Voice presence — `join/move/leave/status` (owner) |

### 👑 Owner

| Command | Description |
|---|---|
| `/dashboard` · `/dashaccess add/remove/list` | Dashboard link & access |
| `/server_leave server_id` | Force-leave a server |
| `/shutdown` | Graceful stop |

### 📊 Server stats

| Command | Description |
|---|---|
| `/serverstats add/remove/list` | Live counter channels (members/humans/bots/online/boosting/tier/channels/roles/emojis) |

### 🎁 Giveaways

| Command | Description |
|---|---|
| `/giveaway start` | Prize, duration, winners, description, required/banned roles, color, image |
| `/giveaway end id` · `reroll id` · `cancel id` · `list` | Manage them |

---

## The dashboard

The dashboard is where this stops feeling like a hobby bot. It's a full web UI — one single-page app, no reloads — that runs from the same process as the bot. Log in from a browser (`/dashboard` in Discord gives you the link) and you can run your whole server without touching Discord or a terminal.

**Two ways in:**

1. **Password** — the shared `DASHBOARD_PASSWORD` from your env
2. **Discord ID + token** — grant specific people access with `/dashaccess add @user`, and they log in with their Discord ID and a per-user token

### The pages

The UI is split into **server management** (pick a server you're in, then per-server tabs) and **global panels** (things that apply to all servers or the bot itself):

**Server tabs**

- **Mod tools** — search members, view member profiles (cases, notes, warnings, invites), warn / kick / ban / timeout from the browser, mod stats, server insights, invite leaderboard
- **Logging** — per-category channel routing and toggles, plus a **message search** that shows deleted/edited content with highlights
- **Server settings** — prefix, tracked channels, server name/icon display, compact mode
- **Greetings** — the visual welcome/goodbye editor with live preview
- **Auto-mod** — rule builder (thresholds, actions, durations), word/link filter management, channel/role exemptions, whole-config import/export
- **Reaction roles & role menus** — build, edit, delete, and publish from the browser
- **Tickets** — full panel CRUD with modals: create/edit/clone panels, add types, edit questions inline, reorder, preview what members will see, role-chip pickers, an unsaved-changes bar, frequently-used configs, and the recent-tickets view
- **Temp voice** — trigger channels, spawn categories, name templates, live temp-channel list with cleanup
- **Warning thresholds** — the escalation ladder as a form
- **Voice presence** — join/move/leave the bot's VC, set its status
- **Webhooks & API tokens** — create webhooks and API tokens for integrations
- **Rate limits** — configure per-command cooldowns from the UI

**Global panels**

- **Overview** — uptime, memory, members, message counters at a glance
- **Servers** — every server the bot is in, with per-server management entry
- **Audit trail** — the bot's own record of sensitive actions (config changes, permissions, deletions)
- **Ban appeals** — review open appeals, see ban context, approve/deny
- **Giveaways** — start/end/reroll/cancel with winner history
- **Reminders** — view and cancel any user's reminders
- **Command heatmap** — usage by hour × weekday
- **Server comparison** — activity across your servers
- **Bot activity** — uptime, memory, event counters over time
- **Error log** — the bot's console errors, searchable, filterable, with a clear button
- **Backups** — one-click SQLite backups with integrity verification and download
- **Dashboard access** — grant/revoke Discord-ID logins
- **Bot customization** — name, avatar, presence, brand name
- **Settings** — theme (dark/light), accent color, background image/upload, blur/glass effects, animations, font, border radius, compact mode, and a **look switcher** (Neo / Classic / Minimal)

**The polish that makes it feel like a real product:**

- **Ctrl+K command palette** for jumping anywhere
- **Keyboard shortcuts** throughout (details in the dashboard's shortcut list)
- **SSE live events** — the page updates in real time as messages get deleted or edited on the server
- **Mobile layout** — it's not a desktop-only afterthought; the sidebar collapses into a proper mobile nav
- Live previews everywhere (greetings, ticket panels, role menus), skeletons while loading, toasts for feedback

It's not a thin remote control for a handful of settings. The dashboard is where most of the bot is actually operated.

---

## Quick start

**You need:**

- **Node.js 20+**
- A bot application + token from the [Discord Developer Portal](https://discord.com/developers/applications)
- The bot invited with the `applications.commands` scope (for slash commands)

```bash
git clone <your-repo-url>
cd discord-bot
npm install
cp .env.example .env      # then fill in BOT_TOKEN, OWNER_ID, DASHBOARD_PASSWORD
npm start
```

Then, in your server, run **`/deploy` once** — and again after every update that adds or changes commands — so the command list stays in sync.

**Intents.** The bot uses a specific intent set. When you create the application, enable these in the Developer Portal (Bot → Privileged Gateway Intents):

- **Message Content** — needed for prefix commands and message filtering
- **Server Members** — needed for join/leave logging and member stats
- **Presence** — needed for presence-based features
- **Voice States** — voice events
- **Scheduled Events**, **Guild Moderation**, **Guild Expressions** — as used by the event handlers

The bot tells you in the boot logs if something's missing.

**First boot does:** DB schema creation → JSON-to-SQLite migration (if you have legacy files) → retention sweep catch-up → slash command registration (`/deploy` is also available manually) → dashboard server start.

---

## Configuration

All configuration is environment variables. Copy `.env.example` → `.env` and fill it in.

### Required

| Variable | What it's for |
|---|---|
| `BOT_TOKEN` | From the Discord Developer Portal |
| `OWNER_ID` | Your Discord user ID — gates owner commands and full dashboard access |
| `DASHBOARD_PASSWORD` | The dashboard login password (rate-limited: 10 attempts/min/IP) |

### Strongly recommended

| Variable | What it's for |
|---|---|
| `GUILD_ID` | Your server's ID — commands register there **instantly** instead of the ~1h global propagation |
| `DASHBOARD_URL` | Public URL of the dashboard, used by `/dashboard`. (Railway: `RAILWAY_PUBLIC_DOMAIN` is picked up automatically if unset) |
| `DATA_DIR` | Where all bot data lives. **If unset, data is wiped on every redeploy** (default `./data/`) — mount a persistent volume and point this at it |

### Optional

| Variable | Default | What it's for |
|---|---|---|
| `PORT` | `3000` | Dashboard HTTP port |
| `BRAND_NAME` | — | Shown in the dashboard footer |
| `UPLOADS_DIR` | `./uploads` | Where uploaded dashboard backgrounds go |

### Retired

The bot used to store JSON config files; it's **SQLite-only now**. These are no longer used: `CONFIG_PATH`, `REMINDERS_PATH`, `LOG_CHANNEL_ID`. If you have old JSON files from a pre-SQLite version, the bot migrates them into the database on first boot automatically.

---

## Data, storage & backups

### One file

Everything — configs, warnings, cases, tickets, logs, stats — lives in **one SQLite database** (`bot.db` inside `DATA_DIR`) accessed through `better-sqlite3`. No separate database server, no Redis, nothing to operate. It's 48 tables covering: guild configs, permissions, reaction roles, role menus, tickets (panels/types/messages/ratings/blacklist), warnings & thresholds, mod cases, temp bans, reminders, giveaways, invite tracking, staff notes, message logs, automod rules/filters, voice presence, temp VC, server stats, poll votes, dashboard users/tokens, audit trail, error logs, command usage, activity counts, and API tokens.

### Retention — the database doesn't grow forever

A daily sweeper (which also runs once at boot) prunes the tables that would otherwise grow unbounded:

| Table | Kept for |
|---|---|
| `command_usage` | 180 days |
| `activity_counts` (inactive entries) | 180 days |
| `ticket_messages` | 365 days after the ticket *closed* — transcripts are snapshotted at close, so the record survives |

Deliberately **not** pruned: invite stats (the leaderboard is the point), and per-guild daily member-growth snapshots (kept 90 days by the snapshot logic itself). The error log is capped at the most recent 500 entries.

### Backups

From the dashboard (System → Backups) you can create a backup **with an integrity check**, verify an existing backup, download it, and delete old ones. Backups are SQLite `VACUUM INTO` snapshots — safe to take while the bot is running.

---

## Architecture

**One process. That's the whole architecture.**

```
Discord ← discord.js v14 →  bot logic  →  SQLite (better-sqlite3)
                             ↕ shared
                        Express dashboard
```

The bot and the dashboard run in the same Node.js process and share one SQLite file. ~80–120 MB of RAM on a server with a few hundred members. No microservices, no separate database, no containers required. It's deliberately boring.

### The code, file by file

```
index.js                  Boot: client, intents, event wiring, graceful shutdown
src/
├── db.js                 SQLite schema, migrations, retention sweeper, backups
├── deploy.js             All 70 slash command definitions + registration
├── config.js             Per-guild config (defaults, load/cache)
├── permissions.js        /perm grants, cached per-guild
├── automod.js            Spam/mentions/words/links/caps engine
├── warnings.js           Warning system + threshold escalation
├── modCases.js           Numbered case system (history/case/reason)
├── tempBans.js           Restart-surviving temp ban sweeper
├── tickets.js            Ticket lifecycle: open, questions, claim, close, transcript
├── banAppeals.js         Appeal intake (dashboard-only review)
├── reactionRoles.js      Emoji reaction role matching
├── roleMenus.js          Dropdown role menu handling
├── tempVoice.js          Join-to-create voice channels
├── voicePresence.js      /vc voice presence (via @discordjs/voice)
├── serverStats.js        Live counter channels
├── giveaways.js          Giveaway loop + winner picking
├── reminders.js          Persistent DM reminders
├── invites.js            Invite-code tracking
├── stats.js              Growth snapshots, join/leave recording
├── staffNotes.js         Private staff notes
├── logging.js            The 16-category log dispatcher
├── logError.js           Error logging (DB + console)
├── helpers.js            Formatting, truncation, ownership checks
├── commands/             One file per command group (see the registry)
│   └── registry.js       Maps command names → handlers (the wiring hub)
├── events/               ready, messages, reactions, members, roles,
│                         server, voice, extras
└── dashboard.js          Express server: auth, ~138 API routes, static files
    dashboard/
    ├── index.html        The single page
    └── parts/            Frontend as real ES modules:
        00-entry.mjs      Imports all parts + window bridge
        01-foundation.mjs Pure foundation: state, helpers, boot chain
        02-ui-shell.mjs   Shell, tabs, server mgmt, greetings editor, log config
        03-mod-tools.mjs  Mod tools, profiles, insights, invites
        04-tickets.mjs    Ticket panel builder UI
        05-auto-mod.mjs   Auto-mod rules & filters UI
        06-reaction-roles.mjs
        07-voice.mjs      Voice presence, webhooks, API tokens
        08-temp-vc.mjs    Temp VC + warning thresholds + prefix + rate limits
        09-activity.mjs   Activity, comparisons, heatmap, ban appeals, reminders
        10-polls.mjs      Polls/announcements + keyboard & mobile support
```

### Things worth knowing if you read the code

- **The frontend used to be one ~4,100-line file.** It's now 10 ES modules under `src/dashboard/parts/` with explicit `import`/`export` boundaries, loaded as `<script type="module">`. Because module scope isn't global scope, the entry module attaches the ~166 functions that inline HTML handlers (`onclick="…"`) call to `window` — an explicit bridge instead of an accident. The conversion was mechanical and verified (acyclic graph, no unresolved names, strict-mode parse of every module).
- **`scripts/analyze-modules.mjs`** re-verifies the module graph: every part parses in strict mode, no unresolved names, no cycles, no implicit-global writes. Run it after touching the dashboard.
- **Every event handler is wrapped** so a rejected promise logs to the error DB instead of killing the process.
- **A circuit breaker** guards Discord API calls so a rate limit doesn't cascade into a crash loop.
- **Graceful shutdown** is real: it stops loops (giveaways, temp bans, retention, server stats, voice), closes the database, and exits cleanly.

### The memory leak that almost killed the project

Early on, one unremoved event listener made memory climb from 60 MB to 400+ MB within hours. Weeks of hunting, and it was one line. I nearly scrapped the whole thing over it. It's fixed — but it's also why this bot takes graceful shutdown and cleanup seriously, and why "it works on my machine for a day" was never an acceptable bar.

---

## Testing

**130 tests**, run with `node --test`, on every push via GitHub Actions (Node 20 **and** 22) alongside ESLint:

| Area | What's covered |
|---|---|
| `db.test.js` | Schema creation, migrations, retention pruning, backups |
| `deploy.test.js` | Command definitions are well-formed |
| `permissions` / `automod` | Permission grants & the rule engine |
| `tickets` / `banAppeals` | Ticket lifecycle, transcripts, appeals |
| `prefixCommands` | The prefix dispatcher |
| `dashboard.test.js` | Auth and API routes |
| `dashboard-frontend.test.js` | **The real frontend boots**: jsdom installs browser globals, dynamically imports the actual module graph, and asserts the whole boot chain — auth → config → every data loader → background engine → refresh loop — completes with zero uncaught errors |
| `giveaways` / `tempVoice` / `voicePresence` / `serverStats` | The background systems |

**What the tests do *not* cover — read this twice:** there is no real-browser end-to-end testing, no click-through automation, and the two biggest server files still have large untested surfaces. Green CI means *it doesn't obviously crash*, not *the new feature works in every browser*. The bot has shipped bugs that only showed up in production — one set of dashboard routes referenced functions that didn't exist, and static analysis found them months later. Take that as a fair warning about what "tested" means here.

**Development scripts:**

```bash
npm test          # run the full suite
npm run lint      # ESLint over everything
node scripts/analyze-modules.mjs   # verify the frontend module graph
```

---

## Security

The dashboard is the sensitive part, and it gets real treatment:

- **Rate-limited login** (10 attempts/min per IP)
- **Password or Discord-ID login** — password from env, or a per-user access token granted via `/dashaccess`
- **Constant-time password comparison**, random session tokens, sessions invalidated on access revocation
- **Fail-closed tenant scoping** on server routes — every `/api/server/:id/...` checks that the session may act on that server
- **Parameterized SQL everywhere** — no string-built queries into the database
- **Ephemeral replies** for sensitive commands; a granular permission system so trusted people get exactly the commands they need
- **`/server_leave`** to cut a server loose instantly
- **Audit trail** records sensitive dashboard/configuration actions

**The honest limits:** the primary auth is a shared dashboard password from an env var, sessions live in memory (gone on restart), and there's no per-user rate limiting beyond login. That's appropriate for a self-hosted bot; it is not enterprise SSO. Put the dashboard behind your host's auth or a VPN if you're paranoid, and don't reuse the password anywhere.

---

## Deploying

The bot is plain Node + a persistent folder. Any host that gives you both works.

### Railway (what I actually use)

1. New project → Deploy from GitHub repo.
2. Variables: `BOT_TOKEN`, `OWNER_ID`, `DASHBOARD_PASSWORD`, `GUILD_ID`, `DATA_DIR=/data`.
3. Volumes → add volume mounted at `/data` (**this is what makes data survive redeploys**).
4. Generate a domain in Settings → Networking (`DASHBOARD_URL` is set automatically from `RAILWAY_PUBLIC_DOMAIN`).

### Docker

```bash
docker build -t discord-bot .
docker run -p 3000:3000 --env-file .env -v /host/data:/data -e DATA_DIR=/data discord-bot
```

### Discloud / Fly.io / any VPS

It's Node + a folder that must persist. Discloud's app data folder, Fly volumes, or a plain systemd service on a VPS with a directory that survives restarts all work. The bot auto-registers slash commands at boot (`/deploy` available too) and the dashboard listens on `PORT`.

---

## Troubleshooting & FAQ

**Slash commands don't show up.**
Set `GUILD_ID` to your server and run `/deploy` (or restart). Global commands take up to an hour to appear; guild commands are instant.

**Everything resets on redeploy.**
`DATA_DIR` isn't set (or isn't pointing at a mounted volume). Default is `./data/` inside the project folder, which redeploys wipe. Mount a volume and set `DATA_DIR` to it.

**The bot doesn't see messages / joins / etc.**
Privileged intents (Message Content, Server Members, Presence) are off in the Developer Portal, or the bot isn't re-invited after they were enabled. The boot logs warn about this.

**A dashboard page shows "Failed to load".**
Check the error log panel in the dashboard — it's the bot's own console. The most common causes are API errors visible there.

**The bot won't boot and the error mentions SQLite.**
`better-sqlite3` is a native module — it must compile for your Node version (the project pins Node 20/22 in CI). Reinstall with `npm install` on the target machine.

**Can I run it in multiple servers?**
Yes — global commands work everywhere, configs are per-server, and the dashboard has a server switcher plus a server-comparison view.

**Does it survive restarts?**
Data-wise, yes: SQLite + restart-surviving temp bans, giveaways, and reminders. Session-wise, no: dashboard sessions are in memory, so you log in again after a restart.

---

## What it deliberately is not

No music. No leveling/XP. No economy. No dashboard-as-a-service, no SaaS, no "premium tier." The feature set is exactly what running a real community server needed — nothing was built to fill a pricing page. Tickets and appeals work and are in active use, but they could go deeper; a music or leveling system would be a separate project, not a v1.1.

---

## Reality check

Since the internet is full of READMEs that overpromise, here's the part nobody writes:

- **It works — and it's actually running.** This bot has been live in real servers, deployed continuously, with CI gating every push.
- **It's a solo project that grew fast.** Some server files are huge (the dashboard server alone is 3,300+ lines), and parts of the frontend are still legacy-style (`var`, one-letter names, HTML built by string concatenation). It's navigable and it works; it is not a showcase of perfect architecture. The frontend was split into modules but the code *inside* them is still old — that's honest, it's on the list, and every change is protected by the boot test.
- **1.0.0 means "it runs," not "it's done."** Version numbers here track *working*, not *polish*.
- **You are the SLA.** When it goes down, it's your host that went down. Backups, uptime, and security are yours to own — which is the whole point of self-hosting, but don't pretend otherwise.
- **Tests are a safety net, not a proof.** The suite is real and it has caught genuine bugs, but the highest-value verification is a human clicking through the dashboard in a browser — the thing no automated test here does yet.
- It's **proprietary** — you can run it and modify it for yourself, but not redistribute it. See the license.

If that trade sounds fair — owning everything, paying nothing monthly, in exchange for running it yourself — welcome. It's a good bot.

---

## Support & license

Found a bug or want something added? DM me on Discord: **.nlux.** (ID: 1200828694088917114).

This project is distributed under a **Proprietary License**. All rights reserved. See [LICENSE](LICENSE) for the full terms.

In short:
- ✅ Run it on your own Discord server(s), modify it for your own use
- ❌ Share or resell the source code

---

<div align="center">
Built by franc · Discord: .nlux. (1200828694088917114)
</div>
