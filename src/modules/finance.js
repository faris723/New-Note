import { ExportImportService } from './exportImport.js';

export const FinanceService = {
    transactions: [],

    init() {
        this.loadTransactions();
        this.bindEvents();
    },

    loadTransactions() {
        try {
            const saved = localStorage.getItem('catatan_pintar_finance');
            if (saved) {
                this.transactions = JSON.parse(saved);
            } else {
                this.transactions = [];
            }
        } catch (e) {
            console.error("Gagal memuat data transaksi:", e);
            this.transactions = [];
        }
    },

    saveTransactions() {
        try {
            localStorage.setItem('catatan_pintar_finance', JSON.stringify(this.transactions));
        } catch (e) {
            console.error("Gagal menyimpan data transaksi:", e);
        }
    },

    addTransaction(type, amount, description, date = new Date().toISOString().split('T')[0]) {
        const newTrx = {
            id: Date.now().toString(),
            type: type, // 'pemasukan' atau 'pengeluaran'
            amount: Number(amount),
            description: description,
            date: date
        };
        this.transactions.push(newTrx);
        this.saveTransactions();
        return newTrx;
    },

    deleteTransaction(id) {
        this.transactions = this.transactions.filter(t => t.id !== id);
        this.saveTransactions();
    },

    getSummary() {
        let totalPemasukan = 0;
        let totalPengeluaran = 0;

        this.transactions.forEach(t => {
            const nominal = Number(t.amount || t.nominal || 0);
            if ((t.type || t.tipe || '').toLowerCase() === 'pemasukan') {
                totalPemasukan += nominal;
            } else if ((t.type || t.tipe || '').toLowerCase() === 'pengeluaran') {
                totalPengeluaran += nominal;
            }
        });

        return {
            totalPemasukan,
            totalPengeluaran,
            saldo: totalPemasukan - totalPengeluaran
        };
    },

    bindEvents() {
        document.querySelectorAll('[data-action="export-finance"]').forEach(button => {
            button.addEventListener('click', (e) => this.handleExport(e));
        });
    },

    async handleExport(eventOrFormat = 'json') {
        try {
            if (!this.transactions || this.transactions.length === 0) {
                alert('Tidak ada data transaksi keuangan untuk diekspor.');
                return;
            }

            // Memanggil ekspor keuangan tanpa mengganggu ekspor catatan utama
            if (typeof ExportImportService.exportFinance === 'function') {
                return await ExportImportService.exportFinance(this.transactions, eventOrFormat);
            } else {
                return await ExportImportService.exportNotes(this.transactions, eventOrFormat);
            }
        } catch (error) {
            if (error.message !== 'Ekspor dibatalkan.') {
                console.error("Gagal melakukan ekspor keuangan:", error);
                alert(error.message || 'Terjadi kesalahan saat mengekspor data keuangan.');
            }
        }
    }
};

// Meng-export alias FinanceModule untuk kompatibilitas penuh
export const FinanceModule = FinanceService;
