const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Modelos
const Falta = require('../models/Falta');
const Sala = require('../models/Sala');
const User = require('../models/User');

// Função para conectar ao MongoDB
const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        console.warn('⚠️ MONGODB_URI não definida. A conexão com MongoDB será ignorada.');
        return;
    }

    if (mongoose.connection.readyState === 1) {
        return;
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB Atlas com sucesso!');
        
        // Inicializar salas no banco
        for (const [id, salaData] of Object.entries(salas)) {
            const existe = await Sala.findOne({ id });
            if (!existe) {
                await Sala.create({
                    id: id,
                    nome: salaData.nome,
                    lider: salaData.lider,
                    viceLider: salaData.viceLider,
                    secretario: salaData.secretario,
                    alunos: salaData.alunos
                });
                console.log(`📚 Sala ${salaData.nome} criada no MongoDB`);
            }
        }
        
        // Inicializar usuários no banco
        for (const [username, data] of Object.entries(users)) {
            const existe = await User.findOne({ username });
            if (!existe) {
                await User.create({
                    username,
                    senha: data.senha,
                    sala: data.sala,
                    cargo: data.cargo
                });
                console.log(`👤 Usuário ${username} criado no MongoDB`);
            }
        }
        console.log('✅ Dados inicializados com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao conectar MongoDB:', error);
    }
};

// Rota de login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await User.findOne({ username });
        if (user && user.senha === password) {
            const salaDoc = await Sala.findOne({ id: user.sala });
            res.json({
                success: true,
                cargo: user.cargo,
                sala: user.sala,
                nomeSala: salaDoc ? salaDoc.nome : 'Sala não encontrada',
                username: username
            });
        } else {
            res.json({ success: false, message: 'Usuário ou senha inválidos!' });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro no login' });
    }
});

// Rota para carregar dados da sala
app.post('/api/carregar-chamada', async (req, res) => {
    const { sala } = req.body;
    
    try {
        const salaDoc = await Sala.findOne({ id: sala });
        if (!salaDoc) {
            return res.status(404).json({ error: 'Sala não encontrada' });
        }
        const faltas = await Falta.find({ salaId: sala });
        const faltasFormatadas = {};
        
        faltas.forEach(falta => {
            const dataStr = falta.data.toISOString().split('T')[0];
            if (!faltasFormatadas[dataStr]) {
                faltasFormatadas[dataStr] = {};
            }
            faltasFormatadas[dataStr][falta.aluno] = {
                registradoPor: falta.registradoPor,
                dataRegistro: falta.dataRegistro
            };
        });
        
        res.json({
            alunos: salaDoc.alunos,
            faltas: faltasFormatadas
        });
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        res.status(500).json({ error: 'Erro ao carregar dados' });
    }
});

// Rota para registrar falta
app.post('/api/registrar-falta', async (req, res) => {
    const { sala, aluno, data, registradoPor } = req.body;
    
    try {
        const salaDoc = await Sala.findOne({ id: sala });
        if (!salaDoc) {
            return res.status(404).json({ error: 'Sala não encontrada' });
        }
        
        // Verificar se o aluno pertence à sala
        if (!salaDoc.alunos.includes(aluno)) {
            return res.status(400).json({ error: 'Aluno não pertence à sala' });
        }
        
        // Verificar se já existe falta para este aluno nesta data
        const dataInicio = new Date(data);
        dataInicio.setHours(0, 0, 0, 0);
        const dataFim = new Date(data);
        dataFim.setHours(23, 59, 59, 999);
        
        const faltaExistente = await Falta.findOne({
            salaId: sala,
            aluno: aluno,
            data: { $gte: dataInicio, $lte: dataFim }
        });
        
        if (faltaExistente) {
            return res.status(400).json({ error: 'Aluno já possui falta nesta data' });
        }
        
        const novaFalta = await Falta.create({
            salaId: sala,
            aluno: aluno,
            data: new Date(data),
            registradoPor: registradoPor,
            dataRegistro: new Date()
        });
        
        console.log(`\n📝 FALTA REGISTRADA NO MONGODB:`);
        console.log(`   🏫 Sala: ${salaDoc.nome}`);
        console.log(`   👨‍🎓 Aluno: ${aluno}`);
        console.log(`   📅 Data: ${data}`);
        console.log(`   👔 Registrado por: ${registradoPor}`);
        
        res.json({ success: true, faltaId: novaFalta._id });
    } catch (error) {
        console.error('Erro ao registrar falta:', error);
        res.status(500).json({ error: 'Erro ao registrar falta' });
    }
});

// Rota para gerar relatório Excel
app.post('/api/gerar-relatorio-excel', async (req, res) => {
    const { sala, data } = req.body;
    
    try {
        const salaDoc = await Sala.findOne({ id: sala });
        if (!salaDoc) {
            return res.status(404).json({ error: 'Sala não encontrada' });
        }
        
        const dataInicio = new Date(data);
        dataInicio.setHours(0, 0, 0, 0);
        const dataFim = new Date(data);
        dataFim.setHours(23, 59, 59, 999);
        
        const faltas = await Falta.find({
            salaId: sala,
            data: { $gte: dataInicio, $lte: dataFim }
        }).sort({ dataRegistro: -1 });
        
        // Preparar dados para o Excel
        const excelData = [
            ['Data do Relatório', 'Sala', 'Aluno', 'Registrado Por', 'Data e Hora do Registro']
        ];
        
        if (faltas.length === 0) {
            excelData.push([
                data,
                salaDoc.nome,
                'Nenhuma falta registrada',
                '-',
                '-'
            ]);
        } else {
            faltas.forEach(falta => {
                excelData.push([
                    data,
                    salaDoc.nome,
                    falta.aluno,
                    falta.registradoPor,
                    new Date(falta.dataRegistro).toLocaleString('pt-BR')
                ]);
            });
        }
        
        // Criar planilha
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        
        // Ajustar largura das colunas
        ws['!cols'] = [
            { wch: 15 },  // Data
            { wch: 30 },  // Sala
            { wch: 30 },  // Aluno
            { wch: 20 },  // Registrado Por
            { wch: 25 }   // Data Registro
        ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Faltas');
        
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', `attachment; filename=relatorio_faltas_${sala}_${data}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
        
        console.log(`\n📊 RELATÓRIO EXCEL GERADO:`);
        console.log(`   🏫 Sala: ${salaDoc.nome}`);
        console.log(`   📅 Data: ${data}`);
        console.log(`   📊 Total de faltas: ${faltas.length}`);
        
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório' });
    }
});

if (process.env.MONGODB_URI) {
    connectDB();
} else {
    console.warn('⚠️ Variável de ambiente MONGODB_URI não encontrada. O banco não será conectado no momento.');
}

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log('\n========================================');
        console.log('🚀 SERVIDOR INICIADO COM SUCESSO!');
        console.log('========================================');
        console.log(`📍 Acesse: http://localhost:${PORT}`);
        console.log('========================================\n');
    });
}

// Exportar app para execução no Vercel
module.exports = app;
