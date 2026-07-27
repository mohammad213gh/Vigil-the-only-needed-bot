const { EmbedBuilder } = require('discord.js');
const { addNote, getNotesForUser, editNote, removeNote, getNoteCount } = require('../staffNotes');

async function executeNote(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'add') {
        const targetUser = interaction.options.getUser('user');
        const noteText = interaction.options.getString('note');

        const notes = addNote(guild.id, targetUser.id, interaction.user.id, interaction.user.tag, noteText);
        const count = getNoteCount(guild.id, targetUser.id);

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📝 Staff Note Added')
            .setDescription('Note added for ' + targetUser.toString())
            .addFields(
                { name: 'Note', value: noteText },
                { name: 'Note Count', value: String(count), inline: true },
                { name: 'Note ID', value: '`' + notes.id + '`', inline: true },
            )
            .setFooter({ text: 'By ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'list') {
        const targetUser = interaction.options.getUser('user');
        const notes = getNotesForUser(guild.id, targetUser.id);

        if (notes.length === 0) {
            return interaction.reply({
                content: '📋 No staff notes for ' + targetUser.toString() + '.',
                ephemeral: true,
            });
        }

        const lines = notes.map(n =>
            '**`' + n.id.slice(0, 8) + '...`** — ' + n.author_tag + ' • <t:' + Math.floor(n.created_at / 1000) + ':R>\n' +
            '> ' + n.note.slice(0, 200) +
            (n.updated_at ? '\n> *(edited <t:' + Math.floor(n.updated_at / 1000) + ':R>)*' : '')
        ).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📋 Staff Notes — ' + targetUser.tag)
            .setDescription(lines.slice(0, 4096))
            .setFooter({ text: notes.length + ' note' + (notes.length !== 1 ? 's' : '') + ' • Use /note remove <id> to delete' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'edit') {
        const noteId = interaction.options.getString('id');
        const newText = interaction.options.getString('text');

        const updated = editNote(noteId, newText);
        if (!updated) {
            return interaction.reply({ content: '❌ Note not found. Check the ID with `/note list @user`.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('✏️ Note Edited')
            .setDescription('Note `' + noteId + '` has been updated.')
            .addFields({ name: 'Updated Note', value: newText })
            .setFooter({ text: 'Edited by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'remove') {
        const noteId = interaction.options.getString('id');

        const removed = removeNote(noteId);
        if (!removed) {
            return interaction.reply({ content: '❌ Note not found. Check the ID with `/note list @user`.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('🗑️ Note Removed')
            .setDescription('Note `' + noteId + '` has been deleted.')
            .setFooter({ text: 'Removed by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = { executeNote };
