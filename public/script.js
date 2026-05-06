// Estado da aplicação
let usuarioAtual = null;
let salaAtual = null;
let cargoAtual = null;
let alunosAtuais = [];
let faltasAtuais = {};

// Dados salvos no localStorage
let salasCadastradas = [];

// Elementos DOM
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const adminScreen = document.getElementById('adminScreen');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const logoutBtnAdmin = document.getElementById('logoutBtnAdmin');
const alunosList = document.getElementById('alunosList');
const salaTitle = document.getElementById('salaTitle');
const userName = document.getElementById('userName');
const userCargo = document.getElementById('userCargo');
const userNameAdmin = document.getElementById('userNameAdmin');
const userCargoAdmin = document.getElementById('userCargoAdmin');
const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
const dataChamada = document.getElementById('dataChamada');
const loginError = document.getElementById('loginError');

const adminSalaId = document.getElementById('adminSalaId');
const adminSalaNome = document.getElementById('adminSalaNome');
const adminLider = document.getElementById('adminLider');
const adminLiderSenha = document.getElementById('adminLiderSenha');
const adminViceLider = document.getElementById('adminViceLider');
const adminViceLiderSenha = document.getElementById('adminViceLiderSenha');
const adminSecretario = document.getElementById('adminSecretario');
const adminSecretarioSenha = document.getElementById('adminSecretarioSenha');
const adminCriarSalaBtn = document.getElementById('adminCriarSalaBtn');
const adminSalaMessage = document.getElementById('adminSalaMessage');

const adminAlunoSala = document.getElementById('adminAlunoSala');
const adminAlunosLista = document.getElementById('adminAlunosLista');
const adminAdicionarAlunoBtn = document.getElementById('adminAdicionarAlunoBtn');
const adminAlunoMessage = document.getElementById('adminAlunoMessage');

const adminDeletarSala = document.getElementById('adminDeletarSala');
const adminDeletarSalaBtn = document.getElementById('adminDeletarSalaBtn');
const adminDeletarMessage = document.getElementById('adminDeletarMessage');

const adminNotificacoes = document.getElementById('adminNotificacoes');
const adminSalasList = document.getElementById('adminSalasList');

// Carregar dados do localStorage
function carregarDadosLocalStorage() {
    const salasSalvas = localStorage.getItem('salasCadastradas');
    if (salasSalvas) {
        salasCadastradas = JSON.parse(salasSalvas);
    } else {
        // Sala exemplo para teste
        salasCadastradas = [{
            id: 'sala1',
            nome: '1º Ano A',
            lider: 'presidente',
            liderSenha: '123',
            viceLider: 'vice',
            viceLiderSenha: '123',
            secretario: 'secretario',
            secretarioSenha: '123',
            alunos: ['João Silva', 'Maria Santos', 'Pedro Souza'],
            faltas: {},
            relatoriosEnviados: []
        }];
        salvarSalas();
    }
}

function salvarSalas() {
    localStorage.setItem('salasCadastradas', JSON.stringify(salasCadastradas));
}

// Configurar data atual
if (dataChamada) dataChamada.valueAsDate = new Date();

// Eventos
if (loginForm) loginForm.addEventListener('submit', fazerLogin);
if (logoutBtn) logoutBtn.addEventListener('click', fazerLogout);
if (logoutBtnAdmin) logoutBtnAdmin.addEventListener('click', fazerLogout);
if (gerarRelatorioBtn) gerarRelatorioBtn.addEventListener('click', enviarRelatorioAoAdmin);
if (adminCriarSalaBtn) adminCriarSalaBtn.addEventListener('click', criarOuAtualizarSalaAdmin);
if (adminAdicionarAlunoBtn) adminAdicionarAlunoBtn.addEventListener('click', adicionarAlunosAdmin);
if (adminDeletarSalaBtn) adminDeletarSalaBtn.addEventListener('click', deletarSalaAdmin);
if (dataChamada) dataChamada.addEventListener('change', () => {
    if (salaAtual) {
        renderizarListaAlunos();
        carregarFaltas();
    }
});

// ==================== FUNÇÕES DE AUTENTICAÇÃO ====================

function fazerLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Verificar se é admin (acesso direto)
    if (username === 'admin' && password === 'admin') {
        usuarioAtual = 'admin';
        cargoAtual = 'admin';
        salaAtual = null;
        
        if (userNameAdmin) userNameAdmin.textContent = 'Administrador';
        if (userCargoAdmin) userCargoAdmin.textContent = 'Gestor(a)';
        carregarAdminDados();
        loginScreen.classList.remove('active');
        adminScreen.classList.add('active');
        return;
    }
    
    // Verificar nas salas cadastradas
    const salaEncontrada = salasCadastradas.find(sala => 
        (sala.lider === username && sala.liderSenha === password) ||
        (sala.viceLider === username && sala.viceLiderSenha === password) ||
        (sala.secretario === username && sala.secretarioSenha === password)
    );
    
    if (salaEncontrada) {
        usuarioAtual = username;
        salaAtual = salaEncontrada.id;
        
        if (salaEncontrada.lider === username) cargoAtual = 'lider';
        else if (salaEncontrada.viceLider === username) cargoAtual = 'viceLider';
        else if (salaEncontrada.secretario === username) cargoAtual = 'secretario';
        
        if (userName) userName.textContent = usuarioAtual;
        if (userCargo) userCargo.textContent = getCargoNome(cargoAtual);
        if (salaTitle) salaTitle.textContent = salaEncontrada.nome;
        
        carregarDadosSala();
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
    } else {
        if (loginError) loginError.textContent = 'Usuário ou senha inválidos!';
    }
}

function getCargoNome(cargo) {
    const cargos = {
        'lider': 'Presidente',
        'viceLider': 'Vice-Presidente',
        'secretario': 'Secretário',
        'admin': 'Gestor(a)'
    };
    return cargos[cargo] || cargo;
}

// ==================== FUNÇÕES ADMIN ====================

function carregarAdminDados() {
    atualizarAdminSalaSelects();
    renderizarSalasAdmin();
    carregarRelatoriosRecebidos();
}

function carregarRelatoriosRecebidos() {
    if (!adminNotificacoes) return;
    
    const todosRelatorios = [];
    salasCadastradas.forEach(sala => {
        if (sala.relatoriosEnviados && sala.relatoriosEnviados.length > 0) {
            sala.relatoriosEnviados.forEach(rel => {
                todosRelatorios.push({
                    ...rel,
                    nomeSala: sala.nome,
                    salaId: sala.id
                });
            });
        }
    });
    
    if (todosRelatorios.length === 0) {
        adminNotificacoes.innerHTML = '<div>Nenhum relatório recebido ainda.</div>';
        return;
    }
    
    adminNotificacoes.innerHTML = todosRelatorios.map(rel => `
        <div style="border:1px solid #ccc; padding:10px; margin:10px 0; border-radius:5px; background:#f9f9f9;">
            <strong>📢 RELATÓRIO DE FALTAS</strong>
            <p><strong>Sala:</strong> ${rel.nomeSala} (${rel.salaId})</p>
            <p><strong>Data:</strong> ${rel.data}</p>
            <p><strong>Enviado por:</strong> ${rel.enviadoPor} (${rel.cargo})</p>
            <p><strong>Total de faltas:</strong> ${rel.faltas ? rel.faltas.length : 0}</p>
            <p><strong>Alunos com falta:</strong></p>
            <ul>${(rel.faltas || []).map(f => `<li>${f.aluno}</li>`).join('')}</ul>
            <p><small>Recebido em: ${new Date(rel.dataEnvio).toLocaleString()}</small></p>
        </div>
    `).join('');
}

function atualizarAdminSalaSelects() {
    const options = salasCadastradas.map(sala => `<option value="${sala.id}">${sala.nome} (${sala.id})</option>`).join('');
    
    if (adminAlunoSala) adminAlunoSala.innerHTML = options;
    if (adminDeletarSala) adminDeletarSala.innerHTML = options;
}

function renderizarSalasAdmin() {
    if (!adminSalasList) return;
    
    if (salasCadastradas.length === 0) {
        adminSalasList.innerHTML = '<div>Nenhuma sala cadastrada.</div>';
        return;
    }

    adminSalasList.innerHTML = salasCadastradas.map(sala => `
        <div style="border:1px solid #ddd; padding:10px; margin:10px 0; border-radius:5px;">
            <strong>${sala.nome} (${sala.id})</strong>
            <p>Presidente: ${sala.lider}</p>
            <p>Vice-Presidente: ${sala.viceLider}</p>
            <p>Secretário: ${sala.secretario}</p>
            <p><strong>Alunos:</strong> ${sala.alunos.length}</p>
            <ul>${sala.alunos.map(a => `<li>${a}</li>`).join('')}</ul>
        </div>
    `).join('');
}

function criarOuAtualizarSalaAdmin() {
    const salaId = adminSalaId.value.trim();
    const nomeSala = adminSalaNome.value.trim();
    const lider = adminLider.value.trim();
    const liderSenha = adminLiderSenha.value.trim();
    const viceLider = adminViceLider.value.trim();
    const viceLiderSenha = adminViceLiderSenha.value.trim();
    const secretario = adminSecretario.value.trim();
    const secretarioSenha = adminSecretarioSenha.value.trim();

    if (!salaId || !nomeSala || !lider || !liderSenha || !viceLider || !viceLiderSenha || !secretario || !secretarioSenha) {
        adminSalaMessage.textContent = 'Preencha todos os campos obrigatórios.';
        return;
    }

    const indiceExistente = salasCadastradas.findIndex(s => s.id === salaId);
    const novaSala = {
        id: salaId,
        nome: nomeSala,
        lider, liderSenha,
        viceLider, viceLiderSenha,
        secretario, secretarioSenha,
        alunos: indiceExistente >= 0 ? salasCadastradas[indiceExistente].alunos : [],
        faltas: indiceExistente >= 0 ? salasCadastradas[indiceExistente].faltas : {},
        relatoriosEnviados: indiceExistente >= 0 ? salasCadastradas[indiceExistente].relatoriosEnviados : []
    };
    
    if (indiceExistente >= 0) {
        salasCadastradas[indiceExistente] = novaSala;
        adminSalaMessage.textContent = 'Sala atualizada com sucesso!';
    } else {
        salasCadastradas.push(novaSala);
        adminSalaMessage.textContent = 'Sala criada com sucesso!';
    }
    
    salvarSalas();
    
    adminSalaId.value = '';
    adminSalaNome.value = '';
    adminLider.value = '';
    adminLiderSenha.value = '';
    adminViceLider.value = '';
    adminViceLiderSenha.value = '';
    adminSecretario.value = '';
    adminSecretarioSenha.value = '';
    
    carregarAdminDados();
    
    setTimeout(() => { adminSalaMessage.textContent = ''; }, 2000);
}

function adicionarAlunosAdmin() {
    const sala = adminAlunoSala.value;
    const alunosTexto = adminAlunosLista.value.trim();

    if (!sala) {
        adminAlunoMessage.textContent = 'Selecione uma sala.';
        return;
    }

    const novosAlunos = alunosTexto.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    if (novosAlunos.length === 0) {
        adminAlunoMessage.textContent = 'Digite pelo menos um nome de aluno.';
        return;
    }

    const indexSala = salasCadastradas.findIndex(s => s.id === sala);
    if (indexSala === -1) {
        adminAlunoMessage.textContent = 'Sala não encontrada.';
        return;
    }
    
    const alunosExistentes = salasCadastradas[indexSala].alunos;
    const alunosAdicionados = novosAlunos.filter(a => !alunosExistentes.includes(a));
    
    salasCadastradas[indexSala].alunos.push(...alunosAdicionados);
    salvarSalas();
    
    adminAlunoMessage.textContent = `${alunosAdicionados.length} aluno(s) adicionado(s)!`;
    adminAlunosLista.value = '';
    
    carregarAdminDados();
    
    setTimeout(() => { adminAlunoMessage.textContent = ''; }, 2000);
}

function deletarSalaAdmin() {
    const sala = adminDeletarSala.value;
    if (!sala) {
        adminDeletarMessage.textContent = 'Selecione uma sala.';
        return;
    }
    
    if (!confirm(`Tem certeza que deseja deletar a sala ${sala}?`)) return;
    
    const indexSala = salasCadastradas.findIndex(s => s.id === sala);
    if (indexSala !== -1) {
        salasCadastradas.splice(indexSala, 1);
        salvarSalas();
        adminDeletarMessage.textContent = 'Sala deletada com sucesso!';
        carregarAdminDados();
    }
    
    setTimeout(() => { adminDeletarMessage.textContent = ''; }, 2000);
}

// ==================== FUNÇÕES DE LOGOUT ====================

function fazerLogout() {
    usuarioAtual = null;
    cargoAtual = null;
    salaAtual = null;
    
    loginScreen.classList.add('active');
    mainScreen.classList.remove('active');
    adminScreen.classList.remove('active');
    
    if (loginForm) loginForm.reset();
    if (loginError) loginError.textContent = '';
}

// ==================== FUNÇÕES DE CHAMADA ====================

function carregarDadosSala() {
    const sala = salasCadastradas.find(s => s.id === salaAtual);
    if (sala) {
        alunosAtuais = sala.alunos;
        faltasAtuais = sala.faltas || {};
        renderizarListaAlunos();
        carregarFaltas();
    }
}

function renderizarListaAlunos() {
    if (!alunosList) return;
    
    const dataAtual = dataChamada.value;
    
    alunosList.innerHTML = alunosAtuais.map(aluno => {
        const temFalta = faltasAtuais[dataAtual] && faltasAtuais[dataAtual][aluno];
        return `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;">
                <span>${aluno} ${temFalta ? '✓ Falta registrada' : ''}</span>
                <button onclick="registrarFalta('${aluno.replace(/'/g, "\\'")}')" ${temFalta ? 'disabled' : ''}>
                    Registrar Falta
                </button>
            </div>
        `;
    }).join('');
}

window.registrarFalta = function(aluno) {
    const dataAtual = dataChamada.value;
    
    if (faltasAtuais[dataAtual] && faltasAtuais[dataAtual][aluno]) {
        alert('Este aluno já possui falta registrada nesta data!');
        return;
    }
    
    if (!confirm(`Confirmar falta para o aluno ${aluno}?`)) return;
    
    if (!faltasAtuais[dataAtual]) faltasAtuais[dataAtual] = {};
    
    faltasAtuais[dataAtual][aluno] = {
        registradoPor: usuarioAtual,
        dataRegistro: new Date().toISOString()
    };
    
    // Salvar no localStorage
    const salaIndex = salasCadastradas.findIndex(s => s.id === salaAtual);
    if (salaIndex !== -1) {
        salasCadastradas[salaIndex].faltas = faltasAtuais;
        salvarSalas();
    }
    
    alert('Falta registrada com sucesso!');
    renderizarListaAlunos();
    carregarFaltas();
};

function carregarFaltas() {
    const relatorioContent = document.getElementById('relatorioContent');
    if (!relatorioContent) return;
    
    const dataAtual = dataChamada.value;
    const faltasData = faltasAtuais[dataAtual] || {};
    const faltasList = Object.entries(faltasData);
    
    if (faltasList.length === 0) {
        relatorioContent.innerHTML = '<div>Nenhuma falta registrada nesta data</div>';
        return;
    }
    
    relatorioContent.innerHTML = `
        <div style="margin-bottom:15px; padding:10px; background:#f8f9fa;">
            <p><strong>Data:</strong> ${dataAtual}</p>
            <p><strong>Total de Faltas:</strong> ${faltasList.length}</p>
        </div>
        ${faltasList.map(([aluno, info]) => `
            <div style="padding:8px; border-bottom:1px solid #ddd;">
                <strong>${aluno}</strong>
                <p><small>Registrado por: ${info.registradoPor}</small></p>
                <p><small>${new Date(info.dataRegistro).toLocaleString()}</small></p>
            </div>
        `).join('')}
    `;
}

// ==================== FUNÇÃO PRINCIPAL: ENVIAR RELATÓRIO AO ADMIN ====================

function enviarRelatorioAoAdmin() {
    const data = dataChamada.value;
    
    if (!data) {
        alert('Selecione uma data para enviar o relatório ao administrador!');
        return;
    }
    
    const faltasData = faltasAtuais[data] || {};
    const faltasList = Object.entries(faltasData).map(([aluno, info]) => ({
        aluno: aluno,
        registradoPor: info.registradoPor,
        dataRegistro: info.dataRegistro
    }));
    
    const relatorio = {
        data: data,
        enviadoPor: usuarioAtual,
        cargo: getCargoNome(cargoAtual),
        faltas: faltasList,
        dataEnvio: new Date().toISOString()
    };
    
    // Salvar relatório na sala para o admin ver
    const salaIndex = salasCadastradas.findIndex(s => s.id === salaAtual);
    if (salaIndex !== -1) {
        if (!salasCadastradas[salaIndex].relatoriosEnviados) {
            salasCadastradas[salaIndex].relatoriosEnviados = [];
        }
        salasCadastradas[salaIndex].relatoriosEnviados.push(relatorio);
        salvarSalas();
        
        alert(`✅ Relatório de faltas do dia ${data} enviado para o administrador!`);
    } else {
        alert('Erro ao enviar relatório.');
    }
}

// Inicializar
carregarDadosLocalStorage();