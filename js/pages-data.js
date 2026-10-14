// ===== FUELINGS PAGE =====
Pages.fuelings = {
    async render() {
        const trucks = await db.getAll('trucks');
        let fuelings = await db.getAll('fuelings');
        fuelings.sort((a, b) => Utils.fuelCompare(b, a));
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
        fuelings.sort((a, b) => Utils.fuelCompare(b, a));
        document.getElementById('fuelings-table').innerHTML = this.renderTable(fuelings, trucks);
    },

    async showForm(id, presetTruckId) {
        const trucks = await db.getAll('trucks');
        let item = null;
        if (id) item = await db.getById('fuelings', id);
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Abastecimento' : 'Novo Abastecimento';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-row">
                <div class="form-group"><label class="form-label">Caminhão *</label><select class="form-control" id="f-truckId" ${App.userRole === 'motorista' ? 'disabled' : ''}><option value="">Selecione</option>${trucks.map(t => `<option value="${t.id}" ${(item?.truckId === t.id || presetTruckId === t.id || (App.userRole === 'motorista' && App.userTruckId === t.id)) ? 'selected' : ''}>${t.placa}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Data *</label><input type="date" class="form-control" id="f-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Litros *</label><input type="number" step="0.01" class="form-control" id="f-litros" value="${item?.litros || ''}" oninput="Pages.fuelings.calcFrom('litros')"></div>
                <div class="form-group"><label class="form-label">Valor/Litro</label><input type="number" step="0.01" class="form-control" id="f-valorLitro" value="${item?.valorLitro || ''}" oninput="Pages.fuelings.calcFrom('valorLitro')" placeholder="Opcional"></div>
                <div class="form-group"><label class="form-label">Valor Total</label><input type="number" step="0.01" class="form-control" id="f-valorTotal" value="${item?.valorTotal || ''}" oninput="Pages.fuelings.calcFrom('valorTotal')" style="font-weight:700" placeholder="Opcional"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">KM Atual</label><input type="number" class="form-control" id="f-km" value="${item?.km || ''}"></div>
                <div class="form-group"><label class="form-label">Posto</label><input type="text" class="form-control" id="f-posto" value="${item?.posto || ''}"></div>
                <div class="form-group"><label class="form-label">Combustível</label><select class="form-control" id="f-tipoComb" onchange="Pages.fuelings.toggleArlaField()"><option value="Diesel" ${item?.tipoComb === 'Diesel' ? 'selected' : ''}>Diesel</option><option value="Diesel S-10" ${item?.tipoComb === 'Diesel S-10' ? 'selected' : ''}>Diesel S-10</option><option value="Arla" ${item?.tipoComb === 'Arla' ? 'selected' : ''}>Arla</option></select></div>
            </div>
            <div class="form-row" id="f-arla-container" style="display:${(!item || item?.tipoComb === 'Diesel' || item?.tipoComb === 'Diesel S-10' || item?.tipoComb === 'Diesel+Arla') ? 'flex' : 'none'};background:var(--bg-secondary);padding:12px;border-radius:8px;align-items:center;border:1px dashed var(--border-color)">
                <div style="flex:1">
                    <label class="form-label" style="color:var(--accent-info)">Complemento Arla (R$)</label>
                    <input type="number" step="0.01" class="form-control" id="f-valorArla" value="${item?.valorArla || ''}" placeholder="Opcional" oninput="Pages.fuelings.calcTotal()">
                    <small class="text-muted">Será somado nas despesas, mas não afetará a média de consumo.</small>
                </div>
            </div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.fuelings.save(${id || 'null'})">Salvar</button>`;
        App.openModal();
    },

    toggleArlaField() {
        const type = document.getElementById('f-tipoComb').value;
        const container = document.getElementById('f-arla-container');
        if (container) {
            container.style.display = (type === 'Diesel' || type === 'Diesel S-10' || type === 'Diesel+Arla') ? 'flex' : 'none';
        }
        this.calcTotal();
    },

    calcFrom(source) {
        const litrosEl = document.getElementById('f-litros');
        const vlEl = document.getElementById('f-valorLitro');
        const vtEl = document.getElementById('f-valorTotal');
        const l = parseFloat(litrosEl.value) || 0;
        const vl = parseFloat(vlEl.value) || 0;
        const vt = parseFloat(vtEl.value) || 0;
        const type = document.getElementById('f-tipoComb')?.value;
        let arla = 0;
        if (type !== 'Arla' && document.getElementById('f-valorArla')) {
            arla = parseFloat(document.getElementById('f-valorArla').value) || 0;
        }
        if (source === 'valorTotal') {
            // User typed total -> calculate valor/litro
            if (l > 0) vlEl.value = ((vt - arla) / l).toFixed(4);
        } else {
            // User typed litros or valor/litro -> calculate total
            if (vl > 0) vtEl.value = ((l * vl) + arla).toFixed(2);
            else if (l > 0 && vt > 0 && source === 'litros') vlEl.value = ((vt - arla) / l).toFixed(4);
        }
    },

    calcTotal() { this.calcFrom('valorLitro'); },

    _saving: false,
    async save(id) {
        if (this._saving) return;
        this._saving = true;
        const saveBtn = document.querySelector('.modal-footer .btn-primary');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'; }

        const truckId = parseInt(document.getElementById('f-truckId').value) || App.userTruckId;
        if (!truckId) { Utils.showToast('Selecione o caminhão', 'warning'); this._saving = false; if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; } return; }

        let tipoComb = document.getElementById('f-tipoComb').value;
        let valorArla = 0;
        if (tipoComb !== 'Arla' && document.getElementById('f-valorArla')) {
            valorArla = parseFloat(document.getElementById('f-valorArla').value) || 0;
            if (valorArla > 0) tipoComb = tipoComb === 'Diesel S-10' ? 'Diesel S-10' : 'Diesel+Arla';
        }

        let litros = parseFloat(document.getElementById('f-litros').value) || 0;
        let valorLitro = parseFloat(document.getElementById('f-valorLitro').value) || 0;
        let valorTotal = parseFloat(document.getElementById('f-valorTotal').value) || 0;

        if (litros <= 0) { Utils.showToast('Informe os litros', 'warning'); this._saving = false; if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; } return; }
        if (valorLitro <= 0 && valorTotal <= 0) { Utils.showToast('Informe o valor por litro ou o valor total', 'warning'); this._saving = false; if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; } return; }

        // Auto-compute missing value
        if (valorTotal > 0 && valorLitro <= 0) valorLitro = parseFloat(((valorTotal - valorArla) / litros).toFixed(4));
        if (valorLitro > 0 && valorTotal <= 0) valorTotal = parseFloat(((litros * valorLitro) + valorArla).toFixed(2));

        const data = { truckId, data: document.getElementById('f-data').value, litros, valorLitro, valorTotal, valorArla, km: parseInt(document.getElementById('f-km').value) || 0, posto: document.getElementById('f-posto').value.trim(), tipoComb };
        try {
            if (id) { data.id = id; await db.update('fuelings', data); } else { await db.add('fuelings', data); }

            // Atualiza KM do caminhão
            if (data.km > 0) {
                const trk = await db.getById('trucks', truckId);
                if (trk && data.km > (trk.kmAtual || 0)) {
                    await db.update('trucks', { id: truckId, kmAtual: data.km });
                }
            }

            Utils.showToast(id ? 'Atualizado!' : 'Abastecimento registrado!', 'success');
            App.closeModal(); Pages.fuelings.applyFilter();
        } catch (e) { Utils.showToast('Erro ao salvar', 'error'); } finally { this._saving = false; }
    },

    async remove(id) {
        if (!confirm('Excluir este abastecimento?')) return;
        const fueling = await db.getById('fuelings', id);
        await db.delete('fuelings', id);

        // Recalculate truck kmAtual from remaining fuelings
        if (fueling?.truckId) {
            const remaining = await db.getFuelingsByTruck(fueling.truckId);
            const lastKm = remaining.filter(f => f.km > 0).reduce((max, f) => f.km > max ? f.km : max, 0);
            await db.update('trucks', { id: fueling.truckId, kmAtual: lastKm });
        }

        Utils.showToast('Excluído', 'success');
        Pages.fuelings.applyFilter();
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
        const drivers = (await db.getAll('users')).filter(u => u.role === 'motorista' && u.ativo !== false);
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
        const driverFilter = isDriver ? '' : `<div class="form-group"><label class="form-label">Motorista</label><select class="form-control" id="filter-fr-driver" onchange="Pages.freights.applyFilter()"><option value="">Todos</option>${drivers.map(d => `<option value="${d.id}">${d.nome}</option>`).join('')}</select></div>`;

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
                    ${driverFilter}
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
        }), trucks, drivers)}</div>
            </div>`;
    },

    renderTable(freights, trucks, drivers) {
        if (freights.length === 0) return '<div class="empty-state"><div class="empty-icon">📦</div><h3>Nenhum frete encontrado</h3></div>';
        const total = freights.reduce((s, f) => s + ((f.valorFrete || 0) - (f.desconto || 0)), 0);
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
            <div class="table-container"><table class="data-table"><thead><tr><th style="width:36px"><input type="checkbox" id="select-all-freights" onchange="Pages.freights.toggleAllFreights(this.checked)" title="Selecionar todos"></th><th>Placa</th><th>Motorista</th><th>Data</th><th>Origem</th><th>Destino</th><th>KM</th><th>Tipo</th><th>Modalidade</th><th>R$/KM</th><th>Valor Frete</th><th>Recebimento</th><th>Cliente</th><th></th></tr></thead><tbody>${freights.map(f => {
            const t = trucks.find(tt => tt.id === f.truckId);
            const drv = (drivers || []).find(d => d.id === f.userId);
            const mod = f.modalidade || 'kmSistema';
            return `<tr>
                <td><input type="checkbox" class="freight-checkbox" value="${f.id}" onchange="Pages.freights.updateBulkBar()"></td>
                <td class="font-mono font-bold">${t?.placa || '—'}${f.isMiro ? ' <span style="font-size:0.58rem;background:var(--accent-info);color:#fff;padding:1px 4px;border-radius:3px;vertical-align:middle">MIRO</span>' : ''}</td>
                <td>${drv ? drv.nome : '<span class="text-muted">—</span>'}</td>
                <td>${Utils.formatDate(f.data)}</td><td>${f.origem || '—'}</td><td>${f.destino || '—'}</td>
                <td>${Utils.formatNumber(f.km)}</td><td><span class="badge ${f.tipo === 'carregado' ? 'badge-success' : 'badge-warning'}">${f.tipo || '—'}</span></td>
                <td><span class="badge ${modalColors[mod] || 'badge-info'}" style="font-size:0.68rem">${modalLabels[mod] || mod}</span></td>
                <td>${mod === 'fechado' ? `<span class="text-muted" style="font-size:0.75rem">${Utils.formatCurrency(f.taxaKmEfetiva || f.taxaKm)}</span>` : Utils.formatCurrency(f.taxaKm)}</td>
                <td class="font-bold text-success">${f.desconto > 0 ? `<span title="Bruto: ${Utils.formatCurrency(f.valorFrete)}">${Utils.formatCurrency((f.valorFrete || 0) - (f.desconto || 0))}</span><br><span style="font-size:0.65rem;color:var(--accent-warning);font-weight:400">-${Utils.formatCurrency(f.desconto)}${f.descontoObs ? ' ' + f.descontoObs : ''}</span>` : Utils.formatCurrency(f.valorFrete)}</td>
                <td>${this.getPaymentBadges(f)}</td>
                <td>${f.cliente || '—'}</td>
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
        Pages.freights.applyFilter(Pages.freights._isDateRangeActive());
    },

    _isDateRangeActive() {
        return !!(document.getElementById('filter-fr-from')?.value || document.getElementById('filter-fr-to')?.value);
    },

    async applyFilter(useDateRange = false) {
        let freights = await db.getAll('freights');
        const trucks = await db.getAll('trucks');
        const drivers = (await db.getAll('users')).filter(u => u.role === 'motorista' && u.ativo !== false);
        // Driver: always filter by their truck
        if (App.userRole === 'motorista' && App.userTruckId) {
            freights = freights.filter(f => f.truckId === App.userTruckId);
        } else {
            const tid = document.getElementById('filter-fr-truck')?.value;
            if (tid) freights = freights.filter(f => f.truckId === parseInt(tid));
            const did = document.getElementById('filter-fr-driver')?.value;
            if (did) freights = freights.filter(f => f.userId === parseInt(did));
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
        document.getElementById('freights-table').innerHTML = this.renderTable(freights, trucks, drivers);
    },

    // preset: campos pré-preenchidos de um frete novo (usado por Fretes Sugeridos)
    async showForm(id, presetTruckId, preset) {
        this._driverTouched = false;
        this._onSaved = null;
        const trucks = await db.getAll('trucks');
        let item = null;
        if (id) item = await db.getById('freights', id);
        else if (preset) item = { ...preset };
        const drivers = (await db.getAll('users')).filter(u => u.role === 'motorista' && (u.ativo !== false || u.id === item?.userId));
        const currentMod = item?.modalidade || 'kmPlaca';

        const isDriverRole = App.userRole === 'motorista';
        let suggestedDriverId = item?.userId ?? null;
        if (!id) {
            const tId = presetTruckId || (isDriverRole ? App.userTruckId : null);
            if (tId) {
                const drv = await db.getDriverForTruck(tId);
                if (drv) suggestedDriverId = drv.id;
            }
        }
        const driverValue = isDriverRole ? App.userAppId : suggestedDriverId;

        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Frete' : 'Novo Frete';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-row">
                <div class="form-group"><label class="form-label">Caminhão *</label><select class="form-control" id="f-truckId" onchange="Pages.freights.onTruckChange()" ${App.userRole === 'motorista' ? 'disabled' : ''}><option value="">Selecione</option>${trucks.map(t => `<option value="${t.id}" ${(item?.truckId === t.id || presetTruckId === t.id || (App.userRole === 'motorista' && App.userTruckId === t.id)) ? 'selected' : ''}>${t.placa}${t.kmCarregado != null ? ' 💰' : ''}</option>`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Data *</label><input type="date" class="form-control" id="f-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Motorista</label><select class="form-control" id="f-userId" onchange="Pages.freights._driverTouched = true" ${isDriverRole ? 'disabled' : ''}><option value="">— Nenhum específico —</option>${drivers.map(d => `<option value="${d.id}" ${driverValue === d.id ? 'selected' : ''}>${d.nome}</option>`).join('')}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Cidade Origem *</label><input type="text" class="form-control" id="f-origem" value="${item?.origem || ''}" placeholder="Ex: São Paulo"></div>
                <div class="form-group"><label class="form-label">Cidade Destino *</label><input type="text" class="form-control" id="f-destino" value="${item?.destino || ''}" placeholder="Ex: Curitiba"></div>
                <button class="btn btn-secondary btn-sm" onclick="Pages.freights.calcDistance()" style="margin-top:20px;white-space:nowrap" title="Calcular KM via OSRM (gratuito)">📏 Calcular KM</button>
            </div>
            <div style="margin-bottom:8px">
                <label id="f-miro-label" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:4px 10px;background:var(--bg-primary);border-radius:var(--radius-sm);border:1px solid ${item?.isMiro ? 'var(--accent-warning)' : 'var(--border-color)'}">
                    <input type="checkbox" id="f-isMiro" ${item?.isMiro ? 'checked' : ''} onchange="Pages.freights.onIsMiroChange()">
                    <span style="font-size:0.8rem">🔷 Frete MIRO</span>
                </label>
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
            <div id="comissao-fechado-row" style="display:none;margin-bottom:12px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-md)">
                <label class="form-label" style="font-weight:700;color:var(--accent-warning)">🤝 Comissão do Motorista</label>
                <div style="display:flex;gap:12px;align-items:center;margin-top:8px">
                    <select class="form-control" id="f-tipoComissao" style="width:140px" onchange="Pages.freights.onTipoComissaoChange()">
                        <option value="fixo">R$ Fixo</option>
                        <option value="percentual">Porcentagem (%)</option>
                    </select>
                    <div id="comissao-fixo-container" style="flex:1">
                        <input type="number" step="0.01" class="form-control" id="f-comissaoFechado" value="${item?.comissaoFechado || ''}" placeholder="Valor em R$" style="font-weight:700;font-size:1.1rem">
                    </div>
                    <div id="comissao-pct-container" style="flex:1;display:none;align-items:center;gap:8px">
                        <input type="number" step="0.1" class="form-control" id="f-comissaoPct" placeholder="% Ex: 10" oninput="Pages.freights.calcComissaoPct()">
                        <span style="font-weight:700;white-space:nowrap;color:var(--accent-success)" id="comissao-pct-result"> = R$ 0,00</span>
                    </div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Cliente</label><input type="text" class="form-control" id="f-cliente" value="${item?.cliente || ''}"></div>
                <div class="form-group"><label class="form-label">Nota Fiscal</label><input type="text" class="form-control" id="f-notaFiscal" value="${item?.notaFiscal || ''}"></div>
            </div>
            <div class="form-group"><label class="form-label">Observações</label><input type="text" class="form-control" id="f-obs" value="${item?.obs || ''}"></div>
            <div id="f-desconto-section" style="margin-top:8px;padding:10px;background:var(--bg-primary);border-radius:var(--radius-md);border:1px dashed var(--border-color);display:${(item?.isMiro || (item?.desconto > 0)) ? 'block' : 'none'}">
                <label class="form-label" style="color:var(--accent-warning)">✂️ Desconto sobre o Frete</label>
                <div class="form-row" style="margin-bottom:0">
                    <div class="form-group" style="flex:0 0 150px">
                        <label class="form-label">Valor Desconto (R$)</label>
                        <input type="number" step="0.01" class="form-control" id="f-desconto" value="${item?.desconto || ''}" oninput="Pages.freights.calcDesconto()" placeholder="0,00" min="0">
                    </div>
                    <div class="form-group" style="flex:1" id="f-desconto-obs-group" style="display:${(item?.desconto > 0) ? 'flex' : 'none'}">
                        <label class="form-label">Motivo do Desconto</label>
                        <input type="text" class="form-control" id="f-descontoObs" value="${item?.descontoObs || ''}" placeholder="Ex: Descarga, Pedágio...">
                    </div>
                </div>
                <div id="valor-final-row" style="display:${(item?.desconto > 0) ? 'block' : 'none'};margin-top:4px">
                    <span class="text-muted" style="font-size:0.8rem">💡 Valor Final (após desconto): </span><strong id="valor-final-value" class="text-success">${(item?.desconto > 0) ? Utils.formatCurrency((item?.valorFrete || 0) - (item?.desconto || 0)) : '—'}</strong>
                    <span class="text-muted" style="font-size:0.75rem;margin-left:8px">(adiantamento e saldo não são afetados)</span>
                </div>
            </div>
            <div id="maps-result" style="margin-top:8px"></div>
            <hr style="border-color:#333;margin:16px 0">
            <div style="padding:12px;background:var(--bg-primary);border-radius:var(--radius-md)">
                <label class="form-label" style="font-weight:700;color:var(--accent-info)">💰 Pagamento</label>
                <select class="form-control" id="f-pagamentoTipo" onchange="Pages.freights.onPagamentoChange()" style="font-weight:600">
                    <option value="integral" ${(item?.pagamentoTipo || 'integral') === 'integral' ? 'selected' : ''}>💵 Valor Integral</option>
                    <option value="porcentagem" ${item?.pagamentoTipo === 'porcentagem' ? 'selected' : ''}>📊 Dividir por Porcentagem</option>
                    <option value="valorFixo" ${item?.pagamentoTipo === 'valorFixo' ? 'selected' : ''}>✂️ Dividir por Valor Fixo</option>
                </select>
                <div id="pagamento-split" style="display:none;margin-top:10px">
                    <div class="form-row" id="pct-row" style="display:none">
                        <div class="form-group"><label class="form-label">% Adiantamento</label><input type="number" step="0.1" class="form-control" id="f-pctAdiantamento" value="${item?.pctAdiantamento || 50}" oninput="Pages.freights.calcPagamento()" min="0" max="100"></div>
                    </div>
                    <div class="form-row" id="fixed-row" style="display:none">
                        <div class="form-group"><label class="form-label">Valor Adiantamento</label><input type="number" step="0.01" class="form-control" id="f-adiantamentoFixo" value="${item?.adiantamento || ''}" oninput="Pages.freights.calcPagamento()" placeholder="R$"></div>
                    </div>
                    <div class="form-row" style="margin-top:8px">
                        <div class="form-group"><label class="form-label">Adiantamento</label><input type="number" step="0.01" class="form-control" id="f-adiantamento" value="${item?.adiantamento || ''}" readonly style="font-weight:700;color:var(--accent-warning)"></div>
                        <div class="form-group"><label class="form-label">Saldo</label><input type="number" step="0.01" class="form-control" id="f-saldo" value="${item?.saldo || ''}" readonly style="font-weight:700;color:var(--accent-success)"></div>
                    </div>
                </div>
            </div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.freights.save(${id || 'null'})">Salvar</button>`;
        App.openModal();
        // Initialize
        setTimeout(() => {
            this.onModalidadeChange();
            this.calcFrete();
            this.onPagamentoChange();
            this.calcDesconto();
        }, 100);
    },

    async onTruckChange() {
        const modalidade = document.getElementById('f-modalidade')?.value;
        if (modalidade === 'kmPlaca') {
            this.calcFrete();
        }
        if (!this._driverTouched) {
            const truckId = parseInt(document.getElementById('f-truckId')?.value);
            const driverSel = document.getElementById('f-userId');
            if (driverSel) {
                const drv = truckId ? await db.getDriverForTruck(truckId) : null;
                driverSel.value = drv ? drv.id : '';
            }
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
            if (document.getElementById('f-tipoComissao')?.value === 'percentual') {
                this.calcComissaoPct();
            }
        }
        this.calcPagamento();
        this.calcDesconto();
    },

    onTipoComissaoChange() {
        const tipo = document.getElementById('f-tipoComissao').value;
        const fixoContainer = document.getElementById('comissao-fixo-container');
        const pctContainer = document.getElementById('comissao-pct-container');
        if (tipo === 'percentual') {
            fixoContainer.style.display = 'none';
            pctContainer.style.display = 'flex';
            this.calcComissaoPct();
        } else {
            fixoContainer.style.display = 'block';
            pctContainer.style.display = 'none';
        }
    },

    calcComissaoPct() {
        const pct = parseFloat(document.getElementById('f-comissaoPct').value) || 0;
        const valorFrete = parseFloat(document.getElementById('f-valorFrete').value) || 0;
        const resultado = (valorFrete * pct) / 100;
        document.getElementById('f-comissaoFechado').value = resultado.toFixed(2);
        document.getElementById('comissao-pct-result').textContent = ' = ' + Utils.formatCurrency(resultado);
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

    _saving: false,
    async save(id) {
        if (this._saving) return;
        this._saving = true;
        const saveBtn = document.querySelector('.modal-footer .btn-primary');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvando...'; }

        const truckId = parseInt(document.getElementById('f-truckId').value) || App.userTruckId;
        if (!truckId) { Utils.showToast('Selecione o caminhão', 'warning'); this._saving = false; if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Salvar'; } return; }
        const mod = document.getElementById('f-modalidade').value;
        const km = parseFloat(document.getElementById('f-km').value) || 0;
        const valorFrete = parseFloat(document.getElementById('f-valorFrete').value) || 0;
        const taxaKm = parseFloat(document.getElementById('f-taxaKm').value) || 0;
        const desconto = parseFloat(document.getElementById('f-desconto')?.value) || 0;
        const taxaKmEfetiva = mod === 'fechado' && km > 0 ? parseFloat(((valorFrete - desconto) / km).toFixed(4)) : taxaKm;

        const pagamentoTipo = document.getElementById('f-pagamentoTipo')?.value || 'integral';
        let adiantamento = 0, saldo = 0, pctAdiantamento = null;
        if (pagamentoTipo === 'porcentagem') {
            pctAdiantamento = parseFloat(document.getElementById('f-pctAdiantamento')?.value) || 0;
            adiantamento = parseFloat((valorFrete * pctAdiantamento / 100).toFixed(2));
            saldo = parseFloat((valorFrete - adiantamento).toFixed(2));
        } else if (pagamentoTipo === 'valorFixo') {
            adiantamento = parseFloat(document.getElementById('f-adiantamentoFixo')?.value) || 0;
            saldo = parseFloat((valorFrete - adiantamento).toFixed(2));
        }

        const data = {
            truckId,
            userId: parseInt(document.getElementById('f-userId')?.value) || null,
            data: document.getElementById('f-data').value,
            origem: document.getElementById('f-origem').value.trim(),
            destino: document.getElementById('f-destino').value.trim(),
            km, tipo: document.getElementById('f-tipo').value,
            modalidade: mod,
            taxaKm: mod === 'fechado' ? 0 : taxaKm,
            taxaKmEfetiva,
            valorFrete,
            desconto,
            descontoObs: desconto > 0 ? (document.getElementById('f-descontoObs')?.value.trim() || '') : '',
            isMiro: document.getElementById('f-isMiro')?.checked || false,
            comissaoFechado: mod === 'fechado' ? (parseFloat(document.getElementById('f-comissaoFechado').value) || 0) : 0,
            cliente: document.getElementById('f-cliente').value.trim(),
            notaFiscal: document.getElementById('f-notaFiscal').value.trim(),
            obs: document.getElementById('f-obs').value.trim(),
            pagamentoTipo,
            pctAdiantamento,
            adiantamento,
            saldo
        };
        // Preserve payment status when editing
        if (id) {
            const existing = await db.getById('freights', id);
            if (existing) {
                data.adiantamentoRecebido = existing.adiantamentoRecebido || false;
                data.saldoRecebido = existing.saldoRecebido || false;
                data.recebido = existing.recebido || false;
                data.miroCobrancaId = existing.miroCobrancaId || null;
            }
        }
        try {
            if (id) { data.id = id; await db.update('freights', data); } else { await db.add('freights', data); }

            // Atualiza KM do caminhão (considerando o input de KM inserido na rota)
            if (km > 0) {
                const trk = await db.getById('trucks', truckId);
                // Assume that the user either puts the trip distance OR the absolute odometer.
                // If the user inputs the trip distance (e.g. 500), adding it to kmAtual is risky because we don't know the departure km.
                // However, wait. In fuelings the user enters absolute KM. In freights, 'f-km' says "KM da Rota" (Trip KM). 
                // We should add this to the total *only* if we trust the user isn't just typing the absolute odometer by mistake.
                // Actually, let's only update kmAtual securely from Fuelings which requests absolute odometer. Let's ignore it here initially unless requested.
            }

            Utils.showToast(id ? 'Frete atualizado!' : 'Frete registrado!', 'success'); App.closeModal();
            const onSaved = this._onSaved; this._onSaved = null;
            if (onSaved) onSaved(data); else Pages.freights.applyFilter(Pages.freights._isDateRangeActive());
        } catch (e) { Utils.showToast('Erro ao salvar', 'error'); } finally { this._saving = false; }
    },

    async remove(id) { if (!confirm('Excluir?')) return; await db.delete('freights', id); Utils.showToast('Excluído', 'success'); Pages.freights.applyFilter(Pages.freights._isDateRangeActive()); },

    async exportCSV() {
        const freights = await db.getAll('freights');
        const trucks = await db.getAll('trucks');
        Utils.exportToCSV(freights.map(f => { const t = trucks.find(tt => tt.id === f.truckId); return { Placa: t?.placa || '', Data: Utils.formatDate(f.data), Origem: f.origem, Destino: f.destino, KM: f.km, Tipo: f.tipo, Modalidade: f.modalidade || 'kmSistema', TaxaKM: f.taxaKm, TaxaEfetiva: f.taxaKmEfetiva || '', ValorFrete: f.valorFrete, Cliente: f.cliente, NF: f.notaFiscal }; }), 'fretes.csv');
    },

    onPagamentoChange() {
        const tipo = document.getElementById('f-pagamentoTipo')?.value;
        const splitDiv = document.getElementById('pagamento-split');
        const pctRow = document.getElementById('pct-row');
        const fixedRow = document.getElementById('fixed-row');
        if (!splitDiv) return;
        if (tipo === 'integral') {
            splitDiv.style.display = 'none';
        } else {
            splitDiv.style.display = 'block';
            pctRow.style.display = tipo === 'porcentagem' ? 'flex' : 'none';
            fixedRow.style.display = tipo === 'valorFixo' ? 'flex' : 'none';
            this.calcPagamento();
        }
    },

    calcPagamento() {
        const tipo = document.getElementById('f-pagamentoTipo')?.value;
        const valorFrete = parseFloat(document.getElementById('f-valorFrete')?.value) || 0;
        let adiantamento = 0;
        if (tipo === 'porcentagem') {
            const pct = parseFloat(document.getElementById('f-pctAdiantamento')?.value) || 0;
            adiantamento = parseFloat((valorFrete * pct / 100).toFixed(2));
        } else if (tipo === 'valorFixo') {
            adiantamento = parseFloat(document.getElementById('f-adiantamentoFixo')?.value) || 0;
        }
        const saldo = parseFloat((valorFrete - adiantamento).toFixed(2));
        const adEl = document.getElementById('f-adiantamento');
        const salEl = document.getElementById('f-saldo');
        if (adEl) adEl.value = adiantamento.toFixed(2);
        if (salEl) salEl.value = saldo.toFixed(2);
    },

    onIsMiroChange() {
        const isMiro = document.getElementById('f-isMiro')?.checked;
        const section = document.getElementById('f-desconto-section');
        const label = document.getElementById('f-miro-label');
        if (section) section.style.display = isMiro ? 'block' : 'none';
        if (label) label.style.borderColor = isMiro ? 'var(--accent-warning)' : 'var(--border-color)';
    },

    calcDesconto() {
        const desconto = parseFloat(document.getElementById('f-desconto')?.value) || 0;
        const valorFrete = parseFloat(document.getElementById('f-valorFrete')?.value) || 0;
        const obsGroup = document.getElementById('f-desconto-obs-group');
        const finalRow = document.getElementById('valor-final-row');
        const finalEl = document.getElementById('valor-final-value');
        const visible = desconto > 0;
        if (obsGroup) obsGroup.style.display = visible ? 'flex' : 'none';
        if (finalRow) finalRow.style.display = visible ? 'block' : 'none';
        if (finalEl) finalEl.textContent = visible ? Utils.formatCurrency(valorFrete - desconto) : '—';
    },

    async toggleRecebido(id, campo) {
        try {
            const freight = await db.getById('freights', id);
            if (!freight) return;
            freight[campo] = !freight[campo];
            await db.update('freights', freight);
            Pages.freights.applyFilter(Pages.freights._isDateRangeActive());
        } catch (e) { console.error('toggleRecebido error:', e); }
    },

    getPaymentBadges(f) {
        const tipo = f.pagamentoTipo || 'integral';
        if (tipo === 'integral') {
            const recebido = f.recebido || false;
            return `<button class="btn btn-sm" style="font-size:0.7rem;padding:2px 8px;background:${recebido ? 'var(--accent-success)' : 'var(--bg-tertiary)'};color:${recebido ? '#fff' : 'var(--text-secondary)'};border:none;border-radius:4px;cursor:pointer" onclick="event.stopPropagation();Pages.freights.toggleRecebido(${f.id},'recebido')" title="${recebido ? 'Recebido' : 'Não recebido'}">${recebido ? '✅' : '⬜'} ${Utils.formatCurrency(f.valorFrete)}</button>`;
        }
        const adRecebido = f.adiantamentoRecebido || false;
        const salRecebido = f.saldoRecebido || false;
        return `<div style="display:flex;flex-direction:column;gap:3px">
            <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 6px;background:${adRecebido ? 'var(--accent-warning)' : 'var(--bg-tertiary)'};color:${adRecebido ? '#fff' : 'var(--text-secondary)'};border:none;border-radius:4px;cursor:pointer" onclick="event.stopPropagation();Pages.freights.toggleRecebido(${f.id},'adiantamentoRecebido')" title="Adiantamento">${adRecebido ? '✅' : '⬜'} Ad. ${Utils.formatCurrency(f.adiantamento || 0)}</button>
            <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 6px;background:${salRecebido ? 'var(--accent-success)' : 'var(--bg-tertiary)'};color:${salRecebido ? '#fff' : 'var(--text-secondary)'};border:none;border-radius:4px;cursor:pointer" onclick="event.stopPropagation();Pages.freights.toggleRecebido(${f.id},'saldoRecebido')" title="Saldo">${salRecebido ? '✅' : '⬜'} Sal. ${Utils.formatCurrency(f.saldo || 0)}</button>
        </div>`;
    },

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
            Utils.showToast('Despesa salva!', 'success'); App.closeModal();
            if (document.getElementById('filter-te-truck')) this.applyFilter(); else App.refreshCurrentPage();
        } catch (e) { Utils.showToast('Erro ao salvar', 'error'); }
    },

    async remove(id) {
        if (!confirm('Excluir esta despesa?')) return;
        await db.delete('truckExpenses', id); Utils.showToast('Excluído', 'success');
        if (document.getElementById('filter-te-truck')) this.applyFilter(); else App.refreshCurrentPage();
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

// ===== COBRANÇAS MIRO PAGE =====
// Os boletos são lançados livremente (quantidade e valor variáveis). No fim do mês a
// conferência compara o saldo com os descontos selecionados e marca esses descontos
// como solucionados (freights.miroCobrancaId = conferência).
// Saldo atual = saldo final da última conferência + boletos emitidos depois dela.
// Positivo = crédito para o próximo mês; negativo = falta (boleto complementar).
Pages.miro = {
    _sel: new Set(),
    _tab: 'descontos',
    _data: null,

    esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    async load() {
        const [freights, trucks, conferencias, boletos] = await Promise.all([
            db.getAll('freights'),
            db.getAll('trucks'),
            db.getAll('miroCobrancas'),
            db.getAll('miroBoletos')
        ]);
        const miroFreights = freights.filter(f => f.isMiro && (f.desconto || 0) > 0);
        conferencias.sort((a, b) => b.id - a.id);
        const ultima = conferencias[0] || null;
        const abertos = boletos.filter(b => !b.cobrancaId);
        const pendentes = miroFreights.filter(f => !f.miroCobrancaId)
            .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
        const saldoAnterior = ultima ? (ultima.saldoFinal || 0) : 0;
        const totalAbertos = abertos.reduce((s, b) => s + (b.valor || 0), 0);
        this._data = {
            miroFreights, trucks, conferencias, boletos, ultima, abertos, pendentes,
            saldoAnterior, totalAbertos, saldo: saldoAnterior + totalAbertos
        };
        return this._data;
    },

    placa(truckId) {
        return this._data.trucks.find(t => t.id === truckId)?.placa || '—';
    },

    saldoLabel(v) {
        if (Math.abs(v) < 0.005) return { txt: 'Zerado', cls: '' };
        return v > 0 ? { txt: 'Crédito', cls: 'text-success' } : { txt: 'Falta', cls: 'text-danger' };
    },

    async render() {
        const d = await this.load();
        this._sel = new Set();
        const canEdit = App.userRole === 'admin';
        const totalPend = d.pendentes.reduce((s, f) => s + (f.desconto || 0), 0);
        const sl = this.saldoLabel(d.saldo);
        const prev = d.saldo - totalPend;
        const pl = this.saldoLabel(prev);

        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">🔷 Cobranças MIRO</h1><p class="page-subtitle">Boletos, descontos e conferência mensal — Transportes MIRO</p></div>
                ${canEdit ? `<div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-secondary" onclick="Pages.miro.showBoletoForm()">＋ Lançar boletos</button>
                </div>` : ''}
            </div></div>
            <div class="page-body">
                <div class="stats-grid">
                    <div class="stat-card" style="--stat-accent:${d.saldo >= 0 ? 'var(--gradient-success)' : 'var(--gradient-danger)'}"><div class="stat-icon">💲</div><div class="stat-value ${sl.cls}">${Utils.formatCurrency(Math.abs(d.saldo))}</div><div class="stat-label">Saldo atual — ${sl.txt}</div></div>
                    <div class="stat-card" style="--stat-accent:var(--gradient-primary)"><div class="stat-icon">📑</div><div class="stat-value">${Utils.formatCurrency(d.totalAbertos)}</div><div class="stat-label">${d.abertos.length} boleto(s) desde a última conferência</div></div>
                    <div class="stat-card" style="--stat-accent:var(--gradient-warning)"><div class="stat-icon">✂️</div><div class="stat-value">${Utils.formatCurrency(totalPend)}</div><div class="stat-label">${d.pendentes.length} desconto(s) em aberto</div></div>
                    <div class="stat-card" style="--stat-accent:${prev >= 0 ? 'var(--gradient-success)' : 'var(--gradient-danger)'}"><div class="stat-icon">🧮</div><div class="stat-value ${pl.cls}">${Utils.formatCurrency(Math.abs(prev))}</div><div class="stat-label">Se conferir tudo hoje — ${pl.txt}</div></div>
                </div>
                <div class="tabs">
                    <button class="tab-btn ${this._tab === 'descontos' ? 'active' : ''}" onclick="Pages.miro.showTab('descontos',this)">✂️ Descontos em aberto (${d.pendentes.length})</button>
                    <button class="tab-btn ${this._tab === 'boletos' ? 'active' : ''}" onclick="Pages.miro.showTab('boletos',this)">📑 Boletos (${d.boletos.length})</button>
                    <button class="tab-btn ${this._tab === 'conferencias' ? 'active' : ''}" onclick="Pages.miro.showTab('conferencias',this)">🧮 Conferências (${d.conferencias.length})</button>
                </div>
                <div class="tab-content ${this._tab === 'descontos' ? 'active' : ''}" id="tab-descontos">
                    ${this.renderPendentes(canEdit)}
                    <div id="miro-sel-bar" style="display:none;position:sticky;bottom:12px;background:var(--bg-secondary);border:1px solid var(--accent-warning);border-radius:var(--radius-md);padding:12px 16px;margin-top:8px;align-items:center;gap:16px;flex-wrap:wrap">
                        <span id="miro-sel-info" style="flex:1;font-weight:600"></span>
                        <button class="btn btn-primary btn-sm" onclick="Pages.miro.showConferenciaForm()">🧮 Realizar conferência</button>
                    </div>
                </div>
                <div class="tab-content ${this._tab === 'boletos' ? 'active' : ''}" id="tab-boletos">${this.renderBoletos(canEdit)}</div>
                <div class="tab-content ${this._tab === 'conferencias' ? 'active' : ''}" id="tab-conferencias">${this.renderConferencias(canEdit)}</div>
            </div>`;
    },

    showTab(tab, btn) {
        this._tab = tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');
        btn.classList.add('active');
    },

    renderPendentes(canEdit) {
        const list = this._data.pendentes;
        if (list.length === 0) return '<div class="empty-state"><div class="empty-icon">✅</div><h3>Nenhum desconto em aberto</h3><p>Todos os descontos de fretes MIRO já foram solucionados em conferências.</p></div>';
        const total = list.reduce((s, f) => s + (f.desconto || 0), 0);
        return `<div class="table-container"><table class="data-table">
            <thead><tr>
                ${canEdit ? '<th><input type="checkbox" id="miro-sel-all" onchange="Pages.miro.toggleAll(this.checked)"></th>' : ''}
                <th>Data</th><th>Placa</th><th>Afretamento</th><th>Origem → Destino</th>
                <th>Valor Frete</th><th style="color:var(--accent-warning)">Desconto</th><th>Motivo</th>
            </tr></thead>
            <tbody>${list.map(f => `<tr>
                ${canEdit ? `<td><input type="checkbox" class="miro-cb" data-id="${f.id}" onchange="Pages.miro.toggleSel(${f.id}, this.checked)"></td>` : ''}
                <td>${Utils.formatDate(f.data)}</td>
                <td class="font-mono font-bold">${this.placa(f.truckId)}</td>
                <td class="font-mono">${this.esc(f.cliente) || '—'}</td>
                <td style="font-size:0.8rem">${this.esc(f.origem) || '—'} → ${this.esc(f.destino) || '—'}</td>
                <td>${Utils.formatCurrency(f.valorFrete)}</td>
                <td class="font-bold" style="color:var(--accent-warning)">${Utils.formatCurrency(f.desconto)}</td>
                <td style="font-size:0.75rem;color:var(--text-secondary)">${this.esc(f.descontoObs) || '—'}</td>
            </tr>`).join('')}</tbody>
        </table></div>
        <div class="table-footer"><span>${list.length} descontos em aberto</span><span>Total: <strong style="color:var(--accent-warning)">${Utils.formatCurrency(total)}</strong></span></div>`;
    },

    renderBoletos(canEdit) {
        const { boletos, conferencias } = this._data;
        if (boletos.length === 0) return `<div class="empty-state"><div class="empty-icon">📑</div><h3>Nenhum boleto lançado</h3><p>Use "Lançar boletos" para cadastrar os boletos emitidos no mês.</p></div>`;
        const list = [...boletos].sort((a, b) =>
            (b.emissao || b.vencimento || '').localeCompare(a.emissao || a.vencimento || '') || b.id - a.id);
        const total = list.reduce((s, b) => s + (b.valor || 0), 0);
        return `<div class="table-container"><table class="data-table">
            <thead><tr><th>Emissão</th><th>Vencimento</th><th>Nº Boleto</th><th>Valor</th><th>Conferência</th><th>Pago</th>${canEdit ? '<th></th>' : ''}</tr></thead>
            <tbody>${list.map(b => {
                const conf = conferencias.find(c => c.id === b.cobrancaId);
                return `<tr>
                    <td>${Utils.formatDate(b.emissao)}</td>
                    <td>${Utils.formatDate(b.vencimento)}</td>
                    <td><span class="font-mono">${this.esc(b.numeroBoleto) || '—'}</span>${b.complementar ? ' <span class="badge badge-warning" style="font-size:0.62rem">complementar</span>' : ''}${b.obs ? `<div style="font-size:0.7rem;color:var(--text-secondary)">${this.esc(b.obs)}</div>` : ''}</td>
                    <td class="font-bold" style="color:var(--accent-info)">${Utils.formatCurrency(b.valor)}</td>
                    <td>${conf ? `<span class="badge badge-success" style="font-size:0.7rem">${this.esc(conf.referencia)}</span>` : '<span class="badge badge-warning" style="font-size:0.7rem">Em aberto</span>'}</td>
                    <td><button class="btn btn-sm" ${canEdit ? '' : 'disabled'} style="font-size:0.65rem;padding:2px 7px;background:${b.pago ? 'var(--accent-success)' : 'var(--bg-tertiary)'};color:${b.pago ? '#fff' : 'var(--text-secondary)'};border:none;border-radius:4px;cursor:pointer" onclick="Pages.miro.togglePago(${b.id})">${b.pago ? '✅ Pago' : '⬜ Pendente'}</button></td>
                    ${canEdit ? `<td style="white-space:nowrap">${conf ? '<span style="font-size:0.7rem;color:var(--text-secondary)" title="Desfaça a conferência para editar">🔒</span>' : `
                        <button class="btn btn-sm btn-secondary" onclick="Pages.miro.showBoletoEdit(${b.id})">✏️</button>
                        <button class="btn btn-sm" style="color:var(--accent-danger);background:transparent;border:1px solid var(--accent-danger)" onclick="Pages.miro.removeBoleto(${b.id})">🗑️</button>`}</td>` : ''}
                </tr>`;
            }).join('')}</tbody>
        </table></div>
        <div class="table-footer"><span>${list.length} boletos</span><span>Total emitido: <strong style="color:var(--accent-info)">${Utils.formatCurrency(total)}</strong></span></div>`;
    },

    renderConferencias(canEdit) {
        const { conferencias, boletos, miroFreights, ultima } = this._data;
        if (conferencias.length === 0) return '<div class="empty-state"><div class="empty-icon">🧮</div><h3>Nenhuma conferência realizada</h3><p>Na aba "Descontos em aberto", selecione os descontos e clique em "Realizar conferência".</p></div>';
        return conferencias.map(c => {
            const cBoletos = boletos.filter(b => b.cobrancaId === c.id);
            const cFreights = miroFreights.filter(f => f.miroCobrancaId === c.id)
                .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
            const sl = this.saldoLabel(c.saldoFinal || 0);
            const line = (label, v, color) => `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:var(--text-secondary)">${label}</span><strong style="${color ? `color:${color}` : ''}">${v}</strong></div>`;
            return `<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);padding:16px;margin-bottom:12px">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
                    <div>
                        <strong style="font-size:1rem">${this.esc(c.referencia)}</strong>
                        <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">Conferido em ${Utils.formatDate(c.data)}</div>
                        ${c.obs ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">${this.esc(c.obs)}</div>` : ''}
                    </div>
                    <div style="font-size:0.82rem;min-width:240px">
                        ${line('Saldo anterior', Utils.formatCurrency(c.saldoAnterior))}
                        ${line(`+ Boletos (${cBoletos.length})`, Utils.formatCurrency(c.totalBoletos), 'var(--accent-info)')}
                        ${line(`− Descontos (${cFreights.length})`, Utils.formatCurrency(c.totalDesconto), 'var(--accent-warning)')}
                        <div style="border-top:1px solid var(--border-color);margin:4px 0"></div>
                        ${line(`= ${sl.txt}`, Utils.formatCurrency(Math.abs(c.saldoFinal || 0)), sl.cls === 'text-danger' ? 'var(--accent-danger)' : 'var(--accent-success)')}
                    </div>
                </div>
                <details style="margin-top:10px">
                    <summary style="font-size:0.75rem;color:var(--text-secondary);cursor:pointer">Ver boletos e descontos</summary>
                    <div style="margin-top:8px;font-size:0.75rem;color:var(--text-secondary)">
                        ${cBoletos.map(b => `<div style="padding:4px 0;border-bottom:1px solid var(--border-color)">📑 ${b.numeroBoleto ? 'Nº ' + this.esc(b.numeroBoleto) : 'Boleto'} · venc. ${Utils.formatDate(b.vencimento)}${b.complementar ? ' · complementar' : ''} · <strong style="color:var(--accent-info)">${Utils.formatCurrency(b.valor)}</strong></div>`).join('')}
                        ${cFreights.map(f => `<div style="padding:4px 0;border-bottom:1px solid var(--border-color)">✂️ ${Utils.formatDate(f.data)} · ${this.placa(f.truckId)} · Afret. ${this.esc(f.cliente) || '—'} · ${this.esc(f.origem)} → ${this.esc(f.destino)} · <strong style="color:var(--accent-warning)">-${Utils.formatCurrency(f.desconto)}</strong></div>`).join('')}
                    </div>
                </details>
                ${canEdit && ultima && c.id === ultima.id ? `<div style="margin-top:10px;text-align:right"><button class="btn btn-sm" style="color:var(--accent-danger);background:transparent;border:1px solid var(--accent-danger);font-size:0.75rem" onclick="Pages.miro.desfazerConferencia(${c.id})">↩️ Desfazer conferência</button></div>` : ''}
            </div>`;
        }).join('');
    },

    toggleSel(id, checked) {
        if (checked) this._sel.add(id);
        else this._sel.delete(id);
        this.updateSelBar();
    },

    toggleAll(checked) {
        document.querySelectorAll('.miro-cb').forEach(cb => {
            const id = parseInt(cb.dataset.id);
            if (checked) this._sel.add(id);
            else this._sel.delete(id);
            cb.checked = checked;
        });
        this.updateSelBar();
    },

    selecionados() {
        return this._data.pendentes.filter(f => this._sel.has(f.id));
    },

    updateSelBar() {
        const bar = document.getElementById('miro-sel-bar');
        if (!bar) return;
        if (this._sel.size === 0) { bar.style.display = 'none'; return; }
        const total = this.selecionados().reduce((s, f) => s + (f.desconto || 0), 0);
        bar.style.display = 'flex';
        document.getElementById('miro-sel-info').textContent =
            `${this._sel.size} desconto(s) selecionado(s) — ${Utils.formatCurrency(total)}`;
    },

    // ----- Boletos -----

    boletoRow(i, b = {}) {
        const hoje = new Date().toISOString().split('T')[0];
        return `<div class="mb-row" data-row="${i}" style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:10px;margin-bottom:8px">
            ${b.id ? '' : `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <strong style="font-size:0.75rem;color:var(--text-secondary)">BOLETO</strong>
                <button class="btn btn-sm" style="padding:2px 8px;color:var(--accent-danger);background:transparent;border:1px solid var(--border-color)" onclick="this.closest('.mb-row').remove()" title="Remover este boleto">✕</button>
            </div>`}
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px">
                <div class="form-group" style="margin:0"><label class="form-label">Valor (R$) *</label><input type="number" step="0.01" min="0" class="form-control mb-valor" value="${b.valor ?? ''}"></div>
                <div class="form-group" style="margin:0"><label class="form-label">Nº Boleto</label><input type="text" class="form-control mb-num" value="${this.esc(b.numeroBoleto)}" placeholder="Opcional"></div>
                <div class="form-group" style="margin:0"><label class="form-label">Emissão</label><input type="date" class="form-control mb-emissao" value="${b.emissao || hoje}"></div>
                <div class="form-group" style="margin:0"><label class="form-label">Vencimento</label><input type="date" class="form-control mb-venc" value="${b.vencimento || ''}"></div>
            </div>
            <div class="form-group" style="margin:8px 0 0"><input type="text" class="form-control mb-obs" value="${this.esc(b.obs)}" placeholder="Observação (opcional)"></div>
        </div>`;
    },

    readBoletoRows() {
        return [...document.querySelectorAll('.mb-row')].map(r => ({
            valor: parseFloat(r.querySelector('.mb-valor').value) || 0,
            numeroBoleto: r.querySelector('.mb-num').value.trim(),
            emissao: r.querySelector('.mb-emissao').value || null,
            vencimento: r.querySelector('.mb-venc').value || null,
            obs: r.querySelector('.mb-obs').value.trim()
        }));
    },

    openModal(title, body, footerBtn) {
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = title;
        modal.querySelector('.modal-body').innerHTML = body;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button>${footerBtn}`;
        App.openModal();
    },

    showBoletoForm() {
        this._rowSeq = 1;
        this.openModal('Lançar boletos MIRO', `
            <p style="font-size:0.8rem;color:var(--text-secondary);margin-top:0">Cadastre os boletos emitidos. Eles entram no saldo assim que são lançados e serão considerados na próxima conferência.</p>
            <div id="mb-rows">${this.boletoRow(0)}</div>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('mb-rows').insertAdjacentHTML('beforeend', Pages.miro.boletoRow(Pages.miro._rowSeq++))">＋ Adicionar outro boleto</button>`,
            `<button class="btn btn-primary" onclick="Pages.miro.saveBoletos()">💾 Salvar</button>`);
    },

    async saveBoletos() {
        const rows = this.readBoletoRows();
        if (rows.length === 0) { Utils.showToast('Adicione ao menos um boleto', 'warning'); return; }
        if (rows.some(r => r.valor <= 0)) { Utils.showToast('Informe o valor de todos os boletos', 'warning'); return; }
        try {
            for (const r of rows) {
                await db.add('miroBoletos', { ...r, pago: false, complementar: false, cobrancaId: null });
            }
            Utils.showToast(`${rows.length} boleto(s) lançado(s)`, 'success');
            App.closeModal();
            this._tab = 'boletos';
            App.refreshCurrentPage();
        } catch (e) {
            Utils.showToast('Erro ao salvar boletos: ' + (e.message || e), 'error');
        }
    },

    showBoletoEdit(id) {
        const b = this._data.boletos.find(x => x.id === id);
        if (!b) return;
        this.openModal('Editar boleto MIRO', `<div id="mb-rows">${this.boletoRow(0, b)}</div>`,
            `<button class="btn btn-primary" onclick="Pages.miro.updateBoleto(${id})">💾 Salvar</button>`);
    },

    async updateBoleto(id) {
        const b = this._data.boletos.find(x => x.id === id);
        const [r] = this.readBoletoRows();
        if (!b || !r) return;
        if (r.valor <= 0) { Utils.showToast('Informe o valor do boleto', 'warning'); return; }
        try {
            await db.update('miroBoletos', { ...b, ...r });
            Utils.showToast('Boleto atualizado', 'success');
            App.closeModal();
            App.refreshCurrentPage();
        } catch (e) {
            Utils.showToast('Erro ao atualizar boleto: ' + (e.message || e), 'error');
        }
    },

    async removeBoleto(id) {
        if (!confirm('Excluir este boleto?')) return;
        await db.delete('miroBoletos', id);
        Utils.showToast('Boleto excluído', 'success');
        App.refreshCurrentPage();
    },

    async togglePago(id) {
        const b = this._data.boletos.find(x => x.id === id);
        if (!b) return;
        await db.update('miroBoletos', { ...b, pago: !b.pago });
        App.refreshCurrentPage();
    },

    // ----- Conferência -----

    calcConferencia() {
        const sel = this.selecionados();
        const totalDesc = sel.reduce((s, f) => s + (f.desconto || 0), 0);
        const { saldoAnterior, totalAbertos } = this._data;
        return { sel, totalDesc, resultado: saldoAnterior + totalAbertos - totalDesc };
    },

    showConferenciaForm() {
        const { sel, totalDesc, resultado } = this.calcConferencia();
        if (sel.length === 0) { Utils.showToast('Selecione ao menos um desconto', 'warning'); return; }
        const { saldoAnterior, totalAbertos, abertos } = this._data;
        const { mes, ano } = Utils.getCurrentMonth();
        const hoje = new Date().toISOString().split('T')[0];
        const falta = resultado < -0.005;
        const line = (label, v, color, bold) => `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>${label}</span><span style="${color ? `color:${color};` : ''}${bold ? 'font-weight:700' : ''}">${v}</span></div>`;

        this.openModal('Conferência MIRO', `
            <div class="form-row">
                <div class="form-group" style="flex:1"><label class="form-label">Referência *</label><input type="text" class="form-control" id="mc-ref" value="${Utils.getMonthName(mes)} ${ano}"></div>
                <div class="form-group" style="flex:0 0 160px"><label class="form-label">Data</label><input type="date" class="form-control" id="mc-data" value="${hoje}"></div>
            </div>
            <div style="background:var(--bg-primary);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;font-size:0.9rem">
                ${line(saldoAnterior >= 0 ? 'Crédito anterior' : 'Falta anterior', Utils.formatCurrency(Math.abs(saldoAnterior)), saldoAnterior < 0 ? 'var(--accent-danger)' : '')}
                ${line(`+ Boletos desde a última conferência (${abertos.length})`, Utils.formatCurrency(totalAbertos), 'var(--accent-info)')}
                ${line(`− Descontos selecionados (${sel.length})`, Utils.formatCurrency(totalDesc), 'var(--accent-warning)')}
                <div style="border-top:1px solid var(--border-color);margin:6px 0"></div>
                ${line(falta ? 'FALTA' : 'Fica de crédito', Utils.formatCurrency(Math.abs(resultado)), falta ? 'var(--accent-danger)' : 'var(--accent-success)', true)}
            </div>
            <details style="margin-bottom:12px">
                <summary style="font-size:0.8rem;color:var(--text-secondary);cursor:pointer">Descontos que serão marcados como solucionados (${sel.length})</summary>
                <div style="margin-top:6px;font-size:0.75rem;color:var(--text-secondary);max-height:200px;overflow:auto">
                    ${sel.map(f => `<div style="padding:3px 0;border-bottom:1px solid var(--border-color)">${Utils.formatDate(f.data)} · ${this.placa(f.truckId)} · Afret. ${this.esc(f.cliente) || '—'} · <strong style="color:var(--accent-warning)">${Utils.formatCurrency(f.desconto)}</strong></div>`).join('')}
                </div>
            </details>
            ${falta ? `
            <div style="border:1px dashed var(--accent-danger);border-radius:var(--radius-md);padding:10px;margin-bottom:12px">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600">
                    <input type="checkbox" id="mc-comp" checked onchange="document.getElementById('mc-comp-fields').style.display=this.checked?'block':'none'">
                    Lançar boleto complementar para cobrir a falta
                </label>
                <div id="mc-comp-fields" style="margin-top:8px">
                    <div class="form-row" style="margin-bottom:0">
                        <div class="form-group" style="flex:0 0 130px"><label class="form-label">Valor (R$)</label><input type="number" step="0.01" class="form-control" id="mc-comp-valor" value="${Math.abs(resultado).toFixed(2)}"></div>
                        <div class="form-group" style="flex:1"><label class="form-label">Nº Boleto</label><input type="text" class="form-control" id="mc-comp-num" placeholder="Opcional"></div>
                        <div class="form-group" style="flex:0 0 145px"><label class="form-label">Vencimento</label><input type="date" class="form-control" id="mc-comp-venc"></div>
                    </div>
                </div>
                <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:4px">Desmarcado, a falta passa para a próxima conferência.</div>
            </div>` : ''}
            <div class="form-group"><label class="form-label">Observações</label><input type="text" class="form-control" id="mc-obs" placeholder="Opcional"></div>`,
            `<button class="btn btn-primary" onclick="Pages.miro.salvarConferencia()">✅ Confirmar conferência</button>`);
    },

    async salvarConferencia() {
        const ref = document.getElementById('mc-ref').value.trim();
        if (!ref) { Utils.showToast('Informe a referência', 'warning'); return; }
        const data = document.getElementById('mc-data').value || new Date().toISOString().split('T')[0];
        const { sel, totalDesc } = this.calcConferencia();
        const { saldoAnterior, abertos } = this._data;
        const comp = document.getElementById('mc-comp')?.checked
            ? parseFloat(document.getElementById('mc-comp-valor').value) || 0 : 0;
        const totalBoletos = abertos.reduce((s, b) => s + (b.valor || 0), 0) + comp;
        try {
            const confId = await db.add('miroCobrancas', {
                referencia: ref,
                data,
                saldoAnterior,
                totalBoletos,
                totalDesconto: totalDesc,
                saldoFinal: saldoAnterior + totalBoletos - totalDesc,
                obs: document.getElementById('mc-obs').value.trim()
            });
            if (comp > 0) {
                await db.add('miroBoletos', {
                    cobrancaId: confId,
                    valor: comp,
                    numeroBoleto: document.getElementById('mc-comp-num').value.trim(),
                    emissao: data,
                    vencimento: document.getElementById('mc-comp-venc').value || null,
                    complementar: true,
                    pago: false,
                    obs: `Complementar — ${ref}`
                });
            }
            for (const b of abertos) await db.update('miroBoletos', { ...b, cobrancaId: confId });
            for (const f of sel) await db.update('freights', { ...f, miroCobrancaId: confId });
            Utils.showToast('Conferência registrada!', 'success');
            App.closeModal();
            this._tab = 'conferencias';
            App.refreshCurrentPage();
        } catch (e) {
            Utils.showToast('Erro ao registrar conferência: ' + (e.message || e), 'error');
        }
    },

    async desfazerConferencia(id) {
        if (!confirm('Desfazer esta conferência?\n\nOs descontos voltam para "em aberto" e os boletos voltam a ficar sem conferência (inclusive o complementar, se houver — exclua-o se não for usar).')) return;
        const { miroFreights, boletos } = this._data;
        try {
            for (const f of miroFreights.filter(f => f.miroCobrancaId === id)) {
                await db.update('freights', { ...f, miroCobrancaId: null });
            }
            for (const b of boletos.filter(b => b.cobrancaId === id)) {
                await db.update('miroBoletos', { ...b, cobrancaId: null });
            }
            await db.delete('miroCobrancas', id);
            Utils.showToast('Conferência desfeita', 'success');
            App.refreshCurrentPage();
        } catch (e) {
            Utils.showToast('Erro ao desfazer conferência: ' + (e.message || e), 'error');
        }
    }
};
