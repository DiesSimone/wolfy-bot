/**
 * =============================================================================
 * WEB RESEARCH MODULE
 * =============================================================================
 * 
 * Enhances the !research command with real-time web search using Exa AI.
 * Provides: web search + content extraction + AI synthesis
 * 
 * CONFIGURATION (via .env):
 * - EXA_API_KEY: Your Exa API key (get from https://dashboard.exa.ai/)
 * - EXA_SEARCH_LIMIT: Number of search results (default: 5)
 * - EXA_CONTENT_LIMIT: Number of URLs to fetch content from (default: 3)
 * 
 * =============================================================================
 */

const { Exa } = require('exa-js');

// Configuration from environment
const EXA_API_KEY = process.env.EXA_API_KEY;
const EXA_SEARCH_LIMIT = parseInt(process.env.EXA_SEARCH_LIMIT) || 5;
const EXA_CONTENT_LIMIT = parseInt(process.env.EXA_CONTENT_LIMIT) || 3;

// Initialize Exa client (null if no API key)
let exaClient = null;
if (EXA_API_KEY) {
    exaClient = new Exa(EXA_API_KEY);
} else {
    console.warn('[WEBRESEARCH] EXA_API_KEY not set - web search disabled');
}

// Smart detection keywords - triggers web search when present
const WEB_SEARCH_TRIGGERS = {
    temporal: ['latest', 'recent', 'new', '2024', '2025', '2026', 'current'],
    factual: ['what is', 'who is', 'who was', 'how does', 'how is', 'best', 'top', 'ranked', 'compare', 'weather', 'temperature', 'forecast'],
    comparison: ['vs', 'versus', 'compare', 'difference', 'between', 'or'],
    action: ['how to', 'ways to', 'steps to', 'guide', 'tutorial', 'learn', 'start']
};

/**
 * =============================================================================
 * FUNCTION: shouldUseWebSearch()
 * =============================================================================
 * PURPOSE: Detect if query needs real-time web information
 * 
 * Returns true if query contains trigger keywords, making web search valuable.
 * Otherwise returns false - use static AI knowledge.
 * 
 * @param {string} query - User's research query
 * @returns {boolean} - True if should use web search
 * =============================================================================
 */
function shouldUseWebSearch(query) {
    if (!EXA_API_KEY) {
        console.log('[WEBRESEARCH] No API key - skipping web search');
        return false;
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Check all trigger categories
    for (const category of Object.values(WEB_SEARCH_TRIGGERS)) {
        for (const keyword of category) {
            if (lowerQuery.includes(keyword)) {
                console.log(`[WEBRESEARCH] Web search triggered by: ${keyword}`);
                return true;
            }
        }
    }
    
    // Also trigger on specific question patterns
    if (lowerQuery.startsWith('what ') || 
        lowerQuery.startsWith('how ') || 
        lowerQuery.startsWith('why ') ||
        lowerQuery.startsWith('when ') ||
        lowerQuery.startsWith('where ') ||
        lowerQuery.startsWith('who ')) {
        // Questions often benefit from web search
        console.log('[WEBRESEARCH] Question detected - using web search');
        return true;
    }
    
    console.log('[WEBRESEARCH] No web search triggers found - using static AI');
    return false;
}

/**
 * =============================================================================
 * FUNCTION: searchWeb()
 * =============================================================================
 * PURPOSE: Perform web search using Exa API
 * 
 * @param {string} query - Search query
 * @param {number} numResults - Number of results to return
 * @returns {Promise<Array>} - Array of search results
 * =============================================================================
 */
async function searchWeb(query, numResults = EXA_SEARCH_LIMIT) {
    if (!exaClient) {
        throw new Error('Exa API not configured. Add EXA_API_KEY to .env');
    }
    
    console.log(`[WEBRESEARCH] Searching Exa for: "${query}"`);
    
    try {
        const results = await exaClient.search(query, {
            type: "auto",
            numResults: numResults,
            contents: {
                highlights: true
            }
        });
        
        console.log(`[WEBRESEARCH] Found ${results.results?.length || 0} results`);
        return results.results || [];
        
    } catch (error) {
        console.error('[WEBRESEARCH] Exa search failed:', error.message);
        throw error;
    }
}

/**
 * =============================================================================
 * FUNCTION: fetchContentFromUrls()
 * =============================================================================
 * PURPOSE: Get full content from a list of URLs using Exa
 * 
 * @param {Array} urls - Array of URLs to fetch content from
 * @returns {Promise<Array>} - Array of content objects
 * =============================================================================
 */
async function fetchContentFromUrls(urls) {
    if (!exaClient || urls.length === 0) {
        return [];
    }
    
    console.log(`[WEBRESEARCH] Fetching content from ${urls.length} URLs...`);
    
    try {
        const results = await exaClient.getContents(
            urls,
            {
                highlights: true,
                text: { maxCharacters: 10000 }
            }
        );
        
        console.log(`[WEBRESEARCH] Got content from ${results.results?.length || 0} URLs`);
        return results.results || [];
        
    } catch (error) {
        console.error('[WEBRESEARCH] Content fetch failed:', error.message);
        // Return empty array - we can still work with search results
        return [];
    }
}

/**
 * =============================================================================
 * FUNCTION: synthesizeWithAI()
 * =============================================================================
 * PURPOSE: Use GPT to analyze gathered content and answer the query
 * 
 * @param {string} query - Original user query
 * @param {Array} searchResults - Exa search results with highlights
 * @param {Array} contentResults - Fetched content from URLs
 * @param {Object} aiClient - Primary AI client
 * @param {Object} aiClient2 - Fallback AI client
 * @param {string} model - Model name
 * @returns {Promise<string>} - AI synthesized answer
 * =============================================================================
 */
async function synthesizeWithAI(query, searchResults, contentResults, aiClient, aiClient2, model) {
    console.log('[WEBRESEARCH] Synthesizing answer with AI...');
    
    // Build context from search results
    let context = `User query: "${query}"\n\n`;
    context += `Found ${searchResults.length} relevant sources:\n\n`;
    
    // Add search result highlights
    for (let i = 0; i < searchResults.length; i++) {
        const result = searchResults[i];
        context += `[Source ${i + 1}] ${result.title}\n`;
        context += `URL: ${result.url}\n`;
        if (result.highlights) {
            context += `Highlights: ${result.highlights.join(' ')}\n`;
        }
        context += '\n';
    }
    
    // Add full content if available
    if (contentResults.length > 0) {
        context += '\n--- Full Content from Top Sources ---\n\n';
        for (const content of contentResults) {
            if (content.text) {
                context += `From: ${content.url}\n`;
                context += `${content.text.slice(0, 3000)}\n\n`;
            }
        }
    }
    
    const synthesisPrompt = `You are Wolfy, LUPOS AI assistant. A user asked a research question and you have gathered information from the web.
Analyze the sources and provide a clear, helpful answer.

${context}

Instructions:
- Answer the user's question based on the information gathered
- Be specific and cite sources when possible
- If information is conflicting, mention that
- Keep the answer concise but informative
- Use formatting (bullets, bold) for readability
- End with a "Sources:" section listing the URLs used`;

    try {
        const response = await aiClient.path("/chat/completions").post({
            body: {
                messages: [
                    { role: "system", content: synthesisPrompt },
                    { role: "user", content: `Answer this question: ${query}` }
                ],
                temperature: 0.7,
                top_p: 0.9,
                model: model
            }
        });
        
        return response.body.choices[0].message.content;
        
    } catch (error) {
        console.error('[WEBRESEARCH] Primary AI synthesis failed:', error.message);
        
        // Try fallback
        try {
            const response = await aiClient2.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: synthesisPrompt },
                        { role: "user", content: `Answer this question: ${query}` }
                    ],
                    temperature: 0.7,
                    top_p: 0.9,
                    model: model
                }
            });
            
            return response.body.choices[0].message.content;
            
        } catch (fallbackError) {
            console.error('[WEBRESEARCH] Fallback AI also failed:', fallbackError.message);
            // Return a simple summary if AI fails
            return `Found ${searchResults.length} sources for "${query}". Here's a summary:\n\n` +
                searchResults.slice(0, 3).map(r => `• **${r.title}**\n  ${r.url}`).join('\n\n');
        }
    }
}

/**
 * =============================================================================
 * FUNCTION: formatSourcesList()
 * =============================================================================
 * PURPOSE: Format sources for Discord embed
 * 
 * @param {Array} searchResults - Exa search results
 * @returns {string} - Formatted sources string
 * =============================================================================
 */
function formatSourcesList(searchResults) {
    if (!searchResults || searchResults.length === 0) {
        return 'No sources found';
    }
    
    const sources = searchResults.slice(0, 5).map((result, index) => {
        const title = result.title?.slice(0, 50) || `Source ${index + 1}`;
        return `${index + 1}. [${title}...](${result.url})`;
    });
    
    return sources.join('\n');
}

/**
 * =============================================================================
 * FUNCTION: performWebResearch()
 * =============================================================================
 * MAIN ENTRY POINT - This is what index.js calls
 * 
 * @param {string} query - User's research query
 * @param {Object} aiClient - Primary AI client
 * @param {Object} aiClient2 - Fallback AI client
 * @param {string} model - Model name
 * @returns {Promise<Object>} - { answer, sources, needsWebSearch }
 * =============================================================================
 */
async function performWebResearch(query, aiClient, aiClient2, model) {
    // Check if we should use web search
    const shouldSearch = shouldUseWebSearch(query);
    
    if (!shouldSearch) {
        return {
            needsWebSearch: false,
            answer: null,
            sources: null
        };
    }
    
    console.log(`[WEBRESEARCH] Performing web research for: "${query}"`);
    
    try {
        // Step 1: Search the web
        const searchResults = await searchWeb(query, EXA_SEARCH_LIMIT);
        
        if (searchResults.length === 0) {
            return {
                needsWebSearch: true,
                answer: `No web results found for "${query}". Try different keywords.`,
                sources: null
            };
        }
        
        // Step 2: Get top URLs for content
        const topUrls = searchResults
            .slice(0, EXA_CONTENT_LIMIT)
            .map(r => r.url)
            .filter(url => url); // Filter out null/undefined
        
        // Step 3: Fetch content from top URLs
        const contentResults = await fetchContentFromUrls(topUrls);
        
        // Step 4: Synthesize with AI
        const answer = await synthesizeWithAI(query, searchResults, contentResults, aiClient, aiClient2, model);
        
        // Step 5: Format sources
        const sources = formatSourcesList(searchResults);
        
        return {
            needsWebSearch: true,
            answer: answer,
            sources: sources,
            searchResults: searchResults // Keep for debugging
        };
        
    } catch (error) {
        console.error('[WEBRESEARCH] Web research failed:', error.message);
        return {
            needsWebSearch: true,
            answer: `Web search failed: ${error.message}. Please try again later.`,
            sources: null
        };
    }
}

/**
 * =============================================================================
 * FUNCTION: isConfigured()
 * =============================================================================
 * PURPOSE: Check if web research is properly configured
 * 
 * @returns {boolean} - True if EXA_API_KEY is set
 * =============================================================================
 */
function isConfigured() {
    return !!EXA_API_KEY;
}

module.exports = {
    performWebResearch,
    shouldUseWebSearch,
    searchWeb,
    fetchContentFromUrls,
    synthesizeWithAI,
    isConfigured,
    EXA_SEARCH_LIMIT,
    EXA_CONTENT_LIMIT
};