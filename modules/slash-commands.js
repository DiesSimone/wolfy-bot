const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

/**
 * =============================================================================
 * SLASH COMMANDS DEFINITIONS
 * =============================================================================
 * All commands for Wolfy Bot - migrating from ! prefix to / slash commands
 * =============================================================================
 */

// =============================================================================
// 1. /summarize - Summarize messages in channel
// =============================================================================
const summarizeCommand = new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Summarize recent messages in this channel')
    .addIntegerOption(option =>
        option.setName('count')
            .setDescription('Number of messages to analyze (10-100, default: 50)')
            .setMinValue(10)
            .setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ReadMessageHistory);

// =============================================================================
// 2. /wolfy - Chat with Wolfy AI
// =============================================================================
const wolfyCommand = new SlashCommandBuilder()
    .setName('wolfy')
    .setDescription('Chat with Wolfy AI')
    .addStringOption(option =>
        option.setName('message')
            .setDescription('What you want to ask Wolfy')
            .setRequired(true)
    );

// =============================================================================
// 3. /research - Web-powered research with Exa AI
// =============================================================================
const researchCommand = new SlashCommandBuilder()
    .setName('research')
    .setDescription('Research any topic using real-time web search')
    .addStringOption(option =>
        option.setName('query')
            .setDescription('What you want to research')
            .setRequired(true)
    );

// =============================================================================
// 4. /create - Creative AI generation
// =============================================================================
const createCommand = new SlashCommandBuilder()
    .setName('create')
    .setDescription('Generate creative content with AI')
    .addStringOption(option =>
        option.setName('prompt')
            .setDescription('What you want to create')
            .setRequired(true)
    );

// =============================================================================
// 5. /meme - Generate LUPOS memes
// =============================================================================
const memeCommand = new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Generate LUPOS-themed memes')
    .addStringOption(option =>
        option.setName('topic')
            .setDescription('What the meme should be about (optional)')
            .setRequired(false)
    );

// =============================================================================
// 6. /domain - Domain expansion battle (JJK style)
// =============================================================================
const domainCommand = new SlashCommandBuilder()
    .setName('domain')
    .setDescription('Generate a domain expansion battle scene')
    .addStringOption(option =>
        option.setName('character')
            .setDescription('Which LUPOS character (optional, random if not specified)')
            .setRequired(false)
    );

// =============================================================================
// 7. /addquote - Add a quote to the database
// =============================================================================
const addquoteCommand = new SlashCommandBuilder()
    .setName('addquote')
    .setDescription('Add a quote to Wolfy\'s quote collection')
    .addStringOption(option =>
        option.setName('text')
            .setDescription('The quote text')
            .setRequired(true)
    );

// =============================================================================
// 8. /help - Show all available commands
// =============================================================================
const helpCommand = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available Wolfy commands');

/**
 * =============================================================================
 * COMMAND REGISTRATION
 * =============================================================================
 * Registers all slash commands to the specified guild
 * 
 * @param {Client} client - Discord client instance
 * @param {string} guildId - Discord server ID
 * =============================================================================
 */
async function registerSlashCommands(client, guildId) {
    try {
        console.log(`[SLASH-COMMANDS] Registering to guild: ${guildId}`);
        
        const guild = await client.guilds.fetch(guildId);
        if (!guild) {
            console.error('[SLASH-COMMANDS] Guild not found!');
            return;
        }

        // ========================================================================
        // ALL COMMANDS - Array of all slash commands to register
        // ========================================================================
        const commands = [
            summarizeCommand.toJSON(),
            wolfyCommand.toJSON(),
            researchCommand.toJSON(),
            createCommand.toJSON(),
            memeCommand.toJSON(),
            domainCommand.toJSON(),
            addquoteCommand.toJSON(),
            helpCommand.toJSON()
        ];
        
        // set() replaces all commands - registers all at once
        await guild.commands.set(commands);
        console.log('[SLASH-COMMANDS] Successfully registered all commands');
        
        // List registered commands for debugging
        const registered = await guild.commands.fetch();
        console.log('[SLASH-COMMANDS] Registered commands:', registered.map(c => c.name).join(', '));
        
    } catch (error) {
        console.error('[SLASH-COMMANDS] Registration failed:', error.message);
        console.error('[SLASH-COMMANDS] Full error:', error);
    }
}

module.exports = { 
    registerSlashCommands, 
    summarizeCommand,
    wolfyCommand,
    researchCommand,
    createCommand,
    memeCommand,
    domainCommand,
    addquoteCommand,
    helpCommand
};