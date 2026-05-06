const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Modelos
const Falta = require('../models/Falta');
const Sala = require('../models/Sala');
const User = require('../models/User');
const Notificacao = require('../models/Notificacao');

// Conexão MongoDB
const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        console.warn('MONGODB_URI não definida. Usando modo sem banco.');
        return;
    }
    if (mongoose.connection.readyState === 1) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Conectado ao MongoDB Atlas!');
    } catch (error) {
        console.error('Erro ao conectar MongoDB:', error);
    }
};

// WebSocket para enviar relatórios ao admin em tempo real
const adminConnections = new Set();

wss.on('connection', (ws) => {
    console.log('Novo cliente WebSocket conectado');
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.tipo === 'admin_conectado') {
                adminConnections.add(ws);
                console.log('Admin conectado ao WebSocket');
            }
            
            if (data.tipo === 'relatorio_faltas') {
                console.log(`Relatório recebido: Sala ${data.sala}, Data ${data.data}`);
                
                // Salvar notificação no banco
                const notificacao = new Notificacao({
                    sala: data.sala,
                    data: data.data,
                    enviadoPor: data.enviadoPor,
                    cargo: data.cargo,
                    faltas: data.faltas,
                    lida: false,
                    dataEnvio: new Date()
                });
                await notificacao.save();
                
                // Adicionar ID da notificação
                data.id = notificacao._id;
                
                // Enviar para todos os admins conectados
                adminConnections.forEach(admin => {
                    if (admin.readyState === WebSocket.OPEN) {
                        admin.send(JSON.stringify(data));
                    }
                });
            }
        } catch (error) {
            console.error('Erro no WebSocket:', error);
        }
    });
    
    ws.on('close', () => {
        adminConnections.delete(ws);
        console.log('Cliente WebSocket desconectado');
    });
});

// ==================== ROTAS DE AUTENTICAÇÃO ====================

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

// ==================== ROTAS DE ADMIN ====================

app.get('/api/admin/salas', async (req, res) => {
    try {
        const salas = await Sala.find({}).lean();
        res.json(salas);
    } catch (error) {
        console.error('Erro ao buscar salas:', error);
        res.status(500).json({ error: 'Erro ao buscar salas' });
    }
});

app.get('/api/admin/notificacoes', async (req, res) => {
    try {
        const notificacoes = await Notificacao.find({ lida: false }).sort({ dataEnvio: -1 });
        res.json(notificacoes);
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.json([]);
    }
});

app.post('/api/admin/marcar-notificacao-lida', async (req, res) => {
    const { id } = req.body;
    try {
        await Notificacao.findByIdAndUpdate(id, { lida: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao marcar notificação:', error);
        res.status(500).json({ error: 'Erro ao marcar notificação' });
    }
});

app.post('/api/admin/criar-sala', async (req, res) => {
    const { id, nome, lider, liderSenha, viceLider, viceLiderSenha, secretario, secretarioSenha, alunos = [] } = req.body;

    if (!id || !nome || !lider || !liderSenha || !viceLider || !viceLiderSenha || !secretario || !secretarioSenha) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    try {
        await Sala.findOneAndUpdate(
            { id },
            { id, nome, lider, viceLider, secretario, alunos },
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

        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao criar sala:', error);
        res.status(500).json({ error: 'Erro ao criar sala' });
    }
});

app.delete('/api/admin/deletar-sala', async (req, res) => {
    const { sala } = req.body;
    if (!sala) {
        return res.status(400).json({ error: 'Sala é obrigatória.' });
    }

    try {
        await User.deleteMany({ sala });
        await Falta.deleteMany({ salaId: sala });
        await Sala.deleteOne({ id: sala });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao deletar sala:', error);
        res.status(500).json({ error: 'Erro ao deletar sala' });
    }
});

app.post('/api/admin/adicionar-alunos', async (req, res) => {
    const { sala, alunos } = req.body;
    if (!sala || !Array.isArray(alunos) || alunos.length === 0) {
        return res.status(400).json({ error: 'Sala e lista de alunos são obrigatórios.' });
    }

    try {
        const salaDoc = await Sala.findOne({ id: sala });
        if (!salaDoc) {
            return res.status(404).json({ error: 'Sala não encontrada.' });
        }

        const alunosAdicionados = [];
        for (const alunoNome of alunos) {
            const alunoTrim = alunoNome.trim();
            if (!alunoTrim || salaDoc.alunos.includes(alunoTrim)) continue;

            salaDoc.alunos.push(alunoTrim);
            alunosAdicionados.push(alunoTrim);

            await User.findOneAndUpdate(
                { username: alunoTrim },
                { username: alunoTrim, senha: alunoTrim, sala, cargo: 'aluno' },
                { upsert: true, new: true }
            );
        }

        await salaDoc.save();
        res.json({ success: true, message: `${alunosAdicionados.length} aluno(s) adicionado(s)!` });
    } catch (error) {
        console.error('Erro ao adicionar alunos:', error);
        res.status(500).json({ error: 'Erro ao adicionar alunos' });
    }
});

// ==================== ROTAS DE CHAMADA ====================

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
        
        res.json({ alunos: salaDoc.alunos, faltas: faltasFormatadas });
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        res.status(500).json({ error: 'Erro ao carregar dados' });
    }
});

app.post('/api/registrar-falta', async (req, res) => {
    const { sala, aluno, data, registradoPor } = req.body;
    
    try {
        const salaDoc = await Sala.findOne({ id: sala });
        if (!salaDoc || !salaDoc.alunos.includes(aluno)) {
            return res.status(400).json({ error: 'Aluno não pertence à sala' });
        }
        
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
        
        await Falta.create({
            salaId: sala,
            aluno: aluno,
            data: new Date(data),
            registradoPor: registradoPor,
            dataRegistro: new Date()
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao registrar falta:', error);
        res.status(500).json({ error: 'Erro ao registrar falta' });
    }
});

// ==================== ROTA PARA BUSCAR FALTAS ====================

app.post('/api/buscar-faltas', async (req, res) => {
    const { sala, data } = req.body;
    
    try {
        const dataInicio = new Date(data);
        dataInicio.setHours(0, 0, 0, 0);
        const dataFim = new Date(data);
        dataFim.setHours(23, 59, 59, 999);
        
        const faltas = await Falta.find({
            salaId: sala,
            data: { $gte: dataInicio, $lte: dataFim }
        });
        
        res.json(faltas);
    } catch (error) {
        console.error('Erro ao buscar faltas:', error);
        res.status(500).json({ error: 'Erro ao buscar faltas' });
    }
});

// ==================== ROTA PARA ENVIAR RELATÓRIO AO ADMIN (FALLBACK) ====================

app.post('/api/enviar-relatorio-admin', async (req, res) => {
    const { sala, data, enviadoPor, cargo, faltas } = req.body;
    
    try {
        const notificacao = new Notificacao({
            sala,
            data,
            enviadoPor,
            cargo,
            faltas,
            lida: false,
            dataEnvio: new Date()
        });
        await notificacao.save();
        
        console.log(`Relatório salvo no banco para o admin: Sala ${sala}, Data ${data}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao salvar notificação:', error);
        res.status(500).json({ error: 'Erro ao enviar relatório' });
    }
});

// ==================== INICIAR SERVIDOR ====================

if (process.env.MONGODB_URI) {
    connectDB();
} else {
    console.warn('MONGODB_URI não definida. Banco não conectado.');
}

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Servidor rodando na porta ${PORT}`);
    });
}

module.exports = app;