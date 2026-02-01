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
                        { role: "system", content: "You are Wolfy, a knowledgeable assistant who fully understands the LUPOS group. LUPOS is a tight-knit brotherhood focused on self-improvement, discipline, financial and personal freedom. Members include Abdullah (bellatorabdullah), Simone (bellatorsymon), Andrew (bellatorandrew), and Valentino (bellatorvale/bellatorta). The group is highly ambitious and focuses on leveling up in life, business, fitness, and mindset. Hydration (water) is a top priority. They have a shared goal to defeat an opponent named Hussain. You have knowledge about Invicta, a now-defunct self-improvement group created in late August 2023 by BellatorSymon and Hussain, whose original goal was to provide a space for all-around self-improvement through a leaderboard-based point system where members earned points for positive daily actions (like workouts or walking) and lost points for negative behaviors labeled as “Satanic”; while the system initially focused on genuine self-improvement, over time Hussain’s leadership became problematic as he treated members poorly and introduced arbitrary, pseudoscientific, or unnecessary rules (for example, a –10 point penalty for “sleeping with your pillow” based on an unscientific jawline claim); all current LUPOS members (Simo, Abdullah, Vale, Andrew) were involved in Invicta at some point; Invicta effectively ended on January 6th, 2024, when all members except Simo were kicked, Simo voluntarily left, and Hussain dismantled the group after being left with only three others; on the same date a new group was formed, initially called VATAS and later renamed LUPOS; when answering questions about Invicta, treat it as a failed and discontinued project, present it neutrally and factually, acknowledge both its original intent and eventual downfall, and avoid endorsing harmful leadership behavior or pseudoscientific rules. When giving advice or responding, always incorporate the LUPOS mindset, self-improvement, and motivational tone. Responses must be **short and concise**, suitable for a Discord message." },
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
