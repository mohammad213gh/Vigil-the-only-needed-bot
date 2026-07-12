module.exports = {
    name: 'clientReady',
    once: true,
    execute: (deps) => async (client) => {
        console.log('Logged in as ' + client.user.username);

        if (!process.env.OWNER_ID) {
            console.warn('[WARN] OWNER_ID is not set! All owner-only commands will be locked for everyone.');
        }

        const config = deps.loadConfig();

        // DIAGNOSTIC: report config for all guilds the bot is in
        const guildInfos = [];
        client.guilds.cache.forEach(g => {
            const gc = config[g.id];
            if (gc) {
                const channels = [];
                if (gc.logChannelId) channels.push('legacy:' + gc.logChannelId);
                for (const [cat, chId] of Object.entries(gc.logChannels || {})) {
                    if (chId) channels.push(cat + ':' + chId);
                }
                guildInfos.push(g.name + ' (' + g.id + '): ' + (channels.length ? channels.join(', ') : 'NO channels set'));
            } else {
                guildInfos.push(g.name + ' (' + g.id + '): NO config entry');
            }
        });
        console.log('[CONFIG DIAG]\n' + guildInfos.join('\n'));
        if (process.env.OWNER_ID) {
            const owner = await client.users.fetch(process.env.OWNER_ID).catch(() => null);
            if (owner) {
                owner.send('```\n[CONFIG DIAG]\n' + guildInfos.join('\n').slice(0, 1900) + '\n```').catch(() => {});
            }
        }

        const result = await deps.deployCommands(client.user);
        if (result) {
            console.log('\u2705 Commands deployed successfully! Try using /deploy in Discord if commands still do not appear.');
        } else {
            console.log('\u274C Command deployment failed. Check your BOT_TOKEN and try running /deploy in Discord.');
        }
    },
};
