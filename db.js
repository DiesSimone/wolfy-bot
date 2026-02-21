require("dotenv").config();
const mongoose = require("mongoose");

async function connectDb(){
    await mongoose.connect(process.env.DATABASE_URI);
}

module.exports = connectDb