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
            expenses: await db.getByIndex('truckExpenses', 'truckId', id),
            maintenance: await db.getByIndex('maintenancePlans', 'truckId', id),
            tires: await db.getByIndex('tires', 'truckId', id)
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
                    ${App.userRole !== 'motorista' ? `
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('maintenance',this)">🔧 Manutenções</button>
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('tires',this)">🛞 Pneus</button>
                    ` : ''}
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('freight',this)">\ud83d\udce6 Fretes</button>
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('expenses',this)">\ud83d\udcb8 Despesas</button>
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('fines',this)">\ud83d\udea8 Multas</button>
                    <button class="tab-btn" onclick="Pages.truckDetail.showTab('closing',this)">\ud83d\udcca Fechamento</button>
                </div>
                <div id="tab-fuel" class="tab-content active">${this.renderFuelTab(fFuel)}</div>
                ${App.userRole !== 'motorista' ? `
                <div id="tab-maintenance" class="tab-content">${this.renderMaintenanceTab(this._truckData.maintenance, truck)}</div>
                <div id="tab-tires" class="tab-content">${this.renderTiresTab(this._truckData.tires)}</div>
                ` : ''}
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

    renderMaintenanceTab(plans, truck) {
        const truckKm = truck.kmAtual || 0;
        return `<div class="d-flex justify-between align-center mb-2">
            <h3>Manutenções Preventivas (Base KM)</h3>
            <button class="btn btn-primary btn-sm" onclick="Pages.truckDetail.showMaintenanceForm(null)">＋ Novo Plano</button>
        </div>
        ${(!plans || plans.length === 0) ? '<div class="empty-state"><div class="empty-icon">🔧</div><h3>Nenhum plano cadastrado</h3></div>' :
                `<div class="trucks-grid animate-in" style="margin-top:16px">${plans.map(p => {
                    const nextKm = p.lastKm + p.kmInterval;
                    const diff = nextKm - truckKm;
                    const progress = Math.min(100, Math.max(0, ((truckKm - p.lastKm) / p.kmInterval) * 100));
                    const statusColor = progress > 100 ? 'var(--accent-danger)' : (progress > 90 ? 'var(--accent-warning)' : 'var(--accent-success)');
                    return `<div class="truck-card">
                <div style="display:flex;justify-content:space-between;align-items:start">
                    <h4 style="font-size:1.1rem;margin:0">${p.item}</h4>
                    <span class="badge" style="background:${statusColor};color:#fff">${diff < 0 ? 'Vencido' : 'OK'}</span>
                </div>
                <div class="text-muted" style="font-size:0.8rem;margin:8px 0">Última troca: ${p.lastKm} KM | Trocado a cada ${p.kmInterval} KM</div>
                <div style="width:100%;height:8px;background:var(--bg-input);border-radius:4px;margin-bottom:8px;overflow:hidden">
                    <div style="height:100%;width:${progress}%;background:${statusColor};transition:width 0.3s"></div>
                </div>
                <div style="font-size:0.85rem;font-weight:600;display:flex;justify-content:space-between">
                    <span style="color:${statusColor}">${diff < 0 ? `Passou ${Math.abs(diff)} KM` : `Faltam ${diff} KM`}</span>
                    <span>Trocar em: ${nextKm} KM</span>
                </div>
                <div class="truck-actions" style="margin-top:16px">
                    <button class="btn btn-sm btn-primary flex-1" onclick="Pages.truckDetail.registerMaintenanceSwap(${p.id})">✅ Registrar Troca</button>
                    <button class="btn btn-sm btn-secondary" onclick="Pages.truckDetail.showMaintenanceForm(${p.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="Pages.truckDetail.deleteMaintenance(${p.id})">🗑️</button>
                </div>
            </div>`;
                }).join('')}</div>`}`;
    },

    renderTiresTab(tires) {
        return `<div class="d-flex justify-between align-center mb-2">
            <h3>Controle de Pneus</h3>
            <span class="text-muted" style="font-size:0.85rem">Clique na posição para gerenciar.</span>
        </div>
        <div style="background:var(--bg-secondary);padding:24px;border-radius:12px;margin-top:16px;display:flex;flex-direction:column;align-items:center;gap:30px">
            
            <!-- Eixo Direcional (1) -->
            <div style="display:flex;justify-content:center;gap:120px;position:relative;width:100%">
                <div style="position:absolute;left:50%;top:0;bottom:-40px;width:12px;background:#334155;transform:translateX(-50%);z-index:1;border-radius:6px"></div>
                <div style="position:absolute;left:50%;top:50%;width:80px;height:6px;background:#334155;transform:translate(-50%,-50%);z-index:0"></div>
                ${this.renderTireSlot(tires, 1, 'LE')}
                ${this.renderTireSlot(tires, 1, 'LD')}
            </div>

            <!-- Eixo Tração (2) -->
            <div style="display:flex;justify-content:center;gap:80px;position:relative;width:100%">
                <div style="position:absolute;left:50%;top:0;bottom:-40px;width:12px;background:#334155;transform:translateX(-50%);z-index:1"></div>
                <!-- Eixo horizontal longo -->
                <div style="position:absolute;left:50%;top:50%;width:160px;height:6px;background:#334155;transform:translate(-50%,-50%);z-index:0"></div>
                
                <div style="display:flex;gap:4px">
                    ${this.renderTireSlot(tires, 2, 'LE')}
                    ${this.renderTireSlot(tires, 2, 'LI')}
                </div>
                <div style="display:flex;gap:4px">
                    ${this.renderTireSlot(tires, 2, 'RI')}
                    ${this.renderTireSlot(tires, 2, 'RD')}
                </div>
            </div>

            <!-- Eixo Truck (3) -->
            <div style="display:flex;justify-content:center;gap:80px;position:relative;width:100%">
                <div style="position:absolute;left:50%;top:0;bottom:0px;width:12px;background:#334155;transform:translateX(-50%);z-index:1;border-radius:0 0 6px 6px"></div>
                <div style="position:absolute;left:50%;top:50%;width:160px;height:6px;background:#334155;transform:translate(-50%,-50%);z-index:0"></div>
                
                <div style="display:flex;gap:4px">
                    ${this.renderTireSlot(tires, 3, 'LE')}
                    ${this.renderTireSlot(tires, 3, 'LI')}
                </div>
                <div style="display:flex;gap:4px">
                    ${this.renderTireSlot(tires, 3, 'RI')}
                    ${this.renderTireSlot(tires, 3, 'RD')}
                </div>
            </div>

        </div>`;
    },

    renderTireSlot(tires, eixo, posicao) {
        const tire = (tires || []).find(t => t.eixo === eixo && t.posicao === posicao);
        const hasTire = !!tire;
        const color = hasTire ? (tire.status === 'Novo' ? 'var(--accent-success)' : 'var(--accent-info)') : 'var(--border-color)';

        return `<div onclick="Pages.truckDetail.showTireForm(${this.truckId}, ${eixo}, '${posicao}', ${tire?.id || 'null'})" style="width:40px;height:80px;background:var(--bg-card);border:2px solid ${color};border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;position:relative;z-index:2;box-shadow:inset 0 0 10px rgba(0,0,0,0.5)">
            <div style="font-size:0.6rem;color:var(--text-muted);writing-mode:vertical-rl;text-orientation:mixed">${hasTire ? tire.fogo : 'VAZIO'}</div>
        </div>`;
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
        const sortedFuelings = allFuelings.filter(f => f.km > 0 && f.tipoComb !== 'Arla').sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km));

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

        const fuelings = (closing.fuelingsForMedia || closing.fuelings || []).filter(f => f.km > 0 && f.tipoComb !== 'Arla').sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km));
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
    },

    // ===== MAINTENANCE LOGIC =====
    async showMaintenanceForm(id) {
        let plan = null;
        if (id) plan = this._truckData.maintenance.find(p => p.id === id);

        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Plano' : 'Novo Plano de Manutenção';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-group">
                <label class="form-label">Item / Serviço *</label>
                <input type="text" class="form-control" id="mp-item" value="${plan?.item || ''}" placeholder="Ex: Óleo de Motor, Filtros, Lonas">
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1">
                    <label class="form-label">Intervalo de Troca (KM) *</label>
                    <input type="number" class="form-control" id="mp-interval" value="${plan?.kmInterval || ''}" placeholder="Ex: 40000">
                </div>
                <div class="form-group" style="flex:1">
                    <label class="form-label">Última Troca (KM) *</label>
                    <input type="number" class="form-control" id="mp-last" value="${plan?.lastKm || this._truckData.truck.kmAtual || 0}">
                </div>
            </div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.truckDetail.saveMaintenance(${id || 'null'})">Salvar</button>`;
        App.openModal();
    },

    async saveMaintenance(id) {
        const data = {
            truckId: this.truckId,
            item: document.getElementById('mp-item').value.trim(),
            kmInterval: parseInt(document.getElementById('mp-interval').value),
            lastKm: parseInt(document.getElementById('mp-last').value)
        };
        if (!data.item || !data.kmInterval) { Utils.showToast('Preencha os campos obrigatórios', 'warning'); return; }

        try {
            if (id) { data.id = id; await db.update('maintenancePlans', data); }
            else { await db.add('maintenancePlans', data); }
            Utils.showToast('Plano salvo!', 'success');
            App.closeModal();
            this.render(this.truckId);
            setTimeout(() => this.showTab('maintenance', document.querySelectorAll('.tab-btn')[1]), 200);
        } catch (e) { Utils.showToast('Erro ao salvar plano', 'error'); }
    },

    async registerMaintenanceSwap(id) {
        const truckKm = this._truckData.truck.kmAtual || 0;
        if (!confirm(`Confirmar que a troca foi realizada no KM atual do caminhão (${truckKm})?`)) return;
        try {
            const plan = this._truckData.maintenance.find(p => p.id === id);
            plan.lastKm = truckKm;
            plan.lastDate = new Date().toISOString().split('T')[0];
            await db.update('maintenancePlans', plan);
            Utils.showToast('Troca registrada!', 'success');
            this.render(this.truckId);
            setTimeout(() => this.showTab('maintenance', document.querySelectorAll('.tab-btn')[1]), 200);
        } catch (e) { Utils.showToast('Erro ao registrar', 'error'); }
    },

    async deleteMaintenance(id) {
        if (!confirm('Excluir este plano de manutenção?')) return;
        await db.delete('maintenancePlans', id);
        this.render(this.truckId);
        setTimeout(() => this.showTab('maintenance', document.querySelectorAll('.tab-btn')[1]), 200);
    },

    // ===== TIRES LOGIC =====
    async showTireForm(truckId, eixo, posicao, id) {
        let tire = null;
        if (id) tire = this._truckData.tires.find(t => t.id === id);

        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Pneu' : 'Novo Pneu';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-row">
                <div class="form-group" style="flex:1"><label class="form-label">Eixo</label><input type="text" class="form-control" value="${eixo}" disabled></div>
                <div class="form-group" style="flex:1"><label class="form-label">Posição</label><input type="text" class="form-control" value="${posicao}" disabled></div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1"><label class="form-label">Fogo do Pneu *</label><input type="text" class="form-control" id="tr-fogo" value="${tire?.fogo || ''}" style="text-transform:uppercase"></div>
                <div class="form-group" style="flex:1"><label class="form-label">Marca</label><input type="text" class="form-control" id="tr-marca" value="${tire?.marca || ''}"></div>
            </div>
            <div class="form-row">
                <div class="form-group" style="flex:1"><label class="form-label">KM de Instalação</label><input type="number" class="form-control" id="tr-km" value="${tire?.kmInstalacao || this._truckData.truck.kmAtual || 0}"></div>
                <div class="form-group" style="flex:1"><label class="form-label">Status</label><select class="form-control" id="tr-status">
                    <option value="Novo" ${tire?.status === 'Novo' ? 'selected' : ''}>Novo</option>
                    <option value="Recapagem 1" ${tire?.status === 'Recapagem 1' ? 'selected' : ''}>Recapagem 1</option>
                    <option value="Recapagem 2" ${tire?.status === 'Recapagem 2' ? 'selected' : ''}>Recapagem 2</option>
                    <option value="Recapagem 3" ${tire?.status === 'Recapagem 3' ? 'selected' : ''}>Recapagem 3</option>
                </select></div>
            </div>
            ${id ? `<div style="margin-top:16px;text-align:right"><button class="btn btn-sm btn-danger" onclick="Pages.truckDetail.removeTire(${id})">🗑️ Remover Pneu (Desmontar)</button></div>` : ''}`;

        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.truckDetail.saveTire(${truckId}, ${eixo}, '${posicao}', ${id || 'null'})">Salvar</button>`;
        App.openModal();
    },

    async saveTire(truckId, eixo, posicao, id) {
        const fogo = document.getElementById('tr-fogo').value.trim().toUpperCase();
        if (!fogo) { Utils.showToast('Informe o número de fogo do pneu.', 'warning'); return; }

        const data = {
            truckId, eixo, posicao, fogo,
            marca: document.getElementById('tr-marca').value.trim() || null,
            kmInstalacao: parseInt(document.getElementById('tr-km').value) || 0,
            status: document.getElementById('tr-status').value
        };

        try {
            if (id) { data.id = id; await db.update('tires', data); }
            else { await db.add('tires', data); }
            Utils.showToast('Pneu montado!', 'success');
            App.closeModal();
            this.render(this.truckId);
            setTimeout(() => this.showTab('tires', document.querySelectorAll('.tab-btn')[2]), 200);
        } catch (e) { Utils.showToast('Erro ao salvar pneu', 'error'); }
    },

    async removeTire(id) {
        if (!confirm('Deseja desmontar/remover este pneu?')) return;
        try {
            await db.delete('tires', id);
            Utils.showToast('Pneu desmontado!', 'success');
            App.closeModal();
            this.render(this.truckId);
            setTimeout(() => this.showTab('tires', document.querySelectorAll('.tab-btn')[2]), 200);
        } catch (e) { Utils.showToast('Erro ao remover pneu', 'error'); }
    }
};
