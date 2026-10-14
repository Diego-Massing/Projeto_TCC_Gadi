// ===== FRETES SUGERIDOS =====
// Viagens montadas pelo GPS da Sascar (Edge Function frete-sugestoes): o caminhão para
// em pátio de cliente / aduana, e cada trecho entre essas paradas vira uma sugestão de
// frete com origem, destino, KM e carregado/vazio (pelo histórico da rota). Aprovar abre
// o formulário de frete já preenchido; descartar grava em frete_sugestoes_descartadas.
// Viagens que já têm frete lançado aparecem marcadas (e escondidas por padrão).
Pages.freightSuggest = {
    _data: null,

    esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    iso(d) { return d.toISOString().split('T')[0]; },

    // quinzena atual: 1–15 ou 16–fim do mês, até hoje
    periodoPadrao() {
        const h = new Date();
        const de = new Date(h.getFullYear(), h.getMonth(), h.getDate() <= 15 ? 1 : 16);
        return [this.iso(de), this.iso(h)];
    },

    async render() {
        const [dePad, atePad] = this.periodoPadrao();
        const trucks = await db.getAll('trucks');
        this._trucks = trucks;
        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">🛰️ Fretes Sugeridos</h1><p class="page-subtitle">Viagens montadas pelo rastreador — confira, ajuste e aprove</p></div>
            </div></div>
            <div class="page-body">
                <div class="filter-bar">
                    <div class="form-group"><label class="form-label">Caminhão</label><select class="form-control" id="fs-truck">
                        <option value="">Selecione</option>
                        ${trucks.map(t => `<option value="${t.id}" ${String(this._truck || '') === String(t.id) ? 'selected' : ''}>${t.placa}</option>`).join('')}
                    </select></div>
                    <div class="form-group"><label class="form-label">De</label><input type="date" class="form-control" id="fs-de" value="${this._de || dePad}"></div>
                    <div class="form-group"><label class="form-label">Até</label><input type="date" class="form-control" id="fs-ate" value="${this._ate || atePad}"></div>
                    <button class="btn btn-primary" id="fs-buscar" onclick="Pages.freightSuggest.load()" style="align-self:flex-end">🔎 Buscar viagens</button>
                    <label style="display:inline-flex;align-items:center;gap:6px;align-self:center;font-size:0.8rem;cursor:pointer">
                        <input type="checkbox" id="fs-todas" ${this._todas ? 'checked' : ''} onchange="Pages.freightSuggest._todas = this.checked; Pages.freightSuggest.renderList()"> Mostrar já lançadas e descartadas
                    </label>
                </div>
                <p class="text-muted" style="font-size:0.75rem;margin:-4px 0 12px">Por enquanto só caminhões da Sascar. A busca lê o GPS dia a dia e leva uns 30 segundos.</p>
                <div id="fs-content">${this._data ? '' : '<div class="empty-state"><div class="empty-icon">🛰️</div><h3>Escolha o caminhão e o período</h3><p>As viagens aparecem aqui para você aprovar.</p></div>'}</div>
            </div>`;
        if (this._data) this.renderList();
    },

    async load() {
        const truckId = parseInt(document.getElementById('fs-truck').value);
        const de = document.getElementById('fs-de').value;
        const ate = document.getElementById('fs-ate').value;
        if (!truckId) { Utils.showToast('Selecione o caminhão', 'warning'); return; }
        if (!de || !ate || de > ate) { Utils.showToast('Período inválido', 'warning'); return; }
        this._truck = truckId; this._de = de; this._ate = ate;

        const el = document.getElementById('fs-content');
        const btn = document.getElementById('fs-buscar');
        btn.disabled = true;
        const inicio = Date.now();
        const tick = () => { el.innerHTML = `<div class="empty-state"><div class="empty-icon">⏳</div><h3>Lendo o GPS…</h3><p>${Math.round((Date.now() - inicio) / 1000)}s</p></div>`; };
        tick();
        const timer = setInterval(tick, 1000);
        try {
            const { data, error } = await supabase.functions.invoke('frete-sugestoes', { body: { truckId, dateFrom: de, dateTo: ate } });
            if (error) {
                const body = await error.context?.json?.().catch(() => null);
                throw new Error(body?.error || error.message);
            }
            this._data = { ...data, truckId };
            this.renderList();
        } catch (e) {
            console.error('frete-sugestoes:', e);
            this._data = null;
            el.innerHTML = `<div class="card"><div class="card-body text-center" style="color:var(--accent-danger)">Erro: ${this.esc(e.message || 'falha ao consultar o rastreador')}</div></div>`;
        } finally {
            clearInterval(timer);
            btn.disabled = false;
        }
    },

    dataHora(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    },

    // data do frete = dia da saída (fuso de SP)
    diaSaida(iso) { return new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 10); },

    mapa(v) {
        return `https://www.google.com/maps/dir/?api=1&origin=${v.pDe[0]},${v.pDe[1]}&destination=${v.pPara[0]},${v.pPara[1]}`;
    },

    renderList() {
        const el = document.getElementById('fs-content');
        if (!el || !this._data) return;
        const vs = this._data.viagens || [];
        const novas = vs.filter(v => !v.freteId && !v.descartada && !v.aprovada);
        const mostrar = this._todas ? vs : novas;
        const admin = App.userRole === 'admin';
        const kmTotal = vs.reduce((s, v) => s + v.km, 0);

        const linha = (v) => {
            const i = vs.indexOf(v);
            const status = v.aprovada ? '<span class="badge badge-success">✓ Lançado agora</span>'
                : v.freteId ? `<span class="badge badge-success" title="Frete #${v.freteId}">✓ Já lançado</span>`
                : v.descartada ? '<span class="badge badge-warning">Descartada</span>' : '';
            const tipo = `<span class="badge ${v.tipo === 'carregado' ? 'badge-success' : 'badge-warning'}">${v.tipo === 'carregado' ? '🟢 Carregado' : '🟡 Vazio'}</span>
                <div class="text-muted" style="font-size:0.7rem">${v.tipoFonte === 'historico' ? 'pelo histórico da rota' : 'palpite — confira'}</div>`;
            const km = `<strong>${Utils.formatNumber(v.km)}</strong> <span class="text-muted" style="font-size:0.7rem">${v.kmFonte === 'gps' ? 'trajeto GPS' : 'hodômetro'}</span>
                ${v.kmTabela ? `<div class="text-muted" style="font-size:0.75rem">tabela: ${Utils.formatNumber(v.kmTabela)}</div>` : ''}`;
            let acoes = '';
            if (admin) {
                if (v.aprovada) acoes = `<button class="btn btn-sm btn-secondary" onclick="Pages.freightSuggest.outroTrecho(${i})" title="A viagem teve mais de um frete (ex.: dividido na fronteira)">＋ Outro trecho</button>`;
                else if (v.descartada) acoes = `<button class="btn btn-sm btn-secondary" onclick="Pages.freightSuggest.restaurar(${i})">↩️ Restaurar</button>`;
                else if (!v.freteId) acoes = `<button class="btn btn-sm btn-primary" onclick="Pages.freightSuggest.aprovar(${i})">✅ Aprovar</button>
                    ${this.livre(vs[i + 1]) ? `<button class="btn btn-sm btn-secondary" onclick="Pages.freightSuggest.juntar(${i})" title="Foi um frete só: junta com a viagem de baixo">⤵ Juntar</button>` : ''}
                    <button class="btn btn-sm btn-secondary" onclick="Pages.freightSuggest.descartar(${i})" title="Não é frete (deslocamento, manutenção...)">✖</button>`;
            }
            return `<tr style="${v.freteId || v.descartada ? 'opacity:0.6' : ''}">
                <td style="white-space:nowrap">${this.dataHora(v.saida)}<div class="text-muted" style="font-size:0.75rem">chegou ${this.dataHora(v.chegada)}</div></td>
                <td><strong>${this.esc(v.de)}</strong> → <strong>${this.esc(v.para)}</strong>
                    <div style="font-size:0.75rem"><a href="${this.mapa(v)}" target="_blank" rel="noopener">🗺️ ver no mapa</a>${v.ref?.cliente ? ` · <span class="text-muted">último cliente: ${this.esc(v.ref.cliente)}</span>` : ''}</div></td>
                <td style="white-space:nowrap">${km}</td>
                <td>${tipo}</td>
                <td>${status}</td>
                <td style="white-space:nowrap">${acoes}</td>
            </tr>`;
        };

        el.innerHTML = `
            <div class="stats-grid" style="margin-bottom:16px">
                <div class="stat-card"><div class="stat-label">Sugestões para revisar</div><div class="stat-value">${novas.length}</div></div>
                <div class="stat-card"><div class="stat-label">Já lançadas</div><div class="stat-value">${vs.filter(v => v.freteId || v.aprovada).length}</div></div>
                <div class="stat-card"><div class="stat-label">KM das viagens (GPS)</div><div class="stat-value">${Utils.formatNumber(kmTotal)}</div></div>
            </div>
            ${this._data.diasSemDados?.length ? `<div class="card" style="margin-bottom:12px"><div class="card-body" style="color:var(--accent-warning);font-size:0.85rem">⚠️ Sem dados do rastreador em: ${this._data.diasSemDados.map(d => d.split('-').reverse().slice(0, 2).join('/')).join(', ')} — pode faltar viagem nesses dias.</div></div>` : ''}
            ${this._data.fretesSemViagem?.length ? `<div class="card" style="margin-bottom:12px"><div class="card-body" style="font-size:0.85rem">
                ℹ️ Fretes já lançados neste período que não bateram com nenhuma viagem do GPS — confira antes de aprovar uma sugestão parecida (o GPS pode ter dividido a viagem em duas):
                <ul style="margin:6px 0 0 18px">${this._data.fretesSemViagem.map(f => `<li>${f.data.split('-').reverse().slice(0, 2).join('/')} — ${this.esc(f.origem)} → ${this.esc(f.destino)} · ${Utils.formatNumber(f.km)} km · ${f.tipo}</li>`).join('')}</ul>
            </div></div>` : ''}
            ${mostrar.length ? `<div class="table-container"><table class="data-table">
                <thead><tr><th>Saída</th><th>Viagem</th><th>KM</th><th>Tipo</th><th></th><th></th></tr></thead>
                <tbody>${mostrar.map(linha).join('')}</tbody></table></div>`
            : `<div class="empty-state"><div class="empty-icon">✅</div><h3>${vs.length ? 'Tudo lançado neste período' : 'Nenhuma viagem encontrada'}</h3><p>${vs.length ? 'Marque "Mostrar já lançadas" para ver as viagens.' : 'O caminhão pode ter ficado parado, ou o rastreador não mandou posição.'}</p></div>`}
            <p class="text-muted" style="font-size:0.72rem;margin-top:10px">O KM sugerido no formulário é o da tabela (último frete da mesma rota) quando existe; senão o do GPS. Cidades que o caminhão visitou mas não aparecem em nenhum frete viram "Local desconhecido" — ao aprovar, digite o nome certo.</p>`;
    },

    livre(v) { return !!v && !v.freteId && !v.descartada && !v.aprovada; },

    // O GPS dividiu em duas o que foi um frete só (ex.: parou na aduana): vira uma viagem
    // da origem da primeira até o destino da segunda. Só na tela — vale até aprovar.
    juntar(i) {
        const vs = this._data.viagens, a = vs[i], b = vs[i + 1];
        if (!this.livre(a) || !this.livre(b)) return;
        vs.splice(i, 2, {
            ...a,
            para: b.para, paraLugar: b.paraLugar, pPara: b.pPara, chegada: b.chegada,
            km: a.km + b.km, kmFonte: a.kmFonte === b.kmFonte ? a.kmFonte : 'gps', kmTabela: null,
            tipo: a.tipo === 'carregado' || b.tipo === 'carregado' ? 'carregado' : 'vazio', tipoFonte: 'regra',
            ref: null,
        });
        this.renderList();
    },

    async aprovar(i, extra) {
        const v = this._data.viagens[i];
        const ref = v.ref || {};
        const preset = {
            truckId: this._data.truckId,
            data: this.diaSaida(v.saida),
            origem: v.de.startsWith('Local desconhecido') ? '' : v.de,
            destino: v.para.startsWith('Local desconhecido') ? '' : v.para,
            km: v.kmTabela || v.km,
            tipo: v.tipo,
            modalidade: ref.modalidade || undefined,
            valorFrete: ref.modalidade === 'fechado' ? ref.valorFrete : undefined,
            cliente: ref.cliente || '',
            ...extra,
        };
        await Pages.freights.showForm(null, this._data.truckId, preset);
        Pages.freights._onSaved = (salvo) => {
            v.aprovada = true;
            v.ultimoSalvo = salvo;
            this.renderList();
        };
    },

    // Viagem com mais de um frete (dividido na fronteira, carga no caminho): lança o
    // trecho seguinte, de onde o frete anterior terminou até o destino da viagem.
    outroTrecho(i) {
        const v = this._data.viagens[i];
        const s = v.ultimoSalvo || {};
        const resto = Math.max(0, v.km - (parseFloat(s.km) || 0));
        this.aprovar(i, { origem: s.destino || '', destino: v.para.startsWith('Local desconhecido') ? '' : v.para, km: resto || '', valorFrete: undefined, modalidade: undefined });
    },

    async descartar(i) {
        const v = this._data.viagens[i];
        const { error } = await supabase.from('frete_sugestoes_descartadas').upsert({ truckId: this._data.truckId, saida: v.saida });
        if (error) { Utils.showToast('Erro ao descartar: ' + error.message, 'error'); return; }
        v.descartada = true;
        this.renderList();
    },

    async restaurar(i) {
        const v = this._data.viagens[i];
        const { error } = await supabase.from('frete_sugestoes_descartadas').delete().eq('truckId', this._data.truckId).eq('saida', v.saida);
        if (error) { Utils.showToast('Erro ao restaurar: ' + error.message, 'error'); return; }
        v.descartada = false;
        this.renderList();
    }
};
