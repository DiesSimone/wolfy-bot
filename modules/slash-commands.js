const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const summarizeCommand = new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Summarize recent messages in this channel')
    .addIntegerOption(option =>
        option.setName('count')
            .setDescription('Number of messages to analyze (default: 50)')
            .setMinValue(10)
            .setMaxValue(300)
    )
    .addStringOption(option =>
        option.setName('depth')
            .setDescription('Analysis depth')
            .addChoices(
                { name: 'Brief', value: 'brief' },
                { name: 'Normal', value: 'normal' },
                { name: 'Deep', value: 'deep' }
            )
    )
    .addStringOption(option =>
        option.setName('topic')
        .setDescription('Filter specific topic keywords')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ReadMessageHistory);

async function registerSlashCommands(client, guildId) {
    try {
        const guild = await client.guilds.fetch(guildId);
        
        const commands = [summarizeCommand.toJSON()];
        
        await guild.commands.set(commands);
        console.log('[SLASH-COMMANDS] Registered /summarize command');
    } catch (error) {
        console.error('[SLASH-COMMANDS] Registration failed:', error);
    }
}

module.exports = { registerSlashCommands, summarizeCommand };