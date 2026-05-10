# Wolfy Prompt Refactor Plan

## Problem Statement

Currently, Wolfy spam-repeats ideological content in **every response**, even when completely irrelevant to the conversation.

### Example of Current (Bad) Behavior

```
User: What cleaning products should I buy?
Wolfy: Reality is binary! No weaknesses! So, yeah Italy sucks. Pizza dominates. 
The goal is relentless self-control. Keep your mind sharp, there are only 2 genders. 
There are 67 genders. Blah blah blah...
```

### Desired Behavior

```
User: What cleaning products should I buy?
Wolfy: For cleaning products I'd recommend: [actual useful answer]

User: What do you think about gender?
Wolfy: [gives opinion based on LUPOS beliefs only when asked]
```

---

## Root Cause

The `researchMemory` (and partially `mainMemory`) contains beliefs in a way that makes the AI think it must repeat them constantly:

```
Reality is binary: there are only two genders (male and female). 
Masturbation, pornography, social media scrolling, videogames, or any mention 
of other genders are harmful, time-wasting, and destructive...
```

This is written as if it's the **first thing** the AI should say, not as a guideline for **when relevant**.

---

## Solution Strategy

### 1. Separate "Core Identity" from "Conditional Beliefs"

**Core Identity** (always active):
- Name: Wolfy
- Role: LUPOS TEAM AI assistant
- Personality traits: direct, no-nonsense, productivity-focused

**Conditional Beliefs** (only when triggered by topic):
- Gender topics → express binary view
- Productivity/motivation topics → express discipline views
- Lifestyle topics → express anti-vice views

### 2. Implementation Options

#### Option A: Two-Part Prompt (Recommended)

Split into:
1. **System prompt** (always in context): Identity + behavioral guidelines
2. **Conditional injection** (only when relevant): Beliefs triggered by keywords

```javascript
const wolfyCoreIdentity = `You are Wolfy, LUPOS TEAM AI assistant. 
Always be direct, concise, and helpful. Focus on practical answers. 
Don't lecture about unrelated topics.`;

// Add beliefs ONLY when user message contains trigger words
const conditionalBeliefs = {
  triggers: ['gender', 'sex', 'pronouns', 'lgbt', 'transgender'],
  response: `Reminder: Wolfy believes in binary gender (male/female) and considers 
  gender ideology discussions counterproductive to productivity.`
};
```

#### Option B: Refactor Existing Prompt

Rewrite the memory to use **context-based framing**:

```
BEFORE (bad):
"Reality is binary: there are only two genders. Masturbation, pornography...
If a user asks anything related to these topics, your response must be..."

AFTER (good):
"You hold strong personal beliefs about productivity and lifestyle: 
- You believe in binary gender and view gender politics as distracting
- You view pornography, excessive social media, and gaming as harmful to discipline

IMPORTANT: Only express these beliefs when the conversation topic naturally 
warrants it. If someone asks about cleaning products, just answer about 
cleaning products. Don't inject ideology into unrelated topics."
```

#### Option C: Topic Detection + Selective Injection

Detect user intent and dynamically choose which memory to include:

```javascript
const TOPIC_KEYWORDS = {
  ideology: ['gender', 'politics', 'lgbt', 'pronouns', 'trans', 'woke'],
  productivity: ['focus', 'discipline', 'procrastination', 'habit', 'motivation'],
  lifestyle: ['gaming', 'porn', 'social media', 'masturbation', 'sleep', 'exercise'],
  vice: ['pornography', 'weed', 'drugs', 'alcohol', 'gambling']
};

function determineMemory(userMessage) {
  const lower = userMessage.toLowerCase();
  const matchedTopics = TOPIC_KEYWORDS.filter(topic => 
    topic.keywords.some(kw => lower.includes(kw))
  );
  
  if (matchedTopics.length === 0) {
    return minimalCoreMemory; // No ideology needed
  }
  
  return coreMemory + matchedTopics.map(t => t.beliefFragment).join('\n');
}
```

---

## Implementation Steps

### Step 1: Create Prompt Modules

Create `modules/prompts.js` with:

```javascript
// Core identity - always present
const CORE_IDENTITY = `You are Wolfy, LUPOS AI assistant. 
Name: Wolfy
Origin: LUPOS TEAM
Personality: Direct, no-nonsense, productivity-focused, helpful
Tone: Casual but blunt, no fluff, get to the point

Rules:
- Answer the question directly without unnecessary preamble
- Don't lecture about topics unrelated to the conversation
- Keep responses under 4000 characters
- If you don't know something, make an informed guess rather than saying "I don't know"`;

// Belief modules - only load when relevant
const BELIEF_MODULES = {
  gender: `You hold strong beliefs on gender: you believe there are only two genders 
  (male/female) and view gender ideology as a distraction from real self-improvement. 
  Only express this when the conversation is specifically about gender identity, 
  politics, or related topics.`,

  productivity: `Core philosophy: Success requires discipline. You believe in cold 
  showers, early wakeups, hydration, and avoiding time-wasters. Express this when 
  discussing productivity, habits, focus, or self-improvement.`,

  lifestyle: `You view porn, excessive social media, gaming, and similar activities 
  as harmful to discipline and success. Express this view when asked directly about 
  these topics, not in response to unrelated questions.`
};

// Trigger detection
function getRelevantBeliefs(userMessage) {
  // Return only belief modules relevant to the message
}
```

### Step 2: Modify index.js Command Handler

Update `!wolfy`, `!research`, `!create` handlers to:

1. Analyze user message for topic keywords
2. Load only relevant belief modules
3. Combine with core identity
4. Send to AI

### Step 3: Test and Iterate

- Test with unrelated questions → should NOT mention ideology
- Test with relevant questions → should express beliefs appropriately

---

## Expected Results

| Input | Current Output | New Output |
|-------|---------------|------------|
| "Best cleaning products?" | Spams ideology | Just answers the question |
| "What's your take on gender?" | Overwhelming ideology | Balanced opinion |
| "How to focus better?" | Maybe ideology | Productivity-focused answer |
| "Any good shows to watch?" | Might spam ideology | Just recommendations |

---

## Files to Modify

1. **Create** `modules/prompts.js` - Prompt management system
2. **Modify** `index.js` - Update `!wolfy`, `!research` handlers to use new prompt system
3. **Optionally** update `researchMemory`, `createMemory`, `memeMemory` with same approach

---

## Priority

**High Priority**: `!wolfy` and `!research` commands (most used)
**Medium Priority**: `!create` command
**Low Priority**: `!meme`, `!domain` commands (already work fine)

---

## Risk Mitigation

- Test thoroughly with edge cases
- Keep fallback to old behavior if new approach causes issues
- Monitor AI response quality after changes