const Summaries = require('../models/summaries.js');

class Summarizer {
    constructor(aiClient, aiClient2) {
        this.aiClient = aiClient;
        this.aiClient2 = aiClient2;
        this.cache = new Map();
        this.cacheTTL = 300000; // 5 min in-memory cache
    }

    generateCacheKey(channelId, startMsgId, endMsgId) {
        return `${channelId}:${startMsgId}:${endMsgId}`;
    }

    async getCachedSummary(channelId, startMsgId, endMsgId) {
        const key = this.generateCacheKey(channelId, startMsgId, endMsgId);
        const cached = this.cache.get(key);
        
        if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
            return cached.data;
        }

        const dbSummary = await Summaries.findOne({
            channelId,
            messageRangeKey: `${startMsgId}-${endMsgId}`
        });

        if (dbSummary) {
            this.cache.set(key, { data: dbSummary, timestamp: Date.now() });
            return dbSummary;
        }

        return null;
    }

    async cacheSummary(channelId, startMsgId, endMsgId, summaryData) {
        const key = this.generateCacheKey(channelId, startMsgId, endMsgId);
        
        this.cache.set(key, { data: summaryData, timestamp: Date.now() });

        await Summaries.findOneAndUpdate(
            { channelId, messageRangeKey: `${startMsgId}-${endMsgId}` },
            { ...summaryData, messageRangeKey: `${startMsgId}-${endMsgId}` },
            { upsert: true }
        );
    }

    filterMessages(messages) {
        const noisePatterns = [
            /^!/,
            /^\//,
            /^<@/,
            /^<#!/,
            /^<#\d+>/,
            /^https?:\/\//,
            /^\s*$/,
            /^(?:gif|emoji|sticker|embed only)/i
        ];

        return messages
            .filter(msg => {
                if (msg.author?.bot && !msg.content?.trim()) return false;
                const content = msg.content || '';
                for (const pattern of noisePatterns) {
                    if (pattern.test(content.trim())) return false;
                }
                return true;
            })
            .map(msg => ({
                author: msg.author?.username || msg.authorName || 'Unknown',
                content: msg.content || '',
                timestamp: msg.createdTimestamp
            }));
    }

    chunkMessages(messages, maxTokens = 8000) {
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;

        for (const msg of messages) {
            const msgSize = msg.content.length;
            if (currentSize + msgSize > maxTokens && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = [];
                currentSize = 0;
            }
            currentChunk.push(msg);
            currentSize += msgSize;
        }

        if (currentChunk.length > 0) chunks.push(currentChunk);
        return chunks;
    }

    async summarizeChunk(messages, depth = 'normal') {
        const depthConfig = {
            brief: { maxMessages: 50, outputLength: 500 },
            normal: { maxMessages: 150, outputLength: 1500 },
            deep: { maxMessages: 300, outputLength: 2500 }
        };

        const config = depthConfig[depth] || depthConfig.normal;
        const sample = messages.slice(-config.maxMessages);

        const systemPrompt = `You are a Discord chat summarizer. Analyze the messages and produce a structured summary.
Return JSON with this exact format:
{
  "summary": "2-3 sentence overview",
  "topics": ["topic1", "topic2", "topic3"],
  "actionItems": ["task1", "task2"],
  "sentiment": "positive|neutral|negative|mixed"
}
Keep summary under ${config.outputLength} chars.`;

        const userPrompt = sample.map(m => `${m.author}: ${m.content}`).join('\n');

        try {
            const response = await this.aiClient.path("/chat/completions").post({
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
            return JSON.parse(response.body.choices[0].message.content);
        } catch (error) {
            console.error('[SUMMARIZER] Primary AI failed, trying fallback:', error);
            try {
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
                return JSON.parse(response.body.choices[0].message.content);
            } catch (fallbackError) {
                console.error('[SUMMARIZER] Fallback also failed:', fallbackError);
                throw fallbackError;
            }
        }
    }

    async summarize(messages, options = {}) {
        const { depth = 'normal', channelId, startMsgId, endMsgId } = options;
        
        const cached = await this.getCachedSummary(channelId, startMsgId, endMsgId);
        if (cached) return cached;

        const filtered = this.filterMessages(messages);
        if (filtered.length === 0) {
            return { summary: 'No messages to summarize.', topics: [], actionItems: [], sentiment: 'neutral' };
        }

        const chunks = this.chunkMessages(filtered);
        let results = [];

        for (const chunk of chunks) {
            const result = await this.summarizeChunk(chunk, depth);
            results.push(result);
        }

        const finalSummary = this.mergeResults(results);
        
        await this.cacheSummary(channelId, startMsgId, endMsgId, {
            ...finalSummary,
            channelId,
            messageCount: filtered.length,
            generatedBy: 'system'
        });

        return finalSummary;
    }

    mergeResults(results) {
        if (results.length === 1) return results[0];

        const allTopics = [...new Set(results.flatMap(r => r.topics || []))];
        const allActions = [...new Set(results.flatMap(r => r.actionItems || []))];
        
        const sentiments = results.map(r => r.sentiment).filter(Boolean);
        const finalSentiment = sentiments.includes('negative') ? 'mixed' : 
            sentiments.every(s => s === sentiments[0]) ? sentiments[0] : 'mixed';

        return {
            summary: results.map(r => r.summary).join(' ').slice(0, 1500),
            topics: allTopics.slice(0, 5),
            actionItems: allActions.slice(0, 5),
            sentiment: finalSentiment
        };
    }
}

module.exports = Summarizer;