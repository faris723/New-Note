/**
 * Generator Laporan Keuangan PDF Tertata (Catatan Pintar)
 * Menghasilkan PDF resmi berkualitas tinggi yang rapi, terstruktur,
 * mendukung pemilihan lingkup laporan secara spesifik (misal: hanya pengeluaran,
 * hanya pemasukan, hanya hutang, atau kustom), filter rentang tanggal, dan perhitungan otomatis.
 */

import { SecurityService } from './security.js';

const rupiah = (v) => 'Rp ' + Number(v || 0).toLocaleString('id-ID');

export const FinancePdfReportService = {
  /**
   * Menghasilkan Blob PDF laporan keuangan yang tertata rapi menggunakan jsPDF
   * atau HTML print-render fallback yang kompatibel jika jsPDF tidak tersedia.
   */
  async generateReport({
    reportScope = 'expense_only',
    reportTitle = '',
    fromDate = '',
    toDate = '',
    sections = {
      summary: true,
      txExpense: true,
      txIncome: false,
      debts: false,
      obligations: false,
      savings: false,
      history: false
    },
    expenseList = [],
    incomeList = [],
    debtList = [],
    obligationList = [],
    savingsList = [],
    historyList = [],
    summaryData = {}
  }) {
    // Tentukan judul laporan jika tidak ditentukan khusus
    let resolvedTitle = reportTitle;
    if (!resolvedTitle) {
      if (reportScope === 'expense_only' || (sections.txExpense && !sections.txIncome && !sections.debts && !sections.obligations && !sections.savings)) {
        resolvedTitle = 'LAPORAN TRANSAKSI PENGELUARAN';
      } else if (reportScope === 'income_only' || (sections.txIncome && !sections.txExpense && !sections.debts && !sections.obligations && !sections.savings)) {
        resolvedTitle = 'LAPORAN TRANSAKSI PEMASUKAN';
      } else if (reportScope === 'debt_only' || (sections.debts && !sections.txExpense && !sections.txIncome && !sections.obligations && !sections.savings)) {
        resolvedTitle = 'LAPORAN DAFTAR HUTANG & PELUNASAN';
      } else if (reportScope === 'obligation_only' || (sections.obligations && !sections.txExpense && !sections.txIncome && !sections.debts && !sections.savings)) {
        resolvedTitle = 'LAPORAN PENGELUARAN WAJIB';
      } else if (reportScope === 'savings_only' || (sections.savings && !sections.txExpense && !sections.txIncome && !sections.debts && !sections.obligations)) {
        resolvedTitle = 'LAPORAN POS TABUNGAN & ASET';
      } else if (reportScope === 'all_transactions' || (sections.txExpense && sections.txIncome && !sections.obligations && !sections.savings)) {
        resolvedTitle = 'LAPORAN TRANSAKSI KEUANGAN';
      } else {
        resolvedTitle = 'LAPORAN REKAPITULASI KEUANGAN';
      }
    }

    const payload = {
      reportScope,
      reportTitle: resolvedTitle,
      fromDate,
      toDate,
      sections,
      expenseList,
      incomeList,
      debtList,
      obligationList,
      savingsList,
      historyList,
      summaryData
    };

    const jsPDFClass = window.jspdf?.jsPDF || window.jsPDF;
    if (jsPDFClass) {
      return this._buildWithJsPdf(jsPDFClass, payload);
    }

    return this._buildFallbackPdf(payload);
  },

  _buildWithJsPdf(jsPDF, data) {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const checkPageBreak = (neededHeight) => {
      if (y + neededHeight > pageHeight - 16) {
        doc.addPage();
        y = margin;
        drawPageHeaderMini();
      }
    };

    const drawPageHeaderMini = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(90, 100, 95);
      doc.text(data.reportTitle, margin, y);
      const period = (data.fromDate || data.toDate) 
        ? `Periode: ${data.fromDate || 'Awal'} s/d ${data.toDate || 'Sekarang'}`
        : 'Semua Periode';
      doc.text(period, pageWidth - margin, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(215, 222, 215);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    // ================= HEADER UTAMA LAPORAN =================
    // Pilih warna latar header berdasarkan fokus laporan
    let headerBg = [39, 53, 43]; // Deep Forest Green default
    if (data.reportScope === 'expense_only' || (data.sections.txExpense && !data.sections.txIncome && !data.sections.debts)) {
      headerBg = [68, 38, 34]; // Dark Burgundy / Warm Maroon
    } else if (data.reportScope === 'income_only' || (data.sections.txIncome && !data.sections.txExpense)) {
      headerBg = [30, 64, 45]; // Dark Emerald
    } else if (data.reportScope === 'debt_only') {
      headerBg = [64, 50, 28]; // Warm Amber Dark
    }

    doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
    doc.roundedRect(margin, y, contentWidth, 25, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(data.reportTitle, margin + 6, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(230, 240, 230);

    const dateRangeStr = (data.fromDate || data.toDate)
      ? `Periode: ${data.fromDate ? data.fromDate : 'Awal'} s/d ${data.toDate ? data.toDate : 'Sekarang'}`
      : 'Periode: Semua Waktu';
    doc.text(dateRangeStr, margin + 6, y + 14);

    const printStr = `Dicetak: ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} | Aplikasi: Catatan Pintar`;
    doc.text(printStr, margin + 6, y + 19.5);

    y += 31;

    // ================= KOTAK STATISTIK / RINGKASAN =================
    if (data.sections.summary && data.summaryData) {
      const sum = data.summaryData;
      const isOnlyExpense = data.sections.txExpense && !data.sections.txIncome && !data.sections.debts && !data.sections.obligations && !data.sections.savings;
      const isOnlyIncome = data.sections.txIncome && !data.sections.txExpense && !data.sections.debts && !data.sections.obligations && !data.sections.savings;
      const isOnlyDebt = data.sections.debts && !data.sections.txExpense && !data.sections.txIncome && !data.sections.obligations && !data.sections.savings;

      checkPageBreak(25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(39, 53, 43);
      doc.text('Ringkasan Statistik', margin, y);
      y += 4.5;

      const drawBox = (x, yPos, w, h, title, val, sub, bgR, bgG, bgB, tR, tG, tB) => {
        doc.setFillColor(bgR, bgG, bgB);
        doc.setDrawColor(215, 220, 215);
        doc.roundedRect(x, yPos, w, h, 1.5, 1.5, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 100);
        doc.text(title, x + 3, yPos + 4.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(tR, tG, tB);
        doc.text(val, x + 3, yPos + 10.5);

        if (sub) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(120, 120, 120);
          doc.text(sub, x + 3, yPos + 15);
        }
      };

      if (isOnlyExpense) {
        // Fokus Pengeluaran: 4 Box (Total, Transaksi, Rata-rata, Terbesar)
        const boxW = (contentWidth - 9) / 4;
        const boxH = 17;
        drawBox(margin, y, boxW, boxH, 'Total Pengeluaran', rupiah(sum.expenseTotal), 'Akumulasi periode', 253, 242, 242, 163, 64, 47);
        drawBox(margin + (boxW + 3), y, boxW, boxH, 'Jumlah Transaksi', `${sum.expenseCount || 0} Data`, 'Total frekuensi', 248, 248, 246, 50, 50, 50);
        drawBox(margin + (boxW + 3) * 2, y, boxW, boxH, 'Rata-rata Pengeluaran', rupiah(sum.expenseAvg), 'Per transaksi', 246, 248, 252, 45, 80, 120);
        drawBox(margin + (boxW + 3) * 3, y, boxW, boxH, 'Pengeluaran Terbesar', rupiah(sum.expenseMax), sum.expenseMaxTitle || '-', 254, 248, 238, 140, 90, 30);
        y += boxH + 8;
      } else if (isOnlyIncome) {
        // Fokus Pemasukan: 4 Box
        const boxW = (contentWidth - 9) / 4;
        const boxH = 17;
        drawBox(margin, y, boxW, boxH, 'Total Pemasukan', rupiah(sum.incomeTotal), 'Akumulasi periode', 240, 249, 240, 34, 120, 48);
        drawBox(margin + (boxW + 3), y, boxW, boxH, 'Jumlah Transaksi', `${sum.incomeCount || 0} Data`, 'Total frekuensi', 248, 248, 246, 50, 50, 50);
        drawBox(margin + (boxW + 3) * 2, y, boxW, boxH, 'Rata-rata Pemasukan', rupiah(sum.incomeAvg), 'Per transaksi', 246, 248, 252, 45, 80, 120);
        drawBox(margin + (boxW + 3) * 3, y, boxW, boxH, 'Pemasukan Terbesar', rupiah(sum.incomeMax), sum.incomeMaxTitle || '-', 244, 252, 245, 30, 110, 40);
        y += boxH + 8;
      } else if (isOnlyDebt) {
        // Fokus Hutang
        const boxW = (contentWidth - 9) / 4;
        const boxH = 17;
        drawBox(margin, y, boxW, boxH, 'Total Hutang Tercatat', rupiah(sum.debtTotal), `${sum.debtCount || 0} Catatan`, 254, 249, 237, 140, 90, 30);
        drawBox(margin + (boxW + 3), y, boxW, boxH, 'Total Sudah Dilunasi', rupiah(sum.debtPaid), 'Cicil & Lunas', 240, 249, 240, 34, 120, 48);
        drawBox(margin + (boxW + 3) * 2, y, boxW, boxH, 'Sisa Belum Lunas', rupiah(sum.debtRemain), 'Kewajiban aktif', 253, 242, 242, 163, 64, 47);
        drawBox(margin + (boxW + 3) * 3, y, boxW, boxH, 'Rasio Pelunasan', `${sum.debtPaidRatio || 0}%`, 'Telah tertutup', 238, 246, 250, 39, 71, 82);
        y += boxH + 8;
      } else {
        // Gabungan / Komprehensif (6 Box)
        const boxW = (contentWidth - 6) / 3;
        const boxH = 14;
        drawBox(margin, y, boxW, boxH, 'Total Pemasukan', rupiah(sum.incomeTotal), null, 240, 249, 240, 34, 120, 48);
        drawBox(margin + boxW + 3, y, boxW, boxH, 'Total Pengeluaran', rupiah(sum.expenseTotal), null, 253, 242, 242, 163, 64, 47);
        drawBox(margin + (boxW + 3) * 2, y, boxW, boxH, 'Saldo Arus Kas (Net)', rupiah(sum.netBalance), null, 244, 248, 242, 47, 89, 63);
        y += boxH + 3;

        drawBox(margin, y, boxW, boxH, 'Sisa Hutang Aktif', rupiah(sum.debtRemain), null, 254, 249, 237, 150, 100, 30);
        drawBox(margin + boxW + 3, y, boxW, boxH, 'Sisa Kebutuhan Wajib', rupiah(sum.obligationRemain), null, 253, 248, 238, 120, 85, 25);
        drawBox(margin + (boxW + 3) * 2, y, boxW, boxH, 'Total Dana Tabungan', rupiah(sum.savingsTotal), null, 238, 246, 250, 39, 71, 82);
        y += boxH + 8;
      }
    }

    // Helper: Draw Table
    const drawTable = ({
      title,
      headers,
      rows,
      colWidths,
      alignments = [],
      totalRow = null,
      emptyMessage = 'Tidak ada catatan data pada periode ini.'
    }) => {
      checkPageBreak(25);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(39, 53, 43);
      doc.text(title, margin, y);
      y += 4.5;

      // Table Header
      doc.setFillColor(236, 241, 235);
      doc.setDrawColor(195, 204, 194);
      doc.rect(margin, y, contentWidth, 7, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(35, 45, 38);

      let currentX = margin;
      headers.forEach((h, idx) => {
        const w = colWidths[idx];
        const align = alignments[idx] || 'left';
        const posX = align === 'right' ? currentX + w - 2 : (align === 'center' ? currentX + w / 2 : currentX + 2);
        doc.text(h, posX, y + 4.5, { align });
        currentX += w;
      });
      y += 7;

      if (!rows.length) {
        checkPageBreak(9);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(emptyMessage, margin + 4, y + 5.5);
        y += 10;
        return;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      rows.forEach((row, rowIdx) => {
        checkPageBreak(7);
        if (rowIdx % 2 === 1) {
          doc.setFillColor(250, 251, 249);
          doc.rect(margin, y, contentWidth, 6.5, 'F');
        }
        doc.setDrawColor(230, 235, 228);
        doc.line(margin, y + 6.5, margin + contentWidth, y + 6.5);

        let rowX = margin;
        row.forEach((cell, cellIdx) => {
          const w = colWidths[cellIdx];
          const align = alignments[cellIdx] || 'left';
          const posX = align === 'right' ? rowX + w - 2 : (align === 'center' ? rowX + w / 2 : rowX + 2);

          const cellText = typeof cell === 'object' && cell !== null ? String(cell.text ?? '') : String(cell ?? '');
          const isBold = typeof cell === 'object' && cell?.bold;
          const color = typeof cell === 'object' && cell?.color ? cell.color : [45, 50, 45];

          doc.setTextColor(color[0], color[1], color[2]);
          if (isBold) doc.setFont('helvetica', 'bold');
          else doc.setFont('helvetica', 'normal');

          const safeText = doc.splitTextToSize(cellText, w - 3)[0] || '';
          doc.text(safeText, posX, y + 4.5, { align });
          rowX += w;
        });
        y += 6.5;
      });

      // Total Row jika ada
      if (totalRow) {
        checkPageBreak(8);
        doc.setFillColor(242, 246, 241);
        doc.setDrawColor(190, 200, 188);
        doc.rect(margin, y, contentWidth, 7, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(25, 40, 28);

        // Label Total di kiri (span)
        doc.text(totalRow.label, margin + 4, y + 4.8);

        // Value di kanan
        doc.setTextColor(totalRow.color ? totalRow.color[0] : 25, totalRow.color ? totalRow.color[1] : 40, totalRow.color ? totalRow.color[2] : 28);
        doc.text(totalRow.value, margin + contentWidth - 2, y + 4.8, { align: 'right' });
        y += 7;
      }

      y += 7;
    };

    // ================= 1. TABEL PENGELUARAN =================
    if (data.sections.txExpense) {
      const expenseRows = data.expenseList.map((t, idx) => {
        const title = t.title || 'Tanpa Judul';
        const notes = t.content || (t.finance?.notes) || '-';
        const source = t.finance?.expenseFor || (t.finance?.source) || 'Kas Umum';

        return [
          { text: String(idx + 1), align: 'center' },
          { text: t.date || '-' },
          { text: title, bold: true },
          { text: notes },
          { text: source },
          { text: rupiah(t.amount), bold: true, color: [163, 64, 47], align: 'right' }
        ];
      });

      const totalExp = data.expenseList.reduce((sum, x) => sum + Number(x.amount || 0), 0);
      drawTable({
        title: 'Daftar Transaksi Pengeluaran',
        headers: ['No', 'Tanggal', 'Keperluan / Judul', 'Catatan / Rincian', 'Alokasi / Sumber', 'Jumlah Pengeluaran'],
        rows: expenseRows,
        colWidths: [10, 22, 48, 44, 28, 30],
        alignments: ['center', 'left', 'left', 'left', 'left', 'right'],
        totalRow: {
          label: `TOTAL PENGELUARAN (${data.expenseList.length} Transaksi)`,
          value: rupiah(totalExp),
          color: [163, 64, 47]
        },
        emptyMessage: 'Tidak ada transaksi pengeluaran pada rentang tanggal ini.'
      });
    }

    // ================= 2. TABEL PEMASUKAN =================
    if (data.sections.txIncome) {
      const incomeRows = data.incomeList.map((t, idx) => {
        const title = t.title || 'Pemasukan';
        const notes = t.content || (t.finance?.notes) || '-';
        const source = t.finance?.incomeFrom || 'Pendapatan';

        return [
          { text: String(idx + 1), align: 'center' },
          { text: t.date || '-' },
          { text: title, bold: true },
          { text: notes },
          { text: source },
          { text: rupiah(t.amount), bold: true, color: [34, 120, 48], align: 'right' }
        ];
      });

      const totalInc = data.incomeList.reduce((sum, x) => sum + Number(x.amount || 0), 0);
      drawTable({
        title: 'Daftar Transaksi Pemasukan',
        headers: ['No', 'Tanggal', 'Sumber / Judul', 'Catatan / Rincian', 'Kategori', 'Jumlah Pemasukan'],
        rows: incomeRows,
        colWidths: [10, 22, 48, 44, 28, 30],
        alignments: ['center', 'left', 'left', 'left', 'left', 'right'],
        totalRow: {
          label: `TOTAL PEMASUKAN (${data.incomeList.length} Transaksi)`,
          value: rupiah(totalInc),
          color: [34, 120, 48]
        },
        emptyMessage: 'Tidak ada transaksi pemasukan pada rentang tanggal ini.'
      });
    }

    // ================= 3. TABEL HUTANG & PIUTANG =================
    if (data.sections.debts) {
      const debtRows = data.debtList.map((d, idx) => {
        const paid = d.paidAmount || 0;
        const remain = Math.max(0, d.amount - paid);
        const status = remain === 0 ? 'LUNAS' : (paid > 0 ? `Cicil (${Math.round(paid / d.amount * 100)}%)` : 'Belum Bayar');
        const statusColor = remain === 0 ? [34, 120, 48] : [150, 100, 30];

        return [
          { text: String(idx + 1), align: 'center' },
          { text: d.title || 'Hutang', bold: true },
          { text: d.finance?.debtTo || '-' },
          { text: rupiah(d.amount), align: 'right' },
          { text: rupiah(paid), align: 'right' },
          { text: rupiah(remain), align: 'right', bold: true, color: [163, 64, 47] },
          { text: status, color: statusColor, bold: true, align: 'center' }
        ];
      });

      const totalDebtRemain = data.debtList.reduce((sum, x) => sum + Math.max(0, x.amount - (x.paidAmount || 0)), 0);
      drawTable({
        title: 'Daftar Hutang & Status Pelunasan',
        headers: ['No', 'Keterangan Hutang', 'Pihak Terkait', 'Total Hutang', 'Sudah Dibayar', 'Sisa Hutang', 'Status'],
        rows: debtRows,
        colWidths: [10, 40, 32, 28, 26, 26, 20],
        alignments: ['center', 'left', 'left', 'right', 'right', 'right', 'center'],
        totalRow: {
          label: `TOTAL SISA HUTANG BELUM LUNAS (${data.debtList.length} Catatan)`,
          value: rupiah(totalDebtRemain),
          color: [163, 64, 47]
        },
        emptyMessage: 'Tidak ada catatan hutang pada periode ini.'
      });
    }

    // ================= 4. PENGELUARAN WAJIB =================
    if (data.sections.obligations) {
      const obRows = data.obligationList.map((o, idx) => {
        const paid = o.paidAmount || (o.isPaid ? o.amount : 0);
        const remain = Math.max(0, o.amount - paid);
        const status = remain === 0 ? 'TERPENUHI' : (paid > 0 ? `Cicil (${Math.round(paid / o.amount * 100)}%)` : 'Belum Terpenuhi');
        const statusColor = remain === 0 ? [34, 120, 48] : [120, 85, 25];

        return [
          { text: String(idx + 1), align: 'center' },
          { text: o.name || 'Pos Pengeluaran Wajib', bold: true },
          { text: o.dueDate || '-' },
          { text: rupiah(o.amount), align: 'right' },
          { text: rupiah(paid), align: 'right' },
          { text: rupiah(remain), align: 'right', bold: true, color: [163, 64, 47] },
          { text: status, color: statusColor, bold: true, align: 'center' }
        ];
      });

      const totalObRemain = data.obligationList.reduce((sum, x) => sum + Math.max(0, x.amount - (x.paidAmount || (x.isPaid ? x.amount : 0))), 0);
      drawTable({
        title: 'Alokasi Pengeluaran Wajib Rutin',
        headers: ['No', 'Nama Pos Wajib', 'Jatuh Tempo', 'Target Alokasi', 'Terbayar', 'Sisa', 'Status'],
        rows: obRows,
        colWidths: [10, 45, 27, 28, 26, 26, 20],
        alignments: ['center', 'left', 'left', 'right', 'right', 'right', 'center'],
        totalRow: {
          label: `TOTAL SISA DANA WAJIB (${data.obligationList.length} Pos)`,
          value: rupiah(totalObRemain),
          color: [120, 85, 25]
        },
        emptyMessage: 'Tidak ada pos pengeluaran wajib yang tercatat.'
      });
    }

    // ================= 5. POS TABUNGAN & INVESTASI =================
    if (data.sections.savings) {
      const savRows = data.savingsList.map((s, idx) => {
        const bal = Number(s.balance || 0);
        const tgt = Number(s.target || 0);
        const pct = tgt > 0 ? `${Math.min(100, Math.round(bal / tgt * 100))}%` : '-';

        return [
          { text: String(idx + 1), align: 'center' },
          { text: s.name || 'Pos Tabungan', bold: true },
          { text: s.source || 'Rekening / Dompet' },
          { text: rupiah(tgt), align: 'right' },
          { text: rupiah(bal), align: 'right', bold: true, color: [39, 71, 82] },
          { text: pct, align: 'center', bold: true }
        ];
      });

      const totalSav = data.savingsList.reduce((sum, x) => sum + Number(x.balance || 0), 0);
      drawTable({
        title: 'Pos Tabungan & Aset',
        headers: ['No', 'Nama Pos Tabungan', 'Tempat Penyimpanan', 'Target', 'Saldo Saat Ini', 'Capaian'],
        rows: savRows,
        colWidths: [10, 52, 40, 30, 30, 20],
        alignments: ['center', 'left', 'left', 'right', 'right', 'center'],
        totalRow: {
          label: `TOTAL DANA TABUNGAN TERSIMPAN (${data.savingsList.length} Pos)`,
          value: rupiah(totalSav),
          color: [39, 71, 82]
        },
        emptyMessage: 'Tidak ada data tabungan yang tercatat.'
      });
    }

    // ================= 6. RIWAYAT AUDIT MUTASI =================
    if (data.sections.history && data.historyList?.length) {
      const histRows = data.historyList.slice(0, 50).map((h, idx) => {
        const timeStr = h.at ? new Date(h.at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-';
        return [
          { text: String(idx + 1), align: 'center' },
          { text: timeStr },
          { text: h.action || '-', bold: true },
          { text: rupiah(h.amount), align: 'right' },
          { text: h.note || '-' }
        ];
      });

      drawTable({
        title: 'Log Riwayat Audit & Mutasi Keuangan (50 Terakhir)',
        headers: ['No', 'Waktu', 'Aksi / Perubahan', 'Nominal', 'Catatan Tambahan'],
        rows: histRows,
        colWidths: [10, 35, 45, 32, 60],
        alignments: ['center', 'left', 'left', 'right', 'left'],
        emptyMessage: 'Tidak ada catatan log mutasi.'
      });
    }

    // ================= DUA PASS: CETAK FOOTER DI SETIAP HALAMAN =================
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 135, 130);
      doc.setDrawColor(220, 225, 220);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
      doc.text('Catatan Pintar — Dokumen Laporan Keuangan Resmi', margin, pageHeight - 6);
      doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }

    return doc.output('blob');
  },

  /**
   * PDF Generator Murni (Fallback Standar Vektor ISO-32000)
   */
  _buildFallbackPdf(data) {
    const encoder = new TextEncoder();
    const clean = (text) => String(text ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[\r\n\t]/g, ' ');

    const lines = [];
    lines.push('================================================================');
    lines.push(`       ${data.reportTitle.padEnd(48, ' ')}       `);
    lines.push('================================================================');
    lines.push(`Tanggal Cetak : ${new Date().toLocaleString('id-ID')}`);
    lines.push(`Periode       : ${(data.fromDate || data.toDate) ? `${data.fromDate || 'Awal'} s/d ${data.toDate || 'Sekarang'}` : 'Semua Periode'}`);
    lines.push('----------------------------------------------------------------');
    lines.push('');

    if (data.sections.summary && data.summaryData) {
      const s = data.summaryData;
      lines.push('[ RINGKASAN DATA ]');
      if (data.sections.txExpense && !data.sections.txIncome) {
        lines.push(`- Total Pengeluaran : ${rupiah(s.expenseTotal)} (${s.expenseCount || 0} transaksi)`);
        lines.push(`- Rata-rata / trx   : ${rupiah(s.expenseAvg)}`);
        lines.push(`- Terbesar          : ${rupiah(s.expenseMax)}`);
      } else if (data.sections.txIncome && !data.sections.txExpense) {
        lines.push(`- Total Pemasukan   : ${rupiah(s.incomeTotal)} (${s.incomeCount || 0} transaksi)`);
        lines.push(`- Rata-rata / trx   : ${rupiah(s.incomeAvg)}`);
        lines.push(`- Terbesar          : ${rupiah(s.incomeMax)}`);
      } else {
        lines.push(`- Total Pemasukan   : ${rupiah(s.incomeTotal)}`);
        lines.push(`- Total Pengeluaran : ${rupiah(s.expenseTotal)}`);
        lines.push(`- Saldo Bersih      : ${rupiah(s.netBalance)}`);
        if (s.debtRemain) lines.push(`- Sisa Hutang       : ${rupiah(s.debtRemain)}`);
        if (s.obligationRemain) lines.push(`- Sisa Dana Wajib   : ${rupiah(s.obligationRemain)}`);
        if (s.savingsTotal) lines.push(`- Total Tabungan    : ${rupiah(s.savingsTotal)}`);
      }
      lines.push('');
    }

    if (data.sections.txExpense && data.expenseList?.length) {
      lines.push('[ DAFTAR TRANSAKSI PENGELUARAN ]');
      data.expenseList.forEach((t, i) => {
        lines.push(`${String(i + 1).padStart(3, ' ')}. [${t.date}] ${t.title} : (-) ${rupiah(t.amount)}`);
      });
      const sumExp = data.expenseList.reduce((s, x) => s + Number(x.amount || 0), 0);
      lines.push(`   >>> TOTAL PENGELUARAN: ${rupiah(sumExp)}`);
      lines.push('');
    }

    if (data.sections.txIncome && data.incomeList?.length) {
      lines.push('[ DAFTAR TRANSAKSI PEMASUKAN ]');
      data.incomeList.forEach((t, i) => {
        lines.push(`${String(i + 1).padStart(3, ' ')}. [${t.date}] ${t.title} : (+) ${rupiah(t.amount)}`);
      });
      const sumInc = data.incomeList.reduce((s, x) => s + Number(x.amount || 0), 0);
      lines.push(`   >>> TOTAL PEMASUKAN: ${rupiah(sumInc)}`);
      lines.push('');
    }

    if (data.sections.debts && data.debtList?.length) {
      lines.push('[ DAFTAR HUTANG ]');
      data.debtList.forEach((d, i) => {
        const paid = d.paidAmount || 0;
        const remain = Math.max(0, d.amount - paid);
        lines.push(`${String(i + 1).padStart(3, ' ')}. ${d.title} (kpd ${d.finance?.debtTo || '-'}): Sisa ${rupiah(remain)} dari ${rupiah(d.amount)}`);
      });
      lines.push('');
    }

    if (data.sections.obligations && data.obligationList?.length) {
      lines.push('[ POS PENGELUARAN WAJIB ]');
      data.obligationList.forEach((o, i) => {
        const paid = o.paidAmount || (o.isPaid ? o.amount : 0);
        const remain = Math.max(0, o.amount - paid);
        lines.push(`${String(i + 1).padStart(3, ' ')}. ${o.name}: Sisa ${rupiah(remain)} dari target ${rupiah(o.amount)}`);
      });
      lines.push('');
    }

    if (data.sections.savings && data.savingsList?.length) {
      lines.push('[ POS TABUNGAN ]');
      data.savingsList.forEach((s, i) => {
        lines.push(`${String(i + 1).padStart(3, ' ')}. ${s.name}: Saldo ${rupiah(s.balance)} / Target ${rupiah(s.target || 0)}`);
      });
      lines.push('');
    }

    const maxLinesPerPage = 48;
    const pages = [];
    for (let p = 0; p < lines.length; p += maxLinesPerPage) {
      pages.push(lines.slice(p, p + maxLinesPerPage));
    }
    if (!pages.length) pages.push(['Tidak ada data untuk dicetak.']);

    const objs = [];
    const add = (val) => { objs.push(val); return objs.length; };
    const catalogId = add(null);
    const pagesId = add(null);
    const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
    const pageIds = [];
    const contentIds = [];

    pages.forEach((pageLines, pageIdx) => {
      const streamLines = [];
      streamLines.push(`BT /F1 9 Tf 40 800 Td`);
      pageLines.forEach((l, lIdx) => {
        if (lIdx === 0) streamLines.push(`(${clean(l)}) Tj`);
        else streamLines.push(`0 -16 Td (${clean(l)}) Tj`);
      });
      streamLines.push(`ET`);
      streamLines.push(`BT /F1 8 Tf 40 30 Td (Halaman ${pageIdx + 1} dari ${pages.length}) Tj ET`);

      const stream = streamLines.join('\n');
      const contentId = add(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
      const pageId = add(null);
      contentIds.push(contentId);
      pageIds.push(pageId);
    });

    for (let i = 0; i < pageIds.length; i++) {
      objs[pageIds[i] - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
    }
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    objs[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

    let output = '%PDF-1.4\n%CatatanPintarKeuangan\n';
    const offsets = [0];
    for (let i = 0; i < objs.length; i++) {
      offsets.push(encoder.encode(output).length);
      output += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xref = encoder.encode(output).length;
    output += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objs.length; i++) output += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    output += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

    return new Blob([encoder.encode(output)], { type: 'application/pdf' });
  }
};
