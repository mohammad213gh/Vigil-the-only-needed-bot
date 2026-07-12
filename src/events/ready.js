module.exports = {
    name: 'ready',
    once: true,
    execute: (deps) => async (client) => {
        console.log('Logged in as ' + client.user.tag);

        if (!process.env.OWNER_ID) {
            console.warn('[WARN] OWNER_ID is not set! All owner-only commands will be locked for everyone.');
        }

        deps.loadConfig();
        await deps.deployCommands(client.user);
    },
};
