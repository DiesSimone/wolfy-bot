# /create Command Enhancement - Implementation Plan

## Executive Summary

**Objective:** Add new optional parameters to the existing `/create` slash command.

**Current State:** The `/create` command only accepts a required `prompt` parameter.

**New Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | String | Yes | The user's creative request (existing) |
| `template` | String | No | Template format for output |
| `length` | Integer | No | Desired output length in number of characters/words |

**Result:** Users can now customize their creative generation with templates and length constraints.

---

## Current Implementation

### Slash Command Definition (`modules/slash-commands.js:52-59`)
```javascript
const createCommand = new SlashCommandBuilder()
    .setName('create')
    .setDescription('Generate creative content with AI')
    .addStringOption(option =>
        option.setName('prompt')
            .setDescription('What you want to create')
            .setRequired(true)
    );
```

### Command Handler (`index.js:532-606`)
- Currently extracts only `prompt` from interaction options
- Builds system prompt via `buildPrompt()`
- Calls AI with temperature 1.0, top_p 1.0
- Returns chunked response to wolfyChat channel

---

## Proposed Changes

### Phase 1: Command Definition Update

**File:** `modules/slash-commands.js`

Add two new options to the `createCommand`:

```javascript
const createCommand = new SlashCommandBuilder()
    .setName('create')
    .setDescription('Generate creative content with AI')
    .addStringOption(option =>
        option.setName('prompt')
            .setDescription('What you want to create')
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName('template')
            .setDescription('Template format (e.g., "Title: {content}")')
            .setRequired(false)
    )
    .addIntegerOption(option =>
        option.setName('length')
            .setDescription('Desired output length (number)')
            .setMinValue(1)
            .setMaxValue(10000)
            .setRequired(false)
    );
```

**Key Points:**
- `template` is a string (allows flexible format patterns)
- `length` is an integer with range validation (1-10000)
- Both are optional (`.setRequired(false)`)

---

### Phase 2: Handler Logic Update

**File:** `index.js` - Update `handleCreateCommand()` function

#### 2.1 Extract New Parameters

```javascript
async function handleCreateCommand(interaction) {
    const prompt = interaction.options.getString('prompt');
    const template = interaction.options.getString('template');  // NEW
    const length = interaction.options.getInteger('length');     // NEW
    
    console.log(`[/create] Prompt: ${prompt}`);
    if (template) console.log(`[/create] Template: ${template}`);
    if (length) console.log(`[/create] Length: ${length}`);
    // ... rest of handler
}
```

#### 2.2 Build Enhanced System Prompt

Option A: Inject instructions into the user message sent to AI
```javascript
let userMessage = `!create ${prompt}`;

if (template) {
    userMessage += `\n\nUse the following template format: "${template}"`;
}

if (length) {
    userMessage += `\n\nOutput length should be approximately ${length} characters.`;
}

const systemPrompt = buildPrompt(userMessage, 'create');
```

Option B: Modify the prompt builder in `modules/prompts.js` to handle these parameters.

**Recommendation:** Option A for simplicity - less invasive change.

---

### Phase 3: AI Response Processing

#### 3.1 Template Application

If user provides a template, simply prepend it to the AI response:

```javascript
let text = response.body.choices[0].message.content;

if (template) {
    text = `${template}\n\n${text}`;
}
```

#### 3.2 Length Validation/Adjustment

The length parameter is a **soft suggestion** to the AI, not a hard limit. The AI will attempt to respect it but may vary based on context.

```javascript
if (length) {
    // Add instruction to AI to respect length
    // Handled in prompt construction above
}
```

---

### Phase 4: Error Handling & Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty template string | Ignore, use default behavior |
| Length = 0 or negative | Ignore (Discord validates min 1) |
| Length > 10000 | Cap at 10000 (Discord validates max) |
| Template without placeholder | Prepend template to output |
| Both template and length provided | Apply both |

---

### Phase 5: Testing Plan

#### Manual Test Cases

1. **Basic usage (existing)**
   ```
   /create write a story about a dragon
   ```
   Expected: AI generates story normally

2. **With template only**
   ```
   /create write a story about a dragon
   template: "📖 Story Time:"
   ```
   Expected: Output prefixed with "📖 Story Time:"

3. **With length only**
   ```
   /create write a story about a dragon
   length: 500
   ```
   Expected: AI generates approximately 500 characters

4. **With both parameters**
   ```
   /create write a story about a dragon
   template: "🐉 {content}"
   length: 1000
   ```
   Expected: Template applied + ~1000 char output

5. **Template with placeholder**
   ```
   /create write a poem
   template: "Title: My Poem\n{content}"
   ```
   Expected: Placeholder replaced with actual poem

---

## File Changes Summary

| File | Changes |
|------|---------|
| `modules/slash-commands.js` | Add `template` (string) and `length` (integer) options |
| `index.js` | Update `handleCreateCommand()` to extract and use new parameters |
| `docs/plans/CREATE-COMMAND-ENHANCEMENT.md` | This plan document |

---

## Implementation Checklist

- [ ] **Phase 1:** Update slash command definition in `modules/slash-commands.js`
- [ ] **Phase 2:** Update handler to extract new parameters
- [ ] **Phase 3:** Add template processing logic
- [ ] **Phase 4:** Add length instruction to AI prompt
- [ ] **Phase 5:** Test all combinations
- [ ] **Register commands:** Bot needs to re-register slash commands (handled on restart)

---

## Alternative Design Considerations

### Template Syntax Options

1. **Placeholder-based** (Recommended)
   - User provides: `"Title: {content}"`
   - System replaces `{content}` with AI output
   
2. **Prefix-only**
   - User provides: `"Here's your output:"`
   - System prepends to AI output

3. **Full custom format**
   - User provides structure with placeholders
   - More complex but flexible

**Recommendation:** Option 1 - most intuitive and flexible.

### Length Parameter Semantics

| Interpretation | Pros | Cons |
|----------------|------|------|
| Characters | Precise control | May break mid-word |
| Words | More natural | Less precise |
| Sentences | Good balance | Hard to estimate |

**Recommendation:** Pass as "approximately X characters" to AI - let AI handle the semantics.

---

## Backward Compatibility

The changes are **fully backward compatible**:
- Existing `/create` calls with just `prompt` work exactly as before
- No breaking changes to the API
- Users can gradually adopt new parameters

---

## Summary

| Aspect | Decision |
|--------|----------|
| **Template** | String option, optional, supports placeholders |
| **Length** | Integer option (1-10000), optional, soft suggestion |
| **Implementation** | Update slash command + handler only |
| **Risk** | Low - purely additive changes |
| **Testing** | Manual testing of 5 key scenarios |