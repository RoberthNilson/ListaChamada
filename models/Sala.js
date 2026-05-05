const mongoose = require('mongoose');

const SalaSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    nome: { type: String, required: true },
    lider: { type: String, required: true },
    viceLider: { type: String, required: true },
    secretario: { type: String, required: true },
    alunos: [{ type: String }]
});

module.exports = mongoose.model('Sala', SalaSchema);