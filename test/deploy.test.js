// Regression guard: every slash command definition must build without
// throwing. The @discordjs/builders validator enforces Discord's limits
// (e.g. 25 choices per string option) — a 26th choice once crashed the bot
// at boot with "ExpectedConstraintError: Invalid number value". This test
// loads deploy.js at module scope, which constructs commandDefs, so any
// future over-limit option throws here instead of in production.
const { test } = require('node:test');
const assert = require('node:assert');

test('deploy command definitions build within Discord limits', () => {
    let deploy = null;
    assert.doesNotThrow(() => {
        deploy = require('../src/deploy');
    });
    assert.ok(deploy, 'deploy module should load');
    assert.strictEqual(typeof deploy.deployCommands, 'function');
    // Sanity: the definitions array exists and is non-empty.
    assert.ok(Array.isArray(deploy.commandDefs) && deploy.commandDefs.length > 0);
});
