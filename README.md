<div align="center">

# Discord Bot

**A server management bot with logging, moderation, web dashboard, and more**

</div>

---

## What it does

This is a Discord bot I built for my own server because I got tired of premium bots locking features behind paywalls. It does logging, moderation, reaction roles, reminders, fun commands, and has a web dashboard where you can manage everything.

---

## Quick Start

### You'll need
- **Node.js 20+**
- A **Discord bot token** from the [Developer Portal](https://discord.com/developers/applications)
- Somewhere to host it (I recommend Railway, it's free and easy)

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

## Features

### 📊 Web Dashboard
- See live bot status, uptime, memory usage
- Browse your servers, view roles and channels
- Toggle log categories on/off per server
- Check audit logs without leaving your browser
- Fully customizable — themes, accent colors, background effects, card styles, animation speed
- Rate-limited login so nobody can brute force your password

### 📝 Logging
Tracks about 40 different Discord events across 16 categories: messages, reactions, members, roles, server changes, voice, threads, emojis, bans, invites, stickers, automod, scheduled events, stage, webhooks, integrations. Each category can go to a different channel, and you can toggle them on/off whenever you want.

### 🛡️ Moderation
Kick, ban, unban, timeout, untimeout, warn, clear warnings, lock, unlock, purge messages, set slowmode, change nicknames. Pretty much everything you'd reach for as a mod.

### 👥 Reaction Roles
Set up self-assignable roles so members can pick what they want. Works with custom emojis too.

### ⏰ Reminders
Users can set reminders with `/remindme 30s do the thing` and the bot will DM them when time's up.

### 🎮 Fun Commands
8ball, coinflip, dice, rock-paper-scissors, jokes, facts, advice, quotes, reverse text, mock text, random numbers, and a World Cup match predictor.

### 🛠️ Other Stuff
- Permission system so you can grant specific commands to trusted users without making them owner
- Bot customization — change name, avatar, and presence from Discord or the dashboard
- Server growth stats with daily snapshots
- Graceful shutdown so data doesn't corrupt when the bot stops

---

## Hosting

### Railway (what I use)
1. Push to GitHub and connect the repo on Railway
2. Go to **Volumes** → **Add Volume** → mount at `/data`
3. Set your env vars: `BOT_TOKEN`, `OWNER_ID`, `DASHBOARD_PASSWORD`, `DATA_DIR=/data`
4. Go to **Settings** → **Networking** → **Generate Domain** for the dashboard
5. Done

### Docker
```bash
docker build -t discord-bot .
docker run -p 3000:3000 --env-file .env -v /host/data:/data discord-bot
```

### Fly.io or Discloud
Should work fine. Just set the env vars and make sure `DATA_DIR` points to persistent storage.

---

## Data Persistence

Everything saves to a single SQLite database (`bot.db`) inside your `DATA_DIR`. That means warnings, configs, stats, reminders, dashboard settings — they all survive redeploys as long as `DATA_DIR` is set to a persistent path.

On Railway this means setting up a volume. It takes 2 minutes and you never lose data again.

---

## Commands

### Anyone can use these
`/ping` `/status` `/botinfo` `/userinfo` `/avatar` `/stats server` `/stats growth` `/worldcup` `/8ball` `/coinflip` `/dice` `/rps` `/joke` `/fact` `/advice` `/quote` `/reverse` `/mock` `/random` `/remindme` `/reminders list` `/reminders cancel`

### Owner-only (unless you grant permissions)
**Logging:** `/log channel` `/log toggle` `/log list`
**Config:** `/embedconfig` `/presence` `/botavatar` `/botname`
**Moderation:** `/kick` `/ban` `/unban` `/timeout` `/untimeout` `/warn` `/warnings` `/clearwarnings` `/lock` `/unlock`
**Admin:** `/role` `/purge` `/slowmode` `/nickname` `/say` `/embed` `/deploy` `/track` `/poll` `/announce`
**Permissions:** `/perm grant` `/perm revoke` `/perm list` `/perm user`
**Reaction Roles:** `/reactionrole add` `/reactionrole remove` `/reactionrole list`
**Other:** `/dashboard` `/dashaccess` `/shutdown`

Use `/perm grant @user command` to let trusted people use specific commands without making them full owners.

---

## Found a bug?

DM me on Discord: **.nlux.** (ID: 1200828694088917114)

---

<div align="center">
Built for personal use, sharing in case it helps someone else.
</div>
