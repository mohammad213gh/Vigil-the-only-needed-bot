const { isOwner } = require('../helpers');
const { hasPermission } = require('../permissions');

// Guard: only allow bot owner OR users who've been granted permission for this command
function ownerGuard(interaction) {
    const userId = interaction.user.id;

    // Owner always has access
    if (isOwner(userId)) return true;

    // Check if user has been granted permission for this command
    if (hasPermission(interaction.guild.id, interaction.commandName, userId)) return true;

    // Denied
    interaction.reply({
        content: '\u274C You don\'t have permission to use this command. Only the bot owner or users granted access via `/perm` can use it.',
        ephemeral: true,
    }).catch(() => {});
    return false;
}

module.exports = { ownerGuard };
