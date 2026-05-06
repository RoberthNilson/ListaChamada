const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    sala: { type: String, required: true },
    cargo: { type: String, required: true }
});

module.exports = mongoose.model('User', UserSchema);