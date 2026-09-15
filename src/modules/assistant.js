/**
 * Smart Local Assistant (Offline Note Q&A)
 * 100% client-side natural inquiry processing across notes, finances, reminders, and categories.
 * Works completely offline without server roundtrips or external AI keys.
 */

import { SecurityService } from './security.js';
import { FinanceService } from './finance.js';

export const AssistantService = {
  /**
   * Process a user query against the local notes database.
   */
  ask(query, notes, categories) {
    const q = (query || '').trim().toLowerCase();
    if (!q) {
      return {
        text: 'Silakan ketik pertanyaan tentang catatan, pengeluaran, hutang, ide, atau pengingat Anda.',
        references: []
      };
    }

    // 1. Debt & Liabilities Queries
    if (q.includes('hutang') || q.includes('utang') || q.includes('pinjam') || q.includes('tagihan')) {
      const debtNotes = notes.filter(n => n.finance && n.finance.type === 'debt');
      const unpaid = debtNotes.filter(n => !n.finance.debtPaid);
      const paid = debtNotes.filter(n => !!n.finance.debtPaid);

      const totalUnpaid = unpaid.reduce((sum, n) => sum + (Number(n.finance.amount) || 0), 0);
      const totalPaid = paid.reduce((sum, n) => sum + (Number(n.finance.amount) || 0), 0);

      if (debtNotes.length === 0) {
        return {
          text: 'Anda tidak memiliki catatan hutang sama sekali. Keuangan Anda bersih dari kewajiban hutang!',
          references: []
        };
      }

      let text = `Ringkasan Hutang Anda:\n`;
      text += `• Hutang Belum Lunas: ${unpaid.length} catatan (Total: ${FinanceService.formatRupiah(totalUnpaid)})\n`;
      text += `• Hutang Sudah Lunas: ${paid.length} catatan (Total: ${FinanceService.formatRupiah(totalPaid)})\n\n`;

      if (unpaid.length > 0) {
        text += `Daftar hutang aktif yang perlu diselesaikan:\n`;
        unpaid.forEach((n, i) => {
          const toWhom = n.finance.debtTo ? ` kepada ${n.finance.debtTo}` : '';
          const purpose = n.finance.debtPurpose ? ` (${n.finance.debtPurpose})` : '';
          text += `${i + 1}. "${n.title}": ${FinanceService.formatRupiah(n.finance.amount)}${toWhom}${purpose}\n`;
        });
      } else {
        text += 'Semua hutang yang tercatat telah lunas! 🎉';
      }

      return { text, references: unpaid.length > 0 ? unpaid : debtNotes };
    }

    // 2. Financial Totals & Balance Queries
    if (q.includes('pengeluaran') || q.includes('pemasukan') || q.includes('keuangan') || q.includes('saldo') || q.includes('biaya') || q.includes('uang') || q.includes('hemat')) {
      const totals = FinanceService.calculateTotals(notes);
      let text = `Ringkasan Keuangan Keseluruhan:\n`;
      text += `• Total Pemasukan: ${FinanceService.formatRupiah(totals.income)}\n`;
      text += `• Total Pengeluaran: ${FinanceService.formatRupiah(totals.expense)}\n`;
      text += `• Sisa Saldo Bersih: ${FinanceService.formatRupiah(totals.balance)}\n`;
      text += `• Hutang Belum Lunas: ${FinanceService.formatRupiah(totals.debtUnpaid)}\n\n`;

      if (totals.balance < 0) {
        text += `Perhatian: Arus kas Anda saat ini defisit ${FinanceService.formatRupiah(Math.abs(totals.balance))}. Disarankan untuk menekan pengeluaran non-primer.`;
      } else if (totals.balance > 0) {
        text += `Kondisi arus kas Anda surplus ${FinanceService.formatRupiah(totals.balance)}. Pertahankan pencatatan rutin!`;
      } else {
        text += `Arus kas berimbang antara pemasukan dan pengeluaran.`;
      }

      const financeNotes = notes.filter(n => n.category === 'keuangan');
      return { text, references: financeNotes.slice(0, 5) };
    }

    // 3. Reminders & Alarms Queries
    if (q.includes('ingat') || q.includes('alarm') || q.includes('jadwal') || q.includes('deadline')) {
      const reminderNotes = notes.filter(n => n.reminder && n.reminder.datetime);
      if (reminderNotes.length === 0) {
        return {
          text: 'Belum ada catatan yang memiliki jadwal pengingat atau alarm.',
          references: []
        };
      }

      const now = Date.now();
      const upcoming = reminderNotes.filter(n => !n.reminder.notified && new Date(n.reminder.datetime).getTime() >= now);
      const overdue = reminderNotes.filter(n => !n.reminder.notified && new Date(n.reminder.datetime).getTime() < now);

      let text = `Status Pengingat (${reminderNotes.length} total):\n`;
      if (upcoming.length > 0) {
        text += `• Pengingat Mendatang (${upcoming.length}):\n`;
        upcoming.forEach(n => {
          const d = new Date(n.reminder.datetime).toLocaleString('id-ID');
          text += `  - "${n.title}" (${d})\n`;
        });
      }
      if (overdue.length > 0) {
        text += `• Pengingat Terlewat (${overdue.length}):\n`;
        overdue.forEach(n => {
          text += `  - "${n.title}"\n`;
        });
      }
      return { text, references: upcoming.concat(overdue) };
    }

    // 4. Category-Specific Queries
    for (const cat of categories) {
      if (q.includes(cat.name.toLowerCase()) || q.includes(cat.id)) {
        const catNotes = notes.filter(n => n.category === cat.id);
        if (catNotes.length === 0) {
          return {
            text: `Belum ada catatan di bawah kategori "${cat.name}".`,
            references: []
          };
        }
        let text = `Terdapat ${catNotes.length} catatan dalam kategori ${cat.icon || '📁'} ${cat.name}:\n\n`;
        catNotes.slice(0, 6).forEach((n, i) => {
          const preview = SecurityService.stripHtml(n.bodyHTML || '').slice(0, 70);
          text += `${i + 1}. **${n.title}**\n   ${preview}${preview.length >= 70 ? '…' : ''}\n`;
        });
        return { text, references: catNotes };
      }
    }

    // 5. Full-Text Search and Semantic Matching
    const tokens = q.split(/\s+/).filter(t => t.length > 1);
    const scoredNotes = notes.map(note => {
      let score = 0;
      const titleLower = (note.title || '').toLowerCase();
      const bodyText = SecurityService.stripHtml(note.bodyHTML || '').toLowerCase();

      tokens.forEach(tok => {
        if (titleLower.includes(tok)) score += 5;
        if (bodyText.includes(tok)) score += 2;
        if (note.category && note.category.includes(tok)) score += 3;
      });

      return { note, score };
    }).filter(item => item.score > 0);

    scoredNotes.sort((a, b) => b.score - a.score);

    if (scoredNotes.length === 0) {
      return {
        text: `Maaf, saya tidak menemukan catatan yang relevan dengan kata kunci "${query}". Anda dapat menanyakan ringkasan keuangan, hutang, pengingat, atau kategori tertentu.`,
        references: []
      };
    }

    const topMatches = scoredNotes.slice(0, 4).map(item => item.note);
    let text = `Ditemukan ${scoredNotes.length} catatan yang relevan:\n\n`;
    topMatches.forEach((n, i) => {
      const preview = SecurityService.stripHtml(n.bodyHTML || '').slice(0, 90);
      text += `${i + 1}. **${n.title}** (${n.category})\n   ${preview}…\n\n`;
    });

    return { text, references: topMatches };
  }
};
