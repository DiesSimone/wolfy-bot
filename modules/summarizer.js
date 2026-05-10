const Summaries = require('../models/summaries.js');

/**
 * Summarizer Class - Handles AI-powered chat summarization
 * 
 * Flow:
 * 1. Check cache (in-memory + MongoDB)
 * 2. Filter out noise (bot commands, empty msgs)
 * 3. Chunk large message sets
 * 4. Call AI for each chunk
 * 5. Merge results
 * 6. Cache and return
 */
class Summarizer {
    constructor(aiClient, aiClient2) {
        this.aiClient = aiClient;      // Primary AI endpoint (your GITHUB_API_KEY)
        this.aiClient2 = aiClient2;    // Fallback AI endpoint (your GITHUB_API_KEY2)

        // DEBUG: In-memory cache - fast lookup for recent summaries
        // TTL: 5 minutes - if user asks same question again within 5min, returns cached
        this.cache = new Map();
        this.cacheTTL = 300000; // 5 min in milliseconds
    }

    /**
     * Creates a unique key for caching based on channel + message range
     * Key format: "channelId:startMsgId:endMsgId"
     * 
     * DEBUG: If cache not working, check if this key matches between calls
     */
    generateCacheKey(channelId, startMsgId, endMsgId) {
        return `${channelId}:${startMsgId}:${endMsgId}`;
    }

    /**
     * Check if summary already exists
     * 1. First checks in-memory Map (fastest)
     * 2. Then checks MongoDB (persisted across restarts)
     * 
     * DEBUG: If summaries always regenerate:
     * - Check if message IDs changed (Discord may have new messages)
     * - Check MongoDB connection in db.js
     * - Check if TTL expired (7 days)
     */
    async getCachedSummary(channelId, startMsgId, endMsgId) {
        const key = this.generateCacheKey(channelId, startMsgId, endMsgId);

        // DEBUG: Log cache hit/miss
        const cached = this.cache.get(key);
        console.log(`[SUMMARIZER-CACHE] In-memory: ${cached ? 'HIT' : 'MISS'} for key ${key}`);

        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            console.log('[SUMMARIZER-CACHE] Returning in-memory cached result');
            return cached.data;
        }

        // DEBUG: Check MongoDB
        console.log('[SUMMARIZER-CACHE] Checking MongoDB...');
        const dbSummary = await Summaries.findOne({
            channelId,
            messageRangeKey: `${startMsgId}-${endMsgId}`
        });

        if (dbSummary) {
            console.log('[SUMMARIZER-CACHE] MongoDB HIT - restoring to memory cache');
            this.cache.set(key, { data: dbSummary, timestamp: Date.now() });
            return dbSummary;
        }

        console.log('[SUMMARIZER-CACHE] Cache MISS - will generate new summary');
        return null;
    }

    /**
     * Save summary to both memory cache and MongoDB
     * 
     * DEBUG: If caching fails:
     * - Check MongoDB connection
     * - Check Summaries model schema
     * - Check for duplicate key errors (same channel+messageRange)
     */
    async cacheSummary(channelId, startMsgId, endMsgId, summaryData) {
        const key = this.generateCacheKey(channelId, startMsgId, endMsgId);

        // Save to in-memory cache
        this.cache.set(key, { data: summaryData, timestamp: Date.now() });
        console.log('[SUMMARIZER-CACHE] Saved to in-memory cache');

        // Save to MongoDB with upsert (update if exists, insert if not)
        await Summaries.findOneAndUpdate(
            { channelId, messageRangeKey: `${startMsgId}-${endMsgId}` },
            { ...summaryData, messageRangeKey: `${startMsgId}-${endMsgId}` },
            { upsert: true }
        );
        console.log('[SUMMARIZER-CACHE] Saved to MongoDB');
    }

    /**
     * Filter out noise from messages
     * Removes:
     * - Bot commands (starting with ! or /)
     * - Mentions only messages
     * - Channel mention only messages
     * - URL-only messages
     * - Empty messages
     * - Sticker/emoji only messages
     * - Bot messages with no content
     * 
     * DEBUG: If too few messages after filtering:
     * - Check if messages are being filtered incorrectly
     * - Temporarily disable this filter to test
     */
    filterMessages(messages) {
        const noisePatterns = [
            /^!/,           // Command prefix
            /^\//,          // Slash command
            /^<@/,          // User mention
            /^<#!/,         // Slash command mention
            /^<#\d+>/,      // Channel mention
            /^https?:\/\//, // URL only
            /^\s*$/,        // Empty/whitespace only
            /^(?:gif|emoji|sticker|embed only)/i // Media only
        ];

        const filtered = messages.filter(msg => {
            // Keep bot messages only if they have actual content
            if (msg.author?.bot && !msg.content?.trim()) return false;

            const content = msg.content || '';
            const trimmed = content.trim();

            // DEBUG: Log what's being filtered
            for (const pattern of noisePatterns) {
                if (pattern.test(trimmed)) {
                    console.log(`[SUMMARIZER-FILTER] Filtered: "${trimmed.slice(0, 50)}" matched pattern ${pattern}`);
                    return false;
                }
            }
            return true;
        });

        console.log(`[SUMMARIZER-FILTER] ${messages.length} -> ${filtered.length} messages after filtering`);

        // Transform to simple format for AI
        return filtered.map(msg => ({
            author: msg.author?.username || msg.authorName || 'Unknown',
            content: msg.content || '',
            timestamp: msg.createdTimestamp
        }));
    }

    /**
     * Split messages into chunks to fit AI token limits
     * Each chunk max ~8000 chars (rough token estimate)
     * 
     * DEBUG: If AI errors about token limit:
     * - Lower maxTokens value
     * - Or reduce /summarize count parameter
     */
    chunkMessages(messages, maxTokens = 8000) {
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;

        for (const msg of messages) {
            const msgSize = msg.content.length;

            // If adding this message exceeds limit AND we have messages, push chunk
            if (currentSize + msgSize > maxTokens && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = [];
                currentSize = 0;
            }

            currentChunk.push(msg);
            currentSize += msgSize;
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }

        console.log(`[SUMMARIZER-CHUNK] Split ${messages.length} messages into ${chunks.length} chunks`);
        return chunks;
    }

    /**
     * Send a chunk of messages to AI for summarization
     * 
     * Request format:
     * - System: Instructs AI to return JSON with specific fields
     * - User: The actual messages to analyze
     * 
     * Expected AI response (JSON):
     * {
     *   "summary": "2-3 sentence overview",
     *   "topics": ["topic1", "topic2", "topic3"],
     *   "actionItems": ["task1", "task2"],
     *   "sentiment": "positive|neutral|negative|mixed"
     * }
     * 
     * DEBUG: If AI returns invalid JSON:
     * - Check model availability
     * - Check API key validity
     * - Check rate limits on AI service
     * - Increase error handling
     */
    async summarizeChunk(messages, depth = 'normal') {
        // Depth configurations control how many messages to analyze and output length
        const depthConfig = {
            brief: { maxMessages: 50, outputLength: 500 },
            normal: { maxMessages: 150, outputLength: 1500 },
            deep: { maxMessages: 300, outputLength: 2500 }
        };

        const config = depthConfig[depth] || depthConfig.normal;

        // Take only the most recent N messages based on depth
        const sample = messages.slice(-config.maxMessages);
        console.log(`[SUMMARIZER-AI] Processing ${sample.length} messages with depth: ${depth}`);

        // System prompt tells AI exactly what format to return
        const systemPrompt = `You are a Discord chat summarizer. Analyze the messages and produce a structured summary.
Return JSON with this exact format:
{
  "summary": "2-3 sentence overview",
  "topics": ["topic1", "topic2", "topic3"],
  "actionItems": ["task1", "task2"],
  "sentiment": "positive|neutral|negative|mixed"
}
Keep summary under ${config.outputLength} chars.`;

        // User prompt is the actual messages
        const userPrompt = sample.map(m => `${m.author}: ${m.content}`).join('\n');

        // Try primary AI client first
        try {
            console.log('[SUMMARIZER-AI] Calling primary AI client...');
            const response = await this.aiClient.path("/chat/completions").post({
                body: {
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.3,  // Low temp = more focused, less random
                    top_p: 0.9,
                    model: "openai/gpt-4.1-nano"
                }
            });

            const result = JSON.parse(response.body.choices[0].message.content);
            console.log('[SUMMARIZER-AI] Primary AI success');
            return result;

        } catch (error) {
            console.error('[SUMMARIZER-AI] Primary AI failed:', error.message);

            // Try fallback client if primary fails
            try {
                console.log('[SUMMARIZER-AI] Trying fallback AI client...');
                const response = await this.aiClient2.path("/chat/completions").post({
                    body: {
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ],
                        temperature: 0.3,
                        top_p: 0.9,
                        model: "openai/gpt-4.1-nano"
                    }
                });

                const result = JSON.parse(response.body.choices[0].message.content);
                console.log('[SUMMARIZER-AI] Fallback AI success');
                return result;

            } catch (fallbackError) {
                console.error('[SUMMARIZER-AI] Fallback AI also failed:', fallbackError.message);
                throw fallbackError;
            }
        }
    }

    /**
     * Main summarization function - orchestrates the entire flow
     * 
     * DEBUG: If summarize fails:
     * 1. Check cache hit/miss logs
     * 2. Check filter output count
     * 3. Check chunk count
     * 4. Check AI responses
     * 5. Check cache save
     */
    async summarize(messages, options = {}) {
        const {
            depth = 'normal',          // brief|normal|deep
            channelId,                 // Discord channel ID
            startMsgId,                // First message ID in range
            endMsgId                   // Last message ID in range
        } = options;

        console.log(`[SUMMARIZE] Starting with ${messages.length} messages, depth: ${depth}`);

        // Step 1: Check cache
        if (channelId && startMsgId && endMsgId) {
            const cached = await this.getCachedSummary(channelId, startMsgId, endMsgId);
            if (cached) {
                console.log('[SUMMARIZE] Returning cached result');
                return cached;
            }
        }

        // Step 2: Filter noise
        const filtered = this.filterMessages(messages);
        if (filtered.length === 0) {
            console.log('[SUMMARIZE] No messages after filtering');
            return {
                summary: 'No messages to summarize.',
                topics: [],
                actionItems: [],
                sentiment: 'neutral'
            };
        }

        // Step 3: Chunk if needed
        const chunks = this.chunkMessages(filtered);
        console.log(`[SUMMARIZE] Processing ${chunks.length} chunks`);

        // Step 4: Process each chunk through AI
        let results = [];
        for (let i = 0; i < chunks.length; i++) {
            console.log(`[SUMMARIZE] Processing chunk ${i + 1}/${chunks.length}`);
            const result = await this.summarizeChunk(chunks[i], depth);
            results.push(result);
        }

        // Step 5: Merge results from multiple chunks
        const finalSummary = this.mergeResults(results);
        console.log('[SUMMARIZE] Merged results:', finalSummary);

        // Step 6: Cache result
        if (channelId && startMsgId && endMsgId) {
            await this.cacheSummary(channelId, startMsgId, endMsgId, {
                ...finalSummary,
                channelId,
                messageCount: filtered.length,
                generatedBy: 'system'
            });
        }

        return finalSummary;
    }

    /**
     * Combine results from multiple chunks into one summary
     * 
     * Logic:
     * - Topics: Combine all unique topics (deduplicated)
     * - Actions: Combine all unique action items (deduplicated)
     * - Sentiment: If any chunk is negative, mark as mixed
     * - Summary: Concatenate all summaries (truncate to 1500 chars)
     * 
     * DEBUG: If merged summary looks wrong:
     * - Check individual chunk results
     * - Verify Set deduplication working
     */
    mergeResults(results) {
        if (results.length === 1) {
            console.log('[SUMMARIZE-MERGE] Single chunk, no merge needed');
            return results[0];
        }

        console.log(`[SUMMARIZE-MERGE] Merging ${results.length} chunk results`);

        // Collect all topics from all chunks, remove duplicates
        const allTopics = [...new Set(results.flatMap(r => r.topics || []))];
        console.log('[SUMMARIZE-MERGE] Topics:', allTopics);

        // Collect all action items from all chunks, remove duplicates
        const allActions = [...new Set(results.flatMap(r => r.actionItems || []))];
        console.log('[SUMMARIZE-MERGE] Actions:', allActions);

        // Determine overall sentiment
        const sentiments = results.map(r => r.sentiment).filter(Boolean);
        let finalSentiment;
        if (sentiments.includes('negative')) {
            finalSentiment = 'mixed';
        } else if (sentiments.every(s => s === sentiments[0])) {
            finalSentiment = sentiments[0];
        } else {
            finalSentiment = 'mixed';
        }
        console.log('[SUMMARIZE-MERGE] Sentiment:', finalSentiment);

        return {
            // Join all summaries and truncate
            summary: results.map(r => r.summary).join(' ').slice(0, 1500),
            // Keep top 5 topics
            topics: allTopics.slice(0, 5),
            // Keep top 5 action items
            actionItems: allActions.slice(0, 5),
            sentiment: finalSentiment
        };
    }
}

module.exports = Summarizer;