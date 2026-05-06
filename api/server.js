const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// ==================== MODELOS ====================

// Schema de Usuário
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    sala: { type: String, required: true },
    cargo: { type: String, required: true }
});

// Schema de Sala
const SalaSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    nome: { type: String, required: true },
    lider: { type: String, required: true },
    viceLider: { type: String, required: true },
    secretario: { type: String, required: true },
    alunos: { type: [String], default: [] }
});

// Schema de Falta
const FaltaSchema = new mongoose.Schema({
    salaId: { type: String, required: true },
    aluno: { type: String, required: true },
    data: { type: Date, required: true },
    registradoPor: { type: String, required: true },
    dataRegistro: { type: Date, default: Date.now }
});

// Schema de Notificação (para relatórios enviados ao admin)
const NotificacaoSchema = new mongoose.Schema({
    sala: { type: String, required: true },
    data: { type: String, required: true },
    enviadoPor: { type: String, required: true },
    cargo: { type: String, required: true },
    faltas: { type: Array, default: [] },
    lida: { type: Boolean, default: false },
    dataEnvio: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Sala = mongoose.model('Sala', SalaSchema);
const Falta = mongoose.model('Falta', FaltaSchema);
const Notificacao = mongoose.model('Notificacao', NotificacaoSchema);

// ==================== CONEXÃO MONGODB ====================

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
        await inicializarAdminPadrao();
    } catch (error) {
        console.error('❌ Erro ao conectar MongoDB:', error);
    }
};

// Criar admin padrão se não existir
async function inicializarAdminPadrao() {
    try {
        const adminExiste = await User.findOne({ username: 'admin' });
        if (!adminExiste) {
            await User.create({
                username: 'admin',
                senha: 'admin',
                sala: 'admin',
                cargo: 'admin'
            });
            console.log('✅ Usuário admin criado com sucesso!');
        }
    } catch (error) {
        console.error('Erro ao criar admin:', error);
    }
}

// ==================== ROTAS ====================

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

// Rota para registrar gestor
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

app.delete('/api/admin/deletar-sala', async (req, res) => {
    const { sala } = req.body;
    if (!sala) {
        return res.status(400).json({ error: 'Sala é obrigatória.' });
    }

    try {
        const salaDoc = await Sala.findOne({ id: sala });
        if (!salaDoc) {
            return res.status(404).json({ error: 'Sala não encontrada.' });
        }

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
        const alunosJaExistentes = [];

        for (const alunoNome of alunos) {
            const alunoTrim = alunoNome.trim();
            if (!alunoTrim) continue;

            if (salaDoc.alunos.includes(alunoTrim)) {
                alunosJaExistentes.push(alunoTrim);
                continue;
            }

            salaDoc.alunos.push(alunoTrim);
            alunosAdicionados.push(alunoTrim);

            await User.findOneAndUpdate(
                { username: alunoTrim },
                { username: alunoTrim, senha: alunoTrim, sala, cargo: 'aluno' },
                { upsert: true, new: true }
            );
        }

        await salaDoc.save();

        let message = `${alunosAdicionados.length} aluno(s) adicionado(s) com sucesso!`;
        if (alunosJaExistentes.length > 0) {
            message += ` ${alunosJaExistentes.length} já existiam.`;
        }

        res.json({ success: true, message });
    } catch (error) {
        console.error('Erro ao adicionar alunos admin:', error);
        res.status(500).json({ error: 'Erro ao adicionar alunos' });
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
        
        if (!salaDoc.alunos.includes(aluno)) {
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

// Rota para buscar faltas (usada no envio de relatório)
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

// Rota para enviar relatório ao admin
app.post('/api/enviar-relatorio-admin', async (req, res) => {
    const { sala, data, enviadoPor, cargo, faltas } = req.body;
    
    try {
        const notificacao = await Notificacao.create({
            sala,
            data,
            enviadoPor,
            cargo,
            faltas,
            lida: false,
            dataEnvio: new Date()
        });
        
        console.log(`\n📬 RELATÓRIO ENVIADO AO ADMIN:`);
        console.log(`   🏫 Sala: ${sala}`);
        console.log(`   📅 Data: ${data}`);
        console.log(`   👔 Enviado por: ${enviadoPor} (${cargo})`);
        console.log(`   📊 Total de faltas: ${faltas.length}`);
        
        res.json({ success: true, notificacaoId: notificacao._id });
    } catch (error) {
        console.error('Erro ao enviar relatório:', error);
        res.status(500).json({ error: 'Erro ao enviar relatório' });
    }
});

// Rota para buscar notificações (admin)
app.get('/api/admin/notificacoes', async (req, res) => {
    try {
        const notificacoes = await Notificacao.find({ lida: false }).sort({ dataEnvio: -1 });
        res.json(notificacoes);
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).json({ error: 'Erro ao buscar notificações' });
    }
});

// Rota para marcar notificação como lida
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

// ==================== INICIAR SERVIDOR ====================

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

module.exports = app;