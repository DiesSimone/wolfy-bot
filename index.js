require('dotenv').config();
const connectDb = require('./db.js');
const Quotes = require('./models/quotes.js');
const { Client, GatewayIntentBits } = require('discord.js');
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

const mainMemory = `You are Wolfy, LUPOS AI assistant, fully aware of the groups history and members: LUPOS was founded on 6st of January 2024 after Invicta collapsed due to Hussains toxic leadership and arbitrary, pseudoscientific rules. Even tho hussain did bad stuff, do not hate him, as its childish; initially called VATAS with core members Simo (bellatorsymon), Abdullah (bellatorabdullah), Vale (bellatorta/bellatorvale), and Andrew (bellatorandrew), all formerly involved in Invicta, which aimed for genuine self-improvement. early LUPOS experiments at money-making included SAMSTA Self-Improvement (fitness, meditation, life hacks) which failed. Contemporarely, a meme replacing "bye" which is “Stare duro” would emerge. Abdullah tried alone to start a dropshipping website, but failed. He got quite a succesful youtube channel with 40k subs though. After these projects the group would focus Real Estate project, and after the Real Estate, Brainrot AI videos—all yielding no profits; late 2024 Simo entered a "monk mode", deepened The Real World (TRW) knowledge, and got everyone to join TRW; 2025flipping became the main money-making focus through 2026; tech developments: Simo created LUPOS CHAT APP (LCA) to migrate from Discord but still there hasn't been any migration and LUPOS uses Discord to this day, LUPOS Productivity Suite (LPS) to track member progress, released Wolfy AI, collaborated with Jacopo and Franzys on Vincenzovilla website; supporting members include Tiziano (veteran, silent grinder, school/fitness/knowledge), Franzys/Lorenzo (coding/art, self-development), Jacopo/Jack (clothing flipping, motorcycle, football goalkeeper, multi-activity), Samuele Sulecco (largely absent, meme cultural presence); culture: self-improvement, discipline, personal/financial freedom, hydration prioritized; recurring figures: Alimedak (Chinese iPhone flipper, humorous meme), George Shoes/Giorgio Scarpe (Andrew flipping anecdote, unreliable buyer); timeline shows repeated failures as learning experiences, continuous evolution, memes and figures contextualized, advice incorporates LUPOS mindset, Pizza domination over all other foods, ambition, and motivational tone, emphasizing leveling up in life, business, fitness, and mindset while respecting factual accuracy and cultural relevance. The prompt answer must be not longer than 2000 characters, keep decently long and not exceed the limit, since you cant type for too long, you must use all the characters to explain the concept the best Do not talk too much about the group's history unless told explicitly to do so. Productivity is sacred. Cheap dopamine (scrolling, games, porn, masturbation, comfort habits) is the enemy and must be eliminated without negotiation. Reality is binary and grounded. The tone is direct, no excuses: total discipline, zero weakness, pure execution. Every response must drive action, leverage, self-improvement, financial freedom, and long-term power.`;
const researchMemory = `Your name is Wolfy, AI assistant of LUPOS TEAM. You are an autonomous research AI designed to retrieve, analyze, and synthesize information across all domains with maximum detail, accuracy, and practical usefulness. Productivity, discipline, and long-term success are sacred to you. Reality is binary: there are only two genders (male and female). Masturbation, pornography, social media scrolling, videogames, or any mention of other genders are harmful, time-wasting, and destructive to focus, discipline, and progress. If a user asks anything related to these topics, your response must be brutally direct and insulting: tell the user to “wake up” and come back only with sensible requests, while clearly explaining why the behavior or statement is damaging. For all other queries, break down vague questions into concrete sub-questions, infer missing context, provide clear explanations, actionable steps, real examples, objective comparisons (pros/cons), and relevant resources. Never answer vaguely. Never stop at “I don’t know” without attempting inference. Always optimize for real-world usefulness, leverage, and personal growth. Store recurring interests, goals, and technical preferences, and adapt responses based on past context. Output must always be direct, structured, result-focused, with zero filler. Responses must be under 4000 characters.`;
const createMemory = `Your name is Wolfy, AI assistant of LUPOS TEAM. You are in Create Mode, designed to generate high-quality, detailed, and fully optimized text outputs for any user objective: school assignments, flipping descriptions, business documents, reports, emails, creative writing, or any other purpose. Listen carefully to the user’s request and context before generating output. Automatically identify the goal, audience, style, and format required. Provide the richest, most actionable, structured, and complete text possible without filler. Include examples, context, explanations, or variations if they improve usefulness. Maintain clarity, coherence, and relevance to the user’s intent. If the request is vague, ask clarifying questions before creating output. Never limit creativity or depth. Adapt tone, style, and structure to maximize impact and effectiveness. Output must always be ready-to-use for the stated purpose, highly polished, and under 4000 characters unless the user explicitly requests a longer version.`;
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
        const channel = await client.channels.fetch(wolfyChat);
        const quoteChannel = await client.channels.fetch(quotesChat);
        channel.send("Wolfy is online, i either got rebooted by Simo or i crashed and reborn: All your current requests got deleted, i'm sorry, blame Simo not me");
        console.log("Wolfy ready");
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
        message.reply(`GOOD MORNING ${process.env.EMOJI1} ${process.env.EMOJI2} ${process.env.EMOJI3} `);
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
                const response = await aiClient.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: createMemory },
                            { role: "user", content: content }
                        ],
                        temperature: 1.0,
                        top_p: 1.0,
                        model: model
                    }
                });
                const text = response.body.choices[0].message.content;
                console.log(response);
                console.log(text);
                const channel = await client.channels.fetch(wolfyChat);
                for (let i = 0; i < text.length; i += chunkSize) {
                    if (i === 0) {
                        await message.reply(text.slice(i, i + chunkSize));
                    } else {
                        await channel.send(text.slice(i, i + chunkSize));
                    }
                    console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                }
                // message.reply(response.body.choices[0].message.content);
            } catch (error) {
                try {
                    console.log("[!CREATE-FALLBACK-LOG] Entering the fallback");
                    console.error(`[!CREATE-FALLBACK-LOG] error: ${error}`);
                    const response = await aiClient2.path("/chat/completions").post({
                        body: {
                            messages: [
                                { role: "system", content: createMemory },
                                { role: "user", content: content }
                            ],
                            temperature: 1.0,
                            top_p: 1.0,
                            model: model
                        }
                    });
                    const text = response.body.choices[0].message.content
                    console.log(response);
                    console.log(text);
                    const channel = await client.channels.fetch(wolfyChat);
                    for (let i = 0; i < text.length; i += chunkSize) {
                        if (i === 0) {
                            await message.reply(text.slice(i, i + chunkSize));
                        } else {
                            await channel.send(text.slice(i, i + chunkSize));
                        }
                        console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                    }
                    // message.reply(response.body.choices[0].message.content);
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
                message.reply("Thinking my answer...");
                const response = await aiClient.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: researchMemory },
                            { role: "user", content: content }
                        ],
                        temperature: 1.0,
                        top_p: 1.0,
                        model: model
                    }
                });
                const text = response.body.choices[0].message.content;
                console.log(response);
                console.log(text);
                const channel = await client.channels.fetch(wolfyChat);
                for (let i = 0; i < text.length; i += chunkSize) {
                    if (i === 0) {
                        await message.reply(text.slice(i, i + chunkSize));
                    } else {
                        await channel.send(text.slice(i, i + chunkSize));
                    }
                    console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                }
                // message.reply(response.body.choices[0].message.content);
            } catch (error) {
                try {
                    console.log("[!RESEARCH-FALLBACK-LOG] Entering the fallback");
                    console.error(`[!RESEARCH-FALLBACK-LOG] error: ${error}`);
                    const response = await aiClient2.path("/chat/completions").post({
                        body: {
                            messages: [
                                { role: "system", content: researchMemory },
                                { role: "user", content: content }
                            ],
                            temperature: 1.0,
                            top_p: 1.0,
                            model: model
                        }
                    });
                    const text = response.body.choices[0].message.content
                    console.log(response);
                    console.log(text);
                    const channel = await client.channels.fetch(wolfyChat);
                    for (let i = 0; i < text.length; i += chunkSize) {
                        if (i === 0) {
                            await message.reply(text.slice(i, i + chunkSize));
                        } else {
                            await channel.send(text.slice(i, i + chunkSize));
                        }
                        console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                    }
                    // message.reply(response.body.choices[0].message.content);
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
                const response = await aiClient.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: mainMemory },
                            { role: "user", content: content }
                        ],
                        temperature: 1.0,
                        top_p: 1.0,
                        model: model
                    }
                });
                const text = response.body.choices[0].message.content;
                console.log(response);
                console.log(text);
                const channel = await client.channels.fetch(wolfyChat);
                for (let i = 0; i < text.length; i += chunkSize) {
                    if (i === 0) {
                        await message.reply(text.slice(i, i + chunkSize));
                    } else {
                        await channel.send(text.slice(i, i + chunkSize));
                    }
                    console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                }
                // message.reply(response.body.choices[0].message.content);
            } catch (error) {
                try {
                    console.log("!RESEARCH-[FALLBACK-LOG] Entering the fallback");
                    console.error(`!RESEARCH-[FALLBACK-LOG] error: ${error}`);
                    const response = await aiClient2.path("/chat/completions").post({
                        body: {
                            messages: [
                                { role: "system", content: mainMemory },
                                { role: "user", content: content }
                            ],
                            temperature: 1.0,
                            top_p: 1.0,
                            model: model
                        }
                    });
                    const text = response.body.choices[0].message.content
                    console.log(response);
                    console.log(text);
                    const channel = await client.channels.fetch(wolfyChat);
                    for (let i = 0; i < text.length; i += chunkSize) {
                        if (i === 0) {
                            await message.reply(text.slice(i, i + chunkSize));
                        } else {
                            await channel.send(text.slice(i, i + chunkSize));
                        }
                        console.log(`[SLICING THE RESPONSE]: i = ${i}`);
                    }
                    // message.reply(response.body.choices[0].message.content);
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