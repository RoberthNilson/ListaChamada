// Estado da aplicação
let usuarioAtual = null;
let salaAtual = null;
let cargoAtual = null;
let alunosAtuais = [];
let faltasAtuais = {};
let ws = null;

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
                if (userNameAdmin) userNameAdmin.textContent = usuarioAtual;
                if (userCargoAdmin) userCargoAdmin.textContent = 'Gestor(a)';
                await carregarAdminDados();
                conectarWebSocketAdmin();
                loginScreen.classList.remove('active');
                adminScreen.classList.add('active');
            } else {
                if (userName) userName.textContent = usuarioAtual;
                if (userCargo) userCargo.textContent = getCargoNome(cargoAtual);
                if (salaTitle) salaTitle.textContent = data.nomeSala;
                await carregarDados();
                loginScreen.classList.remove('active');
                mainScreen.classList.add('active');
            }
        } else {
            if (loginError) loginError.textContent = data.message;
        }
    } catch (error) {
        console.error('Erro no login:', error);
        if (loginError) loginError.textContent = 'Erro ao conectar ao servidor';
    }
}

function isAdminCargo(cargo) {
    const valor = String(cargo || '').trim().toLowerCase();
    return valor === 'admin' || valor === 'adimin' || valor === 'gestor' || valor === 'administrador';
}

function getCargoNome(cargo) {
    const valor = String(cargo || '').trim().toLowerCase();
    const cargos = {
        'lider': 'Presidente',
        'vicelider': 'Vice-Presidente',
        'vice': 'Vice-Presidente',
        'secretario': 'Secretário',
        'admin': 'Gestor(a)',
        'adimin': 'Gestor(a)',
        'gestor': 'Gestor(a)',
        'administrador': 'Gestor(a)'
    };
    return cargos[valor] || cargo;
}

// ==================== FUNÇÕES ADMIN ====================

async function carregarAdminDados() {
    try {
        const response = await fetch('/api/admin/salas');
        const salas = await response.json();
        const salasArray = Array.isArray(salas) ? salas : [];

        atualizarAdminSalaSelects(salasArray);
        renderizarSalasAdmin(salasArray);
        
        if (adminSalaMessage) adminSalaMessage.textContent = '';
        if (adminAlunoMessage) adminAlunoMessage.textContent = '';
        
        // Carregar notificações pendentes
        await carregarNotificacoesPendentes();
        
    } catch (error) {
        console.error('Erro ao carregar dados do administrador:', error);
        if (adminSalaMessage) adminSalaMessage.textContent = 'Erro ao carregar dados de administração';
    }
}

async function carregarNotificacoesPendentes() {
    try {
        const response = await fetch('/api/admin/notificacoes');
        const notificacoes = await response.json();
        
        if (notificacoes.length > 0 && adminNotificacoes) {
            notificacoes.forEach(notif => {
                mostrarNotificacaoAdmin(notif);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar notificações:', error);
    }
}

function conectarWebSocketAdmin() {
    const protocolo = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocolo}//${host}`);
    
    ws.onopen = () => {
        console.log('WebSocket conectado como admin');
        ws.send(JSON.stringify({ tipo: 'admin_conectado' }));
    };
    
    ws.onmessage = (event) => {
        const dados = JSON.parse(event.data);
        if (dados.tipo === 'relatorio_faltas') {
            mostrarNotificacaoAdmin(dados);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function mostrarNotificacaoAdmin(relatorio) {
    if (!adminNotificacoes) return;
    
    const faltasHtml = relatorio.faltas && relatorio.faltas.length > 0
        ? relatorio.faltas.map(f => `<li>${escapeHtml(f.aluno)}</li>`).join('')
        : '<li>Nenhuma falta registrada nesta data</li>';
    
    const notifDiv = document.createElement('div');
    notifDiv.className = 'notificacao';
    notifDiv.style.border = '1px solid #ccc';
    notifDiv.style.padding = '10px';
    notifDiv.style.margin = '10px 0';
    notifDiv.style.borderRadius = '5px';
    notifDiv.style.backgroundColor = '#f9f9f9';
    notifDiv.innerHTML = `
        <strong>📢 NOVO RELATÓRIO RECEBIDO!</strong>
        <p><strong>Sala:</strong> ${escapeHtml(relatorio.sala)}</p>
        <p><strong>Data:</strong> ${escapeHtml(relatorio.data)}</p>
        <p><strong>Enviado por:</strong> ${escapeHtml(relatorio.enviadoPor)} (${escapeHtml(relatorio.cargo)})</p>
        <p><strong>Total de faltas:</strong> ${relatorio.faltas ? relatorio.faltas.length : 0}</p>
        <p><strong>Alunos com falta:</strong></p>
        <ul>${faltasHtml}</ul>
        <button onclick="marcarNotificacaoComoLida(this, '${relatorio.id || ''}')">✓ Marcar como lida</button>
        <hr>
    `;
    
    adminNotificacoes.insertBefore(notifDiv, adminNotificacoes.firstChild);
}

window.marcarNotificacaoComoLida = async (botao, notificacaoId) => {
    if (notificacaoId) {
        await fetch('/api/admin/marcar-notificacao-lida', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: notificacaoId })
        });
    }
    botao.parentElement.remove();
};

function atualizarAdminSalaSelects(salas) {
    const options = salas.map(sala => `<option value="${sala.id}">${sala.nome} (${sala.id})</option>`).join('');
    
    if (adminAlunoSala) adminAlunoSala.innerHTML = options;
    if (adminDeletarSala) adminDeletarSala.innerHTML = options;
}

function renderizarSalasAdmin(salas) {
    if (!adminSalasList) return;
    
    if (salas.length === 0) {
        adminSalasList.innerHTML = '<div>Nenhuma sala cadastrada.</div>';
        return;
    }

    adminSalasList.innerHTML = salas.map(sala => {
        const alunosTexto = sala.alunos && sala.alunos.length > 0
            ? sala.alunos.map(nome => `<li>${escapeHtml(nome)}</li>`).join('')
            : '<li>Nenhum aluno cadastrado</li>';

        return `
            <div style="border:1px solid #ddd; padding:10px; margin:10px 0; border-radius:5px;">
                <strong>${escapeHtml(sala.nome)} (${escapeHtml(sala.id)})</strong>
                <p>Presidente: ${escapeHtml(sala.lider)}</p>
                <p>Vice-Presidente: ${escapeHtml(sala.viceLider)}</p>
                <p>Secretário: ${escapeHtml(sala.secretario)}</p>
                <p><strong>Alunos:</strong></p>
                <ul>${alunosTexto}</ul>
            </div>
        `;
    }).join('');
}

async function criarOuAtualizarSalaAdmin() {
    const salaId = adminSalaId ? adminSalaId.value.trim() : '';
    const nomeSala = adminSalaNome ? adminSalaNome.value.trim() : '';
    const lider = adminLider ? adminLider.value.trim() : '';
    const liderSenha = adminLiderSenha ? adminLiderSenha.value.trim() : '';
    const viceLider = adminViceLider ? adminViceLider.value.trim() : '';
    const viceLiderSenha = adminViceLiderSenha ? adminViceLiderSenha.value.trim() : '';
    const secretario = adminSecretario ? adminSecretario.value.trim() : '';
    const secretarioSenha = adminSecretarioSenha ? adminSecretarioSenha.value.trim() : '';

    if (!salaId || !nomeSala || !lider || !liderSenha || !viceLider || !viceLiderSenha || !secretario || !secretarioSenha) {
        if (adminSalaMessage) {
            adminSalaMessage.textContent = 'Preencha todos os campos obrigatórios.';
        }
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
                alunos: []
            })
        });

        const data = await response.json();

        if (!response.ok) {
            if (adminSalaMessage) {
                adminSalaMessage.textContent = data.error || 'Erro ao criar sala.';
            }
            return;
        }

        if (adminSalaMessage) {
            adminSalaMessage.textContent = 'Sala criada/atualizada com sucesso!';
        }
        
        // Limpar campos
        if (adminSalaId) adminSalaId.value = '';
        if (adminSalaNome) adminSalaNome.value = '';
        if (adminLider) adminLider.value = '';
        if (adminLiderSenha) adminLiderSenha.value = '';
        if (adminViceLider) adminViceLider.value = '';
        if (adminViceLiderSenha) adminViceLiderSenha.value = '';
        if (adminSecretario) adminSecretario.value = '';
        if (adminSecretarioSenha) adminSecretarioSenha.value = '';
        
        await carregarAdminDados();
        
        setTimeout(() => {
            if (adminSalaMessage) adminSalaMessage.textContent = '';
        }, 3000);
        
    } catch (error) {
        console.error('Erro ao criar sala:', error);
        if (adminSalaMessage) {
            adminSalaMessage.textContent = 'Erro ao criar sala.';
        }
    }
}

async function adicionarAlunosAdmin() {
    const sala = adminAlunoSala ? adminAlunoSala.value : '';
    const alunosTexto = adminAlunosLista ? adminAlunosLista.value.trim() : '';

    if (!sala) {
        if (adminAlunoMessage) {
            adminAlunoMessage.textContent = 'Selecione uma sala.';
        }
        return;
    }

    const alunos = alunosTexto.split(/\r?\n/).map(item => item.trim()).filter(Boolean);

    if (alunos.length === 0) {
        if (adminAlunoMessage) {
            adminAlunoMessage.textContent = 'Digite pelo menos um nome de aluno.';
        }
        return;
    }

    try {
        const response = await fetch('/api/admin/adicionar-alunos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sala, alunos })
        });

        const data = await response.json();
        if (!response.ok) {
            if (adminAlunoMessage) {
                adminAlunoMessage.textContent = data.error || 'Erro ao adicionar alunos.';
            }
            return;
        }

        if (adminAlunoMessage) {
            adminAlunoMessage.textContent = data.message || `${alunos.length} aluno(s) adicionado(s) com sucesso!`;
        }
        
        if (adminAlunosLista) adminAlunosLista.value = '';
        await carregarAdminDados();
        
        setTimeout(() => {
            if (adminAlunoMessage) adminAlunoMessage.textContent = '';
        }, 3000);
        
    } catch (error) {
        console.error('Erro ao adicionar alunos:', error);
        if (adminAlunoMessage) {
            adminAlunoMessage.textContent = 'Erro ao adicionar alunos.';
        }
    }
}

async function deletarSalaAdmin() {
    const sala = adminDeletarSala ? adminDeletarSala.value : '';

    if (!sala) {
        if (adminDeletarMessage) {
            adminDeletarMessage.textContent = 'Selecione uma sala para deletar.';
        }
        return;
    }

    if (!confirm(`Tem certeza que deseja deletar a sala ${sala}?`)) {
        return;
    }

    try {
        const response = await fetch('/api/admin/deletar-sala', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sala })
        });

        const data = await response.json();
        if (!response.ok) {
            if (adminDeletarMessage) {
                adminDeletarMessage.textContent = data.error || 'Erro ao deletar sala.';
            }
            return;
        }

        if (adminDeletarMessage) {
            adminDeletarMessage.textContent = 'Sala deletada com sucesso!';
        }
        
        await carregarAdminDados();
        
        setTimeout(() => {
            if (adminDeletarMessage) adminDeletarMessage.textContent = '';
        }, 3000);
        
    } catch (error) {
        console.error('Erro ao deletar sala:', error);
        if (adminDeletarMessage) {
            adminDeletarMessage.textContent = 'Erro ao deletar sala.';
        }
    }
}

// ==================== FUNÇÕES DE LOGOUT ====================

function fazerLogout() {
    if (ws) {
        ws.close();
        ws = null;
    }
    
    usuarioAtual = null;
    cargoAtual = null;
    salaAtual = null;
    
    if (loginScreen) loginScreen.classList.add('active');
    if (mainScreen) mainScreen.classList.remove('active');
    if (adminScreen) adminScreen.classList.remove('active');
    
    if (loginForm) loginForm.reset();
    if (loginError) loginError.textContent = '';
}

// ==================== FUNÇÕES DE CHAMADA ====================

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

function renderizarListaAlunos() {
    if (!alunosList) return;
    
    const dataAtual = dataChamada ? dataChamada.value : new Date().toISOString().split('T')[0];
    
    alunosList.innerHTML = alunosAtuais.map(aluno => {
        const temFalta = faltasAtuais[dataAtual] && faltasAtuais[dataAtual][aluno];
        
        return `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;">
                <span>${escapeHtml(aluno)} ${temFalta ? '✓ Falta registrada' : ''}</span>
                <button onclick="registrarFalta('${escapeHtml(aluno).replace(/'/g, "\\'")}')" ${temFalta ? 'disabled' : ''}>
                    Registrar Falta
                </button>
            </div>
        `;
    }).join('');
}

window.registrarFalta = async (aluno) => {
    const dataAtual = dataChamada ? dataChamada.value : new Date().toISOString().split('T')[0];
    
    if (faltasAtuais[dataAtual] && faltasAtuais[dataAtual][aluno]) {
        alert('Este aluno já possui falta registrada nesta data!');
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
            
            alert('Falta registrada com sucesso!');
            renderizarListaAlunos();
            carregarFaltas();
        }
    } catch (error) {
        console.error('Erro ao registrar falta:', error);
        alert(error.message);
    }
};

async function carregarFaltas() {
    const relatorioContent = document.getElementById('relatorioContent');
    if (!relatorioContent) return;
    
    const dataAtual = dataChamada ? dataChamada.value : new Date().toISOString().split('T')[0];
    
    const faltasData = faltasAtuais[dataAtual] || {};
    const faltasList = Object.entries(faltasData);
    
    if (faltasList.length === 0) {
        relatorioContent.innerHTML = '<div>Nenhuma falta registrada nesta data</div>';
        return;
    }
    
    relatorioContent.innerHTML = `
        <div style="margin-bottom:15px; padding:10px; background:#f8f9fa;">
            <p><strong>Data:</strong> ${escapeHtml(dataAtual)}</p>
            <p><strong>Total de Faltas:</strong> ${faltasList.length}</p>
        </div>
        ${faltasList.map(([aluno, info]) => `
            <div style="padding:8px; border-bottom:1px solid #ddd;">
                <strong>${escapeHtml(aluno)}</strong>
                <p><small>Registrado por: ${escapeHtml(info.registradoPor)}</small></p>
                <p><small>${new Date(info.dataRegistro).toLocaleString('pt-BR')}</small></p>
            </div>
        `).join('')}
    `;
}

// ==================== FUNÇÃO PRINCIPAL: ENVIAR RELATÓRIO AO ADMIN ====================

async function enviarRelatorioAoAdmin() {
    const data = dataChamada ? dataChamada.value : null;
    
    if (!data) {
        alert('Selecione uma data para enviar o relatório ao administrador!');
        return;
    }
    
    if (!gerarRelatorioBtn) return;
    
    try {
        gerarRelatorioBtn.textContent = 'Enviando...';
        gerarRelatorioBtn.disabled = true;
        
        // Buscar faltas da data selecionada
        const response = await fetch('/api/buscar-faltas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sala: salaAtual,
                data: data
            })
        });
        
        const faltas = await response.json();
        
        // Tentar enviar via WebSocket primeiro
        let enviado = false;
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                tipo: 'relatorio_faltas',
                sala: salaAtual,
                data: data,
                enviadoPor: usuarioAtual,
                cargo: cargoAtual,
                faltas: faltas
            }));
            enviado = true;
        }
        
        // Fallback: salvar no banco
        if (!enviado) {
            await fetch('/api/enviar-relatorio-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sala: salaAtual,
                    data: data,
                    enviadoPor: usuarioAtual,
                    cargo: cargoAtual,
                    faltas: faltas
                })
            });
        }
        
        alert(`✅ Relatório de faltas do dia ${data} enviado para o administrador!`);
        
    } catch (error) {
        console.error('Erro ao enviar relatório:', error);
        alert('Erro ao enviar relatório para o administrador');
    } finally {
        gerarRelatorioBtn.textContent = 'Enviar Relatório ao Admin';
        gerarRelatorioBtn.disabled = false;
    }
}

// ==================== FUNÇÃO AUXILIAR ====================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('Sistema de Chamada carregado com envio ao admin!');