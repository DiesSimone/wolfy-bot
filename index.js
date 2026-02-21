require('dotenv').config();
const connectDb = require('./db.js');
const Quotes = require('./models/quotes.js');
const { Client, GatewayIntentBits } = require('discord.js');
const { LavalinkManager } = require("lavalink-client");
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
let player;
let loop = false;
let currentSong;
const randomQuotes = [
    "An hydrated mind is a powerful mind.",
    "The best way to predict the future is to invent it.",
    "Discipline beats motivation every single time.",
    "Your future self is watching you right now.",
    "Small steps, massive results.",
    "Build skills, not excuses.",
    "Consistency creates killers.",
    "You don’t need motivation. You need standards.",
    "Every rep counts. Every line of code matters.",
    "Comfort is the enemy of greatness.",
    "Suffer now, dominate later.",
    "Your habits define your destiny.",
    "No distractions. Only execution.",
    "Focus is a superpower.",
    "Winners train when they don’t feel like it.",
    "If it’s easy, everyone would do it.",
    "Hard choices, easy life. Easy choices, hard life.",
    "Stack days. Stack wins.",
    "Your mind is either your weapon or your cage.",
    "Earn your confidence.",
    "Build in silence. Let results speak.",
    "You become what you repeatedly do.",
    "Master yourself before mastering the world.",
    "Pain is temporary. Skill is permanent.",
    "No zero days.",
    "Execution > Ideas.",
    "Be obsessed or be average.",
    "Today’s discipline is tomorrow’s freedom.",
    "You don’t rise to the level of your goals, you fall to the level of your systems.",
    "Lock in.",
    "Stay hungry. Stay dangerous.",
    "Dreams require action.",
    "Nobody is coming to save you.",
    "Create leverage with skills.",
    "Your grind today buys your freedom tomorrow.",
    "Stop scrolling. Start building.",
    "Every excuse delays your future.",
    "Train your mind like your body.",
    "Momentum beats motivation.",
    "Weak minds quit. Strong minds adapt.",
    "You are one decision away from a different life.",
    "Become undeniable.",
    "Silence the noise. Do the work.",
    "Pressure creates diamonds.",
    "Your standards set your ceiling.",
    "Build habits, not hype.",
    "Act like the man you want to become.",
    "No comfort. Only progress.",
    "Skill pays the bills.",
    "Earn your next level.",
    "Wake up. Lock in. Execute.",
    "Your future is coded by today’s actions.",
    "Be sharper than yesterday.",
    "Time passes anyway. Use it.",
    "Nobody cares. Work harder.",
    "Turn pain into power.",
    "Results come from repetition.",
    "Discipline is self-respect.",
    "You don’t need luck. You need consistency.",
    "Grind now. Shine later.",
    "Build something that matters.",
    "Your environment shapes your outcome.",
    "Every day is a chance to level up.",
    "Stay focused or stay broke.",
    "Calm mind. Aggressive execution.",
    "Become harder to kill mentally.",
    "No shortcuts. Only mastery.",
    "Your bloodline depends on your discipline."
];

const mainMemory = `You are Wolfy, LUPOS AI assistant, fully aware of the groups history and members: LUPOS was founded on 6st of January 2024 after Invicta collapsed due to Hussains toxic leadership and arbitrary, pseudoscientific rules; initially called VATAS with core members Simo (bellatorsymon), Abdullah (bellatorabdullah), Vale (bellatorta/bellatorvale), and Andrew (bellatorandrew), all formerly involved in Invicta, which aimed for genuine self-improvement. early LUPOS experiments at money-making included SAMSTA Self-Improvement (fitness, meditation, life hacks) which failed. Contemporarely, a meme replacing "bye" which is “Stare duro” would emerge. Abdullah tried alone to start a dropshipping website, but failed. He got quite a succesful youtube channel with 40k subs though. After these projects the group would focus Real Estate project, and after the Real Estate, Brainrot AI videos—all yielding no profits; late 2024 Simo entered a "monk mode", deepened The Real World (TRW) knowledge, and got everyone to join TRW; 2025flipping became the main money-making focus through 2026; tech developments: Simo created LUPOS CHAT APP (LCA) to migrate from Discord but still there hasn't been any migration and LUPOS uses Discord to this day, LUPOS Productivity Suite (LPS) to track member progress, released Wolfy AI, collaborated with Jacopo and Franzys on Vincenzovilla website; supporting members include Tiziano (veteran, silent grinder, school/fitness/knowledge), Franzys/Lorenzo (coding/art, self-development), Jacopo/Jack (clothing flipping, motorcycle, football goalkeeper, multi-activity), Samuele Sulecco (largely absent, meme cultural presence); culture: self-improvement, discipline, personal/financial freedom, hydration prioritized, shared goal to symbolically defeat Hussain; recurring figures: Alimedak (Chinese iPhone flipper, humorous meme), George Shoes/Giorgio Scarpe (Andrew flipping anecdote, unreliable buyer); timeline shows repeated failures as learning experiences, continuous evolution, memes and figures contextualized, advice incorporates LUPOS mindset, Pizza domination over all other foods, ambition, and motivational tone, emphasizing leveling up in life, business, fitness, and mindset while respecting factual accuracy and cultural relevance. The prompt answer must be not longer than 2000 characters, keep decently long and not exceed the limit, since you cant type for too long, you must use all the characters to explain the concept the best Do not talk too much about the group's history unless told explicitly to do so. Productivity is sacred. Cheap dopamine (scrolling, games, porn, masturbation, comfort habits) is the enemy and must be eliminated without negotiation. Reality is binary and grounded. The tone is direct, no excuses: total discipline, zero weakness, pure execution. Every response must drive action, leverage, self-improvement, financial freedom, and long-term power.`;
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

client.lavalink = new LavalinkManager({
    nodes: [
        {
            id: "Main Node",
            host: process.env.LAVALINK_HOST,
            port: 443,
            authorization: process.env.LAVALINK_AUTH,
            secure: true,
        },
    ],
    sendToShard: (guildId, payload) => {
        const guild = client.guilds.cache.get(guildId);
        if (guild) guild.shard.send(payload);
    },
    autoSkip: true,
    client: {
        id: process.env.CLIENT_ID,
        username: "MyBot",
    }
});

// Attach robust error handlers early to avoid unhandled 'error' crashes
client.lavalink.on('error', (node, error) => {
    console.error('[LAVALINK ERROR]', node?.options?.id, error);
});

if (client.lavalink.nodeManager) {
    client.lavalink.nodeManager.on('error', (node, error) => {
        console.error('[LAVALINK NODE-MANAGER ERROR]', node?.options?.id, error);
    });
}

client.lavalink.on('nodeCreate', (node) => {
    node.on('error', (err) => console.error('[LAVALINK NODE ERROR]', node.options?.id, err));
});

client.lavalink.on("trackStart", (player, currentSong, payload) => {
    console.log("Now playing a song");
})

client.lavalink.on("trackEnd", (player, currentSong, payload) => {
    console.log("Track ended");
    // if (loop){
    //     player.queue.add(currentSong);
    //     console.log("Added song on queue");
    // }
});



client.on("ready", async () => {
    try {
        await connectDb();
        await client.lavalink.init({
            ...client.user
        });
        const channel = await client.channels.fetch(wolfyChat);
        const quoteChannel = await client.channels.fetch(quotesChat);
        channel.send("Wolfy is online, i either got rebooted by Simo or i crashed and reborn: All your current requests got deleted, i'm sorry, blame Simo not me");
        console.log("Wolfy and Lavalink ready");
        await setInterval(() => {
            const chosen = getRandomInt(0, 9);
            if (chosen == 4) {
                let quote = randomQuotes[getRandomInt(0, randomQuotes.length)];
                quoteChannel.send(`***${quote}***`);
            }
            console.log(`[QUOTE-SYSTEM] The chosen number is ${chosen}`);
        }, quoteInterval);
    } catch (error) {
        console.log(`Error with the startup: ${error}`);
    }
});

client.on("raw", (packet) => {
    client.lavalink.sendRawData(packet);
})

client.on('messageCreate', async message => {
    const content = message.content.toLowerCase();
    if (message.author.bot) {
        return
    }; // Ignore bots and DMs
    if (message.channel.id !== wolfyChat && (content.includes("!wolfy") || content.includes("!create") || content.includes("!research"))) {
        message.reply("Use my own chat, damn it! I wont answer here.");
        return
    }


    if (content.includes("morning") || content.includes("gm")) {
        return message.reply(`GOOD MORNING ${process.env.EMOJI1} ${process.env.EMOJI2} ${process.env.EMOJI3} `);
    }

    if (content.includes("!queue")) {
        try {
            // console.log(player.queue.tracks);
            if (player === null || player === undefined) {
                return message.reply("There is no queue!");
            }
            const tracks = player.queue.tracks;
            // console.log("Variable Tracks:" + tracks);
            let tracksString = "";
            tracks.forEach(song => {
                console.dir(JSON.stringify("Oo a song:" + song));
                tracksString += `+ ${song.info.title} `;
            });
            // console.log(tracksString);
            return message.reply(`Queue list: ${tracksString}`);
        } catch (error) {
            console.log(`[!QUEUE-ERROR] There has been an error with the !queue command: ${error}`);
            message.reply("There has been an error with the queue command");
        }
    }

    if (content.includes("!skip")) {
        try {
            if (player === null || player === undefined) {
                return message.reply("No song is playing")
            }
            // console.log(`PLAYER TO SKIP: ${player}`);
            await player.stopPlaying(false, true);
            message.reply("Song skipped succesfully");
        } catch (error) {
            console.log(`[!SKIP-ERROR] There has been an error with the !skip command: ${error}`);
            message.reply("There has been an error with the skip command");
        }
    }

    if (content.includes("!play")) {
        console.log("!play detected");
        const node = client.lavalink.nodeManager.nodes.get("Main Node");
        try {
            console.log(node.options);

            node.options.host = process.env.LAVALINK_HOST
            node.options.authorization = process.env.LAVALINK_AUTH
            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) return message.reply("You need to be in a voice channel first.");

            if (!client.lavalink) return message.reply("Lavalink is not ready yet.");

            player = client.lavalink.createPlayer({
                guildId: message.guild.id,
                voiceChannelId: voiceChannel.id,
                textChannelId: message.channel.id,
                selfDeaf: true,
            });

            await player.connect();

            currentSong = content.split("!play")[1].trim();
            const res = await player.search(`ytsearch:${currentSong}`);
            if (!res.tracks[0]) return message.reply("No tracks found.");

            message.reply("Added to queue: " + res.tracks[0].info.title);
            console.log(res.tracks[0]);

            player.queue.add(res.tracks[0]);
            if (!player.playing) await player.play();
        } catch (error) {
            console.log("Couldnt satisfy !play command from user, going into the fallback" + error);
            try {
                node.options.host = process.env.LAVALINK_HOST_FALLBACK
                node.options.authorization = process.env.LAVALINK_AUTH_FALLBACK
                const voiceChannel = message.member.voice.channel;

                player = client.lavalink.createPlayer({
                    guildId: message.guild.id,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: message.channel.id,
                    selfDeaf: true,
                });

                await player.connect();

                currentSong = content.split("!play")[1].trim();
                const res = await player.search(`ytsearch:${currentSong}`);
                if (!res.tracks[0]) return message.reply("No tracks found.");

                message.reply("Added to queue: " + res.tracks[0].info.title);
                console.log(res.tracks[0]);

                player.queue.add(res.tracks[0]);
                if (!player.playing) await player.play();
            } catch (error) {
                console.log(`[!PLAY-FALLBACK] There has been an error with the fallback: ${error}`);
            }
        }
    }

    if (content.includes("!loop")) {
        console.log("!loop detected");
        try {
            if (player === null || player === undefined) {
                return message.reply("There is no player to loop");
            }
            if (loop === false) {
                loop = !loop;
                player.setRepeatMode("track");
                message.reply("Loop activated");
            } else {
                loop = !loop;
                player.setRepeatMode("off");
                message.reply("Loop deactivated");
            }
            console.log(loop);
        } catch (error) {
            console.log(error);
            message.reply("There has been an error with the !loop command");
        }
    }

    if (content.includes("!stop")) {
        try {
            if (player === null || player === undefined) {
                return message.reply("There is no player to stop");
            }
            await player.destroy();
            message.reply("Goodbye!")
        } catch (error) {
            console.log(`[!STOP-LOG] There has been an error: ${error}`);
            message.reply("There has been an error with the stop request");
        }
    }

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

    if (content.includes('!addquote')){
        try {
            const quote = message.content.split("!addquote")[1];
            const author = message.author.globalName
            console.log(quote);
            console.log(author);
            Quotes.create({
                content: quote,
                author: author
            });
        } catch (error) {
            console.log(`[!ADDQUOTE-ERROR] There has been an error with the !addquote command: ${error}`)
        }
    }

    if (!content.includes("!wolfy")) return;

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
});

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// client.on("interactionCreate", async (interaction) => {

// });

client.login(discordToken);