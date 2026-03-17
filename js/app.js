// ===== MONTHLY CLOSING PAGE =====
Pages.monthlyClosing = {
    _closingsData: [],
    async render() {
        const trucks = await db.getAll('trucks');
        const { mes, ano } = Utils.getCurrentMonth();
        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">📊 Fechamento Mensal</h1><p class="page-subtitle">Gere relatórios automáticos por caminhão</p></div>
            </div></div>
            <div class="page-body">
                <div class="filter-bar">
                    <div class="form-group"><label class="form-label">Mês</label><select class="form-control" id="cl-mes">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === mes ? 'selected' : ''}>${Utils.getMonthName(i + 1)}</option>`).join('')}</select></div>
                    <div class="form-group"><label class="form-label">Ano</label><input type="number" class="form-control" id="cl-ano" value="${ano}" style="width:100px"></div>
                    <button class="btn btn-primary" onclick="Pages.monthlyClosing.generateAll()">📊 Gerar Todos</button>
                </div>
                <div id="closing-results">${trucks.length === 0 ? '<div class="empty-state"><div class="empty-icon">🚛</div><h3>Cadastre caminhões primeiro</h3></div>' : ''}</div>
            </div>`;
    },
    async generateAll() {
        const trucks = await db.getAll('trucks');
        const mes = parseInt(document.getElementById('cl-mes').value);
        const ano = parseInt(document.getElementById('cl-ano').value);
        const closings = [];
        for (const t of trucks) { closings.push(await db.generateMonthlyClosing(t.id, mes, ano)); }
        this._closingsData = closings;

        const totalRec = closings.reduce((s, c) => s + c.totalFretes, 0);
        const totalDesp = closings.reduce((s, c) => s + c.totalAbastecimento + c.totalMultas + (c.totalDespesas || 0), 0);
        const saldoTotal = totalRec - totalDesp;

        document.getElementById('closing-results').innerHTML = `
            <div class="closing-summary animate-in mb-3">
                <div class="closing-item"><div class="closing-label">Total Fretes</div><div class="closing-value text-success">${Utils.formatCurrency(totalRec)}</div></div>
                <div class="closing-item"><div class="closing-label">Total Custos</div><div class="closing-value text-danger">${Utils.formatCurrency(totalDesp)}</div></div>
                <div class="closing-item ${saldoTotal >= 0 ? 'positive' : 'negative'}"><div class="closing-label">Saldo Total</div><div class="closing-value">${Utils.formatCurrency(saldoTotal)}</div></div>
            </div>
            <div class="table-container"><table class="data-table"><thead><tr><th>Placa</th><th>Abast.</th><th>Out. Desp.</th><th>Fretes</th><th>Saldo</th><th>Média km/L</th></tr></thead><tbody>${closings.map((c, idx) => `<tr>
                    <td class="font-mono font-bold" style="cursor:pointer" onclick="App.navigate('truck-detail',${c.truckId})">${c.placa}</td>
                    <td class="text-danger">${Utils.formatCurrency(c.totalAbastecimento)}</td>
                    <td class="text-danger">${Utils.formatCurrency((c.totalDespesas || 0) + c.totalMultas)} <small class="text-muted">(${c.qtdDespesas + c.qtdMultas})</small></td>
                    <td class="text-success">${Utils.formatCurrency(c.totalFretes)}</td>
                    <td class="font-bold ${c.saldo >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(c.saldo)}</td>
                    <td style="cursor:pointer" onclick="Pages.monthlyClosing.showMediaSelector(${idx})" title="Clique para ajustar"><span class="badge badge-info" id="media-badge-${idx}" style="font-size:0.85rem">${c.mediaConsumo || '—'}</span> <small class="text-muted">⚙️</small></td>
                </tr>`).join('')}</tbody></table></div>
            <div id="media-selector-area"></div>`;
        Utils.showToast(`Fechamentos de ${Utils.getMonthName(mes)}/${ano} gerados!`, 'success');
    },
    showMediaSelector(idx) {
        const c = this._closingsData[idx];
        if (!c) return;
        const allF = (c.fuelingsForMedia || c.fuelings || []).filter(f => f.km > 0 && f.tipoComb !== 'Arla').sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km));
        if (allF.length < 2) {
            document.getElementById('media-selector-area').innerHTML = `<div class="card mt-3 animate-in" style="border:2px solid var(--accent-warning)"><div class="card-body"><p class="text-muted text-center">⚠️ ${c.placa}: precisa de no mínimo 2 abastecidas com KM para calcular a média.</p></div></div>`;
            return;
        }
        document.getElementById('media-selector-area').innerHTML = `
            <div class="card mt-3 animate-in" style="border:2px solid var(--accent-success);background:rgba(34,197,94,0.03)">
                <div class="card-header"><h3>⛽ Média km/L — ${c.placa}</h3></div>
                <div class="card-body">
                    <p class="text-muted" style="font-size:0.8rem;margin-bottom:10px">Selecione a abastecida <strong>inicial</strong> e <strong>final</strong>. Fórmula: <code>(KM final − KM inicial) / (Total litros − Litros da abastecida inicial)</code></p>
                    <div class="form-row">
                        <div class="form-group" style="flex:1">
                            <label class="form-label" style="font-weight:700;color:var(--accent-warning)">🏁 Abastecida Inicial</label>
                            <select class="form-control" id="mc-fuel-start" onchange="Pages.monthlyClosing.recalcMedia(${idx})">
                                ${allF.map((f, i) => `<option value="${f.id}" ${i === 0 ? 'selected' : ''}>${f._prevMonth ? '[Mês ant.] ' : ''}${Utils.formatDate(f.data)} — ${Utils.formatNumber(f.km)} km — ${Utils.formatNumber(f.litros, 1)}L${f.posto ? ' — ' + f.posto : ''}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="flex:1">
                            <label class="form-label" style="font-weight:700;color:var(--accent-primary)">🏁 Abastecida Final</label>
                            <select class="form-control" id="mc-fuel-end" onchange="Pages.monthlyClosing.recalcMedia(${idx})">
                                ${allF.map((f, i, arr) => `<option value="${f.id}" ${i === arr.length - 1 ? 'selected' : ''}>${f._prevMonth ? '[Mês ant.] ' : ''}${Utils.formatDate(f.data)} — ${Utils.formatNumber(f.km)} km — ${Utils.formatNumber(f.litros, 1)}L${f.posto ? ' — ' + f.posto : ''}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div id="mc-calc-result" class="mt-2" style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-md);font-weight:600"></div>
                </div>
            </div>`;
        this.recalcMedia(idx);
    },
    recalcMedia(idx) {
        const c = this._closingsData[idx];
        if (!c) return;
        const startId = parseInt(document.getElementById('mc-fuel-start')?.value);
        const endId = parseInt(document.getElementById('mc-fuel-end')?.value);
        const fuelings = (c.fuelingsForMedia || c.fuelings || []).filter(f => f.km > 0 && f.tipoComb !== 'Arla').sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km));
        const startFuel = fuelings.find(f => f.id === startId);
        const endFuel = fuelings.find(f => f.id === endId);
        const resultEl = document.getElementById('mc-calc-result');
        if (!startFuel || !endFuel) { if (resultEl) resultEl.innerHTML = '<span class="text-muted">Selecione ambas as abastecidas.</span>'; return; }
        if (endFuel.km <= startFuel.km) { if (resultEl) resultEl.innerHTML = '<span style="color:var(--accent-danger)">⚠️ A abastecida final deve ter KM maior que a inicial.</span>'; return; }
        const startIdx = fuelings.indexOf(startFuel);
        const endIdx = fuelings.indexOf(endFuel);
        const range = fuelings.slice(startIdx, endIdx + 1);
        const litrosRange = range.slice(1).reduce((s, f) => s + (f.litros || 0), 0);
        const kmDiff = endFuel.km - startFuel.km;
        const media = litrosRange > 0 ? kmDiff / litrosRange : 0;
        if (resultEl) {
            resultEl.innerHTML = `<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">
                <div>📏 KM: <strong>${Utils.formatNumber(kmDiff)}</strong> <span class="text-muted">(${Utils.formatNumber(endFuel.km)} − ${Utils.formatNumber(startFuel.km)})</span></div>
                <div>⛽ Litros: <strong>${Utils.formatNumber(litrosRange, 1)}</strong> <span class="text-muted">(${range.length - 1} abastecidas)</span></div>
                <div style="font-size:1.2rem;color:var(--accent-success)">📊 Média: <strong>${media.toFixed(2)} km/L</strong></div>
            </div>`;
        }
        // Update badge in table
        const badge = document.getElementById(`media-badge-${idx}`);
        if (badge) badge.textContent = media.toFixed(2);
        c.mediaConsumo = parseFloat(media.toFixed(2));
    }
};

// ===== MAIN APP ROUTER =====
const App = {
    currentPage: 'dashboard',
    currentParam: null,
    isRegistering: false,
    initialized: false,
    userRole: 'admin',      // admin | visualizador | motorista
    userTruckId: null,      // truck assigned to driver
    userAppId: null,         // app_users record id
    userEmail: null,
    _navSetup: false,

    async init() {

        try {
            // Check if Supabase is configured
            if (typeof supabase === 'undefined' || !supabase) {
                throw new Error('Supabase não configurado. Verifique js/supabase-config.js');
            }

            // ALWAYS listen for auth changes (must be before getSession)
            supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'PASSWORD_RECOVERY') {
                    // User arrived from password reset email link
                    const newPassword = prompt('Digite sua nova senha (mínimo 6 caracteres):');
                    if (newPassword && newPassword.length >= 6) {
                        const { error } = await supabase.auth.updateUser({ password: newPassword });
                        if (error) {
                            alert('Erro ao alterar senha: ' + error.message);
                        } else {
                            alert('Senha alterada com sucesso! Você já está logado.');
                        }
                    } else if (newPassword) {
                        alert('A senha deve ter no mínimo 6 caracteres.');
                    }
                } else if (event === 'SIGNED_IN' && session) {
                    db.setUserId(session.user.id);
                    this.userEmail = session.user.email;
                    document.getElementById('login-screen').classList.add('hidden');

                    if (!this.initialized) {
                        await db.init();
                        await this.loadCurrentUser();
                        await MapsService.loadApiKey();
                        this.setupNavigation();
                        this.applyRoleRestrictions();
                        this.initialized = true;
                        this.navigate(this.userRole === 'motorista' ? 'fuelings' : 'dashboard');

                        window.addEventListener('resize', () => {
                            if (App.currentPage === 'dashboard') setTimeout(() => Pages.dashboard.drawCharts && Pages.dashboard.render(), 200);
                        });
                    } else {
                        this.refreshCurrentPage();
                    }
                } else if (event === 'SIGNED_OUT') {
                    document.getElementById('login-screen').classList.remove('hidden');
                    this.initialized = false;
                }
            });

            // Check existing session
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;

            const session = data?.session;

            if (!session) {
                document.getElementById('login-screen').classList.remove('hidden');
                this.setupNavigation();
                return;
            }

            // Already logged in — init immediately
            db.setUserId(session.user.id);
            this.userEmail = session.user.email;
            document.getElementById('login-screen').classList.add('hidden');

            await db.init();
            await this.loadCurrentUser();
            await MapsService.loadApiKey();
            this.setupNavigation();
            this.applyRoleRestrictions();
            this.navigate(this.userRole === 'motorista' ? 'fuelings' : 'dashboard');

            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    if (App.currentPage === 'dashboard' && Pages.dashboard.drawCharts) {
                        Pages.dashboard.applyDashboardFilter();
                    }
                }, 300);
            });

            this.initialized = true;

        } catch (e) {
            console.error('App Init Error:', e);
            document.querySelector('.page-body').innerHTML = `
                <div class="text-center text-danger">
                    <div style="font-size:3rem;margin-bottom:16px">⚠️</div>
                    <h3>Erro ao iniciar sistema</h3>
                    <p>${e.message}</p>
                    <p class="text-muted small mt-2">Verifique o console para mais detalhes.</p>
                </div>
            `;
        }
    },

    // Load current user profile from app_users by matching auth email
    async loadCurrentUser() {
        try {
            const users = await db.getAll('users');
            const match = users.find(u => u.authEmail && u.authEmail.toLowerCase() === this.userEmail?.toLowerCase());
            if (match) {
                this.userRole = match.role || 'admin';
                this.userTruckId = match.truckId || null;
                this.userAppId = match.id;
                console.log(`RBAC: Logged in as ${match.nome} (${this.userRole})${this.userTruckId ? ', truck=' + this.userTruckId : ''}`);
            } else {
                // No matching app_users record = system owner = admin
                this.userRole = 'admin';
                this.userTruckId = null;
                this.userAppId = null;
                console.log('RBAC: No app_users match — defaulting to admin');
            }
        } catch (e) {
            console.error('RBAC: Error loading user profile:', e);
            this.userRole = 'admin';
        }
    },

    // Filter sidebar and UI based on role
    applyRoleRestrictions() {
        const role = this.userRole;
        document.querySelectorAll('.nav-item[data-roles]').forEach(item => {
            const allowed = item.dataset.roles.split(',');
            if (allowed.includes(role)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
        // Hide empty nav sections (where all items are hidden)
        document.querySelectorAll('.nav-section').forEach(section => {
            const visibleItems = section.querySelectorAll('.nav-item:not([style*="display: none"])');
            section.style.display = visibleItems.length > 0 ? '' : 'none';
        });
    },

    // Check if current user can access a page
    canAccess(page) {
        const access = {
            admin: ['dashboard', 'trucks', 'truck-detail', 'fuelings', 'truck-expenses', 'freights', 'fines', 'users', 'driver-closing', 'closing', 'import', 'settings', 'tires-analytics'],
            visualizador: ['dashboard', 'trucks', 'truck-detail', 'fuelings', 'truck-expenses', 'freights', 'fines', 'users', 'driver-closing', 'closing', 'tires-analytics'],
            motorista: ['fuelings', 'freights']
        };
        return (access[this.userRole] || access.admin).includes(page);
    },

    setupNavigation() {
        // Prevent duplicate event listeners on re-init (e.g. after login)
        if (this._navSetup) return;
        this._navSetup = true;

        document.querySelectorAll('.nav-item[data-page]').forEach(item => {
            item.addEventListener('click', () => {
                const page = item.dataset.page;
                const param = item.dataset.param;
                this.navigate(page, param ? parseInt(param) : null);
                // Close mobile sidebar
                document.querySelector('.sidebar')?.classList.remove('open');
            });
        });
        // Mobile menu toggle
        document.getElementById('mobile-toggle')?.addEventListener('click', () => {
            document.querySelector('.sidebar')?.classList.toggle('open');
        });
        // Modal: clicking outside no longer closes (prevent accidental data loss)
    },

    async navigate(page, param) {
        // Block unauthorized pages
        if (!this.canAccess(page)) {
            Utils.showToast('Sem permissão para acessar esta página', 'warning');
            return;
        }
        this.currentPage = page;
        this.currentParam = param;
        // Update active nav
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
        if (activeNav) activeNav.classList.add('active');

        switch (page) {
            case 'dashboard': await Pages.dashboard.render(); break;
            case 'trucks': await Pages.trucks.render(); break;
            case 'truck-detail': await Pages.truckDetail.render(param); break;
            case 'fuelings': await Pages.fuelings.render(); break;
            case 'truck-expenses': await Pages.truckExpenses.render(); break;
            case 'freights': await Pages.freights.render(); break;
            case 'fines': await Pages.fines.render(); break;
            case 'users': await Pages.users.render(); break;
            case 'driver-closing': await Pages.driverClosing.render(param); break;
            case 'closing': await Pages.monthlyClosing.render(); break;
            case 'tires-analytics': await Pages.tiresAnalytics.render(); break;
            case 'import': await Pages.dataImport.render(); break;
            case 'settings': await Pages.settings.render(); break;
            default: await Pages.dashboard.render();
        }
    },

    async refreshCurrentPage() {
        await this.navigate(this.currentPage, this.currentParam);
    },

    openModal() {
        document.getElementById('modal-overlay')?.classList.add('active');
    },

    closeModal() {
        document.getElementById('modal-overlay')?.classList.remove('active');
    },

    // ===== AUTHENTICATION =====

    toggleLoginMode() {
        this.isRegistering = !this.isRegistering;
        const formTitle = document.getElementById('login-title');
        const btnText = document.getElementById('login-btn-text');
        const modeText = document.getElementById('login-mode-text');
        const link = document.querySelector('.login-link');

        if (this.isRegistering) {
            formTitle.innerText = 'Criar Nova Conta';
            btnText.innerText = 'Cadastrar';
            modeText.innerText = 'Já tem conta?';
            link.innerText = 'Fazer login';
        } else {
            formTitle.innerText = 'Acessar Frota Control';
            btnText.innerText = 'Entrar';
            modeText.innerText = 'Não tem conta?';
            link.innerText = 'Criar conta';
        }
        document.getElementById('login-message').innerText = '';
    },

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const msg = document.getElementById('login-message');
        const btn = document.getElementById('login-btn-text');

        msg.innerText = '';
        btn.disabled = true;
        btn.innerText = 'Aguarde...';

        try {
            if (this.isRegistering) {
                // Register
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                msg.style.color = '#10b981';
                msg.innerText = 'Conta criada! Verifique seu email ou faça login.';
                // Auto login might happen depending on Supabase settings, but often needs email verification
                if (data.session) {
                    this.init();
                } else {
                    msg.innerText = 'Conta criada! Verifique seu email para confirmar.';
                }
            } else {
                // Login
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                // Re-init app to load data and navigate
                this.init();
            }
        } catch (error) {
            msg.style.color = '#ef4444';
            msg.innerText = error.message.includes('Invalid login') ? 'Credenciais inválidas' : error.message;
        } finally {
            btn.disabled = false;
            btn.innerText = this.isRegistering ? 'Cadastrar' : 'Entrar';
        }
    },

    async handleLogout() {
        if (confirm('Tem certeza que deseja sair?')) {
            await supabase.auth.signOut();
            window.location.reload();
        }
    },

    showForgotPassword() {
        this._forgotMode = true;
        document.getElementById('password').style.display = 'none';
        document.getElementById('password').removeAttribute('required');
        document.getElementById('login-title').innerText = 'Recuperar Senha';
        document.getElementById('login-btn-text').innerText = 'Enviar link de redefinição';
        document.getElementById('login-form').onsubmit = (e) => App.handleResetPassword(e);
        document.getElementById('forgot-password-link').innerText = 'Voltar ao login';
        document.getElementById('forgot-password-link').onclick = () => App.showLoginForm();
        document.getElementById('login-message').innerText = '';
    },

    showLoginForm() {
        this._forgotMode = false;
        document.getElementById('password').style.display = '';
        document.getElementById('password').setAttribute('required', '');
        document.getElementById('login-title').innerText = 'Acessar Frota Control';
        document.getElementById('login-btn-text').innerText = 'Entrar';
        document.getElementById('login-form').onsubmit = (e) => App.handleLogin(e);
        document.getElementById('forgot-password-link').innerText = 'Esqueci minha senha';
        document.getElementById('forgot-password-link').onclick = () => App.showForgotPassword();
        document.getElementById('login-message').innerText = '';
    },

    async handleResetPassword(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const msg = document.getElementById('login-message');
        const btn = document.getElementById('login-btn-text');

        msg.innerText = '';
        btn.disabled = true;
        btn.innerText = 'Enviando...';

        try {
            const redirectUrl = window.location.origin + window.location.pathname;
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl
            });
            if (error) throw error;
            msg.style.color = '#10b981';
            msg.innerText = 'Link de redefinição enviado! Verifique seu e-mail (inclusive lixo eletrônico).';
        } catch (error) {
            msg.style.color = '#ef4444';
            msg.innerText = error.message || 'Erro ao enviar link. Verifique o e-mail.';
        } finally {
            btn.disabled = false;
            btn.innerText = 'Enviar link de redefinição';
        }
    }
};

// ===== STARTUP =====
document.addEventListener('DOMContentLoaded', () => App.init());
