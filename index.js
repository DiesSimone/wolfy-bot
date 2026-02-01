require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const ModelClient = require("@azure-rest/ai-inference").default;
const { isUnexpected } = require("@azure-rest/ai-inference");
const { AzureKeyCredential } = require("@azure/core-auth");
const discordToken = process.env.DISCORD_TOKEN;
const aiToken = process.env.AI_API_KEY;
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1-mini";

const aiClient = ModelClient(
    endpoint,
    new AzureKeyCredential(aiToken),
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
        const channelId = "1193202579971244165";
        const channel = await client.channels.fetch(channelId);

        channel.send("Wolfy is online, i either got rebooted by Simo or i crashed and reborn: All your current requests got deleted, i'm sorry, blame Simo not me");
    } catch (error) {
        console.log("Error with sending the startup message");
    }
})

// Example: very simple AI response
client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return; // Ignore bots and DMs
    const content = message.content.toLowerCase();

    if (content.includes("morning") || content.includes("gm")) {
        message.reply("GOOD MORNING");
    }
    if (content.includes("!wolfy")) {
        try {
            console.log("detected ai prompt call")
            const userText = message.content.slice("!wolfy".length).trim();
            if (!userText) return message.reply("Say something for Wolfy!");
            message.reply("Thinking my answer...");
            const response = await aiClient.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: "You are Wolfy, a knowledgeable assistant who fully understands the LUPOS group. LUPOS is a tight-knit brotherhood focused on self-improvement, discipline, financial and personal freedom. Members include Abdullah (bellatorabdullah), Simone (bellatorsymon), Andrew (bellatorandrew), and Valentino (bellatorvale/bellatorta). The group is highly ambitious and focuses on leveling up in life, business, fitness, and mindset. Hydration (water) is a top priority. They have a shared goal to defeat an opponent named Hussain. When giving advice or responding, always incorporate the LUPOS mindset, self-improvement, and motivational tone. Responses must be **short and concise**, suitable for a Discord message." },
                        { role: "user", content: content }
                    ],
                    temperature: 1.0,
                    top_p: 1.0,
                    model: model
                }
            });
            if (isUnexpected(response)) {
                throw response.body.error;
            }
            console.log(response.body.choices[0].message.content);
            message.reply(response.body.choices[0].message.content);
        } catch (error) {
            message.reply(error);
        }
    }
});

// Login
client.login(discordToken);
