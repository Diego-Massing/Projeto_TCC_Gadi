// ===== UTILITY MODULE =====

const Utils = {
    // Format currency (BRL)
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    },

    // Format number
    formatNumber(value, decimals = 0) {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(value || 0);
    },

    // Format date
    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('pt-BR');
    },

    // Format date for input
    formatDateInput(dateStr) {
        if (!dateStr) return '';
        if (dateStr.includes('T')) return dateStr.split('T')[0];
        return dateStr;
    },

    // Get month name
    getMonthName(month) {
        const months = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return months[month - 1] || '';
    },

    // Get current month/year
    getCurrentMonth() {
        const now = new Date();
        return { mes: now.getMonth() + 1, ano: now.getFullYear() };
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Debounce
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    // Parse CSV
    parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) return { headers: [], rows: [] };

        const delimiter = text.includes(';') ? ';' : ',';

        function parseLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        }

        const headers = parseLine(lines[0]);
        const rows = lines.slice(1).map(line => {
            const values = parseLine(line);
            const row = {};
            headers.forEach((h, i) => {
                row[h] = values[i] || '';
            });
            return row;
        });

        return { headers, rows };
    },

    // Parse number from string (handles Brazilian format)
    parseNumber(str) {
        if (typeof str === 'number') return str;
        if (!str) return 0;
        str = String(str).trim().toUpperCase();
        // Return 0 for X or empty
        if (str === 'X' || str === '-' || str === '') return 0;
        // Remove R$ prefix, L suffix, KM suffix, spaces
        str = str.replace(/R\$\s*/g, '').replace(/\s*L$/i, '').replace(/\s*KM$/i, '').replace(/\s+/g, '').trim();
        // Handle Brazilian format: 1.234,56
        if (str.includes(',') && str.includes('.')) {
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (str.includes(',')) {
            str = str.replace(',', '.');
        }
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    },

    // Parse date from various formats
    parseDate(str, defaultYear) {
        if (!str) return '';
        str = String(str).trim();
        // dd/mm/yyyy
        const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (brMatch) {
            return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
        }
        // dd/mm (no year) — use defaultYear or current year
        const shortMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
        if (shortMatch) {
            const year = defaultYear || new Date().getFullYear();
            return `${year}-${shortMatch[2].padStart(2, '0')}-${shortMatch[1].padStart(2, '0')}`;
        }
        // yyyy-mm-dd
        const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        return str;
    },

    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    // Get color palette for charts
    getChartColors() {
        return [
            '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
            '#10b981', '#34d399', '#3b82f6', '#60a5fa',
            '#f59e0b', '#fbbf24', '#ef4444', '#f87171',
            '#ec4899', '#f472b6', '#14b8a6', '#2dd4bf'
        ];
    },

    // Simple color by index
    getColor(index) {
        const colors = this.getChartColors();
        return colors[index % colors.length];
    },

    // Export data to CSV
    exportToCSV(data, filename) {
        if (!data || data.length === 0) return;

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(';'),
            ...data.map(row =>
                headers.map(h => {
                    let val = row[h] ?? '';
                    if (typeof val === 'string' && (val.includes(';') || val.includes('"') || val.includes('\n'))) {
                        val = '"' + val.replace(/"/g, '""') + '"';
                    }
                    return val;
                }).join(';')
            )
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
};
