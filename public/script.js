// Estado da aplicação
let usuarioAtual = null;
let salaAtual = null;
let cargoAtual = null;
let alunosAtuais = [];
let faltasAtuais = {};

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
const adminAlunosLista = document.getElementById('adminAlunosLista');
const adminCriarSalaBtn = document.getElementById('adminCriarSalaBtn');
const adminSalaMessage = document.getElementById('adminSalaMessage');

const adminAlunoSala = document.getElementById('adminAlunoSala');
const adminAlunoNome = document.getElementById('adminAlunoNome');
const adminAlunoSenha = document.getElementById('adminAlunoSenha');
const adminAdicionarAlunoBtn = document.getElementById('adminAdicionarAlunoBtn');
const adminAlunoMessage = document.getElementById('adminAlunoMessage');

const adminRelatorioSala = document.getElementById('adminRelatorioSala');
const adminRelatorioData = document.getElementById('adminRelatorioData');
const adminVerRelatorioBtn = document.getElementById('adminVerRelatorioBtn');
const adminRelatorioContent = document.getElementById('adminRelatorioContent');
const adminSalasList = document.getElementById('adminSalasList');

// Configurar data atual
dataChamada.valueAsDate = new Date();
adminRelatorioData.valueAsDate = new Date();

// Eventos
loginForm.addEventListener('submit', fazerLogin);
logoutBtn.addEventListener('click', fazerLogout);
logoutBtnAdmin.addEventListener('click', fazerLogout);
gerarRelatorioBtn.addEventListener('click', gerarRelatorioExcel);
adminCriarSalaBtn.addEventListener('click', criarOuAtualizarSalaAdmin);
adminAdicionarAlunoBtn.addEventListener('click', adicionarAlunoAdmin);
adminVerRelatorioBtn.addEventListener('click', mostrarRelatorioAdmin);

// Funções de Autenticação
async function fazerLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            usuarioAtual = data.username;
            cargoAtual = data.cargo;
            salaAtual = data.sala;

            if (isAdminCargo(cargoAtual)) {
                userNameAdmin.textContent = usuarioAtual;
                userCargoAdmin.textContent = '👩‍💼 Gestor(a)';
                await carregarAdminDados();
                loginScreen.classList.remove('active');
                adminScreen.classList.add('active');
            } else {
                userName.textContent = usuarioAtual;
                userCargo.textContent = getCargoNome(cargoAtual);
                salaTitle.textContent = data.nomeSala;
                await carregarDados();
                loginScreen.classList.remove('active');
                mainScreen.classList.add('active');
            }
        } else {
            loginError.textContent = data.message;
        }
    } catch (error) {
        console.error('Erro no login:', error);
        loginError.textContent = 'Erro ao conectar ao servidor';
    }
}

function isAdminCargo(cargo) {
    const valor = String(cargo || '').trim().toLowerCase();
    return valor === 'admin' || valor === 'adimin' || valor === 'gestor' || valor === 'administrador';
}

function getCargoNome(cargo) {
    const valor = String(cargo || '').trim().toLowerCase();
    const cargos = {
        'lider': '👑 Líder',
        'vicelider': '⭐ Vice-Líder',
        'vice': '⭐ Vice-Líder',
        'secretario': '📝 Secretário',
        'admin': '👩‍💼 Gestor(a)',
        'adimin': '👩‍💼 Gestor(a)',
        'gestor': '👩‍💼 Gestor(a)',
        'administrador': '👩‍💼 Gestor(a)'
    };
    return cargos[valor] || cargo;
}

async function carregarAdminDados() {
    try {
        const response = await fetch('/api/admin/salas');
        const salas = await response.json();
        const salasArray = Array.isArray(salas) ? salas : [];

        atualizarAdminSalaSelects(salasArray);
        renderizarSalasAdmin(salasArray);
        adminSalaMessage.textContent = '';
        adminAlunoMessage.textContent = '';
        adminRelatorioContent.innerHTML = '<div class="sem-faltas">Selecione uma sala e data para ver o relatório.</div>';
    } catch (error) {
        console.error('Erro ao carregar dados do administrador:', error);
        adminSalaMessage.textContent = 'Erro ao carregar dados de administração';
    }
}

function atualizarAdminSalaSelects(salas) {
    const options = salas.map(sala => `<option value="${sala.id}">${sala.nome} (${sala.id})</option>`).join('');
    adminAlunoSala.innerHTML = options;
    adminRelatorioSala.innerHTML = options;
}

function renderizarSalasAdmin(salas) {
    if (salas.length === 0) {
        adminSalasList.innerHTML = '<div class="sem-faltas">Nenhuma sala cadastrada.</div>';
        return;
    }

    adminSalasList.innerHTML = salas.map(sala => {
        const alunosTexto = sala.alunos && sala.alunos.length > 0
            ? sala.alunos.map(nome => `<li>${nome}</li>`).join('')
            : '<li>Nenhum aluno cadastrado</li>';

        return `
            <div class="admin-card">
                <strong>${sala.nome} (${sala.id})</strong>
                <p>Presidente: ${sala.lider}</p>
                <p>Vice-Presidente: ${sala.viceLider}</p>
                <p>Secretário: ${sala.secretario}</p>
                <p><strong>Alunos:</strong></p>
                <ul>${alunosTexto}</ul>
            </div>
        `;
    }).join('');
}

async function criarOuAtualizarSalaAdmin() {
    const salaId = adminSalaId.value.trim();
    const nomeSala = adminSalaNome.value.trim();
    const lider = adminLider.value.trim();
    const liderSenha = adminLiderSenha.value.trim();
    const viceLider = adminViceLider.value.trim();
    const viceLiderSenha = adminViceLiderSenha.value.trim();
    const secretario = adminSecretario.value.trim();
    const secretarioSenha = adminSecretarioSenha.value.trim();
    const alunos = adminAlunosLista.value
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);

    if (!salaId || !nomeSala || !lider || !liderSenha || !viceLider || !viceLiderSenha || !secretario || !secretarioSenha) {
        adminSalaMessage.textContent = 'Preencha todos os campos obrigatórios para criar a sala.';
        return;
    }

    try {
        const response = await fetch('/api/admin/criar-sala', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: salaId,
                nome: nomeSala,
                lider,
                liderSenha,
                viceLider,
                viceLiderSenha,
                secretario,
                secretarioSenha,
                alunos
            })
        });

        const data = await response.json();

        if (!response.ok) {
            adminSalaMessage.textContent = data.error || 'Erro ao criar ou atualizar a sala.';
            return;
        }

        adminSalaMessage.textContent = 'Sala criada/atualizada com sucesso!';
        adminSalaMessage.style.color = '#27ae60';
        await carregarAdminDados();
    } catch (error) {
        console.error('Erro ao criar sala:', error);
        adminSalaMessage.textContent = 'Erro ao criar ou atualizar a sala.';
        adminSalaMessage.style.color = '#e74c3c';
    }
}

async function adicionarAlunoAdmin() {
    const sala = adminAlunoSala.value;
    const alunoNome = adminAlunoNome.value.trim();
    const alunoSenha = adminAlunoSenha.value.trim();

    if (!sala || !alunoNome || !alunoSenha) {
        adminAlunoMessage.textContent = 'Preencha a sala, nome e senha do aluno.';
        return;
    }

    try {
        const response = await fetch('/api/admin/adicionar-aluno', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sala, username: alunoNome, senha: alunoSenha })
        });

        const data = await response.json();
        if (!response.ok) {
            adminAlunoMessage.textContent = data.error || 'Erro ao adicionar aluno.';
            return;
        }

        adminAlunoMessage.textContent = 'Aluno adicionado com sucesso!';
        adminAlunoMessage.style.color = '#27ae60';
        adminAlunoNome.value = '';
        adminAlunoSenha.value = '';
        await carregarAdminDados();
    } catch (error) {
        console.error('Erro ao adicionar aluno:', error);
        adminAlunoMessage.textContent = 'Erro ao adicionar aluno.';
        adminAlunoMessage.style.color = '#e74c3c';
    }
}

async function mostrarRelatorioAdmin() {
    const sala = adminRelatorioSala.value;
    const data = adminRelatorioData.value;

    if (!sala || !data) {
        adminRelatorioContent.innerHTML = '<div class="sem-faltas">Selecione sala e data para ver o relatório.</div>';
        return;
    }

    try {
        const response = await fetch('/api/admin/relatorio-faltas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sala, data })
        });

        const payload = await response.json();
        if (!response.ok) {
            adminRelatorioContent.innerHTML = `<div class="sem-faltas">${payload.error || 'Erro ao buscar relatório.'}</div>`;
            return;
        }

        if (!Array.isArray(payload.faltas) || payload.faltas.length === 0) {
            adminRelatorioContent.innerHTML = '<div class="sem-faltas">Nenhuma falta registrada nesta data.</div>';
            return;
        }

        adminRelatorioContent.innerHTML = payload.faltas.map(falta => `
            <div class="falta-item">
                <strong>📌 ${falta.aluno}</strong>
                <p><small>👔 Registrado por: ${falta.registradoPor}</small></p>
                <p><small>🕒 ${new Date(falta.dataRegistro).toLocaleString('pt-BR')}</small></p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao consultar relatório admin:', error);
        adminRelatorioContent.innerHTML = '<div class="sem-faltas">Erro ao buscar relatório.</div>';
    }
}

function fazerLogout() {
    usuarioAtual = null;
    cargoAtual = null;
    salaAtual = null;
    loginScreen.classList.add('active');
    mainScreen.classList.remove('active');
    adminScreen.classList.remove('active');
    loginForm.reset();
    loginError.textContent = '';
    adminSalaMessage.textContent = '';
    adminAlunoMessage.textContent = '';
}

// Carregar dados da sala
async function carregarDados() {
    try {
        const response = await fetch('/api/carregar-chamada', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sala: salaAtual })
        });
        
        const data = await response.json();
        alunosAtuais = data.alunos;
        faltasAtuais = data.faltas;
        
        renderizarListaAlunos();
        carregarFaltas();
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao carregar dados');
    }
}

// Renderizar lista de alunos
function renderizarListaAlunos() {
    const dataAtual = dataChamada.value;
    
    alunosList.innerHTML = alunosAtuais.map(aluno => {
        const temFalta = faltasAtuais[dataAtual] && faltasAtuais[dataAtual][aluno];
        
        return `
            <div class="aluno-item">
                <span class="aluno-nome">
                    ${aluno}
                    ${temFalta ? '<span class="falta-registrada">✓ Falta registrada</span>' : ''}
                </span>
                <button class="btn-falta" onclick="registrarFalta('${aluno}')" ${temFalta ? 'disabled' : ''}>
                    ✗ Registrar Falta
                </button>
            </div>
        `;
    }).join('');
}

// Registrar falta
window.registrarFalta = async (aluno) => {
    const dataAtual = dataChamada.value;
    
    if (faltasAtuais[dataAtual] && faltasAtuais[dataAtual][aluno]) {
        alert('⚠️ Este aluno já possui falta registrada nesta data!');
        return;
    }
    
    if (!confirm(`Confirmar falta para o aluno ${aluno}?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/registrar-falta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sala: salaAtual,
                aluno: aluno,
                data: dataAtual,
                registradoPor: usuarioAtual
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erro ao registrar falta');
        }
        
        const result = await response.json();
        
        if (result.success) {
            if (!faltasAtuais[dataAtual]) {
                faltasAtuais[dataAtual] = {};
            }
            faltasAtuais[dataAtual][aluno] = {
                registradoPor: usuarioAtual,
                dataRegistro: new Date().toISOString()
            };
            
            alert('✅ Falta registrada com sucesso!');
            renderizarListaAlunos();
            carregarFaltas();
        }
    } catch (error) {
        console.error('Erro ao registrar falta:', error);
        alert('❌ ' + error.message);
    }
};

// Carregar e exibir faltas
async function carregarFaltas() {
    const dataAtual = dataChamada.value;
    const relatorioContent = document.getElementById('relatorioContent');
    
    const faltasData = faltasAtuais[dataAtual] || {};
    const faltasList = Object.entries(faltasData);
    
    if (faltasList.length === 0) {
        relatorioContent.innerHTML = '<div class="sem-faltas">✓ Nenhuma falta registrada nesta data</div>';
        return;
    }
    
    relatorioContent.innerHTML = `
        <div class="relatorio-header" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
            <p><strong>📅 Data:</strong> ${dataAtual}</p>
            <p><strong>📊 Total de Faltas:</strong> ${faltasList.length}</p>
        </div>
        ${faltasList.map(([aluno, info]) => `
            <div class="falta-item">
                <strong>📌 ${aluno}</strong>
                <p><small>👔 Registrado por: ${info.registradoPor}</small></p>
                <p><small>🕒 Data registro: ${new Date(info.dataRegistro).toLocaleString('pt-BR')}</small></p>
            </div>
        `).join('')}
    `;
}

// Gerar relatório em Excel
async function gerarRelatorioExcel() {
    const data = dataChamada.value;
    
    if (!data) {
        alert('⚠️ Selecione uma data para gerar o relatório!');
        return;
    }
    
    try {
        gerarRelatorioBtn.textContent = '⏳ Gerando...';
        gerarRelatorioBtn.disabled = true;
        
        const response = await fetch('/api/gerar-relatorio-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sala: salaAtual,
                data: data
            })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao gerar relatório');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_faltas_${salaAtual}_${data}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('✅ Relatório Excel gerado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao gerar relatório Excel:', error);
        alert('❌ Erro ao gerar relatório Excel');
    } finally {
        gerarRelatorioBtn.textContent = '📊 Gerar Relatório Excel';
        gerarRelatorioBtn.disabled = false;
    }
}

// Atualizar ao mudar a data
dataChamada.addEventListener('change', () => {
    if (salaAtual) {
        renderizarListaAlunos();
        carregarFaltas();
    }
});

console.log('✅ Sistema de Chamada carregado!');