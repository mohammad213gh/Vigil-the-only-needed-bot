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
    },
};
