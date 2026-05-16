# Dedicated Chat Commands-Only Feature - Implementation Plan

## Feature Overview

A dedicated channel (already defined as `DEDICATED_CHAT` in `.env`) where regular users cannot send messages - only bot commands are allowed. When a user tries to type in that channel, their message will be automatically deleted and they will receive a temporary warning visible only to them stating that only bot commands are allowed in this chat.

---

## Requirements

1. **Channel**: Use existing `DEDICATED_CHAT` environment variable
2. **Block Regular Messages**: Delete any non-bot message immediately
3. **Private Warning**: Send ephemeral message only to the user who typed
4. **Allow Commands**: Slash commands and bot command triggers should still work
5. **Configuration**: Optionally allow admin to enable/disable per channel

---

## Implementation Approach

### Recommended: Message Handler in index.js

Extend the existing `messageCreate` event handler to check if the message is in the dedicated chat channel. The warning will be a temporary message visible to everyone but auto-deleted after 3 seconds (simulating the "only you can see" ephemeral feel).

```javascript
// In index.js - after existing messageCreate logic
client.on('messageCreate', async message => {
    // Existing logic...
    
    // NEW: Check if message is in dedicated chat
    if (message.channel.id === wolfyChat && !message.author.bot) {
        // Delete the user's message
        await message.delete();
        
        // Send temporary warning that auto-deletes after 3 seconds
        const warningMsg = await message.channel.send({
            content: "⚠️ Only bot commands are allowed in this channel. Use `/wolfy` or slash commands."
        });
        
        // Auto-delete the warning after 3 seconds
        setTimeout(() => {
            warningMsg.delete().catch(() => {});
        }, 3000);
        
        console.log(`[DEDICATED-CHAT] Blocked message from ${message.author.tag}`);
        return;
    }
});
```

**Pros**: Simple, no new dependencies, follows existing pattern  
**Cons**: None significant

---

## Configuration (.env)

The channel is already configured via existing variable:

```env
# Channel ID for Wolfy's dedicated chat (already exists)
DEDICATED_CHAT=123456789012345678
```

---

## Implementation Steps

### Step 1: Modify index.js

Add the message handler logic in the existing `messageCreate` event:

```javascript
// Add near top of file
const dedicatedChatBlockEnabled = process.env.DEDICATED_CHAT_BLOCK_ENABLED !== 'false';

// In client.on('messageCreate', ...)
client.on('messageCreate', async message => {
    // Skip if feature is disabled
    if (!dedicatedChatBlockEnabled) return;
    
    // Skip if not in dedicated chat or message is from bot
    if (message.channel.id !== wolfyChat || message.author.bot) return;
    
    // Delete the user's message
    try {
        await message.delete();
        console.log(`[DEDICATED-CHAT] Deleted message from ${message.author.tag}: "${message.content}"`);
    } catch (error) {
        console.error(`[DEDICATED-CHAT] Failed to delete message:`, error.message);
    }
    
    // Send temporary warning that auto-deletes after 3 seconds
    try {
        const warningMsg = await message.channel.send("⚠️ Only bot commands are allowed in this channel. Use `/wolfy` slash commands.");
        setTimeout(() => warningMsg.delete().catch(() => {}), 3000);
    } catch (error) {
        console.error(`[DEDICATED-CHAT] Failed to send warning:`, error.message);
    }
    
    return; // Stop further processing
});
```

### Step 2: Update Existing messageCreate Logic

The existing `messageCreate` handler at line 105 already has some logic. The new code needs to be inserted at the beginning of that handler, before any other processing.

### Step 3: Verify Slash Commands Still Work

Ensure that:
- `/wolfy` command works
- Other slash commands work
- Bot responses still appear in the channel

---

## Edge Cases & Considerations

1. **Bot Messages**: Always allow bot messages (checked via `message.author.bot`)
2. **Auto-Delete Timing**: Warning message deletes after 3 seconds - adjust if needed
3. **Permissions**: Bot needs "Manage Messages" permission to delete messages
4. **Rate Limiting**: Discord has rate limits - handle appropriately
5. **Multiple Channels**: Could extend to support multiple restricted channels
6. **Admin Override**: Consider allowing specific roles to bypass the block
7. **Message Already Deleted**: Handle case where deletion fails (channel permissions)

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `index.js` | Modify | Add message handler for channel blocking |

---

## Testing Checklist

- [ ] Regular user message is deleted immediately
- [ ] Temporary warning appears and auto-deletes after 3 seconds
- [ ] `/wolfy` slash command works
- [ ] Other slash commands work
- [ ] Bot responses appear in channel
- [ ] Bot's own messages are not blocked
- [ ] Works after bot restart
- [ ] Console logs show blocked messages

---

## Privacy Note

The warning appears as a temporary message in the channel that auto-deletes after 3 seconds, giving it that ephemeral "only you can see" feel without requiring DM permissions.

---

## Priority

**High**: Core functionality - block messages, delete, send warning  
**Medium**: Console logging for debugging  
**Low**: Admin controls, multiple channel support