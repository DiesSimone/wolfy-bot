# Daily Motivational Message Feature - Implementation Plan

## Feature Overview

At **4:00 AM UTC** every day, Wolfy will send a motivational message to a designated channel, pinging all members to start the day.

---

## Requirements

1. **Time**: 4:00 AM UTC daily (configurable via .env)
2. **Action**: Send message to specific channel
3. **Content**: Motivational message (AI-generated or rotating list)
4. **Ping**: @everyone or role-based ping to notify members
5. **Configuration**: Channel ID stored in .env (e.g., `MORNING_CHANNEL_ID`)

---

## Implementation Approach

### Option A: Simple Interval-Based (Recommended)

Use `setInterval` to check every minute if it's 4:00 AM UTC.

```javascript
// In index.js - after client login
const morningChannelId = process.env.MORNING_CHANNEL_ID;
const morningHour = 4; // UTC hour
const morningMinute = 0;

// Check every minute
setInterval(async () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    
    if (utcHour === morningHour && utcMinute === 0) {
        await sendMorningMessage();
    }
}, 60000); // Check every 60 seconds
```

**Pros**: Simple, no external dependencies, survives restarts  
**Cons**: Slight drift possible (but negligible for daily message)

### Option B: Node-Cron (More Precise)

Use `node-cron` package for exact scheduling.

```javascript
const cron = require('node-cron');
cron.schedule('0 4 * * *', async () => {
    await sendMorningMessage();
});
```

**Pros**: Precise timing, more reliable  
**Cons**: Requires new dependency, slightly more complex

---

## Configuration (.env)

```env
# Channel where morning messages will be sent
MORNING_CHANNEL_ID=123456789012345678

# Optional: Time override (default: 4)
MORNING_HOUR=4
```

---

## Message Content Strategy

### AI-Generated Only (IMPLEMENTED)

Since this only runs once per day at 4AM UTC, we use AI-generated messages for fresh, dynamic content every day.

```javascript
const morningMemory = `You are Wolfy, LUPOS AI. It's 4AM UTC - time for the daily motivational message. 
Generate a short, punchy, inspiring message to start the day. 
Include urgency, discipline, and LUPOS culture (hydration, monk mode, flipping, grinding).
Keep it under 250 characters. Use fire/wolf emojis. Be direct and motivating.`;

async function generateMorningMessage() {
    const response = await aiClient.path("/chat/completions").post({
        body: {
            messages: [
                { role: "system", content: morningMemory },
                { role: "user", content: "Generate today's morning motivation" }
            ],
            temperature: 1.0,
            top_p: 1.0,
            model: model
        }
    });
    return response.body.choices[0].message.content;
}
```

**Pros**: Fresh unique message every day, fits LUPOS tone perfectly  
**Cons**: Minimal (1 API call per day = negligible cost)

---

## Implementation Steps

### Step 1: Add Environment Variables

Update `.env`:
```
MORNING_CHANNEL_ID=123456789012345678
```

### Step 2: Create Morning Message Module

Create `modules/morning.js`:
- Morning message generator (AI or rotating)
- Message sending function
- Channel validation

### Step 3: Initialize Scheduler in index.js

```javascript
// After client.login()
// Check if morning channel is configured
if (process.env.MORNING_CHANNEL_ID) {
    startMorningScheduler(client);
}
```

### Step 4: Add Slash Command (Optional Enhancement)

Allow admins to:
- Set morning channel
- Enable/disable feature
- Set custom time
- Preview message before sending

---

## Data Schema (Optional)

If enabling admin customization, store in MongoDB:

```javascript
// models/settings.js
const MorningSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    hour: { type: Number, default: 4 },
    enabled: { type: Boolean, default: true },
    customMessages: [{ type: String }], // Custom quote list
    useAI: { type: Boolean, default: false }
});
```

---

## Edge Cases & Considerations

1. **Bot restart during night**: Interval-based approach will resume on restart
2. **Invalid channel ID**: Validate on startup, log error if invalid
3. **Rate limiting**: Discord has message rate limits - ensure not spamming
4. **Server timezone**: Always use UTC, not local server time
5. **Empty channel**: Handle case where channel doesn't exist or bot lacks permissions
6. **Test mode**: Add test button to manually trigger message for debugging

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `.env` | Modify | Add `MORNING_CHANNEL_ID` |
| `modules/morning.js` | Create | Morning message logic |
| `index.js` | Modify | Initialize scheduler |

---

## Quick Test Checklist

- [ ] Add `MORNING_CHANNEL_ID` to .env
- [ ] Bot has permission to send messages in that channel
- [ ] Channel exists and is accessible
- [ ] Message sends correctly at 4AM UTC
- [ ] @everyone ping works
- [ ] No duplicate messages on restart
- [ ] Console logs for debugging

---

## Priority

**High**: AI-generated messages + interval scheduler (IMPLEMENTED)  
**Medium**: Error handling and edge cases  
**Low**: Admin slash commands for customization