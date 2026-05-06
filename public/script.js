// Estado da aplicação
let usuarioAtual = null;
let salaAtual = null;
let cargoAtual = null;
let alunosAtuais = [];
let faltasAtuais = {};

// Elementos DOM
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const alunosList = document.getElementById('alunosList');
const salaTitle = document.getElementById('salaTitle');
const userName = document.getElementById('userName');
const userCargo = document.getElementById('userCargo');
const visualizarRelatorioBtn = document.getElementById('visualizarRelatorioBtn');
const gerarRelatorioBtn = document.getElementById('gerarRelatorioBtn');
const dataChamada = document.getElementById('dataChamada');
const loginError = document.getElementById('loginError');

// Configurar data atual
dataChamada.valueAsDate = new Date();

// Eventos
loginForm.addEventListener('submit', fazerLogin);
logoutBtn.addEventListener('click', fazerLogout);
visualizarRelatorioBtn.addEventListener('click', visualizarRelatorioTabela);
gerarRelatorioBtn.addEventListener('click', gerarRelatorioExcel);

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
            
            userName.textContent = usuarioAtual;
            userCargo.textContent = getCargoNome(data.cargo);
            salaTitle.textContent = data.nomeSala;
            
            await carregarDados();
            
            loginScreen.classList.remove('active');
            mainScreen.classList.add('active');
        } else {
            loginError.textContent = data.message;
        }
    } catch (error) {
        console.error('Erro no login:', error);
        loginError.textContent = 'Erro ao conectar ao servidor';
    }
}

function getCargoNome(cargo) {
    const cargos = {
        'lider': '👑 Líder',
        'viceLider': '⭐ Vice-Líder',
        'secretario': '📝 Secretário'
    };
    return cargos[cargo] || cargo;
}

function fazerLogout() {
    usuarioAtual = null;
    cargoAtual = null;
    salaAtual = null;
    loginScreen.classList.add('active');
    mainScreen.classList.remove('active');
    loginForm.reset();
    loginError.textContent = '';
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

// Visualizar relatório em tabela (mobile-friendly)
async function visualizarRelatorioTabela() {
    const data = dataChamada.value;
    
    if (!data) {
        alert('⚠️ Selecione uma data para visualizar o relatório!');
        return;
    }
    
    try {
        visualizarRelatorioBtn.textContent = '⏳ Carregando...';
        visualizarRelatorioBtn.disabled = true;
        
        const response = await fetch('/api/relatorio-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sala: salaAtual,
                data: data
            })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar relatório');
        }
        
        const relatorio = await response.json();
        
        let html = `
            <div style="padding: 15px; background: #f8f9fa; border-radius: 10px; margin-bottom: 20px;">
                <h4 style="color: #667eea; margin-bottom: 10px;">📊 Relatório de Faltas</h4>
                <p><strong>Sala:</strong> ${relatorio.sala}</p>
                <p><strong>Data:</strong> ${new Date(relatorio.data).toLocaleDateString('pt-BR')}</p>
                <p><strong>Total de faltas:</strong> <span style="color: #e74c3c; font-weight: 600;">${relatorio.totalFaltas}</span></p>
            </div>
        `;
        
        if (relatorio.totalFaltas === 0) {
            html += '<div class="sem-faltas">✅ Nenhuma falta registrada nesta data</div>';
        } else {
            html += '<table class="relatorio-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">';
            html += '<thead><tr style="background: #667eea; color: white;"><th style="padding: 10px; text-align: left;">Aluno</th><th style="padding: 10px; text-align: left;">Registrado Por</th><th style="padding: 10px; text-align: left;">Data/Hora</th></tr></thead><tbody>';
            
            relatorio.faltas.forEach(falta => {
                html += `
                    <tr style="border-bottom: 1px solid #ddd;">
                        <td style="padding: 10px;">${falta.aluno}</td>
                        <td style="padding: 10px;">${falta.registradoPor}</td>
                        <td style="padding: 10px; font-size: 12px;">${falta.dataRegistro}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
        }
        
        document.getElementById('relatorioContent').innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao visualizar relatório:', error);
        alert('❌ Erro ao visualizar relatório');
    } finally {
        visualizarRelatorioBtn.textContent = '👁️ Visualizar';
        visualizarRelatorioBtn.disabled = false;
    }
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