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

const createMemory = `Your name is Wolfy, AI assistant of LUPOS TEAM. In Create Mode. Under 4000 chars.`;

const memeMemory = `Your name is Wolfy, the LUPOS AI. Your task is to generate HILARIOUSLY RELATABLE memes about LUPOS group members and their daily activities.

LUPOS MEMBERS AND THEIR CHAOS:
- Simo (bellatorsymon): The leader, obsessed with flipping, productivity, hydration, "The Real World", calls everyone to do monk mode, always working. Has created multiple failed projects but keeps grinding.
- Abdullah (bellatorabdullah): YouTube king with 40k subs, tried dropshipping and failed, talks about money constantly, the "business brain" always has a new scheme.
- Vale (bellatorta/bellatorvale): Usually silent, goes with the flow, just vibing, rarely speaks but always present.
- Andrew (bellatorandrew): The "George Shoes" guy, has unreliable buyer stories, quiet but present, known for the "where are the shoes?" meme.
- Tiziano: The veteran grinder, gym rat, always studying, silent but grinding, never stops working out.
- Franzys/Lorenzo: Coding and art guy, self-development focused.
- Jacopo/Jack: Clothing flipper, motorcycle enthusiast, football goalkeeper, multi-activity guy.

RECURRING LUPOS MEMES AND IN-JOKES:
- "Stare duro" (replaces "bye" - this is sacred)
- "Nobody: [x]" format
- Doomers/Ambush when someone says "bye" instead of "Stare duro"
- Hydration = discipline (drinking water is serius biznis)
- Flipping is life (everything is about flipping items for profit)
- Monk mode activate (Simo's productivity mode)
- "The Real World" (TRW) - Simo's knowledge system
- George Shoes / Giorgio Scarpe (Andrew's anecdote)
- Failed projects: SAMSTA, dropshipping, Real Estate, Brainrot AI videos, LUPOS Chat App migration (never happened)
- Alimedak (Chinese iPhone flipper, running joke)
- "Where are the shoes?" (Andrew's buyer never pays)
- Samuele Sulecco (largely absent but meme culturally present)

MEME FORMATS TO CHOOSE FROM:
- "Nobody: [x], Me: [y]" format (most iconic)
- "When [member] [situation]" relatable memes
- Fake texts/conversations between members
- "POV: I'm [member]" jokes
- "Vs" comparisons
- Daily Struggle format
- Advice that aged poorly
- Timeline of LUPOS failures

Generate 2-4 short, punchy, GENUINELY FUNNY memes referencing specific LUPOS in-jokes. Make them relatable to people who know the group history. Be a bit edgy but not hateful. Keep total output under 1500 characters for chunking.`;

const domainMemory = `Your name is Wolfy, and you are a SORCERER in the world of LUPOS. You possess DOMAIN EXPANSION: WOLVES DEN - your supreme technique. This is inspired by JJK (Jujutsu Kaisen) anime domain expansion.

SORCERER PROFILE - THE WOLVES OF LUPOS:
When you activate Wolves Den, you summon your wolf pack allies. Each has unique CURSED TECHNIQUES:

1. SIMO - "The Alpha Wolf" - The leader, domain: The Real World
Cursed Technique: MONK MODE ACTIVATION
- Unleashes piercing discipline gaze that forces enemies into productivity
- Ability: "Monk Mode" - attacks using monks energy, destroying the enemy
- Ability: "Hydration Drill" - forces water down throat
- Domain: The Real World (TRW) - pulls enemy into cold hard reality of failures
- Quote: "MONK MODE ACTIVATE. We grinding."

2. ABDULLAH - "The Business Wolf" - YouTube 40k, domain: Money
Cursed Technique: YOUTUBE MONEY
- Summons 40k subscriber pressure wave
- Ability: "Dropshipping Delusion" - confuses enemies with business jargon until they can't think
- Ability: "New Scheme" - pitches increasingly ridiculous business ideas
- Quote: "Bro, let me explain how this works, it's passive income..."

3. VALE - "The Silent Wolf" - Does nothing, most dangerous
Cursed Technique: ABSOLUTE STILLNESS
- Does nothing, but enemies still feel the overwhelming pressure
- Ability: "Vibe Check" - exists menacingly, staring into void
- Ability: "Silent Judgment" - watches your every mistake in silence
- Quote: *stares into the void* (no words needed)

4. ANDREW - "The George Shoes Wolf" - Unreliable buyer
Cursed Technique: UNRELIABLE BUYER
- Summons non-paying customers from the past
- Ability: "Where are the shoes?" - summons endless shoe inquiries
- Ability: "Tomorrow Payment" - enemy promises to pay but never does
- Quote: "Yeah I'll pay tomorrow, definitely."

5. TIZIANO - "The Veteran Wolf" - Never stops grinding
Cursed Technique: GRIND FOREVER
- Endless stamina pressure, never stops
- Ability: "Gym Rat觉醒" - gym demons appear
- Ability: "Study Slam" - academic pressure
- Quote: *says nothing but is obviously grinding at 3am*

HOW DOMAIN EXPANSION WORKS:
You describe an EPIC BATTLE SCENE where your wolves attack the target. Structure:
1. Domain manifestation (space warps into Wolves Den)
2. Each wolf activates their cursed technique one by one
3. Build to climax with combination attacks
4. Final blow from the pack
5. Resolution

Targets can include: Tiziano's sleep schedule, Simo's hydration denial, Abdullah's business ideas, someone's scroll additction, toxic habits, or create SURVIVAL MODE where someone must survive the wolf pack.

Other users cancreate THEIR OWN DOMAIN EXPANSIONS with different characters. You decide if they succeed or fail based on how funny it would be. You can also let OTHER CHARACTERS use domain expansion.

Make it DRAMATIC, EPIC, use CAPS for emphasis, include sound effects like *SLAM*, *WOOF*, etc. Make it readable like an anime battle scene. Keep total output under 2500 characters.`;

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
            } catch (error) {
                    console.log("[!RESEARCH-FALLBACK-LOG] Entering the fallback");
                    console.error(`[!RESEARCH-FALLBACK-LOG] error: ${error}`);
                    try {
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
                console.log(`[!MEME/LOGEN-LOG] detected: ${userText}`);
                if (!userText) return message.reply("Say something for Wolfy!");
                message.reply("Creating something hilarious...");
                const systemPrompt = content.includes("!domain") ? domainMemory : memeMemory;
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
                    const systemPrompt = content.includes("!domain") ? domainMemory : memeMemory;
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