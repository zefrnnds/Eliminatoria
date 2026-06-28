/**
 * 🏆 Bolão da Copa 2026 - Script Principal
 * Sistema de palpites com Google Apps Script API
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ===== CONFIGURAÇÃO =====
    const API_BASE = 'https://script.google.com/macros/s/AKfycby62NI1pid2BY6Y61RjFfYf3T-hJxNe9sKd86gaJ8aqhMTzsaFYvvWWwbHWIgsllroU/exec';
    
    // ===== ELEMENTOS DO DOM =====
    const contentEl = document.getElementById('content');
    const btnRanking = document.getElementById('btn-ranking');
    const btnJogos = document.getElementById('btn-jogos');
    const btnPalpites = document.getElementById('btn-palpites');
    const btnElim = document.getElementById('btn-elim');
    const btnPalpitesElim = document.getElementById('btn-palpites-elim');
    const btnRefresh = document.getElementById('btn-refresh');
    const filterContainer = document.getElementById('filter-container');
    const selectParticipant = document.getElementById('select-participant');
    const selectGroup = document.getElementById('select-group');
    
    // ===== ESTADO DA APLICAÇÃO =====
    let currentView = null;
    let resultadosCache = {};
    let palpitesData = {};
    let placarGeralCache = null;
    let carregandoEmBackground = false;
    const carregandoAgora = {};
    const falhasCarregamento = {};

    // ===== MAPEAMENTO DE PARTICIPANTES =====
    const participantesMap = {
        'Robson': 'ROBSON',
        'AJR': 'JUNIOR (JR)',
        'GJR': 'JUNINHO',
        'MARC': 'MARCELLA',
        'ANA': 'PAULA',
        'PEDR': 'PEDRO',
        'RODR': 'RODRIGO',
        'GREI': 'GREISON',
        'ROG': 'ROGERIO',
        'ROM': 'ROMULO',
        'REGINALDINHO': 'REGINALDINHO',
        'RICARDINHO': 'RICARDINHO',
        'REGINALDO': 'REGINALDO'
    };

    const nomeParaChave = {};
    Object.entries(participantesMap).forEach(([chave, nome]) => {
        nomeParaChave[nome] = chave;
        nomeParaChave[nome.replace(/\s*\(.*\)\s*/g, '').trim()] = chave;
        nomeParaChave[chave.toUpperCase()] = chave;
        nomeParaChave[chave] = chave;
    });

    // ===== UTILITÁRIOS DE UI =====
    const showLoading = (msg = '⏳ Carregando dados... 🏟️') => {
        if (contentEl) contentEl.innerHTML = `<p class="loading">${msg}</p>`;
    };

    const showError = (msg) => {
        if (contentEl) contentEl.innerHTML = `<p class="error">❌ ${msg}</p>`;
    };

    // ===== NORMALIZAÇÃO DE DADOS =====
    function normalizarDados(dados, nomeAba) {
        if (!dados || dados.length === 0) return dados;
        const primeiraLinha = dados[0];
        const colunas = Object.keys(primeiraLinha);
        let colunaData = null;
        
        if (colunas.includes('DATA_HORA')) {
            colunaData = 'DATA_HORA';
        } else if (colunas.includes(nomeAba)) {
            colunaData = nomeAba;
        } else {
            for (const col of colunas) {
                const valor = primeiraLinha[col];
                if (valor && typeof valor === 'string') {
                    if (valor.includes('GRUPO') || /\d{2}\/\d{2}\/\d{4}/.test(valor) || col.toLowerCase().includes('data')) {
                        colunaData = col;
                        break;
                    }
                }
            }
        }
        if (colunaData && colunaData !== 'DATA_HORA') {
            dados = dados.map(row => {
                const newRow = {...row};
                newRow['DATA_HORA'] = newRow[colunaData];
                if (colunaData !== 'DATA_HORA') delete newRow[colunaData];
                return newRow;
            });
        }
        return dados;
    }

    // ===== FETCH COM RETRY E CACHE =====
    async function fetchData(sheetName, tentativas = 2) {
        const cacheKey = `cache_${sheetName}`, cacheTimeKey = `cache_time_${sheetName}`;
        const cacheExpira = 2 * 60 * 60 * 1000;
        try {
            const cachedData = localStorage.getItem(cacheKey), cachedTime = localStorage.getItem(cacheTimeKey);
            if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime)) < cacheExpira) return JSON.parse(cachedData);
        } catch (e) {}
        for (let i = 0; i < tentativas; i++) {
            try {
                const url = `${API_BASE}?sheet=${encodeURIComponent(sheetName)}`, res = await fetch(url);
                if (res.status === 429) {
                    const cachedData = localStorage.getItem(cacheKey);
                    if (cachedData) return JSON.parse(cachedData);
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                if (!res.ok) { if (i < tentativas - 1) { await new Promise(r => setTimeout(r, 1000)); continue; } return null; }
                const data = await res.json();
                try { localStorage.setItem(cacheKey, JSON.stringify(data)); localStorage.setItem(cacheTimeKey, Date.now().toString()); } catch (e) {}
                return data;
            } catch (err) { if (i < tentativas - 1) await new Promise(r => setTimeout(r, 1000)); }
        }
        try { const cachedData = localStorage.getItem(cacheKey); if (cachedData) return JSON.parse(cachedData); } catch (e) {}
        return null;
    }

    // ===== JOGOS DA FASE DE GRUPOS =====
    const todosJogos = {
        'A': [
            { data: '11/06/2026 - 16:00', casa: 'México', fora: 'África do Sul' },
            { data: '11/06/2026 - 23:00', casa: 'Coréia do Sul', fora: 'República Tcheca' },
            { data: '18/06/2026 - 13:00', casa: 'República Tcheca', fora: 'África do Sul' },
            { data: '18/06/2026 - 22:00', casa: 'México', fora: 'Coréia do Sul' },
            { data: '24/06/2026 - 22:00', casa: 'República Tcheca', fora: 'México' },
            { data: '24/06/2026 - 22:00', casa: 'África do Sul', fora: 'Coréia do Sul' }
        ],
        'B': [
            { data: '12/06/2026 - 16:00', casa: 'Canadá', fora: 'Bósnia e Herzegovina' },
            { data: '13/06/2026 - 16:00', casa: 'Catar', fora: 'Suíça' },
            { data: '18/06/2026 - 16:00', casa: 'Suíça', fora: 'Bósnia e Herzegovina' },
            { data: '18/06/2026 - 19:00', casa: 'Canadá', fora: 'Catar' },
            { data: '24/06/2026 - 16:00', casa: 'Suíça', fora: 'Canadá' },
            { data: '24/06/2026 - 16:00', casa: 'Bósnia e Herzegovina', fora: 'Catar' }
        ],
        'C': [
            { data: '13/06/2026 - 19:00', casa: 'Brasil', fora: 'Marrocos' },
            { data: '13/06/2026 - 22:00', casa: 'Haiti', fora: 'Escócia' },
            { data: '19/06/2026 - 19:00', casa: 'Escócia', fora: 'Marrocos' },
            { data: '19/06/2026 - 22:00', casa: 'Brasil', fora: 'Haiti' },
            { data: '24/06/2026 - 19:00', casa: 'Escócia', fora: 'Brasil' },
            { data: '24/06/2026 - 19:00', casa: 'Marrocos', fora: 'Haiti' }
        ],
        'D': [
            { data: '12/06/2026 - 22:00', casa: 'Estados Unidos', fora: 'Paraguai' },
            { data: '14/06/2026 - 01:00', casa: 'Austrália', fora: 'Turquia' },
            { data: '20/06/2026 - 01:00', casa: 'Turquia', fora: 'Paraguai' },
            { data: '19/06/2026 - 16:00', casa: 'Estados Unidos', fora: 'Austrália' },
            { data: '25/06/2026 - 23:00', casa: 'Turquia', fora: 'Estados Unidos' },
            { data: '25/06/2026 - 23:00', casa: 'Paraguai', fora: 'Austrália' }
        ],
        'E': [
            { data: '14/06/2026 - 14:00', casa: 'Alemanha', fora: 'Curaçao' },
            { data: '14/06/2026 - 20:00', casa: 'Costa do Marfim', fora: 'Equador' },
            { data: '20/06/2026 - 17:00', casa: 'Alemanha', fora: 'Costa do Marfim' },
            { data: '20/06/2026 - 21:00', casa: 'Equador', fora: 'Curaçao' },
            { data: '25/06/2026 - 17:00', casa: 'Equador', fora: 'Alemanha' },
            { data: '25/06/2026 - 17:00', casa: 'Curaçao', fora: 'Costa do Marfim' }
        ],
        'F': [
            { data: '14/06/2026 - 17:00', casa: 'Holanda', fora: 'Japão' },
            { data: '14/06/2026 - 23:00', casa: 'Suécia', fora: 'Tunísia' },
            { data: '21/06/2026 - 01:00', casa: 'Tunísia', fora: 'Japão' },
            { data: '20/06/2026 - 14:00', casa: 'Holanda', fora: 'Suécia' },
            { data: '25/06/2026 - 20:00', casa: 'Japão', fora: 'Suécia' },
            { data: '25/06/2026 - 20:00', casa: 'Tunísia', fora: 'Holanda' }
        ],
        'G': [
            { data: '15/06/2026 - 16:00', casa: 'Bélgica', fora: 'Egito' },
            { data: '15/06/2026 - 22:00', casa: 'Irã', fora: 'Nova Zelândia' },
            { data: '21/06/2026 - 16:00', casa: 'Bélgica', fora: 'Irã' },
            { data: '21/06/2026 - 22:00', casa: 'Nova Zelândia', fora: 'Egito' },
            { data: '27/06/2026 - 00:00', casa: 'Egito', fora: 'Irã' },
            { data: '27/06/2026 - 00:00', casa: 'Nova Zelândia', fora: 'Bélgica' }
        ],
        'H': [
            { data: '15/06/2026 - 13:00', casa: 'Espanha', fora: 'Cabo Verde' },
            { data: '15/06/2026 - 19:00', casa: 'Arábia Saudita', fora: 'Uruguai' },
            { data: '21/06/2026 - 13:00', casa: 'Espanha', fora: 'Arábia Saudita' },
            { data: '21/06/2026 - 19:00', casa: 'Uruguai', fora: 'Cabo Verde' },
            { data: '26/06/2026 - 21:00', casa: 'Cabo Verde', fora: 'Arábia Saudita' },
            { data: '26/06/2026 - 21:00', casa: 'Uruguai', fora: 'Espanha' }
        ],
        'I': [
            { data: '16/06/2026 - 16:00', casa: 'França', fora: 'Senegal' },
            { data: '16/06/2026 - 19:00', casa: 'Iraque', fora: 'Noruega' },
            { data: '22/06/2026 - 18:00', casa: 'França', fora: 'Iraque' },
            { data: '22/06/2026 - 21:00', casa: 'Noruega', fora: 'Senegal' },
            { data: '26/06/2026 - 16:00', casa: 'Noruega', fora: 'França' },
            { data: '26/06/2026 - 16:00', casa: 'Senegal', fora: 'Iraque' }
        ],
        'J': [
            { data: '17/06/2026 - 01:00', casa: 'Áustria', fora: 'Jordânia' },
            { data: '16/06/2026 - 22:00', casa: 'Argentina', fora: 'Argélia' },
            { data: '22/06/2026 - 14:00', casa: 'Argentina', fora: 'Áustria' },
            { data: '23/06/2026 - 00:00', casa: 'Jordânia', fora: 'Argélia' },
            { data: '27/06/2026 - 23:00', casa: 'Argélia', fora: 'Áustria' },
            { data: '27/06/2026 - 23:00', casa: 'Jordânia', fora: 'Argentina' }
        ],
        'K': [
            { data: '17/06/2026 - 14:00', casa: 'Portugal', fora: 'RD do Congo' },
            { data: '17/06/2026 - 23:00', casa: 'Uzbequistão', fora: 'Colômbia' },
            { data: '23/06/2026 - 14:00', casa: 'Portugal', fora: 'Uzbequistão' },
            { data: '23/06/2026 - 23:00', casa: 'Colômbia', fora: 'RD do Congo' },
            { data: '27/06/2026 - 20:30', casa: 'Colômbia', fora: 'Portugal' },
            { data: '27/06/2026 - 20:30', casa: 'RD do Congo', fora: 'Uzbequistão' }
        ],
        'L': [
            { data: '17/06/2026 - 17:00', casa: 'Inglaterra', fora: 'Croácia' },
            { data: '17/06/2026 - 20:00', casa: 'Gana', fora: 'Panamá' },
            { data: '23/06/2026 - 17:00', casa: 'Inglaterra', fora: 'Gana' },
            { data: '23/06/2026 - 20:00', casa: 'Panamá', fora: 'Croácia' },
            { data: '27/06/2026 - 18:00', casa: 'Panamá', fora: 'Inglaterra' },
            { data: '27/06/2026 - 18:00', casa: 'Croácia', fora: 'Gana' }
        ]
    };

    // ===== 🏆 OITAVAS DE FINAL - DEFINIDAS =====
    const jogosOitavas = [
        { casa: 'África do Sul', fora: 'Canadá' },
        { casa: 'Brasil', fora: 'Japão' },
        { casa: 'Alemanha', fora: 'Paraguai' },
        { casa: 'Holanda', fora: 'Marrocos' },
        { casa: 'Costa do Marfim', fora: 'Noruega' },
        { casa: 'México', fora: 'Equador' },
        { casa: 'Inglaterra', fora: 'RD Congo' },
        { casa: 'Bélgica', fora: 'Senegal' },
        { casa: 'EUA', fora: 'Bosnia' },
        { casa: 'Espanha', fora: 'Áustria' },
        { casa: 'Portugal', fora: 'Croacia' },
        { casa: 'Australia', fora: 'Egito' },
        { casa: 'Argentina', fora: 'Cabo Verde' },
        { casa: 'Colombia', fora: 'Gana' },
        { casa: 'Suíça', fora: 'Argélia' },
        { casa: 'França', fora: 'Suecia' }
    ];

    // ===== UTILITÁRIOS =====
    function getPontos(row) { return Number(row['PONTUAÇAO'] || row['PONTUACAO'] || row.PONTUACAO || 0); }
    function calcularTotal(abreviacao) { const dados = palpitesData[abreviacao]; if (!dados || dados.length === 0) return 0; return dados.reduce((sum, row) => sum + getPontos(row), 0); }
    function calcularPosicao(abreviacao) { const totalAtual = calcularTotal(abreviacao); let posicao = 1; Object.keys(participantesMap).forEach(abrev => { if (abrev === abreviacao) return; if (calcularTotal(abrev) > totalAtual) posicao++; }); return posicao; }
    function normalizar(str) { if (!str) return ''; return str.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
    function formatarDataHora(dataHora) { if (!dataHora) return ''; const partes = dataHora.toString().split(' '); if (partes.length >= 2) { const data = partes[0], hora = partes[1].substring(0,5), [dia,mes] = data.split('/'); return `${dia}/${mes} - ${hora}`; } return dataHora; }

    // ===== BUSCAR RESULTADOS DOS JOGOS =====
    function buscarResultados(data) {
        const mapa = {};
        if (!data || data.length === 0) return mapa;
        data.forEach(row => {
            if (!row.DATA_HORA || row.DATA_HORA.includes('GRUPO')) return;
            const timeCasa = row.CASA, timeFora = row.FORA;
            const placarCasa = (row.PLACAR_CASA === null || row.PLACAR_CASA === undefined || String(row.PLACAR_CASA).trim() === '') ? '-' : String(row.PLACAR_CASA).trim();
            const placarFora = (row.PLACAR_FORA === null || row.PLACAR_FORA === undefined || String(row.PLACAR_FORA).trim() === '') ? '-' : String(row.PLACAR_FORA).trim();
            mapa[`${timeCasa}-${timeFora}`] = { casa: placarCasa, fora: placarFora };
        });
        return mapa;
    }

    // ===== RENDERIZAR PLACAR GERAL =====
    function renderRanking(data) {
        if (!data || data.length === 0) { showError('Nenhum dado encontrado na aba PLACAR GERAL'); return; }
        const dados = data.filter(j => j.PLACAR && j.PLACAR !== 'PLACAR' && j.GERAL !== undefined);
        dados.sort((a, b) => Number(b.GERAL || 0) - Number(a.GERAL || 0));
        let html = '<div id="ranking-grid">';
        dados.forEach((j, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`;
            const cls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
            const total = Number(j.GERAL || 0);
            html += `
                <div class="card ${cls} clickable-card" data-participant="${j.PLACAR}">
                    <div class="position">${medal}</div>
                    <h2>${j.PLACAR}</h2>
                    <h3>${total} pts</h3>
                    <div class="details">
                        <p><span>🎯 Placar Exato (20):</span> <strong>${Number(j['VIT+EXATO +20'] || 0)}</strong></p>
                        <p><span>✅ Vencedor + 1 (15):</span> <strong>${Number(j['VIT+1 PLACA +15'] || 0)}</strong></p>
                        <p><span>🏆 Só Vencedor (10):</span> <strong>${Number(j['VIT +10'] || 0)}</strong></p>
                        <p><span>⚽ Só 1 Placar (5):</span> <strong>${Number(j['1 PLACAR +5'] || 0)}</strong></p>
                        <p><span>🦓 Zebra Bônus(5):</span> <strong>${Number(j['ZEBRA BONUS'] || 0)}</strong></p>
                        <p><span>⚽ Total de Gols(3):</span> <strong>${Number(j['TOTAL DE GOLS +3'] || 0)}</strong></p>
                    </div>
                    <div class="card-click-hint">👆 Clique para ver palpites</div>
                </div>`;
        });
        html += '</div>';
        if (contentEl) contentEl.innerHTML = html;
        document.querySelectorAll('.clickable-card').forEach(card => {
            card.addEventListener('click', () => irParaPalpitesDoParticipante(card.getAttribute('data-participant')));
        });
    }

    // ===== ABRIR PALPITES DO PARTICIPANTE =====
    async function irParaPalpitesDoParticipante(nomeParticipante) {
        const chaveAba = nomeParaChave[nomeParticipante] || nomeParaChave[nomeParticipante.toUpperCase()] || Object.keys(participantesMap).find(chave => participantesMap[chave].toUpperCase() === nomeParticipante.toUpperCase());
        if (!chaveAba) { alert(`Não foi possível encontrar os palpites de ${nomeParticipante}`); return; }
        currentView = 'palpites';
        document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        if (btnPalpites) btnPalpites.classList.add('active');
        if (filterContainer) filterContainer.style.display = 'flex';
        if (selectParticipant?.parentElement) selectParticipant.parentElement.style.display = 'flex';
        if (selectGroup?.parentElement) selectGroup.parentElement.style.display = 'flex';
        if (selectParticipant) selectParticipant.value = chaveAba;
        if (Object.keys(resultadosCache).length === 0) { showLoading('⏳ Buscando resultados dos jogos...'); const dataJogos = await fetchData('Jogos'); if (dataJogos) resultadosCache = buscarResultados(dataJogos); }
        showLoading(`⏳ Carregando ${participantesMap[chaveAba]}...`);
        await carregarParticipante(chaveAba);
        renderPalpites(chaveAba, selectGroup?.value || 'todos');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ===== RENDERIZAR JOGOS DA FASE DE GRUPOS =====
    function renderJogos(filtroGrupo = 'todos') {
        const grupos = filtroGrupo === 'todos' ? Object.keys(todosJogos).sort() : [filtroGrupo];
        let html = '';
        grupos.forEach(grupo => {
            const jogos = todosJogos[grupo];
            html += `<div class="group-section"><h2 class="group-title">🏆 Grupo ${grupo}</h2><div class="results-container"><table class="games-table"><thead><tr><th>Data / Hora</th><th>Jogo</th><th>Placar</th></tr></thead><tbody>`;
            jogos.forEach(jogo => {
                const resultado = resultadosCache[`${jogo.casa}-${jogo.fora}`];
                let placarDisplay = '-';
                if (resultado && resultado.casa !== '-' && resultado.fora !== '-') placarDisplay = `${resultado.casa} x ${resultado.fora}`;
                html += `<tr><td class="date">${jogo.data}</td><td class="teams">${jogo.casa} <span class="vs">x</span> ${jogo.fora}</td><td class="result">${placarDisplay}</td></tr>`;
            });
            html += `</tbody></table></div></div>`;
        });
        if (contentEl) contentEl.innerHTML = html;
    }

    // ===== 🏆 RENDERIZAR ELIMINATÓRIA (RESULTADOS REAIS - ABA "Elim") =====
    async function loadEliminatorias() {
        console.log('🔄 Buscando aba Elim...');
        const data = await fetchData('Elim');
        
        if (!data || data.length === 0) {
            showError('Erro ao carregar aba Elim');
            console.error('Dados vazios ou null');
            return;
        }
        
        console.log('📦 Total de linhas na aba Elim:', data.length);
        console.log('🔑 Colunas disponíveis:', Object.keys(data[0] || {}));
        
        // ✅ Filtro usando as chaves EXATAS do console (MAIÚSCULAS)
        const jogosElim = data.filter(row => {
            const casa = row.CASA;
            const fora = row.FORA;
            // Aceita se tiver nome de time e não for cabeçalho vazio
            return casa && casa.trim() !== '' && casa !== 'CASA' &&
                   fora && fora.trim() !== '' && fora !== 'FORA';
        });

        console.log('✅ Jogos válidos encontrados:', jogosElim.length, jogosElim);
        
        if (jogosElim.length === 0) {
            console.warn('⚠️ Nenhum jogo válido encontrado. Dados brutos:', data.slice(0, 3));
            showError('Nenhum jogo válido encontrado na aba Elim');
            return;
        }
        
        renderEliminatorias(jogosElim);
    }

    function renderEliminatorias(jogos) {
        if (!jogos || jogos.length === 0) { 
            if (contentEl) contentEl.innerHTML = '<p class="msg">⏳ Carregando...</p>'; 
            return; 
        }
        
        let html = `<div class="elim-container"><h2 style="text-align:center;margin-bottom:20px;">🏆 FASE ELIMINATÓRIA</h2><div class="elim-grid">`;
        
        jogos.forEach((jogo, i) => {
            // ✅ Usa chaves MAIÚSCULAS + tratamento seguro de strings vazias
            const timeCasa = (jogo.CASA && jogo.CASA.trim() !== '') ? jogo.CASA.trim() : 'A definir';
            const timeFora = (jogo.FORA && jogo.FORA.trim() !== '') ? jogo.FORA.trim() : 'A definir';
            
            const placarC = jogo.PLACAR_CASA?.toString().trim() || '-';
            const placarF = jogo.PLACAR_FORA?.toString().trim() || '-';
            
            const temPlacar = placarC !== '-' && placarF !== '-' && placarC !== '' && placarF !== '';

            html += `
                <div class="elim-match">
                    <div class="match-teams">
                        <span class="team">${timeCasa}</span>
                        <span class="vs">x</span>
                        <span class="team">${timeFora}</span>
                    </div>
                    <div class="match-score ${temPlacar ? 'final' : ''}">
                        ${temPlacar 
                            ? `<span class="score">${placarC} x ${placarF}</span>` 
                            : '<span class="awaiting">Aguardando...</span>'}
                    </div>
                </div>`;
        });
        
        html += '</div></div>';
        if (contentEl) contentEl.innerHTML = html;
    }

    // ===== 🎯 RENDERIZAR PALPITES DA ELIMINATÓRIA (CORRIGIDO) =====
    function renderPalpitesEliminatoria(participante) {
        if (!participante) { 
            if (contentEl) contentEl.innerHTML = `<div class="no-data"><p>🎯 Selecione um participante</p></div>`; 
            return; 
        }
        
        const dados = palpitesData[participante];
        if (!dados || dados.length === 0) {
            if (contentEl) contentEl.innerHTML = `<div class="no-data"><p>⏳ Carregando ${participantesMap[participante]}...</p></div>`;
            carregarParticipante(participante).then(() => renderPalpitesEliminatoria(participante));
            return;
        }
        
        // ✅ Filtro corrigido: usa CHAVES MAIÚSCULAS e busca pelos 16 jogos definidos
        const palpitesValidos = dados.filter(row => {
            const casa = row.CASA;
            const fora = row.FORA;
            // Verifica se é um dos 16 jogos das oitavas
            return jogosOitavas.some(j => 
                (j.casa === casa && j.fora === fora) || 
                (j.casa === fora && j.fora === casa)
            );
        });
        
        if (palpitesValidos.length === 0) { 
            if (contentEl) contentEl.innerHTML = `<div class="no-data"><p>⚠️ Nenhum palpite encontrado</p></div>`; 
            return; 
        }
        
        const totalPontos = palpitesValidos.reduce((sum, row) => sum + getPontos(row), 0);

        let html = `
            <div class="eliminatoria-header">
                <h2>🎯 ${participantesMap[participante]} - Eliminatória</h2>
                <div class="total-eliminatoria"><span class="total-label">Total:</span><span class="total-value">${totalPontos} pts</span></div>
            </div>
            <div class="eliminatoria-container"><table class="eliminatoria-table"><thead><tr><th>Jogo</th><th>Palpite</th><th>Real</th><th>Pts</th></tr></thead><tbody>`;
        
        palpitesValidos.forEach(row => {
            const palpite = `${row.PLACAR_CASA ?? '-'} x ${row.PLACAR_FORA ?? '-'}`;
            const resultadoReal = resultadosCache[`${row.CASA}-${row.FORA}`];
            const real = resultadoReal?.casa ? `${resultadoReal.casa} x ${resultadoReal.fora}` : '-';
            const pontos = getPontos(row);
            
            let classe = pontos >= 15 ? 'excelente' : pontos >= 10 ? 'bom' : pontos > 0 ? 'parcial' : 'errado';

            html += `<tr class="${classe}">
                <td class="jogo">${row.CASA} x ${row.FORA}</td>
                <td class="palpite">${palpite}</td>
                <td class="real">${real}</td>
                <td class="pontos ${pontos > 0 ? 'positivo' : 'zero'}">${pontos > 0 ? '+' + pontos : '-'}</td>
            </tr>`;
        });
        
        html += `</tbody></table></div>`;
        if (contentEl) contentEl.innerHTML = html;
    }

    // ===== RENDERIZAR PALPITES DO PARTICIPANTE (FASE DE GRUPOS) =====
    function renderPalpites(participante, filtroGrupo) {
        if (!participante || participante === '') { if (contentEl) contentEl.innerHTML = `<div class="no-data"><p>🎯 Selecione um participante</p></div>`; return; }
        const dados = palpitesData[participante];
        if (!dados || dados.length === 0) {
            if ((falhasCarregamento[participante] || 0) >= 3) {
                if (contentEl) contentEl.innerHTML = `<div class="no-data"><p>❌ Não foi possível carregar ${participantesMap[participante]}</p><button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;background:var(--gold);border:none;border-radius:8px;cursor:pointer;">🔄 Recarregar</button></div>`;
                return;
            }
            if (contentEl) contentEl.innerHTML = `<div class="no-data"><p>⏳ Carregando ${participantesMap[participante]}...</p></div>`;
            if (!carregandoAgora[participante]) {
                carregarParticipante(participante).then(dados => {
                    if (dados) renderPalpites(participante, filtroGrupo);
                    else { falhasCarregamento[participante] = (falhasCarregamento[participante] || 0) + 1; renderPalpites(participante, filtroGrupo); }
                });
            }
            return;
        }
        let jogosFiltrados = dados.filter(row => {
            if (!row.DATA_HORA || row.DATA_HORA.includes('GRUPO')) return false;
            if (filtroGrupo === 'todos') return true;
            const casaNorm = normalizar(row.CASA), foraNorm = normalizar(row.FORA);
            const grupoJogo = Object.keys(todosJogos).find(grupo => todosJogos[grupo].some(j => normalizar(j.casa) === casaNorm || normalizar(j.fora) === foraNorm));
            return grupoJogo === filtroGrupo;
        });
        const totalPontos = jogosFiltrados.reduce((sum, row) => sum + getPontos(row), 0);
        const posicao = calcularPosicao(participante);
        const totalParticipantes = Object.keys(participantesMap).length;
        const medalhaPosicao = posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : '';
        let html = `
            <div class="palpite-summary">
                <h2>🎯 ${participantesMap[participante] || participante}</h2>
                <div class="ranking-position">${medalhaPosicao} ${posicao}º de ${totalParticipantes}</div>
                <div class="summary-stats"><div class="stat-box"><span class="stat-value">${totalPontos}</span><span class="stat-label">Total</span></div></div>
            </div>
            <div class="results-container"><table class="predictions-table"><thead><tr><th>Data</th><th>Jogo</th><th>Palpite</th><th>Real</th><th>Pts</th></tr></thead><tbody>`;
        jogosFiltrados.forEach(row => {
            const placarCasa = (row.PLACAR_CASA !== null && row.PLACAR_CASA !== undefined) ? row.PLACAR_CASA : '-';
            const placarFora = (row.PLACAR_FORA !== null && row.PLACAR_FORA !== undefined) ? row.PLACAR_FORA : '-';
            const palpite = `${placarCasa} x ${placarFora}`;
            const resultadoReal = resultadosCache[`${row.CASA}-${row.FORA}`];
            const real = resultadoReal && resultadoReal.casa !== '-' ? `${resultadoReal.casa} x ${resultadoReal.fora}` : '-';
            const pontos = getPontos(row);
            let classePalpite = '';
            if (pontos === 20) classePalpite = 'correct';
            else if (pontos > 0) classePalpite = 'partial';
            else if (row.PLACAR_CASA !== null && row.PLACAR_CASA !== undefined && row.PLACAR_CASA !== '-') classePalpite = 'wrong';
            html += `<tr><td class="col-date">${row.DATA_HORA}</td><td class="col-match">${row.CASA} x ${row.FORA}</td><td class="prediction ${classePalpite}">${palpite}</td><td>${real}</td><td class="points ${pontos === 0 ? 'zero' : ''}">${pontos > 0 ? '+' + pontos : '-'}</td></tr>`;
        });
        html += `</tbody></table></div>`;
        if (contentEl) contentEl.innerHTML = html;
    }

    // ===== CARREGAR DADOS DE UM PARTICIPANTE =====
    async function carregarParticipante(abrev) {
        if (palpitesData[abrev]) return palpitesData[abrev];
        if (carregandoAgora[abrev]) return null;
        if ((falhasCarregamento[abrev] || 0) >= 3) return null;
        carregandoAgora[abrev] = true;
        try {
            let dados = await fetchData(abrev);
            if (dados) { dados = normalizarDados(dados, abrev); palpitesData[abrev] = dados; return dados; }
            falhasCarregamento[abrev] = (falhasCarregamento[abrev] || 0) + 1;
            return null;
        } finally { carregandoAgora[abrev] = false; }
    }

    // ===== CARREGAR EM BACKGROUND =====
    async function carregarEmBackground() {
        if (carregandoEmBackground) return;
        carregandoEmBackground = true;
        const pendentes = Object.keys(participantesMap).filter(abrev => !palpitesData[abrev] && (falhasCarregamento[abrev] || 0) < 3);
        for (const abrev of pendentes) { await new Promise(resolve => setTimeout(resolve, 2000)); await carregarParticipante(abrev); }
        carregandoEmBackground = false;
    }

    // ===== POPULAR SELECT DE PARTICIPANTES =====
    function popularSelectParticipantes() {
        if (!selectParticipant) return;
        const opcoes = Object.keys(participantesMap).map(abrev => `<option value="${abrev}">${participantesMap[abrev]}</option>`).join('');
        selectParticipant.innerHTML = `<option value="">Selecione...</option>${opcoes}`;
    }

    // ===== EVENT LISTENERS DAS ABAS =====
    
    // 🏅 Placar Geral
    if (btnRanking) {
        btnRanking.addEventListener('click', async () => {
            if (currentView === 'ranking') return;
            currentView = 'ranking';
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btnRanking.classList.add('active');
            if (filterContainer) filterContainer.style.display = 'none';
            showLoading();
            const data = await fetchData('PLACAR GERAL');
            if (data) renderRanking(data);
        });
    }

    // ⚽ Fase de Grupos
    if (btnJogos) {
        btnJogos.addEventListener('click', async () => {
            if (currentView === 'jogos') return;
            currentView = 'jogos';
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btnJogos.classList.add('active');
            if (filterContainer) filterContainer.style.display = 'flex';
            if (selectParticipant?.parentElement) selectParticipant.parentElement.style.display = 'none';
            if (selectGroup?.parentElement) selectGroup.parentElement.style.display = 'flex';
            showLoading();
            const data = await fetchData('Jogos');
            if (data) { resultadosCache = buscarResultados(data); renderJogos('todos'); }
        });
    }

    // 📝 Palpites Grupos
    if (btnPalpites) {
        btnPalpites.addEventListener('click', async () => {
            if (currentView === 'palpites') return;
            currentView = 'palpites';
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btnPalpites.classList.add('active');
            if (filterContainer) filterContainer.style.display = 'flex';
            if (selectParticipant?.parentElement) selectParticipant.parentElement.style.display = 'flex';
            if (selectGroup?.parentElement) selectGroup.parentElement.style.display = 'flex';
            if (Object.keys(resultadosCache).length === 0) { showLoading('⏳ Buscando jogos...'); const dataJogos = await fetchData('Jogos'); if (dataJogos) resultadosCache = buscarResultados(dataJogos); }
            if (selectParticipant?.value) { showLoading(`⏳ Carregando ${participantesMap[selectParticipant.value]}...`); await carregarParticipante(selectParticipant.value); renderPalpites(selectParticipant.value, selectGroup?.value || 'todos'); }
            else renderPalpites('', selectGroup?.value || 'todos');
            setTimeout(() => carregarEmBackground(), 2000);
        });
    }

    // 🏆 Eliminatória (RESULTADOS REAIS da aba "Elim")
    if (btnElim) {
        btnElim.addEventListener('click', async () => {
            if (currentView === 'elim') return;
            currentView = 'elim';
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btnElim.classList.add('active');
            if (filterContainer) filterContainer.style.display = 'none';
            showLoading('⏳ Carregando resultados da eliminatória...');
            await loadEliminatorias();
        });
    }

    // 🎯 Palpites Eliminatória (PALPITES dos participantes)
    if (btnPalpitesElim) {
        btnPalpitesElim.addEventListener('click', async () => {
            if (currentView === 'palpites-elim') return;
            currentView = 'palpites-elim';
            document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            btnPalpitesElim.classList.add('active');
            if (filterContainer) filterContainer.style.display = 'flex';
            if (selectParticipant?.parentElement) selectParticipant.parentElement.style.display = 'flex';
            if (selectGroup?.parentElement) selectGroup.parentElement.style.display = 'none';
            if (Object.keys(resultadosCache).length === 0) { showLoading('⏳ Buscando resultados...'); const dataJogos = await fetchData('Jogos'); if (dataJogos) resultadosCache = buscarResultados(dataJogos); }
            if (selectParticipant?.value) { showLoading(`⏳ Carregando eliminatória de ${participantesMap[selectParticipant.value]}...`); await carregarParticipante(selectParticipant.value); renderPalpitesEliminatoria(selectParticipant.value); }
            else renderPalpitesEliminatoria('');
        });
    }

    // 🔄 Refresh
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            showLoading('🔄 Atualizando...');
            Object.keys(localStorage).forEach(key => { if (key.startsWith('cache_')) localStorage.removeItem(key); });
            palpitesData = {}; resultadosCache = {}; placarGeralCache = null;
            if (currentView === 'ranking') { const data = await fetchData('PLACAR GERAL'); if (data) renderRanking(data); }
            else if (currentView === 'jogos') { const data = await fetchData('Jogos'); if (data) { resultadosCache = buscarResultados(data); renderJogos(selectGroup?.value || 'todos'); } }
            else if (currentView === 'palpites') { const dataJogos = await fetchData('Jogos'); if (dataJogos) resultadosCache = buscarResultados(dataJogos); if (selectParticipant?.value) { await carregarParticipante(selectParticipant.value); renderPalpites(selectParticipant.value, selectGroup?.value || 'todos'); } }
            else if (currentView === 'elim') { await loadEliminatorias(); }
            else if (currentView === 'palpites-elim') { if (selectParticipant?.value) { await carregarParticipante(selectParticipant.value); renderPalpitesEliminatoria(selectParticipant.value); } }
        });
    }

    // Filtro de Participante
    if (selectParticipant) {
        selectParticipant.addEventListener('change', async () => {
            if (currentView === 'palpites' && selectParticipant.value) { showLoading(`⏳ Carregando ${participantesMap[selectParticipant.value]}...`); await carregarParticipante(selectParticipant.value); renderPalpites(selectParticipant.value, selectGroup?.value || 'todos'); }
            else if (currentView === 'elim' && selectParticipant.value) { showLoading(`⏳ Carregando eliminatória de ${participantesMap[selectParticipant.value]}...`); await carregarParticipante(selectParticipant.value); renderPalpitesEliminatoria(selectParticipant.value); }
            else if (currentView === 'palpites-elim' && selectParticipant.value) { showLoading(`⏳ Carregando eliminatória de ${participantesMap[selectParticipant.value]}...`); await carregarParticipante(selectParticipant.value); renderPalpitesEliminatoria(selectParticipant.value); }
        });
    }

    // Filtro de Grupo
    if (selectGroup) {
        selectGroup.addEventListener('change', () => {
            if (currentView === 'palpites') renderPalpites(selectParticipant?.value || '', selectGroup.value);
            else if (currentView === 'jogos') renderJogos(selectGroup.value);
        });
    }

    // ===== INICIALIZAÇÃO =====
    popularSelectParticipantes();
    if(btnRanking) btnRanking.click();
   window.btnJogos)= btnJogos
    window.palpitesData = palpitesData;
    window.resultadosCache = resultadosCache;
    window.todosJogos = todosJogos;
    window.nomeParaChave = nomeParaChave;
    window.participantesMap = participantesMap;
    console.log('✅ Bolão da Copa 2026 carregado!');
});

// ===== BOTÃO WHATSAPP FLUTUANTE ARRASTÁVEL =====
(function() {
    const whatsappBtn = document.getElementById('whatsapp-float');
    if (!whatsappBtn) return;
    const LINK_GRUPO = 'https://chat.whatsapp.com/Ld5Tt3kvD240Dlq3YFV03I?s=cl&p=a&mlu=1&amv=0';
    let isDragging = false, hasMoved = false, startX, startY, initialLeft, initialTop, clickStartTime = 0;
    const savedPosition = localStorage.getItem('whatsappBtnPosition');
    if (savedPosition) {
        try {
            const pos = JSON.parse(savedPosition);
            if (pos.left >= 0 && pos.top >= 0 && pos.left < window.innerWidth && pos.top < window.innerHeight) {
                whatsappBtn.style.left = pos.left + 'px'; whatsappBtn.style.top = pos.top + 'px';
                whatsappBtn.style.right = 'auto'; whatsappBtn.style.bottom = 'auto';
            }
        } catch (e) { console.warn('Erro ao carregar posição do botão WhatsApp'); }
    }
    function savePosition() {
        const rect = whatsappBtn.getBoundingClientRect();
        localStorage.setItem('whatsappBtnPosition', JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
    }
    whatsappBtn.addEventListener('mousedown', function(e) {
        e.preventDefault(); isDragging = true; hasMoved = false; clickStartTime = Date.now();
        whatsappBtn.classList.add('dragging');
        const rect = whatsappBtn.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY; initialLeft = rect.left; initialTop = rect.top;
        whatsappBtn.style.left = rect.left + 'px'; whatsappBtn.style.top = rect.top + 'px';
        whatsappBtn.style.right = 'auto'; whatsappBtn.style.bottom = 'auto';
    });
    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
        let newLeft = initialLeft + dx, newTop = initialTop + dy;
        const btnWidth = whatsappBtn.offsetWidth, btnHeight = whatsappBtn.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - btnWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - btnHeight));
        whatsappBtn.style.left = newLeft + 'px'; whatsappBtn.style.top = newTop + 'px';
    });
    document.addEventListener('mouseup', function() {
        if (!isDragging) return;
        isDragging = false; whatsappBtn.classList.remove('dragging');
        if (hasMoved) savePosition(); else window.open(LINK_GRUPO, '_blank', 'noopener,noreferrer');
    });
    whatsappBtn.addEventListener('touchstart', function(e) {
        const touch = e.touches[0]; isDragging = true; hasMoved = false; clickStartTime = Date.now();
        whatsappBtn.classList.add('dragging');
        const rect = whatsappBtn.getBoundingClientRect();
        startX = touch.clientX; startY = touch.clientY; initialLeft = rect.left; initialTop = rect.top;
        whatsappBtn.style.left = rect.left + 'px'; whatsappBtn.style.top = rect.top + 'px';
        whatsappBtn.style.right = 'auto'; whatsappBtn.style.bottom = 'auto';
    }, { passive: true });
    document.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        const touch = e.touches[0], dx = touch.clientX - startX, dy = touch.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
        let newLeft = initialLeft + dx, newTop = initialTop + dy;
        const btnWidth = whatsappBtn.offsetWidth, btnHeight = whatsappBtn.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - btnWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - btnHeight));
        whatsappBtn.style.left = newLeft + 'px'; whatsappBtn.style.top = newTop + 'px';
        if (hasMoved) e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchend', function() {
        if (!isDragging) return;
        isDragging = false; whatsappBtn.classList.remove('dragging');
        if (hasMoved) savePosition(); else window.open(LINK_GRUPO, '_blank', 'noopener,noreferrer');
    });
    whatsappBtn.addEventListener('dblclick', function(e) {
        e.preventDefault(); e.stopPropagation();
        localStorage.removeItem('whatsappBtnPosition');
        whatsappBtn.style.left = ''; whatsappBtn.style.top = '';
        whatsappBtn.style.right = '25px'; whatsappBtn.style.bottom = '25px';
    });
})();
