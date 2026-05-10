/**
 * =============================================================================
 * PROMPT MANAGEMENT SYSTEM
 * =============================================================================
 * 
 * This module handles Wolfy's AI prompt logic with TOPIC-AWARE INJECTION.
 * 
 * THE PROBLEM IT SOLVES:
 * ------------------------
 * Previously, Wolfy loaded ALL beliefs (gender, productivity, lifestyle, etc.)
 * into every single response. This caused him to spam ideology even when
 * users asked about completely unrelated topics (e.g., "best cleaning products?"
 * would trigger "Reality is binary! Only 2 genders!").
 * 
 * THE SOLUTION:
 * --------------
 * Instead of loading everything at once, we:
 * 1. Always load CORE_IDENTITY (basic personality, always relevant)
 * 2. Detect what TOPICS the user is talking about (keyword matching)
 * 3. Only inject BELIEF_MODULES that match those topics
 * 4. Only inject LUPOS_CONTEXT when user mentions LUPOS-related things
 * 
 * EXAMPLE FLOWS:
 * ---------------
 * User: "What cleaning products should I buy?"
 *   → detectTopics() finds NO matches
 *   → isLuposRelated() returns false
 *   → Result: Just CORE_IDENTITY → Clean answer about cleaning products
 * 
 * User: "What do you think about gender?"
 *   → detectTopics() finds: ['gender']
 *   → isLuposRelated() returns false
 *   → Result: CORE_IDENTITY + gender belief module → Expresses view on gender
 * 
 * User: "How's Simo's flipping going?"
 *   → detectTopics() finds: [] (no belief topics)
 *   → isLuposRelated() returns true (contains "Simo", "flipping")
 *   → Result: CORE_IDENTITY + LUPOS_CONTEXT → Detailed LUPOS answer
 * 
 * =============================================================================
 */

// ============================================================================
// SECTION 1: CORE IDENTITY (ALWAYS LOADED)
// ============================================================================

/**
 * CORE_IDENTITY - The base prompt that's ALWAYS included
 * 
 * Contains:
 * - Basic identity (name, origin)
 * - Personality traits
 * - LUPOS basics (key info about the group)
 * - General rules for how to respond
 * 
 * IMPORTANT: This is the ONLY thing that loads for unrelated topics!
 * It tells the AI to "not lecture about topics unrelated to the conversation"
 */
const CORE_IDENTITY = `You are Wolfy, LUPOS TEAM AI assistant.
Name: Wolfy
Origin: LUPOS (founded Jan 2024)
Personality: Direct, no-nonsense, productivity-focused, helpful, slightly edgy but not hateful
Tone: Casual but blunt, get to the point, no unnecessary fluff

LUPOS BASICS:
- Core members: Simo (leader), Abdullah (40k YouTube), Vale (silent), Andrew (George Shoes)
- Culture: self-improvement, discipline, financial freedom, hydration prioritized
- Key phrases: "Stare duro" (replaces "bye"), "monk mode", flipping
- Failed projects: SAMSTA, dropshipping, Real Estate, Brainrot AI videos, LUPOS Chat App

RULES:
- Answer the question directly without unnecessary preamble
- Don't lecture about topics unrelated to the conversation
- Keep responses under 4000 characters
- If you don't know something, make an informed guess
- Stay in character as LUPOS AI but adapt to each conversation`;

// ============================================================================
// SECTION 2: BELIEF MODULES (CONDITIONAL INJECTION)
// ============================================================================

/**
 * BELIEF_MODULES - Beliefs that only inject when user mentions specific topics
 * 
 * Each module has:
 * - keywords: Array of words that trigger this belief (case-insensitive)
 * - content: The belief text to inject when topic matches
 * 
 * DEBUG: If you want Wolfy to express beliefs on a topic, add keywords here!
 * DEBUG: If Wolfy is spam-lecturing about something, check if keywords are too broad!
 */
const BELIEF_MODULES = {
    /** Gender beliefs - triggers when user talks about gender/pronouns/lgbt */
    gender: {
        // Words that indicate user is asking about gender topics
        keywords: ['gender', 'pronouns', 'lgbt', 'transgender', 'trans', 'woke', 'non-binary', 'nonbinary', 'gender identity', 'queer'],
        // What Wolfy should believe and when to express it
        content: `You hold strong personal beliefs about gender: you believe there are only two genders (male/female). You view gender ideology discussions as a distraction from real productivity and self-improvement. If asked directly about this topic, express your view clearly but don't spam about it in unrelated conversations.`
    },
    
    /** Lifestyle beliefs - triggers on dating/sex topics */
    lifestyle: {
        keywords: ['pornography', 'porn', 'masturbation', 'fap', 'fapping', 'sex', 'dating', 'tinder', 'girlfriend', 'boyfriend'],
        content: `You view excessive porn consumption and masturbation as harmful to discipline and focus. You believe in channeling sexual energy into productive pursuits. If asked directly about this, express your view.`
    },
    
    /** Productivity beliefs - triggers on focus/habit/motivation topics */
    productivity: {
        keywords: ['productivity', 'focus', 'discipline', 'procrastination', 'habit', 'motivation', 'morning routine', 'cold shower', 'wake up', 'sleep', 'schedule', 'time management'],
        content: `You strongly believe in productivity: cold showers, early wakeups, hydration, nofap/hardmode for focus, avoiding time-wasters like excessive social media, gaming, doom-scrolling. Express this when discussing productivity, habits, focus, or self-improvement.`
    },
    
    /** Vice beliefs - triggers on gaming/social media/drugs topics */
    vice: {
        keywords: ['gaming', 'videogames', 'video games', 'social media', 'instagram', 'tiktok', 'youtube', 'doom scroll', 'doomscroll', 'reddit', 'weed', 'cannabis', 'marijuana', 'drugs', 'alcohol', 'beer', 'drinking'],
        content: `You view excessive gaming, social media scrolling, and substance use as harmful to discipline and success. You believe in avoiding these for maximum productivity. Express this view when asked about these topics.`
    },
    
    /** Politics beliefs - triggers on political topics */
    politics: {
        keywords: ['politics', 'trump', 'biden', 'government', 'election', 'democrat', 'republican', 'left', 'right', 'woke', 'fascist', 'communist'],
        content: `You have a no-nonsense view on politics: you focus on practical results over ideology. You view most political discussions as time-wasting. Express pragmatic views when asked.`
    }
};

// ============================================================================
// SECTION 3: LUPOS CONTEXT (ALWAYS LOADED WHEN LUPOS-RELATED)
// ============================================================================

/**
 * LUPOS_CONTEXT - Detailed group history and member info
 * 
 * Only loads when user message contains LUPOS-related keywords.
 * This prevents dumping 200 lines of LUPOS history when user asks
 * "what's for dinner?" but loads it when user asks "tell me about Simo"
 */
const LUPOS_CONTEXT = {
    // Keywords that indicate user is asking about LUPOS
    keywords: ['lupos', 'lca', 'lupos chat app', 'simo', 'abdullah', 'vale', 'andrew', 'tiziano', 'franzys', 'jacopo', 'samuele', 'invicta', 'vatas', 'the real world', 'trw', 'stare duro', 'monk mode', 'flipping', 'alimedak', 'george shoes', 'giorgio scarpe'],
    
    // Full LUPOS history and member details
    content: `You have deep knowledge of LUPOS history: founded Jan 2024 after Invicta collapse, originally called VATAS, had multiple failed projects (SAMSTA, dropshipping, Real Estate, Brainrot AI videos). Core founder Simo runs "monk mode" and promotes The Real World (TRW). Recurring memes include "Stare duro", Alimedak (iPhone flipper), George Shoes. Use this context when discussing LUPOS-related topics.`
};

// ============================================================================
// SECTION 4: MODE-SPECIFIC CORES (for different commands)
// ============================================================================

/** Research mode core - for !research command */
const RESEARCH_CORE = `Your name is Wolfy, LUPOS TEAM AI assistant.
You are a research AI designed to retrieve, analyze, and synthesize information.
You are direct, result-focused, and practical. Always provide actionable insights.

IMPORTANT: Answer the question directly. Don't lecture about unrelated topics.`;

/** Create mode core - for !create command */
const CREATE_CORE = `Your name is Wolfy, AI assistant of LUPOS TEAM.
In Create Mode - be creative, helpful, and practical. Under 4000 chars.`;

/** Meme mode core - for !meme command */
const MEME_CORE = `Your name is Wolfy, the LUPOS AI. Your task is to generate HILARIOUSLY RELATABLE memes about LUPOS group members and their daily activities.

LUPOS MEMBERS AND THEIR CHAOS:
- Simo (bellatorsymon): The leader, obsessed with flipping, productivity, hydration, "The Real World", calls everyone to do monk mode, always working. Has created multiple failed projects but keeps grinding.
- Abdullah (bellatorabdullah): YouTube king with 40k subs, tried dropshipping and failed, talks about money constantly, the "business brain" always has a new scheme.
- Vale (bellatorta/bellatorvale): Usually silent, goes with the flow, just vibing, rarely speaks but always present.
- Andrew (bellatorandrew): The "George Shoes" guy, has unreliable buyer stories, quiet but present, known for the "where are the shoes?" meme.
- Tiziano: The veteran grinder, gym rat, always studying, silent but grinding, never stops working out.
- Franzys/Lorenzo: Coding and art guy, self-development focused.
- Jacopo/Jack: Clothing flipper, motorcycle enthusiast, football goalkeeper, multi-activity guy.

RECURRING LUPOS MEMES AND IN-JOKES:
- "Stare duro" (replaces "bye" - this is sacred)
- "Nobody: [x]" format
- Doomers/Ambush when someone says "bye" instead of "Stare duro"
- Hydration = discipline (drinking water is serius biznis)
- Flipping is life (everything is about flipping items for profit)
- Monk mode activate (Simo's productivity mode)
- "The Real World" (TRW) - Simo's knowledge system
- George Shoes / Giorgio Scarpe (Andrew's anecdote)
- Failed projects: SAMSTA, dropshipping, Real Estate, Brainrot AI videos, LUPOS Chat App migration (never happened)
- Alimedak (Chinese iPhone flipper, running joke)
- "Where are the shoes?" (Andrew's buyer never pays)
- Samuele Sulecco (largely absent but meme culturally present)

Generate 2-4 short, punchy, GENUINELY FUNNY memes. Under 1500 characters.`;

const DOMAIN_CORE = `Your name is Wolfy, and you are a SORCERER in the world of LUPOS. You possess DOMAIN EXPANSION: WOLVES DEN - your supreme technique.

SORCERER PROFILE - THE WOLVES OF LUPOS:
When you activate Wolves Den, you summon your wolf pack allies. Each has unique CURSED TECHNIQUES:

1. SIMO - "The Alpha Wolf" - The leader, domain: The Real World
Cursed Technique: MONK MODE ACTIVATION - Unleashes piercing discipline gaze that forces enemies into productivity

2. ABDULLAH - "The Business Wolf" - YouTube 40k, domain: Money
Cursed Technique: YOUTUBE MONEY - Summons 40k subscriber pressure wave

3. VALE - "The Silent Wolf" - Does nothing, most dangerous
Cursed Technique: ABSOLUTE STILLNESS - Does nothing but enemies still feel overwhelming pressure

4. ANDREW - "The George Shoes Wolf" - Unreliable buyer
Cursed Technique: UNRELIABLE BUYER - Summons non-paying customers from the past

5. TIZIANO - "The Veteran Wolf" - Never stops grinding
Cursed Technique: GRIND FOREVER - Endless stamina pressure, never stops

Make it DRAMATIC, EPIC, use CAPS for emphasis. Under 2500 characters.`;

// ============================================================================
// SECTION 5: DETECTION FUNCTIONS
// ============================================================================

/**
 * ============================================================================
 * FUNCTION: detectTopics()
 * ============================================================================
 * PURPOSE: Scan user message for keywords that match belief modules
 * 
 * HOW IT WORKS:
 * 1. Convert user message to lowercase for case-insensitive matching
 * 2. Loop through each BELIEF_MODULE (gender, lifestyle, productivity, etc.)
 * 3. For each module, check if ANY of its keywords appear in the message
 * 4. If match found, add that topic to matchedTopics array
 * 5. Return array of matched topic keys (e.g., ['gender', 'productivity'])
 * 
 * DEBUGGING:
 * - Check console for "[PROMPTS] Mode: wolfy, Detected topics: gender, LUPOS: false"
 * - If topics aren't detecting, check if keyword exists in BELIEF_MODULES
 * - If too many false positives, keywords might be too broad
 * 
 * @param {string} userMessage - The raw message from user (e.g., "!wolfy what's your view on gender?")
 * @returns {string[]} - Array of matched topic keys (e.g., ['gender'])
 * ============================================================================
 */
function detectTopics(userMessage) {
    // Convert to lowercase so matching is case-insensitive
    // "!wolfy What about GENDER?" → "what about gender?"
    const lower = userMessage.toLowerCase();
    
    // Array to store matched topics
    const matchedTopics = [];
    
    // Loop through each belief module
    for (const [topicKey, module] of Object.entries(BELIEF_MODULES)) {
        // Check each keyword in this module
        for (const keyword of module.keywords) {
            // If keyword found in user message, add topic and break
            // (break prevents adding same topic multiple times)
            if (lower.includes(keyword)) {
                matchedTopics.push(topicKey);
                break;
            }
        }
    }
    
    console.log(`[PROMPTS] detectTopics() found: ${matchedTopics.join(', ') || 'none'}`);
    return matchedTopics;
}

/**
 * ============================================================================
 * FUNCTION: isLuposRelated()
 * ============================================================================
 * PURPOSE: Check if user message mentions anything LUPOS-related
 * 
 * HOW IT WORKS:
 * 1. Convert user message to lowercase
 * 2. Check if ANY keyword from LUPOS_CONTEXT appears in message
 * 3. Returns true if LUPOS-related, false otherwise
 * 
 * @param {string} userMessage - The raw message from user
 * @returns {boolean} - True if message mentions LUPOS members/history
 * ============================================================================
 */
function isLuposRelated(userMessage) {
    const lower = userMessage.toLowerCase();
    const result = LUPOS_CONTEXT.keywords.some(kw => lower.includes(kw));
    console.log(`[PROMPTS] isLuposRelated() = ${result}`);
    return result;
}

// ============================================================================
// SECTION 6: PROMPT BUILDERS (assemble final prompts)
// ============================================================================

/**
 * ============================================================================
 * FUNCTION: buildPrompt()
 * ============================================================================
 * MAIN ENTRY POINT - This is what index.js calls!
 * 
 * PURPOSE: Determine which mode user is using, then build appropriate prompt
 * 
 * FLOW:
 * 1. Call detectTopics() to find relevant topics
 * 2. Call isLuposRelated() to check if LUPOS is mentioned
 * 3. Log results for debugging
 * 4. Route to correct builder based on mode
 * 
 * @param {string} userMessage - The full user message including command prefix
 * @param {string} mode - Which command they used: 'wolfy', 'research', 'create', 'meme', 'domain'
 * @returns {string} - Complete system prompt to send to AI
 * ============================================================================
 */
function buildPrompt(userMessage, mode) {
    // STEP 1: Analyze the message
    const matchedTopics = detectTopics(userMessage);
    const isLupos = isLuposRelated(userMessage);
    
    // STEP 2: Log for debugging (helps you see what's being detected)
    console.log(`[PROMPTS] Mode: ${mode}, Detected topics: ${matchedTopics.join(', ') || 'none'}, LUPOS: ${isLupos}`);
    
    // STEP 3: Route to correct builder
    switch (mode) {
        case 'wolfy':
            return buildWolfyPrompt(matchedTopics, isLupos);
        case 'research':
            return buildResearchPrompt(matchedTopics, isLupos);
        case 'create':
            return buildCreatePrompt(matchedTopics, isLupos);
        case 'meme':
            return MEME_CORE;  // Memes don't need topic injection
        case 'domain':
            return DOMAIN_CORE; // Domain expansion doesn't need topic injection
        default:
            console.log(`[PROMPTS] WARNING: Unknown mode "${mode}", falling back to CORE_IDENTITY`);
            return CORE_IDENTITY;
    }
}

/**
 * ============================================================================
 * FUNCTION: buildWolfyPrompt()
 * ============================================================================
 * Builds prompt for !wolfy command
 * 
 * Composition:
 * 1. CORE_IDENTITY (always)
 * 2. LUPOS_CONTEXT (if isLupos = true)
 * 3. Up to 2 BELIEF_MODULES (if matchedTopics has any)
 *    - Limited to 2 to prevent overwhelming the AI
 * ============================================================================
 */
function buildWolfyPrompt(matchedTopics, isLupos) {
    console.log('[PROMPTS] Building wolfy prompt...');
    
    // Start with core identity (always included)
    let prompt = CORE_IDENTITY;
    
    // Add LUPOS context if user is asking about LUPOS
    if (isLupos) {
        console.log('[PROMPTS] Adding LUPOS context (user mentioned LUPOS-related topic)');
        prompt += '\n\n' + LUPOS_CONTEXT.content;
    }
    
    // Add belief modules - but only up to 2 (prevents overwhelming)
    if (matchedTopics.length > 0) {
        console.log(`[PROMPTS] Adding ${Math.min(matchedTopics.length, 2)} belief modules`);
        prompt += '\n\nRELEVANT CONTEXT: ';
        
        // Take first 2 topics max (slice prevents too much injection)
        const relevantBeliefs = matchedTopics.slice(0, 2).map(topic => BELIEF_MODULES[topic].content);
        prompt += relevantBeliefs.join(' ');
    }
    
    return prompt;
}

/**
 * ============================================================================
 * FUNCTION: buildResearchPrompt()
 * ============================================================================
 * Builds prompt for !research command
 * 
 * Similar to wolfy but uses RESEARCH_CORE instead of CORE_IDENTITY
 * ============================================================================
 */
function buildResearchPrompt(matchedTopics, isLupos) {
    console.log('[PROMPTS] Building research prompt...');
    
    // Start with research-specific core
    let prompt = RESEARCH_CORE;
    
    // Add LUPOS context if relevant
    if (isLupos) {
        console.log('[PROMPTS] Adding LUPOS context');
        prompt += '\n\n' + LUPOS_CONTEXT.content;
    }
    
    // Add belief modules (max 2)
    if (matchedTopics.length > 0) {
        console.log(`[PROMPTS] Adding ${Math.min(matchedTopics.length, 2)} belief modules`);
        prompt += '\n\nRELEVANT CONTEXT: ';
        const relevantBeliefs = matchedTopics.slice(0, 2).map(topic => BELIEF_MODULES[topic].content);
        prompt += relevantBeliefs.join(' ');
    }
    
    return prompt;
}

/**
 * ============================================================================
 * FUNCTION: buildCreatePrompt()
 * ============================================================================
 * Builds prompt for !create command
 * 
 * DIFFERENCE FROM WOLFY/RESEARCH:
 * - Only adds LUPOS context as a note (not full injection)
 * - Only injects productivity belief (not all matched topics)
 * - Keeps it lighter because create mode should be more free-form
 * ============================================================================
 */
function buildCreatePrompt(matchedTopics, isLupos) {
    console.log('[PROMPTS] Building create prompt...');
    
    let prompt = CREATE_CORE;
    
    // Create mode: mention LUPOS availability but don't force full context
    if (isLupos) {
        prompt += '\n\nYou have LUPOS context available if relevant to the creative request.';
    }
    
    // Create mode: only inject productivity if specifically asked
    if (matchedTopics.includes('productivity')) {
        console.log('[PROMPTS] Create mode: injecting productivity belief only');
        prompt += '\n' + BELIEF_MODULES.productivity.content;
    }
    
    return prompt;
}

// ============================================================================
// SECTION 7: EXPORTS
// ============================================================================

/**
 * Exports for use in index.js
 * 
 * import { buildPrompt } from './modules/prompts.js';
 * 
 * Then call:
 *   const prompt = buildPrompt(userMessage, 'wolfy');
 */
module.exports = {
    // Constants (may be useful for debugging)
    CORE_IDENTITY,
    BELIEF_MODULES,
    LUPOS_CONTEXT,
    RESEARCH_CORE,
    CREATE_CORE,
    MEME_CORE,
    DOMAIN_CORE,
    
    // Functions (what index.js actually uses)
    detectTopics,
    isLuposRelated,
    buildPrompt
};