const mongoose = require('mongoose');

const AlunoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    salaId: { type: String, required: true },
    faltas: [{
        data: Date,
        registradoPor: String,
        dataRegistro: Date
    }]
});

module.exports = mongoose.model('Aluno', AlunoSchema);