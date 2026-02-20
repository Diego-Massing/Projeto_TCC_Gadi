// ===== FINES PAGE =====
Pages.fines = {
    async render() {
        const trucks = await db.getAll('trucks');
        const fines = await db.getAll('fines');
        fines.sort((a, b) => b.data?.localeCompare(a.data));
        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">Multas</h1><p class="page-subtitle">Registro geral de multas</p></div>
                ${App.userRole === 'admin' ? `<button class="btn btn-primary" onclick="Pages.fines.showForm()">＋ Nova Multa</button>` : ''}
            </div></div>
            <div class="page-body">
                <div class="filter-bar">
                    <div class="form-group"><label class="form-label">Placa</label><select class="form-control" id="filter-fine-truck" onchange="Pages.fines.applyFilter()"><option value="">Todas</option>${trucks.map(t => `<option value="${t.id}">${t.placa}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="filter-fine-status" onchange="Pages.fines.applyFilter()"><option value="">Todos</option><option value="pendente">Pendente</option><option value="paga">Paga</option><option value="recorrida">Recorrida</option></select></div>
                </div>
                <div id="fines-table">${this.renderTable(fines, trucks)}</div>
            </div>`;
    },
    renderTable(fines, trucks) {
        if (!fines.length) return '<div class="empty-state"><div class="empty-icon">✅</div><h3>Nenhuma multa registrada</h3></div>';
        const total = fines.reduce((s, f) => s + (f.valor || 0), 0);
        return `<div class="table-container"><table class="data-table"><thead><tr><th>Placa</th><th>Data</th><th>Descrição</th><th>Local</th><th>Valor</th><th>Pontos</th><th>Status</th><th></th></tr></thead><tbody>${fines.map(f => {
            const t = trucks.find(tt => tt.id === f.truckId); return `<tr>
                <td class="font-mono font-bold">${t?.placa || '—'}</td><td>${Utils.formatDate(f.data)}</td><td>${f.descricao || '—'}</td><td>${f.local || '—'}</td>
                <td class="font-bold text-danger">${Utils.formatCurrency(f.valor)}</td><td>${f.pontos || '—'}</td>
                <td><span class="badge ${f.status === 'paga' ? 'badge-success' : f.status === 'recorrida' ? 'badge-info' : 'badge-danger'}">${f.status || 'pendente'}</span></td>
                <td>${App.userRole === 'admin' ? `<button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.fines.showForm(${f.id})">✏️</button> <button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.fines.remove(${f.id})">🗑️</button>` : ''}</td>
            </tr>`;
        }).join('')}</tbody></table></div>
            <div class="table-footer"><span>${fines.length} multas</span><span><strong>Total: ${Utils.formatCurrency(total)}</strong></span></div>`;
    },
    async applyFilter() {
        let fines = await db.getAll('fines'); const trucks = await db.getAll('trucks');
        const tid = document.getElementById('filter-fine-truck').value;
        const st = document.getElementById('filter-fine-status').value;
        if (tid) fines = fines.filter(f => f.truckId === parseInt(tid));
        if (st) fines = fines.filter(f => (f.status || 'pendente') === st);
        fines.sort((a, b) => b.data?.localeCompare(a.data));
        document.getElementById('fines-table').innerHTML = this.renderTable(fines, trucks);
    },
    async showForm(id, presetTruckId) {
        const trucks = await db.getAll('trucks'); let item = null;
        if (id) item = await db.getById('fines', id);
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Multa' : 'Nova Multa';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-row">
                <div class="form-group"><label class="form-label">Caminhão *</label><select class="form-control" id="f-truckId"><option value="">Selecione</option>${trucks.map(t => `<option value="${t.id}" ${(item?.truckId === t.id || presetTruckId === t.id) ? 'selected' : ''}>${t.placa}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Data *</label><input type="date" class="form-control" id="f-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-control" id="f-descricao" value="${item?.descricao || ''}" placeholder="Excesso de velocidade"></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Local</label><input type="text" class="form-control" id="f-local" value="${item?.local || ''}"></div>
                <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" class="form-control" id="f-valor" value="${item?.valor || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Pontos</label><input type="number" class="form-control" id="f-pontos" value="${item?.pontos || ''}"></div>
                <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="f-status"><option value="pendente" ${item?.status === 'pendente' || !item ? 'selected' : ''}>Pendente</option><option value="paga" ${item?.status === 'paga' ? 'selected' : ''}>Paga</option><option value="recorrida" ${item?.status === 'recorrida' ? 'selected' : ''}>Recorrida</option></select></div>
            </div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.fines.save(${id || 'null'})">Salvar</button>`;
        App.openModal();
    },
    async save(id) {
        const truckId = parseInt(document.getElementById('f-truckId').value);
        if (!truckId) { Utils.showToast('Selecione o caminhão', 'warning'); return; }
        const data = { truckId, data: document.getElementById('f-data').value, descricao: document.getElementById('f-descricao').value.trim(), local: document.getElementById('f-local').value.trim(), valor: parseFloat(document.getElementById('f-valor').value) || 0, pontos: parseInt(document.getElementById('f-pontos').value) || 0, status: document.getElementById('f-status').value };
        try { if (id) { data.id = id; await db.update('fines', data); } else { await db.add('fines', data); } Utils.showToast(id ? 'Atualizada!' : 'Multa registrada!', 'success'); App.closeModal(); App.refreshCurrentPage(); } catch (e) { Utils.showToast('Erro', 'error'); }
    },
    async remove(id) { if (!confirm('Excluir?')) return; await db.delete('fines', id); Utils.showToast('Excluída', 'success'); App.refreshCurrentPage(); }
};

// ===== SETTINGS PAGE =====
Pages.settings = {
    async render() {
        const rates = await db.getKmRates();
        const comm = await db.getCommissionConfig();
        const faixas = comm.faixasPremioMedia || [];
        const geminiKey = await this.getGeminiKey();
        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row"><div><h1 class="page-title">⚙️ Configurações</h1><p class="page-subtitle">Valores por KM, comissões e integrações</p></div></div></div>
            <div class="page-body">
                <div class="card mb-3"><div class="card-header"><h3>💰 Valores por KM Rodado</h3></div><div class="card-body">
                    <p class="text-muted mb-2">Estes valores são usados para calcular automaticamente o valor dos fretes.</p>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">R$/KM — Carregado 🟢</label><input type="number" step="0.01" class="form-control" id="s-km-carregado" value="${rates.carregado}" style="font-size:1.2rem;font-weight:700"></div>
                        <div class="form-group"><label class="form-label">R$/KM — Vazio 🟡</label><input type="number" step="0.01" class="form-control" id="s-km-vazio" value="${rates.vazio}" style="font-size:1.2rem;font-weight:700"></div>
                    </div>
                    <button class="btn btn-primary mt-2" onclick="Pages.settings.saveRates()">💾 Salvar Valores</button>
                </div></div>
                <div class="card mb-3"><div class="card-header"><h3>💼 Comissão dos Motoristas (Padrão)</h3></div><div class="card-body">
                    <p class="text-muted mb-2">Valores padrão aplicados a todos os motoristas (podem ser sobrescritos individualmente no cadastro de cada motorista).</p>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">Salário Fixo Mensal R$</label><input type="number" step="0.01" class="form-control" id="s-salario-fixo" value="${comm.salarioFixo}" style="font-size:1.1rem;font-weight:700"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">% Comissão KM Carregado</label><input type="number" step="0.1" class="form-control" id="s-com-carregado" value="${comm.comissaoKmCarregado}"></div>
                        <div class="form-group"><label class="form-label">% Comissão KM Vazio</label><input type="number" step="0.1" class="form-control" id="s-com-vazio" value="${comm.comissaoKmVazio}"></div>
                    </div>
                    <p class="text-muted" style="font-size:0.75rem;margin-top:-4px">A comissão é calculada como: KM rodados × R$/KM × % comissão</p>
                    <button class="btn btn-primary mt-2" onclick="Pages.settings.saveCommission()">💾 Salvar Comissão</button>
                </div></div>
                <div class="card mb-3"><div class="card-header"><h3>🏆 Faixas de Prêmio por Média km/L</h3></div><div class="card-body">
                    <p class="text-muted mb-2">Quanto melhor a média de consumo, maior o prêmio. Adicione quantas faixas quiser — o motorista receberá o prêmio da faixa mais alta que atingir.</p>
                    <div id="faixas-container">
                        ${faixas.length === 0 ? '<p class="text-muted" style="font-style:italic">Nenhuma faixa definida. Adicione abaixo.</p>' :
                faixas.sort((a, b) => a.minMedia - b.minMedia).map((f, i) => `
                            <div class="form-row mb-1 faixa-row" data-index="${i}">
                                <div class="form-group"><label class="form-label">Média mínima (km/L)</label><input type="number" step="0.1" class="form-control faixa-media" value="${f.minMedia}"></div>
                                <div class="form-group"><label class="form-label">Prêmio R$</label><input type="number" step="0.01" class="form-control faixa-premio" value="${f.premio}"></div>
                                <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-sm" style="color:var(--accent-danger)" onclick="Pages.settings.removeFaixa(${i})">🗑️</button></div>
                            </div>`).join('')}
                    </div>
                    <div class="btn-group mt-2">
                        <button class="btn btn-secondary" onclick="Pages.settings.addFaixa()">＋ Adicionar Faixa</button>
                        <button class="btn btn-primary" onclick="Pages.settings.saveFaixas()">💾 Salvar Faixas</button>
                    </div>
                    <div class="mt-2" style="background:var(--bg-primary);border-radius:8px;padding:12px;font-size:0.8rem">
                        <strong>Exemplo:</strong> Se as faixas forem 2.0 km/L = R$100 | 2.5 km/L = R$200 | 3.0 km/L = R$350<br>
                        Um motorista com média de <strong>2.7 km/L</strong> receberá <strong>R$200</strong> (atingiu a faixa 2.5 mas não a 3.0).
                    </div>
                </div></div>
                <div class="card mb-3"><div class="card-header"><h3>🗺️ Cálculo de Distâncias</h3></div><div class="card-body">
                    <p class="text-muted mb-2">O cálculo de distância entre cidades usa o <strong>OSRM</strong> (Open Source Routing Machine) — 100% gratuito, sem necessidade de chave API.</p>
                    <p class="text-muted">Ao cadastrar um frete com cidades de origem e destino, o botão "📏 Calcular KM" calculará a distância rodoviária automaticamente.</p>
                    <div class="badge badge-success" style="font-size:0.85rem;padding:6px 12px">✅ Ativo — Sem custo</div>
                </div></div>
                <div class="card mb-3"><div class="card-header"><h3>📸 Leitura de Cupom com IA (OCR)</h3></div><div class="card-body">
                    <p class="text-muted mb-2">Tire uma foto do cupom fiscal e a IA preenche os campos automaticamente. Usa o <strong>Google Gemini Vision</strong>.</p>
                    <div class="form-group">
                        <label class="form-label">Chave da API Gemini</label>
                        <div style="display:flex;gap:8px">
                            <input type="password" class="form-control" id="s-gemini-key" value="${geminiKey}" placeholder="Cole sua chave aqui..." style="flex:1">
                            <button class="btn btn-primary" onclick="Pages.settings.saveGeminiKey()">💾 Salvar</button>
                        </div>
                        <small class="text-muted mt-1" style="display:block">Obtenha uma chave gratuita em <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent-primary)">aistudio.google.com/app/apikey</a></small>
                    </div>
                </div></div>
                <div class="card"><div class="card-header"><h3>🗄️ Dados</h3></div><div class="card-body">
                    <p class="text-muted mb-2">Gerenciamento do banco de dados local.</p>
                    <div class="btn-group">
                        <button class="btn btn-secondary" onclick="Pages.settings.exportAll()">📥 Exportar Tudo (JSON)</button>
                        <button class="btn btn-secondary" onclick="document.getElementById('import-json-file').click()">📤 Importar Backup (JSON)</button>
                        <button class="btn btn-danger" onclick="Pages.settings.clearAll()">🗑️ Limpar Todos os Dados</button>
                    </div>
                    <input type="file" id="import-json-file" accept=".json" style="display:none" onchange="Pages.settings.importBackup(event)">
                </div></div>
            </div>`;
    },
    async getGeminiKey() {
        try {
            const settings = await db.getAll('settings');
            const setting = settings.find(s => s.key === 'geminiApiKey');
            return setting ? setting.value : '';
        } catch (e) { return ''; }
    },
    async saveGeminiKey() {
        const key = document.getElementById('s-gemini-key').value.trim();
        if (!key) { Utils.showToast('Informe a chave da API', 'warning'); return; }
        await OCR.setApiKey(key);
        Utils.showToast('Chave da API Gemini salva! 🎉', 'success');
    },
    async saveRates() {
        const c = parseFloat(document.getElementById('s-km-carregado').value) || 0;
        const v = parseFloat(document.getElementById('s-km-vazio').value) || 0;
        await db.setKmRates(c, v);
        Utils.showToast('Valores por KM salvos!', 'success');
    },
    async saveCommission() {
        const existing = await db.getCommissionConfig();
        const config = {
            ...existing,
            salarioFixo: parseFloat(document.getElementById('s-salario-fixo').value) || 0,
            comissaoKmCarregado: parseFloat(document.getElementById('s-com-carregado').value) || 0,
            comissaoKmVazio: parseFloat(document.getElementById('s-com-vazio').value) || 0
        };
        await db.setCommissionConfig(config);
        Utils.showToast('Configuração de comissão salva!', 'success');
    },
    addFaixa() {
        const container = document.getElementById('faixas-container');
        const noMsg = container.querySelector('p.text-muted');
        if (noMsg) noMsg.remove();
        const idx = container.querySelectorAll('.faixa-row').length;
        const div = document.createElement('div');
        div.className = 'form-row mb-1 faixa-row';
        div.dataset.index = idx;
        div.innerHTML = `
            <div class="form-group"><label class="form-label">Média mínima (km/L)</label><input type="number" step="0.1" class="form-control faixa-media" value="" placeholder="Ex: 2.5"></div>
            <div class="form-group"><label class="form-label">Prêmio R$</label><input type="number" step="0.01" class="form-control faixa-premio" value="" placeholder="Ex: 200"></div>
            <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-sm" style="color:var(--accent-danger)" onclick="this.closest('.faixa-row').remove()">🗑️</button></div>`;
        container.appendChild(div);
    },
    removeFaixa(idx) {
        const rows = document.querySelectorAll('.faixa-row');
        if (rows[idx]) rows[idx].remove();
    },
    async saveFaixas() {
        const rows = document.querySelectorAll('.faixa-row');
        const faixas = [];
        rows.forEach(row => {
            const minMedia = parseFloat(row.querySelector('.faixa-media').value);
            const premio = parseFloat(row.querySelector('.faixa-premio').value);
            if (!isNaN(minMedia) && minMedia > 0 && !isNaN(premio) && premio > 0) {
                faixas.push({ minMedia, premio });
            }
        });
        faixas.sort((a, b) => a.minMedia - b.minMedia);
        const existing = await db.getCommissionConfig();
        existing.faixasPremioMedia = faixas;
        await db.setCommissionConfig(existing);
        Utils.showToast(`${faixas.length} faixas de prêmio salvas!`, 'success');
        App.refreshCurrentPage();
    },
    async exportAll() {
        const data = {};
        for (const store of ['trucks', 'fuelings', 'freights', 'fines', 'closings', 'settings', 'users', 'driverExpenses', 'driverBonuses']) {
            data[store] = await db.getAll(store);
        }
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `frota-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    },
    async importBackup(event) {
        const file = event.target.files[0]; if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            for (const [store, items] of Object.entries(data)) {
                if (['trucks', 'fuelings', 'freights', 'fines', 'closings', 'settings', 'users', 'driverExpenses', 'driverBonuses'].includes(store)) {
                    await db.clear(store);
                    for (const item of items) { await db.update(store, item); }
                }
            }
            Utils.showToast('Backup restaurado!', 'success');
            App.navigate('dashboard');
        } catch (e) { Utils.showToast('Erro ao importar: ' + e.message, 'error'); }
    },
    async clearAll() {
        if (!confirm('ATENÇÃO: Isso vai apagar TODOS os dados. Tem certeza?')) return;
        if (!confirm('Última chance! Deseja realmente excluir tudo?')) return;
        for (const s of ['trucks', 'fuelings', 'freights', 'fines', 'closings', 'users', 'driverExpenses', 'driverBonuses']) { await db.clear(s); }
        Utils.showToast('Dados limpos', 'success'); App.navigate('dashboard');
    }
};

// ===== DATA IMPORT PAGE =====
Pages.dataImport = {
    csvData: null,
    rawText: null,
    fileName: '',
    async render() {
        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row"><div><h1 class="page-title">📤 Importar Dados</h1><p class="page-subtitle">Migre dados do Google Planilhas via CSV</p></div></div></div>
            <div class="page-body">
                <div class="import-steps mb-3">
                    <div class="import-step active"><div class="step-number">1</div><div class="step-label">Upload CSV</div></div>
                    <div class="import-step"><div class="step-number">2</div><div class="step-label">Configurar</div></div>
                    <div class="import-step"><div class="step-number">3</div><div class="step-label">Importar</div></div>
                </div>
                <div class="card"><div class="card-body">
                    <div class="form-group"><label class="form-label">Tipo de Dados</label><select class="form-control" id="import-type" style="max-width:300px" onchange="Pages.dataImport.onTypeChange()">
                        <option value="fuelings-frota">⛽ Abastecimentos — Planilha da Frota</option>
                        <option value="freights-frota">📦 Fretes — Planilha da Frota</option>
                        <option value="fuelings">⛽ Abastecimentos — CSV Genérico</option>
                        <option value="freights">📦 Fretes — CSV Genérico</option>
                        <option value="fines">🚨 Multas — CSV Genérico</option>
                        <option value="trucks">🚛 Caminhões — CSV Genérico</option>
                    </select></div>
                    <div id="import-type-help" class="mb-2" style="font-size:0.82rem;color:var(--text-secondary)"></div>
                    <div class="file-upload-area" id="csv-drop-area" onclick="document.getElementById('csv-file-input').click()">
                        <div class="upload-icon">📁</div>
                        <h3>Arraste o arquivo CSV aqui</h3>
                        <p>ou clique para selecionar — Aceita arquivos .csv exportados do Google Planilhas</p>
                    </div>
                    <input type="file" id="csv-file-input" accept=".csv,.txt" style="display:none" onchange="Pages.dataImport.handleFile(event)">
                </div></div>
                <div id="import-preview" class="mt-3"></div>
            </div>`;
        this.setupDragDrop();
        this.onTypeChange();
    },
    onTypeChange() {
        const type = document.getElementById('import-type').value;
        const help = document.getElementById('import-type-help');
        if (type === 'fuelings-frota') {
            help.innerHTML = '💡 <strong>Formato:</strong> O nome do arquivo deve conter a placa (ex: <code>JCU7I43 - ABASTECIDAS.csv</code>). Datas podem ser dd/mm (sem ano). Colunas: B=Mês, C=Data, D=KM, E=Posto, F=Litros, G=Valor Diesel, H=Valor Arla.';
        } else if (type === 'freights-frota') {
            help.innerHTML = '💡 <strong>Formato:</strong> O nome do arquivo deve conter a placa. Colunas: B=Tipo (1=Carregado, 0=Vazio), C=Cidades (Origem - Destino), F=KM, G=Data, I=Comissão.';
        } else {
            help.innerHTML = '💡 CSV genérico com cabeçalho na primeira linha. Você mapeará as colunas após o upload.';
        }
    },
    setupDragDrop() {
        const area = document.getElementById('csv-drop-area');
        if (!area) return;
        ['dragenter', 'dragover'].forEach(e => area.addEventListener(e, ev => { ev.preventDefault(); area.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(e => area.addEventListener(e, ev => { ev.preventDefault(); area.classList.remove('dragover'); }));
        area.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) this.processFile(f); });
    },
    handleFile(event) { const f = event.target.files[0]; if (f) this.processFile(f); },

    // ===== FLEET SPREADSHEET PARSER =====
    parseFleetCSV(text, fileName) {
        const lines = text.split(/\r?\n/);
        // Extract plate from filename (e.g. "JCU7I43 - ABASTECIDAS.csv" -> "JCU7I43")
        const placaMatch = fileName.match(/([A-Z]{3}\d[A-Z0-9]\d{2})/i);
        const placa = placaMatch ? placaMatch[1].toUpperCase() : '';

        const rows = [];
        for (let i = 2; i < lines.length; i++) { // skip rows 0 (A,,,...) and 1 (header)
            const line = lines[i];
            if (!line || !line.trim()) continue;

            // Parse CSV line respecting quotes
            const cells = [];
            let current = '', inQuotes = false;
            for (let j = 0; j < line.length; j++) {
                const c = line[j];
                if (c === '"') { if (inQuotes && line[j + 1] === '"') { current += '"'; j++; } else { inQuotes = !inQuotes; } }
                else if (c === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
                else { current += c; }
            }
            cells.push(current.trim());

            // Columns: A(0)=?, B(1)=Mês, C(2)=Data, D(3)=KM, E(4)=Posto, F(5)=Litros, G(6)=Valor Diesel, H(7)=Valor Arla
            const mes = (cells[1] || '').trim();
            const dataRaw = (cells[2] || '').trim();
            const kmRaw = (cells[3] || '').trim();
            const posto = (cells[4] || '').trim();
            const litrosRaw = (cells[5] || '').trim();
            const valorDieselRaw = (cells[6] || '').trim();
            const valorArlaRaw = (cells[7] || '').trim();

            // Skip empty rows (separator rows between months)
            if (!mes && !dataRaw && !posto && !litrosRaw && !valorDieselRaw) continue;
            // Skip header-like rows
            if (mes === 'MÊS' || dataRaw === 'DATA') continue;

            rows.push({
                mes, dataRaw, kmRaw, posto, litrosRaw, valorDieselRaw, valorArlaRaw, placa
            });
        }
        return { placa, rows };
    },

    async processFile(file) {
        this.fileName = file.name;
        this.rawText = await file.text();
        const type = document.getElementById('import-type').value;

        if (type === 'fuelings-frota') {
            this.processFleetFile();
        } else if (type === 'freights-frota') {
            this.processFleetFreightFile();
        } else {
            this.processGenericFile();
        }
    },

    processFleetFile() {
        const { placa, rows } = this.parseFleetCSV(this.rawText, this.fileName);
        if (rows.length === 0) { Utils.showToast('Nenhum dado encontrado no arquivo', 'error'); return; }

        // Detect years from dates that have full format (dd/mm/yyyy) or infer
        const currentYear = new Date().getFullYear();

        document.getElementById('import-preview').innerHTML = `
            <div class="card"><div class="card-header"><h3>Preview — ${rows.length} linhas encontradas</h3></div><div class="card-body">
                <div class="form-row mb-2">
                    <div class="form-group"><label class="form-label">Placa (detectada)</label><input type="text" class="form-control" id="fleet-placa" value="${placa}" placeholder="Ex: JCU7I43" style="max-width:150px;font-weight:700;text-transform:uppercase"></div>
                    <div class="form-group"><label class="form-label">Ano base das datas *</label><input type="number" class="form-control" id="fleet-ano" value="${currentYear}" style="max-width:100px" placeholder="2025">
                    <small class="text-muted">Para datas dd/mm sem ano</small></div>
                </div>
                <div class="table-container mt-2" style="max-height:400px;overflow-y:auto"><table class="data-table"><thead><tr><th>Mês</th><th>Data</th><th>KM</th><th>Posto</th><th>Litros</th><th>Valor Diesel</th><th>Valor Arla</th></tr></thead><tbody>${rows.slice(0, 30).map(r => `<tr>
                    <td>${r.mes}</td><td>${r.dataRaw}</td><td>${r.kmRaw}</td><td>${r.posto}</td>
                    <td>${r.litrosRaw}</td><td>${r.valorDieselRaw}</td><td>${r.valorArlaRaw || '—'}</td>
                </tr>`).join('')}</tbody></table></div>
                ${rows.length > 30 ? `<p class="text-muted mt-1">Mostrando 30 de ${rows.length} linhas</p>` : ''}
                <button class="btn btn-primary btn-lg mt-3" onclick="Pages.dataImport.executeFleetImport()">📥 Importar ${rows.length} Abastecimentos</button>
            </div></div>`;
    },

    async executeFleetImport() {
        const placa = document.getElementById('fleet-placa').value.trim().toUpperCase();
        const anoBase = parseInt(document.getElementById('fleet-ano').value) || new Date().getFullYear();

        if (!placa) { Utils.showToast('Informe a placa do caminhão', 'warning'); return; }

        // Get or create truck
        let truck = await db.getTruckByPlaca(placa);
        if (!truck) {
            await db.add('trucks', { placa, status: 'ativo' });
            truck = await db.getTruckByPlaca(placa);
        }

        const { rows } = this.parseFleetCSV(this.rawText, this.fileName);
        const items = [];
        let errors = [];

        for (const r of rows) {
            try {
                const litros = Utils.parseNumber(r.litrosRaw);
                const valorTotal = Utils.parseNumber(r.valorDieselRaw);
                const valorArla = Utils.parseNumber(r.valorArlaRaw);
                const km = Utils.parseNumber(r.kmRaw);
                const valorLitro = litros > 0 ? parseFloat((valorTotal / litros).toFixed(4)) : 0;
                const data = Utils.parseDate(r.dataRaw, anoBase);

                if (!data || litros <= 0) { errors.push(`Linha ignorada: ${r.dataRaw} — sem data ou litros`); continue; }

                const item = {
                    truckId: truck.id,
                    data,
                    km,
                    posto: r.posto,
                    litros,
                    valorLitro,
                    valorTotal,
                    valorArla,
                    tipoComb: valorArla > 0 ? 'Diesel+Arla' : 'Diesel',
                    obs: r.mes
                };
                items.push(item);
            } catch (e) {
                errors.push(`Erro na linha ${r.dataRaw}: ${e.message}`);
            }
        }

        if (items.length === 0) { Utils.showToast('Nenhum registro válido para importar', 'error'); return; }

        if (!confirm(`Importar ${items.length} abastecimentos para ${placa}? ${errors.length ? errors.length + ' linhas com erro serão ignoradas.' : ''}`)) return;

        const result = await db.bulkAdd('fuelings', items);
        Utils.showToast(`✅ Importados ${result.added} abastecimentos para ${placa}!${errors.length ? ' ' + errors.length + ' ignorados.' : ''}`, result.added > 0 ? 'success' : 'warning');
        if (errors.length) console.warn('Import errors:', errors);
    },

    // ===== FLEET FREIGHT PARSER =====
    parseFleetFreightCSV(text, fileName) {
        const lines = text.split(/\r?\n/);
        const placaMatch = fileName.match(/([A-Z]{3}\d[A-Z0-9]\d{2})/i);
        const placa = placaMatch ? placaMatch[1].toUpperCase() : '';

        const rows = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line || !line.trim()) continue;

            // Parse CSV line respecting quotes
            const cells = [];
            let current = '', inQuotes = false;
            for (let j = 0; j < line.length; j++) {
                const c = line[j];
                if (c === '"') { if (inQuotes && line[j + 1] === '"') { current += '"'; j++; } else { inQuotes = !inQuotes; } }
                else if (c === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
                else { current += c; }
            }
            cells.push(current.trim());

            // Columns: A(0)=?, B(1)=Tipo(1/0), C(2)=Cidades, D(3)=?, E(4)=KM, F(5)=Data
            const tipoRaw = (cells[1] || '').trim();
            const cidadesRaw = (cells[2] || '').trim();
            const kmRaw = (cells[4] || '').trim();
            const dataRaw = (cells[5] || '').trim();

            // Skip empty/header rows
            if (!cidadesRaw && !dataRaw && !kmRaw) continue;
            // Skip rows that look like headers
            if (cidadesRaw.toUpperCase() === 'CIDADES' || cidadesRaw.toUpperCase() === 'ORIGEM' || dataRaw.toUpperCase() === 'DATA') continue;
            // Must have at least a city name to be valid
            if (!cidadesRaw || cidadesRaw.length < 3) continue;

            // Split "Origem - Destino" into two cities
            let origem = '', destino = '';
            const separators = [' - ', ' – ', ' — ', ' x ', ' X '];
            let found = false;
            for (const sep of separators) {
                const idx = cidadesRaw.indexOf(sep);
                if (idx > 0) {
                    origem = cidadesRaw.substring(0, idx).trim();
                    destino = cidadesRaw.substring(idx + sep.length).trim();
                    found = true;
                    break;
                }
            }
            if (!found) { origem = cidadesRaw; destino = ''; }

            const tipo = tipoRaw === '1' ? 'carregado' : tipoRaw === '0' ? 'vazio' : tipoRaw;

            rows.push({ tipo, tipoRaw, origem, destino, cidadesRaw, kmRaw, dataRaw, placa });
        }
        return { placa, rows };
    },

    processFleetFreightFile() {
        const { placa, rows } = this.parseFleetFreightCSV(this.rawText, this.fileName);
        if (rows.length === 0) { Utils.showToast('Nenhum frete encontrado no arquivo', 'error'); return; }

        const currentYear = new Date().getFullYear();

        document.getElementById('import-preview').innerHTML = `
            <div class="card"><div class="card-header"><h3>Preview — ${rows.length} fretes encontrados</h3></div><div class="card-body">
                <div class="form-row mb-2">
                    <div class="form-group"><label class="form-label">Placa (detectada)</label><input type="text" class="form-control" id="fleet-placa" value="${placa}" placeholder="Ex: JCU7I43" style="max-width:150px;font-weight:700;text-transform:uppercase"></div>
                    <div class="form-group"><label class="form-label">Ano base das datas *</label><input type="number" class="form-control" id="fleet-ano" value="${currentYear}" style="max-width:100px" placeholder="2025">
                    <small class="text-muted">Para datas dd/mm sem ano</small></div>
                </div>
                <div class="card mb-3" style="background:var(--bg-primary);border:2px solid var(--accent-primary)">
                    <div class="card-body">
                        <label class="form-label" style="font-weight:700;color:var(--accent-primary)">💲 Modalidade de Preço do Frete</label>
                        <select class="form-control" id="fleet-modalidade" onchange="Pages.dataImport.onFreightModalidadeChange()" style="max-width:350px;font-weight:600">
                            <option value="kmPlaca">📏 Taxa por KM da Placa (KM × R$/KM)</option>
                            <option value="fechado">💰 Frete Fechado (valor fixo por viagem)</option>
                        </select>
                        <div id="fleet-modalidade-info" class="mt-1" style="font-size:0.8rem;color:var(--text-secondary)"></div>
                        <div id="fleet-frete-fixo-input" style="display:none" class="mt-2">
                            <div class="form-row">
                                <div class="form-group"><label class="form-label">Valor fixo por frete R$</label>
                                <input type="number" step="0.01" class="form-control" id="fleet-frete-fixo-valor" placeholder="Ex: 2500.00" style="max-width:200px;font-weight:700"></div>
                                <div class="form-group"><label class="form-label" style="color:var(--accent-warning);font-weight:700">🤝 Comissão do Motorista R$</label>
                                <input type="number" step="0.01" class="form-control" id="fleet-comissao-fechado" placeholder="Ex: 800.00" style="max-width:200px;font-weight:700"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="table-container mt-2" style="max-height:400px;overflow-y:auto"><table class="data-table"><thead><tr><th>Tipo</th><th>Origem</th><th>Destino</th><th>KM</th><th>Data</th></tr></thead><tbody>${rows.slice(0, 30).map(r => `<tr>
                    <td><span class="badge ${r.tipo === 'carregado' ? 'badge-success' : r.tipo === 'vazio' ? 'badge-warning' : 'badge-info'}">${r.tipo}</span></td>
                    <td>${r.origem}</td><td>${r.destino || '—'}</td><td>${r.kmRaw}</td>
                    <td>${r.dataRaw}</td>
                </tr>`).join('')}</tbody></table></div>
                ${rows.length > 30 ? `<p class="text-muted mt-1">Mostrando 30 de ${rows.length} linhas</p>` : ''}
                <button class="btn btn-primary btn-lg mt-3" onclick="Pages.dataImport.executeFleetFreightImport()">📥 Importar ${rows.length} Fretes</button>
            </div></div>`;
        this.onFreightModalidadeChange();
    },

    async onFreightModalidadeChange() {
        const mod = document.getElementById('fleet-modalidade').value;
        const info = document.getElementById('fleet-modalidade-info');
        const fixoDiv = document.getElementById('fleet-frete-fixo-input');

        if (mod === 'kmPlaca') {
            fixoDiv.style.display = 'none';
            const placa = document.getElementById('fleet-placa').value.trim().toUpperCase();
            let rates;
            if (placa) {
                const truck = await db.getTruckByPlaca(placa);
                rates = truck ? await db.getKmRatesForTruck(truck.id) : await db.getKmRates();
            } else {
                rates = await db.getKmRates();
            }
            info.innerHTML = `Taxas atuais: <strong>Carregado R$ ${rates.carregado}/km</strong>  |  <strong>Vazio R$ ${rates.vazio}/km</strong><br>O valor do frete será calculado: KM × Taxa do tipo (carregado ou vazio)`;
        } else {
            fixoDiv.style.display = 'block';
            info.innerHTML = 'Todas as viagens serão importadas com o valor fixo informado abaixo.';
        }
    },

    async executeFleetFreightImport() {
        const placa = document.getElementById('fleet-placa').value.trim().toUpperCase();
        const anoBase = parseInt(document.getElementById('fleet-ano').value) || new Date().getFullYear();
        const modalidade = document.getElementById('fleet-modalidade').value;

        if (!placa) { Utils.showToast('Informe a placa do caminhão', 'warning'); return; }

        let truck = await db.getTruckByPlaca(placa);
        if (!truck) {
            await db.add('trucks', { placa, status: 'ativo' });
            truck = await db.getTruckByPlaca(placa);
        }

        // Get rates for kmPlaca mode
        let rates = null;
        if (modalidade === 'kmPlaca') {
            rates = await db.getKmRatesForTruck(truck.id);
        }

        let valorFixo = 0;
        let comissaoFixa = 0;
        if (modalidade === 'fechado') {
            valorFixo = parseFloat(document.getElementById('fleet-frete-fixo-valor').value) || 0;
            comissaoFixa = parseFloat(document.getElementById('fleet-comissao-fechado').value) || 0;
            if (valorFixo <= 0) { Utils.showToast('Informe o valor fixo do frete', 'warning'); return; }
        }

        const { rows } = this.parseFleetFreightCSV(this.rawText, this.fileName);
        const items = [];
        let errors = [];

        for (const r of rows) {
            try {
                const km = Utils.parseNumber(r.kmRaw);
                const data = Utils.parseDate(r.dataRaw, anoBase);

                if (!data) { errors.push(`Linha ignorada: ${r.cidadesRaw} — sem data`); continue; }

                let valorFrete = 0;
                let taxaKm = 0;
                if (modalidade === 'kmPlaca') {
                    taxaKm = r.tipo === 'carregado' ? rates.carregado : rates.vazio;
                    valorFrete = km * taxaKm;
                } else {
                    valorFrete = valorFixo;
                    taxaKm = km > 0 ? parseFloat((valorFixo / km).toFixed(4)) : 0;
                }

                const item = {
                    truckId: truck.id,
                    data,
                    origem: r.origem,
                    destino: r.destino,
                    km,
                    tipo: r.tipo,
                    modalidade,
                    taxaKm,
                    valorFrete: parseFloat(valorFrete.toFixed(2)),
                    comissaoFechado: modalidade === 'fechado' ? comissaoFixa : 0
                };
                items.push(item);
            } catch (e) {
                errors.push(`Erro: ${r.cidadesRaw} — ${e.message}`);
            }
        }

        if (items.length === 0) { Utils.showToast('Nenhum frete válido para importar', 'error'); return; }

        const totalValor = items.reduce((s, i) => s + i.valorFrete, 0);
        if (!confirm(`Importar ${items.length} fretes para ${placa}?\nModalidade: ${modalidade === 'kmPlaca' ? 'Taxa KM' : 'Frete Fechado'}\nValor total estimado: ${Utils.formatCurrency(totalValor)}\n${errors.length ? errors.length + ' linhas ignoradas.' : ''}`)) return;

        const result = await db.bulkAdd('freights', items);
        Utils.showToast(`✅ Importados ${result.added} fretes para ${placa}!${errors.length ? ' ' + errors.length + ' ignorados.' : ''}`, result.added > 0 ? 'success' : 'warning');
        if (errors.length) console.warn('Import errors:', errors);
    },

    // ===== GENERIC CSV IMPORT (existing) =====
    processGenericFile() {
        this.csvData = Utils.parseCSV(this.rawText);
        if (this.csvData.rows.length === 0) { Utils.showToast('Arquivo vazio ou inválido', 'error'); return; }
        const type = document.getElementById('import-type').value;
        const fieldMap = this.getFieldMap(type);
        document.getElementById('import-preview').innerHTML = `
            <div class="card"><div class="card-header"><h3>Preview — ${this.csvData.rows.length} linhas encontradas</h3></div><div class="card-body">
                <p class="text-muted mb-2">Mapeie as colunas do CSV para os campos do sistema:</p>
                <div class="form-row">${fieldMap.map(f => `<div class="form-group">
                    <label class="form-label">${f.label}</label>
                    <select class="form-control" id="map-${f.key}"><option value="">— Ignorar —</option>${this.csvData.headers.map(h => `<option value="${h}" ${h.toLowerCase().includes(f.hint) ? 'selected' : ''}>${h}</option>`).join('')}</select>
                </div>`).join('')}</div>
                <div class="table-container mt-2" style="max-height:300px;overflow-y:auto"><table class="data-table"><thead><tr>${this.csvData.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${this.csvData.rows.slice(0, 10).map(r => `<tr>${this.csvData.headers.map(h => `<td>${r[h] || ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
                ${this.csvData.rows.length > 10 ? `<p class="text-muted mt-1">Mostrando 10 de ${this.csvData.rows.length} linhas</p>` : ''}
                <button class="btn btn-primary btn-lg mt-3" onclick="Pages.dataImport.executeImport()">📥 Importar ${this.csvData.rows.length} Registros</button>
            </div></div>`;
    },
    getFieldMap(type) {
        const maps = {
            fuelings: [{ key: 'placa', label: 'Placa', hint: 'placa' }, { key: 'data', label: 'Data', hint: 'data' }, { key: 'litros', label: 'Litros', hint: 'litr' }, { key: 'valorLitro', label: 'Valor/Litro', hint: 'litro' }, { key: 'valorTotal', label: 'Total', hint: 'total' }, { key: 'km', label: 'KM', hint: 'km' }, { key: 'posto', label: 'Posto', hint: 'posto' }, { key: 'tipoComb', label: 'Combustível', hint: 'comb' }],
            freights: [{ key: 'placa', label: 'Placa', hint: 'placa' }, { key: 'data', label: 'Data', hint: 'data' }, { key: 'origem', label: 'Origem', hint: 'orig' }, { key: 'destino', label: 'Destino', hint: 'dest' }, { key: 'km', label: 'KM', hint: 'km' }, { key: 'tipo', label: 'Tipo (carregado/vazio)', hint: 'tipo' }, { key: 'valorFrete', label: 'Valor Frete', hint: 'valor' }, { key: 'cliente', label: 'Cliente', hint: 'client' }],
            fines: [{ key: 'placa', label: 'Placa', hint: 'placa' }, { key: 'data', label: 'Data', hint: 'data' }, { key: 'descricao', label: 'Descrição', hint: 'desc' }, { key: 'valor', label: 'Valor', hint: 'valor' }, { key: 'local', label: 'Local', hint: 'local' }, { key: 'pontos', label: 'Pontos', hint: 'pont' }, { key: 'status', label: 'Status', hint: 'status' }],
            trucks: [{ key: 'placa', label: 'Placa', hint: 'placa' }, { key: 'modelo', label: 'Modelo', hint: 'model' }, { key: 'ano', label: 'Ano', hint: 'ano' }, { key: 'motorista', label: 'Motorista', hint: 'motor' }]
        };
        return maps[type] || [];
    },
    async executeImport() {
        const type = document.getElementById('import-type').value;
        const fieldMap = this.getFieldMap(type);
        const mapping = {};
        fieldMap.forEach(f => { const sel = document.getElementById('map-' + f.key); if (sel) mapping[f.key] = sel.value; });

        const items = [];
        for (const row of this.csvData.rows) {
            const item = {};
            for (const [field, col] of Object.entries(mapping)) {
                if (!col) continue;
                let val = row[col] || '';
                if (['litros', 'valorLitro', 'valorTotal', 'valor', 'km', 'pontos', 'ano', 'valorFrete', 'taxaKm'].includes(field)) val = Utils.parseNumber(val);
                else if (field === 'data') val = Utils.parseDate(val);
                else if (field === 'placa') val = val.toUpperCase().trim();
                item[field] = val;
            }
            // Resolve placa to truckId
            if (item.placa && type !== 'trucks') {
                let truck = await db.getTruckByPlaca(item.placa);
                if (!truck) { await db.add('trucks', { placa: item.placa, status: 'ativo' }); truck = await db.getTruckByPlaca(item.placa); }
                item.truckId = truck.id;
                delete item.placa;
            }
            if (type === 'trucks' && item.placa) item.status = item.status || 'ativo';
            items.push(item);
        }

        const storeName = type;
        const result = await db.bulkAdd(storeName, items);
        Utils.showToast(`Importados ${result.added} registros! ${result.errors.length ? result.errors.length + ' erros.' : ''}`, result.errors.length ? 'warning' : 'success');
        if (result.errors.length) console.warn('Import errors:', result.errors);
    }
};
