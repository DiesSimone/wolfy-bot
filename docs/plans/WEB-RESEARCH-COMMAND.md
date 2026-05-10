# Web Research Command - Refined Implementation Plan

## Executive Summary

**Objective:** Upgrade the **EXISTING** `!research` command (already in your bot) to perform real-time web searches using Exa AI.

**Key Point:** This is NOT a new command. The current `!research` command will be enhanced to:
- Detect when web search is needed (smart detection)
- Use Exa AI for real-time information
- Fall back to static AI when appropriate

**Result:** Existing `!research` users get supercharged with web search automatically!

**Technology Stack:**
- **Primary:** Exa AI (search + content extraction)
- **Fallback:** Jina Reader (free, for failed Exa requests)
- **Analysis:** GitHub Models (GPT-4.1-nano - already integrated)

**Free Tier:** 1,000 searches/month (sufficient for ~33 searches/day)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER REQUEST FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  User input: "!research [query]"
              ↓
  ┌──────────────────────┐
  │ 1. Parse Query        │  ← Extract search terms, detect flags
  └──────────────────────┘
              ↓
  ┌──────────────────────┐
  │ 2. Exa Search        │  ← API call: exa.search(query, {numResults: 5})
  │   (5-10 results)    │     Returns: [{url, title, snippet, score}, ...]
  └──────────────────────┘
              ↓
  ┌──────────────────────┐
  │ 3. Fetch Content     │  ← API call: exa.getContents(urls, {text: true})
  │   (top 3-5 URLs)    │     Returns: [{url, text: "...", ...}]
  └──────────────────────┘
              ↓
  ┌──────────────────────┐
  │ 4. AI Synthesis      │  ← Build prompt with gathered content
  │   (GPT-4.1-nano)    │     Analyze and generate answer
  └──────────────────────┘
              ↓
  ┌──────────────────────┐
  │ 5. Format Output     │  ← Discord embed with sources
  └──────────────────────┘
              ↓
  Response to user
```

---

## Environment Variables

```env
# Required
EXA_API_KEY=your_exa_api_key_here

# Optional (defaults shown)
EXA_SEARCH_LIMIT=5          # Number of search results
EXA_CONTENT_LIMIT=3         # Number of URLs to fetch content from
EXA_MIN_SCORE=0.5           # Minimum relevance score (0-1)
```

**How to get Exa API key:**
1. Go to https://exa.ai/
2. Sign up for free account
3. Copy API key from dashboard

---

## Exa API Setup Guide

> **Canonical reference:** https://docs.exa.ai/reference/search-api-guide-for-coding-agents
> If anything below looks outdated or contradicts real API behavior, fetch that URL — it is the source of truth.

### Installation

```bash
npm install exa-js
```

### Basic Usage

```javascript
import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);

const results = await exa.search("your search query here", {
  type: "auto",
  numResults: 10,
  contents: {
    highlights: true
  }
});

results.results.forEach(result => {
  console.log(result.title, result.url);
});
```

### Search Types

| Type | Best For | Approx Latency | Depth |
|------|----------|----------------|-------|
| `auto` | Most queries — balanced relevance and speed | ~1 second | Smart |
| `fast` | Latency-sensitive queries | ~450 ms | Basic |
| `instant` | Chat, voice, quick lookups | ~250 ms | Basic |
| `deep-lite` | Cheaper synthesis | 4 seconds | Deep |
| `deep` | Research, thorough results | 4-15 seconds | Deep |
| `deep-reasoning` | Complex multi-step reasoning | 12-40 seconds | Deepest |

**Recommendation:** Use `type: "auto"` for most queries.

### Content Configuration

Three modes available (can be combined):

| Mode | Config | Best For |
|------|--------|----------|
| Highlights | `"highlights": true` | Query-relevant excerpts (recommended) |
| Text | `"text": {"maxCharacters": 20000}` | Full content extraction |
| Summary | `"summary": true` or `{"query": "your question"}` | LLM-written summary |

```javascript
// Recommended: Get highlights (token-efficient)
const results = await exa.search(query, {
  numResults: 5,
  contents: { highlights: true }
});

// Get full text content
const contents = await exa.getContents(urls, {
  text: { maxCharacters: 10000 }
});
```

### Content Freshness (maxAgeHours)

Control how fresh the content should be:

| Value | Behavior |
|-------|----------|
| 24 | Use cache if <24h old, else livecrawl |
| 1 | Use cache if <1h old, else livecrawl |
| 0 | Always livecrawl (ignore cache) |
| -1 | Never livecrawl (cache only) |
| (omit) | Default: cache with livecrawl as fallback |

**Recommendation:** Omit for balanced speed/freshness, or use `maxAgeHours: 24` for daily-fresh content.

### Structured Outputs (outputSchema)

Use `outputSchema` for structured, grounded JSON responses:

```javascript
const results = await exa.search("best programming languages 2025", {
  type: "auto",
  outputSchema: {
    type: "object",
    description: "Programming language recommendations",
    required: ["languages"],
    properties: {
      languages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Language name" },
            useCase: { type: "string", description: "Best use case" }
          }
        }
      }
    }
  },
  contents: { highlights: true }
});

console.log(results.output.content);   // {"languages": [...]}
console.log(results.output.grounding); // Citations with source URLs
```

### Error Handling

**Common mistakes to avoid:**
- ❌ `useAutoprompt` — deprecated, remove it
- ❌ `includeUrls` / `excludeUrls` — use `includeDomains` / `excludeDomains`
- ❌ `text`, `highlights` at top level — must be inside `contents` object
- ❌ `livecrawl: "always"` — use `contents.maxAgeHours: 0` instead

**If results not relevant:**
1. Try `type: "auto"` 
2. Try `type: "deep"` for better synthesis
3. Refine query (use singular form, be specific)

---

## Module Design: modules/webresearch.js

### Class: WebResearcher

```javascript
class WebResearcher {
    constructor(exaClient)
    
    // Public methods:
    async search(query)              // Main entry point
    async searchWeb(query, num)      // Exa API search
    async fetchContent(urls)         // Get full page content
    async synthesize(query, content) // AI analysis
    formatDiscordEmbed(results)       // Format for display
}
```

### Method: search(query)

**Input:** User's research query string

**Process:**
1. Log search start
2. Call `searchWeb()` with query
3. Extract top URLs (filter by score)
4. Call `fetchContent()` with top URLs
5. Call `synthesize()` with query + content
6. Return formatted results

**Output:** Object with `{ answer, sources, searchResults }`

---

## API Reference

### Exa Search
```javascript
const results = await exa.search("how to start dropshipping", {
    numResults: 5,
    category: "web",        // or "article", "blog", etc.
    lang: "en",
});
// Returns: [{ url, title, snippet, score, highlight }, ...]
```

### Exa Get Contents
```javascript
const contents = await exa.getContents([
    "https://example.com/article1",
    "https://example.com/article2"
], {
    text: true,              // Return plain text
    size: 10000,            // Max chars per page
    summary: true           // Include AI summary
});
// Returns: [{ url, text, summary, ... }, ...]
```

---

## Implementation Details

### Rate Limiting Strategy

```javascript
// Prevent hitting Exa rate limits
const MIN_DELAY_MS = 500;   // Delay between API calls
const MAX_RETRIES = 2;       // Retry failed requests
const RETRY_DELAY_MS = 2000; // Delay before retry
```

### Content Truncation

```javascript
// Limit content size to fit in AI context
const MAX_CONTENT_CHARS = 15000;  // Per page
const MAX_TOTAL_CHARS = 40000;    // Total for AI prompt
```

### Fallback Chain

```
1. Try: Exa Search + Exa GetContents
   ↓ (if fails)
2. Try: Exa Search only (return URL list)
   ↓ (if fails)
3. Try: Jina Reader for content
   ↓ (if fails)
4. Return: "Search failed, try again later"
```

---

## Edge Cases & Handling

| Edge Case | Handling |
|-----------|----------|
| No search results found | Return "No results found for [query]. Try different keywords." |
| All URLs fail to load | Return partial results with working sources only |
| Content too large | Truncate to MAX_CONTENT_CHARS per page |
| Invalid URL in results | Filter out 404s before fetching content |
| API rate limited | Queue request, retry after delay |
| Empty content from page | Skip that URL, use next best |
| Non-English results | Filter by `lang: "en"` in search params |

---

## Updated !research Command Syntax

### Option A: Smart Detection (Recommended)

Automatically use web search for factual queries:

```
!research [any question]  → Uses web search automatically
```

Detect via keywords: "latest", "best", "how to", "what is", "compare", "top", etc.

### Option B: Explicit Prefix

Use prefix to trigger web search:

```
!research:web how to start a business    ← Uses web search
!research how to code (no web)           ← Uses static AI knowledge
```

### Option C: Keep Existing + Add New

Keep current `!research` behavior, add new command:

```
!research [query]  → Current: static AI (unchanged)
!websearch [query] → New: web-powered research
```

---

## Recommended: Option A (Smart Detection)

Based on the current `!research` flow, the best approach is **smart detection**:

1. User types `!research [query]`
2. System detects if query needs real-time info
3. If yes → uses Exa web search
4. If no → uses static AI (current behavior)

**Detection triggers:**
- Temporal: "latest", "2024", "2025", "recent", "new"
- Factual: "what is", "who is", "how does", "best", "top"
- Comparison: "vs", "versus", "compare", "difference"
- Action: "how to", "ways to", "steps to"

---

## Output Format

### Discord Embed

```javascript
const embed = new EmbedBuilder()
    .setTitle(`🔍 Research: ${query}`)
    .setColor(0x5865F2)
    .setDescription(aiAnalysis)
    .addFields(
        { name: '📊 Sources', value: sourceList, inline: false }
    )
    .setFooter({ text: 'Powered by Exa AI • Real-time search' })
    .setTimestamp();
```

### Example Output

```
🔍 Research: best programming languages to learn 2025

Based on current industry trends and expert predictions for 2025:

**Top Languages:**

1. **Python** - Best for AI/ML, data science, automation
   - Used by: Google, NASA, Netflix, Instagram
   - Avg Salary: $120,000+

2. **Rust** - Fastest growing, memory-safe systems
   - Used by: Microsoft, Amazon, Cloudflare
   - 200%+ year-over-year growth

3. **Go** - Cloud-native, microservices
   - Used by: Google, Uber, Twitch, Docker

**Recommendation:** Start with Python for versatility, 
then specialize based on your goals.

📚 **Sources:**
• stackoverflow.blog/2025-tech-trends
• github.com/trending
• techreport.com/programming-2025
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `.env` | Modify | Add `EXA_API_KEY` |
| `modules/webresearch.js` | Create | Exa integration + synthesis |
| `package.json` | Modify | Add `exa-js` dependency |
| `index.js` | Modify | Update `!research` handler |
| `docs/WEB-RESEARCH-COMMAND.md` | Update | This plan |

---

## Implementation Checklist

- [ ] Get Exa API key from https://exa.ai/
- [ ] Add `EXA_API_KEY` to `.env`
- [ ] Run `npm install exa-js`
- [ ] Create `modules/webresearch.js`
- [ ] Implement `search()` method
- [ ] Implement `fetchContent()` method  
- [ ] Implement `synthesize()` method
- [ ] Add smart detection to `!research` handler
- [ ] Add Discord embed formatting
- [ ] Add error handling + fallbacks
- [ ] Test with sample queries

---

## Cost & Limits

| Metric | Free Tier | Notes |
|--------|------------|-------|
| Searches/month | 1,000 | ~33/day |
| Content fetches | Included | Within search quota |
| Rate limit | 100/minute | Should be sufficient |

**Estimated usage:** ~5-10 `!research` calls/day = ~150-300 searches/month = **Well within free tier**

---

## Fallback: Jina Reader (Backup)

If Exa fails, use Jina Reader as backup:

```javascript
async function jinaFetch(url) {
    const response = await fetch(`https://r.jina.ai/${url}`);
    return response.text();
}
```

This is free and requires no API key. Use only as fallback.

---

## Summary

| Aspect | Decision |
|--------|----------|
| **Tech** | Exa AI (primary), Jina (fallback) |
| **Integration** | New module `webresearch.js` |
| **Detection** | Smart keyword detection |
| **Output** | Discord embed with sources |
| **Cost** | Free tier sufficient (1k/month) |
| **Priority** | High - Core feature |

Ready for implementation when you add `EXA_API_KEY` to `.env`!