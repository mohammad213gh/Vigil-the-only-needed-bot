const { EmbedBuilder } = require('discord.js');
const { RULE_TYPES, ACTIONS, getAutoModRules, updateAutoModRule, getAutoModFilters, addAutoModFilter, removeAutoModFilter } = require('../automod');

async function executeAutoMod(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'config') {
        const rule = interaction.options.getString('rule');
        const enabled = interaction.options.getBoolean('enabled');
        const threshold = interaction.options.getInteger('threshold');
        const timeWindow = interaction.options.getInteger('time_window');
        const action = interaction.options.getString('action');
        const duration = interaction.options.getInteger('duration');

        const current = getAutoModRules(guild.id);
        const cfg = current[rule];
        if (!cfg) {
            return interaction.reply({ content: '⚠️ Unknown rule type. Choose: ' + RULE_TYPES.join(', '), ephemeral: true });
        }

        const updated = { ...cfg };
        if (enabled !== null) updated.enabled = enabled;
        if (threshold !== null) updated.threshold = threshold;
        if (timeWindow !== null) updated.time_window = timeWindow;
        if (action !== null) updated.action = action;
        if (duration !== null) updated.duration = duration * 1000; // convert seconds to ms

        updateAutoModRule(guild.id, rule, updated);

        const status = updated.enabled ? '✅ Enabled' : '❌ Disabled';
        const embed = new EmbedBuilder()
            .setColor(updated.enabled ? 'Green' : 'Red')
            .setTitle('🤖 Auto-Mod: ' + rule)
            .setDescription('Rule **' + rule + '** ' + (enabled !== null ? (updated.enabled ? 'enabled' : 'disabled') : 'updated'))
            .addFields(
                { name: 'Threshold', value: String(updated.threshold || 0), inline: true },
                { name: 'Time Window', value: String(updated.time_window || 0) + 's', inline: true },
                { name: 'Action', value: String(updated.action), inline: true },
                ...(updated.duration ? [{ name: 'Duration', value: String(updated.duration / 1000) + 's', inline: true }] : []),
            )
            .setFooter({ text: 'Changed by ' + interaction.user.tag })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

    } else if (sub === 'list') {
        const rules = getAutoModRules(guild.id);
        const lines = RULE_TYPES.map(rt => {
            const r = rules[rt];
            const status = r.enabled ? '✅' : '❌';
            const details = [];
            if (r.threshold > 0) details.push('threshold: ' + r.threshold);
            if (r.time_window > 0) details.push('window: ' + r.time_window + 's');
            details.push('action: ' + r.action);
            return status + ' **' + rt + '** — ' + details.join(', ');
        }).join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🤖 Auto-Mod Configuration')
            .setDescription(lines)
            .addFields({ name: 'Word Filters', value: String(getAutoModFilters(guild.id, 'words').length) + ' patterns' })
            .addFields({ name: 'Link Allowlist', value: String(getAutoModFilters(guild.id, 'links').length) + ' patterns' })
            .setFooter({ text: 'Use /automod config <rule> to configure' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'filter') {
        const filterType = interaction.options.getString('type');
        const pattern = interaction.options.getString('pattern');
        const remove = interaction.options.getBoolean('remove');

        if (remove) {
            const result = removeAutoModFilter(guild.id, filterType, pattern);
            if (!result) {
                return interaction.reply({ content: '⚠️ That pattern was not found in the ' + filterType + ' filter.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Filter Removed')
                .setDescription('Removed `' + pattern + '` from ' + filterType + ' filter.')
                .setTimestamp();
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
            const action = interaction.options.getString('action') || 'delete';
            addAutoModFilter(guild.id, filterType, pattern, action);
            const embed = new EmbedBuilder()
                .setColor('Green')
                .setTitle('✅ Filter Added')
                .setDescription('Added `' + pattern + '` to ' + filterType + ' filter.\nAction: **' + action + '**')
                .setTimestamp();
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

    } else if (sub === 'filters') {
        const filterType = interaction.options.getString('type');
        const filters = getAutoModFilters(guild.id, filterType);

        if (filters.length === 0) {
            return interaction.reply({ content: '📋 No ' + filterType + ' filters configured.', ephemeral: true });
        }

        const lines = filters.map(f => '`' + f.pattern + '` → ' + f.action).join('\n');
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📋 ' + filterType.charAt(0).toUpperCase() + filterType.slice(1) + ' Filters')
            .setDescription(lines)
            .setFooter({ text: 'Use /automod filter to add/remove' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = { executeAutoMod };
