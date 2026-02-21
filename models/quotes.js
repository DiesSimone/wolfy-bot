const mongoose = require("mongoose");

const quotesSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        unique: true
    },
    author: {
        type: String,
        required: true,
        unique: false
    }
});

const quotes = mongoose.model("Quotes", quotesSchema);

module.exports = quotes;