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

const adminSalaCurso = document.getElementById('adminSalaCurso');
const adminSalaSerie = document.getElementById('adminSalaSerie');
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

const adminRelatorioSala = document.getElementById('adminRelatorioSala');
const adminRelatorioData = document.getElementById('adminRelatorioData');
const adminVerRelatorioBtn = document.getElementById('adminVerRelatorioBtn');
const adminRelatorioContent = document.getElementById('adminRelatorioContent');
const adminSalasList = document.getElementById('adminSalasList');
const adminNotificacoes = document.getElementById('adminNotificacoes');

// Configurar data atual
if (dataChamada) dataChamada.valueAsDate = new Date();
if (adminRelatorioData) adminRelatorioData.valueAsDate = new Date();

// Eventos
if (loginForm) loginForm.addEventListener('submit', fazerLogin);
if (logoutBtn) logoutBtn.addEventListener('click', fazerLogout);
if (logoutBtnAdmin) logoutBtnAdmin.addEventListener('click', fazerLogout);
if (gerarRelatorioBtn) gerarRelatorioBtn.addEventListener('click', enviarRelatorioAoAdmin);
if (adminCriarSalaBtn) adminCriarSalaBtn.addEventListener('click', criarOuAtualizarSalaAdmin);
if (adminAdicionarAlunoBtn) adminAdicionarAlunoBtn.addEventListener('click', adicionarAlunosAdmin);
if (adminDeletarSalaBtn) adminDeletarSalaBtn.addEventListener('click', deletarSalaAdmin);
if (adminVerRelatorioBtn) adminVerRelatorioBtn.addEventListener('click', mostrarRelatorioAdmin);
if (dataChamada) dataChamada.addEventListener('change', () => {
    if (salaAtual) {
        renderizarListaAlunos();
        carregarFaltas();
    }
});

// Função para carregar notificações do admin
async function carregarNotificacoesAdmin() {
    if (!adminNotificacoes) return;
    
    try {
        const response = await fetch('/api/admin/notificacoes');
        const notificacoes = await response.json();
        
        if (notificacoes.length === 0) {
            adminNotificacoes.innerHTML = '<div class="sem-faltas">📭 Nenhum relatório recebido ainda.</div>';
            return;
        }
        
        adminNotificacoes.innerHTML = notificacoes.map(notif => `
            <div class="notificacao-card" style="border:1px solid #ddd; padding:10px; margin:10px 0; border-radius:5px; background:#f9f9f9;">
                <strong>📢 RELATÓRIO DE FALTAS</strong>
                <p><strong>Sala:</strong> ${escapeHtml(notif.sala)}</p>
                <p><strong>Data:</strong> ${escapeHtml(notif.data)}</p>
                <p><strong>Enviado por:</strong> ${escapeHtml(notif.enviadoPor)} (${escapeHtml(notif.cargo)})</p>
                <p><strong>Total de faltas:</strong> ${notif.faltas ? notif.faltas.length : 0}</p>
                <p><strong>Alunos com falta:</strong></p>
                <ul>${(notif.faltas || []).map(f => `<li>${escapeHtml(f.aluno)}</li>`).join('')}</ul>
                <p><small>Recebido em: ${new Date(notif.dataEnvio).toLocaleString('pt-BR')}</small></p>
                <button onclick="marcarNotificacaoLida('${notif._id}')" style="margin-top:5px;">✓ Marcar como lida</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar notificações:', error);
    }
}

window.marcarNotificacaoLida = async (id) => {
    try {
        await fetch('/api/admin/marcar-notificacao-lida', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        await carregarNotificacoesAdmin();
    } catch (error) {
        console.error('Erro ao marcar notificação:', error);
    }
};

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
                if (userCargoAdmin) userCargoAdmin.textContent = '👩‍💼 Gestor(a)';
                await carregarAdminDados();
                await carregarNotificacoesAdmin();
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
        'lider': '👑 Presidente',
        'vicelider': '⭐ Vice-Presidente',
        'vice': '⭐ Vice-Presidente',
        'secretario': '📝 Secretário',
        'admin': '👩‍💼 Gestor(a)',
        'adimin': '👩‍💼 Gestor(a)',
        'gestor': '👩‍💼 Gestor(a)',
        'administrador': '👩‍💼 Gestor(a)'
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
        if (adminRelatorioContent) adminRelatorioContent.innerHTML = '<div class="sem-faltas">Selecione uma sala e data para ver o relatório.</div>';
    } catch (error) {
        console.error('Erro ao carregar dados do administrador:', error);
        if (adminSalaMessage) adminSalaMessage.textContent = 'Erro ao carregar dados de administração';
    }
}

function atualizarAdminSalaSelects(salas) {
    const options = salas.map(sala => `<option value="${sala.curso}">${sala.nome} (${sala.curso})</option>`).join('');
    
    if (adminAlunoSala) adminAlunoSala.innerHTML = options;
    if (adminRelatorioSala) adminRelatorioSala.innerHTML = options;
    if (adminDeletarSala) adminDeletarSala.innerHTML = options;
}

function renderizarSalasAdmin(salas) {
    if (!adminSalasList) return;
    
    if (salas.length === 0) {
        adminSalasList.innerHTML = '<div class="sem-faltas">Nenhuma sala cadastrada.</div>';
        return;
    }

    adminSalasList.innerHTML = salas.map(sala => {
        const alunosTexto = sala.alunos && sala.alunos.length > 0
            ? sala.alunos.map(nome => `<li>${escapeHtml(nome)}</li>`).join('')
            : '<li>Nenhum aluno cadastrado</li>';

        return `
            <div class="admin-card">
                <strong>${escapeHtml(sala.nome)} (${escapeHtml(sala.curso)} - ${escapeHtml(sala.serie)})</strong>
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
    const salaCurso = adminSalaCurso ? adminSalaCurso.value.trim() : '';
    const salaSerie = adminSalaSerie ? adminSalaSerie.value.trim() : '';
    const nomeSala = adminSalaNome ? adminSalaNome.value.trim() : '';
    const lider = adminLider ? adminLider.value.trim() : '';
    const liderSenha = adminLiderSenha ? adminLiderSenha.value.trim() : '';
    const viceLider = adminViceLider ? adminViceLider.value.trim() : '';
    const viceLiderSenha = adminViceLiderSenha ? adminViceLiderSenha.value.trim() : '';
    const secretario = adminSecretario ? adminSecretario.value.trim() : '';
    const secretarioSenha = adminSecretarioSenha ? adminSecretarioSenha.value.trim() : '';
    const alunos = [];

    if (!salaCurso || !salaSerie || !nomeSala || !lider || !liderSenha || !viceLider || !viceLiderSenha || !secretario || !secretarioSenha) {
        if (adminSalaMessage) {
            adminSalaMessage.textContent = 'Preencha todos os campos obrigatórios para criar a sala.';
            adminSalaMessage.style.color = '#e74c3c';
        }
        return;
    }

    try {
        const response = await fetch('/api/admin/criar-sala', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                curso: salaCurso,
                serie: salaSerie,
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
            if (adminSalaMessage) {
                adminSalaMessage.textContent = data.error || 'Erro ao criar ou atualizar a sala.';
                adminSalaMessage.style.color = '#e74c3c';
            }
            return;
        }

        if (adminSalaMessage) {
            adminSalaMessage.textContent = 'Sala criada/atualizada com sucesso!';
            adminSalaMessage.style.color = '#27ae60';
        }
        
        // Limpar campos
        if (adminSalaCurso) adminSalaCurso.value = '';
        if (adminSalaSerie) adminSalaSerie.value = '';
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
            adminSalaMessage.textContent = 'Erro ao criar ou atualizar a sala.';
            adminSalaMessage.style.color = '#e74c3c';
        }
    }
}

async function adicionarAlunosAdmin() {
    const sala = adminAlunoSala ? adminAlunoSala.value : '';
    const alunosTexto = adminAlunosLista ? adminAlunosLista.value.trim() : '';

    if (!sala) {
        if (adminAlunoMessage) {
            adminAlunoMessage.textContent = 'Selecione uma sala.';
            adminAlunoMessage.style.color = '#e74c3c';
        }
        return;
    }

    const alunos = alunosTexto
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);

    if (alunos.length === 0) {
        if (adminAlunoMessage) {
            adminAlunoMessage.textContent = 'Digite pelo menos um nome de aluno.';
            adminAlunoMessage.style.color = '#e74c3c';
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
                adminAlunoMessage.style.color = '#e74c3c';
            }
            return;
        }

        if (adminAlunoMessage) {
            adminAlunoMessage.textContent = data.message || `${alunos.length} aluno(s) adicionado(s) com sucesso!`;
            adminAlunoMessage.style.color = '#27ae60';
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
            adminAlunoMessage.style.color = '#e74c3c';
        }
    }
}

async function deletarSalaAdmin() {
    const sala = adminDeletarSala ? adminDeletarSala.value : '';

    if (!sala) {
        if (adminDeletarMessage) {
            adminDeletarMessage.textContent = 'Selecione uma sala para deletar.';
            adminDeletarMessage.style.color = '#e74c3c';
        }
        return;
    }

    if (!confirm(`Tem certeza que deseja deletar a sala ${sala}? Esta ação não pode ser desfeita.`)) {
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
                adminDeletarMessage.style.color = '#e74c3c';
            }
            return;
        }

        if (adminDeletarMessage) {
            adminDeletarMessage.textContent = 'Sala deletada com sucesso!';
            adminDeletarMessage.style.color = '#27ae60';
        }
        
        await carregarAdminDados();
        
        setTimeout(() => {
            if (adminDeletarMessage) adminDeletarMessage.textContent = '';
        }, 3000);
        
    } catch (error) {
        console.error('Erro ao deletar sala:', error);
        if (adminDeletarMessage) {
            adminDeletarMessage.textContent = 'Erro ao deletar sala.';
            adminDeletarMessage.style.color = '#e74c3c';
        }
    }
}

// ==================== FUNÇÃO DE RELATÓRIO ADMIN ====================

async function mostrarRelatorioAdmin() {
    if (!adminRelatorioSala || !adminRelatorioData || !adminRelatorioContent) {
        console.error('Elementos do DOM não encontrados');
        return;
    }

    const sala = adminRelatorioSala.value;
    const data = adminRelatorioData.value;

    if (!sala || !data) {
        adminRelatorioContent.innerHTML = '<div class="sem-faltas">⚠️ Selecione sala e data para ver o relatório.</div>';
        return;
    }

    adminRelatorioContent.innerHTML = '<div class="sem-faltas">⏳ Carregando relatório...</div>';

    try {
        const response = await fetch('/api/admin/relatorio-faltas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sala, data })
        });

        const payload = await response.json();
        
        if (!response.ok) {
            throw new Error(payload.error || 'Erro ao buscar relatório');
        }

        if (!payload.faltas || payload.faltas.length === 0) {
            adminRelatorioContent.innerHTML = '<div class="sem-faltas">✅ Nenhuma falta registrada nesta data.</div>';
            return;
        }

        adminRelatorioContent.innerHTML = `
            <div class="relatorio-header" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <p><strong>📅 Data:</strong> ${escapeHtml(data)}</p>
                <p><strong>📊 Total de Faltas:</strong> ${payload.faltas.length}</p>
            </div>
            ${payload.faltas.map(falta => `
                <div class="falta-item">
                    <strong>📌 ${escapeHtml(falta.aluno)}</strong>
                    <p><small>👔 Registrado por: ${escapeHtml(falta.registradoPor)}</small></p>
                    <p><small>🕒 ${new Date(falta.dataRegistro).toLocaleString('pt-BR')}</small></p>
                </div>
            `).join('')}
        `;
        
    } catch (error) {
        console.error('Erro ao consultar relatório admin:', error);
        adminRelatorioContent.innerHTML = `<div class="sem-faltas">❌ Erro ao buscar relatório: ${error.message}</div>`;
    }
}

// ==================== FUNÇÕES DE LOGOUT ====================

function fazerLogout() {
    usuarioAtual = null;
    cargoAtual = null;
    salaAtual = null;
    
    if (loginScreen) loginScreen.classList.add('active');
    if (mainScreen) mainScreen.classList.remove('active');
    if (adminScreen) adminScreen.classList.remove('active');
    
    if (loginForm) loginForm.reset();
    if (loginError) loginError.textContent = '';
    if (adminSalaMessage) adminSalaMessage.textContent = '';
    if (adminAlunoMessage) adminAlunoMessage.textContent = '';
    if (adminDeletarMessage) adminDeletarMessage.textContent = '';
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
            <div class="aluno-item">
                <span class="aluno-nome">
                    ${escapeHtml(aluno)}
                    ${temFalta ? '<span class="falta-registrada">✓ Falta registrada</span>' : ''}
                </span>
                <button class="btn-falta" onclick="registrarFalta('${escapeHtml(aluno).replace(/'/g, "\\'")}')" ${temFalta ? 'disabled' : ''}>
                    ✗ Registrar Falta
                </button>
            </div>
        `;
    }).join('');
}

// Registrar falta (função global)
window.registrarFalta = async (aluno) => {
    const dataAtual = dataChamada ? dataChamada.value : new Date().toISOString().split('T')[0];
    
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

async function carregarFaltas() {
    const relatorioContent = document.getElementById('relatorioContent');
    if (!relatorioContent) return;
    
    const dataAtual = dataChamada ? dataChamada.value : new Date().toISOString().split('T')[0];
    
    const faltasData = faltasAtuais[dataAtual] || {};
    const faltasList = Object.entries(faltasData);
    
    if (faltasList.length === 0) {
        relatorioContent.innerHTML = '<div class="sem-faltas">✓ Nenhuma falta registrada nesta data</div>';
        return;
    }
    
    relatorioContent.innerHTML = `
        <div class="relatorio-header" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px;">
            <p><strong>📅 Data:</strong> ${escapeHtml(dataAtual)}</p>
            <p><strong>📊 Total de Faltas:</strong> ${faltasList.length}</p>
        </div>
        ${faltasList.map(([aluno, info]) => `
            <div class="falta-item">
                <strong>📌 ${escapeHtml(aluno)}</strong>
                <p><small>👔 Registrado por: ${escapeHtml(info.registradoPor)}</small></p>
                <p><small>🕒 Data registro: ${new Date(info.dataRegistro).toLocaleString('pt-BR')}</small></p>
            </div>
        `).join('')}
    `;
}

// ==================== FUNÇÃO PRINCIPAL: ENVIAR RELATÓRIO AO ADMIN ====================

async function enviarRelatorioAoAdmin() {
    const data = dataChamada ? dataChamada.value : null;
    
    if (!data) {
        alert('⚠️ Selecione uma data para enviar o relatório ao administrador!');
        return;
    }
    
    if (!gerarRelatorioBtn) return;
    
    try {
        gerarRelatorioBtn.textContent = '⏳ Enviando...';
        gerarRelatorioBtn.disabled = true;
        
        // Buscar faltas da data selecionada
        const responseFaltas = await fetch('/api/buscar-faltas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sala: salaAtual,
                data: data
            })
        });
        
        const faltas = await responseFaltas.json();
        
        // Enviar relatório para o administrador
        const responseEnvio = await fetch('/api/enviar-relatorio-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sala: salaAtual,
                data: data,
                enviadoPor: usuarioAtual,
                cargo: getCargoNome(cargoAtual),
                faltas: faltas
            })
        });
        
        if (!responseEnvio.ok) {
            throw new Error('Erro ao enviar relatório');
        }
        
        alert(`✅ Relatório de faltas do dia ${data} enviado para o administrador!`);
        
    } catch (error) {
        console.error('Erro ao enviar relatório:', error);
        alert('❌ Erro ao enviar relatório para o administrador');
    } finally {
        gerarRelatorioBtn.textContent = '📤 Enviar Relatório ao Admin';
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

console.log('✅ Sistema de Chamada carregado e atualizado - Relatórios vão direto ao Admin!');