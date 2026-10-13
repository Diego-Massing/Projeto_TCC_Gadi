// ===== NOTAS RECEBIDAS (NF-e) =====
// As NF-e chegam em nfe_inbox pelo Apps Script do Gmail (tools/gmail-nfe) ou pelo botão
// "Importar XML". Aqui cada nota pendente vira uma proposta de abastecimento (placa,
// KM e motorista vêm do texto livre da nota) que o admin revisa e aprova. Se já existe
// um abastecimento lançado à mão que bate com a nota, ela é marcada como "já lançada".
Pages.nfe = {
    _tab: 'pendente',
    _rows: [],       // linhas de nfe_inbox da aba atual
    _props: {},      // id da nota -> proposta (ver propose)
    _trucks: [],
    _fuelings: [],

    esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    // ---------- leitura do XML ----------

    parse(xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const inf = doc.getElementsByTagName('infNFe')[0];
        if (!inf) return null;
        const one = (parent, tag) => parent?.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
        const num = s => parseFloat(s) || 0;
        const emit = inf.getElementsByTagName('emit')[0];
        const itens = Array.from(inf.getElementsByTagName('det')).map(det => {
            const prod = det.getElementsByTagName('prod')[0];
            return {
                nome: one(prod, 'xProd'), ncm: one(prod, 'NCM'),
                qtd: num(one(prod, 'qCom')), unit: num(one(prod, 'vUnCom')),
                valor: num(one(prod, 'vProd')) - num(one(prod, 'vDesc')) + num(one(prod, 'vOutro')),
            };
        });
        const obs = one(inf, 'infCpl');
        const placa = (obs.match(/Placa:\s*([A-Z0-9]{3}-?[A-Z0-9]{4})/i) || [])[1] || '';
        const km = (obs.match(/KM:\s*([\d.]+)/i) || [])[1] || '';
        const motorista = ((obs.match(/Motorista:\s*([^\n]+?)\s*(?:-|$)/i) || [])[1] || '').trim();
        return {
            chave: (inf.getAttribute('Id') || '').replace('NFe', ''),
            numero: one(inf, 'nNF'),
            data: one(inf, 'dhEmi').slice(0, 10),
            emitente: one(emit, 'xFant') || one(emit, 'xNome'),
            emitenteNome: one(emit, 'xNome'),
            total: num(one(inf.getElementsByTagName('ICMSTot')[0], 'vNF')),
            itens, obs,
            placa: placa.replace('-', '').toUpperCase(),
            km: parseInt(km.replace(/\./g, '')) || 0,
            motorista,
        };
    },

    // Placa digitada pelo frentista: tenta igual, depois ignorando letras/números
    // parecidos (O/0, I/1...), depois 1 caractere errado ou 2 trocados. Só sugere se for único.
    matchTruck(placa) {
        if (!placa) return { truck: null, exata: false };
        const norm = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const loose = s => norm(s).replace(/[O0QD]/g, '0').replace(/[I1L]/g, '1').replace(/[B8]/g, '8')
            .replace(/[S5]/g, '5').replace(/[Z2]/g, '2').replace(/[G6]/g, '6');
        const exact = this._trucks.find(t => norm(t.placa) === norm(placa));
        if (exact) return { truck: exact, exata: true };
        let cands = this._trucks.filter(t => loose(t.placa) === loose(placa));
        if (cands.length !== 1) {
            const p = norm(placa);
            cands = this._trucks.filter(t => {
                const q = norm(t.placa);
                if (q.length !== p.length) return false;
                const diff = [...q].map((c, i) => c !== p[i] ? i : -1).filter(i => i >= 0);
                // 1 caractere errado, ou 2 vizinhos trocados de lugar (QHI4A39 x QIH4A39)
                return diff.length === 1 || (diff.length === 2 && diff[1] === diff[0] + 1
                    && q[diff[0]] === p[diff[1]] && q[diff[1]] === p[diff[0]]);
            });
        }
        return { truck: cands.length === 1 ? cands[0] : null, exata: false };
    },

    // Monta o abastecimento proposto para uma nota (mesmo formato do lançamento manual:
    // diesel + arla na mesma linha "Diesel+Arla"; nota só de arla vira linha "Arla").
    propose(row) {
        const n = this.parse(row.xml);
        if (!n) return { erro: 'XML ilegível' };
        const isArla = i => /ARLA/i.test(i.nome) || i.ncm === '31021010';
        const isDiesel = i => !isArla(i) && (/DIESEL/i.test(i.nome) || i.ncm.startsWith('2710'));
        const diesel = n.itens.filter(isDiesel), arla = n.itens.filter(isArla);
        const outros = n.itens.filter(i => !isDiesel(i) && !isArla(i));
        const sum = (arr, k) => arr.reduce((s, i) => s + i[k], 0);
        const dL = sum(diesel, 'qtd'), dV = sum(diesel, 'valor'), aV = sum(arla, 'valor');

        let f;
        if (dL > 0) {
            f = { litros: +dL.toFixed(3), valorLitro: +(dV / dL).toFixed(4), valorArla: +aV.toFixed(2),
                  valorTotal: +(dV + aV).toFixed(2), tipoComb: aV > 0 ? 'Diesel+Arla' : 'Diesel' };
        } else if (arla.length) {
            const aL = sum(arla, 'qtd');
            f = { litros: +aL.toFixed(3), valorLitro: +(aV / aL).toFixed(4), valorArla: 0, valorTotal: +aV.toFixed(2), tipoComb: 'Arla' };
        }
        const m = this.matchTruck(n.placa);
        const p = { nota: n, fueling: f, truckId: m.truck?.id || null, km: f?.tipoComb === 'Arla' ? 0 : n.km,
                    posto: /BRAMBILA/i.test(n.emitenteNome) ? 'BRAMBILA' : n.emitente, alertas: [] };

        if (!f) p.alertas.push('Nota sem diesel nem arla — provavelmente não é abastecimento');
        if (outros.length) p.alertas.push(`Itens que não entram no abastecimento: ${outros.map(i => i.nome).join(', ')}`);
        if (!n.placa) p.alertas.push('Placa não encontrada no texto da nota');
        else if (!m.truck) p.alertas.push(`Placa ${n.placa} não cadastrada`);
        else if (!m.exata) p.alertas.push(`Placa da nota ${n.placa} → sugerido ${m.truck.placa}`);
        p.match = null; // preenchido por assignMatches, que olha todas as notas juntas
        return p;
    },

    // Abastecimentos lançados à mão que podem corresponder à nota (mesmo caminhão, data
    // até 1 dia de diferença, litros ou valor batendo), do mais provável ao menos:
    // valor igual > data mais próxima > litros mais próximos.
    candidates(p) {
        if (!p.fueling || !p.truckId) return [];
        const day = d => new Date(d + 'T12:00:00').getTime() / 86400000;
        return this._fuelings
            .filter(f => f.truckId === p.truckId && !f.nfeChave)
            .map(f => ({ f, dias: Math.abs(day(f.data) - day(p.nota.data)),
                         dL: Math.abs((f.litros || 0) - p.fueling.litros), dV: Math.abs((f.valorTotal || 0) - p.fueling.valorTotal) }))
            .filter(c => c.dias <= 1 && (c.dL <= 2 || c.dV <= 2))
            .map(c => ({ ...c, score: (c.dV <= 0.5 ? 0 : 1000) + c.dias * 100 + c.dL + c.dV / 100 }))
            .sort((a, b) => a.score - b.score);
    },

    findExisting(p) {
        const taken = new Set(Object.values(this._props).filter(o => o !== p && o.match).map(o => o.match.id));
        return this.candidates(p).find(c => !taken.has(c.f.id))?.f || null;
    },

    // Casa todas as notas pendentes de uma vez: os pares mais certos primeiro, e cada
    // abastecimento só serve para uma nota (evita a nota de 04/10 "roubar" o de 03/10).
    assignMatches() {
        const pairs = [];
        for (const [id, p] of Object.entries(this._props)) {
            p.match = null;
            if (!p.erro) for (const c of this.candidates(p)) pairs.push({ id, f: c.f, score: c.score });
        }
        pairs.sort((a, b) => a.score - b.score);
        const used = new Set();
        for (const { id, f } of pairs) {
            const p = this._props[id];
            if (p.match || used.has(f.id)) continue;
            p.match = f; used.add(f.id);
        }
        for (const p of Object.values(this._props)) if (!p.erro) this.checkKm(p);
    },

    checkKm(p) {
        p.alertas = p.alertas.filter(a => !a.startsWith('KM'));
        if (!p.truckId || !p.fueling || p.fueling.tipoComb === 'Arla') return;
        if (!p.km) { p.alertas.push('KM não informado na nota'); return; }
        const prev = this._fuelings
            .filter(f => f.truckId === p.truckId && f.km > 0 && f.data <= p.nota.data && f.id !== p.match?.id)
            .reduce((max, f) => Math.max(max, f.km), 0);
        if (prev && p.km < prev) p.alertas.push(`KM ${Utils.formatNumber(p.km)} menor que o anterior (${Utils.formatNumber(prev)}) — frentista pode ter digitado errado`);
        else if (prev && p.km - prev > 5000) p.alertas.push(`KM ${Utils.formatNumber(p.km)} está ${Utils.formatNumber(p.km - prev)} km acima do anterior (${Utils.formatNumber(prev)})`);
    },

    // ---------- tela ----------

    async render() {
        document.getElementById('page-content').innerHTML = `
            <div class="page-header"><div class="page-header-row">
                <div><h1 class="page-title">Notas Recebidas</h1><p class="page-subtitle">NF-e dos postos que chegam por e-mail — revise e aprove para virar abastecimento</p></div>
                <div class="btn-group">
                    <input type="file" id="nfe-file" accept=".xml" multiple style="display:none" onchange="Pages.nfe.uploadFiles(this.files)">
                    <button class="btn btn-secondary" onclick="document.getElementById('nfe-file').click()">📎 Importar XML</button>
                </div>
            </div></div>
            <div class="page-body">
                <div class="tabs">${[['pendente', 'Pendentes'], ['ja_lancada', 'Já lançadas'], ['aprovada', 'Aprovadas'], ['ignorada', 'Ignoradas']]
                    .map(([k, l]) => `<button class="tab-btn ${this._tab === k ? 'active' : ''}" onclick="Pages.nfe.setTab('${k}')">${l}</button>`).join('')}</div>
                <div id="nfe-list"><div class="empty-state"><h3>Carregando...</h3></div></div>
            </div>`;
        await this.load();
    },

    async setTab(tab) { this._tab = tab; await this.render(); },

    async load() {
        const cols = this._tab === 'pendente' ? '*' : 'id, chave, status, "emitenteNome", "dataEmissao", "valorTotal", "fuelingIds", origem';
        const [inbox, trucks, fuelings] = await Promise.all([
            supabase.from('nfe_inbox').select(cols).eq('status', this._tab).order('dataEmissao', { ascending: false }).limit(1000),
            db.getAll('trucks'), db.getAll('fuelings'),
        ]);
        if (inbox.error) { Utils.showToast('Erro ao carregar notas: ' + inbox.error.message, 'error'); return; }
        this._rows = inbox.data; this._trucks = trucks; this._fuelings = fuelings;
        this._props = {};
        if (this._tab === 'pendente') {
            for (const r of this._rows) this._props[r.id] = this.propose(r);
            this.assignMatches();
        }
        document.getElementById('nfe-list').innerHTML = this._tab === 'pendente' ? this.renderPending() : this.renderDone();
    },

    renderPending() {
        if (!this._rows.length) return '<div class="empty-state"><div class="empty-icon">📭</div><h3>Nenhuma nota pendente</h3></div>';
        const ids = Object.keys(this._props);
        const nMatch = ids.filter(id => this._props[id].match).length;
        const nLimpas = ids.filter(id => { const p = this._props[id]; return !p.match && p.fueling && p.truckId && !p.alertas.length; }).length;
        const bulk = `<div class="btn-group mb-2">
            ${nMatch ? `<button class="btn btn-secondary" onclick="Pages.nfe.bulkJaLancadas()">🔗 Marcar ${nMatch} como já lançadas</button>` : ''}
            ${nLimpas ? `<button class="btn btn-success" onclick="Pages.nfe.bulkAprovar()">✅ Aprovar ${nLimpas} sem alertas</button>` : ''}
        </div>`;
        const truckOpts = sel => `<option value="">— escolha —</option>` + this._trucks.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${this.esc(t.placa)}</option>`).join('');

        const rows = this._rows.map(r => {
            const p = this._props[r.id];
            if (p.erro) return `<tr><td colspan="9">${this.esc(r.chave)} — ${p.erro} <button class="btn btn-sm btn-secondary" onclick="Pages.nfe.ignorar(${r.id})">Ignorar</button></td></tr>`;
            const n = p.nota, f = p.fueling;
            const m = p.match;
            const action = m
                ? `<div class="text-muted" style="font-size:.8rem">Lançado à mão: ${Utils.formatDate(m.data)} · ${Utils.formatNumber(m.litros, 2)} L · ${Utils.formatCurrency(m.valorTotal)}</div>
                   <button class="btn btn-sm btn-secondary" onclick="Pages.nfe.jaLancada(${r.id})">🔗 Já lançada</button>`
                : `<button class="btn btn-sm btn-success" onclick="Pages.nfe.aprovar(${r.id})" ${f ? '' : 'disabled'}>✅ Aprovar</button>`;
            return `<tr>
                <td>${Utils.formatDate(n.data)}<div class="text-muted" style="font-size:.75rem">NF ${this.esc(n.numero)}</div></td>
                <td>${this.esc(p.posto)}</td>
                <td><select class="form-control" style="min-width:110px" onchange="Pages.nfe.edit(${r.id}, 'truckId', this.value)">${truckOpts(p.truckId)}</select>
                    <div class="text-muted" style="font-size:.75rem">nota: ${this.esc(n.placa || '?')}${n.motorista ? ' · ' + this.esc(n.motorista) : ''}</div></td>
                <td><input type="number" class="form-control" style="width:110px" value="${p.km || ''}" onchange="Pages.nfe.edit(${r.id}, 'km', this.value)"></td>
                <td>${f ? `${Utils.formatNumber(f.litros, 2)} L<div class="text-muted" style="font-size:.75rem">${Utils.formatCurrency(f.valorLitro)}/L</div>` : '—'}</td>
                <td>${f?.valorArla ? Utils.formatCurrency(f.valorArla) : '—'}</td>
                <td class="font-bold">${Utils.formatCurrency(f?.valorTotal ?? n.total)}</td>
                <td>${p.alertas.map(a => `<div class="badge badge-warning" style="white-space:normal;margin-bottom:2px">⚠️ ${this.esc(a)}</div>`).join('')}</td>
                <td style="white-space:nowrap">${action} <button class="btn btn-sm btn-icon" title="Ignorar" onclick="Pages.nfe.ignorar(${r.id})">🚫</button></td>
            </tr>`;
        }).join('');
        return `${bulk}<div class="table-container"><table class="data-table"><thead><tr>
            <th>Data</th><th>Posto</th><th>Placa</th><th>KM</th><th>Diesel</th><th>Arla</th><th>Total</th><th>Alertas</th><th></th>
            </tr></thead><tbody>${rows}</tbody></table></div>
            <div class="table-footer"><span>${this._rows.length} notas pendentes</span></div>`;
    },

    renderDone() {
        if (!this._rows.length) return '<div class="empty-state"><div class="empty-icon">📭</div><h3>Nenhuma nota</h3></div>';
        const canUndo = this._tab !== 'aprovada';
        return `<div class="table-container"><table class="data-table"><thead><tr><th>Data</th><th>Emitente</th><th>Total</th><th>Origem</th><th>Chave</th><th></th></tr></thead><tbody>
            ${this._rows.map(r => `<tr>
                <td>${Utils.formatDate((r.dataEmissao || '').slice(0, 10))}</td><td>${this.esc(r.emitenteNome)}</td>
                <td>${Utils.formatCurrency(r.valorTotal)}</td><td>${this.esc(r.origem || '—')}</td>
                <td class="font-mono" style="font-size:.75rem">${this.esc(r.chave)}</td>
                <td>${canUndo ? `<button class="btn btn-sm btn-secondary" onclick="Pages.nfe.desfazer(${r.id})">↩️ Voltar p/ pendente</button>` : ''}</td>
            </tr>`).join('')}</tbody></table></div>
            <div class="table-footer"><span>${this._rows.length} notas</span>${this._tab === 'aprovada' ? '<span class="text-muted">Para desfazer, exclua o abastecimento em Abastecimentos.</span>' : ''}</div>`;
    },

    edit(id, field, value) {
        const p = this._props[id];
        if (field === 'truckId') {
            p.truckId = parseInt(value) || null;
            p.alertas = p.alertas.filter(a => !a.startsWith('Placa'));
            p.match = this.findExisting(p);
        } else if (field === 'km') {
            p.km = parseInt(value) || 0;
        }
        this.checkKm(p);
        document.getElementById('nfe-list').innerHTML = this.renderPending();
    },

    // ---------- ações ----------

    async setStatus(id, status, fuelingIds = null) {
        const { error } = await supabase.from('nfe_inbox')
            .update({ status, fuelingIds, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
    },

    async ignorar(id) {
        try {
            await this.setStatus(id, 'ignorada');
            Utils.showToast('Nota ignorada — fica na aba "Ignoradas" se precisar voltar', 'success');
            await this.load();
        } catch (e) { console.error(e); Utils.showToast('Erro ao ignorar: ' + e.message, 'error'); }
    },

    async aprovar(id, silent = false) {
        const p = this._props[id], row = this._rows.find(r => r.id === id);
        if (!p.truckId) { Utils.showToast('Escolha o caminhão', 'warning'); return false; }
        const data = { truckId: p.truckId, data: p.nota.data, km: p.km || 0, posto: p.posto, nfeChave: row.chave, ...p.fueling };
        try {
            const fid = await db.add('fuelings', data);
            if (data.km > 0) {
                const trk = this._trucks.find(t => t.id === p.truckId);
                if (trk && data.km > (trk.kmAtual || 0)) { await db.update('trucks', { id: trk.id, kmAtual: data.km }); trk.kmAtual = data.km; }
            }
            await this.setStatus(id, 'aprovada', [fid]);
            if (!silent) { Utils.showToast('Abastecimento lançado!', 'success'); await this.load(); }
            return true;
        } catch (e) { console.error(e); Utils.showToast('Erro ao aprovar: ' + e.message, 'error'); return false; }
    },

    async jaLancada(id, silent = false) {
        const p = this._props[id], row = this._rows.find(r => r.id === id);
        if (p.match.nfeChave) return false; // já vinculado a outra nota nesta mesma leva
        try {
            // liga o lançamento manual à nota, para não casar com outra nota depois
            await db.update('fuelings', { id: p.match.id, nfeChave: row.chave });
            p.match.nfeChave = row.chave;
            await this.setStatus(id, 'ja_lancada', [p.match.id]);
            if (!silent) { Utils.showToast('Nota vinculada ao abastecimento existente', 'success'); await this.load(); }
            return true;
        } catch (e) { console.error(e); Utils.showToast('Erro: ' + e.message, 'error'); return false; }
    },

    async bulkJaLancadas() {
        const ids = Object.keys(this._props).map(Number).filter(id => this._props[id].match);
        if (!confirm(`Vincular ${ids.length} notas aos abastecimentos já lançados à mão?`)) return;
        let ok = 0;
        for (const id of ids) if (await this.jaLancada(id, true)) ok++;
        Utils.showToast(`${ok} notas marcadas como já lançadas`, 'success');
        await this.load();
    },

    async bulkAprovar() {
        const ids = Object.keys(this._props).map(Number).filter(id => { const p = this._props[id]; return !p.match && p.fueling && p.truckId && !p.alertas.length; });
        if (!confirm(`Lançar ${ids.length} abastecimentos das notas sem alertas?`)) return;
        let ok = 0;
        for (const id of ids) if (await this.aprovar(id, true)) ok++;
        Utils.showToast(`${ok} abastecimentos lançados`, 'success');
        await this.load();
    },

    async desfazer(id) {
        const row = this._rows.find(r => r.id === id);
        try {
            if (row.status === 'ja_lancada' && row.fuelingIds?.length) {
                for (const fid of row.fuelingIds) await db.update('fuelings', { id: fid, nfeChave: null });
            }
            await this.setStatus(id, 'pendente', null);
            Utils.showToast('Nota voltou para pendentes', 'success');
            await this.load();
        } catch (e) { console.error(e); Utils.showToast('Erro: ' + e.message, 'error'); }
    },

    async uploadFiles(files) {
        const res = { nova: 0, repetida: 0, outras: [] };
        for (const file of files) {
            const { data, error } = await supabase.rpc('nfe_upload', { p_xml: await file.text() });
            if (error) res.outras.push(`${file.name}: ${error.message}`);
            else if (data === 'nova' || data === 'repetida') res[data]++;
            else res.outras.push(`${file.name}: ${data}`);
        }
        document.getElementById('nfe-file').value = '';
        Utils.showToast(`${res.nova} nova(s), ${res.repetida} já existia(m)${res.outras.length ? `, ${res.outras.length} recusada(s)` : ''}`, res.outras.length ? 'warning' : 'success');
        if (res.outras.length) console.warn('Notas recusadas:', res.outras);
        this._tab = 'pendente';
        await this.render();
    },
};
