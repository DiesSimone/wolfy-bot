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

    if (content.includes("morning") || content.includes("gm")) {
        message.reply(`GOOD MORNING`);
    }

    if (message.channel.id == wolfyChat && content.startsWith("!")) {
        if (content.includes("!create")) {
            const now = Date.now();
            const userId = message.author.id;

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownTime;
                if (now < expirationTime) {
                    const remaining = Math.ceil((expirationTime - now) / 1000);
                    return message.reply(`Wait ${remaining}s before using !create again.`);
                }
            }
            cooldowns.set(userId, now);
            try {
                if (content.includes("porn") || content.includes("masturbation") || content.includes("fap") || content.includes("videogames") || content.includes("scrolling") || content.includes("gay") || content.includes("homosexuality")) {
                    return message.reply("Are you serious? Spending your time on masturbation, porn, social media, and videogames is pathetic. You are literally sabotaging yourself and throwing your life away. Wake up. Come back when you have sensible requests and the drive to actually do something useful instead of acting like a loser.");
                }

                const userText = message.content.slice("!create".length).trim();
                console.log(`[!CREATE-LOG] detected ai prompt call: ${userText}`);

                if (!userText) return message.reply("Say something for Wolfy!");
                message.reply("Thinking my answer...");
                
                const systemPrompt = buildPrompt(content, 'create');
                
                const response = await aiClient.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: content }
                        ],
                        temperature: 1.0,
                        top_p: 1.0,
                        model: model
                    }
                });
                const text = response.body.choices[0].message.content;
                console.log("[!CREATE] Full response object:", response);
                console.log("[!CREATE] Output message location: response.body.choices[0].message.content");
                console.log("[!CREATE] Output message text:", text);
                const channel = await client.channels.fetch(wolfyChat);
                for (let i = 0; i < text.length; i += chunkSize) {
                    if (i === 0) {
                        await message.reply(text.slice(i, i + chunkSize));
                    } else {
                        await channel.send(text.slice(i, i + chunkSize));
                    }
                    console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                    console.log(`[SENDING MESSAGE] Channel: ${i === 0 ? 'DM reply to user' : 'wolfyChat channel'}, Message chunk:`, text.slice(i, i + chunkSize));
                }
            } catch (error) {
                    console.log("[!CREATE-FALLBACK-LOG] Entering the fallback");
                    console.error(`[!CREATE-FALLBACK-LOG] error: ${error}`);
                    try {
                        const systemPrompt = buildPrompt(content, 'create');
                        const response = await aiClient2.path("/chat/completions").post({
                            body: {
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: content }
                                ],
                                temperature: 1.0,
                                top_p: 1.0,
                                model: model
                            }
                        });
                        const text = response.body.choices[0].message.content
                        console.log("[!CREATE-FALLBACK] Full response object:", response);
                        console.log("[!CREATE-FALLBACK] Output message location: response.body.choices[0].message.content");
                        console.log("[!CREATE-FALLBACK] Output message text:", text);
                        const channel = await client.channels.fetch(wolfyChat);
                        for (let i = 0; i < text.length; i += chunkSize) {
                            if (i === 0) {
                                await message.reply(text.slice(i, i + chunkSize));
                            } else {
                                await channel.send(text.slice(i, i + chunkSize));
                            }
                            console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                        }
                    } catch (error) {
                        console.error(`[FALLBACK-LOG] Fallback error: ${error}`);
                        const channel = await client.channels.fetch(wolfyChat).catch(() => null);
                        if (channel) channel.send(`You probably went against the engine policy, pls stop`);
                    }
                }
        }

        if (content.includes("!research")) {
            const now = Date.now();
            const userId = message.author.id;

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownTime;
                if (now < expirationTime) {
                    const remaining = Math.ceil((expirationTime - now) / 1000);
                    return message.reply(`Wait ${remaining}s before using !research again.`);
                }
            }
            cooldowns.set(userId, now);
            try {
                if (content.includes("porn") || content.includes("masturbation") || content.includes("fap") || content.includes("videogames") || content.includes("scrolling") || content.includes("gay") || content.includes("homosexuality")) {
                    return message.reply("Are you serious? Spending your time on masturbation, porn, social media, and videogames is pathetic. You are literally sabotaging yourself and throwing your life away. Wake up. Come back when you have sensible requests and the drive to actually do something useful instead of acting like a loser.");
                }

                const userText = message.content.slice("!research".length).trim();
                console.log(`[!RESEARCH-LOG] detected ai prompt call: ${userText}`);

                if (!userText) return message.reply("Say something for Wolfy!");
                
                // ========================================================================
                // WEB RESEARCH INTEGRATION
                // ========================================================================
                // ALWAYS try Exa AI web research first for every !research command
                // Only fall back to legacy AI if Exa fails (error or no response)
                // No keyword detection - always try web search first
                // ========================================================================
                
                let webSearchFailed = false;
                let webResult = null;
                
                // Always attempt web research if EXA_API_KEY is configured
                if (isWebResearchConfigured()) {
                    try {
                        console.log('[!RESEARCH] Attempting Exa AI web research...');
                        message.reply("🔍 Searching the web...");
                        
                        // This will throw if Exa fails, causing us to fall back
                        webResult = await performWebResearch(userText, aiClient, aiClient2, model);
                        
                        // Check if we got a valid response
                        if (webResult && webResult.needsWebSearch && webResult.answer) {
                            console.log('[!RESEARCH] Exa AI succeeded, using web results');
                        } else {
                            // Exa returned but no valid answer - treat as failure
                            console.log('[!RESEARCH] Exa returned empty result, falling back to legacy');
                            webSearchFailed = true;
                        }
                    } catch (error) {
                        // Exa API failed - fall back to legacy
                        console.error('[!RESEARCH] Exa AI failed:', error.message);
                        webSearchFailed = true;
                    }
                } else {
                    // EXA_API_KEY not configured
                    console.log('[!RESEARCH] EXA not configured, using legacy research');
                    webSearchFailed = true;
                }
                
                // Fall back to legacy AI if web search failed (or wasn't configured)
                if (webSearchFailed || !webResult || !webResult.answer) {
                    // Fall back to static AI (original behavior)
                    message.reply("Real time web search failed, proceeding with classic research...");
                    const systemPrompt = buildPrompt(content, 'research');
                    
                    const response = await aiClient.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: content }
                        ],
                        temperature: 1.0,
                        top_p: 1.0,
                        model: model
                    }
                });
                const text = response.body.choices[0].message.content;
                console.log("[!RESEARCH] Full response object:", response);
                console.log("[!RESEARCH] Output message location: response.body.choices[0].message.content");
                console.log("[!RESEARCH] Output message text:", text);
                const channel = await client.channels.fetch(wolfyChat);
                for (let i = 0; i < text.length; i += chunkSize) {
                    if (i === 0) {
                        await message.reply(text.slice(i, i + chunkSize));
                    } else {
                        await channel.send(text.slice(i, i + chunkSize));
                    }
                    console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                    console.log(`[SENDING MESSAGE] Channel: ${i === 0 ? 'DM reply to user' : 'wolfyChat channel'}, Message chunk:`, text.slice(i, i + chunkSize));
                }
                } else {
                    // Web search result - send as embed
                    console.log('[!RESEARCH] Sending web research results');
                    
                    const embed = new EmbedBuilder()
                        .setTitle(`🔍 Research: ${userText}`)
                        .setColor(0x5865F2)
                        .setDescription(webResult.answer)
                        .addFields(
                            { name: '📚 Sources', value: webResult.sources || 'No sources', inline: false }
                        )
                        .setFooter({ text: 'Powered by Exa AI • Real-time search' })
                        .setTimestamp();
                    
                    const channel = await client.channels.fetch(wolfyChat);
                    await channel.send({ embeds: [embed] });
                }
            } catch (error) {
                    console.log("[!RESEARCH-FALLBACK-LOG] Entering the fallback");
                    console.error(`[!RESEARCH-FALLBACK-LOG] error: ${error}`);
                    try {
                        const systemPrompt = buildPrompt(content, 'research');
                        const response = await aiClient2.path("/chat/completions").post({
                            body: {
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: content }
                                ],
                                temperature: 1.0,
                                top_p: 1.0,
                                model: model
                            }
                        });
                        const text = response.body.choices[0].message.content
                        console.log("[!RESEARCH-FALLBACK] Full response object:", response);
                        console.log("[!RESEARCH-FALLBACK] Output message location: response.body.choices[0].message.content");
                        console.log("[!RESEARCH-FALLBACK] Output message text:", text);
                        const channel = await client.channels.fetch(wolfyChat);
                        for (let i = 0; i < text.length; i += chunkSize) {
                            if (i === 0) {
                                await message.reply(text.slice(i, i + chunkSize));
                            } else {
                                await channel.send(text.slice(i, i + chunkSize));
                            }
                            console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                        }
                    } catch (error) {
                        console.error(`[FALLBACK-LOG] Fallback error: ${error}`);
                        const channel = await client.channels.fetch(wolfyChat).catch(() => null);
                        if (channel) channel.send(`You probably went against the engine policy, pls stop`);
                    }
                }
        }

        if (content.includes('!addquote')) {
            try {
                const quote = message.content.split("!addquote")[1];
                const author = message.author.globalName
                console.log(quote);
                console.log(author);
                await Quotes.create({
                    content: quote,
                    author: author
                });
                randomQuotes = await Quotes.find({});
                message.reply(`Quote created successfully!: ***${quote} - ${author}***`);
            } catch (error) {
                console.log(`[!ADDQUOTE-ERROR] There has been an error with the !addquote command: ${error}`)
            }
        }

        if (content.includes("!meme") || content.includes("!domain")) {
            const now = Date.now();
            const userId = message.author.id;

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownTime;
                if (now < expirationTime) {
                    const remaining = Math.ceil((expirationTime - now) / 1000);
                    return message.reply(`Wait ${remaining}s before using ${content.includes("!meme") ? "!meme" : "!domain"} again.`);
                }
            }
            cooldowns.set(userId, now);
            try {
                const userText = content.includes("!meme") ? message.content.slice("!meme".length).trim() : message.content.slice("!domain".length).trim();
                console.log(`[!MEME/DOMAIN-LOG] detected: ${userText}`);
                if (!userText) return message.reply("Say something for Wolfy!");
                message.reply("Creating something hilarious...");
                
                const mode = content.includes("!domain") ? 'domain' : 'meme';
                const systemPrompt = buildPrompt(content, mode);
                const response = await aiClient.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userText }
                        ],
                        temperature: 1.0,
                        top_p: 1.0,
                        model: model
                    }
                });
                const text = response.body.choices[0].message.content;
                console.log("[!MEME/DOMAIN] Output:", text);
                const channel = await client.channels.fetch(wolfyChat);
                for (let i = 0; i < text.length; i += chunkSize) {
                    if (i === 0) {
                        await message.reply(text.slice(i, i + chunkSize));
                    } else {
                        await channel.send(text.slice(i, i + chunkSize));
                    }
                }
            } catch (error) {
                console.log("[!MEME/DOMAIN-FALLBACK] Trying alt client");
                try {
                    const userText = content.includes("!meme") ? message.content.slice("!meme".length).trim() : message.content.slice("!domain".length).trim();
                    const mode = content.includes("!domain") ? 'domain' : 'meme';
                    const systemPrompt = buildPrompt(content, mode);
                    const response = await aiClient2.path("/chat/completions").post({
                        body: {
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userText }
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
                            await message.reply(text.slice(i, i + chunkSize));
                        } else {
                            await channel.send(text.slice(i, i + chunkSize));
                        }
                    }
                } catch (err) {
                    console.error("[!MEME/DOMAIN-ERROR]", err);
                    message.reply("Wolfy tripped on his own paws, try again");
                }
            }
        }

        // if (!content.includes("!wolfy")) return;

        if (content.includes("!wolfy")) {
            const now = Date.now();
            const userId = message.author.id;

            if (cooldowns.has(userId)) {
                const expirationTime = cooldowns.get(userId) + cooldownTime;
                if (now < expirationTime) {
                    const remaining = Math.ceil((expirationTime - now) / 1000);
                    return message.reply(`Wait ${remaining}s before using !wolfy again.`);
                }
            }
            cooldowns.set(userId, now);
            try {
                const userText = message.content.slice("!wolfy".length).trim();
                console.log(`[!WOLFY-LOG] detected ai prompt call: ${userText}`);

                if (!userText) return message.reply("Say something for Wolfy!");
                message.reply("Thinking my answer...");
                
                // ========================================================================
                // PROMPT SYSTEM INTEGRATION - !wolfy command
                // ========================================================================
                // HOW IT WORKS:
                // 1. Take FULL message (including "!wolfy" prefix) as input
                // 2. Call buildPrompt(message, 'wolfy') 
                // 3. buildPrompt() does:
                //    - detectTopics() → scans for keywords (gender, productivity, etc.)
                //    - isLuposRelated() → checks if LUPOS mentioned
                //    - buildWolfyPrompt() → assembles: CORE_IDENTITY + optional LUPOS_CONTEXT + optional BELIEF_MODULES
                // 4. Result: Clean answer for unrelated topics, full context for relevant ones
                //
                // DEBUG: Check console for "[PROMPTS] Mode: wolfy, Detected topics: gender, LUPOS: false"
                // ========================================================================
                const systemPrompt = buildPrompt(content, 'wolfy');
                
                const response = await aiClient.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: content }
                        ],
                        temperature: 1.0,
                        top_p: 1.0,
                        model: model
                    }
                });
                const text = response.body.choices[0].message.content;
                console.log("[!WOLFY] Full response object:", response);
                console.log("[!WOLFY] Output message location: response.body.choices[0].message.content");
                console.log("[!WOLFY] Output message text:", text);
                const channel = await client.channels.fetch(wolfyChat);
                for (let i = 0; i < text.length; i += chunkSize) {
                    if (i === 0) {
                        await message.reply(text.slice(i, i + chunkSize));
                    } else {
                        await channel.send(text.slice(i, i + chunkSize));
                    }
                    console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                    console.log(`[SENDING MESSAGE] Channel: ${i === 0 ? 'DM reply to user' : 'wolfyChat channel'}, Message chunk:`, text.slice(i, i + chunkSize));
                }
            } catch (error) {
                    console.log("!RESEARCH-[FALLBACK-LOG] Entering the fallback");
                    console.error(`!RESEARCH-[FALLBACK-LOG] error: ${error}`);
                    try {
                        const systemPrompt = buildPrompt(content, 'wolfy');
                        const response = await aiClient2.path("/chat/completions").post({
                            body: {
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: content }
                                ],
                                temperature: 1.0,
                                top_p: 1.0,
                                model: model
                            }
                        });
                        const text = response.body.choices[0].message.content
                        console.log("[!WOLFY-FALLBACK] Full response object:", response);
                        console.log("[!WOLFY-FALLBACK] Output message location: response.body.choices[0].message.content");
                        console.log("[!WOLFY-FALLBACK] Output message text:", text);
                        const channel = await client.channels.fetch(wolfyChat);
                        for (let i = 0; i < text.length; i += chunkSize) {
                            if (i === 0) {
                                await message.reply(text.slice(i, i + chunkSize));
                            } else {
                                await channel.send(text.slice(i, i + chunkSize));
                            }
                            console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                        }
                    } catch (error) {
                        console.error(`[!RESEARCH-FALLBACK-LOG] Fallback error: ${error}`);
                        const channel = await client.channels.fetch(wolfyChat).catch(() => null);
                        if (channel) channel.send(`You probably went against the engine policy, pls stop`);
                    }
                }
        }
    } else if (message.channelId != wolfyChat && message.content.startsWith("!")) {
        message.reply(`Listen, i cant tell if you just put a random esclamation mark (!) at the beginning of the sentence or you invoked one of my fabolous commands, in case you did.... Does this seem Wolfy house to you? WE'RE LITERALLY IN <#${message.channelId}> YOU IDIOT`);
    } 
});

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min
    console.log(`[RANDOM-NUM] ${randomNum}`);
    return randomNum;
}

client.login(discordToken);

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    if (interaction.commandName === 'summarize') {
        await handleSummarizeCommand(interaction);
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