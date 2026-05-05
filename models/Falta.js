const mongoose = require('mongoose');

const FaltaSchema = new mongoose.Schema({
    salaId: { type: String, required: true },
    aluno: { type: String, required: true },
    data: { type: Date, required: true },
    registradoPor: { type: String, required: true },
    dataRegistro: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Falta', FaltaSchema);