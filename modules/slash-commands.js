const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * Slash command definition for /summarize
 * 
 * Options:
 * - count: Number of messages to fetch (10-300, default 50)
 * - depth: Analysis depth (brief=fast/shallow, normal=balanced, deep=thorough)
 * - topic: Optional keyword to filter messages (only summarize msgs containing this)
 * 
 * Permissions: User needs ReadMessageHistory to use this command
 * This automatically respects Discord channel permissions!
 */
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
                { name: 'Brief (fast, 50 msgs)', value: 'brief' },
                { name: 'Normal (balanced, 150 msgs)', value: 'normal' },
                { name: 'Deep (thorough, 300 msgs)', value: 'deep' }
            )
    )
    .addStringOption(option =>
        option.setName('topic')
        .setDescription('Filter specific topic keywords (only analyze matching messages)')
    )
    // This ensures only users who can read messages can use the command
    // Privacy: If user can't see messages, they can't summarize them!
    .setDefaultMemberPermissions(PermissionFlagsBits.ReadMessageHistory);

/**
 * Register slash commands to a specific guild
 * 
 * DEBUG: If commands don't appear:
 * - Check GUILD_ID is set in .env
 * - Check bot has "Manage Commands" permission
 * - Use /commands command in Discord to manually force sync
 * - Check console for registration errors
 * 
 * @param {Client} client - Discord client instance
 * @param {string} guildId - Discord server ID to register to
 */
async function registerSlashCommands(client, guildId) {
    try {
        console.log(`[SLASH-COMMANDS] Registering to guild: ${guildId}`);
        
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            console.error('[SLASH-COMMANDS] Guild not found!');
            return;
        }

        const commands = [summarizeCommand.toJSON()];
        
        // set() replaces all commands - only include commands you want available
        await guild.commands.set(commands);
        console.log('[SLASH-COMMANDS] Successfully registered /summarize command');
        
        // List registered commands for debugging
        const registered = await guild.commands.fetch();
        console.log('[SLASH-COMMANDS] Registered commands:', registered.map(c => c.name).join(', '));
        
    } catch (error) {
        console.error('[SLASH-COMMANDS] Registration failed:', error.message);
        console.error('[SLASH-COMMANDS] Full error:', error);
    }
}

module.exports = { registerSlashCommands, summarizeCommand };