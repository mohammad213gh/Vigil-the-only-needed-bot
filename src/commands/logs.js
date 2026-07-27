const { EmbedBuilder } = require('discord.js');
const { getDb } = require('../db');

async function executeLogs(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'search') {
        const searchUser = interaction.options.getUser('user');
        const keyword = interaction.options.getString('keyword');
        const action = interaction.options.getString('action');
        const limit = Math.min(interaction.options.getInteger('limit') || 15, 50);

        const db = getDb();

        // Build query dynamically
        let whereClauses = ['guild_id = ?'];
        let params = [guild.id];

        if (searchUser) {
            whereClauses.push('author_id = ?');
            params.push(searchUser.id);
        }
        if (keyword) {
            whereClauses.push('content LIKE ?');
            params.push('%' + keyword + '%');
        }
        if (action) {
            whereClauses.push('action = ?');
            params.push(action);
        }

        const sql = 'SELECT * FROM message_log WHERE ' + whereClauses.join(' AND ') + ' ORDER BY logged_at DESC LIMIT ?';
        params.push(limit);
        const results = db.prepare(sql).all(...params);

        if (results.length === 0) {
            return interaction.reply({
                content: '📋 No matching messages found.' +
                    (searchUser ? '\nUser: ' + searchUser.toString() : '') +
                    (keyword ? '\nKeyword: `' + keyword + '`' : '') +
                    (action ? '\nAction: `' + action + '`' : ''),
                ephemeral: true,
            });
        }

        const lines = results.map(r => {
            const actionEmoji = r.action === 'deleted' ? '🗑️' : (r.action === 'edited' ? '✏️' : '📝');
            const snippet = (r.content || '*[empty]*').slice(0, 100);
            return actionEmoji + ' <@' + r.author_id + '> — <t:' + Math.floor(r.logged_at / 1000) + ':R>\n' +
                '> ' + snippet.replace(/\n/g, ' ').trim();
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
            .setTitle('📋 Log Search Results')
            .setDescription(lines.slice(0, 4096))
            .setFooter({ text: results.length + ' result' + (results.length !== 1 ? 's' : '') + ' • Use /logs search with filters to narrow down' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = { executeLogs };
