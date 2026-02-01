require('dotenv').config();
const { Client, GatewayIntentBits, channelLink } = require('discord.js');
const ModelClient = require("@azure-rest/ai-inference").default;
const { AzureKeyCredential } = require("@azure/core-auth");
const discordToken = process.env.DISCORD_TOKEN;
const aiToken = process.env.GITHUB_API_KEY;
const aiToken2 = process.env.GITHUB_API_KEY2;
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1-mini";
const wolfyChat = process.env.DEDICATED_CHAT;
const cooldowns = new Map();
const cooldownTime = 10 * 6000;
const chunkSize = 2000;
const memoryString = "You are Wolfy, LUPOS AI assistant, fully aware of the groups history and members: LUPOS was founded on 06/01/2024 after Invicta collapsed due to Hussains toxic leadership and arbitrary, pseudoscientific rules; initially called VATAS with core members Simo (bellatorsymon), Abdullah (bellatorabdullah), Vale (bellatorta/bellatorvale), and Andrew (bellatorandrew), all formerly involved in Invicta, which aimed for self-improvement through a leaderboard rewarding positive daily actions and penalizing “Satanic” behaviors; early LUPOS experiments included SAMSTA Self-Improvement (pushups, meditation, life hacks) which failed, generating the meme “Stare duro”, Abdullahs failed dropshipping and acquisition of a 40k-subscriber channel, Real Estate “Bullets” project, and Brainrot AI videos—all yielding no profits; late 2024 Simo entered monk mode, deepened TRW knowledge, onboarded Vale, Andrew joined later; 2025 flipping became the main money-making focus through 2026; tech developments: Simo created LUPOS CHAT APP (LCA) to migrate from Discord, LUPOS Productivity Suite (LPS) to track member progress, released Wolfy AI, collaborated with Jacopo and Franzys on Vincenzovilla website; supporting members include Tiziano (veteran, silent grinder, school/fitness/knowledge), Franzys/Lorenzo (coding/art, self-development), Jacopo/Jack (clothing flipping, motorcycle, football goalkeeper, multi-activity), Samuele/Sulecco (largely absent, meme cultural presence); culture: self-improvement, discipline, personal/financial freedom, hydration prioritized, shared goal to symbolically defeat Hussain; recurring figures: Alimedak (Chinese iPhone flipper, humorous meme), George Shoes/Giorgio Scarpe (Andrew flipping anecdote, unreliable buyer); timeline shows repeated failures as learning experiences, continuous evolution, memes and figures contextualized, advice incorporates LUPOS mindset, ambition, and motivational tone, emphasizing leveling up in life, business, fitness, and mindset while respecting factual accuracy and cultural relevance. The prompt answer must be not longer than 2000 characters, keep decently long and not exceed the limit, since you cant type for too long, you must use all the characters to explain the concept the best";

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
        GatewayIntentBits.MessageContent
    ]
});

client.on("ready", async () => {
    try {
        const channel = await client.channels.fetch(wolfyChat);
        channel.send("Wolfy is online, i either got rebooted by Simo or i crashed and reborn: All your current requests got deleted, i'm sorry, blame Simo not me");
    } catch (error) {
        console.log("Error with sending the startup message");
    }
})

client.on('messageCreate', async message => {
    const content = message.content.toLowerCase();
    if (!message.guild || message.author.bot) return; // Ignore bots and DMs
    if (message.channel.id !== wolfyChat && content.includes("!wolfy")) {
        message.reply("Use my own chat, damn it! I wont answer here.");
        return
    }

    if (content.includes("morning") || content.includes("gm")) {
        message.reply("GOOD MORNING");
    }

    if (!content.includes("!wolfy")) return;

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

    if (content.includes("!wolfy")) {
        try {
            const userText = message.content.slice("!wolfy".length).trim();
            console.log(`[FIRST-KEY-LOG] detected ai prompt call: ${userText}`);

            if (!userText) return message.reply("Say something for Wolfy!");
            message.reply("Thinking my answer...");
            const response = await aiClient.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: memoryString },
                        { role: "user", content: content }
                    ],
                    temperature: 1.0,
                    top_p: 1.0,
                    model: model
                }
            });
            const text = response.body.choices[0].message.content;
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
                console.log("[FALLBACK-LOG] Entering the fallback");
                console.log(`[FALLBACK-LOG] error: ${error}`);
                const response = await aiClient2.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: memoryString },
                            { role: "user", content: content }
                        ],
                        temperature: 1.0,
                        top_p: 1.0,
                        model: model
                    }
                });
                const text = response.body.choices[0].message.content;
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
                console.log(`[FALLBACK-LOG] Fallback error: ${error}`);
                channel.send(`[FALLBACK-LOG] There has been an error with the fallback, call Symon ${error}`);
            }
        }
    }
});

client.login(discordToken);