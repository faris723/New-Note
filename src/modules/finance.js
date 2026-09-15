/**
 * Financial Management & Pure SVG Visualization Service
 * Computes financial metrics, debt settlement statuses,
 * and renders interactive, lightweight pure SVG charts without any external charting library.
 */

import { SecurityService } from './security.js';

export const FinanceService = {
  formatRupiah(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
    return 'Rp ' + Number(amount).toLocaleString('id-ID');
  },

  formatCompactRupiah(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'M';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'jt';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'rb';
    return String(num);
  },

  calculateTotals(notes, fromDate = null, toDate = null) {
    let income = 0;
    let expense = 0;
    let debtUnpaid = 0;
    let debtPaid = 0;
    const transactions = [];

    const fromTs = fromDate ? new Date(fromDate + 'T00:00:00').getTime() : null;
    const toTs = toDate ? new Date(toDate + 'T23:59:59').getTime() : null;

    notes.forEach(note => {
      if (note.category !== 'keuangan' || !note.finance || !note.finance.amount) return;

      const dateTs = note.updatedAt || note.createdAt;
      if (fromTs && dateTs < fromTs) return;
      if (toTs && dateTs > toTs) return;

      const amount = Number(note.finance.amount) || 0;
      const type = note.finance.type || 'expense';

      if (type === 'income') {
        income += amount;
      } else if (type === 'expense') {
        expense += amount;
      } else if (type === 'debt') {
        if (note.finance.debtPaid) {
          debtPaid += amount;
        } else {
          debtUnpaid += amount;
        }
      }

      transactions.push({
        noteId: note.id,
        title: note.title || 'Catatan Keuangan',
        date: dateTs,
        type,
        amount,
        debtTo: note.finance.debtTo || '',
        debtPurpose: note.finance.debtPurpose || '',
        debtPaid: !!note.finance.debtPaid
      });
    });

    // Sort transactions newest first
    transactions.sort((a, b) => b.date - a.date);

    return {
      income,
      expense,
      debtUnpaid,
      debtPaid,
      balance: income - expense,
      transactions
    };
  },

  /**
   * Render Pure SVG Donut Chart for Cash Flow Proportions
   */
  renderDonutChart(containerEl, totals) {
    if (!containerEl) return;
    const { income, expense, debtUnpaid } = totals;
    const totalFlow = income + expense + debtUnpaid;

    if (totalFlow === 0) {
      containerEl.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--ink-soft); font-size:12px; text-align:center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:6px; opacity:0.5;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Belum ada transaksi tercatat pada rentang tanggal ini.
        </div>
      `;
      return;
    }

    const size = 160;
    const center = size / 2;
    const radius = 62;
    const innerRadius = 42;

    const data = [
      { label: 'Pemasukan', value: income, color: '#47593f' },
      { label: 'Pengeluaran', value: expense, color: '#a3402f' },
      { label: 'Hutang Aktif', value: debtUnpaid, color: '#b8922f' }
    ].filter(d => d.value > 0);

    let startAngle = 0;
    let paths = '';

    data.forEach(item => {
      const sliceAngle = (item.value / totalFlow) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      const x1 = center + radius * Math.cos(startAngle - Math.PI / 2);
      const y1 = center + radius * Math.sin(startAngle - Math.PI / 2);
      const x2 = center + radius * Math.cos(endAngle - Math.PI / 2);
      const y2 = center + radius * Math.sin(endAngle - Math.PI / 2);

      const ix1 = center + innerRadius * Math.cos(endAngle - Math.PI / 2);
      const iy1 = center + innerRadius * Math.sin(endAngle - Math.PI / 2);
      const ix2 = center + innerRadius * Math.cos(startAngle - Math.PI / 2);
      const iy2 = center + innerRadius * Math.sin(startAngle - Math.PI / 2);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
        'Z'
      ].join(' ');

      paths += `<path d="${pathData}" fill="${item.color}" opacity="0.9" style="transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.9'"><title>${item.label}: ${FinanceService.formatRupiah(item.value)} (${Math.round((item.value / totalFlow) * 100)}%)</title></path>`;

      startAngle = endAngle;
    });

    const netBalanceText = this.formatCompactRupiah(Math.abs(totals.balance));
    const balanceSign = totals.balance >= 0 ? '+' : '-';
    const balanceColor = totals.balance >= 0 ? 'var(--moss)' : 'var(--danger)';

    const svg = `
      <div style="display:flex; flex-direction:column; align-items:center;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          ${paths}
          <text x="${center}" y="${center - 4}" text-anchor="middle" font-size="10" fill="var(--ink-soft)" font-family="sans-serif">Saldo</text>
          <text x="${center}" y="${center + 12}" text-anchor="middle" font-size="12" font-weight="700" fill="${balanceColor}" font-family="'IBM Plex Mono', monospace">${balanceSign}Rp ${netBalanceText}</text>
        </svg>
        <div class="chart-legend" style="margin-top:8px;">
          ${data.map(d => `
            <div class="legend-item">
              <span class="legend-dot" style="background:${d.color};"></span>
              <span>${d.label}: <b>${Math.round((d.value / totalFlow) * 100)}%</b></span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    containerEl.innerHTML = svg;
  },

  /**
   * Render Pure SVG Bar Chart for Comparative Values
   */
  renderBarChart(containerEl, totals) {
    if (!containerEl) return;
    const { income, expense, debtUnpaid } = totals;
    const maxVal = Math.max(income, expense, debtUnpaid, 1);

    const width = 230;
    const height = 140;
    const barWidth = 38;
    const bottomY = 110;
    const chartHeight = 85;

    const bars = [
      { label: 'Pemasukan', val: income, color: '#47593f', x: 22 },
      { label: 'Pengeluaran', val: expense, color: '#a3402f', x: 96 },
      { label: 'Hutang', val: debtUnpaid, color: '#b8922f', x: 170 }
    ];

    let svgBars = '';
    bars.forEach(b => {
      const h = b.val > 0 ? Math.max(6, Math.round((b.val / maxVal) * chartHeight)) : 2;
      const y = bottomY - h;
      const compactText = b.val > 0 ? this.formatCompactRupiah(b.val) : '0';

      svgBars += `
        <!-- Value Label -->
        <text x="${b.x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--ink)" font-family="'IBM Plex Mono', monospace">${compactText}</text>
        <!-- Bar Rect with rounded top corners -->
        <rect x="${b.x}" y="${y}" width="${barWidth}" height="${h}" rx="3" fill="${b.color}" opacity="0.88">
          <title>${b.label}: ${FinanceService.formatRupiah(b.val)}</title>
        </rect>
        <!-- Category Label -->
        <text x="${b.x + barWidth / 2}" y="${bottomY + 16}" text-anchor="middle" font-size="10" fill="var(--ink-soft)" font-family="sans-serif">${b.label}</text>
      `;
    });

    const svg = `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block; margin:0 auto;">
        <!-- Base line axis -->
        <line x1="10" y1="${bottomY}" x2="${width - 10}" y2="${bottomY}" stroke="var(--card-edge)" stroke-width="1.5" />
        ${svgBars}
      </svg>
    `;

    containerEl.innerHTML = svg;
  }
};
