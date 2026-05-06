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
            const cargoRaw = String(user.cargo || '').trim().toLowerCase();
            const cargoNormalizado = cargoRaw === 'adimin' ? 'admin' : cargoRaw;

            res.json({
                success: true,
                cargo: cargoNormalizado,
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

app.post('/api/admin/registrar-gestor', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    try {
        await User.findOneAndUpdate(
            { username },
            { username, senha: password, sala: 'admin', cargo: 'admin' },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao registrar gestor:', error);
        res.status(500).json({ error: 'Erro ao registrar gestor.' });
    }
});

// Rotas de administração
app.get('/api/admin/salas', async (req, res) => {
    try {
        const salas = await Sala.find({}).lean();
        res.json(salas);
    } catch (error) {
        console.error('Erro ao buscar salas admin:', error);
        res.status(500).json({ error: 'Erro ao buscar salas' });
    }
});

app.post('/api/admin/criar-sala', async (req, res) => {
    const {
        id,
        nome,
        lider,
        liderSenha,
        viceLider,
        viceLiderSenha,
        secretario,
        secretarioSenha,
        alunos = []
    } = req.body;

    if (!id || !nome || !lider || !liderSenha || !viceLider || !viceLiderSenha || !secretario || !secretarioSenha) {
        return res.status(400).json({ error: 'Todos os campos da sala e dos cargos são obrigatórios.' });
    }

    try {
        await Sala.findOneAndUpdate(
            { id },
            {
                id,
                nome,
                lider,
                viceLider,
                secretario,
                alunos
            },
            { upsert: true, new: true }
        );

        await User.findOneAndUpdate(
            { username: lider },
            { username: lider, senha: liderSenha, sala: id, cargo: 'lider' },
            { upsert: true, new: true }
        );

        await User.findOneAndUpdate(
            { username: viceLider },
            { username: viceLider, senha: viceLiderSenha, sala: id, cargo: 'viceLider' },
            { upsert: true, new: true }
        );

        await User.findOneAndUpdate(
            { username: secretario },
            { username: secretario, senha: secretarioSenha, sala: id, cargo: 'secretario' },
            { upsert: true, new: true }
        );

        for (const alunoNome of alunos) {
            const alunoTrim = alunoNome.trim();
            if (!alunoTrim) continue;

            await Sala.updateOne(
                { id },
                { $addToSet: { alunos: alunoTrim } }
            );

            await User.findOneAndUpdate(
                { username: alunoTrim },
                { username: alunoTrim, senha: alunoTrim, sala: id, cargo: 'aluno' },
                { upsert: true, new: true }
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao criar sala admin:', error);
        res.status(500).json({ error: 'Erro ao criar sala' });
    }
});

app.post('/api/admin/adicionar-aluno', async (req, res) => {
    const { sala, username } = req.body;
    if (!sala || !username) {
        return res.status(400).json({ error: 'Sala e nome do aluno são obrigatórios.' });
    }

    try {
        const salaDoc = await Sala.findOne({ id: sala });
        if (!salaDoc) {
            return res.status(404).json({ error: 'Sala não encontrada.' });
        }

        if (salaDoc.alunos.includes(username)) {
            return res.status(400).json({ error: 'Aluno já cadastrado nesta sala.' });
        }

        salaDoc.alunos.push(username);
        await salaDoc.save();

        await User.findOneAndUpdate(
            { username },
            { username, senha: username, sala, cargo: 'aluno' },
            { upsert: true, new: true }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao adicionar aluno admin:', error);
        res.status(500).json({ error: 'Erro ao adicionar aluno' });
    }
});

app.post('/api/admin/relatorio-faltas', async (req, res) => {
    const { sala, data } = req.body;

    if (!sala || !data) {
        return res.status(400).json({ error: 'Sala e data são obrigatórias.' });
    }

    try {
        const dataInicio = new Date(data);
        dataInicio.setHours(0, 0, 0, 0);
        const dataFim = new Date(data);
        dataFim.setHours(23, 59, 59, 999);

        const faltas = await Falta.find({
            salaId: sala,
            data: { $gte: dataInicio, $lte: dataFim }
        }).sort({ dataRegistro: -1 });

        res.json({
            faltas: faltas.map(falta => ({
                aluno: falta.aluno,
                registradoPor: falta.registradoPor,
                dataRegistro: falta.dataRegistro
            }))
        });
    } catch (error) {
        console.error('Erro ao gerar relatório admin:', error);
        res.status(500).json({ error: 'Erro ao buscar relatório de faltas' });
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
