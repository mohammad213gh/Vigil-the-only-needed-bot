// ──────────────────── Prefix Command Dispatcher ────────────────────
// One source of truth: a prefix message is wrapped in an interaction shim
// (src/prefixAdapter.js), parsed against the SAME deploy.js schema Discord
// uses, and executed through the SAME pipeline as slash commands
// (src/commandPipeline.js: cooldown → permission guard → handler → usage
// tracking → friendly errors). A fix to a slash handler automatically
// applies to its prefix twin — the two surfaces cannot drift.
//
// Only four commands keep bespoke prefix handlers below — giveaway,
// serverstats, vc and tempvc — because their prefix CLI surface is
// intentionally different from the slash options (flag syntax like
// --desc/--role, positional labels, member-voice fallbacks). They sit on
// top of the same service modules as their slash twins.

const { PermissionFlagsBits } = require('discord.js');
const { isOwner, parseDuration, formatDuration } = require('./helpers');
const { hasPermission } = require('./permissions');
const { runCommand } = require('./commandPipeline');
const { buildPrefixInteraction, buildGateShim } = require('./prefixAdapter');
const { commandRegistry } = require('./commands/registry');
const { logError } = require('./logError');

function checkOwnerOrPerm(message, commandName) {
    if (isOwner(message.author.id)) return true;
    if (hasPermission(message.guild.id, commandName, message.author.id)) return true;
    message.reply('❌ You don\'t have permission to use this command.');
    return false;
}

const handlers = {};

// ─── Giveaways (Prefix) ───

function parseGwFlags(args, startIdx) {
    // message.args is whitespace-split, so quoted multi-word flag values arrive as
    // separate tokens (e.g. --desc "Members only" → '"Members', 'only"'). Re-join
    // tokens that are inside quotes BEFORE parsing flags, then strip the quotes.
    const unquote = (s) => (typeof s === 'string' && s.length >= 2 && s.startsWith('"') && s.endsWith('"')) ? s.slice(1, -1) : s;
    const tokens = [];
    for (let i = startIdx; i < args.length; i++) {
        let a = args[i];
        if (a.startsWith('"') && !a.endsWith('"')) {
            const parts = [a];
            while (i + 1 < args.length && !args[i + 1].endsWith('"')) parts.push(args[++i]);
            if (i + 1 < args.length) parts.push(args[++i]);
            a = parts.join(' ');
        }
        tokens.push(a);
    }
    // Flags: --desc "..." --role @role --ban @role --color #hex --img <url>
    const flags = { desc: null, role: null, ban: null, color: null, img: null };
    const positional = [];
    for (let i = 0; i < tokens.length; i++) {
        const a = tokens[i];
        if (a === '--desc' || a === '--role' || a === '--ban' || a === '--color' || a === '--img') {
            const key = a.slice(2);
            const val = tokens[i + 1];
            if (val === undefined) { flags.error = 'Missing value for ' + a; return flags; }
            flags[key] = unquote(val);
            i++;
        } else {
            positional.push(unquote(a));
        }
    }
    flags.positional = positional;
    return flags;
}

function parseRoleMentionId(text) {
    if (!text) return null;
    const m = String(text).match(/^<@&(\d+)>$/);
    return m ? m[1] : (/^\d+$/.test(text) ? text : null);
}

handlers.giveaway = async (message) => {
    if (!checkOwnerOrPerm(message, 'giveaway')) return;
    const sub = message.args[0];
    const gw = require('./giveaways');
    const gid = message.guild.id;

    if (sub === 'start') {
        const flags = parseGwFlags(message.args, 1);
        if (flags.error) return message.reply('⚠️ ' + flags.error);
        const pos = flags.positional || [];
        const timeStr = pos[0];
        // winners is optional — only consume pos[1] as the winner count when numeric.
        let winners = 1, prizeIdx = 1;
        const w = parseInt(pos[1], 10);
        if (!isNaN(w)) { winners = Math.min(Math.max(w, 1), 20); prizeIdx = 2; }
        const prize = pos.slice(prizeIdx).join(' ');
        if (!timeStr || !prize) return message.reply('⚠️ Usage: `' + message.prefix + 'giveaway start <duration> [winners] <prize> [--desc "..."] [--role @role] [--ban @role] [--color #ff5500] [--img <url>]` — e.g. `' + message.prefix + 'giveaway start 1h 1 Nitro --desc "Members only" --role @Member --color #ff5500`');
        const ms = parseDuration(timeStr);
        if (!ms) return message.reply('⚠️ Invalid duration! Use e.g. `1h`, `30m`, `2d`, `1h30m`.');
        if (ms < 15000) return message.reply('⚠️ Minimum giveaway duration is 15 seconds.');
        if (flags.color && !gw.parseHexColor(flags.color)) return message.reply('⚠️ Invalid color! Use a hex like `#ff5500`.');
        const requiredRoleId = parseRoleMentionId(flags.role);
        const bannedRoleId = parseRoleMentionId(flags.ban);
        if (flags.role && !requiredRoleId) return message.reply('⚠️ Could not parse `--role` — use an @mention or a role ID.');
        if (flags.ban && !bannedRoleId) return message.reply('⚠️ Could not parse `--ban` — use an @mention or a role ID.');
        if (requiredRoleId && requiredRoleId === bannedRoleId) return message.reply('⚠️ A role cannot be both required and banned.');
        const g = gw.createGiveaway({
            guildId: gid, channelId: message.channel.id, prize, durationMs: ms, winners,
            hostId: message.author.id, hostTag: message.author.tag,
            description: flags.desc || null,
            requiredRoleIds: requiredRoleId ? [requiredRoleId] : [],
            bannedRoleIds: bannedRoleId ? [bannedRoleId] : [],
            color: flags.color || null,
            imageUrl: flags.img || null,
        });
        try {
            await gw.postGiveaway(message.channel, g);
            return message.reply('✅ Giveaway started! ID: `' + g.id + '` — ends in ' + formatDuration(ms));
        } catch (err) {
            gw.cancelGiveaway(g.id);
            return message.reply('❌ Failed: ' + err.message);
        }
    }

    if (sub === 'end' || sub === 'reroll' || sub === 'cancel') {
        const ref = message.args[1];
        if (!ref) return message.reply('⚠️ Usage: `' + message.prefix + 'giveaway ' + sub + ' <id|message-link>`');
        const g = gw.getGiveawayByMessageRef(ref);
        if (!g) return message.reply('⚠️ Giveaway not found. Use the ID from `;giveaway list` or paste the giveaway message link.');
        try {
            const res = sub === 'end' ? await gw.endGiveaway(g.id) : (sub === 'reroll' ? await gw.rerollGiveaway(g.id) : gw.cancelGiveaway(g.id));
            if (res.error) return message.reply('⚠️ ' + res.error);
            const done = sub === 'cancel' ? 'cancelled' : (sub === 'reroll' ? 'rerolled' : 'ended');
            return message.reply('✅ Giveaway ' + done + (res.winners && res.winners.length ? ' — winners: ' + res.winners.map(w => '<@' + w + '>').join(', ') : ''));
        } catch (err) {
            return message.reply('❌ Failed: ' + err.message);
        }
    }

    if (sub === 'list') {
        const list = gw.listGiveaways(gid, 10);
        if (!list.length) return message.reply('ℹ️ No giveaways in this server.');
        return message.reply('**🎉 Giveaways**\n' + list.map(g => '`' + g.id + '` — **' + g.prize + '** (' + g.status + (g.status === 'active' ? ', ends <t:' + Math.floor(g.ends_at / 1000) + ':R>' : '') + ')').join('\n'));
    }

    return message.reply('⚠️ Usage: `' + message.prefix + 'giveaway start <duration> [winners] <prize> [flags]` | `end <id|link>` | `reroll <id|link>` | `cancel <id|link>` | `list`');
};

// ─── Server Stats (Prefix) ───

handlers.serverstats = async (message) => {
    if (!checkOwnerOrPerm(message, 'serverstats')) return;
    const sub = message.args[0];
    const ss = require('./serverStats');
    const gid = message.guild.id;

    const typesList = Object.keys(ss.STAT_TYPES).join(', ');

    if (sub === 'add') {
        const type = message.args[1];
        const chanArg = message.args[2];
        const label = message.args.slice(3).join(' ').trim() || null;
        if (!type || !chanArg) {
            return message.reply('⚠️ Usage: `' + message.prefix + 'serverstats add <type> #channel [label]`\nTypes: ' + typesList);
        }
        if (!ss.STAT_TYPES[type]) {
            return message.reply('⚠️ Unknown type `' + type + '`. Valid: ' + typesList);
        }
        const m = String(chanArg).match(/^<#(\d+)>$/);
        const chanId = (m && m[1]) || String(chanArg);
        const channel = message.guild.channels.cache.get(chanId);
        if (!channel) return message.reply('⚠️ Channel not found — mention it like `#channel` or paste its ID.');
        if (channel.type === 4) return message.reply('⚠️ Categories can\'t hold a counter — pick a voice or text channel.');
        if (channel.isThread && channel.isThread()) return message.reply('⚠️ Threads can\'t hold a counter — pick a voice or text channel.');
        const res = ss.setServerStat(gid, channel.id, type, label);
        if (res.error) return message.reply('❌ ' + res.error);
        try { await ss.refreshGuildStats(message.guild); } catch {}
        const value = ss.computeStat(message.guild, message.guild.members, type);
        const note = type === 'online' && value === 0 ? '\nℹ️ The **online** counter needs the **Presence Intent** enabled in the Discord Developer Portal to show live numbers.' : '';
        return message.reply('✅ Counter set on <#' + channel.id + '> — now named **' + ss.formatStatName(type, value, label) + '**' + note);
    }

    if (sub === 'remove') {
        const chanArg = message.args[1];
        if (!chanArg) return message.reply('⚠️ Usage: `' + message.prefix + 'serverstats remove #channel`');
        const m = String(chanArg).match(/^<#(\d+)>$/);
        const chanId = (m && m[1]) || String(chanArg);
        const channel = message.guild.channels.cache.get(chanId);
        if (!channel) return message.reply('⚠️ Channel not found.');
        ss.removeServerStat(gid, channel.id);
        return message.reply('✅ Stopped updating <#' + channel.id + '>.');
    }

    if (sub === 'list') {
        const rows = ss.getServerStats(gid);
        if (!rows.length) return message.reply('ℹ️ No stat channels configured. Types: ' + typesList);
        const lines = rows.map(r => {
            const value = ss.computeStat(message.guild, message.guild.members, r.stat_type);
            return '• <#' + r.channel_id + '> → **' + ss.formatStatName(r.stat_type, value, r.label) + '**';
        }).join('\n');
        return message.reply('**📊 Server Stat Channels**\n' + lines);
    }

    return message.reply('⚠️ Usage: `' + message.prefix + 'serverstats add <type> #channel [label]` | `remove #channel` | `list`\nTypes: ' + typesList);
};

// ─── Voice Presence (Prefix) ───

handlers.vc = async (message) => {
    if (!checkOwnerOrPerm(message, 'vc')) return;
    const sub = (message.args[0] || '').toLowerCase();
    const vp = require('./voicePresence');
    const guild = message.guild;

    const usage = '⚠️ Usage: `' + message.prefix + 'vc join [#channel]` | `move #channel` | `status <text>` | `leave`';

    if (sub === 'join') {
        let channel = null;
        const chanArg = message.args[1];
        if (chanArg) {
            const m = String(chanArg).match(/^<#(\d+)>$/);
            const chanId = (m && m[1]) || String(chanArg);
            channel = guild.channels.cache.get(chanId);
            if (!channel) return message.reply('⚠️ Channel not found — mention it like `#channel` or paste its ID.');
        } else {
            channel = message.member.voice && message.member.voice.channel ? message.member.voice.channel : null;
            if (!channel) return message.reply('⚠️ You\'re not in a voice channel. Join one first, or pass one: `' + message.prefix + 'vc join #channel`');
        }
        if (!vp.isVoiceChannel(channel)) return message.reply('⚠️ That\'s not a voice channel.');
        const perms = channel.permissionsFor(guild.members.me);
        if (!perms || !perms.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.ViewChannel)) {
            return message.reply('⚠️ The bot can\'t join <#' + channel.id + '> — missing **View Channel** or **Connect** permission.');
        }
        try {
            await vp.joinChannel(guild, channel, null);
        } catch (err) {
            if (err.code === 'ALREADY_THERE') return message.reply('🎧 I\'m already in **' + channel.name + '**.');
            const msg = String(err.message || err);
            if (msg.includes('Target user is not connected to voice')) {
                return message.reply('❌ The bot couldn\'t connect — the voice library (@discordjs/voice) isn\'t loaded. Restart the bot after `npm install` to fix this.');
            }
            return message.reply('❌ Failed to join: ' + msg);
        }
        return message.reply('🎧 Joined **' + channel.name + '** and I\'m staying. Use `' + message.prefix + 'vc status <text>` to flex a custom "Listening to" line.');
    }

    if (sub === 'move') {
        const chanArg = message.args[1];
        if (!chanArg) return message.reply(usage);
        const m = String(chanArg).match(/^<#(\d+)>$/);
        const chanId = (m && m[1]) || String(chanArg);
        const channel = guild.channels.cache.get(chanId);
        if (!channel) return message.reply('⚠️ Channel not found.');
        if (!vp.isVoiceChannel(channel)) return message.reply('⚠️ That\'s not a voice channel.');
        try {
            await vp.moveChannel(guild, channel);
        } catch (err) {
            return message.reply('❌ ' + (err.message || err));
        }
        return message.reply('🎧 Moved to **' + channel.name + '**.');
    }

    if (sub === 'leave') {
        await vp.leaveChannel(guild);
        return message.reply('👋 Left the voice channel. The aura has been stored for later.');
    }

    if (sub === 'status') {
        const text = message.args.slice(1).join(' ').trim();
        try {
            const clean = await vp.setStatusText(guild, text);
            if (clean === null) return message.reply('🎧 Status reset — back to "Listening to <channel name>".');
            return message.reply('🎧 Now "Listening to **' + clean + '**".');
        } catch (err) {
            return message.reply('❌ ' + (err.message || err));
        }
    }

    return message.reply(usage);
};

// ─── Temp Voice Channels (Prefix) ───

handlers.tempvc = async (message) => {
    const tv = require('./tempVoice');
    const guild = message.guild;
    const sub = (message.args[0] || '').toLowerCase();
    const adminSubs = ['set', 'unset', 'name', 'list', 'panel'];

    if (adminSubs.includes(sub) && !checkOwnerOrPerm(message, 'tempvc')) return;

    const usage = '⚠️ Usage: `' + message.prefix + 'tempvc set #channel [category]` | `unset [#channel]` | `name <template>` | `list` | `rename <name>` | `limit <n>` | `lock` | `unlock` | `claim`';

    // Helpers
    const parseChannel = (arg) => {
        if (!arg) return null;
        const m = String(arg).match(/^<#(\d+)>$/);
        const id = (m && m[1]) || String(arg);
        const ch = guild.channels.cache.get(id);
        return ch || null;
    };
    const getMemberChannel = () => {
        const vcId = message.member.voice && message.member.voice.channelId;
        if (vcId) {
            const row = tv.getSpawnedChannel(vcId);
            if (row) {
                const ch = guild.channels.cache.get(vcId);
                if (ch) return { row, channel: ch };
            }
        }
        const owned = tv.getSpawnedByOwner(guild.id, message.author.id);
        if (owned) {
            const ch = guild.channels.cache.get(owned.channel_id);
            if (ch) return { row: owned, channel: ch };
        }
        return null;
    };

    if (sub === 'set') {
        const channel = parseChannel(message.args[1]);
        const category = parseChannel(message.args[2]);
        if (!channel) return message.reply('⚠️ Usage: `' + message.prefix + 'tempvc set #channel [category]`');
        if (!tv.isVoiceChannel(channel)) return message.reply('⚠️ The trigger must be a voice channel.');
        if (category && category.type !== 4) return message.reply('⚠️ The second arg must be a category.');
        tv.setTrigger(guild.id, channel.id, category ? category.id : null);
        return message.reply('✅ <#' + channel.id + '> is now a **join-to-create** trigger' + (category ? ' (spawns in **' + category.name + '**)' : '') + '.');
    }

    if (sub === 'unset') {
        const channel = parseChannel(message.args[1]);
        if (channel) {
            tv.removeTrigger(guild.id, channel.id);
            return message.reply('✅ Removed <#' + channel.id + '> as a trigger.');
        }
        const triggers = tv.getTriggers(guild.id);
        for (const t of triggers) tv.removeTrigger(guild.id, t.channel_id);
        return message.reply(triggers.length ? '✅ Removed all **' + triggers.length + '** triggers.' : 'ℹ️ No triggers configured.');
    }

    if (sub === 'name') {
        const template = message.args.slice(1).join(' ').trim();
        if (!template) return message.reply('⚠️ Usage: `' + message.prefix + 'tempvc name <template>` — placeholders `{name}` and `{number}`.');
        const res = tv.setConfig(guild.id, template);
        if (res.error) return message.reply('❌ ' + res.error);
        return message.reply('✅ Name template set to **' + res.name_template + '**.');
    }

    if (sub === 'list') {
        const triggers = tv.getTriggers(guild.id);
        const spawned = tv.getSpawned(guild.id);
        const tLines = [];
        for (const t of triggers) {
            const ch = guild.channels.cache.get(t.channel_id);
            if (!ch) { tv.removeTrigger(guild.id, t.channel_id); continue; }
            tLines.push('• <#' + t.channel_id + '>' + (t.category_id ? ' → <#' + t.category_id + '>' : ''));
        }
        const sLines = [];
        for (const s of spawned) {
            const ch = guild.channels.cache.get(s.channel_id);
            if (!ch) { tv.removeSpawned(s.channel_id); continue; }
            const owner = guild.members.cache.get(s.owner_id);
            sLines.push('• <#' + s.channel_id + '> → ' + (owner ? String(owner.user) : '`' + s.owner_id + '`') + (ch.members && ch.members.size ? ' (' + ch.members.size + ' in it)' : ' (empty)'));
        }
        if (!tLines.length && !sLines.length) return message.reply('ℹ️ No temp voice channels configured. Use `' + message.prefix + 'tempvc set #channel`.');
        return message.reply('**🎙️ Temp Voice Channels**\n' + (tLines.length ? '**Triggers:**\n' + tLines.join('\n') + '\n' : '') + (sLines.length ? '**Live:**\n' + sLines.join('\n') : ''));
    }

    if (sub === 'panel') {
        let channel = message.channel;
        const chanArg = message.args[1];
        if (chanArg) {
            const m = String(chanArg).match(/^<#(\d+)>$/);
            const chanId = (m && m[1]) || String(chanArg);
            const ch = guild.channels.cache.get(chanId);
            if (!ch || !ch.isTextBased || !ch.isTextBased()) return message.reply('⚠️ Pick a text channel to send the panel to.');
            channel = ch;
        }
        try {
            const msg = await channel.send(tv.buildPanelMessage(guild));
            tv.registerPanel(guild.id, channel.id, msg.id);
            return message.reply('🎙️ Control panel sent to ' + channel + '. It now updates live as channels are created, locked, or deleted.');
        } catch (err) {
            return message.reply('❌ Failed to send the panel: ' + (err.message || err));
        }
    }

    if (sub === 'rename' || sub === 'limit' || sub === 'lock' || sub === 'unlock') {
        const found = getMemberChannel();
        if (!found) return message.reply('⚠️ You\'re not in a temp voice channel (and don\'t own one).');
        if (found.row.owner_id !== message.author.id && !isOwner(message.author.id)) {
            return message.reply('⚠️ Only the channel owner can do that. Owner gone? Use `' + message.prefix + 'tempvc claim`.');
        }
        const { channel } = found;
        if (sub === 'rename') {
            const name = message.args.slice(1).join(' ').trim().slice(0, tv.MAX_CHANNEL_NAME);
            if (!name) return message.reply('⚠️ Usage: `' + message.prefix + 'tempvc rename <name>`');
            try { await channel.setName(name, 'Temp VC renamed'); return message.reply('✅ Renamed to **' + name + '**.'); }
            catch (err) { return message.reply('❌ Failed to rename: ' + (err.message || err)); }
        }
        if (sub === 'limit') {
            const n = parseInt(message.args[1], 10);
            if (isNaN(n) || n < 0 || n > 99) return message.reply('⚠️ Usage: `' + message.prefix + 'tempvc limit <0-99>`');
            try { await channel.setUserLimit(n, 'Temp VC user limit'); return message.reply(n === 0 ? '✅ User limit cleared (unlimited).' : '✅ User limit set to **' + n + '**.', ); }
            catch (err) { return message.reply('❌ Failed to set limit: ' + (err.message || err)); }
        }
        const locked = sub === 'lock';
        try {
            const everyone = guild.roles.everyone;
            if (locked) {
                await channel.permissionOverwrites.edit(everyone, { Connect: false }, 'Temp VC locked');
                await channel.permissionOverwrites.edit(message.member, { Connect: true }, 'Temp VC owner');
                tv.updatePanels(guild).catch(() => {});
                return message.reply('🔒 Channel locked — only you can join now.');
            }
            const eow = channel.permissionOverwrites.cache.get(everyone.id);
            if (eow && eow.deny.has(PermissionFlagsBits.Connect)) await channel.permissionOverwrites.delete(everyone, 'Temp VC unlocked');
            const mow = channel.permissionOverwrites.cache.get(message.member.id);
            if (mow && mow.allow.has(PermissionFlagsBits.Connect)) await channel.permissionOverwrites.delete(message.member, 'Temp VC unlocked');
            tv.updatePanels(guild).catch(() => {});
            return message.reply('🔓 Channel unlocked — everyone can join.');
        } catch (err) { return message.reply('❌ Failed to ' + sub + ': ' + (err.message || err)); }
    }

    if (sub === 'claim') {
        const vcId = message.member.voice && message.member.voice.channelId;
        if (!vcId) return message.reply('⚠️ You need to be inside a temp voice channel to claim it.');
        const row = tv.getSpawnedChannel(vcId);
        if (!row) return message.reply('⚠️ This isn\'t a temp voice channel.');
        const claimChannel = guild.channels.cache.get(vcId);
        // channel.members is authoritative for who is in the VC (the members
        // cache can miss the owner on large servers).
        if (claimChannel && claimChannel.members && claimChannel.members.has(row.owner_id)) {
            return message.reply('⚠️ The owner is still here — no need to claim.');
        }
        tv.addSpawned(vcId, guild.id, message.author.id, row.trigger_id);
        tv.cancelDeletion(vcId);
        tv.updatePanels(guild).catch(() => {});
        return message.reply('👑 You now own this channel.');
    }

    return message.reply(usage);
};

// ──────────────────── Dispatch ────────────────────

// Legacy prefix aliases → slash subcommands (same handler as /stats server)
const ALIASES = {
    server: { command: 'stats', sub: 'server' },
    growth: { command: 'stats', sub: 'growth' },
};

async function handlePrefixMessage(message, prefix) {
    const content = message.content;
    if (!content.startsWith(prefix)) return false;

    const afterPrefix = content.slice(prefix.length).trim();
    if (!afterPrefix) return false;

    const parts = afterPrefix.split(/\s+/);
    let cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Attach parsed data for the bespoke handlers above
    message.prefix = prefix;
    message.args = args;
    message.restArgs = args;

    const alias = ALIASES[cmdName];
    if (alias) cmdName = alias.command;

    // Bespoke prefix surface (guard/cooldown/errors still go through the
    // shared pipeline — only argument parsing stays message-based here)
    if (handlers[cmdName]) {
        const legacy = handlers[cmdName];
        try {
            await runCommand(buildGateShim(message, cmdName), () => legacy(message));
        } catch (err) {
            logError(err, 'prefixCommands', cmdName);
            message.reply('⚠️ An error occurred while executing that command.').catch(() => {});
        }
        return true;
    }

    if (!commandRegistry[cmdName]) return false;

    // Everything else: same handler as the slash command, same pipeline
    const built = buildPrefixInteraction(message, cmdName, args, prefix, alias ? alias.sub : undefined);
    if (built.unknown) return false;
    if (built.usage) {
        await message.reply(built.usage).catch(() => {});
        return true;
    }

    try {
        await runCommand(built.shim);
    } catch (err) {
        logError(err, 'prefixCommands', cmdName);
        message.reply('⚠️ An error occurred while executing that command.').catch(() => {});
    }
    return true;
}

module.exports = { handlePrefixMessage, prefixHandlers: handlers, parseGwFlags };
