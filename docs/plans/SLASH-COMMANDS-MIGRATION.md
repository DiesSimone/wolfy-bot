# Slash Commands Migration Plan

## Objective

Transform all current `!` prefix commands (e.g., `!wolfy`, `!research`) into official Discord **slash commands** (e.g., `/summarize`).

---

## Current Commands to Migrate

| Command | Description | Options Needed |
|---------|-------------|----------------|
| `!wolfy [message]` | General AI chat | `message` (string, required) |
| `!research [query]` | Web-powered research | `query` (string, required) |
| `!create [prompt]` | Creative AI generation | `prompt` (string, required) |
| `!meme [topic]` | Generate LUPOS memes | `topic` (string, optional) |
| `!domain [character]` | Domain expansion battle | `character` (string, optional) |
| `!addquote [text]` | Add quote to database | `text` (string, required) |

---

## Implementation Strategy

### Phase 1: Define Slash Commands (modules/slash-commands.js)

Create command definitions for each:

```javascript
const wolfyCommand = new SlashCommandBuilder()
    .setName('wolfy')
    .setDescription('Chat with Wolfy AI')
    .addStringOption(option =>
        option.setName('message')
            .setDescription('What you want to ask Wolfy')
            .setRequired(true)
    );

const researchCommand = new SlashCommandBuilder()
    .setName('research')
    .setDescription('Research any topic with web search')
    .addStringOption(option =>
        option.setName('query')
            .setDescription('What you want to research')
            .setRequired(true)
    );

// ... similar for other commands
```

### Phase 2: Update index.js

- Remove `content.includes("!command")` checks
- Add `client.on('interactionCreate')` handler
- Map each slash command to existing handler logic
- Keep backwards compatibility? (discuss)

### Phase 3: Register All Commands

Update the registration function to include all new commands:

```javascript
const commands = [
    summarizeCommand.toJSON(),
    wolfyCommand.toJSON(),
    researchCommand.toJSON(),
    createCommand.toJSON(),
    memeCommand.toJSON(),
    domainCommand.toJSON(),
    addquoteCommand.toJSON()
];
await guild.commands.set(commands);
```

---

## Key Decisions to Discuss

### 1. Backwards Compatibility (DECIDED)
- **DECISION**: Remove `!` commands COMPLETELY after migration is complete
- Migration process:
  1. First, create all slash commands alongside existing `!` commands
  2. Test that slash commands work properly
  3. Once confirmed working, DELETE all old `!` command handlers from index.js
  4. Final state: ONLY slash commands exist, no `!` prefix commands

### 2. Command Naming
- Keep same names (`/wolfy`, `/research`) or rename?
- Current: `/summarize` (new), `!wolfy` (old)
- New: All as slash commands

### 3. Options Structure
- Keep same parameters or improve?
- Example: `!research [query]` → `/research query:text`

### 4. Error Handling
- Slash commands have built-in validation
- Need custom error messages for failures

---

## Migration Steps

### Step 1: Update slash-commands.js
- Add all 6 new command definitions
- Keep existing `/summarize` command

### Step 2: Update index.js
- Add `interactionCreate` event handler for ALL new slash commands
- Route each slash command to appropriate existing handler function

### Step 3: TEST PHASE (IMPORTANT!)
- Run bot and test ALL slash commands thoroughly
- Verify `/wolfy`, `/research`, `/create`, `/meme`, `/domain`, `/addquote` all work
- Compare output with old `!` commands to ensure consistency
- ONLY proceed to Step 4 once ALL commands work correctly

### Step 4: DELETE OLD COMMANDS
- Once Step 3 confirms everything works, REMOVE all old `!` command handlers:
  - Delete: `if (content.includes("!wolfy"))` block
  - Delete: `if (content.includes("!research"))` block
  - Delete: `if (content.includes("!create"))` block
  - Delete: `if (content.includes("!meme") || content.includes("!domain"))` block
  - Delete: `if (content.includes("!addquote"))` block
- After this, ONLY slash commands will work

### Step 5: Deploy
- Restart bot to re-register commands
- Old `!` commands no longer exist - users must use slash commands

---

## Files to Modify

| File | Changes |
|------|---------|
| `modules/slash-commands.js` | Add 6 new command definitions |
| `index.js` | Add interaction handler, then DELETE old `!` handlers |

---

## Example: New Slash Command Flow

```
User types: /research query:how to flip items

Discord sends interaction to bot
        ↓
index.js handles interactionCreate
        ↓
Routes to handleResearchCommand(interaction)
        ↓
Extracts: interaction.options.getString('query')
        ↓
Calls existing research logic
        ↓
Returns result to user
```

---

## Questions for Discussion

1. **Backwards compatibility** - Keep or remove `!` commands?
2. **Naming** - Same names or change to something else?
3. **Testing** - How do we verify everything works?
4. **Timeline** - When to switch over?

---

## Priority

**High**: Core functionality - wolfy, research, create (most used)  
**Medium**: meme, domain (less frequent)  
**Low**: addquote (rarely used)