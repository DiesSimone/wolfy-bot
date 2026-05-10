# Prompt Management System - Technical Guide

## Overview

This document explains how Wolfy's AI prompt system works, specifically the **topic-aware injection** feature that prevents ideology spam.

---

## The Problem

**Before implementation:**
- Every `!wolfy`, `!research`, `!create` command loaded ALL beliefs into the prompt
- This caused Wolfy to lecture about gender, productivity, lifestyle even in unrelated conversations

**Example of bad behavior:**
```
User: "!wolfy what cleaning products should I buy?"
Wolfy: "Reality is binary! Only 2 genders! Also, cold showers are essential! Wake up!"
```

---

## The Solution: Topic-Aware Injection

Instead of loading everything at once, the system:

1. **Always loads** `CORE_IDENTITY` (basic personality, always relevant)
2. **Detects topics** via keyword matching (`detectTopics()`)
3. **Only injects** `BELIEF_MODULES` that match detected topics
4. **Only injects** `LUPOS_CONTEXT` when LUPOS-related keywords found

---

## Flow Diagram

```
User sends: "!wolfy what's your view on gender?"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ index.js command handler                                    │
│   const systemPrompt = buildPrompt(content, 'wolfy')        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ modules/prompts.js - buildPrompt(userMessage, mode)        │
│                                                                
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Step 1: detectTopics(userMessage)                   │  │
│   │   → Scans for keywords matching BELIEF_MODULES      │  │
│   │   → Returns array of matched topics                 │  │
│   └─────────────────────────────────────────────────────┘  │
│                    │                                        │
│                    ▼                                        │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Step 2: isLuposRelated(userMessage)                 │  │
│   │   → Checks if message contains LUPOS keywords      │  │
│   │   → Returns boolean                                 │  │
│   └─────────────────────────────────────────────────────┘  │
│                    │                                        │
│                    ▼                                        │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Step 3: buildWolfyPrompt(matchedTopics, isLupos)    │  │
│   │   → Assembles:                                      │  │
│   │     CORE_IDENTITY                                   │  │
│   │     + (if isLupos) LUPOS_CONTEXT                    │  │
│   │     + (if topics) BELIEF_MODULES[topic]            │  │
│   └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Final Prompt sent to AI                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Triggers By Case

### Case 1: Unrelated Topic

**Input:** `"!wolfy what cleaning products should i buy?"`

```
detectTopics() ───────────────────────────────────────────────┐
├─ Loops through BELIEF_MODULES.keywords                      │
│  - gender: "gender", "pronouns", "lgbt"... → NOT FOUND      │
│  - lifestyle: "porn", "masturbation"... → NOT FOUND        │
│  - productivity: "productivity", "focus"... → NOT FOUND    │
│  - vice: "gaming", "social media"... → NOT FOUND           │
│  - politics: "politics", "trump"... → NOT FOUND            │
├─ Result: [] (empty array)                                    │
└──────────────────────────────────────────────────────────────┘

isLuposRelated() ─────────────────────────────────────────────┐
├─ Checks LUPOS keywords: "lupos", "simo", "abdullah"...      │
│  - "what cleaning products should i buy?" contains none     │
├─ Result: false                                               │
└──────────────────────────────────────────────────────────────┘

buildWolfyPrompt([], false) ───────────────────────────────────┐
├─ prompt = CORE_IDENTITY                                      │
├─ isLupos = false → SKIP LUPOS_CONTEXT                       │
├─ matchedTopics = [] → SKIP BELIEF_MODULES                   │
├─ Result: Just CORE_IDENTITY (no injection)                   │
└──────────────────────────────────────────────────────────────┘
```

**AI receives:** Just basic identity prompt
**Result:** Clean answer about cleaning products

---

### Case 2: Gender Topic

**Input:** `"!wolfy what's your take on gender?"`

```
detectTopics() ───────────────────────────────────────────────┐
├─ "what's your take on gender?"                               │
│  - gender keywords: "gender" FOUND! → push 'gender'          │
├─ Result: ['gender']                                          │
└──────────────────────────────────────────────────────────────┘

buildWolfyPrompt(['gender'], false) ──────────────────────────┐
├─ prompt = CORE_IDENTITY                                      │
├─ isLupos = false → SKIP LUPOS_CONTEXT                        │
├─ matchedTopics = ['gender']                                  │
│  → inject BELIEF_MODULES.gender.content                      │
│  → "You hold strong personal beliefs about gender..."       │
├─ Result: CORE_IDENTITY + gender belief                       │
└──────────────────────────────────────────────────────────────┘
```

**AI receives:** Identity + gender belief
**Result:** Expresses view on gender when asked

---

### Case 3: LUPOS Related

**Input:** `"!wolfy tell me about simo"`

```
detectTopics() ───────────────────────────────────────────────┐
├─ "tell me about simo"                                         │
│  - No belief keywords match                                  │
├─ Result: []                                                   │
└──────────────────────────────────────────────────────────────┘

isLuposRelated() ─────────────────────────────────────────────┐
├─ "simo" is in LUPOS_CONTEXT.keywords                        │
├─ Result: true                                                │
└──────────────────────────────────────────────────────────────┘

buildWolfyPrompt([], true) ────────────────────────────────────┐
├─ prompt = CORE_IDENTITY                                      │
├─ isLupos = true → ADD LUPOS_CONTEXT                          │
│  → "You have deep knowledge of LUPOS history..."             │
├─ Result: CORE_IDENTITY + full LUPOS context                  │
└──────────────────────────────────────────────────────────────┘
```

**AI receives:** Identity + full LUPOS history
**Result:** Detailed answer about Simo/LUPOS

---

### Case 4: Multiple Topics

**Input:** `"!wolfy how to be more productive and focused"`

```
detectTopics() ───────────────────────────────────────────────┐
├─ "how to be more productive and focused"                     │
│  - "productivity" FOUND → push 'productivity'               │
│  - "focus" found → already in 'productivity' (deduped)       │
├─ Result: ['productivity']                                    │
└──────────────────────────────────────────────────────────────┘

buildWolfyPrompt(['productivity'], false) ─────────────────────┐
├─ prompt = CORE_IDENTITY                                      │
├─ matchedTopics.slice(0, 2) = ['productivity']               │
│  → inject BELIEF_MODULES.productivity.content               │
│  → "You strongly believe in productivity: cold showers..."  │
├─ Result: CORE_IDENTITY + productivity beliefs               │
└──────────────────────────────────────────────────────────────┘
```

---

## Keyword Lists

### Belief Module Keywords

| Topic | Keywords |
|-------|----------|
| `gender` | gender, pronouns, lgbt, transgender, trans, woke, non-binary, nonbinary, gender identity, queer |
| `lifestyle` | pornography, porn, masturbation, fap, fapping, sex, dating, tinder, girlfriend, boyfriend |
| `productivity` | productivity, focus, discipline, procrastination, habit, motivation, morning routine, cold shower, wake up, sleep, schedule, time management |
| `vice` | gaming, videogames, video games, social media, instagram, tiktok, youtube, doom scroll, doomscroll, reddit, weed, cannabis, marijuana, drugs, alcohol, beer, drinking |
| `politics` | politics, trump, biden, government, election, democrat, republican, left, right, woke, fascist, communist |

### LUPOS Keywords

```
lupos, lca, lupos chat app, simo, abdullah, vale, andrew, tiziano, 
franzys, jacopo, samuele, invicta, vatas, the real world, trw, 
stare duro, monk mode, flipping, alimedak, george shoes, giorgio scarpe
```

---

## Debug Logs

When running `node index.js`, check console for:

```
[PROMPTS] detectTopics() found: gender
[PROMPTS] isLuposRelated() = false
[PROMPTS] Mode: wolfy, Detected topics: gender, LUPOS: false
[PROMPTS] Building wolfy prompt...
[PROMPTS] Adding 1 belief modules
```

These logs help you understand:
- What topics were detected
- Whether LUPOS was mentioned
- What's being injected into the prompt

---

## Adding New Belief Topics

To add a new topic (e.g., "nutrition"):

1. Add to `BELIEF_MODULES` in `modules/prompts.js`:

```javascript
nutrition: {
    keywords: ['nutrition', 'diet', 'food', 'eating', 'meal', ' calories', 'macros'],
    content: `You believe in intermittent fasting and clean eating...`
}
```

2. The system will automatically detect it and inject only when user mentions those words.

---

## Files

| File | Purpose |
|------|---------|
| `modules/prompts.js` | Prompt management system with topic detection |
| `index.js` | Command handlers that use `buildPrompt()` |
| `docs/PROMPT-SYSTEM-GUIDE.md` | This documentation |