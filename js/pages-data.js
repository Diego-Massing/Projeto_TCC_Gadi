// ===== FUELINGS PAGE =====
Pages.fuelings = {
    async render() {
        const trucks = await db.getAll('trucks');
        let fuelings = await db.getAll('fuelings');
        fuelings.sort((a, b) => b.data?.localeCompare(a.data));
        const isDriver = App.userRole === 'motorista';
        const isViewer = App.userRole === 'visualizador';

        // Driver: filter to only their truck
        if (isDriver && App.userTruckId) {
            fuelings = fuelings.filter(f => f.truckId === App.userTruckId);
        }
        const driverTruck = isDriver ? trucks.find(t => t.id === App.userTruckId) : null;
        const subtitle = isDriver && driverTruck ? `Abastecimentos — ${driverTruck.placa}` : 'Planilha geral — todas as placas';

        const addBtn = isViewer ? '' : `<button class="btn btn-primary" onclick="Pages.fuelings.showForm()">＋ Novo Abastecimento</button>`;
        const exportBtn = isDriver ? '' : `<button class="btn btn-secondary btn-sm" onclick="Pages.fuelings.exportCSV()">📥 Exportar CSV</button>`;
        const truckFilter = isDriver ? '' : `<div class="form-group"><label class="form-label">Placa</label><select class="form-control" id="filter-fuel-truck" onchange="Pages.fuelings.applyFilter()"><option value="">Todas</option>${trucks.map(t => `<option value="${t.id}">${t.placa}</option>`).join('')}</select></div>`;

        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">Abastecimentos</h1><p class="page-subtitle">${subtitle}</p></div>
                <div class="btn-group">${exportBtn}${addBtn}</div>
            </div></div>
            <div class="page-body">
                <div class="filter-bar">
                    ${truckFilter}
                    <div class="form-group"><label class="form-label">De</label><input type="date" class="form-control" id="filter-fuel-from" onchange="Pages.fuelings.applyFilter()"></div>
                    <div class="form-group"><label class="form-label">Até</label><input type="date" class="form-control" id="filter-fuel-to" onchange="Pages.fuelings.applyFilter()"></div>
                </div>
                <div id="fuelings-table">${this.renderTable(fuelings, trucks)}</div>
            </div>`;
    },

    renderTable(fuelings, trucks) {
        if (fuelings.length === 0) return '<div class="empty-state"><div class="empty-icon">⛽</div><h3>Nenhum abastecimento</h3></div>';
        const total = fuelings.reduce((s, f) => s + (f.valorTotal || 0), 0);
        const totalL = fuelings.reduce((s, f) => s + (f.litros || 0), 0);
        return `<div class="table-container"><table class="data-table"><thead><tr><th>Placa</th><th>Data</th><th>Posto</th><th>Litros</th><th>R$/L</th><th>KM</th><th>Total</th><th>Tipo</th><th></th></tr></thead><tbody>${fuelings.map(f => {
            const t = trucks.find(tt => tt.id === f.truckId); return `<tr>
                <td class="font-mono font-bold">${t?.placa || '—'}</td><td>${Utils.formatDate(f.data)}</td><td>${f.posto || '—'}</td>
                <td>${Utils.formatNumber(f.litros, 2)}</td><td>${Utils.formatCurrency(f.valorLitro)}</td><td>${Utils.formatNumber(f.km)}</td>
                <td class="font-bold">${Utils.formatCurrency(f.valorTotal)}</td><td><span class="badge badge-info">${f.tipoComb || 'Diesel'}</span></td>
                <td>${App.userRole !== 'visualizador' ? `<button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.fuelings.showForm(${f.id})">✏️</button> <button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.fuelings.remove(${f.id})">🗑️</button>` : ''}</td>
            </tr>`;
        }).join('')}</tbody></table></div>
            <div class="table-footer"><span>${fuelings.length} registros</span><span><strong>Total: ${Utils.formatCurrency(total)}</strong> — ${Utils.formatNumber(totalL, 1)} litros</span></div>`;
    },

    async applyFilter() {
        const trucks = await db.getAll('trucks');
        let fuelings = await db.getAll('fuelings');
        // Driver: always filter by their truck
        if (App.userRole === 'motorista' && App.userTruckId) {
            fuelings = fuelings.filter(f => f.truckId === App.userTruckId);
        } else {
            const truckId = document.getElementById('filter-fuel-truck')?.value;
            if (truckId) fuelings = fuelings.filter(f => f.truckId === parseInt(truckId));
        }
        const from = document.getElementById('filter-fuel-from')?.value;
        const to = document.getElementById('filter-fuel-to')?.value;
        if (from) fuelings = fuelings.filter(f => f.data >= from);
        if (to) fuelings = fuelings.filter(f => f.data <= to);
        fuelings.sort((a, b) => b.data?.localeCompare(a.data));
        document.getElementById('fuelings-table').innerHTML = this.renderTable(fuelings, trucks);
    },

    async showForm(id, presetTruckId) {
        const trucks = await db.getAll('trucks');
        let item = null;
        if (id) item = await db.getById('fuelings', id);
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Abastecimento' : 'Novo Abastecimento';
        modal.querySelector('.modal-body').innerHTML = `
            <div style="margin-bottom:16px">
                <input type="file" id="receipt-upload" accept="image/*" capture="environment" style="display:none" onchange="Pages.fuelings.handleReceiptUpload(event)">
                <button class="btn btn-success" onclick="document.getElementById('receipt-upload').click()" style="width:100%;padding:14px;font-size:1rem">
                    📸 Ler Cupom Fiscal com IA
                </button>
                <div id="ocr-status" style="margin-top:8px;font-size:0.85rem;text-align:center"></div>
            </div>
            <hr style="border-color:#333;margin:0 0 16px 0">
            <div class="form-row">
                <div class="form-group"><label class="form-label">Caminhão *</label><select class="form-control" id="f-truckId" ${App.userRole === 'motorista' ? 'disabled' : ''}><option value="">Selecione</option>${trucks.map(t => `<option value="${t.id}" ${(item?.truckId === t.id || presetTruckId === t.id || (App.userRole === 'motorista' && App.userTruckId === t.id)) ? 'selected' : ''}>${t.placa}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Data *</label><input type="date" class="form-control" id="f-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Litros *</label><input type="number" step="0.01" class="form-control" id="f-litros" value="${item?.litros || ''}" oninput="Pages.fuelings.calcTotal()"></div>
                <div class="form-group"><label class="form-label">Valor/Litro *</label><input type="number" step="0.01" class="form-control" id="f-valorLitro" value="${item?.valorLitro || ''}" oninput="Pages.fuelings.calcTotal()"></div>
                <div class="form-group"><label class="form-label">Total</label><input type="number" step="0.01" class="form-control" id="f-valorTotal" value="${item?.valorTotal || ''}" readonly style="font-weight:700"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">KM Atual</label><input type="number" class="form-control" id="f-km" value="${item?.km || ''}"></div>
                <div class="form-group"><label class="form-label">Posto</label><input type="text" class="form-control" id="f-posto" value="${item?.posto || ''}"></div>
                <div class="form-group"><label class="form-label">Combustível</label><select class="form-control" id="f-tipoComb"><option value="Diesel" ${item?.tipoComb === 'Diesel' ? 'selected' : ''}>Diesel</option><option value="Diesel S-10" ${item?.tipoComb === 'Diesel S-10' ? 'selected' : ''}>Diesel S-10</option><option value="Arla" ${item?.tipoComb === 'Arla' ? 'selected' : ''}>Arla</option></select></div>
            </div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.fuelings.save(${id || 'null'})">Salvar</button>`;
        App.openModal();
    },

    async handleReceiptUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('ocr-status');
        statusEl.innerHTML = '<span style="color:#6366f1">🔄 Analisando cupom com IA... aguarde</span>';

        try {
            await OCR.loadApiKey();
            const data = await OCR.extractFromReceipt(file);
            const filled = OCR.fillFuelingForm(data);
            statusEl.innerHTML = `<span style="color:#22c55e">✅ ${filled} campos preenchidos automaticamente!</span>`;

            // Show extracted data summary
            const parts = [];
            if (data.litros) parts.push(`${data.litros}L`);
            if (data.valorTotal) parts.push(`R$${data.valorTotal}`);
            if (data.posto) parts.push(data.posto);
            if (parts.length) statusEl.innerHTML += `<br><span style="color:#94a3b8;font-size:0.8rem">${parts.join(' • ')}</span>`;
        } catch (e) {
            console.error('OCR Error:', e);
            statusEl.innerHTML = `<span style="color:#ef4444">❌ ${e.message}</span>`;
        }

        // Reset file input so same file can be re-selected
        event.target.value = '';
    },

    calcTotal() {
        const l = parseFloat(document.getElementById('f-litros').value) || 0;
        const v = parseFloat(document.getElementById('f-valorLitro').value) || 0;
        document.getElementById('f-valorTotal').value = (l * v).toFixed(2);
    },

    async save(id) {
        const truckId = parseInt(document.getElementById('f-truckId').value) || App.userTruckId;
        if (!truckId) { Utils.showToast('Selecione o caminhão', 'warning'); return; }
        const data = { truckId, data: document.getElementById('f-data').value, litros: parseFloat(document.getElementById('f-litros').value) || 0, valorLitro: parseFloat(document.getElementById('f-valorLitro').value) || 0, valorTotal: parseFloat(document.getElementById('f-valorTotal').value) || 0, km: parseInt(document.getElementById('f-km').value) || 0, posto: document.getElementById('f-posto').value.trim(), tipoComb: document.getElementById('f-tipoComb').value };
        try {
            if (id) { data.id = id; await db.update('fuelings', data); } else { await db.add('fuelings', data); }
            Utils.showToast(id ? 'Atualizado!' : 'Abastecimento registrado!', 'success');
            App.closeModal(); App.refreshCurrentPage();
        } catch (e) { Utils.showToast('Erro ao salvar', 'error'); }
    },

    async remove(id) {
        if (!confirm('Excluir este abastecimento?')) return;
        await db.delete('fuelings', id); Utils.showToast('Excluído', 'success'); App.refreshCurrentPage();
    },

    async exportCSV() {
        const fuelings = await db.getAll('fuelings');
        const trucks = await db.getAll('trucks');
        const data = fuelings.map(f => { const t = trucks.find(tt => tt.id === f.truckId); return { Placa: t?.placa || '', Data: Utils.formatDate(f.data), Posto: f.posto, Litros: f.litros, ValorLitro: f.valorLitro, Total: f.valorTotal, KM: f.km, Combustivel: f.tipoComb }; });
        Utils.exportToCSV(data, 'abastecimentos.csv');
    }
};

// ===== FREIGHTS PAGE =====
Pages.freights = {
    async render() {
        const trucks = await db.getAll('trucks');
        const freights = await db.getAll('freights');
        const rates = await db.getKmRates();
        freights.sort((a, b) => b.data?.localeCompare(a.data));
        const { mes, ano } = Utils.getCurrentMonth();

        const isDriver = App.userRole === 'motorista';
        const isViewer = App.userRole === 'visualizador';

        // Driver: filter to only their truck
        if (isDriver && App.userTruckId) {
            freights = freights.filter(f => f.truckId === App.userTruckId);
        }
        const driverTruck = isDriver ? trucks.find(t => t.id === App.userTruckId) : null;
        const subtitle = isDriver && driverTruck ? `Fretes — ${driverTruck.placa}` : `Planilha geral — Padrão: Carregado ${Utils.formatCurrency(rates.carregado)}/km | Vazio ${Utils.formatCurrency(rates.vazio)}/km`;

        const addBtn = isViewer ? '' : `<button class="btn btn-primary" onclick="Pages.freights.showForm()">＋ Novo Frete</button>`;
        const exportBtn = isDriver ? '' : `<button class="btn btn-secondary btn-sm" onclick="Pages.freights.exportCSV()">📥 Exportar</button>`;
        const truckFilter = isDriver ? '' : `<div class="form-group"><label class="form-label">Placa</label><select class="form-control" id="filter-fr-truck" onchange="Pages.freights.applyFilter()"><option value="">Todas</option>${trucks.map(t => `<option value="${t.id}">${t.placa}</option>`).join('')}</select></div>`;

        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">Fretes</h1><p class="page-subtitle">${subtitle}</p></div>
                <div class="btn-group">${exportBtn}${addBtn}</div>
            </div></div>
            <div class="page-body">
                <div class="filter-bar">
                    <div class="form-group"><label class="form-label">Mês/Ano</label>
                        <div style="display:flex;gap:4px">
                            <select class="form-control" id="filter-fr-mes" onchange="Pages.freights.applyFilter()" style="width:110px">
                                <option value="">Todos</option>
                                ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === mes ? 'selected' : ''}>${Utils.getMonthName(i + 1)}</option>`).join('')}
                            </select>
                            <input type="number" class="form-control" id="filter-fr-ano" value="${ano}" onchange="Pages.freights.applyFilter()" style="width:80px">
                        </div>
                    </div>
                    ${truckFilter}
                    <div class="form-group"><label class="form-label">Tipo</label><select class="form-control" id="filter-fr-tipo" onchange="Pages.freights.applyFilter()"><option value="">Todos</option><option value="carregado">Carregado</option><option value="vazio">Vazio</option></select></div>
                </div>
                <!-- Advanced Date Filter (Collapsed by default) -->
                <details style="margin-bottom:16px;font-size:0.85rem"><summary style="cursor:pointer;color:var(--text-secondary)">Filtro avançado de data</summary>
                    <div class="filter-bar" style="margin-top:8px;background:var(--bg-secondary);padding:10px;border-radius:6px">
                        <div class="form-group"><label class="form-label">De</label><input type="date" class="form-control" id="filter-fr-from" onchange="Pages.freights.applyFilter(true)"></div>
                        <div class="form-group"><label class="form-label">Até</label><input type="date" class="form-control" id="filter-fr-to" onchange="Pages.freights.applyFilter(true)"></div>
                    </div>
                </details>
                <div id="freights-table">${this.renderTable(freights.filter(f => {
            // Initial render filter by current month
            const d = new Date(f.data);
            return d.getMonth() + 1 === mes && d.getFullYear() === ano;
        }), trucks)}</div>
            </div>`;
    },

    renderTable(freights, trucks) {
        if (freights.length === 0) return '<div class="empty-state"><div class="empty-icon">📦</div><h3>Nenhum frete encontrado</h3></div>';
        const total = freights.reduce((s, f) => s + (f.valorFrete || 0), 0);
        const totalKm = freights.reduce((s, f) => s + (f.km || 0), 0);
        const modalLabels = { kmPlaca: '🚛 Placa', kmSistema: '⚙️ Sistema', fechado: '🔒 Fechado' };
        const modalColors = { kmPlaca: 'badge-info', kmSistema: 'badge-warning', fechado: 'badge-success' };
        return `<div id="bulk-actions-bar" style="display:none;padding:10px 16px;background:var(--accent-danger);color:#fff;border-radius:var(--radius-md);margin-bottom:8px;align-items:center;justify-content:space-between;gap:12px;font-weight:600">
                <span>🗑️ <span id="bulk-count">0</span> fretes selecionados</span>
                <div style="display:flex;gap:8px">
                    <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4)" onclick="Pages.freights.toggleAllFreights(false)">Desmarcar todos</button>
                    <button class="btn btn-sm" style="background:#fff;color:var(--accent-danger);font-weight:700" onclick="Pages.freights.deleteSelected()">🗑️ Excluir Selecionados</button>
                </div>
            </div>
            <div class="table-container"><table class="data-table"><thead><tr><th style="width:36px"><input type="checkbox" id="select-all-freights" onchange="Pages.freights.toggleAllFreights(this.checked)" title="Selecionar todos"></th><th>Placa</th><th>Data</th><th>Origem</th><th>Destino</th><th>KM</th><th>Tipo</th><th>Modalidade</th><th>R$/KM</th><th>Valor Frete</th><th>Cliente</th><th></th></tr></thead><tbody>${freights.map(f => {
            const t = trucks.find(tt => tt.id === f.truckId);
            const mod = f.modalidade || 'kmSistema';
            return `<tr>
                <td><input type="checkbox" class="freight-checkbox" value="${f.id}" onchange="Pages.freights.updateBulkBar()"></td>
                <td class="font-mono font-bold">${t?.placa || '—'}</td><td>${Utils.formatDate(f.data)}</td><td>${f.origem || '—'}</td><td>${f.destino || '—'}</td>
                <td>${Utils.formatNumber(f.km)}</td><td><span class="badge ${f.tipo === 'carregado' ? 'badge-success' : 'badge-warning'}">${f.tipo || '—'}</span></td>
                <td><span class="badge ${modalColors[mod] || 'badge-info'}" style="font-size:0.68rem">${modalLabels[mod] || mod}</span></td>
                <td>${mod === 'fechado' ? `<span class="text-muted" style="font-size:0.75rem">${Utils.formatCurrency(f.taxaKmEfetiva || f.taxaKm)}</span>` : Utils.formatCurrency(f.taxaKm)}</td>
                <td class="font-bold text-success">${Utils.formatCurrency(f.valorFrete)}</td><td>${f.cliente || '—'}</td>
                <td>${App.userRole !== 'visualizador' ? `<button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.freights.showForm(${f.id})">✏️</button> <button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.freights.remove(${f.id})">🗑️</button>` : ''}</td>
            </tr>`;
        }).join('')}</tbody></table></div>
            <div class="table-footer"><span>${freights.length} fretes — ${Utils.formatNumber(totalKm)} km total</span><span><strong>Total: ${Utils.formatCurrency(total)}</strong></span></div>`;
    },

    updateBulkBar() {
        const checked = document.querySelectorAll('.freight-checkbox:checked');
        const bar = document.getElementById('bulk-actions-bar');
        const countEl = document.getElementById('bulk-count');
        if (checked.length > 0) {
            bar.style.display = 'flex';
            countEl.textContent = checked.length;
        } else {
            bar.style.display = 'none';
        }
    },

    toggleAllFreights(checked) {
        document.querySelectorAll('.freight-checkbox').forEach(cb => cb.checked = checked);
        this.updateBulkBar();
    },

    async deleteSelected() {
        const checked = document.querySelectorAll('.freight-checkbox:checked');
        const ids = Array.from(checked).map(cb => parseInt(cb.value));
        if (ids.length === 0) return;
        if (!confirm(`⚠️ Excluir ${ids.length} fretes permanentemente?\n\nEsta ação não pode ser desfeita!`)) return;

        let deleted = 0;
        for (const id of ids) {
            try { await db.delete('freights', id); deleted++; } catch (e) { console.error('Erro ao excluir frete', id, e); }
        }
        Utils.showToast(`🗑️ ${deleted} fretes excluídos!`, 'success');
        App.refreshCurrentPage();
    },

    async applyFilter(useDateRange = false) {
        let freights = await db.getAll('freights');
        const trucks = await db.getAll('trucks');
        // Driver: always filter by their truck
        if (App.userRole === 'motorista' && App.userTruckId) {
            freights = freights.filter(f => f.truckId === App.userTruckId);
        } else {
            const tid = document.getElementById('filter-fr-truck')?.value;
            if (tid) freights = freights.filter(f => f.truckId === parseInt(tid));
        }
        const tipo = document.getElementById('filter-fr-tipo')?.value;

        // Date logic
        if (useDateRange) {
            // If user touched date inputs, clear month select to avoid confusion
            document.getElementById('filter-fr-mes').value = '';
            const from = document.getElementById('filter-fr-from').value;
            const to = document.getElementById('filter-fr-to').value;
            if (from) freights = freights.filter(f => f.data >= from);
            if (to) freights = freights.filter(f => f.data <= to);
        } else {
            // Month/Year filter
            const mes = parseInt(document.getElementById('filter-fr-mes').value);
            const ano = parseInt(document.getElementById('filter-fr-ano').value);
            // Clear date inputs
            document.getElementById('filter-fr-from').value = '';
            document.getElementById('filter-fr-to').value = '';

            if (mes && ano) {
                freights = freights.filter(f => {
                    const d = new Date(f.data);
                    return d.getMonth() + 1 === mes && d.getFullYear() === ano;
                });
            }
        }

        if (tipo) freights = freights.filter(f => f.tipo === tipo);

        freights.sort((a, b) => b.data?.localeCompare(a.data));
        document.getElementById('freights-table').innerHTML = this.renderTable(freights, trucks);
    },

    async showForm(id, presetTruckId) {
        const trucks = await db.getAll('trucks');
        let item = null;
        if (id) item = await db.getById('freights', id);
        const currentMod = item?.modalidade || 'kmPlaca';
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Frete' : 'Novo Frete';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-row">
                <div class="form-group"><label class="form-label">Caminhão *</label><select class="form-control" id="f-truckId" onchange="Pages.freights.onTruckChange()" ${App.userRole === 'motorista' ? 'disabled' : ''}><option value="">Selecione</option>${trucks.map(t => `<option value="${t.id}" ${(item?.truckId === t.id || presetTruckId === t.id || (App.userRole === 'motorista' && App.userTruckId === t.id)) ? 'selected' : ''}>${t.placa}${t.kmCarregado != null ? ' 💰' : ''}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Data *</label><input type="date" class="form-control" id="f-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Cidade Origem *</label><input type="text" class="form-control" id="f-origem" value="${item?.origem || ''}" placeholder="Ex: São Paulo"></div>
                <div class="form-group"><label class="form-label">Cidade Destino *</label><input type="text" class="form-control" id="f-destino" value="${item?.destino || ''}" placeholder="Ex: Curitiba"></div>
                <button class="btn btn-secondary btn-sm" onclick="Pages.freights.calcDistance()" style="margin-top:20px;white-space:nowrap" title="Calcular KM via OSRM (gratuito)">📏 Calcular KM</button>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">KM da Rota</label><input type="number" class="form-control" id="f-km" value="${item?.km || ''}" oninput="Pages.freights.calcFrete()"></div>
                <div class="form-group"><label class="form-label">Tipo Viagem *</label><select class="form-control" id="f-tipo" onchange="Pages.freights.calcFrete()"><option value="carregado" ${item?.tipo === 'carregado' ? 'selected' : ''}>🟢 Carregado</option><option value="vazio" ${item?.tipo === 'vazio' ? 'selected' : ''}>🟡 Vazio</option></select></div>
            </div>
            <div style="margin:12px 0;padding:12px;background:var(--bg-primary);border-radius:var(--radius-md)">
                <label class="form-label" style="font-weight:700;color:var(--accent-primary)">💲 Modalidade de Preço</label>
                <select class="form-control" id="f-modalidade" onchange="Pages.freights.onModalidadeChange()" style="font-weight:600">
                    <option value="kmPlaca" ${currentMod === 'kmPlaca' ? 'selected' : ''}>🚛 Por KM — Taxa da Placa</option>
                    <option value="kmSistema" ${currentMod === 'kmSistema' ? 'selected' : ''}>⚙️ Por KM — Taxa do Sistema (padrão global)</option>
                    <option value="fechado" ${currentMod === 'fechado' ? 'selected' : ''}>🔒 Valor Fechado (fixo)</option>
                </select>
                <div id="modalidade-info" style="margin-top:6px;font-size:0.75rem"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">R$/KM</label><input type="number" step="0.01" class="form-control" id="f-taxaKm" value="${item?.taxaKm || ''}" readonly style="opacity:0.7"></div>
                <div class="form-group"><label class="form-label">Valor Frete</label><input type="number" step="0.01" class="form-control" id="f-valorFrete" value="${item?.valorFrete || ''}" style="font-weight:700;font-size:1.1rem" oninput="Pages.freights.onValorFreteInput()"></div>
            </div>
            <div id="taxa-efetiva-row" style="display:none;margin-bottom:8px">
                <span class="text-muted" style="font-size:0.8rem">💡 R$/KM efetivo: </span><strong id="taxa-efetiva-value" class="text-success">—</strong>
            </div>
            <div id="comissao-fechado-row" style="display:none">
                <div class="form-group"><label class="form-label" style="font-weight:700;color:var(--accent-warning)">🤝 Comissão do Motorista (Frete Fechado)</label><input type="number" step="0.01" class="form-control" id="f-comissaoFechado" value="${item?.comissaoFechado || ''}" placeholder="Valor que o motorista recebe por esta viagem" style="font-weight:700;font-size:1.1rem"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Cliente</label><input type="text" class="form-control" id="f-cliente" value="${item?.cliente || ''}"></div>
                <div class="form-group"><label class="form-label">Nota Fiscal</label><input type="text" class="form-control" id="f-notaFiscal" value="${item?.notaFiscal || ''}"></div>
            </div>
            <div class="form-group"><label class="form-label">Observações</label><input type="text" class="form-control" id="f-obs" value="${item?.obs || ''}"></div>
            <div id="maps-result" style="margin-top:8px"></div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.freights.save(${id || 'null'})">Salvar</button>`;
        App.openModal();
        // Initialize
        setTimeout(() => {
            this.onModalidadeChange();
            this.calcFrete();
        }, 100);
    },

    async onTruckChange() {
        const modalidade = document.getElementById('f-modalidade')?.value;
        if (modalidade === 'kmPlaca') {
            this.calcFrete();
        }
    },

    async onModalidadeChange() {
        const mod = document.getElementById('f-modalidade').value;
        const valorFreteEl = document.getElementById('f-valorFrete');
        const taxaKmEl = document.getElementById('f-taxaKm');
        const efRow = document.getElementById('taxa-efetiva-row');
        const infoEl = document.getElementById('modalidade-info');

        if (mod === 'fechado') {
            valorFreteEl.readOnly = false;
            valorFreteEl.style.opacity = '1';
            taxaKmEl.style.display = 'none';
            taxaKmEl.parentElement.style.display = 'none';
            efRow.style.display = 'block';
            const comRow = document.getElementById('comissao-fechado-row');
            if (comRow) comRow.style.display = 'block';
            infoEl.innerHTML = '<span class="text-muted">Informe o valor total do frete e a comissão que o motorista receberá por esta viagem.</span>';
            this.updateTaxaEfetiva();
        } else {
            valorFreteEl.readOnly = true;
            valorFreteEl.style.opacity = '0.7';
            taxaKmEl.style.display = '';
            taxaKmEl.parentElement.style.display = '';
            efRow.style.display = 'none';
            const comRow2 = document.getElementById('comissao-fechado-row');
            if (comRow2) comRow2.style.display = 'none';
            if (mod === 'kmPlaca') {
                const truckId = parseInt(document.getElementById('f-truckId').value);
                if (truckId) {
                    const rates = await db.getKmRatesForTruck(truckId);
                    infoEl.innerHTML = `<span class="${rates.isCustom ? 'text-success' : 'text-muted'}">${rates.isCustom ? '🚛 Usando taxa desta placa' : '⚙️ Placa sem taxa própria — usando padrão'}: Carregado ${Utils.formatCurrency(rates.carregado)}/km | Vazio ${Utils.formatCurrency(rates.vazio)}/km</span>`;
                } else {
                    infoEl.innerHTML = '<span class="text-muted">Selecione um caminhão para ver a taxa.</span>';
                }
            } else {
                const rates = await db.getKmRates();
                infoEl.innerHTML = `<span class="text-muted">⚙️ Taxa global do sistema: Carregado ${Utils.formatCurrency(rates.carregado)}/km | Vazio ${Utils.formatCurrency(rates.vazio)}/km</span>`;
            }
            this.calcFrete();
        }
    },

    async calcFrete() {
        const mod = document.getElementById('f-modalidade')?.value || 'kmSistema';
        if (mod === 'fechado') { this.updateTaxaEfetiva(); return; }

        const truckId = parseInt(document.getElementById('f-truckId').value) || null;
        const tipo = document.getElementById('f-tipo').value;
        const km = parseFloat(document.getElementById('f-km').value) || 0;

        let rates;
        if (mod === 'kmPlaca') {
            rates = await db.getKmRatesForTruck(truckId);
        } else {
            rates = await db.getKmRates();
        }

        const taxa = tipo === 'carregado' ? rates.carregado : rates.vazio;
        document.getElementById('f-taxaKm').value = taxa.toFixed(2);
        document.getElementById('f-valorFrete').value = (km * taxa).toFixed(2);
    },

    onValorFreteInput() {
        const mod = document.getElementById('f-modalidade')?.value;
        if (mod === 'fechado') {
            this.updateTaxaEfetiva();
        }
    },

    updateTaxaEfetiva() {
        const km = parseFloat(document.getElementById('f-km').value) || 0;
        const valor = parseFloat(document.getElementById('f-valorFrete').value) || 0;
        const efetiva = km > 0 && valor > 0 ? (valor / km) : 0;
        const el = document.getElementById('taxa-efetiva-value');
        if (el) el.textContent = efetiva > 0 ? Utils.formatCurrency(efetiva) + '/km' : '—';
    },

    async calcDistance() {
        const origem = document.getElementById('f-origem').value.trim();
        const destino = document.getElementById('f-destino').value.trim();
        if (!origem || !destino) { Utils.showToast('Informe origem e destino', 'warning'); return; }
        document.getElementById('maps-result').innerHTML = '<span class="text-muted">Calculando distância...</span>';
        const result = await MapsService.getDistanceBetweenCities(origem, destino);
        if (result.error) {
            document.getElementById('maps-result').innerHTML = `<span class="badge badge-danger">❌ ${result.error}</span>`;
            Utils.showToast(result.error, 'error');
        } else {
            document.getElementById('f-km').value = result.distanceKm;
            document.getElementById('maps-result').innerHTML = `<span class="badge badge-info">📍 ${result.distanceKm} km — ${result.durationText}</span>`;
            this.calcFrete();
            Utils.showToast(`${result.distanceKm} km calculados!`, 'success');
        }
    },

    async save(id) {
        const truckId = parseInt(document.getElementById('f-truckId').value) || App.userTruckId;
        if (!truckId) { Utils.showToast('Selecione o caminhão', 'warning'); return; }
        const mod = document.getElementById('f-modalidade').value;
        const km = parseFloat(document.getElementById('f-km').value) || 0;
        const valorFrete = parseFloat(document.getElementById('f-valorFrete').value) || 0;
        const taxaKm = parseFloat(document.getElementById('f-taxaKm').value) || 0;
        const taxaKmEfetiva = mod === 'fechado' && km > 0 ? parseFloat((valorFrete / km).toFixed(4)) : taxaKm;

        const data = {
            truckId,
            data: document.getElementById('f-data').value,
            origem: document.getElementById('f-origem').value.trim(),
            destino: document.getElementById('f-destino').value.trim(),
            km, tipo: document.getElementById('f-tipo').value,
            modalidade: mod,
            taxaKm: mod === 'fechado' ? 0 : taxaKm,
            taxaKmEfetiva,
            valorFrete,
            comissaoFechado: mod === 'fechado' ? (parseFloat(document.getElementById('f-comissaoFechado').value) || 0) : 0,
            cliente: document.getElementById('f-cliente').value.trim(),
            notaFiscal: document.getElementById('f-notaFiscal').value.trim(),
            obs: document.getElementById('f-obs').value.trim()
        };
        try {
            if (id) { data.id = id; await db.update('freights', data); } else { await db.add('freights', data); }
            Utils.showToast(id ? 'Frete atualizado!' : 'Frete registrado!', 'success'); App.closeModal(); App.refreshCurrentPage();
        } catch (e) { Utils.showToast('Erro ao salvar', 'error'); }
    },

    async remove(id) { if (!confirm('Excluir?')) return; await db.delete('freights', id); Utils.showToast('Excluído', 'success'); App.refreshCurrentPage(); },

    async exportCSV() {
        const freights = await db.getAll('freights');
        const trucks = await db.getAll('trucks');
        Utils.exportToCSV(freights.map(f => { const t = trucks.find(tt => tt.id === f.truckId); return { Placa: t?.placa || '', Data: Utils.formatDate(f.data), Origem: f.origem, Destino: f.destino, KM: f.km, Tipo: f.tipo, Modalidade: f.modalidade || 'kmSistema', TaxaKM: f.taxaKm, TaxaEfetiva: f.taxaKmEfetiva || '', ValorFrete: f.valorFrete, Cliente: f.cliente, NF: f.notaFiscal }; }), 'fretes.csv');
    }
};

// ===== TRUCK EXPENSES PAGE =====
Pages.truckExpenses = {
    async render() {
        const trucks = await db.getAll('trucks');
        const expenses = await db.getAll('truckExpenses');
        expenses.sort((a, b) => b.data?.localeCompare(a.data));
        const { mes, ano } = Utils.getCurrentMonth();

        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">Despesas da Frota</h1><p class="page-subtitle">Manutenção, prestações, seguros e custos fixos</p></div>
                <div class="btn-group">${App.userRole === 'admin' ? `<button class="btn btn-secondary btn-sm" onclick="Pages.truckExpenses.exportCSV()">📥 Exportar</button><button class="btn btn-primary" onclick="Pages.truckExpenses.showForm()">＋ Nova Despesa</button>` : ''}</div>
            </div></div>
            <div class="page-body">
                <div class="filter-bar">
                    <div class="form-group"><label class="form-label">Mês/Ano</label>
                        <div style="display:flex;gap:4px">
                            <select class="form-control" id="filter-te-mes" onchange="Pages.truckExpenses.applyFilter()" style="width:110px">
                                <option value="">Todos</option>
                                ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === mes ? 'selected' : ''}>${Utils.getMonthName(i + 1)}</option>`).join('')}
                            </select>
                            <input type="number" class="form-control" id="filter-te-ano" value="${ano}" onchange="Pages.truckExpenses.applyFilter()" style="width:80px">
                        </div>
                    </div>
                    <div class="form-group"><label class="form-label">Placa</label><select class="form-control" id="filter-te-truck" onchange="Pages.truckExpenses.applyFilter()"><option value="">Todas</option>${trucks.map(t => `<option value="${t.id}">${t.placa}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Tipo</label><select class="form-control" id="filter-te-tipo" onchange="Pages.truckExpenses.applyFilter()">
                        <option value="">Todos</option>
                        <option value="Manutenção">Manutenção</option>
                        <option value="Prestação">Prestação</option>
                        <option value="Seguro">Seguro</option>
                        <option value="Rastreador">Rastreador</option>
                        <option value="Salário">Salário</option>
                        <option value="Outros">Outros</option>
                    </select></div>
                </div>
                <!-- Advanced Date Filter -->
                <details style="margin-bottom:16px;font-size:0.85rem"><summary style="cursor:pointer;color:var(--text-secondary)">Filtro avançado de data</summary>
                    <div class="filter-bar" style="margin-top:8px;background:var(--bg-secondary);padding:10px;border-radius:6px">
                        <div class="form-group"><label class="form-label">De</label><input type="date" class="form-control" id="filter-te-from" onchange="Pages.truckExpenses.applyFilter(true)"></div>
                        <div class="form-group"><label class="form-label">Até</label><input type="date" class="form-control" id="filter-te-to" onchange="Pages.truckExpenses.applyFilter(true)"></div>
                    </div>
                </details>
                <div id="truck-expenses-result">${this.renderTable(expenses.filter(e => {
            const d = new Date(e.data);
            return d.getMonth() + 1 === mes && d.getFullYear() === ano;
        }), trucks)}</div>
            </div>`;
    },

    renderTable(expenses, trucks) {
        if (expenses.length === 0) return '<div class="empty-state"><div class="empty-icon">💸</div><h3>Nenhuma despesa encontrada</h3></div>';
        const total = expenses.reduce((s, e) => s + (e.valor || 0), 0);
        return `<div class="table-container"><table class="data-table">
            <thead><tr><th>Placa</th><th>Data</th><th>Tipo</th><th>Fornecedor</th><th>Descrição</th><th>Valor</th><th></th></tr></thead>
            <tbody>${expenses.map(e => {
            const t = trucks.find(tt => tt.id === e.truckId);
            return `<tr>
                    <td class="font-mono font-bold">${t?.placa || '—'}</td>
                    <td>${Utils.formatDate(e.data)}</td>
                    <td><span class="badge badge-secondary">${e.tipo}</span></td>
                    <td>${e.fornecedor || '—'}</td>
                    <td>${e.descricao || '—'}</td>
                    <td class="font-bold text-danger">-${Utils.formatCurrency(e.valor)}</td>
                    <td>${App.userRole === 'admin' ? `<button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.truckExpenses.showForm(${e.id})">✏️</button> <button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.truckExpenses.remove(${e.id})">🗑️</button>` : ''}</td>
                </tr>`;
        }).join('')}</tbody>
        </table></div>
        <div class="table-footer"><span>${expenses.length} registros</span><span><strong>Total: ${Utils.formatCurrency(total)}</strong></span></div>`;
    },

    async applyFilter(useDateRange = false) {
        let expenses = await db.getAll('truckExpenses');
        const trucks = await db.getAll('trucks');
        const tid = document.getElementById('filter-te-truck').value;
        const tipo = document.getElementById('filter-te-tipo').value;

        if (useDateRange) {
            document.getElementById('filter-te-mes').value = '';
            const from = document.getElementById('filter-te-from').value;
            const to = document.getElementById('filter-te-to').value;
            if (from) expenses = expenses.filter(e => e.data >= from);
            if (to) expenses = expenses.filter(e => e.data <= to);
        } else {
            const mes = parseInt(document.getElementById('filter-te-mes').value);
            const ano = parseInt(document.getElementById('filter-te-ano').value);
            document.getElementById('filter-te-from').value = '';
            document.getElementById('filter-te-to').value = '';
            if (mes && ano) {
                expenses = expenses.filter(e => {
                    const d = new Date(e.data);
                    return d.getMonth() + 1 === mes && d.getFullYear() === ano;
                });
            }
        }

        if (tid) expenses = expenses.filter(e => e.truckId === parseInt(tid));
        if (tipo) expenses = expenses.filter(e => e.tipo === tipo);

        expenses.sort((a, b) => b.data?.localeCompare(a.data));
        document.getElementById('truck-expenses-result').innerHTML = this.renderTable(expenses, trucks);
    },

    async showForm(id) {
        const trucks = await db.getAll('trucks');
        let item = null;
        if (id) item = await db.getById('truckExpenses', id);
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Despesa' : 'Nova Despesa da Frota';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-row">
                <div class="form-group"><label class="form-label">Caminhão *</label><select class="form-control" id="te-truckId"><option value="">Selecione</option>${trucks.map(t => `<option value="${t.id}" ${item?.truckId === t.id ? 'selected' : ''}>${t.placa}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Data *</label><input type="date" class="form-control" id="te-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Tipo *</label><select class="form-control" id="te-tipo" onchange="Pages.truckExpenses.onTypeChange()">
                    <option value="Manutenção" ${item?.tipo === 'Manutenção' ? 'selected' : ''}>Manutenção (Oficina)</option>
                    <option value="Prestação" ${item?.tipo === 'Prestação' ? 'selected' : ''}>Prestação (Financiamento)</option>
                    <option value="Seguro" ${item?.tipo === 'Seguro' ? 'selected' : ''}>Seguro</option>
                    <option value="Rastreador" ${item?.tipo === 'Rastreador' ? 'selected' : ''}>Rastreador</option>
                    <option value="Salário" ${item?.tipo === 'Salário' ? 'selected' : ''}>Salário (Motorista)</option>
                    <option value="Outros" ${item?.tipo === 'Outros' ? 'selected' : ''}>Outros</option>
                </select></div>
                <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" class="form-control" id="te-valor" value="${item?.valor || ''}"></div>
            </div>
            <div class="form-group" id="group-driver-fill" style="display:none;margin-top:-10px;margin-bottom:10px">
                <button class="btn btn-sm btn-secondary" onclick="Pages.truckExpenses.fillSalary()" style="width:100%">⬇️ Preencher com Salário do Motorista Vinculado</button>
            </div>
            <div class="form-group"><label class="form-label">Fornecedor / Oficina</label><input type="text" class="form-control" id="te-fornecedor" value="${item?.fornecedor || ''}" placeholder="Nome da oficina, seguradora, banco..."></div>
            <div class="form-group"><label class="form-label">Descrição</label><input type="text" class="form-control" id="te-descricao" value="${item?.descricao || ''}" placeholder="Detalhes (peças, serviço, parcela 1/x)"></div>
            <div class="form-group"><label class="form-label">Observações</label><input type="text" class="form-control" id="te-obs" value="${item?.obs || ''}"></div>`;

        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.truckExpenses.save(${id || 'null'})">Salvar</button>`;
        App.openModal();
        this.onTypeChange(); // Show/Hide salary button
    },

    onTypeChange() {
        const type = document.getElementById('te-tipo').value;
        const btn = document.getElementById('group-driver-fill');
        if (type === 'Salário') {
            btn.style.setProperty('display', 'block', 'important');
        } else {
            btn.style.display = 'none';
        }
    },

    async fillSalary() {
        const truckId = parseInt(document.getElementById('te-truckId').value);
        if (!truckId) { Utils.showToast('Selecione um caminhão primeiro', 'warning'); return; }

        const dateStr = document.getElementById('te-data').value;
        if (!dateStr) { Utils.showToast('Selecione a data para calcular o acerto', 'warning'); return; }

        const date = new Date(dateStr);
        const mes = date.getMonth() + 1;
        const ano = date.getFullYear();

        // Find driver for this truck
        const users = await db.getAll('users');
        const driver = users.find(u => u.truckId === truckId && u.role === 'motorista');

        if (!driver) { Utils.showToast('Nenhum motorista vinculado a este caminhão', 'warning'); return; }

        if (!confirm(`Calcular acerto completo (fixo + comissões + prêmios - vales) de ${driver.nome} em ${mes}/${ano}?`)) return;

        try {
            const closing = await db.generateDriverClosing(driver.id, mes, ano);
            if (!closing) { Utils.showToast('Erro ao calcular fechamento', 'error'); return; }

            const total = closing.totalPagar > 0 ? closing.totalPagar : 0;

            document.getElementById('te-valor').value = total.toFixed(2);
            document.getElementById('te-descricao').value = `Acerto ${Utils.getMonthName(mes)}/${ano} - ${driver.nome}`;
            Utils.showToast(`Valor calculado: ${Utils.formatCurrency(total)}`, 'success');
        } catch (e) {
            console.error(e);
            Utils.showToast('Erro ao calcular acerto', 'error');
        }
    },

    async save(id) {
        const truckId = parseInt(document.getElementById('te-truckId').value);
        if (!truckId) { Utils.showToast('Selecione o caminhão', 'warning'); return; }

        const data = {
            truckId,
            data: document.getElementById('te-data').value,
            tipo: document.getElementById('te-tipo').value,
            valor: parseFloat(document.getElementById('te-valor').value) || 0,
            fornecedor: document.getElementById('te-fornecedor').value.trim(),
            descricao: document.getElementById('te-descricao').value.trim(),
            obs: document.getElementById('te-obs').value.trim()
        };

        if (data.valor <= 0) { Utils.showToast('Informe o valor', 'warning'); return; }

        try {
            if (id) { data.id = id; await db.update('truckExpenses', data); } else { await db.add('truckExpenses', data); }
            Utils.showToast('Despesa salva!', 'success'); App.closeModal(); this.applyFilter();
        } catch (e) { Utils.showToast('Erro ao salvar', 'error'); }
    },

    async remove(id) {
        if (!confirm('Excluir esta despesa?')) return;
        await db.delete('truckExpenses', id); Utils.showToast('Excluído', 'success'); this.applyFilter();
    },

    async exportCSV() {
        const expenses = await db.getAll('truckExpenses');
        const trucks = await db.getAll('trucks');
        let csv = 'Data;Placa;Tipo;Fornecedor;Descricao;Valor;Obs\n';
        expenses.forEach(e => {
            const t = trucks.find(tt => tt.id === e.truckId);
            csv += `${Utils.formatDate(e.data)};${t?.placa || ''};${e.tipo};${e.fornecedor || ''};${e.descricao || ''};${e.valor};${e.obs || ''}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'despesas_frota.csv';
        link.click();
    }
};
