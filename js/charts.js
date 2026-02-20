// ===== CHART ENGINE =====
// Canvas-based chart library for dashboard visualizations

const ChartEngine = {
    // Draw a bar chart
    drawBarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = (options.height || 300) * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = (options.height || 300) + 'px';
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = options.height || 300;
        const padding = { top: 30, right: 20, bottom: 50, left: 70 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        if (!data || data.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados para exibir', w / 2, h / 2);
            return;
        }

        const maxVal = Math.max(...data.flatMap(d => d.values || [d.value])) * 1.15;
        const seriesCount = data[0].values ? data[0].values.length : 1;
        const barGroupWidth = chartW / data.length;
        const barWidth = Math.min((barGroupWidth * 0.7) / seriesCount, 40);
        const colors = options.colors || Utils.getChartColors();

        // Grid lines
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            // Y-axis labels
            const val = maxVal - (maxVal / gridLines) * i;
            ctx.fillStyle = '#64748b';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(Utils.formatNumber(val, 0), padding.left - 8, y + 4);
        }

        // Bars
        data.forEach((item, idx) => {
            const x = padding.left + barGroupWidth * idx + barGroupWidth / 2;
            const values = item.values || [item.value];

            values.forEach((val, sIdx) => {
                const barH = (val / maxVal) * chartH;
                const barX = x - (seriesCount * barWidth) / 2 + sIdx * barWidth;
                const barY = padding.top + chartH - barH;

                // Bar gradient
                const gradient = ctx.createLinearGradient(0, barY, 0, barY + barH);
                const color = colors[sIdx % colors.length];
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, color + '88');
                ctx.fillStyle = gradient;

                // Rounded top
                const radius = Math.min(4, barWidth / 2);
                ctx.beginPath();
                ctx.moveTo(barX, barY + barH);
                ctx.lineTo(barX, barY + radius);
                ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
                ctx.lineTo(barX + barWidth - radius, barY);
                ctx.quadraticCurveTo(barX + barWidth, barY, barX + barWidth, barY + radius);
                ctx.lineTo(barX + barWidth, barY + barH);
                ctx.closePath();
                ctx.fill();
            });

            // X-axis labels
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, x, h - padding.bottom + 18);
        });

        // Legend
        if (options.legend && seriesCount > 1) {
            let lx = padding.left;
            options.legend.forEach((label, i) => {
                ctx.fillStyle = colors[i % colors.length];
                ctx.fillRect(lx, 6, 12, 12);
                ctx.fillStyle = '#94a3b8';
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(label, lx + 18, 16);
                lx += ctx.measureText(label).width + 36;
            });
        }
    },

    // Draw a donut/pie chart
    drawDonutChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.parentElement.getBoundingClientRect();
        const size = Math.min(rect.width, options.height || 280);
        canvas.width = rect.width * dpr;
        canvas.height = (options.height || 280) * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = (options.height || 280) + 'px';
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = options.height || 280;

        ctx.clearRect(0, 0, w, h);

        if (!data || data.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados', w / 2, h / 2);
            return;
        }

        const total = data.reduce((s, d) => s + d.value, 0);
        if (total === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados', w / 2, h / 2);
            return;
        }

        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) - 40;
        const innerRadius = radius * (options.donut ? 0.6 : 0);
        const colors = options.colors || Utils.getChartColors();

        let startAngle = -Math.PI / 2;

        data.forEach((item, i) => {
            const sliceAngle = (item.value / total) * Math.PI * 2;
            const endAngle = startAngle + sliceAngle;

            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, endAngle);
            ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();

            // Label
            if (sliceAngle > 0.2) {
                const midAngle = startAngle + sliceAngle / 2;
                const labelR = radius + 20;
                const lx = cx + Math.cos(midAngle) * labelR;
                const ly = cy + Math.sin(midAngle) * labelR;
                ctx.fillStyle = '#94a3b8';
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
                const pct = ((item.value / total) * 100).toFixed(0) + '%';
                ctx.fillText(`${item.label} (${pct})`, lx, ly);
            }

            startAngle = endAngle;
        });

        // Center text for donut
        if (options.donut && options.centerText) {
            ctx.fillStyle = '#f1f5f9';
            ctx.font = 'bold 18px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(options.centerText, cx, cy - 4);
            if (options.centerSubtext) {
                ctx.fillStyle = '#94a3b8';
                ctx.font = '12px Inter, sans-serif';
                ctx.fillText(options.centerSubtext, cx, cy + 16);
            }
        }
    },

    // Draw a line chart
    drawLineChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = (options.height || 300) * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = (options.height || 300) + 'px';
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = options.height || 300;
        const padding = { top: 30, right: 20, bottom: 50, left: 70 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);

        if (!data || data.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sem dados', w / 2, h / 2);
            return;
        }

        const series = data[0].values ? data.map(() => []) : [[]];
        data.forEach(d => {
            if (d.values) {
                d.values.forEach((v, i) => series[i].push(v));
            } else {
                series[0].push(d.value);
            }
        });

        const allVals = series.flat();
        const maxVal = Math.max(...allVals) * 1.15;
        const colors = options.colors || Utils.getChartColors();

        // Grid
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartH / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            const val = maxVal - (maxVal / 5) * i;
            ctx.fillStyle = '#64748b';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(Utils.formatNumber(val, 0), padding.left - 8, y + 4);
        }

        // Lines
        series.forEach((s, sIdx) => {
            ctx.strokeStyle = colors[sIdx % colors.length];
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.beginPath();

            s.forEach((val, idx) => {
                const x = padding.left + (chartW / (data.length - 1 || 1)) * idx;
                const y = padding.top + chartH - (val / maxVal) * chartH;
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Area fill
            const lastX = padding.left + chartW;
            ctx.lineTo(lastX, padding.top + chartH);
            ctx.lineTo(padding.left, padding.top + chartH);
            ctx.closePath();
            ctx.fillStyle = colors[sIdx % colors.length] + '15';
            ctx.fill();

            // Dots
            s.forEach((val, idx) => {
                const x = padding.left + (chartW / (data.length - 1 || 1)) * idx;
                const y = padding.top + chartH - (val / maxVal) * chartH;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = colors[sIdx % colors.length];
                ctx.fill();
                ctx.strokeStyle = '#0a0e1a';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        });

        // X-axis labels
        data.forEach((d, idx) => {
            const x = padding.left + (chartW / (data.length - 1 || 1)) * idx;
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(d.label, x, h - padding.bottom + 18);
        });

        // Legend
        if (options.legend) {
            let lx = padding.left;
            options.legend.forEach((label, i) => {
                ctx.fillStyle = colors[i % colors.length];
                ctx.fillRect(lx, 6, 12, 12);
                ctx.fillStyle = '#94a3b8';
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(label, lx + 18, 16);
                lx += ctx.measureText(label).width + 36;
            });
        }
    }
};
