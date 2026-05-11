/**
 * =============================================================================
 * MORNING MESSAGE MODULE
 * =============================================================================
 * 
 * Sends an AI-generated motivational message every day at 4AM UTC to a 
 * designated channel, pinging everyone to start the day.
 * 
 * CONFIGURATION (via .env):
 * - MORNING_CHANNEL_ID: Discord channel ID where message will be sent
 * - MORNING_HOUR: (optional) Hour in UTC to send message, default is 4
 * 
 * HOW IT WORKS:
 * 1. On bot startup, if MORNING_CHANNEL_ID is set, startMorningScheduler() is called
 * 2. setInterval checks every 60 seconds if it's the configured time
 * 3. At 4:00 AM UTC, generateMorningMessage() is called to get AI-generated content
 * 4. Message is sent to the channel with @everyone ping
 * 
 * =============================================================================
 */

// System prompt for generating morning motivation
const MORNING_SYSTEM_PROMPT = `You are Wolfy, LUPOS AI assistant. 
It's 4AM UTC - time for the daily motivational message to wake up the team.
Generate a short, punchy, inspiring message to start the day.
Include urgency, discipline, and LUPOS culture (hydration, monk mode, flipping, grinding).
Keep it under 250 characters. Use fire/wolf emojis. Be direct and motivating.
Speak as Wolfy, the alpha wolf.`;

let intervalId = null;

/**
 * =============================================================================
 * FUNCTION: generateMorningMessage()
 * =============================================================================
 * PURPOSE: Generate AI-powered motivational message for the morning
 * 
 * Uses the same AI clients as other Wolfy commands for consistency.
 * 
 * @param {Object} aiClient - Primary AI client (from index.js)
 * @param {Object} aiClient2 - Fallback AI client (from index.js)
 * @param {string} model - Model name to use
 * @returns {Promise<string>} - Generated motivational message
 * =============================================================================
 */
async function generateMorningMessage(aiClient, aiClient2, model) {
    console.log('[MORNING] Generating AI motivational message...');
    
    try {
        const response = await aiClient.path("/chat/completions").post({
            body: {
                messages: [
                    { role: "system", content: MORNING_SYSTEM_PROMPT },
                    { role: "user", content: "Generate today's morning motivation for LUPOS team" }
                ],
                temperature: 1.0,
                top_p: 1.0,
                model: model
            }
        });
        
        const message = response.body.choices[0].message.content;
        console.log('[MORNING] Generated message:', message.slice(0, 100));
        return message;
        
    } catch (error) {
        console.error('[MORNING] Primary AI failed:', error.message);
        
        // Try fallback client
        try {
            console.log('[MORNING] Trying fallback AI client...');
            const response = await aiClient2.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: MORNING_SYSTEM_PROMPT },
                        { role: "user", content: "Generate today's morning motivation for LUPOS team" }
                    ],
                    temperature: 1.0,
                    top_p: 1.0,
                    model: model
                }
            });
            
            const message = response.body.choices[0].message.content;
            console.log('[MORNING] Fallback generated message:', message.slice(0, 100));
            return message;
            
        } catch (fallbackError) {
            console.error('[MORNING] Fallback AI also failed:', fallbackError.message);
            // Return fallback message if AI fails
            return "WAKE UP! 🐺 MONK MODE ACTIVATE! 🔥 Another day to grind. Hydrate and let's go! 💪";
        }
    }
}

/**
 * =============================================================================
 * FUNCTION: sendMorningMessage()
 * =============================================================================
 * PURPOSE: Send the morning message to the configured channel
 * 
 * 1. Fetch the channel using the ID from .env
 * 2. Generate the message using AI
 * 3. Send with @everyone ping
 * 
 * @param {Object} client - Discord client instance
 * @param {Object} aiClient - Primary AI client
 * @param {Object} aiClient2 - Fallback AI client
 * @param {string} model - Model name
 * =============================================================================
 */
async function sendMorningMessage(client, aiClient, aiClient2, model) {
    const channelId = process.env.MORNING_CHANNEL_ID;
    const morningHour = parseInt(process.env.MORNING_HOUR) || 4;
    
    console.log(`[MORNING] Time to send morning message! Hour: ${morningHour} UTC`);
    
    try {
        // Fetch the channel
        const channel = await client.channels.fetch(channelId);
        
        if (!channel) {
            console.error(`[MORNING] Channel not found: ${channelId}`);
            return;
        }
        
        console.log(`[MORNING] Found channel: ${channel.name} (${channelId})`);
        
        // Check if bot has permission to send messages and mention everyone
        if (!channel.permissionsFor(client.user).has('SendMessages')) {
            console.error(`[MORNING] Bot lacks permission to send messages in ${channel.name}`);
            return;
        }
        
        if (!channel.permissionsFor(client.user).has('MentionEveryone') && 
            !channel.permissionsFor(client.user).has('UseExternalEmojis')) {
            console.warn(`[MORNING] Bot may not be able to ping @everyone in ${channel.name}`);
        }
        
        // Generate the message
        const message = await generateMorningMessage(aiClient, aiClient2, model);
        
        // Send the message with @everyone ping
        const fullMessage = `@everyone\n\n${message}`;
        await channel.send(fullMessage);
        
        console.log('[MORNING] ✅ Morning message sent successfully!');
        
    } catch (error) {
        console.error('[MORNING] Failed to send morning message:', error.message);
    }
}

/**
 * =============================================================================
 * FUNCTION: startMorningScheduler()
 * =============================================================================
 * PURPOSE: Initialize the morning message scheduler
 * 
 * Checks every 60 seconds if it's the configured time (default 4AM UTC).
 * This approach is simple and survives bot restarts.
 * 
 * @param {Object} client - Discord client instance
 * @param {Object} aiClient - Primary AI client
 * @param {Object} aiClient2 - Fallback AI client
 * @param {string} model - Model name
 * =============================================================================
 */
function startMorningScheduler(client, aiClient, aiClient2, model) {
    const channelId = process.env.MORNING_CHANNEL_ID;
    const morningHour = parseInt(process.env.MORNING_HOUR) || 4;
    
    // Validate that channel ID exists
    if (!channelId) {
        console.log('[MORNING] MORNING_CHANNEL_ID not set in .env - morning messages disabled');
        return;
    }
    
    console.log(`[MORNING] Starting scheduler - will send daily message at ${morningHour}:00 UTC`);
    console.log(`[MORNING] Target channel ID: ${channelId}`);
    
    // Check every 60 seconds if it's time to send
    intervalId = setInterval(() => {
        const now = new Date();
        const utcHour = now.getUTCHours();
        const utcMinute = now.getUTCMinutes();
        
        // DEBUG: Log current time every minute
        // console.log(`[MORNING] Current UTC time: ${utcHour}:${utcMinute.toString().padStart(2, '0')}`);
        
        // Check if it's the configured time (default 4:00 UTC)
        if (utcHour === morningHour && utcMinute === 0) {
            console.log('[MORNING] 🎯 Trigger time reached! Sending morning message...');
            sendMorningMessage(client, aiClient, aiClient2, model);
        } else {
            console.log("[MORNING] Checked time, its not time yet..." + utcHour + ":" + utcMinute)
        }

    }, 50000); // Check every 50 seconds
    
    console.log('[MORNING] ✅ Morning scheduler initialized');
}

/**
 * =============================================================================
 * FUNCTION: stopMorningScheduler()
 * =============================================================================
 * PURPOSE: Stop the morning scheduler (used for testing or shutdown)
 * =============================================================================
 */
function stopMorningScheduler() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[MORNING] Scheduler stopped');
    }
}

/**
 * =============================================================================
 * FUNCTION: testMorningMessage()
 * =============================================================================
 * PURPOSE: Manually trigger morning message for testing
 * Use: Add a command like "!morning test" to trigger manually
 * =============================================================================
 */
async function testMorningMessage(client, aiClient, aiClient2, model) {
    console.log('[MORNING] Test mode - forcing morning message send');
    await sendMorningMessage(client, aiClient, aiClient2, model);
}

module.exports = {
    startMorningScheduler,
    stopMorningScheduler,
    sendMorningMessage,
    generateMorningMessage,
    testMorningMessage
};