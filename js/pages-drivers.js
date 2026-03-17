// ===== USERS / DRIVERS PAGE =====
Pages.users = {
    async render() {
        const users = await db.getAll('users');
        const trucks = await db.getAll('trucks');
        const drivers = users.filter(u => u.role === 'motorista');
        const admins = users.filter(u => u.role === 'admin');
        const viewers = users.filter(u => u.role === 'visualizador');

        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">👥 Usuários</h1><p class="page-subtitle">${users.length} usuários — ${drivers.length} motoristas, ${admins.length} admins, ${viewers.length} visualizadores</p></div>
                ${App.userRole === 'admin' ? `<button class="btn btn-primary" onclick="Pages.users.showForm()">＋ Novo Usuário</button>` : ''}
            </div></div>
            <div class="page-body">
                ${users.length === 0 ? '<div class="empty-state"><div class="empty-icon">👥</div><h3>Nenhum usuário cadastrado</h3><p>Adicione motoristas, visualizadores e administradores.</p><button class="btn btn-primary btn-lg" onclick="Pages.users.showForm()">＋ Adicionar Usuário</button></div>' :
                `<div class="table-container"><table class="data-table"><thead><tr><th>Nome</th><th>Função</th><th>Login</th><th>Caminhão</th><th>Telefone</th><th>Salário Fixo</th><th></th></tr></thead><tbody>${users.map(u => {
                    const truck = trucks.find(t => t.id === u.truckId);
                    const roleColors = { admin: 'badge-info', motorista: 'badge-success', visualizador: 'badge-warning' };
                    const roleLabels = { admin: '🛡️ Admin', motorista: '🚛 Motorista', visualizador: '👁️ Visualizador' };
                    return `<tr>
                            <td class="font-bold">${u.nome || '—'}</td>
                            <td><span class="badge ${roleColors[u.role] || 'badge-info'}">${roleLabels[u.role] || u.role}</span></td>
                            <td>${u.temLogin ? '<span class="badge badge-success" title="' + (u.authEmail || '') + '">🔐 Sim</span>' : '<span class="text-muted">—</span>'}</td>
                            <td class="font-mono">${truck ? truck.placa : '<span class="text-muted">—</span>'}</td>
                            <td>${u.telefone || '—'}</td>
                            <td>${u.role === 'motorista' ? Utils.formatCurrency(u.salarioFixo || 0) : '—'}</td>
                            <td>
                                ${App.userRole === 'admin' ? `<button class="btn btn-icon btn-secondary btn-sm" onclick="Pages.users.showForm(${u.id})">✏️</button>` : ''}
                                ${u.role === 'motorista' ? `<button class="btn btn-icon btn-secondary btn-sm" onclick="App.navigate('driver-closing',${u.id})" title="Fechamento">📊</button>` : ''}
                                ${App.userRole === 'admin' ? `<button class="btn btn-icon btn-sm" style="color:var(--accent-danger)" onclick="Pages.users.remove(${u.id})">🗑️</button>` : ''}
                            </td>
                        </tr>`;
                }).join('')}</tbody></table></div>`}
            </div>`;
    },

    async showForm(id) {
        const trucks = await db.getAll('trucks');
        let user = null;
        if (id) user = await db.getById('users', id);
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Usuário' : 'Novo Usuário';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-group"><label class="form-label">Nome Completo *</label><input type="text" class="form-control" id="f-nome" value="${user?.nome || ''}"></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Função *</label><select class="form-control" id="f-role" onchange="Pages.users.toggleDriverFields()">
                    <option value="motorista" ${user?.role === 'motorista' || !user ? 'selected' : ''}>🚛 Motorista</option>
                    <option value="admin" ${user?.role === 'admin' ? 'selected' : ''}>🛡️ Administrador</option>
                    <option value="visualizador" ${user?.role === 'visualizador' ? 'selected' : ''}>👁️ Visualizador</option>
                </select></div>
                <div class="form-group"><label class="form-label">Telefone</label><input type="text" class="form-control" id="f-telefone" value="${user?.telefone || ''}" placeholder="(11) 99999-9999"></div>
            </div>
            <div id="driver-fields">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">Caminhão Associado</label><select class="form-control" id="f-truckId">
                        <option value="">— Nenhum —</option>
                        ${trucks.map(t => `<option value="${t.id}" ${user?.truckId === t.id ? 'selected' : ''}>${t.placa} — ${t.modelo || ''}</option>`).join('')}
                    </select></div>
                    <div class="form-group"><label class="form-label">Salário Fixo Mensal</label><input type="number" step="0.01" class="form-control" id="f-salarioFixo" value="${user?.salarioFixo || ''}" placeholder="0.00"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label class="form-label">% Comissão KM Carregado</label><input type="number" step="0.1" class="form-control" id="f-comKmCarregado" value="${user?.comKmCarregado ?? ''}" placeholder="Usar padrão do sistema"></div>
                    <div class="form-group"><label class="form-label">% Comissão KM Vazio</label><input type="number" step="0.1" class="form-control" id="f-comKmVazio" value="${user?.comKmVazio ?? ''}" placeholder="Usar padrão do sistema"></div>
                </div>
                <p class="text-muted" style="font-size:0.75rem;margin-top:-8px">Deixe em branco para usar % padrão das Configurações.</p>
            </div>
            <div class="form-group"><label class="form-label">Observações</label><input type="text" class="form-control" id="f-obs" value="${user?.obs || ''}"></div>
            <hr style="border-color:#333;margin:16px 0">
            <div class="form-group" style="display:flex;align-items:center;gap:12px">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                    <input type="checkbox" id="f-temLogin" ${user?.temLogin ? 'checked' : ''} onchange="Pages.users.toggleLoginFields()">
                    <span class="form-label" style="margin:0">🔐 Este usuário terá acesso ao sistema (login)</span>
                </label>
            </div>
            <div id="login-fields" style="display:none">
                <div class="form-row">
                    <div class="form-group"><label class="form-label">E-mail de acesso *</label><input type="email" class="form-control" id="f-authEmail" value="${user?.authEmail || ''}" placeholder="email@exemplo.com"></div>
                    ${!id ? '<div class="form-group"><label class="form-label">Senha inicial *</label><input type="password" class="form-control" id="f-authPassword" placeholder="Mín. 6 caracteres"></div>' : ''}
                </div>
                <p class="text-muted" style="font-size:0.75rem;margin-top:-8px">${id && user?.temLogin ? '⚠️ Para alterar a senha, o usuário deve usar "Esqueci minha senha".' : 'Uma conta será criada para este usuário acessar o sistema.'}</p>
            </div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.users.save(${id || 'null'})">Salvar</button>`;
        App.openModal();
        this.toggleDriverFields();
        this.toggleLoginFields();
    },

    toggleDriverFields() {
        const role = document.getElementById('f-role')?.value;
        const fields = document.getElementById('driver-fields');
        if (fields) fields.style.display = role === 'motorista' ? 'block' : 'none';
    },

    toggleLoginFields() {
        const checked = document.getElementById('f-temLogin')?.checked;
        const fields = document.getElementById('login-fields');
        if (fields) fields.style.display = checked ? 'block' : 'none';
    },

    async save(id) {
        const nome = document.getElementById('f-nome').value.trim();
        if (!nome) { Utils.showToast('Informe o nome', 'warning'); return; }
        const role = document.getElementById('f-role').value;
        const temLogin = document.getElementById('f-temLogin')?.checked || false;
        const authEmail = document.getElementById('f-authEmail')?.value?.trim() || '';
        const authPassword = document.getElementById('f-authPassword')?.value || '';

        // Validate login fields
        if (temLogin && !id) {
            if (!authEmail) { Utils.showToast('Informe o e-mail de acesso', 'warning'); return; }
            if (!authPassword || authPassword.length < 6) { Utils.showToast('Senha deve ter no mínimo 6 caracteres', 'warning'); return; }
        }

        const data = {
            nome, role, temLogin,
            authEmail: temLogin ? authEmail : null,
            telefone: document.getElementById('f-telefone').value.trim(),
            truckId: parseInt(document.getElementById('f-truckId').value) || null,
            salarioFixo: parseFloat(document.getElementById('f-salarioFixo').value) || 0,
            comKmCarregado: document.getElementById('f-comKmCarregado').value !== '' ? parseFloat(document.getElementById('f-comKmCarregado').value) : null,
            comKmVazio: document.getElementById('f-comKmVazio').value !== '' ? parseFloat(document.getElementById('f-comKmVazio').value) : null,
            obs: document.getElementById('f-obs').value.trim()
        };
        if (role !== 'motorista') { data.truckId = null; data.salarioFixo = 0; data.comKmCarregado = null; data.comKmVazio = null; }

        try {
            // If temLogin is true and this is a NEW user, create auth account via signUp
            if (temLogin && !id && authEmail && authPassword) {
                // Store current session so we can restore it after signUp
                const { data: currentSession } = await supabase.auth.getSession();

                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: authEmail,
                    password: authPassword
                });

                if (signUpError) {
                    if (signUpError.message.includes('already registered')) {
                        Utils.showToast('⚠️ E-mail já existe no Auth. Vinculando ao novo usuário.', 'warning');
                    } else {
                        Utils.showToast('Erro ao criar conta: ' + signUpError.message, 'error');
                        return;
                    }
                }

                // signUp may auto-login the new user, which would log out the admin
                // Restore admin session if that happened
                if (currentSession?.session) {
                    await supabase.auth.setSession({
                        access_token: currentSession.session.access_token,
                        refresh_token: currentSession.session.refresh_token
                    });
                }




                Utils.showToast('✅ Conta de acesso criada com sucesso!', 'success');
            }

            if (id) { data.id = id; await db.update('users', data); Utils.showToast('Usuário atualizado!', 'success'); }
            else { await db.add('users', data); Utils.showToast('Usuário cadastrado!', 'success'); }
            App.closeModal(); this.render();
        } catch (e) {
            console.error('Save user error:', e);
            Utils.showToast('Erro ao salvar: ' + (e.message || e), 'error');
        }
    },

    async remove(id) {
        if (!confirm('Excluir este usuário?')) return;
        await db.delete('users', id); Utils.showToast('Excluído', 'success'); this.render();
    }
};

// ===== DRIVER CLOSING PAGE =====
Pages.driverClosing = {
    userId: null,

    async render(userId) {
        this.userId = userId;
        const users = await db.getAll('users');
        const drivers = users.filter(u => u.role === 'motorista');
        const trucks = await db.getAll('trucks');
        const hoje = new Date();
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];

        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">💼 Fechamento do Motorista</h1><p class="page-subtitle">Comissões, despesas, prêmios e pagamento</p></div>
            </div></div>
            <div class="page-body">
                <div class="filter-bar">
                    <div class="form-group"><label class="form-label">Motorista</label><select class="form-control" id="dc-driver" onchange="Pages.driverClosing.onFilterChange()">
                        <option value="">Selecione</option>
                        ${drivers.map(d => { const trk = trucks.find(t => t.id === d.truckId); return `<option value="${d.id}" ${d.id === userId ? 'selected' : ''}>${d.nome} ${trk ? '(' + trk.placa + ')' : ''}</option>`; }).join('')}
                    </select></div>
                    <div class="form-group"><label class="form-label">Data Início</label><input type="date" class="form-control" id="dc-data-inicio" value="${primeiroDia}" onchange="Pages.driverClosing.onFilterChange()"></div>
                    <div class="form-group"><label class="form-label">Data Fim</label><input type="date" class="form-control" id="dc-data-fim" value="${ultimoDia}" onchange="Pages.driverClosing.onFilterChange()"></div>
                    <div class="form-group"><label class="form-label">Dias Trabalhados</label><input type="number" min="1" max="31" class="form-control" id="dc-dias" value="${new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()}" style="width:100px" title="Dias trabalhados no período (para comissão fixa proporcional)"></div>
                </div>

                <!-- Management Section (Always visible if driver selected) -->
                <div id="dc-management-section" style="display:none; margin-bottom: 20px;">
                    <div class="row">
                        <!-- Expenses Column -->
                        <div class="col-md-4" style="flex:1; margin-right:10px">
                            <div class="card">
                                <div class="card-header" style="background:var(--bg-secondary);padding:10px 15px">
                                    <h4 style="font-size:0.9rem;margin:0">📝 Despesas (Reembolso)</h4>
                                    <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.8rem" onclick="Pages.driverClosing.showExpenseForm()">＋</button>
                                </div>
                                <div id="dc-expenses-list" class="card-body" style="padding:0;max-height:200px;overflow-y:auto"></div>
                            </div>
                        </div>
                        <!-- Bonuses Column -->
                        <div class="col-md-4" style="flex:1; margin-right:10px">
                            <div class="card">
                                <div class="card-header" style="background:var(--bg-secondary);padding:10px 15px">
                                    <h4 style="font-size:0.9rem;margin:0">🏆 Prêmios / Bônus</h4>
                                    <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.8rem" onclick="Pages.driverClosing.showBonusForm()">＋</button>
                                </div>
                                <div id="dc-bonuses-list" class="card-body" style="padding:0;max-height:200px;overflow-y:auto"></div>
                            </div>
                        </div>
                        <!-- Discounts Column -->
                        <div class="col-md-4" style="flex:1">
                            <div class="card">
                                <div class="card-header" style="background:var(--bg-secondary);padding:10px 15px">
                                    <h4 style="font-size:0.9rem;margin:0;color:var(--accent-danger)">💸 Vales / Adiantamentos</h4>
                                    <button class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:0.8rem" onclick="Pages.driverClosing.showDiscountForm()">＋</button>
                                </div>
                                <div id="dc-discounts-list" class="card-body" style="padding:0;max-height:200px;overflow-y:auto"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div style="text-align:center; margin-top: 20px;">
                        <button class="btn btn-primary btn-lg" onclick="Pages.driverClosing.generate()">📊 Gerar Relatório de Fechamento</button>
                    </div>
                </div>

                <div id="driver-closing-result"></div>
            </div>`;

        if (userId) {
            this.onFilterChange();
        }
    },

    async onFilterChange() {
        this.userId = parseInt(document.getElementById('dc-driver').value) || null;
        if (!this.userId) {
            document.getElementById('dc-management-section').style.display = 'none';
            document.getElementById('driver-closing-result').innerHTML = '';
            return;
        }

        const dataInicio = document.getElementById('dc-data-inicio').value;
        const dataFim = document.getElementById('dc-data-fim').value;

        // Update dias trabalhados max when date range changes
        const startD = new Date(dataInicio + 'T00:00:00');
        const endD = new Date(dataFim + 'T00:00:00');
        const diasIntervalo = Math.round((endD - startD) / (1000 * 60 * 60 * 24)) + 1;
        const diasInput = document.getElementById('dc-dias');
        if (diasInput) {
            diasInput.max = diasIntervalo;
            if (parseInt(diasInput.value) > diasIntervalo || !diasInput._userEdited) {
                diasInput.value = diasIntervalo;
            }
        }

        // Show management section
        document.getElementById('dc-management-section').style.display = 'block';

        // Hide previous closing result until generated again
        document.getElementById('driver-closing-result').innerHTML = '';

        await this.loadManagementData(this.userId, dataInicio, dataFim);
    },

    async loadManagementData(userId, dataInicio, dataFim) {
        const expenses = await db.getDataByUserAndDateRange('driverExpenses', userId, dataInicio, dataFim);
        const bonuses = await db.getDataByUserAndDateRange('driverBonuses', userId, dataInicio, dataFim);
        const discounts = await db.getDataByUserAndDateRange('driverDiscounts', userId, dataInicio, dataFim);

        // Render Expenses
        const expHtml = expenses.length ? `<table class="table-sm" style="width:100%">
            ${expenses.map(e => `<tr style="border-bottom:1px solid #eee">
                <td style="padding:8px"><div style="font-weight:600">${e.descricao}</div><div style="font-size:0.75rem;color:#888">${Utils.formatDate(e.data)}</div></td>
                <td class="text-right" style="padding:8px"><div style="font-weight:600">${Utils.formatCurrency(e.valor)}</div></td>
                <td style="width:30px"><button class="btn-icon" style="color:red;font-size:12px" onclick="Pages.driverClosing.removeExpense(${e.id})">🗑️</button></td>
            </tr>`).join('')}
        </table>` : '<div style="padding:15px;text-align:center;color:#aaa;font-size:0.85rem">Nenhuma despesa</div>';
        document.getElementById('dc-expenses-list').innerHTML = expHtml;

        // Render Bonuses
        const bonHtml = bonuses.length ? `<table class="table-sm" style="width:100%">
            ${bonuses.map(e => `<tr style="border-bottom:1px solid #eee">
                <td style="padding:8px"><div style="font-weight:600">${e.descricao}</div><div style="font-size:0.75rem;color:#888">${Utils.formatDate(e.data)}</div></td>
                <td class="text-right" style="padding:8px"><div style="font-weight:600;color:green">${Utils.formatCurrency(e.valor)}</div></td>
                <td style="width:30px"><button class="btn-icon" style="color:red;font-size:12px" onclick="Pages.driverClosing.removeBonus(${e.id})">🗑️</button></td>
            </tr>`).join('')}
        </table>` : '<div style="padding:15px;text-align:center;color:#aaa;font-size:0.85rem">Nenhum bônus</div>';
        document.getElementById('dc-bonuses-list').innerHTML = bonHtml;

        // Render Discounts
        const discHtml = discounts.length ? `<table class="table-sm" style="width:100%">
            ${discounts.map(e => `<tr style="border-bottom:1px solid #eee">
                <td style="padding:8px"><div style="font-weight:600">${e.descricao}</div><div style="font-size:0.75rem;color:#888">${Utils.formatDate(e.data)}</div></td>
                <td class="text-right" style="padding:8px"><div style="font-weight:600;color:red">-${Utils.formatCurrency(e.valor)}</div></td>
                <td style="width:30px"><button class="btn-icon" style="color:red;font-size:12px" onclick="Pages.driverClosing.removeDiscount(${e.id})">🗑️</button></td>
            </tr>`).join('')}
        </table>` : '<div style="padding:15px;text-align:center;color:#aaa;font-size:0.85rem">Nenhum vale</div>';
        document.getElementById('dc-discounts-list').innerHTML = discHtml;
    },

    async generate() {
        const userId = parseInt(document.getElementById('dc-driver').value);
        if (!userId) { Utils.showToast('Selecione um motorista', 'warning'); return; }
        const dataInicio = document.getElementById('dc-data-inicio').value;
        const dataFim = document.getElementById('dc-data-fim').value;

        // Mark that user has edited dias field
        const diasInput = document.getElementById('dc-dias');
        if (diasInput) diasInput._userEdited = true;

        const startD = new Date(dataInicio + 'T00:00:00');
        const endD = new Date(dataFim + 'T00:00:00');
        const diasIntervalo = Math.round((endD - startD) / (1000 * 60 * 60 * 24)) + 1;
        const diasTrabalhados = diasInput?.value ? parseInt(diasInput.value) : diasIntervalo;

        const closingData = await db.generateDriverClosingByDateRange(userId, dataInicio, dataFim, diasTrabalhados);
        if (!closingData) { document.getElementById('driver-closing-result').innerHTML = '<div class="empty-state"><h3>Motorista não encontrado</h3></div>'; return; }

        this._lastClosing = closingData; // Store for PDF

        const {
            user, placa, salarioFixo, salarioFixoBase, diasTrabalhados: dias, diasNoMes,
            kmCarregado, kmVazio, valorKmCarregado, valorKmVazio, pctCarregado, pctVazio,
            comissaoCarregado, comissaoVazio, totalComissaoKm,
            totalFreteFechado, totalComissaoFechado, kmFreteFechado, qtdFreteFechado, fixedFreights,
            mediaKmL, totalLitros, premioMedia, faixasPremioMedia, faixaAtingida,
            expenses, bonuses, discounts,
            totalExpenses, totalBonuses, totalDiscounts,
            totalPagar, freights, fuelings, fuelingsForMedia, rates, ratesIsCustom
        } = closingData;

        // Build tiered bonus display
        const faixasHtml = faixasPremioMedia.length > 0 ? faixasPremioMedia.sort((a, b) => a.minMedia - b.minMedia).map(f => {
            const atingiu = mediaKmL >= f.minMedia;
            const isAtual = faixaAtingida && f.minMedia === faixaAtingida.minMedia && f.premio === faixaAtingida.premio;
            return `<tr>
                <td style="padding-left:24px">${atingiu ? '\u2705' : '\u274c'} Faixa ${f.minMedia} km/L \u2014 ${isAtual ? '<strong>PR\u00caMIO APLICADO</strong>' : (atingiu ? 'Atingida' : 'N\u00e3o atingida')}</td>
                <td class="text-right font-bold ${isAtual ? 'text-success' : 'text-muted'}">${Utils.formatCurrency(f.premio)}</td>
            </tr>`;
        }).join('') : '<tr><td style="padding-left:24px" class="text-muted">Nenhuma faixa de pr\u00eamio configurada</td><td></td></tr>';

        const ratesLabel = ratesIsCustom ? `\ud83d\ude9b Taxa da placa: ${Utils.formatCurrency(rates.carregado)}/km (C) | ${Utils.formatCurrency(rates.vazio)}/km (V)` : `\u2699\ufe0f Taxa padr\u00e3o: ${Utils.formatCurrency(rates.carregado)}/km (C) | ${Utils.formatCurrency(rates.vazio)}/km (V)`;

        // Detailed Freights Table (Routes)
        const routesTable = freights.length > 0 ? `
            <div class="table-container" style="margin-top:20px;border:1px solid var(--border-color);border-radius:var(--radius-md)">
                <table class="data-table">
                    <thead><tr><th colspan="5" style="background:var(--bg-secondary);text-align:center">DETALHAMENTO DE ROTAS / FRETES</th></tr>
                    <tr><th>Data</th><th>Origem \u279c Destino</th><th>KM</th><th>Tipo</th><th>Valor do Frete</th></tr></thead>
                    <tbody>${freights.map(f => `
                        <tr>
                            <td>${Utils.formatDate(f.data)}</td>
                            <td>${f.origem} \u279c ${f.destino}</td>
                            <td>${Utils.formatNumber(f.km)}</td>
                            <td>${f.tipo === 'carregado' ? '<span class="badge badge-success">Carregado</span>' : '<span class="badge badge-warning">Vazio</span>'}</td>
                            <td class="font-bold">${Utils.formatCurrency(f.valorFrete)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>` : '<div class="text-muted text-center p-3">Nenhum frete registrado no período.</div>';

        document.getElementById('driver-closing-result').innerHTML = `
            <div class="card animate-in" style="border-top: 4px solid var(--accent-primary)">
                <div class="card-header">
                    <h3>\ud83d\udccb ${closingData.userName} \u2014 ${Utils.formatDate(closingData.dataInicio)} a ${Utils.formatDate(closingData.dataFim)}</h3>
                    <div class="btn-group">
                        <button class="btn btn-primary btn-sm" onclick="Pages.driverClosing.exportPDF()">\ud83d\udcc4 Exportar PDF</button>
                    </div>
                </div>
                <div class="card-body">
                    <div style="margin-bottom:8px;color:var(--text-secondary);font-size:0.82rem">
                        Caminh\u00e3o: <strong class="font-mono">${placa || 'Nenhum'}</strong> \u2014 ${freights.length} fretes no per\u00edodo
                        <br><span style="font-size:0.75rem">${ratesLabel}</span>
                    </div>

                    <h4 style="margin:16px 0 10px;font-size:0.85rem;color:var(--accent-primary)">\ud83d\udcb0 COMPOSI\u00c7\u00c3O DO PAGAMENTO</h4>
                    <div class="table-container" style="margin-bottom:16px">
                        <table class="data-table">
                            <thead><tr><th>Descri\u00e7\u00e3o</th><th class="text-right">Valor</th></tr></thead>
                            <tbody>
                                ${salarioFixo > 0 ? `<tr><td>Sal\u00e1rio Fixo${dias < diasNoMes ? ' <small class="text-muted">(' + dias + '/' + diasNoMes + ' dias — proporcional de ' + Utils.formatCurrency(salarioFixoBase) + ')</small>' : ''}</td><td class="text-right font-bold">${Utils.formatCurrency(salarioFixo)}</td></tr>` : ''}
                                ${comissaoCarregado > 0 ? `<tr><td>Comiss\u00e3o KM Carregado \u2014 ${Utils.formatNumber(kmCarregado)} km \u00d7 ${Utils.formatCurrency(rates.carregado)}/km \u00d7 ${pctCarregado}%</td><td class="text-right font-bold text-success">${Utils.formatCurrency(comissaoCarregado)}</td></tr>` : ''}
                                ${comissaoVazio > 0 ? `<tr><td>Comiss\u00e3o KM Vazio \u2014 ${Utils.formatNumber(kmVazio)} km \u00d7 ${Utils.formatCurrency(rates.vazio)}/km \u00d7 ${pctVazio}%</td><td class="text-right font-bold text-success">${Utils.formatCurrency(comissaoVazio)}</td></tr>` : ''}
                                ${(qtdFreteFechado || 0) > 0 ? `<tr style="background:rgba(99,102,241,0.05)"><td>\ud83d\udd12 Fretes Valor Fechado (${qtdFreteFechado}x \u2014 ${Utils.formatNumber(kmFreteFechado)} km) \u2014 Comiss\u00e3o</td><td class="text-right font-bold text-success">${Utils.formatCurrency(totalComissaoFechado)}</td></tr>` : ''}
                                ${premioMedia > 0 ? `<tr style="background:rgba(34,197,94,0.05)"><td><strong>\ud83c\udfc6 Pr\u00eamio M\u00e9dia km/L</strong> \u2014 M\u00e9dia atual: <strong>${mediaKmL.toFixed(2)} km/L</strong></td><td class="text-right font-bold text-success">${Utils.formatCurrency(premioMedia)}</td></tr>` : ''}
                                ${faixasHtml}
                                ${bonuses.map(b => `<tr><td>\ud83c\udf81 ${b.descricao || 'B\u00f4nus'} <small class="text-muted">(${Utils.formatDate(b.data)})</small></td><td class="text-right font-bold text-success">${Utils.formatCurrency(b.valor)}</td></tr>`).join('')}
                                ${expenses.map(e => `<tr><td>\ud83d\udccb Reembolso: ${e.descricao || 'Despesa'} <small class="text-muted">(${Utils.formatDate(e.data)})</small></td><td class="text-right font-bold text-info">${Utils.formatCurrency(e.valor)}</td></tr>`).join('')}
                                ${discounts.map(d => `<tr style="color:var(--accent-danger)"><td>\ud83d\udcb8 Vale/Adiantamento: ${d.descricao || 'Vale'} <small class="text-muted">(${Utils.formatDate(d.data)})</small></td><td class="text-right font-bold">-${Utils.formatCurrency(d.valor)}</td></tr>`).join('')}
                            </tbody>
                            <tfoot><tr style="background:rgba(99,102,241,0.1)"><td class="font-bold" style="font-size:1.05rem">TOTAL A PAGAR</td><td class="text-right font-bold ${totalPagar >= 0 ? 'text-success' : 'text-danger'}" style="font-size:1.2rem">${Utils.formatCurrency(totalPagar)}</td></tr></tfoot>
                        </table>
                    </div>

                    ${routesTable}

                    ${(() => {
                const allF = (fuelingsForMedia || fuelings || []).filter(f => f.km > 0 && f.tipoComb !== 'Arla').sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km)); return allF.length > 0 ? `
                    <div class="card mt-3" style="border:2px solid var(--accent-success);background:rgba(34,197,94,0.03)">
                        <div class="card-header"><h3>\u26fd C\u00e1lculo da M\u00e9dia km/L</h3></div>
                        <div class="card-body">
                            <p class="text-muted" style="font-size:0.8rem;margin-bottom:10px">Selecione a abastecida <strong>inicial</strong> e <strong>final</strong> para calcular a m\u00e9dia. F\u00f3rmula: <code>(KM final \u2212 KM inicial) / (Total litros \u2212 Litros da abastecida inicial)</code></p>
                            <div class="form-row">
                                <div class="form-group" style="flex:1">
                                    <label class="form-label" style="font-weight:700;color:var(--accent-warning)">\ud83c\udfc1 Abastecida Inicial</label>
                                    <select class="form-control" id="media-fuel-start" onchange="Pages.driverClosing.recalcMedia()">
                                        ${allF.map((f, i) => '<option value="' + f.id + '"' + (i === 0 ? ' selected' : '') + '>' + (f._prevMonth ? '[M\u00eas ant.] ' : '') + Utils.formatDate(f.data) + ' \u2014 ' + Utils.formatNumber(f.km) + ' km \u2014 ' + Utils.formatNumber(f.litros, 1) + 'L' + (f.posto ? ' \u2014 ' + f.posto : '') + '</option>').join('')}
                                    </select>
                                </div>
                                <div class="form-group" style="flex:1">
                                    <label class="form-label" style="font-weight:700;color:var(--accent-primary)">\ud83c\udfc1 Abastecida Final</label>
                                    <select class="form-control" id="media-fuel-end" onchange="Pages.driverClosing.recalcMedia()">
                                        ${allF.map((f, i, arr) => '<option value="' + f.id + '"' + (i === arr.length - 1 ? ' selected' : '') + '>' + (f._prevMonth ? '[M\u00eas ant.] ' : '') + Utils.formatDate(f.data) + ' \u2014 ' + Utils.formatNumber(f.km) + ' km \u2014 ' + Utils.formatNumber(f.litros, 1) + 'L' + (f.posto ? ' \u2014 ' + f.posto : '') + '</option>').join('')}
                                    </select>
                                </div>
                            </div>
                            <div id="media-calc-result" class="mt-2" style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);font-weight:600"></div>
                        </div>
                    </div>` : '';
            })()}

                    <div class="closing-summary" style="margin-top:20px">
                        <div class="closing-item"><div class="closing-label">KM Carregado</div><div class="closing-value">${Utils.formatNumber(kmCarregado)}</div></div>
                        <div class="closing-item"><div class="closing-label">KM Vazio</div><div class="closing-value">${Utils.formatNumber(kmVazio)}</div></div>
                        <div class="closing-item"><div class="closing-label">Total Litros</div><div class="closing-value" id="closing-total-litros">${Utils.formatNumber(totalLitros, 1)}</div></div>
                        <div class="closing-item"><div class="closing-label">M\u00e9dia km/L</div><div class="closing-value" id="closing-media-kml">${mediaKmL.toFixed(2)}</div></div>
                    </div>
                </div>
            </div>`;

        // Trigger initial media calculation with selectors
        if ((fuelingsForMedia || fuelings || []).filter(f => f.km > 0 && f.tipoComb !== 'Arla').length > 0) this.recalcMedia();
    },

    recalcMedia() {
        const closing = this._lastClosing;
        if (!closing) return;

        const startId = parseInt(document.getElementById('media-fuel-start')?.value);
        const endId = parseInt(document.getElementById('media-fuel-end')?.value);

        const fuelings = (closing.fuelingsForMedia || closing.fuelings || []).filter(f => f.km > 0 && f.tipoComb !== 'Arla').sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km));
        const startFuel = fuelings.find(f => f.id === startId);
        const endFuel = fuelings.find(f => f.id === endId);

        const resultEl = document.getElementById('media-calc-result');
        if (!startFuel || !endFuel) {
            if (resultEl) resultEl.innerHTML = '<span class="text-muted">Selecione ambas as abastecidas.</span>';
            return;
        }

        if (endFuel.km <= startFuel.km) {
            if (resultEl) resultEl.innerHTML = '<span style="color:var(--accent-danger)">\u26a0\ufe0f A abastecida final deve ter KM maior que a inicial.</span>';
            return;
        }

        // Get all fuelings between start and end (inclusive)
        const startIdx = fuelings.indexOf(startFuel);
        const endIdx = fuelings.indexOf(endFuel);
        const range = fuelings.slice(startIdx, endIdx + 1);

        // Total litros = all fuelings in range EXCEPT the initial one
        const litrosRange = range.slice(1).reduce((s, f) => s + (f.litros || 0), 0);
        const kmDiff = endFuel.km - startFuel.km;
        const media = litrosRange > 0 ? kmDiff / litrosRange : 0;

        // Recalculate premio
        const { premio, faixaAtingida } = db.calcPremioMedia(media, closing.faixasPremioMedia || []);

        // Update totalPagar
        const oldPremio = closing.premioMedia || 0;
        const newTotalPagar = closing.totalPagar - oldPremio + premio;

        // Update stored closing for PDF
        closing.mediaKmL = parseFloat(media.toFixed(2));
        closing.totalKm = kmDiff;
        closing.totalLitros = litrosRange;
        closing.premioMedia = premio;
        closing.faixaAtingida = faixaAtingida;
        closing.totalPagar = newTotalPagar;

        // Update UI
        if (resultEl) {
            resultEl.innerHTML = '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">' +
                '<div>\ud83d\udccf KM: <strong>' + Utils.formatNumber(kmDiff) + '</strong> <span class="text-muted">(' + Utils.formatNumber(endFuel.km) + ' \u2212 ' + Utils.formatNumber(startFuel.km) + ')</span></div>' +
                '<div>\u26fd Litros: <strong>' + Utils.formatNumber(litrosRange, 1) + '</strong> <span class="text-muted">(' + (range.length - 1) + ' abastecidas)</span></div>' +
                '<div style="font-size:1.2rem;color:var(--accent-success)">\ud83d\udcca M\u00e9dia: <strong>' + media.toFixed(2) + ' km/L</strong></div>' +
                '<div>\ud83c\udfc6 Pr\u00eamio: <strong class="' + (premio > 0 ? 'text-success' : 'text-muted') + '">' + Utils.formatCurrency(premio) + '</strong></div>' +
                '</div>';
        }

        // Update summary cards
        const litrosEl = document.getElementById('closing-total-litros');
        const mediaEl = document.getElementById('closing-media-kml');
        if (litrosEl) litrosEl.textContent = Utils.formatNumber(litrosRange, 1);
        if (mediaEl) mediaEl.textContent = media.toFixed(2);

        // Update premio row in payment table
        const tableRows = document.querySelectorAll('.data-table tr');
        tableRows.forEach(row => {
            if (row.innerHTML.includes('Pr\u00eamio M\u00e9dia km/L') || row.innerHTML.includes('Prêmio Média km/L')) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    cells[0].innerHTML = '<strong>\ud83c\udfc6 Pr\u00eamio M\u00e9dia km/L</strong> \u2014 M\u00e9dia atual: <strong>' + media.toFixed(2) + ' km/L</strong>';
                    cells[1].innerHTML = Utils.formatCurrency(premio);
                }
            }
        });

        // Update faixas checkmarks
        (closing.faixasPremioMedia || []).forEach(f => {
            tableRows.forEach(row => {
                if (row.innerHTML.includes('Faixa ' + f.minMedia + ' km/L')) {
                    const atingiu = media >= f.minMedia;
                    const isAtual = faixaAtingida && f.minMedia === faixaAtingida.minMedia && f.premio === faixaAtingida.premio;
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        cells[0].innerHTML = (atingiu ? '\u2705' : '\u274c') + ' Faixa ' + f.minMedia + ' km/L \u2014 ' + (isAtual ? '<strong>PR\u00caMIO APLICADO</strong>' : (atingiu ? 'Atingida' : 'N\u00e3o atingida'));
                        cells[0].style.paddingLeft = '24px';
                        cells[1].className = 'text-right font-bold ' + (isAtual ? 'text-success' : 'text-muted');
                    }
                }
            });
        });

        // Update total a pagar
        const footerRows = document.querySelectorAll('.data-table tfoot tr');
        footerRows.forEach(row => {
            if (row.innerHTML.includes('TOTAL A PAGAR')) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    cells[1].innerHTML = Utils.formatCurrency(newTotalPagar);
                    cells[1].className = 'text-right font-bold ' + (newTotalPagar >= 0 ? 'text-success' : 'text-danger');
                }
            }
        });
    },

    async showExpenseForm(id) {
        const userId = parseInt(document.getElementById('dc-driver')?.value) || this.userId;
        if (!userId) { Utils.showToast('Selecione um motorista', 'warning'); return; }
        let item = null;
        if (id) item = await db.getById('driverExpenses', id);
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Despesa' : 'Nova Despesa Reembolsável';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-group"><label class="form-label">Descrição *</label><input type="text" class="form-control" id="f-descricao" value="${item?.descricao || ''}" placeholder="Pedágio, alimentação, etc."></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Data</label><input type="date" class="form-control" id="f-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" class="form-control" id="f-valor" value="${item?.valor || ''}"></div>
            </div>
            <div class="form-group"><label class="form-label">Comprovante / Obs</label><input type="text" class="form-control" id="f-obs" value="${item?.obs || ''}"></div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.driverClosing.saveExpense(${id || 'null'},${userId})">Salvar</button>`;
        App.openModal();
    },

    async saveExpense(id, userId) {
        const data = { userId, descricao: document.getElementById('f-descricao').value.trim(), data: document.getElementById('f-data').value, valor: parseFloat(document.getElementById('f-valor').value) || 0, obs: document.getElementById('f-obs').value.trim() };
        if (!data.descricao) { Utils.showToast('Informe a descrição', 'warning'); return; }
        try {
            if (id) { data.id = id; await db.update('driverExpenses', data); } else { await db.add('driverExpenses', data); }
            Utils.showToast('Despesa salva!', 'success'); App.closeModal(); this.refreshData(userId);
        } catch (e) { Utils.showToast('Erro', 'error'); }
    },

    async removeExpense(id) { if (!confirm('Remover esta despesa?')) return; await db.delete('driverExpenses', id); this.refreshData(this.userId); },

    async showBonusForm(id) {
        const userId = parseInt(document.getElementById('dc-driver')?.value) || this.userId;
        if (!userId) { Utils.showToast('Selecione um motorista', 'warning'); return; }
        let item = null;
        if (id) item = await db.getById('driverBonuses', id);
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Bônus' : 'Novo Prêmio / Bônus';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-group"><label class="form-label">Descrição *</label><input type="text" class="form-control" id="f-descricao" value="${item?.descricao || ''}" placeholder="Bônus por entrega, prêmio especial, etc."></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Data</label><input type="date" class="form-control" id="f-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" class="form-control" id="f-valor" value="${item?.valor || ''}"></div>
            </div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.driverClosing.saveBonus(${id || 'null'},${userId})">Salvar</button>`;
        App.openModal();
    },

    async saveBonus(id, userId) {
        const data = { userId, descricao: document.getElementById('f-descricao').value.trim(), data: document.getElementById('f-data').value, valor: parseFloat(document.getElementById('f-valor').value) || 0 };
        if (!data.descricao) { Utils.showToast('Informe a descrição', 'warning'); return; }
        try {
            if (id) { data.id = id; await db.update('driverBonuses', data); } else { await db.add('driverBonuses', data); }
            Utils.showToast('Prêmio salvo!', 'success'); App.closeModal(); this.refreshData(userId);
        } catch (e) { Utils.showToast('Erro', 'error'); }
    },

    async removeBonus(id) { if (!confirm('Remover este bônus?')) return; await db.delete('driverBonuses', id); this.refreshData(this.userId); },

    async showDiscountForm(id) {
        const userId = parseInt(document.getElementById('dc-driver')?.value) || this.userId;
        if (!userId) { Utils.showToast('Selecione um motorista', 'warning'); return; }
        let item = null;
        if (id) item = await db.getById('driverDiscounts', id);
        const modal = document.getElementById('modal-overlay');
        modal.querySelector('.modal-header h2').textContent = id ? 'Editar Vale / Desconto' : 'Novo Vale / Desconto';
        modal.querySelector('.modal-body').innerHTML = `
            <div class="form-group"><label class="form-label">Descrição *</label><input type="text" class="form-control" id="f-descricao" value="${item?.descricao || ''}" placeholder="Vale, Adiantamento, Multa, etc."></div>
            <div class="form-row">
                <div class="form-group"><label class="form-label">Data</label><input type="date" class="form-control" id="f-data" value="${item?.data || new Date().toISOString().split('T')[0]}"></div>
                <div class="form-group"><label class="form-label">Valor *</label><input type="number" step="0.01" class="form-control" id="f-valor" value="${item?.valor || ''}"></div>
            </div>`;
        modal.querySelector('.modal-footer').innerHTML = `<button class="btn btn-secondary" onclick="App.closeModal()">Cancelar</button><button class="btn btn-primary" onclick="Pages.driverClosing.saveDiscount(${id || 'null'},${userId})">Salvar</button>`;
        App.openModal();
    },

    async saveDiscount(id, userId) {
        const data = { userId, descricao: document.getElementById('f-descricao').value.trim(), data: document.getElementById('f-data').value, valor: parseFloat(document.getElementById('f-valor').value) || 0 };
        if (!data.descricao) { Utils.showToast('Informe a descrição', 'warning'); return; }
        try {
            if (id) { data.id = id; await db.update('driverDiscounts', data); } else { await db.add('driverDiscounts', data); }
            Utils.showToast('Vale/Desconto salvo!', 'success'); App.closeModal(); this.refreshData(userId);
        } catch (e) { Utils.showToast('Erro', 'error'); }
    },

    async removeDiscount(id) { if (!confirm('Remover este vale?')) return; await db.delete('driverDiscounts', id); this.refreshData(this.userId); },

    // Refresh only the management lists content, or also generate report if visible
    async refreshData(userId) {
        const dataInicio = document.getElementById('dc-data-inicio').value;
        const dataFim = document.getElementById('dc-data-fim').value;
        await this.loadManagementData(userId, dataInicio, dataFim);
        // If result is already showing, regenerate it too to keep numbers consistent
        if (document.getElementById('driver-closing-result').innerHTML !== '') {
            this.generate();
        }
    },

    // ===== PDF EXPORT =====
    exportPDF() {
        const c = this._lastClosing;
        if (!c) { Utils.showToast('Gere o fechamento primeiro', 'warning'); return; }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fechamento ${c.userName} — ${Utils.formatDate(c.dataInicio)} a ${Utils.formatDate(c.dataFim)}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding:32px; color:#1a1a2e; font-size:12px; line-height:1.4; }
            .header { text-align:center; margin-bottom:24px; border-bottom:3px solid #6366f1; padding-bottom:16px; }
            .header h1 { font-size:20px; color:#6366f1; margin-bottom:4px; }
            .header h2 { font-size:14px; font-weight:400; color:#555; }
            .info-row { display:flex; justify-content:space-between; margin-bottom:16px; padding:10px 14px; background:#f5f5ff; border-radius:6px; }
            .info-row .label { color:#888; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; }
            .info-row .value { font-weight:700; font-size:14px; }
            table { width:100%; border-collapse:collapse; margin-bottom:16px; }
            th { background:#6366f1; color:#fff; padding:8px 10px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; }
            td { padding:8px 10px; border-bottom:1px solid #eee; }
            tr:nth-child(even) { background:#fafafa; }
            .text-right { text-align:right; }
            .total-row { background:#f0efff !important; font-weight:700; font-size:14px; }
            .total-row td { border-top:2px solid #6366f1; padding:12px; }
            .footer { margin-top:32px; display:flex; justify-content:space-between; padding-top:40px; }
            .signature-line { border-top:1px solid #333; width:200px; text-align:center; padding-top:6px; font-size:11px; color:#666; }
            .summary { display:flex; gap:16px; margin-bottom:20px; }
            .summary-item { flex:1; text-align:center; padding:10px; background:#f5f5ff; border-radius:6px; }
            .summary-item .sval { font-size:16px; font-weight:700; color:#6366f1; }
            .summary-item .slabel { font-size:10px; color:#888; text-transform:uppercase; }
            .section-title { font-size:13px; font-weight:700; color:#6366f1; margin:20px 0 8px; border-bottom:1px solid #ddd; padding-bottom:4px; }
            @media print {
                body { padding:20px; }
                .no-print { display:none; }
            }
        </style></head><body>
            <button class="no-print" onclick="window.print()" style="position:fixed;top:10px;right:10px;background:#6366f1;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:600">🖨️ Imprimir / Salvar PDF</button>

            <div class="header">
                <h1>FECHAMENTO DO MOTORISTA</h1>
                <h2>${Utils.formatDate(c.dataInicio)} a ${Utils.formatDate(c.dataFim)}</h2>
            </div>

            <div class="info-row">
                <div><div class="label">Motorista</div><div class="value">${c.userName}</div></div>
                <div><div class="label">Caminhão</div><div class="value">${c.placa || '—'}</div></div>
                <div><div class="label">Fretes no Período</div><div class="value">${c.qtdFretes}</div></div>
                <div><div class="label">Gerado em</div><div class="value">${new Date().toLocaleDateString('pt-BR')}</div></div>
            </div>

            <div class="summary">
                <div class="summary-item"><div class="slabel">KM Carregado</div><div class="sval">${Utils.formatNumber(c.kmCarregado)}</div></div>
                <div class="summary-item"><div class="slabel">KM Vazio</div><div class="sval">${Utils.formatNumber(c.kmVazio)}</div></div>
                <div class="summary-item"><div class="slabel">Total Litros</div><div class="sval">${Utils.formatNumber(c.totalLitros, 1)}</div></div>
                <div class="summary-item"><div class="slabel">Média km/L</div><div class="sval">${c.mediaKmL}</div></div>
            </div>

            <div class="section-title">COMPOSIÇÃO DO PAGAMENTO</div>
            <table>
                <thead><tr><th>Descrição</th><th class="text-right">Valor</th></tr></thead>
                <tbody>
                    ${c.salarioFixo > 0 ? `<tr><td>Salário Fixo${c.diasTrabalhados < c.diasNoMes ? ' <small style="color:#888">(${c.diasTrabalhados}/${c.diasNoMes} dias — proporcional de ${Utils.formatCurrency(c.salarioFixoBase)})</small>' : ''}</td><td class="text-right">${Utils.formatCurrency(c.salarioFixo)}</td></tr>` : ''}
                    ${c.comissaoCarregado > 0 ? `<tr><td>Comissão KM Carregado — ${Utils.formatNumber(c.kmCarregado)} km × ${Utils.formatCurrency(c.rates.carregado)}/km × ${c.pctCarregado}%${c.ratesIsCustom ? ' (taxa da placa)' : ''}</td><td class="text-right">${Utils.formatCurrency(c.comissaoCarregado)}</td></tr>` : ''}
                    ${c.comissaoVazio > 0 ? `<tr><td>Comissão KM Vazio — ${Utils.formatNumber(c.kmVazio)} km × ${Utils.formatCurrency(c.rates.vazio)}/km × ${c.pctVazio}%${c.ratesIsCustom ? ' (taxa da placa)' : ''}</td><td class="text-right">${Utils.formatCurrency(c.comissaoVazio)}</td></tr>` : ''}
                    ${(c.qtdFreteFechado || 0) > 0 ? `<tr style="background:#f0f0ff"><td>🔒 Fretes Valor Fechado (${c.qtdFreteFechado}x — ${Utils.formatNumber(c.kmFreteFechado)} km) — Comissão</td><td class="text-right"><strong>${Utils.formatCurrency(c.totalComissaoFechado)}</strong></td></tr>` : ''}
                    ${c.premioMedia > 0 ? `<tr style="background:#f0fff0"><td><strong>Prêmio Média km/L</strong> — Média atual: <strong>${c.mediaKmL} km/L</strong></td><td class="text-right"><strong>${Utils.formatCurrency(c.premioMedia)}</strong></td></tr>` : ''}
                    ${(c.faixasPremioMedia || []).sort((a, b) => a.minMedia - b.minMedia).map(f => {
            const atingiu = c.mediaKmL >= f.minMedia;
            const isAtual = c.faixaAtingida && f.minMedia === c.faixaAtingida.minMedia;
            return `<tr><td style="padding-left:24px;color:#666">${atingiu ? '✅' : '❌'} Faixa ${f.minMedia} km/L${isAtual ? ' — <strong>APLICADO</strong>' : ''}</td><td class="text-right" style="font-size:11px">${Utils.formatCurrency(f.premio)}</td></tr>`;
        }).join('')}
                    ${c.bonuses.map(b => `<tr><td>Prêmio: ${b.descricao} (${Utils.formatDate(b.data)})</td><td class="text-right">${Utils.formatCurrency(b.valor)}</td></tr>`).join('')}
                    ${c.expenses.map(e => `<tr><td>Reembolso: ${e.descricao} (${Utils.formatDate(e.data)})</td><td class="text-right">${Utils.formatCurrency(e.valor)}</td></tr>`).join('')}
                    ${c.discounts.map(d => `<tr style="color:#b91c1c"><td>Vale: ${d.descricao} (${Utils.formatDate(d.data)})</td><td class="text-right">-${Utils.formatCurrency(d.valor)}</td></tr>`).join('')}
                    <tr class="total-row"><td>TOTAL A PAGAR</td><td class="text-right">${Utils.formatCurrency(c.totalPagar)}</td></tr>
                </tbody>
            </table>

            <div class="section-title">DETALHAMENTO DE ROTAS REALIZADAS</div>
            <table>
                <thead><tr><th>Data</th><th>Origem / Destino</th><th>KM</th><th>Tipo</th><th class="text-right">Valor Frete</th></tr></thead>
                <tbody>
                    ${c.freights.map(f => `<tr>
                        <td>${Utils.formatDate(f.data)}</td>
                        <td>${f.origem} <span style="color:#aaa">➝</span> ${f.destino}</td>
                        <td>${Utils.formatNumber(f.km)}</td>
                        <td>${f.tipo === 'carregado' ? 'Carregado' : 'Vazio'}</td>
                        <td class="text-right">${Utils.formatCurrency(f.valorFrete)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="footer">
                <div class="signature-line">Empresa</div>
                <div class="signature-line">${c.userName}</div>
            </div>
        </body></html>`);
        printWindow.document.close();
    }
};
