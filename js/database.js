// ===== DATABASE MODULE (SUPABASE VERSION) =====
// Replaces IndexedDB with Supabase (PostgreSQL + RLS)

class FrotaDatabase {
    constructor() {
        this.userId = null;
    }

    async init() {
        // Init is called in App.init(). 
        // We verify auth session here.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            this.userId = session.user.id;
            return true;
        }
        return false;
    }

    setUserId(uid) {
        this.userId = uid;
    }

    // ===== GENERIC CRUD =====

    async add(storeName, data) {
        // Remove 'id' if it's auto-increment (null/undefined) so Postgres generates it
        // BUT Supabase returns the new ID, so we must return it.
        const payload = { ...data };
        if (!payload.id) delete payload.id;

        // Settings is special case (key-value)
        if (storeName === 'settings') {
            return this.setSetting(data.key, data.value);
        }

        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'driverClosings' ? 'driver_closings' :
                                storeName === 'truckClosings' ? 'truck_closings' :
                                    storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                        storeName === 'tires' ? 'tires' :
                                            storeName === 'tiresHistory' ? 'tires_history' :
                                                storeName;

        const { data: inserted, error } = await supabase
            .from(table)
            .insert(payload)
            .select()
            .single();

        if (error) { console.error(`Error adding to ${storeName}:`, error); throw error; }
        return inserted.id; // Return ID to match IndexedDB behavior (mostly)
    }

    async update(storeName, data) {
        if (storeName === 'settings') {
            return this.setSetting(data.key, data.value);
        }

        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'driverClosings' ? 'driver_closings' :
                                storeName === 'truckClosings' ? 'truck_closings' :
                                    storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                        storeName === 'tires' ? 'tires' :
                                            storeName === 'tiresHistory' ? 'tires_history' :
                                                storeName;

        const { data: updated, error } = await supabase
            .from(table)
            .update(data)
            .eq('id', data.id)
            .select();

        if (error) { console.error(`Error updating ${storeName}:`, error); throw error; }
        return data.id;
    }

    async delete(storeName, id) {
        if (storeName === 'settings') {
            const { error } = await supabase.from('settings').delete().eq('key', id);
            if (error) throw error;
            return;
        }

        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'driverClosings' ? 'driver_closings' :
                                storeName === 'truckClosings' ? 'truck_closings' :
                                    storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                        storeName === 'tires' ? 'tires' :
                                            storeName === 'tiresHistory' ? 'tires_history' :
                                                storeName;

        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) { console.error(`Error deleting from ${storeName}:`, error); throw error; }
    }

    async getById(storeName, id) {
        if (storeName === 'settings') return { key: id, value: await this.getSetting(id) };

        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'driverClosings' ? 'driver_closings' :
                                storeName === 'truckClosings' ? 'truck_closings' :
                                    storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                        storeName === 'tires' ? 'tires' :
                                            storeName === 'tiresHistory' ? 'tires_history' :
                                                storeName;

        const { data, error } = await supabase.from(table).select().eq('id', id).single();
        if (error) return null; // Not found or error
        return data;
    }

    async getAll(storeName) {
        // Settings: transform back to array of {key, value}
        if (storeName === 'settings') {
            const { data, error } = await supabase.from('settings').select('*');
            if (error) return [];
            return data.map(r => ({ key: r.key, value: r.value }));
        }

        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'driverClosings' ? 'driver_closings' :
                                storeName === 'truckClosings' ? 'truck_closings' :
                                    storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                        storeName === 'tires' ? 'tires' :
                                            storeName === 'tiresHistory' ? 'tires_history' :
                                                storeName;

        const { data, error } = await supabase.from(table).select('*');
        if (error) { console.error(`Error getting all ${storeName}:`, error); return []; }
        return data;
    }

    async getByIndex(storeName, indexName, value) {
        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                storeName === 'tires' ? 'tires' :
                                    storeName === 'tiresHistory' ? 'tires_history' :
                                        storeName;

        // Composite keys (simulated in IndexedDB with arrays) are tricky.
        // If indexName is array like ['truckId', 'data'], Supabase needs separate .eq() calls?
        // Actually, the original code used 'truckId', 'data' as index names. 
        // If indexName is a string but represents a composite index name in IDB (e.g. 'truckId_data'),
        // we need to handle it. But typically getByIndex is called with specific value.
        // Wait, IDB `index` can be on multiple columns.

        // Let's look at usage. 
        // update: `getByIndex` was used mainly for: 
        // 'trucks' -> 'placa'
        // 'fuelings' -> 'truckId'
        // 'freights' -> 'truckId'
        // 'fines' -> 'truckId'
        // 'users' -> 'truckId'

        // If indexName is 'truckId_mesAno', value is [truckId, mes, ano]

        let query = supabase.from(table).select('*');
        if (Array.isArray(value) && indexName.includes('_')) {
            // Assume composite key logic
            const parts = indexName.split('_');
            if (parts.length === value.length) {
                parts.forEach((part, i) => {
                    query = query.eq(part, value[i]);
                });
            }
        } else {
            query = query.eq(indexName, value);
        }

        const { data, error } = await query;
        if (error) { console.error(`Error getByIndex ${storeName}:`, error); return []; }
        return data;
    }

    async count(storeName) {
        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                storeName === 'tires' ? 'tires' :
                                    storeName === 'tiresHistory' ? 'tires_history' :
                                        storeName;
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (error) return 0;
        return count;
    }

    async clear(storeName) {
        // DANGEROUS: Deletes ALL rows for this user
        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                storeName === 'tires' ? 'tires' :
                                    storeName === 'tiresHistory' ? 'tires_history' :
                                        storeName;
        await supabase.from(table).delete().neq('id', 0); // Hack to delete all? neq id 0 checks all.
    }

    async bulkAdd(storeName, items) {
        const table = storeName === 'users' ? 'app_users' :
            storeName === 'truckExpenses' ? 'truck_expenses' :
                storeName === 'driverExpenses' ? 'driver_expenses' :
                    storeName === 'driverBonuses' ? 'driver_bonuses' :
                        storeName === 'driverDiscounts' ? 'driver_discounts' :
                            storeName === 'maintenancePlans' ? 'maintenance_plans' :
                                storeName === 'tires' ? 'tires' :
                                    storeName === 'tiresHistory' ? 'tires_history' :
                                        storeName;
        // Strip IDs
        const payload = items.map(i => {
            const c = { ...i };
            if (!c.id) delete c.id;
            return c;
        });

        const { data, error } = await supabase.from(table).insert(payload).select();
        if (error) return { added: 0, errors: [error] };
        return { added: data.length, errors: [] };
    }

    // ===== SETTINGS =====

    async getSetting(key) {
        const { data, error } = await supabase.from('settings').select('value').eq('key', key).single();
        if (error || !data) return null;
        return data.value;
    }

    async setSetting(key, value) {
        // Upsert
        const { error } = await supabase.from('settings').upsert({ key, value });
        if (error) throw error;
    }

    // ===== BUSINESS LOGIC HELPERS (Keep EXACT logic but await DB calls) =====

    // Copy-paste business logic methods from original file
    // They use `this.getSetting`, `this.getByIndex`, etc. so they work transparently.

    async getKmRates() {
        const rates = await this.getSetting('kmRates');
        return rates || { carregado: 0, vazio: 0 };
    }

    async setKmRates(carregado, vazio) {
        return await this.setSetting('kmRates', { carregado, vazio });
    }

    async getKmRatesForTruck(truckId) {
        const globalRates = await this.getKmRates();
        if (!truckId) return globalRates;
        const truck = await this.getById('trucks', truckId);
        if (!truck) return globalRates;
        // In SQL columns: kmCarregado, kmVazio
        return {
            carregado: (truck.kmCarregado !== null && truck.kmCarregado !== undefined) ? truck.kmCarregado : globalRates.carregado,
            vazio: (truck.kmVazio !== null && truck.kmVazio !== undefined) ? truck.kmVazio : globalRates.vazio,
            isCustom: (truck.kmCarregado !== null && truck.kmCarregado !== undefined) || (truck.kmVazio !== null && truck.kmVazio !== undefined)
        };
    }

    async getCommissionConfig() {
        const config = await this.getSetting('commissionConfig');
        return config || {
            salarioFixo: 0,
            comissaoKmCarregado: 0,
            comissaoKmVazio: 0,
            faixasPremioMedia: []
        };
    }

    async setCommissionConfig(config) {
        return await this.setSetting('commissionConfig', config);
    }

    calcPremioMedia(mediaKmL, faixas) {
        if (!faixas || faixas.length === 0 || mediaKmL <= 0) return { premio: 0, faixaAtingida: null };
        const sorted = [...faixas].sort((a, b) => a.minMedia - b.minMedia);
        let premio = 0;
        let faixaAtingida = null;
        for (const faixa of sorted) {
            if (mediaKmL >= faixa.minMedia) {
                premio = faixa.premio;
                faixaAtingida = faixa;
            }
        }
        return { premio, faixaAtingida };
    }

    // ===== HELPER METHODS =====

    async getTruckByPlaca(placa) {
        const results = await this.getByIndex('trucks', 'placa', placa.toUpperCase());
        return results[0] || null;
    }

    async getFuelingsByTruck(truckId) { return await this.getByIndex('fuelings', 'truckId', truckId); }
    async getFreightsByTruck(truckId) { return await this.getByIndex('freights', 'truckId', truckId); }
    async getFinesByTruck(truckId) { return await this.getByIndex('fines', 'truckId', truckId); }
    async getClosingsByTruck(truckId) { return await this.getByIndex('closings', 'truckId', truckId); }

    async getDataByTruckAndMonth(storeName, truckId, mes, ano) {
        const items = await this.getByIndex(storeName, 'truckId', truckId);
        return items.filter(item => { const d = new Date(item.data); return d.getMonth() + 1 === mes && d.getFullYear() === ano; });
    }

    async getDataByUserAndMonth(storeName, userId, mes, ano) {
        const items = await this.getByIndex(storeName, 'userId', userId);
        return items.filter(item => { const d = new Date(item.data); return d.getMonth() + 1 === mes && d.getFullYear() === ano; });
    }

    async getDataByTruckAndDateRange(storeName, truckId, dataInicio, dataFim) {
        const items = await this.getByIndex(storeName, 'truckId', truckId);
        return items.filter(item => item.data >= dataInicio && item.data <= dataFim);
    }

    async getDataByUserAndDateRange(storeName, userId, dataInicio, dataFim) {
        const items = await this.getByIndex(storeName, 'userId', userId);
        return items.filter(item => item.data >= dataInicio && item.data <= dataFim);
    }

    async getDriverForTruck(truckId) {
        const users = await this.getByIndex('users', 'truckId', truckId);
        return users.find(u => u.role === 'motorista') || null;
    }

    async getTruckForDriver(userId) {
        const user = await this.getById('users', userId);
        if (!user || !user.truckId) return null;
        return await this.getById('trucks', user.truckId);
    }

    // ===== TRUCK FIXED EXPENSES =====
    async getTruckFixedExpenses(truckId) {
        const key = `truckFixedExpenses_${truckId}`;
        const data = await this.getSetting(key);
        return data || [];
    }

    async setTruckFixedExpenses(truckId, items) {
        const key = `truckFixedExpenses_${truckId}`;
        return await this.setSetting(key, items);
    }

    // ===== DRIVER CLOSINGS: Save & Query =====

    async saveDriverClosing(closingData) {
        const totalSemVales = parseFloat(((closingData.totalPagar || 0) + (closingData.totalDiscounts || 0)).toFixed(2));
        const payload = {
            driverId: closingData.userId,
            truckId: closingData.truckId || null,
            driverName: closingData.userName,
            dataInicio: closingData.dataInicio,
            dataFim: closingData.dataFim,
            salarioFixo: closingData.salarioFixo || 0,
            salarioFixoBase: closingData.salarioFixoBase || 0,
            diasTrabalhados: closingData.diasTrabalhados || 0,
            diasNoMes: closingData.diasNoMes || 0,
            totalComissaoKm: closingData.totalComissaoKm || 0,
            totalComissaoFechado: closingData.totalComissaoFechado || 0,
            premioMedia: closingData.premioMedia || 0,
            totalExpenses: closingData.totalExpenses || 0,
            totalBonuses: closingData.totalBonuses || 0,
            totalDiscounts: closingData.totalDiscounts || 0,
            totalPagar: closingData.totalPagar || 0,
            totalSemVales,
            geradoEm: new Date().toISOString()
        };

        const existing = await this.getExistingDriverClosing(closingData.userId, closingData.dataInicio, closingData.dataFim);
        if (existing) {
            payload.id = existing.id;
            await this.update('driverClosings', payload);
            return { ...payload, replaced: true };
        } else {
            const id = await this.add('driverClosings', payload);
            return { ...payload, id, replaced: false };
        }
    }

    async getExistingDriverClosing(driverId, dataInicio, dataFim) {
        const { data, error } = await supabase
            .from('driver_closings')
            .select('*')
            .eq('driverId', driverId)
            .eq('dataInicio', dataInicio)
            .eq('dataFim', dataFim)
            .maybeSingle();
        if (error) return null;
        return data;
    }

    async getDriverClosingsByDriver(driverId) {
        const { data, error } = await supabase
            .from('driver_closings')
            .select('*')
            .eq('driverId', driverId)
            .order('dataInicio', { ascending: false });
        if (error) return [];
        return data || [];
    }

    async getDriverClosingForTruck(truckId, mes, ano) {
        const monthStr = `${ano}-${String(mes).padStart(2, '0')}`;
        const { data, error } = await supabase
            .from('driver_closings')
            .select('*')
            .eq('truckId', truckId)
            .gte('dataInicio', `${monthStr}-01`)
            .lte('dataInicio', `${monthStr}-31`)
            .order('created_at', { ascending: false })
            .limit(1);
        if (error || !data || !data.length) return null;
        return data[0];
    }

    // ===== TRUCK CLOSINGS: Save & Query =====

    async saveTruckClosing(closingData) {
        const payload = {
            truckId: closingData.truckId,
            placa: closingData.placa || '',
            mes: closingData.mes,
            ano: closingData.ano,
            totalAbastecimento: closingData.totalAbastecimento || 0,
            totalFretes: closingData.totalFretes || 0,
            totalMultas: closingData.totalMultas || 0,
            totalDespesas: closingData.totalDespesas || 0,
            totalDespesasFixas: closingData.totalDespesasFixas || 0,
            totalSalarioMotorista: closingData.totalSalarioMotorista || 0,
            saldo: closingData.saldo || 0,
            mediaConsumo: closingData.mediaConsumo || 0,
            totalLitros: closingData.totalLitros || 0,
            totalKm: closingData.totalKm || 0,
            driverName: closingData.driverClosingInfo?.driverName || null,
            driverClosingId: closingData.driverClosingInfo?.id || null,
            geradoEm: new Date().toISOString()
        };

        const existing = await this.getExistingTruckClosing(closingData.truckId, closingData.mes, closingData.ano);
        if (existing) {
            payload.id = existing.id;
            await this.update('truckClosings', payload);
            return { ...payload, replaced: true };
        } else {
            const id = await this.add('truckClosings', payload);
            return { ...payload, id, replaced: false };
        }
    }

    async getExistingTruckClosing(truckId, mes, ano) {
        const { data, error } = await supabase
            .from('truck_closings')
            .select('*')
            .eq('truckId', truckId)
            .eq('mes', mes)
            .eq('ano', ano)
            .maybeSingle();
        if (error) return null;
        return data;
    }

    async getSavedTruckClosings(truckId) {
        const { data, error } = await supabase
            .from('truck_closings')
            .select('*')
            .eq('truckId', truckId)
            .order('ano', { ascending: false })
            .order('mes', { ascending: false });
        if (error) return [];
        return data || [];
    }

    // Core Business Logic: Monthly Closing
    async generateMonthlyClosing(truckId, mes, ano) {
        const fuelings = await this.getDataByTruckAndMonth('fuelings', truckId, mes, ano);
        const freights = await this.getDataByTruckAndMonth('freights', truckId, mes, ano);
        const fines = await this.getDataByTruckAndMonth('fines', truckId, mes, ano);
        const expenses = await this.getDataByTruckAndMonth('truckExpenses', truckId, mes, ano);
        const truck = await this.getById('trucks', truckId);

        // Fixed expenses (recurring monthly)
        const fixedExpenses = await this.getTruckFixedExpenses(truckId);
        const totalDespesasFixas = fixedExpenses.reduce((s, f) => s + (f.valor || 0), 0);

        const prevDate = new Date(ano, mes - 2, 1);
        const prevMes = prevDate.getMonth() + 1; // JS month 0-11
        const prevAno = prevDate.getFullYear();
        const prevFuelings = await this.getDataByTruckAndMonth('fuelings', truckId, prevMes, prevAno);
        const fuelingsForMedia = [...prevFuelings.map(f => ({ ...f, _prevMonth: true })), ...fuelings];

        const totalAbastecimento = fuelings.reduce((s, f) => s + (f.valorTotal || 0), 0);
        const totalFretes = freights.reduce((s, f) => s + (f.valorFrete || 0), 0);
        const totalMultas = fines.reduce((s, f) => s + (f.valor || 0), 0);
        const totalDespesas = expenses.reduce((s, f) => s + (f.valor || 0), 0);

        const totalLitros = fuelings.filter(f => f.tipoComb !== 'Arla').reduce((s, f) => s + (f.litros || 0), 0);
        const totalKmFretes = freights.reduce((s, f) => s + (f.km || 0), 0);

        // Media calculation: sort fuelings with KM, use (last KM - first KM) / (liters excluding first fueling)
        const allFuelMedia = fuelingsForMedia.filter(f => f.km > 0 && f.tipoComb !== 'Arla').sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.km - b.km));
        let totalKm = 0, litrosMedia = 0;
        if (allFuelMedia.length >= 2) {
            totalKm = allFuelMedia[allFuelMedia.length - 1].km - allFuelMedia[0].km;
            litrosMedia = allFuelMedia.slice(1).reduce((s, f) => s + (f.litros || 0), 0);
        }
        const mediaConsumo = totalKm > 0 && litrosMedia > 0 ? parseFloat((totalKm / litrosMedia).toFixed(2)) : 0;

        // Look for saved driver closing for this truck in this month
        const driverClosingInfo = await this.getDriverClosingForTruck(truckId, mes, ano);
        const totalSalarioMotorista = driverClosingInfo ? (driverClosingInfo.totalSemVales || 0) : 0;

        const closing = {
            truckId, placa: truck?.placa || '', mes, ano,
            totalAbastecimento, totalFretes, totalMultas, totalDespesas, totalDespesasFixas,
            fixedExpenses,
            totalSalarioMotorista, driverClosingInfo,
            totalLitros, totalKm, totalKmFretes,
            mediaConsumo: totalKm > 0 && totalLitros > 0 ? parseFloat((totalKm / totalLitros).toFixed(2)) : 0,
            saldo: totalFretes - totalAbastecimento - totalMultas - totalDespesas - totalDespesasFixas - totalSalarioMotorista,
            qtdAbastecimentos: fuelings.length, qtdFretes: freights.length, qtdMultas: fines.length, qtdDespesas: expenses.length,
            fuelings: fuelings,
            fuelingsForMedia: fuelingsForMedia,
            geradoEm: new Date().toISOString()
        };

        return closing;
    }

    async generateDriverClosing(userId, mes, ano, diasTrabalhados) {
        // Legacy wrapper — builds date range from month/year
        const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const lastDay = new Date(ano, mes, 0).getDate();
        const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return this.generateDriverClosingByDateRange(userId, dataInicio, dataFim, diasTrabalhados);
    }

    async generateDriverClosingByDateRange(userId, dataInicio, dataFim, diasTrabalhados, diasNoMesOverride) {
        const user = await this.getById('users', userId);
        if (!user) return null;

        const truck = user.truckId ? await this.getById('trucks', user.truckId) : null;
        const commConfig = await this.getCommissionConfig();
        const rates = truck ? await this.getKmRatesForTruck(truck.id) : await this.getKmRates();

        // Calculate days in period and proportional salary
        const start = new Date(dataInicio + 'T00:00:00');
        const end = new Date(dataFim + 'T00:00:00');
        const diasNoPeriodo = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const diasNoMes = (diasNoMesOverride && diasNoMesOverride > 0) ? diasNoMesOverride : diasNoPeriodo;
        if (!diasTrabalhados || diasTrabalhados > diasNoMes) diasTrabalhados = diasNoMes;

        let freights = [], fuelings = [], fuelingsForMedia = [];
        if (truck) {
            freights = await this.getDataByTruckAndDateRange('freights', truck.id, dataInicio, dataFim);
            fuelings = await this.getDataByTruckAndDateRange('fuelings', truck.id, dataInicio, dataFim);
            // For media calculation, also include previous month fuelings
            const startDate = new Date(dataInicio + 'T00:00:00');
            const prevMonthStart = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
            const prevMonthEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
            const prevDataInicio = prevMonthStart.toISOString().split('T')[0];
            const prevDataFim = prevMonthEnd.toISOString().split('T')[0];
            const prevFuelings = await this.getDataByTruckAndDateRange('fuelings', truck.id, prevDataInicio, prevDataFim);
            fuelingsForMedia = [...prevFuelings.map(f => ({ ...f, _prevMonth: true })), ...fuelings];
        }

        const expenses = await this.getDataByUserAndDateRange('driverExpenses', userId, dataInicio, dataFim);
        const bonuses = await this.getDataByUserAndDateRange('driverBonuses', userId, dataInicio, dataFim);
        const discounts = await this.getDataByUserAndDateRange('driverDiscounts', userId, dataInicio, dataFim);

        const rateFreights = freights.filter(f => f.modalidade !== 'fechado');
        const fixedFreights = freights.filter(f => f.modalidade === 'fechado');

        const kmCarregado = rateFreights.filter(f => f.tipo === 'carregado').reduce((s, f) => s + (f.km || 0), 0);
        const kmVazio = rateFreights.filter(f => f.tipo === 'vazio').reduce((s, f) => s + (f.km || 0), 0);
        const valorKmCarregado = kmCarregado * rates.carregado;
        const valorKmVazio = kmVazio * rates.vazio;

        const totalFreteFechado = fixedFreights.reduce((s, f) => s + (f.valorFrete || 0), 0);
        const totalComissaoFechado = fixedFreights.reduce((s, f) => s + (f.comissaoFechado || f.valorFrete || 0), 0);
        const kmFreteFechado = fixedFreights.reduce((s, f) => s + (f.km || 0), 0);

        const pctCarregado = user.comKmCarregado !== null && user.comKmCarregado !== undefined ? user.comKmCarregado : commConfig.comissaoKmCarregado;
        const pctVazio = user.comKmVazio !== null && user.comKmVazio !== undefined ? user.comKmVazio : commConfig.comissaoKmVazio;
        const salarioFixoBase = user.salarioFixo || commConfig.salarioFixo;

        // Proportional salary: if driver didn't work full month
        const salarioFixo = diasTrabalhados < diasNoMes
            ? parseFloat((salarioFixoBase * (diasTrabalhados / diasNoMes)).toFixed(2))
            : salarioFixoBase;

        const comissaoCarregado = valorKmCarregado * (pctCarregado / 100);
        const comissaoVazio = valorKmVazio * (pctVazio / 100);
        const totalComissaoKm = comissaoCarregado + comissaoVazio;

        // Fuel Efficiency
        const totalLitros = fuelings.filter(f => f.tipoComb !== 'Arla').reduce((s, f) => s + (f.litros || 0), 0);
        const kmValues = fuelings.filter(f => f.km > 0 && f.tipoComb !== 'Arla').map(f => f.km);
        const totalKm = kmValues.length >= 2 ? Math.max(...kmValues) - Math.min(...kmValues) : 0;
        const mediaKmL = totalKm > 0 && totalLitros > 0 ? totalKm / totalLitros : 0;
        const { premio: premioMedia, faixaAtingida } = this.calcPremioMedia(mediaKmL, commConfig.faixasPremioMedia);

        const totalExpenses = expenses.reduce((s, e) => s + (e.valor || 0), 0);
        const totalBonuses = bonuses.reduce((s, b) => s + (b.valor || 0), 0);
        const totalDiscounts = discounts.reduce((s, d) => s + (d.valor || 0), 0);

        const totalPagar = salarioFixo + totalComissaoKm + totalComissaoFechado + premioMedia + totalExpenses + totalBonuses - totalDiscounts;

        return {
            userId, userName: user.nome, userRole: user.role,
            truckId: truck?.id || null, placa: truck?.placa || '—',
            dataInicio, dataFim,
            salarioFixo, salarioFixoBase, diasTrabalhados, diasNoMes,
            kmCarregado, kmVazio, valorKmCarregado, valorKmVazio,
            pctCarregado, pctVazio,
            comissaoCarregado, comissaoVazio, totalComissaoKm,
            totalFreteFechado, totalComissaoFechado, kmFreteFechado, qtdFreteFechado: fixedFreights.length,
            totalLitros, totalKm, mediaKmL: parseFloat(mediaKmL.toFixed(2)),
            faixasPremioMedia: commConfig.faixasPremioMedia || [],
            faixaAtingida, premioMedia,
            expenses, totalExpenses,
            bonuses, totalBonuses,
            discounts, totalDiscounts,
            totalPagar,
            qtdFretes: freights.length,
            freights: freights.sort((a, b) => (a.data || '').localeCompare(b.data || '')), fuelings, fuelingsForMedia,
            rates, ratesIsCustom: rates.isCustom || false,
            geradoEm: new Date().toISOString()
        };
    }
}

// Global database instance
const db = new FrotaDatabase();
