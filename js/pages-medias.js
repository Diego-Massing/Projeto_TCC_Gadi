// ===== MÉDIAS PARCIAIS =====
// Média km/L de abastecida em abastecida, por caminhão (e o motorista dele), para
// acompanhar durante o mês. Por padrão cada abastecida usa a anterior com KM como
// início: (KM dela − KM da anterior) / litros dela. Se essa média sai muito do padrão
// (tanque não completado), o período é alargado sozinho para trás até voltar ao normal,
// com aviso. O admin também pode escolher o início na mão (fuelings.mediaInicioId).
// As abastecidas do meio ficam "incluídas" nessa média e os litros delas entram na conta.
// O padrão do caminhão é a mediana das médias de duas em duas abastecidas nos 90 dias
// antes do fim do período.
Pages.medias = {
    HIST_DIAS: 120,       // quanto antes do período carregar (início da 1ª média + padrão)
    PADRAO_DIAS: 90,
    TOL_OK: 0.10,         // até 10% do padrão: normal
    TOL_ALERTA: 0.20,     // até 20%: atenção; acima: fora do padrão
    MAX_OPCOES: 8,        // abastecidas anteriores oferecidas como início (escolha manual)
    MAX_AUTO: 3,          // até quantas abastecidas para trás o alargamento automático vai
    _byTruck: {},

    esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    iso(d) { return d.toISOString().split('T')[0]; },

    async render() {
        const hoje = new Date();
        const de = this._de || this.iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
        const ate = this._ate || this.iso(hoje);
        const [trucks, users] = await Promise.all([db.getAll('trucks'), db.getAll('users')]);
        this._trucks = trucks;
        this._drivers = users.filter(u => u.role === 'motorista' && u.ativo !== false);

        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">📈 Médias Parciais</h1><p class="page-subtitle">Média km/L de abastecida em abastecida — escolha outro início quando o tanque não foi completado</p></div>
            </div></div>
            <div class="page-body">
                <div class="filter-bar">
                    <div class="form-group"><label class="form-label">Caminhão</label><select class="form-control" id="md-truck" onchange="Pages.medias.reload()">
                        <option value="">Todos</option>
                        ${trucks.map(t => `<option value="${t.id}" ${String(this._truck || '') === String(t.id) ? 'selected' : ''}>${t.placa}${this.driverName(t.id) ? ' — ' + this.esc(this.driverName(t.id)) : ''}</option>`).join('')}
                    </select></div>
                    <div class="form-group"><label class="form-label">De</label><input type="date" class="form-control" id="md-de" value="${de}" onchange="Pages.medias.reload()"></div>
                    <div class="form-group"><label class="form-label">Até</label><input type="date" class="form-control" id="md-ate" value="${ate}" onchange="Pages.medias.reload()"></div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);align-self:center;line-height:1.5">
                        <span style="color:var(--accent-success)">●</span> até ${this.TOL_OK * 100}% do padrão &nbsp;
                        <span style="color:var(--accent-warning)">●</span> até ${this.TOL_ALERTA * 100}% &nbsp;
                        <span style="color:var(--accent-danger)">●</span> fora do padrão
                    </div>
                </div>
                <div id="md-content"><div class="empty-state"><div class="empty-icon">⏳</div><h3>Carregando…</h3></div></div>
            </div>`;
        await this.load();
    },

    async reload() {
        this._truck = document.getElementById('md-truck').value;
        this._de = document.getElementById('md-de').value;
        this._ate = document.getElementById('md-ate').value;
        await this.load();
    },

    driverName(truckId) {
        return this._drivers.find(d => d.truckId === truckId)?.nome || '';
    },

    async load() {
        const de = document.getElementById('md-de').value;
        const ate = document.getElementById('md-ate').value;
        const truckId = document.getElementById('md-truck').value;
        if (!de || !ate || de > ate) {
            document.getElementById('md-content').innerHTML = '<div class="empty-state"><h3>Período inválido</h3></div>';
            return;
        }
        const desde = new Date(de + 'T00:00:00');
        desde.setDate(desde.getDate() - this.HIST_DIAS);
        let q = supabase.from('fuelings').select('*').gte('data', this.iso(desde)).lte('data', ate);
        if (truckId) q = q.eq('truckId', parseInt(truckId));
        const { data, error } = await q;
        if (error) {
            document.getElementById('md-content').innerHTML = `<div class="empty-state"><h3>Erro ao carregar abastecimentos</h3><p>${this.esc(error.message)}</p></div>`;
            return;
        }

        const grupos = {};
        for (const f of data) (grupos[f.truckId] ||= []).push(f);
        this._byTruck = {};
        const cards = [];
        for (const t of this._trucks) {
            if (!grupos[t.id]) continue;
            const calc = this.compute(grupos[t.id], de, ate);
            if (calc.rows.length === 0) continue;
            this._byTruck[t.id] = calc;
            cards.push(this.renderTruck(t, calc));
        }
        document.getElementById('md-content').innerHTML = cards.length ? cards.join('') :
            '<div class="empty-state"><div class="empty-icon">⛽</div><h3>Nenhum abastecimento no período</h3></div>';
    },

    // Monta as médias do caminhão. Percorre de trás para frente: cada abastecida com KM
    // fecha um trecho que começa em:
    //   1. a abastecida escolhida pelo admin (mediaInicioId), se houver;
    //   2. senão, a anterior com KM — e, se essa média ficar fora do padrão, volta
    //      abastecida por abastecida (até MAX_AUTO) até cair dentro, com aviso;
    // o que fica entre início e fim é "incluído" nesse trecho e não tem média própria.
    compute(list, de, ate) {
        const all = Utils.fuelSorted(list);
        const anchors = all.filter(f => f.km > 0);
        const trecho = (s, i) => {
            const km = anchors[i].km - anchors[s].km;
            const litros = Utils.fuelRangeLitros(all, anchors[s], anchors[i]);
            return { km, litros, media: km > 0 && litros > 0 ? km / litros : null };
        };

        // Padrão = mediana das médias de duas em duas abastecidas nos últimos PADRAO_DIAS
        // (a mediana não se deixa levar pelas médias erradas de tanque não completado).
        const limitePadrao = new Date(ate + 'T00:00:00');
        limitePadrao.setDate(limitePadrao.getDate() - this.PADRAO_DIAS);
        const desdePadrao = this.iso(limitePadrao);
        const medias = [];
        for (let i = 1; i < anchors.length; i++) {
            if (anchors[i].data < desdePadrao || anchors[i].data > ate) continue;
            const m = trecho(i - 1, i).media;
            if (m) medias.push(m);
        }
        medias.sort((a, b) => a - b);
        const padrao = medias.length >= 3
            ? (medias.length % 2 ? medias[(medias.length - 1) / 2] : (medias[medias.length / 2 - 1] + medias[medias.length / 2]) / 2)
            : null;
        const dentro = m => m && padrao && Math.abs(m - padrao) / padrao <= this.TOL_ALERTA;

        const segs = new Map();       // id da abastecida final -> trecho
        const incluida = new Map();   // id -> abastecida final do trecho que a inclui
        let i = anchors.length - 1;
        while (i > 0) {
            const end = anchors[i];
            let s = i - 1, modo = 'padrao', mediaCurta = null;
            const j = end.mediaInicioId ? anchors.findIndex(a => a.id === end.mediaInicioId) : -1;
            if (j >= 0 && j < i) {
                s = j; modo = 'manual';
            } else if (padrao && !dentro(trecho(i - 1, i).media)) {
                mediaCurta = trecho(i - 1, i).media;
                for (let k = i - 2; k >= Math.max(0, i - this.MAX_AUTO); k--) {
                    if (dentro(trecho(k, i).media)) { s = k; modo = 'auto'; break; }
                }
            }
            const t = trecho(s, i);
            const semSolucao = modo === 'padrao' && !!padrao && !dentro(t.media);
            segs.set(end.id, { start: anchors[s], end, ...t, modo, mediaCurta, semSolucao, anchorIdx: i });
            for (const f of all.slice(all.indexOf(anchors[s]) + 1, all.indexOf(end))) incluida.set(f.id, end);
            i = s;
        }

        const rows = all.filter(f => f.data >= de && f.data <= ate);
        const noPeriodo = rows.map(f => segs.get(f.id)).filter(sg => sg && sg.media);
        const kmPer = noPeriodo.reduce((s, sg) => s + sg.km, 0);
        const lPer = noPeriodo.reduce((s, sg) => s + sg.litros, 0);
        return { all, anchors, segs, incluida, padrao, rows, mediaPeriodo: kmPer > 0 && lPer > 0 ? kmPer / lPer : null, kmPer, lPer };
    },

    status(media, padrao) {
        if (media == null || !padrao) return { cor: 'var(--text-secondary)', txt: '' };
        const dev = (media - padrao) / padrao;
        const pct = `${dev >= 0 ? '+' : ''}${(dev * 100).toFixed(0)}%`;
        if (Math.abs(dev) <= this.TOL_OK) return { cor: 'var(--accent-success)', txt: pct };
        if (Math.abs(dev) <= this.TOL_ALERTA) return { cor: 'var(--accent-warning)', txt: pct };
        return { cor: 'var(--accent-danger)', txt: pct, fora: true };
    },

    dm(data) { return Utils.formatDate(data).slice(0, 5); },

    renderTruck(t, c) {
        const canEdit = App.userRole === 'admin';
        const st = this.status(c.mediaPeriodo, c.padrao);
        const segsPer = c.rows.map(f => c.segs.get(f.id)).filter(Boolean);
        const fora = segsPer.filter(sg => sg.semSolucao || this.status(sg.media, c.padrao).fora).length;
        const autos = segsPer.filter(sg => sg.modo === 'auto').length;
        const motorista = this.driverName(t.id);

        const linhas = [...c.rows].reverse().map(f => {
            const sg = c.segs.get(f.id);
            const inc = c.incluida.get(f.id);
            let mediaCell, kmCell = '—', litrosCell = '—', inicioCell = '';
            if (sg) {
                const s = this.status(sg.media, c.padrao);
                kmCell = Utils.formatNumber(sg.km);
                litrosCell = Utils.formatNumber(sg.litros, 1);
                mediaCell = sg.media
                    ? `<strong style="color:${s.cor};font-size:0.95rem">${sg.media.toFixed(2)}</strong>${s.txt ? ` <span style="font-size:0.7rem;color:${s.cor}">${s.txt}</span>` : ''}`
                    : '<span style="color:var(--accent-danger);font-size:0.75rem">KM inconsistente</span>';
                const curta = sg.mediaCurta ? sg.mediaCurta.toFixed(2) + ' km/L' : 'KM inconsistente';
                if (sg.modo === 'auto') {
                    mediaCell += `<div style="font-size:0.7rem;color:var(--accent-warning);margin-top:2px">⚠️ Só com a anterior deu ${curta} — período alargado até ${this.dm(sg.start.data)}. Tanque completado?</div>`;
                } else if (sg.semSolucao) {
                    mediaCell += `<div style="font-size:0.7rem;color:var(--accent-danger);margin-top:2px">⚠️ Fora do padrão mesmo alargando o período — confira KM e litros</div>`;
                }
                const opcoes = c.anchors.slice(Math.max(0, sg.anchorIdx - this.MAX_OPCOES), sg.anchorIdx).reverse();
                const auto = sg.modo === 'manual' ? 'Automático' : `Automático (${this.dm(sg.start.data)})`;
                inicioCell = canEdit ? `<select class="form-control" style="padding:3px 6px;font-size:0.75rem;min-width:200px;${sg.modo === 'manual' ? 'border-color:var(--accent-info)' : ''}" onchange="Pages.medias.setInicio(${t.id}, ${f.id}, this.value)" title="${sg.modo === 'manual' ? 'Início escolhido manualmente' : 'Início automático'}">
                        <option value="" ${sg.modo !== 'manual' ? 'selected' : ''}>${auto}</option>
                        ${opcoes.map(a => `<option value="${a.id}" ${sg.modo === 'manual' && sg.start.id === a.id ? 'selected' : ''}>${this.dm(a.data)} · ${Utils.formatNumber(a.km)} km · ${Utils.formatNumber(a.litros, 1)} L</option>`).join('')}
                    </select>`
                    : `<span style="font-size:0.75rem">${this.dm(sg.start.data)}${sg.modo === 'manual' ? ' (escolhida)' : sg.modo === 'auto' ? ' (auto)' : ''}</span>`;
            } else if (inc) {
                mediaCell = `<span style="font-size:0.72rem;color:var(--text-secondary)">↳ incluída na média de ${this.dm(inc.data)}</span>`;
            } else if (!(f.km > 0)) {
                mediaCell = '<span style="font-size:0.72rem;color:var(--text-secondary)">sem KM</span>';
            } else {
                mediaCell = '<span style="font-size:0.72rem;color:var(--text-secondary)">sem abastecida anterior</span>';
            }
            return `<tr style="${inc ? 'opacity:0.6' : ''}">
                <td>${Utils.formatDate(f.data)}</td>
                <td style="font-size:0.8rem">${this.esc(f.posto) || '—'}</td>
                <td class="font-mono">${f.km > 0 ? Utils.formatNumber(f.km) : '—'}</td>
                <td>${Utils.formatNumber(f.litros, 1)}</td>
                <td>${inicioCell}</td>
                <td>${kmCell}</td>
                <td>${litrosCell}</td>
                <td>${mediaCell}</td>
            </tr>`;
        }).join('');

        return `<div class="card" style="margin-bottom:16px;padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px">
                <div>
                    <div style="font-size:1.05rem"><strong class="font-mono">${t.placa}</strong>${motorista ? ` <span style="color:var(--text-secondary)">— ${this.esc(motorista)}</span>` : ''}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px">${c.rows.length} abastecida(s) no período${autos ? ` · <span style="color:var(--accent-warning)">⚠️ ${autos} com período alargado automaticamente</span>` : ''}${fora ? ` · <span style="color:var(--accent-danger)">${fora} fora do padrão</span>` : ''}</div>
                </div>
                <div style="display:flex;gap:20px;flex-wrap:wrap;text-align:right">
                    <div><div style="font-size:0.7rem;color:var(--text-secondary)">MÉDIA DO PERÍODO</div><div style="font-size:1.2rem;font-weight:700;color:${st.cor}">${c.mediaPeriodo ? c.mediaPeriodo.toFixed(2) + ' km/L' : '—'}</div>
                        ${c.mediaPeriodo ? `<div style="font-size:0.7rem;color:var(--text-secondary)">${Utils.formatNumber(c.kmPer)} km / ${Utils.formatNumber(c.lPer, 1)} L</div>` : ''}</div>
                    <div><div style="font-size:0.7rem;color:var(--text-secondary)">PADRÃO (${this.PADRAO_DIAS} DIAS)</div><div style="font-size:1.2rem;font-weight:700">${c.padrao ? c.padrao.toFixed(2) + ' km/L' : '—'}</div></div>
                </div>
            </div>
            <div class="table-container"><table class="data-table">
                <thead><tr><th>Data</th><th>Posto</th><th>KM</th><th>Litros</th><th>Início da média</th><th>KM rodado</th><th>Litros na média</th><th>Média km/L</th></tr></thead>
                <tbody>${linhas}</tbody>
            </table></div>
        </div>`;
    },

    async setInicio(truckId, fuelingId, value) {
        const c = this._byTruck[truckId];
        const f = c?.all.find(x => x.id === fuelingId);
        if (!f) return;
        const mediaInicioId = value ? parseInt(value) : null;
        try {
            await db.update('fuelings', { id: f.id, mediaInicioId });
            Utils.showToast(mediaInicioId ? 'Início da média alterado' : 'Média voltou ao padrão', 'success');
            await this.load();
        } catch (e) {
            Utils.showToast('Erro ao salvar: ' + (e.message || e), 'error');
        }
    }
};
