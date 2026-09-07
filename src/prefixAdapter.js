// ──────────────────── Prefix → Interaction Adapter ────────────────────
// Lets the prefix dispatcher reuse the exact same slash command handlers.
// A prefix message (;kick @user spamming) is wrapped in a minimal object
// that speaks the subset of the discord.js Interaction API the command
// handlers actually use (option getters + reply/editReply/followUp/
// deferReply). Argument tokens are mapped onto the command's option
// definitions from deploy.js, so the two command surfaces can't drift:
// the prefix parser reads the same schema Discord does.
//
// Commands whose prefix CLI surface deliberately differs from their slash
// twin (flag syntax, pipe separators, member-VC fallbacks) get a custom
// parser below; everything else is parsed positionally from the schema.

const { commandDefs } = require('./deploy');

// ──────────────────── Mention / ID parsing ────────────────────

const MENTION_RE = /^<(@!?|#|@&)(\d+)>$/;
const ID_RE = /^\d{15,25}$/;

function extractId(tok) {
    if (typeof tok !== 'string') return null;
    const m = tok.match(MENTION_RE);
    if (m) return m[2];
    return ID_RE.test(tok) ? tok : null;
}

function isBlank(v) {
    return v === null || v === undefined;
}

function parseBool(tok) {
    const t = String(tok).toLowerCase();
    if (['true', '1', 'yes', 'on', 'enable', 'enabled', 'y'].includes(t)) return true;
    if (['false', '0', 'no', 'off', 'disable', 'disabled', 'n'].includes(t)) return false;
    return null;
}

// ──────────────────── Object resolution ────────────────────
// Resolve mentions/IDs against real caches where possible; fall back to
// minimal stand-ins so handlers don't crash on stale IDs. Real discord.js
// objects win when available (they carry send/toString/roles etc.).

const PLACEHOLDER_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';

function normalizeUser(u) {
    if (u && u.id && typeof u.toString === 'function' && typeof u.displayAvatarURL === 'function') return u;
    const id = (u && u.id) || '0';
    return {
        id,
        username: (u && (u.username || u.tag)) || 'Unknown',
        tag: (u && (u.tag || u.username)) || 'Unknown#0000',
        bot: !!(u && u.bot),
        createdTimestamp: (u && u.createdTimestamp) || 0,
        toString: () => '<@' + id + '>',
        displayAvatarURL: () => PLACEHOLDER_AVATAR,
    };
}

function resolveUser(id, message) {
    const member = message.guild?.members?.cache?.get(id);
    if (member?.user) return member.user;
    return normalizeUser({ id, tag: 'Unknown#' + id.slice(-4) });
}

function resolveRole(id, message) {
    const role = message.guild?.roles?.cache?.get(id);
    if (role) return role;
    return {
        id,
        name: id,
        managed: false,
        position: 0,
        toString: () => '<@&' + id + '>',
        comparePositionTo: () => 0,
    };
}

function resolveChannel(id, message) {
    const fromGuild = message.guild?.channels?.cache?.get(id);
    if (fromGuild) return fromGuild;
    const fromClient = message.client?.channels?.cache?.get(id);
    if (fromClient) return fromClient;
    return {
        id,
        name: id,
        toString: () => '<#' + id + '>',
        isTextBased: () => true,
        send: async () => { throw new Error('That channel could not be found (check the #mention or ID).'); },
    };
}

// ──────────────────── Command schema (from deploy.js) ────────────────────

let schemaCache = null;

function getSchemas() {
    if (schemaCache) return schemaCache;
    const schemas = {};
    for (const def of commandDefs) {
        const subs = (def.options || []).filter(o => o.type === 1 || o.type === 2);
        if (subs.length === 0) {
            schemas[def.name] = { options: def.options || [] };
        } else {
            const subcommands = {};
            for (const s of subs) {
                if (s.type === 2) { // subcommand group
                    for (const g of s.options || []) subcommands[g.name] = { options: g.options || [] };
                } else {
                    subcommands[s.name] = { options: s.options || [] };
                }
            }
            schemas[def.name] = { subcommands };
        }
    }
    schemaCache = schemas;
    return schemas;
}

// ──────────────────── Positional option parsing ────────────────────
// Consumes tokens in schema order: mentions/ids for USER/CHANNEL/ROLE,
// single tokens for choices/ints/bools, and the whole rest for the last
// free-text STRING option. A token that doesn't fit stops the parse (the
// caller turns that into a usage reply).

function parseOptions(args, opts, message) {
    const values = {};
    let rest = [...args];
    for (let i = 0; i < opts.length; i++) {
        const opt = opts[i];
        if (rest.length === 0) break;
        const tok = rest[0];
        switch (opt.type) {
            case 6: { // USER
                const id = extractId(tok);
                if (!id) return { usage: true };
                values[opt.name] = resolveUser(id, message);
                rest.shift();
                break;
            }
            case 7: { // CHANNEL
                const id = extractId(tok);
                if (!id) return { usage: true };
                values[opt.name] = resolveChannel(id, message);
                rest.shift();
                break;
            }
            case 8: { // ROLE
                const id = extractId(tok);
                if (!id) return { usage: true };
                values[opt.name] = resolveRole(id, message);
                rest.shift();
                break;
            }
            case 5: { // BOOLEAN
                const b = parseBool(tok);
                if (b === null) return { usage: true };
                values[opt.name] = b;
                rest.shift();
                break;
            }
            case 4: { // INTEGER
                const n = Number.parseInt(tok, 10);
                if (Number.isNaN(n)) return { usage: true };
                values[opt.name] = n;
                rest.shift();
                break;
            }
            case 10: { // NUMBER
                const n = Number.parseFloat(tok);
                if (Number.isNaN(n)) return { usage: true };
                values[opt.name] = n;
                rest.shift();
                break;
            }
            case 3: { // STRING
                if (opt.choices && opt.choices.length > 0) {
                    // Choices are strict: a token that matches no choice value
                    // ends the positional parse here — the caller may absorb
                    // the remaining tokens into an earlier free-text option
                    // (e.g. `;ban @user <multi-word reason>`).
                    const tokLower = String(tok).toLowerCase();
                    const matched = opt.choices.some(c => String(c.value).toLowerCase() === tokLower);
                    if (!matched) return { values, leftover: rest };
                    values[opt.name] = tok;
                    rest.shift();
                } else if (i === opts.length - 1) {
                    values[opt.name] = rest.join(' ');
                    rest = [];
                } else {
                    values[opt.name] = tok;
                    rest.shift();
                }
                break;
            }
            default:
                rest.shift();
                break;
        }
    }
    return { values, leftover: rest };
}

// ──────────────────── Custom parsers ────────────────────
// Commands whose prefix syntax predates (or intentionally differs from)
// the slash option layout. Each receives the args after the subcommand
// token (or the full args for non-subcommand commands) and returns
// { values } or { usage: true }.

function parsePipeCommand(args, names) {
    const parts = args.join(' ').split('|').map(s => s.trim());
    const values = {};
    for (let i = 0; i < names.length; i++) values[names[i]] = parts[i] || null;
    return { values };
}

function parseChannelArg(arg, message) {
    const id = extractId(arg);
    if (!id) return null;
    return resolveChannel(id, message);
}

function parseEmbedArgs(args, message, messageName) {
    if (args.length === 0) return { usage: true };
    const channel = parseChannelArg(args[0], message);
    const parts = args.slice(1).join(' ').split('|').map(s => s.trim());
    return {
        values: {
            channel,
            title: parts[0] || null,
            [messageName]: parts[1] || null,
            color: parts[2] || null,
        },
    };
}

function parseLogsSearchArgs(args, message) {
    const values = { user: null, keyword: null, action: null, limit: null };
    for (const a of args) {
        if (!values.keyword && a.startsWith('keyword:')) values.keyword = a.slice(8);
        else if (!values.action && a.startsWith('action:')) values.action = a.slice(7);
        else if (!values.limit && a.startsWith('limit:')) values.limit = Number.parseInt(a.slice(6), 10) || null;
        else if (!values.user) {
            const id = extractId(a);
            if (id) values.user = resolveUser(id, message);
        }
    }
    return { values };
}

function parseGreetingFooterArgs(args, iconName) {
    const text = args.length > 0 ? args.join(' ') : null;
    return { values: { text, [iconName]: null } };
}

function parseHelpArgs(args) {
    const helpSchema = getSchemas().help;
    const catOpt = (helpSchema.options || []).find(o => o.name === 'category');
    const cats = (catOpt?.choices || []).map(c => String(c.value));
    const first = (args[0] || '').toLowerCase();
    if (first && cats.includes(first)) {
        return { values: { command: null, category: first } };
    }
    return { values: { command: first || null, category: null } };
}

const CUSTOM_PARSERS = {
    poll: (args) => parsePipeCommand(args, ['question', 'option1', 'option2', 'option3', 'option4']),
    embed: (args, message) => parseEmbedArgs(args, message, 'description'),
    announce: (args, message) => parseEmbedArgs(args, message, 'message'),
    'logs:search': (args, message) => parseLogsSearchArgs(args, message),
    help: (args) => parseHelpArgs(args),
    'embedconfig:footer': (args) => ({ values: { text: args.length > 0 ? args.join(' ') : null, icon: null } }),
    'welcome:footer': (args) => parseGreetingFooterArgs(args, 'icon'),
    'goodbye:footer': (args) => parseGreetingFooterArgs(args, 'icon'),
    'welcome:author': (args) => parseGreetingFooterArgs(args, 'icon'),
    'goodbye:author': (args) => parseGreetingFooterArgs(args, 'icon'),
};

// ──────────────────── Usage strings ────────────────────

const USAGE_OVERRIDES = {
    poll: (prefix) => '`' + prefix + 'poll <question> | <option1> | <option2> [| option3] [| option4]`',
    embed: (prefix) => '`' + prefix + 'embed #channel <title> | <description> | #color`',
    announce: (prefix) => '`' + prefix + 'announce #channel <title> | <message> | #color`',
    'logs:search': (prefix) => '`' + prefix + 'logs search [@user] [keyword:<text>] [action:deleted|edited] [limit:<num>]`',
    'embedconfig:footer': (prefix) => '`' + prefix + 'embedconfig footer <text>`',
    'welcome:footer': (prefix) => '`' + prefix + 'welcome footer <text> [icon_url]`',
    'goodbye:footer': (prefix) => '`' + prefix + 'goodbye footer <text> [icon_url]`',
    'welcome:author': (prefix) => '`' + prefix + 'welcome author <name> [icon_url]`',
    'goodbye:author': (prefix) => '`' + prefix + 'goodbye author <name> [icon_url]`',
};

function buildUsage(prefix, commandName, sub, opts) {
    const key = commandName + ':' + (sub || '');
    const override = USAGE_OVERRIDES[key] || USAGE_OVERRIDES[commandName];
    if (override) return '⚠️ Usage: ' + override(prefix);
    const sig = opts.map(o => (o.required ? '<' + o.name + '>' : '[' + o.name + ']')).join(' ');
    return '⚠️ Usage: `' + prefix + commandName + (sub ? ' ' + sub : '') + (sig ? ' ' + sig : '') + '`';
}

function buildSubUsage(prefix, commandName, subNames) {
    return '⚠️ Usage: `' + prefix + commandName + ' <' + subNames.join('|') + '>`';
}

// After a positional parse that stopped early, any unconsumed tokens most
// likely belong to a free-text option the user wrote after skipping an
// optional one (classic case: `;ban @user why they did it` — `why they
// did it` lands after the choices-only delete_messages option). Append
// them to the last filled free-text STRING option; if there is none, the
// input doesn't fit the schema and the caller shows usage.
function absorbLeftover(parsed, opts) {
    if (!parsed.leftover || parsed.leftover.length === 0) return true;
    const absorb = [...opts].reverse().find(
        o => o.type === 3 && !(o.choices && o.choices.length > 0) && !isBlank(parsed.values[o.name])
    );
    if (!absorb) return false;
    parsed.values[absorb.name] = parsed.values[absorb.name] + ' ' + parsed.leftover.join(' ');
    parsed.leftover = [];
    return true;
}

// ──────────────────── The shim (message masquerading as an interaction) ────────────────────

function buildInteraction(message, commandName, values, sub) {
    const state = { replied: false, deferred: false, lastReply: null };

    const cleanPayload = (opts) => {
        if (typeof opts === 'string') return opts;
        // Interaction-only fields that a plain message reply must not receive
        const { ephemeral: _ephemeral, fetchReply: _fetchReply, ...rest } = opts || {};
        return rest;
    };

    const interaction = {
        commandName,
        createdTimestamp: message.createdTimestamp || Date.now(),
        user: normalizeUser(message.author),
        member: message.member,
        guild: message.guild,
        channel: message.channel || null,
        channelId: message.channelId,
        client: message.client,

        get replied() { return state.replied; },
        get deferred() { return state.deferred; },

        options: {
            getSubcommand: () => sub || null,
            getUser: (n) => values[n] ?? null,
            getRole: (n) => values[n] ?? null,
            getChannel: (n) => values[n] ?? null,
            getString: (n) => values[n] ?? null,
            getInteger: (n) => values[n] ?? null,
            getNumber: (n) => values[n] ?? null,
            getBoolean: (n) => values[n] ?? null,
        },

        reply: async (opts) => {
            state.replied = true;
            const res = await message.reply(cleanPayload(opts));
            state.lastReply = res;
            return res;
        },
        editReply: async (opts) => {
            const clean = cleanPayload(opts);
            // Ping-style flows reply first, then edit that message in place.
            if (state.lastReply && typeof state.lastReply.edit === 'function') {
                state.lastReply = await state.lastReply.edit(clean);
                return state.lastReply;
            }
            // Defer-then-edit flows (deploy, botavatar, ...) reply on the
            // first edit instead — nothing was sent yet.
            state.replied = true;
            const res = await message.reply(clean);
            state.lastReply = res;
            return res;
        },
        followUp: async (opts) => {
            const res = await message.reply(cleanPayload(opts));
            state.lastReply = res;
            return res;
        },
        deferReply: async () => {
            state.deferred = true;
            return {};
        },
    };

    return interaction;
}

// ──────────────────── Public entry ────────────────────
// Minimal shim for the four bespoke prefix handlers (giveaway,
// serverstats, vc, tempvc): it carries only what the shared pipeline
// needs — commandName/user/guild for cooldown + permission gating, and
// reply/editReply/deferred/replied for the error path. Options are empty
// because those handlers read message.args directly.

function buildGateShim(message, commandName) {
    return buildInteraction(message, commandName, {}, null);
}

// Builds a shim for `commandName` from the message's `args` tokens.
// `forcedSubcommand` skips the first-arg subcommand lookup (used by
// aliases like ;server → /stats server).
// Returns { shim }, { usage } (reply with this), or { unknown }.

function buildPrefixInteraction(message, commandName, args, prefix, forcedSubcommand) {
    const schema = getSchemas()[commandName];
    if (!schema) return { unknown: true };

    let sub = null;
    let opts = schema.options || [];
    let rest = [...args];

    if (schema.subcommands) {
        let name = forcedSubcommand;
        if (name === undefined) {
            name = (rest[0] || '').toLowerCase();
            if (name) rest = rest.slice(1);
            else name = '';
        }
        const match = schema.subcommands[name];
        if (!match) {
            return { usage: buildSubUsage(prefix, commandName, Object.keys(schema.subcommands)) };
        }
        sub = name;
        opts = match.options;
    }

    const customKey = commandName + ':' + (sub || '');
    const custom = CUSTOM_PARSERS[customKey] || CUSTOM_PARSERS[commandName];
    let parsed;
    if (custom) {
        parsed = custom(rest, message);
    } else {
        parsed = parseOptions(rest, opts, message);
    }
    if (parsed.usage) return { usage: buildUsage(prefix, commandName, sub, opts) };

    if (!absorbLeftover(parsed, opts)) return { usage: buildUsage(prefix, commandName, sub, opts) };

    const missing = opts.filter(o => o.required && isBlank(parsed.values[o.name]));
    if (missing.length > 0) return { usage: buildUsage(prefix, commandName, sub, opts) };

    return { shim: buildInteraction(message, commandName, parsed.values, sub) };
}

module.exports = { buildPrefixInteraction, buildGateShim, getSchemas, normalizeUser, resolveUser, resolveChannel, resolveRole, parseOptions };