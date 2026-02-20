// ===== TRUCK DETAIL PAGE =====
// ===== TRUCK DETAIL PAGE =====
Pages.truckDetail = {
    truckId: null,
    async render(id) {
        this.truckId = id;
        const truck = await db.getById('trucks', id);
        if (!truck) { App.navigate('trucks'); return; }

        this._truckData = {
            truck,
            fuelings: await db.getFuelingsByTruck(id),
            freights: await db.getFreightsByTruck(id),
            fines: await db.getFinesByTruck(id),
            expenses: await db.getByIndex('truckExpenses', 'truckId', id)
        };

        const { mes, ano } = Utils.getCurrentMonth();

        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><button class="btn btn-secondary btn-sm" onclick="App.navigate('trucks')" style="margin-bottom:8px">\u2190 Voltar</button><h1 class="page-title">${truck.placa}</h1><p class="page-subtitle">${truck.modelo || ''} ${truck.ano || ''} \u2014 ${truck.motorista || ''}</p></div>
            </div></div>
            <div class="page-body">
                <div class="filter-bar" style="margin-bottom:16px">
                    <div class="form-group"><label class="form-label">M\u00eas</label><select class="form-control" id="truck-filter-mes" onchange="Pages.truckDetail.applyTruckFilter()"><option value="">Todos</option>${Array.from({ length: 12 }, (_, i) => '<option value="' + (i + 1) + '"' + (i + 1 === mes ? ' selected' : '') + '>' + Utils.getMonthName(i + 1) + '</option>').join('')}</select></div>
                    <div class="form-group"><label class="form-label">Ano</label><input type="number" class="form-control" id="truck-filter-ano" value="${ano}" style="width:100px" onchange="Pages.truckDetail.applyTruckFilter()"></div>
                    <button class="btn btn-secondary btn-sm" onclick="document.getElementById('truck-filter-mes').value='';Pages.truckDetail.applyTruckFilter()" style="margin-top:16px">Mostrar Tudo</button>
                </div>
                <div id="truck-detail-content"></div>
            </div>`;

        this.applyTruckFilter();
    },

    applyTruckFilter() {
        const { truck, fuelings, freights, fines, expenses } = this._truckData;
        const mesVal = document.getElementById('truck-filter-mes').value;
        const ano = parseInt(document.getElementById('truck-filter-ano').value);

        let fFuel = fuelings, fFreight = freights, fFines = fines, fExpenses = expenses;

        if (mesVal) {
            const mes = parseInt(mesVal);
            const filterByMonth = (arr) => arr.filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === mes && d.getFullYear() === ano; });
            fFuel = filterByMonth(fFuel);
            fFreight = filterByMonth(fFreight);
            fFines = filterByMonth(fFines);
            fExpenses = filterByMonth(fExpenses);
        }

        const totalFuel = fFuel.reduce((s, f) => s + (f.valorTotal || 0), 0);
        const totalFreight = fFreight.reduce((s, f) => s + (f.valorFrete || 0), 0);
        const totalFines = fFines.reduce((s, f) => s + (f.valor || 0), 0);
        const totalExpenses = fExpenses.reduce((s, f) => s + (f.valor || 0), 0);
        const totalLitros = fFuel.reduce((s, f) => s + (f.litros || 0), 0);
        const saldoGeral = totalFreight - totalFuel - totalFines - totalExpenses;

        document.getElementById('truck-detail-content').innerHTML = `
                <div class="stats-grid animate-in">
                    <div class="stat-card" style="--stat-accent:var(--gradient-danger)"><div class="stat-icon">\u26fd</div><div class="stat-value">${Utils.formatCurrency(totalFuel)}</div><div class="stat-label">${fFuel.length} abastecimentos \u2014 ${Utils.formatNumber(totalLitros, 1)}L</div></div>
                    <div class="stat-card" style="--stat-accent:var(--gradient-success)"><div class="stat-icon">\ud83d\udce6</div><div class="stat-value">${Utils.formatCurrency(totalFreight)}</div><div class="stat-label">${fFreight.length} fretes realizados</div></div>
                    <div class="stat-card" style="--stat-accent:var(--gradient-warning)"><div class="stat-icon">\ud83d\udcb8</div><div class="stat-value">${Utils.formatCurrency(totalFines + totalExpenses)}</div><div class="stat-label">${fFines.length} multas, ${fExpenses.length} despesas</div></div>
                    <div class="stat-card" style="--stat-accent:${saldoGeral >= 0 ? 'var(--gradient-success)' : 'var(--gradient-danger)'}"><div class="stat-icon">\ud83d\udcb2</div><div class="stat-value ${saldoGeral >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(saldoGeral)}</div><div class="stat-label">Saldo Geral</div></div>
                </div>
                <div class="tabs">
                    <button class="tab-btn active" onclick="Pages.truckDetail.showTab('fuel',this)">\u26fd Abast.</button>
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('freight',this)">\ud83d\udce6 Fretes</button>
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('expenses',this)">\ud83d\udcb8 Despesas</button>
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('fines',this)">\ud83d\udea8 Multas</button>
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('closing',this)">\ud83d\udcca Fechamento</button>
                </div>
                <div id="tab-fuel" class="tab-content active">${this.renderFuelTab(fFuel)}</div>
                <div id="tab-freight" class="tab-content">${this.renderFreightTab(fFreight)}</div>
                <div id="tab-expenses" class="tab-content">${this.renderExpensesTab(fExpenses)}</div>
                <div id="tab-fines" class="tab-content">${this.renderFinesTab(fFines)}</div>
                <div id="tab-closing" class="tab-content">${this.renderClosingTab()}</div>`;
    },

    showTab(tab, btn) {
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + tab).classList.add('active');
        btn.classList.add('active');
    },

    renderFuelTab(fuelings) {
        return `<div class="d-flex justify-between align-center mb-2"><h3>Abastecimentos</h3><button class="btn btn-primary btn-sm" onclick="Pages.fuelings.showForm(null,${this.truckId})">＋ Novo</button></div>
        ${fuelings.length === 0 ? '<div class="empty-state"><div class="empty-icon">⛽</div><h3>Nenhum abastecimento</h3></div>' :
                `<div class="table-container"><table class="data-table"><thead><tr><th>Data</th><th>Posto</th><th>Litros</th><th>R$/L</th><th>KM</th><th>Total</th><th>Tipo</th><th></th></tr></thead><tbody>${fuelings.sort((a, b) => b.data?.localeCompare(a.data)).map(f => `<tr>
                <td>${Utils.formatDate(f.data)}</td><td>${f.posto || '—'}</td><td>${Utils.formatNumber(f.litros, 2)}</td><td>${Utils.formatCurrency(f.valorLitro)}</td>
                <td>${Utils.formatNumber(f.km)}</td><td class="font-bold">${Utils.formatCurrency(f.valorTotal)}</td><td><span class="badge badge-info">${f.tipoComb || 'Diesel'}</span></td>
                <td><button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.fuelings.showForm(${f.id},${f.truckId})">✏️</button> <button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.fuelings.remove(${f.id})">🗑️</button></td>
            </tr>`).join('')}</tbody></table></div>`}`;
    },

    renderFreightTab(freights) {
        return `<div class="d-flex justify-between align-center mb-2"><h3>Fretes</h3><button class="btn btn-primary btn-sm" onclick="Pages.freights.showForm(null,${this.truckId})">＋ Novo</button></div>
        ${freights.length === 0 ? '<div class="empty-state"><div class="empty-icon">📦</div><h3>Nenhum frete</h3></div>' :
                `<div class="table-container"><table class="data-table"><thead><tr><th>Data</th><th>Origem</th><th>Destino</th><th>KM</th><th>Tipo</th><th>Valor Frete</th><th>Cliente</th><th></th></tr></thead><tbody>${freights.sort((a, b) => b.data?.localeCompare(a.data)).map(f => `<tr>
                <td>${Utils.formatDate(f.data)}</td><td>${f.origem || '—'}</td><td>${f.destino || '—'}</td><td>${Utils.formatNumber(f.km)}</td>
                <td><span class="badge ${f.tipo === 'carregado' ? 'badge-success' : 'badge-warning'}">${f.tipo || '—'}</span></td>
                <td class="font-bold">${Utils.formatCurrency(f.valorFrete)}</td><td>${f.cliente || '—'}</td>
                <td><button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.freights.showForm(${f.id},${f.truckId})">✏️</button> <button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.freights.remove(${f.id})">🗑️</button></td>
            </tr>`).join('')}</tbody></table></div>`}`;
    },

    renderExpensesTab(expenses) {
        return `<div class="d-flex justify-between align-center mb-2"><h3>Despesas da Frota</h3><button class="btn btn-primary btn-sm" onclick="Pages.truckExpenses.showForm(null,${this.truckId})">＋ Nova</button></div>
        ${expenses.length === 0 ? '<div class="empty-state"><div class="empty-icon">💸</div><h3>Nenhuma despesa</h3></div>' :
                `<div class="table-container"><table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Fornecedor</th><th>Descrição</th><th>Valor</th><th></th></tr></thead><tbody>${expenses.sort((a, b) => b.data?.localeCompare(a.data)).map(e => `<tr>
                <td>${Utils.formatDate(e.data)}</td>
                <td><span class="badge badge-secondary">${e.tipo}</span></td>
                <td>${e.fornecedor || '—'}</td>
                <td>${e.descricao || '—'}</td>
                <td class="font-bold text-danger">-${Utils.formatCurrency(e.valor)}</td>
                <td><button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.truckExpenses.showForm(${e.id})">✏️</button> <button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.truckExpenses.remove(${e.id})">🗑️</button></td>
            </tr>`).join('')}</tbody></table></div>`}`;
    },

    renderFinesTab(fines) {
        return `<div class="d-flex justify-between align-center mb-2"><h3>Multas</h3><button class="btn btn-primary btn-sm" onclick="Pages.fines.showForm(null,${this.truckId})">＋ Nova</button></div>
        ${fines.length === 0 ? '<div class="empty-state"><div class="empty-icon">✅</div><h3>Nenhuma multa</h3></div>' :
                `<div class="table-container"><table class="data-table"><thead><tr><th>Data</th><th>Descrição</th><th>Local</th><th>Valor</th><th>Pontos</th><th>Status</th><th></th></tr></thead><tbody>${fines.sort((a, b) => b.data?.localeCompare(a.data)).map(f => `<tr>
                <td>${Utils.formatDate(f.data)}</td><td>${f.descricao || '—'}</td><td>${f.local || '—'}</td>
                <td class="font-bold text-danger">${Utils.formatCurrency(f.valor)}</td><td>${f.pontos || '—'}</td>
                <td><span class="badge ${f.status === 'paga' ? 'badge-success' : f.status === 'recorrida' ? 'badge-info' : 'badge-danger'}">${f.status || 'pendente'}</span></td>
                <td><button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.fines.showForm(${f.id},${f.truckId})">✏️</button> <button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.fines.remove(${f.id})">🗑️</button></td>
            </tr>`).join('')}</tbody></table></div>`}`;
    },

    renderClosingTab() {
        const { mes, ano } = Utils.getCurrentMonth();
        return `<div class="d-flex gap-2 align-center mb-2">
            <div class="form-group"><label class="form-label">Mês</label><select class="form-control" id="closing-mes">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === mes ? 'selected' : ''}>${Utils.getMonthName(i + 1)}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">Ano</label><input type="number" class="form-control" id="closing-ano" value="${ano}" style="width:100px"></div>
            <button class="btn btn-primary" onclick="Pages.truckDetail.generateClosing()" style="margin-top:16px">📊 Gerar Fechamento</button>
        </div><div id="closing-result"></div>`;
    },

    async generateClosing() {
        const mes = parseInt(document.getElementById('closing-mes').value);
        const ano = parseInt(document.getElementById('closing-ano').value);
        const closing = await db.generateMonthlyClosing(this.truckId, mes, ano);
        this._lastTruckClosing = closing;
        const allFuelings = closing.fuelingsForMedia || closing.fuelings || [];
        const sortedFuelings = allFuelings.filter(f => f.km > 0).sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km));

        document.getElementById('closing-result').innerHTML = `
            <div class="closing-summary animate-in">
                <div class="closing-item"><div class="closing-label">Abastecimentos (${closing.qtdAbastecimentos})</div><div class="closing-value text-danger">${Utils.formatCurrency(closing.totalAbastecimento)}</div></div>
                <div class="closing-item"><div class="closing-label">Fretes (${closing.qtdFretes})</div><div class="closing-value text-success">${Utils.formatCurrency(closing.totalFretes)}</div></div>
                <div class="closing-item"><div class="closing-label">Multas (${closing.qtdMultas})</div><div class="closing-value text-warning">${Utils.formatCurrency(closing.totalMultas)}</div></div>
                <div class="closing-item"><div class="closing-label">Despesas (${closing.qtdDespesas})</div><div class="closing-value text-danger">${Utils.formatCurrency(closing.totalDespesas)}</div></div>
                <div class="closing-item ${closing.saldo >= 0 ? 'positive' : 'negative'}"><div class="closing-label">Saldo</div><div class="closing-value">${Utils.formatCurrency(closing.saldo)}</div></div>
                <div class="closing-item"><div class="closing-label">Litros</div><div class="closing-value" id="truck-closing-litros">${Utils.formatNumber(closing.totalLitros, 1)}</div></div>
                <div class="closing-item"><div class="closing-label">M\u00e9dia km/L</div><div class="closing-value" id="truck-closing-media">${closing.mediaConsumo}</div></div>
            </div>

            ${sortedFuelings.length >= 2 ? `
            <div class="card mt-3" style="border:2px solid var(--accent-success);background:rgba(34,197,94,0.03)">
                <div class="card-header"><h3>\u26fd C\u00e1lculo da M\u00e9dia km/L</h3></div>
                <div class="card-body">
                    <p class="text-muted" style="font-size:0.8rem;margin-bottom:10px">Selecione as abastecidas de <strong>in\u00edcio</strong> e <strong>fim</strong>. F\u00f3rmula: <code>(KM final \u2212 KM inicial) / (Total litros \u2212 Litros da abastecida inicial)</code></p>
                    <div class="form-row">
                        <div class="form-group" style="flex:1">
                            <label class="form-label" style="font-weight:700;color:var(--accent-warning)">\ud83c\udfc1 Abastecida Inicial</label>
                            <select class="form-control" id="truck-media-start" onchange="Pages.truckDetail.recalcTruckMedia()">
                                ${sortedFuelings.map((f, i) => '<option value="' + f.id + '"' + (i === 0 ? ' selected' : '') + '>' + (f._prevMonth ? '[M\u00eas ant.] ' : '') + Utils.formatDate(f.data) + ' \u2014 ' + Utils.formatNumber(f.km) + ' km \u2014 ' + Utils.formatNumber(f.litros, 1) + 'L' + (f.posto ? ' \u2014 ' + f.posto : '') + '</option>').join('')}
                            </select>
                        </div>
                        <div class="form-group" style="flex:1">
                            <label class="form-label" style="font-weight:700;color:var(--accent-primary)">\ud83c\udfc1 Abastecida Final</label>
                            <select class="form-control" id="truck-media-end" onchange="Pages.truckDetail.recalcTruckMedia()">
                                ${sortedFuelings.map((f, i, arr) => '<option value="' + f.id + '"' + (i === arr.length - 1 ? ' selected' : '') + '>' + (f._prevMonth ? '[M\u00eas ant.] ' : '') + Utils.formatDate(f.data) + ' \u2014 ' + Utils.formatNumber(f.km) + ' km \u2014 ' + Utils.formatNumber(f.litros, 1) + 'L' + (f.posto ? ' \u2014 ' + f.posto : '') + '</option>').join('')}
                            </select>
                        </div>
                    </div>
                    <div id="truck-media-result" class="mt-2" style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);font-weight:600"></div>
                </div>
            </div>` : ''}

            <p class="text-muted" style="font-size:0.78rem;margin-top:12px">Gerado em ${new Date(closing.geradoEm).toLocaleString('pt-BR')}</p>`;

        if (sortedFuelings.length >= 2) this.recalcTruckMedia();
        Utils.showToast('Fechamento gerado!', 'success');
    },

    recalcTruckMedia() {
        const closing = this._lastTruckClosing;
        if (!closing) return;

        const startId = parseInt(document.getElementById('truck-media-start')?.value);
        const endId = parseInt(document.getElementById('truck-media-end')?.value);

        const fuelings = (closing.fuelingsForMedia || closing.fuelings || []).filter(f => f.km > 0).sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km));
        const startFuel = fuelings.find(f => f.id === startId);
        const endFuel = fuelings.find(f => f.id === endId);

        const resultEl = document.getElementById('truck-media-result');
        if (!startFuel || !endFuel) {
            if (resultEl) resultEl.innerHTML = '<span class="text-muted">Selecione ambas as abastecidas.</span>';
            return;
        }
        if (endFuel.km <= startFuel.km) {
            if (resultEl) resultEl.innerHTML = '<span style="color:var(--accent-danger)">\u26a0\ufe0f A abastecida final deve ter KM maior que a inicial.</span>';
            return;
        }

        const startIdx = fuelings.indexOf(startFuel);
        const endIdx = fuelings.indexOf(endFuel);
        const range = fuelings.slice(startIdx, endIdx + 1);
        const litrosRange = range.slice(1).reduce((s, f) => s + (f.litros || 0), 0);
        const kmDiff = endFuel.km - startFuel.km;
        const media = litrosRange > 0 ? kmDiff / litrosRange : 0;

        // Update closing data
        closing.mediaConsumo = parseFloat(media.toFixed(2));
        closing.totalKm = kmDiff;

        if (resultEl) {
            resultEl.innerHTML = '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">' +
                '<div>\ud83d\udccf KM: <strong>' + Utils.formatNumber(kmDiff) + '</strong> <span class="text-muted">(' + Utils.formatNumber(endFuel.km) + ' \u2212 ' + Utils.formatNumber(startFuel.km) + ')</span></div>' +
                '<div>\u26fd Litros: <strong>' + Utils.formatNumber(litrosRange, 1) + '</strong> <span class="text-muted">(' + (range.length - 1) + ' abastecidas)</span></div>' +
                '<div style="font-size:1.2rem;color:var(--accent-success)">\ud83d\udcca M\u00e9dia: <strong>' + media.toFixed(2) + ' km/L</strong></div>' +
                '</div>';
        }

        const litrosEl = document.getElementById('truck-closing-litros');
        const mediaEl = document.getElementById('truck-closing-media');
        if (litrosEl) litrosEl.textContent = Utils.formatNumber(litrosRange, 1);
        if (mediaEl) mediaEl.textContent = media.toFixed(2);
    }
};
