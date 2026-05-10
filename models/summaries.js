const mongoose = require('mongoose');

const SummarySchema = new mongoose.Schema({
    channelId: { type: String, required: true, index: true },
    messageRangeKey: { type: String, required: true }, // startMsgId-endMsgId hash
    summary: { type: String, required: true },
    topics: [{ type: String }],
    actionItems: [{ type: String }],
    sentiment: { type: String, enum: ['positive', 'neutral', 'negative', 'mixed'] },
    messageCount: { type: Number, required: true },
    generatedBy: { type: String, required: true }, // userId
    createdAt: { type: Date, default: Date.now, expires: 86400 * 7 } // 7 day TTL
}, { capped: 10485760 }); // 10MB cap for many docs

SummarySchema.index({ channelId: 1, messageRangeKey: 1 }, { unique: true });

module.exports = mongoose.model('Summary', SummarySchema);