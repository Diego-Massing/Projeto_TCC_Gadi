// ===== PAGES MODULE - Dashboard, Trucks =====

const Pages = {};

// ===== DASHBOARD =====
Pages.dashboard = {
    async render() {
        const trucks = await db.getAll('trucks');
        const fuelings = await db.getAll('fuelings');
        const freights = await db.getAll('freights');
        const fines = await db.getAll('fines');
        const truckExpenses = await db.getAll('truckExpenses');
        const maintenancePlans = await db.getAll('maintenancePlans');
        const { mes, ano } = Utils.getCurrentMonth();

        this._allData = { trucks, fuelings, freights, fines, truckExpenses, maintenancePlans };

        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <div class="page-header-row">
                    <div>
                        <h1 class="page-title">Dashboard</h1>
                        <p class="page-subtitle">Vis\u00e3o geral da frota</p>
                    </div>
                </div>
            </div>
            <div class="page-body">
                <div class="filter-bar" style="margin-bottom:16px">
                    <div class="form-group"><label class="form-label">Placa</label><select class="form-control" id="dash-truck" onchange="Pages.dashboard.applyDashboardFilter()"><option value="">Todas</option>${trucks.map(t => '<option value="' + t.id + '">' + t.placa + '</option>').join('')}</select></div>
                    <div class="form-group"><label class="form-label">M\u00eas</label><select class="form-control" id="dash-mes" onchange="Pages.dashboard.applyDashboardFilter()">${Array.from({ length: 12 }, (_, i) => '<option value="' + (i + 1) + '"' + (i + 1 === mes ? ' selected' : '') + '>' + Utils.getMonthName(i + 1) + '</option>').join('')}</select></div>
                    <div class="form-group"><label class="form-label">Ano</label><input type="number" class="form-control" id="dash-ano" value="${ano}" style="width:100px" onchange="Pages.dashboard.applyDashboardFilter()"></div>
                </div>
                <div id="dash-alerts"></div>
                <div id="dash-content"></div>
            </div>`;

        this.applyDashboardFilter();
    },

    applyDashboardFilter() {
        const { trucks, fuelings, freights, fines, truckExpenses, maintenancePlans } = this._allData;
        const truckId = document.getElementById('dash-truck').value;
        const mes = parseInt(document.getElementById('dash-mes').value);
        const ano = parseInt(document.getElementById('dash-ano').value);

        let fFuel = fuelings;
        let fFreight = freights;
        let fFines = fines;
        let fExpenses = truckExpenses || [];

        if (truckId) {
            const tid = parseInt(truckId);
            fFuel = fFuel.filter(f => f.truckId === tid);
            fFreight = fFreight.filter(f => f.truckId === tid);
            fFines = fFines.filter(f => f.truckId === tid);
            fExpenses = fExpenses.filter(f => f.truckId === tid);
        }

        // Render Global Alerts
        this.renderGlobalAlerts(trucks, maintenancePlans || [], truckId);

        const fuelMonth = fFuel.filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === mes && d.getFullYear() === ano; });
        const freightMonth = fFreight.filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === mes && d.getFullYear() === ano; });
        const finesMonth = fFines.filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === mes && d.getFullYear() === ano; });
        const expensesMonth = fExpenses.filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === mes && d.getFullYear() === ano; });

        const totalFuelMonth = fuelMonth.reduce((s, f) => s + (f.valorTotal || 0), 0);
        const totalFreightMonth = freightMonth.reduce((s, f) => s + (f.valorFrete || 0), 0);
        const totalFinesMonth = finesMonth.reduce((s, f) => s + (f.valor || 0), 0);
        const totalExpensesMonth = expensesMonth.reduce((s, f) => s + (f.valor || 0), 0);
        const saldo = totalFreightMonth - totalFuelMonth - totalFinesMonth - totalExpensesMonth;
        const truckLabel = truckId ? trucks.find(t => t.id === parseInt(truckId))?.placa || '' : 'Toda a frota';

        document.getElementById('dash-content').innerHTML = `
                <div class="stats-grid animate-in">
                    <div class="stat-card" style="--stat-accent: var(--gradient-primary)">
                        <div class="stat-icon">\ud83d\ude9b</div>
                        <div class="stat-value">${truckId ? truckLabel : trucks.length}</div>
                        <div class="stat-label">${truckId ? 'Placa Selecionada' : 'Caminh\u00f5es Cadastrados'}</div>
                    </div>
                    <div class="stat-card" style="--stat-accent: var(--gradient-success)">
                        <div class="stat-icon">\ud83d\udcb0</div>
                        <div class="stat-value">${Utils.formatCurrency(totalFreightMonth)}</div>
                        <div class="stat-label">Receita de Fretes (${Utils.getMonthName(mes).substring(0, 3)})</div>
                    </div>
                    <div class="stat-card" style="--stat-accent: var(--gradient-danger)">
                        <div class="stat-icon">\u26fd</div>
                        <div class="stat-value">${Utils.formatCurrency(totalFuelMonth)}</div>
                        <div class="stat-label">Abastecimentos (${Utils.getMonthName(mes).substring(0, 3)})</div>
                    </div>
                    <div class="stat-card" style="--stat-accent: ${saldo >= 0 ? 'var(--gradient-success)' : 'var(--gradient-danger)'}">
                        <div class="stat-icon">${saldo >= 0 ? '\ud83d\udcc8' : '\ud83d\udcc9'}</div>
                        <div class="stat-value ${saldo >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(saldo)}</div>
                        <div class="stat-label">Saldo ${Utils.getMonthName(mes).substring(0, 3)}/${ano}</div>
                    </div>
                </div>
                <div class="charts-grid">
                    <div class="card"><div class="card-header"><h3>Receita vs Despesas (6 meses)</h3></div><div class="card-body chart-container"><canvas id="chart-revenue"></canvas></div></div>
                    <div class="card"><div class="card-header"><h3>Distribui\u00e7\u00e3o de Gastos</h3></div><div class="card-body chart-container"><canvas id="chart-expenses"></canvas></div></div>
                </div>
                <div class="charts-grid">
                    <div class="card"><div class="card-header"><h3>Top Caminh\u00f5es por Frete</h3></div><div class="card-body chart-container"><canvas id="chart-top-trucks"></canvas></div></div>
                    <div class="card"><div class="card-header"><h3>Multas Pendentes</h3></div><div class="card-body">${this.renderFinesList(fFines, trucks)}</div></div>
                </div>`;

        this.drawCharts(fFuel, fFreight, fFines, fExpenses, trucks, mes, ano);
    },

    renderGlobalAlerts(trucks, plans, selectedTruckId) {
        if (App.userRole === 'motorista') return; // Hide from drivers

        let targetPlans = plans;
        if (selectedTruckId) targetPlans = targetPlans.filter(p => p.truckId === parseInt(selectedTruckId));

        const alerts = [];
        targetPlans.forEach(p => {
            const truck = trucks.find(t => t.id === p.truckId);
            if (!truck) return;
            const truckKm = truck.kmAtual || 0;
            const nextKm = p.lastKm + p.kmInterval;
            const diff = nextKm - truckKm;
            const progress = ((truckKm - p.lastKm) / p.kmInterval) * 100;

            if (progress >= 90) {
                alerts.push({
                    placa: truck.placa,
                    truckId: truck.id,
                    item: p.item,
                    type: progress >= 100 ? 'danger' : 'warning',
                    msg: progress >= 100 ? `Vencida há ${Math.abs(diff)} KM` : `Faltam ${diff} KM`
                });
            }
        });

        const alertsContainer = document.getElementById('dash-alerts');
        if (alerts.length === 0) {
            alertsContainer.innerHTML = '';
            return;
        }

        alertsContainer.innerHTML = `
            <div class="card mb-3" style="border:1px solid var(--accent-warning); background:rgba(245, 158, 11, 0.05)">
                <div class="card-header"><h3 style="color:var(--accent-warning)">⚠️ Alertas de Manutenção Preventiva</h3></div>
                <div class="card-body">
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        ${alerts.map(a => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-card); border-left:4px solid var(--accent-${a.type}); border-radius:4px;">
                                <div><strong style="font-family:monospace; margin-right:8px">${a.placa}</strong> ${a.item}</div>
                                <div style="display:flex; align-items:center; gap:12px;">
                                    <span style="color:var(--accent-${a.type}); font-size:0.9rem; font-weight:600">${a.msg}</span>
                                    <button class="btn btn-sm btn-secondary" onclick="App.navigate('truck-detail', ${a.truckId})">Ver Caminhão</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>`;
    },

    renderFinesList(fines, trucks) {
        const pending = fines.filter(f => f.status !== 'paga').slice(-5).reverse();
        if (pending.length === 0) return '<div class="empty-state"><div class="empty-icon">✅</div><h3>Nenhuma multa pendente</h3></div>';
        return `<div style="display:flex;flex-direction:column;gap:10px">${pending.map(f => {
            const truck = trucks.find(t => t.id === f.truckId);
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-input);border-radius:var(--radius-md)">
                <div><span class="font-mono font-bold">${truck?.placa || '—'}</span> <span class="text-muted" style="margin-left:8px">${Utils.formatDate(f.data)}</span><br><small class="text-muted">${f.descricao || ''}</small></div>
                <span class="text-danger font-bold">${Utils.formatCurrency(f.valor)}</span>
            </div>`;
        }).join('')}</div>`;
    },

    drawCharts(fuelings, freights, fines, expenses, trucks, baseMes, baseAno) {
        // Revenue vs Expenses - 6 months ending at selected period
        const refDate = new Date(baseAno, baseMes - 1, 1);
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
            const m = d.getMonth() + 1, y = d.getFullYear();
            const mFuel = fuelings.filter(f => { const dd = new Date(f.data); return dd.getMonth() + 1 === m && dd.getFullYear() === y; });
            const mFreight = freights.filter(f => { const dd = new Date(f.data); return dd.getMonth() + 1 === m && dd.getFullYear() === y; });
            months.push({
                label: Utils.getMonthName(m).substring(0, 3),
                values: [mFreight.reduce((s, f) => s + (f.valorFrete || 0), 0), mFuel.reduce((s, f) => s + (f.valorTotal || 0), 0)]
            });
        }
        ChartEngine.drawBarChart('chart-revenue', months, { legend: ['Fretes', 'Abastecimentos'], colors: ['#10b981', '#ef4444'] });

        // Expenses distribution — filtered by selected month
        const fuelMonth = fuelings.filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === baseMes && d.getFullYear() === baseAno; });
        const finesMonth = fines.filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === baseMes && d.getFullYear() === baseAno; });
        const expMonth = (expenses || []).filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === baseMes && d.getFullYear() === baseAno; });
        const totalFuel = fuelMonth.reduce((s, f) => s + (f.valorTotal || 0), 0);
        const totalFines = finesMonth.reduce((s, f) => s + (f.valor || 0), 0);

        // Group expenses by type
        const expByType = {};
        expMonth.forEach(e => { const tipo = e.tipo || 'Outros'; expByType[tipo] = (expByType[tipo] || 0) + (e.valor || 0); });
        const expSlices = Object.entries(expByType).map(([tipo, val]) => ({ label: tipo, value: val }));

        const donutData = [
            { label: 'Combust\u00edvel', value: totalFuel },
            { label: 'Multas', value: totalFines },
            ...expSlices
        ].filter(d => d.value > 0);
        const totalGastos = donutData.reduce((s, d) => s + d.value, 0);
        const donutColors = ['#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#06b6d4', '#84cc16', '#ec4899', '#14b8a6'];
        ChartEngine.drawDonutChart('chart-expenses', donutData, { donut: true, centerText: Utils.formatCurrency(totalGastos), centerSubtext: 'Total Gastos', colors: donutColors });

        // Top trucks by freight — filtered by selected month
        const freightMonth = freights.filter(f => { const d = new Date(f.data); return d.getMonth() + 1 === baseMes && d.getFullYear() === baseAno; });
        const truckFreight = {};
        freightMonth.forEach(f => { truckFreight[f.truckId] = (truckFreight[f.truckId] || 0) + (f.valorFrete || 0); });
        const topTrucks = Object.entries(truckFreight).map(([tid, val]) => {
            const t = trucks.find(tt => tt.id === parseInt(tid));
            return { label: t?.placa || tid, value: val };
        }).sort((a, b) => b.value - a.value).slice(0, 6);
        ChartEngine.drawBarChart('chart-top-trucks', topTrucks, { colors: ['#6366f1'] });
    }
};

// ===== TRUCKS =====
Pages.trucks = {
    async render() {
        const trucks = await db.getAll('trucks');
        const fuelings = await db.getAll('fuelings');
        const freights = await db.getAll('freights');

        document.getElementById('page-content').innerHTML = `
            <div class="page-header">
                <div class="page-header-row">
                    <div><h1 class="page-title">Caminhões</h1><p class="page-subtitle">${trucks.length} veículos cadastrados</p></div>
                    <button class="btn btn-primary" onclick="Pages.trucks.showForm()">＋ Novo Caminhão</button>
                </div>
            </div>
            <div class="page-body">
                ${trucks.length === 0 ? '<div class="empty-state"><div class="empty-icon">🚛</div><h3>Nenhum caminhão cadastrado</h3><p>Adicione seu primeiro caminhão para começar.</p><button class="btn btn-primary btn-lg" onclick="Pages.trucks.showForm()">＋ Adicionar Caminhão</button></div>' :
                `<div class="trucks-grid animate-in">${trucks.map(t => {
                    const tFuel = fuelings.filter(f => f.truckId === t.id);
                    const tFreight = freights.filter(f => f.truckId === t.id);
                    const totalFuel = tFuel.reduce((s, f) => s + (f.valorTotal || 0), 0);
                    const totalFreight = tFreight.reduce((s, f) => s + (f.valorFrete || 0), 0);
                    return `<div class="truck-card" onclick="App.navigate('truck-detail',${t.id})">
                        <div style="display:flex;justify-content:space-between;align-items:start">
                            <div><div class="truck-placa">${t.placa}</div><div class="truck-info">${t.modelo || ''} ${t.ano || ''} — ${t.motorista || 'Sem motorista'}</div></div>
                            <span class="badge ${t.status === 'ativo' ? 'badge-success' : 'badge-warning'}">${t.status || 'ativo'}</span>
                        </div>
                        <div class="truck-stats">
                            <div class="truck-stat"><div class="label">Combustível</div><div class="value text-danger">${Utils.formatCurrency(totalFuel)}</div></div>
                            <div class="truck-stat"><div class="label">Fretes</div><div class="value text-success">${Utils.formatCurrency(totalFreight)}</div></div>
                        </div>
                        <div class="truck-actions">
                            <button class="btn btn-sm btn-secondary flex-1" onclick="event.stopPropagation();Pages.trucks.showForm(${t.id})">✏️ Editar</button>
                            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();Pages.trucks.remove(${t.id})" title="Excluir">🗑️</button>
                        </div>
                    </div>`;
                }).join('')}</div>`}
            </div>`;
    },

    showForm(id) {
        let truck = null;
        const doShow = async () => {
            if (id) truck = await db.getById('trucks', id);
            const modal = document.getElementById('modal-overlay');
            modal.querySelector('.modal-header h2').textContent = id ? 'Editar Caminhão' : 'Novo Caminhão';
            modal.querySelector('.modal-body').innerHTML = `
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Placa *</label><input type="text" class="form-control" id="f-placa" value="${truck?.placa || ''}" placeholder="ABC-1234" maxlength="8" style="text-transform:uppercase"></div>
                    <div class="form-group"><label class="form-label">Modelo</label><input type="text" class="form-control" id="f-modelo" value="${truck?.modelo || ''}" placeholder="Scania R450"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Ano</label><input type="number" class="form-control" id="f-ano" value="${truck?.ano || ''}" placeholder="2023"></div>
                    <div class="form-group"><label class="form-label">Motorista</label><input type="text" class="form-control" id="f-motorista" value="${truck?.motorista || ''}" placeholder="Nome do motorista"></div>
                </div>
                <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="f-status"><option value="ativo" ${truck?.status === 'ativo' ? 'selected' : ''}>Ativo</option><option value="inativo" ${truck?.status === 'inativo' ? 'selected' : ''}>Inativo</option><option value="manutencao" ${truck?.status === 'manutencao' ? 'selected' : ''}>Em Manutenção</option></select></div>
                <div style="margin-top:12px;padding:12px;background:var(--bg-primary);border-radius:var(--radius-md)">
                    <h4 style="font-size:0.85rem;color:var(--accent-primary);margin-bottom:8px">💰 Valores R$/KM desta placa (opcional)</h4>
                    <p class="text-muted" style="font-size:0.72rem;margin-bottom:8px">Deixe em branco para usar o valor padrão do sistema (Configurações).</p>
                    <div class="form-row">
                        <div class="form-group"><label class="form-label">R$/KM Carregado 🟢</label><input type="number" step="0.01" class="form-control" id="f-kmCarregado" value="${truck?.kmCarregado ?? ''}" placeholder="Padrão do sistema"></div>
                        <div class="form-group"><label class="form-label">R$/KM Vazio 🟡</label><input type="number" step="0.01" class="form-control" id="f-kmVazio" value="${truck?.kmVazio ?? ''}" placeholder="Padrão do sistema"></div>
                    </div>
                </div>`;
            modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.trucks.save(${id || 'null'})">Salvar</button>`;
            App.openModal();
        };
        doShow();
    },

    async save(id) {
        const placa = document.getElementById('f-placa').value.trim().toUpperCase();
        if (!placa) { Utils.showToast('Informe a placa', 'warning'); return; }
        const data = {
            placa,
            modelo: document.getElementById('f-modelo').value.trim(),
            ano: parseInt(document.getElementById('f-ano').value) || null,
            motorista: document.getElementById('f-motorista').value.trim(),
            status: document.getElementById('f-status').value,
            kmCarregado: document.getElementById('f-kmCarregado').value !== '' ? parseFloat(document.getElementById('f-kmCarregado').value) : null,
            kmVazio: document.getElementById('f-kmVazio').value !== '' ? parseFloat(document.getElementById('f-kmVazio').value) : null
        };
        try {
            if (id) { data.id = id; await db.update('trucks', data); Utils.showToast('Caminhão atualizado!', 'success'); }
            else { await db.add('trucks', data); Utils.showToast('Caminhão cadastrado!', 'success'); }
            App.closeModal();
            this.render();
        } catch (e) { console.error('Truck save error:', e); Utils.showToast('Erro ao salvar: ' + (e.message || 'placa já cadastrada?'), 'error'); }
    },

    async remove(id) {
        if (!confirm('Excluir este caminhão? Os dados vinculados serão mantidos.')) return;
        await db.delete('trucks', id);
        Utils.showToast('Caminhão excluído', 'success');
        this.render();
    }
};
