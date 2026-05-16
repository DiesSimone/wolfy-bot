require('dotenv').config();
const connectDb = require('./db.js');
const Quotes = require('./models/quotes.js');
const Summaries = require('./models/summaries.js');
const Summarizer = require('./modules/summarizer.js');
const { registerSlashCommands } = require('./modules/slash-commands.js');
const { buildPrompt } = require('./modules/prompts.js');
const { startMorningScheduler } = require('./modules/morning.js');
const { performWebResearch, isConfigured: isWebResearchConfigured } = require('./modules/webresearch.js');
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ModelClient = require("@azure-rest/ai-inference").default;
const { AzureKeyCredential } = require("@azure/core-auth");
const dns = require('dns');
const discordToken = process.env.DISCORD_TOKEN;
const aiToken = process.env.GITHUB_API_KEY;
const aiToken2 = process.env.GITHUB_API_KEY2;
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1-nano";
const wolfyChat = process.env.DEDICATED_CHAT;
const quotesChat = process.env.QUOTES_CHAT;
const cooldowns = new Map();
const cooldownTime = 10 * 6000;
const quoteInterval = 60 * 60000;
const chunkSize = 2000;
let randomQuotes = [];
let summarizer = null;

const summarizeCooldowns = new Map();
const summarizeCooldownTime = 30 * 1000;
const summarizeRateLimit = new Map();
const summarizeRateLimitCount = 5;
const summarizeRateLimitWindow = 60 * 1000;

dns.setDefaultResultOrder('ipv4first');

const aiClient = ModelClient(
    endpoint,
    new AzureKeyCredential(aiToken),
);

const aiClient2 = ModelClient(
    endpoint,
    new AzureKeyCredential(aiToken2),
);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

client.on("ready", async () => {
    try {
        await connectDb();
        randomQuotes = await Quotes.find({});
        summarizer = new Summarizer(aiClient, aiClient2);

        const channel = await client.channels.fetch(wolfyChat);
        const quoteChannel = await client.channels.fetch(quotesChat);
        channel.send("Wolfy is online, i either got rebooted by Simo or i crashed and reborn: All your current requests got deleted, i'm sorry, blame Simo not me");
        console.log("Wolfy ready");

        const guildId = process.env.GUILD_ID;
        if (guildId) await registerSlashCommands(client, guildId);
        else console.log('[SLASH-COMMANDS] No GUILD_ID in env, skipping registration');

        // ========================================================================
        // MORNING MESSAGE SCHEDULER
        // ========================================================================
        // Initialize morning message scheduler if MORNING_CHANNEL_ID is set
        // Sends AI-generated motivational message at configured UTC time (default 4AM)
        // ========================================================================
        startMorningScheduler(client, aiClient, aiClient2, model);

        await setInterval(async () => {
            try {
                const chosen = getRandomInt(0, 9);
                if (chosen == 4) {
                    quoteNumber = randomQuotes[getRandomInt(0, randomQuotes.length - 1)]
                    let quote = await quoteNumber.content;
                    let author = await quoteNumber.author;
                    quoteChannel.send(`***${quote} - ${author}***`);
                }
                console.log(`[QUOTE-SYSTEM] The chosen number is ${chosen}`);
            } catch (error) {
                console.log(`Error with the quote counter: ${error}`);
            }
        }, quoteInterval);
    } catch (error) {
        console.log(`Error with the startup: ${error}`);
    }
});

client.on('messageCreate', async message => {
    const content = message.content.toLowerCase();

    if (message.author.bot) {
        return
    };

    const randomNum = getRandomInt(0, 50)

    if (randomNum == 25) {
        message.reply("I heavy forbid you to keep typing forward. Drink some water now.")
    }

    if (content.includes("morning") || content.includes("gm")) {
        message.reply(`GOOD MORNING`);
    }

    console.log("WATERNUM: " + randomNum)
});

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min
    console.log(`[RANDOM-NUM] ${randomNum}`);
    return randomNum;
}

client.login(discordToken);

/**
 * =============================================================================
 * SLASH COMMANDS HANDLER
 * =============================================================================
 * Handles all slash command interactions
 * Routes each command to its appropriate handler function
 * =============================================================================
 */
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    console.log(`[SLASH-COMMAND] Received: /${commandName}`);

    // Route to appropriate handler based on command name
    switch (commandName) {
        case 'summarize':
            await handleSummarizeCommand(interaction);
            break;

        case 'wolfy':
            await handleWolfyCommand(interaction);
            break;

        case 'research':
            await handleResearchCommand(interaction);
            break;

        case 'create':
            await handleCreateCommand(interaction);
            break;

        case 'meme':
            await handleMemeCommand(interaction);
            break;

        case 'domain':
            await handleDomainCommand(interaction);
            break;

        case 'addquote':
            await handleAddQuoteCommand(interaction);
            break;

        case 'help':
            await handleHelpCommand(interaction);
            break;

        default:
            console.log(`[SLASH-COMMAND] Unknown command: ${commandName}`);
            await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
});

/**
 * Handler for /summarize slash command
 * 
 * FLOW:
 * 1. Check if summarizer is initialized
 * 2. Check user cooldown (30 seconds)
 * 3. Check channel rate limit (5 requests/minute)
 * 4. Parse command options (count, depth, topic)
 * 5. Defer reply (bot is thinking)
 * 6. Fetch messages from channel
 * 7. Filter by topic if specified
 * 8. Call summarizer.summarize()
 * 9. Build and send embed response
 * 10. Set up button interaction collector
 * 
 * DEBUG: Check console logs with [SUMMARIZE-COMMAND] prefix
 */
async function handleSummarizeCommand(interaction) {
    // Step 1: Check if summarizer is ready
    // DEBUG: If this fails, check if Summarizer class initialized properly in 'ready' event
    if (!summarizer) {
        console.error('[SUMMARIZE-COMMAND] Summarizer not initialized!');
        return interaction.reply({ content: 'Summarizer not ready, try again soon.', ephemeral: true });
    }

    const userId = interaction.user.id;
    const now = Date.now();

    // Step 2: Per-user cooldown check
    // DEBUG: If users get "Wait X seconds" message, this is working as intended
    // Change summarizeCooldownTime at top of file to adjust
    const userCooldown = summarizeCooldowns.get(userId);
    if (userCooldown && now - userCooldown < summarizeCooldownTime) {
        const remaining = Math.ceil((summarizeCooldownTime - (now - userCooldown)) / 1000);
        console.log(`[SUMMARIZE-COMMAND] User ${userId} on cooldown: ${remaining}s remaining`);
        return interaction.reply({ content: `Wait ${remaining}s before summarizing again.`, ephemeral: true });
    }
    summarizeCooldowns.set(userId, now);
    console.log(`[SUMMARIZE-COMMAND] User ${userId} cooldown set`);

    // Step 3: Per-channel rate limiting
    // DEBUG: If "rate limit" message appears, channel has exceeded 5 requests/minute
    const guildId = interaction.guildId;
    const rateKey = `${guildId}-${interaction.channelId}`;
    const rateData = summarizeRateLimit.get(rateKey) || { count: 0, resetTime: now + summarizeRateLimitWindow };

    if (now > rateData.resetTime) {
        // Window expired, reset counter
        rateData.count = 1;
        rateData.resetTime = now + summarizeRateLimitWindow;
    } else {
        rateData.count++;
        if (rateData.count > summarizeRateLimitCount) {
            console.log(`[SUMMARIZE-COMMAND] Rate limit exceeded for channel ${interaction.channelId}`);
            return interaction.reply({ content: 'This channel is under rate limit. Try again in a minute.', ephemeral: true });
        }
    }
    summarizeRateLimit.set(rateKey, rateData);
    console.log(`[SUMMARIZE-COMMAND] Rate limit: ${rateData.count}/${summarizeRateLimitCount} for channel ${interaction.channelId}`);

    // Step 4: Parse command options
    // count: 10-100 (default 50) - Discord API limits fetching to 100 max
    // depth: REMOVED from options - now hardcoded to 'normal' internally
    // topic: REMOVED - topic filtering feature was removed
    // NOTE: Discord only allows fetching up to 100 messages per request
    const count = interaction.options.getInteger('count') || 50;

    // Depth is now always 'normal' - the depth option was removed from slash command
    // Buttons still allow switching between brief/normal/deep for variety
    const depth = 'normal';

    // Topic filter removed - no longer a command option
    const topicFilter = null;

    console.log(`[SUMMARIZE-COMMAND] Request: count=${count}, depth=${depth}, topic=none (removed)`);

    // Step 5: Defer reply - gives us up to 15 minutes to respond
    // DEBUG: If this fails, Discord API issue
    await interaction.deferReply();
    console.log('[SUMMARIZE-COMMAND] Reply deferred');

    try {
        // Step 6: Fetch messages from channel
        // DEBUG: If "Missing Access" error, bot doesn't have permission to read channel
        // DEBUG: If 0 messages returned, channel might be empty or restricted
        const channel = interaction.channel;
        // Discord API caps at 100 messages per fetch - enforce this limit
        const fetchLimit = Math.min(count, 100);
        console.log(`[SUMMARIZE-COMMAND] Fetching up to ${fetchLimit} messages from channel ${channel.id}`);
        const messages = await channel.messages.fetch({ limit: fetchLimit });
        console.log(`[SUMMARIZE-COMMAND] Fetched ${messages.size} messages`);

        // Convert to array and reverse (Discord returns newest first)
        const msgArray = Array.from(messages.values()).reverse();

        // Step 7: Topic filtering was REMOVED - now all messages are used
        // (topicFilter is always null now)
        const finalMsgs = msgArray;

        // Get first and last message IDs for caching key
        const startMsg = finalMsgs[0];
        const endMsg = finalMsgs[finalMsgs.length - 1];
        console.log(`[SUMMARIZE-COMMAND] Message range: ${startMsg.id} to ${endMsg.id}`);

        // Step 8: Call the summarizer
        // DEBUG: Check modules/summarizer.js logs for detailed processing
        console.log('[SUMMARIZE-COMMAND] Calling summarizer.summarize()...');
        const result = await summarizer.summarize(finalMsgs, {
            depth,
            channelId: channel.id,
            startMsgId: startMsg.id,
            endMsgId: endMsg.id
        });
        console.log('[SUMMARIZE-COMMAND] Summarizer returned:', JSON.stringify(result).slice(0, 200));

        // Step 9: Build embed response
        // DEBUG: If embed shows "None detected", AI didn't find topics/actions
        const embed = new EmbedBuilder()
            .setTitle('📝 Chat Summary')
            .setColor(0x5865F2)
            .setDescription(result.summary)
            .addFields(
                { name: '📚 Topics', value: result.topics?.join(', ') || 'None detected', inline: false },
                { name: '✅ Action Items', value: result.actionItems?.join('\n') || 'None detected', inline: false },
                { name: '💭 Sentiment', value: result.sentiment?.toUpperCase() || 'NEUTRAL', inline: true },
                { name: '💬 Messages Analyzed', value: result.messageCount?.toString() || finalMsgs.length.toString(), inline: true }
            )
            .setFooter({ text: `Depth: ${depth} • Cached: Yes` })
            .setTimestamp();

        // ========================================================================
        // BUTTONS REMOVED - Simpler output without interactive buttons
        // The command now just sends the summary and that's it
        // No more Refresh/Deep/Brief buttons
        // ========================================================================

        console.log('[SUMMARIZE-COMMAND] Sending embed response (no buttons)');
        // Send embed WITHOUT components (no buttons)
        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        // ERROR HANDLING
        // DEBUG: Check error.message for specific failure
        console.error('[SUMMARIZE-COMMAND] Error:', error.message);
        console.error('[SUMMARIZE-COMMAND] Stack:', error.stack);
        await interaction.editReply({ content: 'Failed to generate summary. Try fewer messages or different settings.' });
    }
}

/**
 * =============================================================================
 * HANDLER: /wolfy - Chat with Wolfy AI
 * =============================================================================
 * Uses buildPrompt for topic-aware responses
 */
async function handleWolfyCommand(interaction) {
    const userText = interaction.options.getString('message');
    console.log(`[/wolfy] User message: ${userText}`);

    // Check cooldown
    const now = Date.now();
    const userId = interaction.user.id;
    if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId) + cooldownTime;
        if (now < expirationTime) {
            const remaining = Math.ceil((expirationTime - now) / 1000);
            return interaction.reply({ content: `Wait ${remaining}s before using an AI based command again.`, ephemeral: true });
        }
    }
    cooldowns.set(userId, now);

    try {
        await interaction.deferReply();

        // Use prompt system for topic-aware responses
        const systemPrompt = buildPrompt(`!wolfy ${userText}`, 'wolfy');

        const response = await aiClient.path("/chat/completions").post({
            body: {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `!wolfy ${userText}` }
                ],
                temperature: 1.0,
                top_p: 1.0,
                model: model
            }
        });

        const text = response.body.choices[0].message.content;
        console.log(`[/wolfy] Response: ${text.slice(0, 100)}...`);

        // Send response (chunked if needed)
        const channel = await client.channels.fetch(wolfyChat);
        for (let i = 0; i < text.length; i += chunkSize) {
            if (i === 0) {
                await interaction.editReply(text.slice(i, i + chunkSize));
            } else {
                await channel.send(text.slice(i, i + chunkSize));
            }
        }

    } catch (error) {
        console.error('[/wolfy] Error:', error.message);
        try {
            const systemPrompt = buildPrompt(`!wolfy ${userText}`, 'wolfy');
            const response = await aiClient2.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `!wolfy ${userText}` }
                    ],
                    temperature: 1.0,
                    top_p: 1.0,
                    model: model
                }
            });
            const text = response.body.choices[0].message.content;
            const channel = await client.channels.fetch(wolfyChat);
            for (let i = 0; i < text.length; i += chunkSize) {
                if (i === 0) {
                    await interaction.editReply(text.slice(i, i + chunkSize));
                } else {
                    await channel.send(text.slice(i, i + chunkSize));
                }
            }
        } catch (fallbackError) {
            console.error('[/wolfy] Fallback error:', fallbackError.message);
            await interaction.editReply({ content: 'Wolfy failed to respond. Try again later.' });
        }
    }
}

/**
 * =============================================================================
 * HANDLER: /research - Web-powered research
 * =============================================================================
 * Always uses Exa AI for real-time search, falls back to legacy on error
 */
async function handleResearchCommand(interaction) {
    const userText = interaction.options.getString('query');
    console.log(`[/research] Query: ${userText}`);

    // Check cooldown
    const now = Date.now();
    const userId = interaction.user.id;
    if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId) + cooldownTime;
        if (now < expirationTime) {
            const remaining = Math.ceil((expirationTime - now) / 1000);
            return interaction.reply({ content: `Wait ${remaining}s before using an AI based command again.`, ephemeral: true });
        }
    }
    cooldowns.set(userId, now);

    try {
        await interaction.deferReply();

        // Try Exa AI web research first
        if (isWebResearchConfigured()) {
            try {
                console.log('[/research] Attempting Exa AI web research...');
                const webResult = await performWebResearch(userText, aiClient, aiClient2, model);

                if (webResult && webResult.needsWebSearch && webResult.answer) {
                    console.log('[/research] Exa AI succeeded');

                    const embed = new EmbedBuilder()
                        .setTitle(`🔍 Research: ${userText}`)
                        .setColor(0x5865F2)
                        .setDescription(webResult.answer)
                        .addFields(
                            { name: '📚 Sources', value: webResult.sources || 'No sources', inline: false }
                        )
                        .setFooter({ text: 'Powered by Wolfy AI • Real-time search' })
                        .setTimestamp();

                    const channel = await client.channels.fetch(wolfyChat);
                    await channel.send({ embeds: [embed] });
                    await interaction.editReply({ content: 'Research complete!' });
                    return;
                }
            } catch (exaError) {
                console.error('[/research] Exa failed:', exaError.message);
            }
        }

        // Fall back to legacy AI research
        console.log('[/research] Using legacy AI research');
        const systemPrompt = buildPrompt(`!research ${userText}`, 'research');

        const response = await aiClient.path("/chat/completions").post({
            body: {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `!research ${userText}` }
                ],
                temperature: 1.0,
                top_p: 1.0,
                model: model
            }
        });

        const text = response.body.choices[0].message.content;
        console.log(`[/research] Legacy response: ${text.slice(0, 100)}...`);

        const channel = await client.channels.fetch(wolfyChat);
        for (let i = 0; i < text.length; i += chunkSize) {
            if (i === 0) {
                await interaction.editReply(text.slice(i, i + chunkSize));
            } else {
                await channel.send(text.slice(i, i + chunkSize));
            }
        }

    } catch (error) {
        console.error('[/research] Error:', error.message);
        try {
            const systemPrompt = buildPrompt(`!research ${userText}`, 'research');
            const response = await aiClient2.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `!research ${userText}` }
                    ],
                    temperature: 1.0,
                    top_p: 1.0,
                    model: model
                }
            });
            const text = response.body.choices[0].message.content;
            const channel = await client.channels.fetch(wolfyChat);
            for (let i = 0; i < text.length; i += chunkSize) {
                if (i === 0) {
                    await interaction.editReply(text.slice(i, i + chunkSize));
                } else {
                    await channel.send(text.slice(i, i + chunkSize));
                }
            }
        } catch (fallbackError) {
            console.error('[/research] Fallback error:', fallbackError.message);
            await interaction.editReply({ content: 'Research failed. Try again later.' });
        }
    }
}

/**
 * =============================================================================
 * HANDLER: /create - Creative AI generation
 * =============================================================================
 */
async function handleCreateCommand(interaction) {
    const prompt = interaction.options.getString('prompt');
    const template = interaction.options.getString('template');
    const length = interaction.options.getInteger('length');

    console.log(`[/create] Prompt: ${prompt}`);
    if (template) console.log(`[/create] Template: ${template}`);
    if (length) console.log(`[/create] Length: ${length}`);

    // Check cooldown
    const now = Date.now();
    const userId = interaction.user.id;
    if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId) + cooldownTime;
        if (now < expirationTime) {
            const remaining = Math.ceil((expirationTime - now) / 1000);
            return interaction.reply({ content: `Wait ${remaining}s before using an AI based command again.`, ephemeral: true });
        }
    }
    cooldowns.set(userId, now);

    try {
        await interaction.deferReply();

        let userMessage = `!create ${prompt}`;
        if (template) {
            userMessage += `\n\nTemplate: ${template}`;
        }
        if (length) {
            userMessage += `\n\nOutput length: approximately ${length} characters.`;
        }

        const systemPrompt = buildPrompt(userMessage, 'create');

        const response = await aiClient.path("/chat/completions").post({
            body: {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                temperature: 1.0,
                top_p: 1.0,
                model: model
            }
        });

        let text = response.body.choices[0].message.content;
        console.log(`[/create] Response: ${text.slice(0, 100)}...`);

        // if (template) {
        //     text = `${template}\n\n${text}`;
        // }

        const channel = await client.channels.fetch(wolfyChat);
        for (let i = 0; i < text.length; i += chunkSize) {
            if (i === 0) {
                await interaction.editReply(text.slice(i, i + chunkSize));
            } else {
                await channel.send(text.slice(i, i + chunkSize));
            }
        }

    } catch (error) {
        console.error('[/create] Error:', error.message);
        try {
            let userMessage = `!create ${prompt}`;
            if (template) {
                userMessage += `\n\nTemplate: ${template}`;
            }
            if (length) {
                userMessage += `\n\nOutput length: approximately ${length} characters.`;
            }

            const systemPrompt = buildPrompt(userMessage, 'create');
            const response = await aiClient2.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 1.0,
                    top_p: 1.0,
                    model: model
                }
            });
            let text = response.body.choices[0].message.content;
            if (template) {
                text = `${template}\n\n${text}`;
            }
            const channel = await client.channels.fetch(wolfyChat);
            for (let i = 0; i < text.length; i += chunkSize) {
                if (i === 0) {
                    await interaction.editReply(text.slice(i, i + chunkSize));
                } else {
                    await channel.send(text.slice(i, i + chunkSize));
                }
            }
        } catch (fallbackError) {
            console.error('[/create] Fallback error:', fallbackError.message);
            await interaction.editReply({ content: 'Creation failed. Try again later.' });
        }
    }
}

/**
 * =============================================================================
 * HANDLER: /meme - Generate LUPOS memes
 * =============================================================================
 */
async function handleMemeCommand(interaction) {
    const userText = interaction.options.getString('topic') || '';
    console.log(`[/meme] Topic: ${userText || 'random'}`);

    // Check cooldown
    const now = Date.now();
    const userId = interaction.user.id;
    if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId) + cooldownTime;
        if (now < expirationTime) {
            const remaining = Math.ceil((expirationTime - now) / 1000);
            return interaction.reply({ content: `Wait ${remaining}s before using an AI based command again.`, ephemeral: true });
        }
    }
    cooldowns.set(userId, now);

    try {
        await interaction.deferReply();

        const systemPrompt = buildPrompt(`!meme ${userText}`, 'meme');

        const response = await aiClient.path("/chat/completions").post({
            body: {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `!meme ${userText}` }
                ],
                temperature: 1.0,
                top_p: 1.0,
                model: model
            }
        });

        const text = response.body.choices[0].message.content;
        console.log(`[/meme] Response: ${text.slice(0, 100)}...`);

        const channel = await client.channels.fetch(wolfyChat);
        for (let i = 0; i < text.length; i += chunkSize) {
            if (i === 0) {
                await interaction.editReply(text.slice(i, i + chunkSize));
            } else {
                await channel.send(text.slice(i, i + chunkSize));
            }
        }

    } catch (error) {
        console.error('[/meme] Error:', error.message);
        try {
            const systemPrompt = buildPrompt(`!meme ${userText}`, 'meme');
            const response = await aiClient2.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `!meme ${userText}` }
                    ],
                    temperature: 1.0,
                    top_p: 1.0,
                    model: model
                }
            });
            const text = response.body.choices[0].message.content;
            const channel = await client.channels.fetch(wolfyChat);
            for (let i = 0; i < text.length; i += chunkSize) {
                if (i === 0) {
                    await interaction.editReply(text.slice(i, i + chunkSize));
                } else {
                    await channel.send(text.slice(i, i + chunkSize));
                }
            }
        } catch (fallbackError) {
            console.error('[/meme] Fallback error:', fallbackError.message);
            await interaction.editReply({ content: 'Meme generation failed. Try again later.' });
        }
    }
}

/**
 * =============================================================================
 * HANDLER: /domain - Domain expansion battle
 * =============================================================================
 */
async function handleDomainCommand(interaction) {
    const userText = interaction.options.getString('character') || '';
    console.log(`[/domain] Character: ${userText || 'random'}`);

    // Check cooldown
    const now = Date.now();
    const userId = interaction.user.id;
    if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId) + cooldownTime;
        if (now < expirationTime) {
            const remaining = Math.ceil((expirationTime - now) / 1000);
            return interaction.reply({ content: `Wait ${remaining}s before using an AI based command again.`, ephemeral: true });
        }
    }
    cooldowns.set(userId, now);

    try {
        await interaction.deferReply();

        const systemPrompt = buildPrompt(`!domain ${userText}`, 'domain');

        const response = await aiClient.path("/chat/completions").post({
            body: {
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `!domain ${userText}` }
                ],
                temperature: 1.0,
                top_p: 1.0,
                model: model
            }
        });

        const text = response.body.choices[0].message.content;
        console.log(`[/domain] Response: ${text.slice(0, 100)}...`);

        const channel = await client.channels.fetch(wolfyChat);
        for (let i = 0; i < text.length; i += chunkSize) {
            if (i === 0) {
                await interaction.editReply(text.slice(i, i + chunkSize));
            } else {
                await channel.send(text.slice(i, i + chunkSize));
            }
        }

    } catch (error) {
        console.error('[/domain] Error:', error.message);
        try {
            const systemPrompt = buildPrompt(`!domain ${userText}`, 'domain');
            const response = await aiClient2.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `!domain ${userText}` }
                    ],
                    temperature: 1.0,
                    top_p: 1.0,
                    model: model
                }
            });
            const text = response.body.choices[0].message.content;
            const channel = await client.channels.fetch(wolfyChat);
            for (let i = 0; i < text.length; i += chunkSize) {
                if (i === 0) {
                    await interaction.editReply(text.slice(i, i + chunkSize));
                } else {
                    await channel.send(text.slice(i, i + chunkSize));
                }
            }
        } catch (fallbackError) {
            console.error('[/domain] Fallback error:', fallbackError.message);
            await interaction.editReply({ content: 'Domain expansion failed. Try again later.' });
        }
    }
}

/**
 * =============================================================================
 * HANDLER: /addquote - Add a quote to database
 * =============================================================================
 */
async function handleAddQuoteCommand(interaction) {
    const quoteText = interaction.options.getString('text');
    console.log(`[/addquote] Quote: ${quoteText}`);

    try {
        const author = interaction.user.globalName || interaction.user.username;
        console.log('[/addquote] Author:', author);

        await Quotes.create({
            content: quoteText,
            author: author
        });

        // Refresh quotes cache
        randomQuotes = await Quotes.find({});

        await interaction.reply({ content: `✅ Quote added: ***${quoteText} - ${author}***` });

    } catch (error) {
        console.error('[/addquote] Error:', error.message);
        await interaction.reply({ content: 'Failed to add quote. Try again later.' });
    }
}


//HELP COMMAND HANDLER

async function handleHelpCommand(interaction) {

    try {
        await interaction.deferReply();
        const embed = new EmbedBuilder()
            .setTitle(`📃 Help commands: `)
            .setColor(0x5865F2)
            .setDescription(`

                **/wolfy**: Talk with the AI-Powered Wolfy bot, representing the pure spirit of lupos.

                **/research**: Perform a real-time research on the WEB using Wolfy, it will return you an AI summary of the research and the sources.

                **/create**: Create a text for your documents, listings, or anything you need to create. Options: template (format) and length (1-10000 chars).

                **/summarize**: Summarize the previous conversation, limited to the last 100 messages.

                **/meme**: Create some funny meme shit with the LUPOS atmosphere.

                **/domain**: Create some funny stories all based from the LUPOS humor.

                **/addquote**: Add your own quote to our quote database and wait for it to show up in <#${quotesChat}>.

                `)
        await interaction.editReply({ embeds: [embed] });

    } catch (fallbackError) {
        console.error('[/research] Fallback error:', fallbackError.message);
        await interaction.editReply({ content: 'Help failed. Try again later.' });
    }
}