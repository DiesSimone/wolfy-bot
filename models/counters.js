const mongoose = require("mongoose");

const countersSchema = new mongoose.Schema({
    reality_counter: {
        type: Number,
        required: true,
        unique: false,
    },
    last_updated : {
        type: Date,
        required: true,
        unique: false
    }
});

const counters = mongoose.model("Counters", countersSchema);

module.exports = counters; 