module.exports = {
    name: 'ready',
    once: true,
    execute: (deps) => async (client) => {
        console.log('Logged in as ' + client.user.tag);

        if (!process.env.OWNER_ID) {
            console.warn('[WARN] OWNER_ID is not set! All owner-only commands will be locked for everyone.');
        }

        const result = await deps.deployCommands(client.user);
        if (result === true) {
            console.log('\u2705 Commands deployed successfully! Try using /deploy in Discord if commands still do not appear.');
        } else {
            console.log('\u274C Command deployment failed. ' + (result || 'Check your BOT_TOKEN.'));
        }

        // Start invite caching
        const { cacheAllInvites } = require('../invites');
        setTimeout(() => cacheAllInvites(), 3000);

        // Re-join saved voice presences so the bot is back in its VC (24/7).
        // Waits a few seconds for the guild cache to settle after login, with
        // a second pass in case a guild wasn't cached yet.
        const { restoreAllPresences } = require('../voicePresence');
        setTimeout(() => restoreAllPresences(client).catch(() => {}), 3000);
        setTimeout(() => restoreAllPresences(client).catch(() => {}), 30000);
    },
};
