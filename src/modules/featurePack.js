/**
 * Catatan Pintar feature pack.
 *
 * Prinsip penting:
 * - fitur Keuangan/Jadwal menyimpan data melalui StorageService milik aplikasi
 *   (bukan hanya localStorage), sehingga ikut tercadangkan dan tetap ada setelah update APK;
 * - form tambah transaksi/acara berdiri sendiri dan tidak bergantung pada prompt();
 * - editor catatan lama tetap dipakai untuk mengubah data yang sudah ada;
 * - UI dibuat idempotent supaya aman bila init dipanggil ulang.
 */
import { ImageEditorService } from './imageEditor.js';
import { SecurityService } from './security.js';

const OBL_KEY = 'cp_obligations_v2';
const SAV_KEY = 'cp_savings_v2';
const esc = (v) => SecurityService.escapeHtml(String(v ?? ''));
const rupiah = (v) => 'Rp ' + Number(v || 0).toLocaleString('id-ID');
const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix = 'item') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const loadJSON = (key, fallback = []) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};
const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function addStyle() {
  if (document.getElementById('cp104-style')) return;
  const style = document.createElement('style');
  style.id = 'cp104-style';
  style.textContent = `
    .cp104-nav{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:90;display:flex;gap:5px;padding:6px;background:rgba(255,252,244,.97);border:1px solid var(--card-edge,#ddd);border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.16);backdrop-filter:blur(8px)}
    .cp104-nav button{border:0;background:transparent;padding:8px 13px;border-radius:13px;font:600 12px inherit;color:var(--ink-soft,#667);cursor:pointer}.cp104-nav button.active{background:var(--ink,#27352b);color:#fff}
    .cp104-panel{position:fixed;inset:0;z-index:80;background:var(--paper,#f8f4e9);overflow:auto;padding:18px 14px 105px;display:none}.cp104-panel.open{display:block}
    .cp104-head{max-width:960px;margin:0 auto 12px;display:flex;align-items:center;justify-content:space-between;gap:10px}.cp104-title{font:700 22px 'Source Serif 4',Georgia,serif}.cp104-actions{display:flex;gap:6px;flex-wrap:wrap}.cp104-btn{border:1px solid var(--card-edge,#ddd);background:#fff;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer}.cp104-btn.primary{background:var(--ink,#27352b);color:#fff;border-color:var(--ink,#27352b)}
    .cp104-grid{max-width:960px;margin:0 auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cp104-card{background:#fff;border:1px solid var(--card-edge,#ddd);border-radius:10px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,.04)}.cp104-card h3{margin:0 0 6px;font:700 14px 'Source Serif 4',Georgia,serif}.cp104-val{font:700 18px 'IBM Plex Mono',monospace}.cp104-muted{font-size:11px;color:var(--ink-soft,#667)}
    .cp104-wide{grid-column:1/-1}.cp104-scroll{overflow:auto;max-height:320px}.cp104-input{width:100%;box-sizing:border-box;border:1px solid var(--card-edge,#ddd);border-radius:7px;padding:9px;background:#fff}.cp104-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.cp104-row>*{flex:1;min-width:0}.cp104-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;border:1px solid #ddd;font-size:11px;background:#fff}.cp104-bar{height:9px;border-radius:8px;background:#eee9dc;overflow:hidden}.cp104-bar>i{display:block;height:100%;background:var(--moss,#47593f)}
    .cp104-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.cp104-day{min-height:62px;border:1px solid #e7e1d3;background:#fff;border-radius:6px;padding:5px;font-size:11px;cursor:pointer}.cp104-day.muted{opacity:.42}.cp104-day.sel{outline:2px solid var(--ink,#27352b)}.cp104-day b{display:block;margin-bottom:4px}.cp104-dot{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9px;margin-top:2px;padding:1px 3px;border-radius:4px;background:#f3ead2}
    .cp104-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:160;display:none;align-items:center;justify-content:center;padding:12px}.cp104-modal.open{display:flex}.cp104-dialog{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fffdf7;border-radius:12px;border:1px solid #ddd5c5;padding:14px}.cp104-form{display:grid;gap:10px}.cp104-form label{display:grid;gap:4px;font-size:12px;font-weight:700}.cp104-check{display:flex!important;grid-template-columns:auto 1fr;align-items:center;gap:7px!important}.cp104-check input{width:auto}.cp104-help{font-size:11px;color:var(--ink-soft,#667);font-weight:400}
    .cp104-batch{position:fixed;left:10px;right:10px;bottom:74px;z-index:89;display:none;background:#fffdf7;border:1px solid #d8d0bf;border-radius:12px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.14)}.cp104-batch.open{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.cp104-batch button{border:1px solid #ddd;background:#fff;border-radius:7px;padding:6px 8px;font-size:11px;font-weight:700}
    .cp104-tools{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.cp104-tools button{padding:6px 8px;border:1px solid #ddd;border-radius:7px;background:#fff;cursor:pointer;font-size:11px}.cp104-canvas-wrap{overflow:auto;background:#eee9dc;padding:8px;border-radius:8px;text-align:center;position:relative;min-height:180px}.cp104-canvas-wrap canvas{max-width:100%;touch-action:none}
    @media(max-width:650px){.cp104-grid{grid-template-columns:1fr}.cp104-wide{grid-column:auto}.cp104-nav button{padding:8px 10px}.cp104-title{font-size:19px}}
  `;
  document.head.appendChild(style);
}

export const FeaturePackService = {
  ctx: null,
  obligations: [],
  savings: [],
  calDate: new Date(),
  selectedDate: today(),
  _bound: false,

  init(ctx) {
    this.ctx = ctx;
    addStyle();
    this.obligations = loadJSON(OBL_KEY, loadJSON('cp_obligations_v1', []));
    this.savings = loadJSON(SAV_KEY, loadJSON('cp_savings_v1', []));
    this.buildShell();
    this.buildEditorExtras();
    this.bind();
    this.renderFinance();
    this.renderCalendar();
    this.syncBatchBar();
  },

  buildShell() {
    if (!document.getElementById('cp104Nav')) {
      const nav = document.createElement('nav');
      nav.id = 'cp104Nav';
      nav.className = 'cp104-nav';
      nav.innerHTML = '<button type="button" data-tab="home" class="active">📝 Catatan</button><button type="button" data-tab="finance">💰 Keuangan</button><button type="button" data-tab="schedule">📅 Jadwal</button>';
      document.body.appendChild(nav);
    }

    if (!document.getElementById('cp104Finance')) {
      const fin = document.createElement('section');
      fin.id = 'cp104Finance';
      fin.className = 'cp104-panel';
      fin.innerHTML = `
        <div class="cp104-head">
          <div><div class="cp104-title">💰 Keuangan</div><div class="cp104-muted">Pemasukan, pengeluaran, hutang, kewajiban dan tabungan tersimpan di data aplikasi.</div></div>
          <div class="cp104-actions"><button type="button" class="cp104-btn" id="cp104ExportFinance">Ekspor</button><button type="button" class="cp104-btn primary" id="cp104AddIncome">+ Pemasukan</button><button type="button" class="cp104-btn" id="cp104AddExpense">+ Pengeluaran</button><button type="button" class="cp104-btn" id="cp104AddDebt">+ Hutang</button></div>
        </div>
        <div class="cp104-grid">
          <div class="cp104-card"><div class="cp104-muted">Pemasukan</div><div class="cp104-val" id="cp104Income">Rp 0</div></div>
          <div class="cp104-card"><div class="cp104-muted">Pengeluaran</div><div class="cp104-val" id="cp104Expense">Rp 0</div></div>
          <div class="cp104-card"><div class="cp104-muted">Saldo Bersih</div><div class="cp104-val" id="cp104Balance">Rp 0</div></div>
          <div class="cp104-card"><div class="cp104-muted">Hutang Aktif</div><div class="cp104-val" id="cp104Debt">Rp 0</div></div>
          <div class="cp104-card"><div class="cp104-muted">Kewajiban Belum Lunas</div><div class="cp104-val" id="cp104Obligation">Rp 0</div></div>
          <div class="cp104-card"><div class="cp104-muted">Total Tabungan</div><div class="cp104-val" id="cp104Savings">Rp 0</div></div>
          <div class="cp104-card cp104-wide"><div class="cp104-row"><input class="cp104-input" type="date" id="cp104FinFrom"><input class="cp104-input" type="date" id="cp104FinTo"><button type="button" class="cp104-btn" id="cp104ResetFin">Semua tanggal</button></div><div style="height:10px"></div><div id="cp104FinanceChart"></div></div>
          <div class="cp104-card"><h3>Transaksi</h3><div class="cp104-scroll" id="cp104TxList"></div></div>
          <div class="cp104-card"><h3>Hutang</h3><div class="cp104-scroll" id="cp104DebtList"></div></div>
          <div class="cp104-card cp104-wide"><div class="cp104-row"><h3 style="margin-right:auto">Dana Pengeluaran Wajib</h3><button type="button" class="cp104-btn" id="cp104AddOb">+ Tambah</button></div><div class="cp104-row"><input class="cp104-input" id="cp104ObName" placeholder="Nama kewajiban"><input class="cp104-input" id="cp104ObAmount" type="number" min="0" placeholder="Nominal"><input class="cp104-input" id="cp104ObDue" type="date"><label class="cp104-check"><input type="checkbox" id="cp104ObDeduct" checked> Kurangi dari saldo bersih</label></div><div class="cp104-scroll" id="cp104ObList"></div></div>
          <div class="cp104-card cp104-wide"><div class="cp104-row"><h3 style="margin-right:auto">Pos Tabungan</h3><button type="button" class="cp104-btn" id="cp104AddSav">+ Pos Baru</button><button type="button" class="cp104-btn" id="cp104DepositSav">Setor / Tarik</button></div><div class="cp104-scroll" id="cp104SavList"></div></div>
        </div>`;
      document.body.appendChild(fin);
    }

    if (!document.getElementById('cp104Schedule')) {
      const sch = document.createElement('section');
      sch.id = 'cp104Schedule';
      sch.className = 'cp104-panel';
      sch.innerHTML = `
        <div class="cp104-head"><div><div class="cp104-title">📅 Jadwal & Acara</div><div class="cp104-muted">Tambah acara langsung ke catatan kategori Acara.</div></div><div class="cp104-actions"><button type="button" class="cp104-btn" id="cp104Prev">‹ Bulan</button><button type="button" class="cp104-btn" id="cp104Today">Hari ini</button><button type="button" class="cp104-btn" id="cp104Next">Bulan ›</button><button type="button" class="cp104-btn primary" id="cp104AddEvent">+ Acara</button></div></div>
        <div class="cp104-card" style="max-width:960px;margin:auto"><div class="cp104-head" style="margin:0 0 8px"><b id="cp104Month"></b><span class="cp104-muted" id="cp104SelCount"></span></div><div class="cp104-cal" id="cp104Calendar"></div><div style="height:12px"></div><h3>Acara pada tanggal terpilih</h3><div class="cp104-scroll" id="cp104DayEvents"></div></div>`;
      document.body.appendChild(sch);
    }

    if (!document.getElementById('cp104Batch')) {
      const batch = document.createElement('div');
      batch.id = 'cp104Batch';
      batch.className = 'cp104-batch';
      batch.innerHTML = '<b id="cp104BatchCount">0 dipilih</b><button type="button" id="cp104BatchDelete">Hapus</button><button type="button" id="cp104BatchMove">Pindah Kategori</button><button type="button" id="cp104BatchExport">Ekspor</button>';
      document.body.appendChild(batch);
    }

    this.ensureFormModal();
  },

  ensureFormModal() {
    if (document.getElementById('cp104FormModal')) return;
    const modal = document.createElement('div');
    modal.id = 'cp104FormModal';
    modal.className = 'cp104-modal';
    modal.innerHTML = '<div class="cp104-dialog"><div class="cp104-head"><div class="cp104-title" id="cp104FormTitle">Tambah</div><button type="button" class="cp104-btn" id="cp104FormClose">Tutup</button></div><form class="cp104-form" id="cp104Form"><div id="cp104FormFields"></div><div class="cp104-actions" style="justify-content:flex-end"><button type="button" class="cp104-btn" id="cp104FormCancel">Batal</button><button type="submit" class="cp104-btn primary">Simpan</button></div></form></div>';
    document.body.appendChild(modal);
    modal.querySelector('#cp104FormClose').onclick = () => modal.classList.remove('open');
    modal.querySelector('#cp104FormCancel').onclick = () => modal.classList.remove('open');
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
  },

  buildEditorExtras() {
    const cat = document.getElementById('categorySelect');
    if (cat && !document.getElementById('cp104QuickCat')) {
      const button = document.createElement('button');
      button.type = 'button'; button.id = 'cp104QuickCat'; button.className = 'btn-subtle'; button.textContent = '＋ Kategori'; button.style.marginLeft = '6px';
      cat.parentElement?.appendChild(button);
    }
    const fin = document.getElementById('financeRow');
    if (fin && !document.getElementById('cp104FinanceExtra')) {
      const wrap = document.createElement('div');
      wrap.id = 'cp104FinanceExtra';
      wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px';
      wrap.innerHTML = '<input id="cp104FinanceDate" class="cp104-input" type="date" style="flex:0 0 160px"><input id="cp104IncomeFrom" class="cp104-input" style="flex:1" placeholder="Pemasukan dari siapa / sumber"><input id="cp104ExpenseFor" class="cp104-input" style="flex:1;display:none" placeholder="Pengeluaran untuk apa">';
      fin.parentElement?.appendChild(wrap);
    }
    const rem = document.getElementById('reminderRow');
    if (rem && !document.getElementById('cp104ScheduleExtra')) {
      const row = document.createElement('div');
      row.id = 'cp104ScheduleExtra'; row.style.cssText = 'display:none;margin-top:8px';
      row.innerHTML = '<label style="font-size:12px;font-weight:600">Lokasi acara</label><input id="cp104EventLocation" class="cp104-input" placeholder="Contoh: Rumah, kantor, sekolah"><input id="cp104EventDate" type="hidden">';
      rem.parentElement?.appendChild(row);
    }
    if (document.getElementById('toolbar') && !document.getElementById('cp104ImageBtn')) {
      const button = document.createElement('button');
      button.type = 'button'; button.id = 'cp104ImageBtn'; button.className = 'toolbar-btn'; button.textContent = '🖼️ Anotasi'; button.title = 'Tambah gambar lalu beri anotasi';
      document.getElementById('toolbar').appendChild(button);
    }
  },

  bind() {
    if (this._bound) return;
    this._bound = true;
    document.querySelectorAll('#cp104Nav button').forEach((button) => button.addEventListener('click', () => this.switchTab(button.dataset.tab)));
    document.getElementById('cp104AddIncome').onclick = () => this.openFinanceForm('income');
    document.getElementById('cp104AddExpense').onclick = () => this.openFinanceForm('expense');
    document.getElementById('cp104AddDebt').onclick = () => this.openFinanceForm('debt');
    document.getElementById('cp104ExportFinance').onclick = () => this.exportFinance();
    document.getElementById('cp104FinFrom').onchange = () => this.renderFinance();
    document.getElementById('cp104FinTo').onchange = () => this.renderFinance();
    document.getElementById('cp104ResetFin').onclick = () => { document.getElementById('cp104FinFrom').value = ''; document.getElementById('cp104FinTo').value = ''; this.renderFinance(); };
    document.getElementById('cp104AddOb').onclick = () => this.addObligation();
    document.getElementById('cp104AddSav').onclick = () => this.openSavingsForm();
    document.getElementById('cp104DepositSav').onclick = () => this.openSavingsTransactionForm();
    document.getElementById('cp104Prev').onclick = () => { this.calDate.setMonth(this.calDate.getMonth() - 1); this.renderCalendar(); };
    document.getElementById('cp104Next').onclick = () => { this.calDate.setMonth(this.calDate.getMonth() + 1); this.renderCalendar(); };
    document.getElementById('cp104Today').onclick = () => { this.calDate = new Date(); this.selectedDate = today(); this.renderCalendar(); };
    document.getElementById('cp104AddEvent').onclick = () => this.openEventForm(this.selectedDate);

    const syncEditorExtras = () => {
      const category = document.getElementById('categorySelect')?.value;
      const type = document.getElementById('financeType')?.value;
      const eventRow = document.getElementById('cp104ScheduleExtra');
      const financeRow = document.getElementById('cp104FinanceExtra');
      if (eventRow) eventRow.style.display = category === 'acara' ? 'block' : 'none';
      if (financeRow) financeRow.style.display = category === 'keuangan' ? 'flex' : 'none';
      const income = document.getElementById('cp104IncomeFrom');
      const expense = document.getElementById('cp104ExpenseFor');
      if (income) income.style.display = category === 'keuangan' && type === 'income' ? 'block' : 'none';
      if (expense) expense.style.display = category === 'keuangan' && type === 'expense' ? 'block' : 'none';
    };
    document.getElementById('categorySelect')?.addEventListener('change', syncEditorExtras);
    document.getElementById('financeType')?.addEventListener('change', syncEditorExtras);
    syncEditorExtras();

    document.getElementById('cp104QuickCat')?.addEventListener('click', async () => {
      const name = window.prompt('Nama kategori baru:');
      if (!name?.trim()) return;
      const icon = window.prompt('Ikon (opsional):', '📁') || '📁';
      await this.ctx.addCategory({ id: uid('cat'), name: name.trim(), icon, color: '#3d5a6b', core: false });
    });
    document.getElementById('cp104ImageBtn')?.addEventListener('click', () => this.openImageEditor());
    document.getElementById('cp104BatchDelete').onclick = () => this.batchDelete();
    document.getElementById('cp104BatchMove').onclick = () => this.batchMove();
    document.getElementById('cp104BatchExport').onclick = () => this.batchExport();
    document.addEventListener('cp104:refresh', () => { this.renderFinance(); this.renderCalendar(); this.syncBatchBar(); });
  },

  switchTab(tab) {
    const fin = document.getElementById('cp104Finance');
    const sch = document.getElementById('cp104Schedule');
    fin.classList.toggle('open', tab === 'finance');
    sch.classList.toggle('open', tab === 'schedule');
    document.querySelectorAll('#cp104Nav button').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    if (tab === 'finance') this.renderFinance();
    if (tab === 'schedule') this.renderCalendar();
  },

  getTx() {
    const notes = this.ctx?.getNotes?.() || [];
    const from = document.getElementById('cp104FinFrom')?.value || '';
    const to = document.getElementById('cp104FinTo')?.value || '';
    return notes
      .filter((note) => note.category === 'keuangan' && note.finance)
      .map((note) => ({ ...note, amount: Number(note.finance.amount) || 0, type: note.finance.type || 'expense', date: note.finance.date || new Date(note.updatedAt || note.createdAt || Date.now()).toISOString().slice(0, 10) }))
      .filter((note) => (!from || note.date >= from) && (!to || note.date <= to))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  renderFinance() {
    const tx = this.getTx();
    const income = tx.filter((x) => x.type === 'income').reduce((sum, x) => sum + x.amount, 0);
    const expense = tx.filter((x) => x.type === 'expense').reduce((sum, x) => sum + x.amount, 0);
    const debt = tx.filter((x) => x.type === 'debt' && !x.finance.debtPaid).reduce((sum, x) => sum + x.amount, 0);
    const obligation = this.obligations.filter((x) => !x.isPaid).reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const savings = this.savings.reduce((sum, x) => sum + Number(x.balance || 0), 0);
    const values = { Income: income, Expense: expense, Balance: income - expense, Debt: debt, Obligation: obligation, Savings: savings };
    Object.entries(values).forEach(([key, value]) => { const node = document.getElementById(`cp104${key}`); if (node) node.textContent = rupiah(value); });

    const max = Math.max(income, expense, debt, 1);
    const chart = document.getElementById('cp104FinanceChart');
    if (chart) chart.innerHTML = `<div class="cp104-muted">Arus kas</div><div style="display:flex;gap:10px;align-items:flex-end;height:100px;margin-top:8px"><div style="flex:1;text-align:center"><div class="cp104-bar"><i style="width:${Math.round(income / max * 100)}%"></i></div><small>Pemasukan<br>${rupiah(income)}</small></div><div style="flex:1;text-align:center"><div class="cp104-bar"><i style="width:${Math.round(expense / max * 100)}%;background:var(--danger,#a3402f)"></i></div><small>Pengeluaran<br>${rupiah(expense)}</small></div><div style="flex:1;text-align:center"><div class="cp104-bar"><i style="width:${Math.round(debt / max * 100)}%;background:#b8922f"></i></div><small>Hutang<br>${rupiah(debt)}</small></div></div>`;

    const list = document.getElementById('cp104TxList');
    if (list) {
      list.innerHTML = tx.length ? tx.slice(0, 50).map((note) => `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1;cursor:pointer" data-tx-open="${esc(note.id)}"><b>${esc(note.title)}</b><div class="cp104-muted">${note.type === 'income' ? '+' : '-'} ${rupiah(note.amount)} · ${esc(note.date)}</div></div><button type="button" class="cp104-btn" data-tx-delete="${esc(note.id)}">Hapus</button></div></div>`).join('') : '<div class="cp104-muted">Belum ada transaksi.</div>';
      list.querySelectorAll('[data-tx-open]').forEach((node) => node.onclick = () => this.ctx.openNote(node.dataset.txOpen));
      list.querySelectorAll('[data-tx-delete]').forEach((node) => node.onclick = async () => { await this.deleteNote(node.dataset.txDelete); });
    }

    const debts = tx.filter((note) => note.type === 'debt');
    const debtList = document.getElementById('cp104DebtList');
    if (debtList) {
      debtList.innerHTML = debts.length ? debts.map((note) => `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1;cursor:pointer" data-debt-open="${esc(note.id)}"><b>${esc(note.title)}</b><div class="cp104-muted">${rupiah(note.amount)} · kepada ${esc(note.finance.debtTo || '-')} · ${note.finance.debtPaid ? 'Lunas' : 'Belum lunas'}</div></div><button type="button" class="cp104-btn" data-debt-toggle="${esc(note.id)}">${note.finance.debtPaid ? 'Belum Lunas' : 'Lunasi'}</button></div></div>`).join('') : '<div class="cp104-muted">Belum ada hutang.</div>';
      debtList.querySelectorAll('[data-debt-open]').forEach((node) => node.onclick = () => this.ctx.openNote(node.dataset.debtOpen));
      debtList.querySelectorAll('[data-debt-toggle]').forEach((node) => node.onclick = async () => { const note = (this.ctx.getNotes() || []).find((x) => x.id === node.dataset.debtToggle); if (!note?.finance) return; note.finance.debtPaid = !note.finance.debtPaid; note.updatedAt = Date.now(); await this.ctx.persistNote(note); });
    }

    const obList = document.getElementById('cp104ObList');
    if (obList) {
      obList.innerHTML = this.obligations.length ? this.obligations.map((item, i) => `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1"><b>${esc(item.name)}</b><div class="cp104-muted">${rupiah(item.amount)}${item.dueDate ? ` · jatuh tempo ${esc(item.dueDate)}` : ''}${item.deductFromNet ? ' · kurangi saldo' : ''}</div></div><button type="button" class="cp104-btn" data-ob-toggle="${i}">${item.isPaid ? 'Belum Lunas' : 'Lunas'}</button><button type="button" class="cp104-btn" data-ob-del="${i}">×</button></div></div>`).join('') : '<div class="cp104-muted">Belum ada kewajiban.</div>';
      obList.querySelectorAll('[data-ob-toggle]').forEach((button) => button.onclick = () => { this.obligations[Number(button.dataset.obToggle)].isPaid = !this.obligations[Number(button.dataset.obToggle)].isPaid; saveJSON(OBL_KEY, this.obligations); this.renderFinance(); });
      obList.querySelectorAll('[data-ob-del]').forEach((button) => button.onclick = () => { this.obligations.splice(Number(button.dataset.obDel), 1); saveJSON(OBL_KEY, this.obligations); this.renderFinance(); });
    }

    const savList = document.getElementById('cp104SavList');
    if (savList) {
      savList.innerHTML = this.savings.length ? this.savings.map((item, i) => { const pct = item.target ? Math.min(100, Math.round(Number(item.balance || 0) / Number(item.target) * 100)) : 0; return `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1"><b>${esc(item.name)}</b><div class="cp104-muted">${rupiah(item.balance)} / ${rupiah(item.target || 0)}${item.source ? ` · ${esc(item.source)}` : ''}</div></div><button type="button" class="cp104-btn" data-sav-del="${i}">×</button></div><div class="cp104-bar"><i style="width:${pct}%"></i></div><div class="cp104-muted">${pct}%</div></div>`; }).join('') : '<div class="cp104-muted">Belum ada pos tabungan.</div>';
      savList.querySelectorAll('[data-sav-del]').forEach((button) => button.onclick = () => { this.savings.splice(Number(button.dataset.savDel), 1); saveJSON(SAV_KEY, this.savings); this.renderFinance(); });
    }
  },

  openFinanceForm(type, existing = null) {
    const labels = { income: 'Pemasukan', expense: 'Pengeluaran', debt: 'Hutang' };
    const note = existing || {};
    const finance = note.finance || {};
    const fields = document.getElementById('cp104FormFields');
    document.getElementById('cp104FormTitle').textContent = `${existing ? 'Edit' : 'Tambah'} ${labels[type]}`;
    fields.innerHTML = `<label>Judul<input class="cp104-input" name="title" required value="${esc(note.title || labels[type])}" placeholder="Contoh: Gaji September"></label><div class="cp104-row"><label>Nominal (Rp)<input class="cp104-input" name="amount" type="number" min="0" step="1000" required value="${Number(finance.amount || 0) || ''}"></label><label>Tanggal<input class="cp104-input" name="date" type="date" required value="${esc(finance.date || today())}"></label></div>${type === 'income' ? '<label>Sumber pemasukan<input class="cp104-input" name="source" value=""></label>' : ''}${type === 'expense' ? '<label>Pengeluaran untuk<input class="cp104-input" name="purpose" value=""></label>' : ''}${type === 'debt' ? '<div class="cp104-row"><label>Hutang kepada<input class="cp104-input" name="debtTo" value=""></label><label>Untuk apa<input class="cp104-input" name="debtPurpose" value=""></label></div><label class="cp104-check"><input type="checkbox" name="debtPaid"> Sudah lunas</label>' : ''}<label>Catatan tambahan<textarea class="cp104-input" name="body" rows="4" placeholder="Opsional"></textarea></label>`;
    const form = document.getElementById('cp104Form');
    form.querySelector('[name="source"]')?.setAttribute('value', finance.incomeFrom || '');
    form.querySelector('[name="purpose"]')?.setAttribute('value', finance.expenseFor || '');
    form.querySelector('[name="debtTo"]')?.setAttribute('value', finance.debtTo || '');
    form.querySelector('[name="debtPurpose"]')?.setAttribute('value', finance.debtPurpose || '');
    if (form.querySelector('[name="debtPaid"]')) form.querySelector('[name="debtPaid"]').checked = Boolean(finance.debtPaid);
    form.querySelector('[name="body"]').value = SecurityService.stripHtml(note.bodyHTML || '');
    form.onsubmit = async (event) => { event.preventDefault(); await this.saveFinanceForm(type, existing?.id || null); };
    document.getElementById('cp104FormModal').classList.add('open');
    form.querySelector('[name="title"]').focus();
  },

  async saveFinanceForm(type, existingId = null) {
    const form = document.getElementById('cp104Form');
    const data = new FormData(form);
    const amount = Number(data.get('amount')) || 0;
    if (amount <= 0) { this.ctx.toast('Nominal harus lebih besar dari 0.', 'danger'); return; }
    const notes = this.ctx.getNotes() || [];
    const existing = existingId ? notes.find((n) => n.id === existingId) : null;
    const finance = { type, amount, date: String(data.get('date') || today()), debtTo: String(data.get('debtTo') || '').trim(), debtPurpose: String(data.get('debtPurpose') || '').trim(), debtPaid: Boolean(form.querySelector('[name="debtPaid"]')?.checked), incomeFrom: String(data.get('source') || '').trim(), expenseFor: String(data.get('purpose') || '').trim() };
    const note = existing ? { ...existing, title: String(data.get('title') || 'Tanpa Judul').trim(), bodyHTML: SecurityService.escapeHtml(String(data.get('body') || '')), finance, category: 'keuangan', updatedAt: Date.now() } : { id: uid('note'), title: String(data.get('title') || 'Tanpa Judul').trim(), bodyHTML: SecurityService.escapeHtml(String(data.get('body') || '')), category: 'keuangan', finance, reminder: null, eventDate: '', eventLocation: '', attachments: [], createdAt: Date.now(), updatedAt: Date.now() };
    await this.ctx.persistNote(note);
    document.getElementById('cp104FormModal').classList.remove('open');
    this.ctx.toast(`${type === 'income' ? 'Pemasukan' : type === 'expense' ? 'Pengeluaran' : 'Hutang'} berhasil disimpan.`, 'info');
  },

  openEventForm(dateValue = today(), existing = null) {
    const note = existing || {};
    const fields = document.getElementById('cp104FormFields');
    document.getElementById('cp104FormTitle').textContent = existing ? 'Edit Acara' : 'Tambah Acara';
    fields.innerHTML = `<label>Nama acara<input class="cp104-input" name="title" required value="${esc(note.title || '')}" placeholder="Contoh: Rapat keluarga"></label><div class="cp104-row"><label>Tanggal<input class="cp104-input" name="date" type="date" required value="${esc(note.eventDate || dateValue || today())}"></label><label>Jam<input class="cp104-input" name="time" type="time" value="${esc(note.reminder?.datetime ? String(note.reminder.datetime).slice(11,16) : '09:00')}"></label></div><label>Lokasi<input class="cp104-input" name="location" value="${esc(note.eventLocation || '')}" placeholder="Contoh: Rumah, kantor, sekolah"></label><label>Deskripsi<textarea class="cp104-input" name="body" rows="4" placeholder="Detail acara, peserta, agenda…"></textarea></label><label class="cp104-check"><input type="checkbox" name="reminder" checked> Buat pengingat</label>`;
    const form = document.getElementById('cp104Form');
    form.querySelector('[name="body"]').value = SecurityService.stripHtml(note.bodyHTML || '');
    form.onsubmit = async (event) => { event.preventDefault(); await this.saveEventForm(existing?.id || null); };
    document.getElementById('cp104FormModal').classList.add('open');
    form.querySelector('[name="title"]').focus();
  },

  async saveEventForm(existingId = null) {
    const form = document.getElementById('cp104Form');
    const data = new FormData(form);
    const date = String(data.get('date') || '');
    const title = String(data.get('title') || '').trim();
    if (!date || !title) { this.ctx.toast('Nama acara dan tanggal wajib diisi.', 'danger'); return; }
    const time = String(data.get('time') || '09:00');
    const notes = this.ctx.getNotes() || [];
    const existing = existingId ? notes.find((n) => n.id === existingId) : null;
    const note = existing ? { ...existing, title, bodyHTML: SecurityService.escapeHtml(String(data.get('body') || '')), category: 'acara', eventDate: date, eventLocation: String(data.get('location') || '').trim(), reminder: form.querySelector('[name="reminder"]')?.checked ? { datetime: `${date}T${time}`, notified: false } : null, updatedAt: Date.now() } : { id: uid('note'), title, bodyHTML: SecurityService.escapeHtml(String(data.get('body') || '')), category: 'acara', eventDate: date, eventLocation: String(data.get('location') || '').trim(), reminder: form.querySelector('[name="reminder"]')?.checked ? { datetime: `${date}T${time}`, notified: false } : null, finance: null, attachments: [], createdAt: Date.now(), updatedAt: Date.now() };
    await this.ctx.persistNote(note);
    this.selectedDate = date; this.calDate = new Date(`${date}T12:00:00`);
    document.getElementById('cp104FormModal').classList.remove('open');
    this.switchTab('schedule');
    this.ctx.toast('Acara berhasil disimpan.', 'info');
  },

  addObligation() {
    const nameEl = document.getElementById('cp104ObName');
    const amountEl = document.getElementById('cp104ObAmount');
    const dueEl = document.getElementById('cp104ObDue');
    const deductEl = document.getElementById('cp104ObDeduct');
    const name = nameEl.value.trim(); const amount = Number(amountEl.value) || 0;
    if (!name || amount <= 0) { this.ctx.toast('Nama dan nominal kewajiban wajib diisi.', 'danger'); return; }
    this.obligations.push({ id: uid('ob'), name, amount, dueDate: dueEl.value || '', deductFromNet: deductEl.checked, isPaid: false, createdAt: Date.now() });
    saveJSON(OBL_KEY, this.obligations); nameEl.value = ''; amountEl.value = ''; dueEl.value = ''; this.renderFinance();
    this.ctx.toast('Kewajiban berhasil ditambahkan.', 'info');
  },

  openSavingsForm() {
    document.getElementById('cp104FormTitle').textContent = 'Tambah Pos Tabungan';
    document.getElementById('cp104FormFields').innerHTML = '<label>Nama pos<input class="cp104-input" name="name" required placeholder="Contoh: Dana darurat"></label><div class="cp104-row"><label>Target (Rp)<input class="cp104-input" name="target" type="number" min="0" value="0"></label><label>Saldo awal (Rp)<input class="cp104-input" name="balance" type="number" min="0" value="0"></label></div><label>Sumber utama (opsional)<input class="cp104-input" name="source" placeholder="Gaji, bonus, dll."></label>';
    const form = document.getElementById('cp104Form'); form.onsubmit = (e) => { e.preventDefault(); const data = new FormData(form); const name = String(data.get('name') || '').trim(); if (!name) return; this.savings.push({ id: uid('sav'), name, target: Number(data.get('target')) || 0, balance: Number(data.get('balance')) || 0, source: String(data.get('source') || '').trim(), createdAt: Date.now() }); saveJSON(SAV_KEY, this.savings); document.getElementById('cp104FormModal').classList.remove('open'); this.renderFinance(); this.ctx.toast('Pos tabungan berhasil dibuat.', 'info'); };
    document.getElementById('cp104FormModal').classList.add('open'); form.querySelector('[name="name"]').focus();
  },

  openSavingsTransactionForm() {
    if (!this.savings.length) { this.ctx.toast('Buat pos tabungan terlebih dahulu.', 'danger'); return; }
    document.getElementById('cp104FormTitle').textContent = 'Setor / Tarik Tabungan';
    document.getElementById('cp104FormFields').innerHTML = `<label>Pos tabungan<select class="cp104-input" name="index">${this.savings.map((s, i) => `<option value="${i}">${esc(s.name)} — ${rupiah(s.balance)}</option>`).join('')}</select></label><div class="cp104-row"><label>Aksi<select class="cp104-input" name="action"><option value="deposit">Setor</option><option value="withdraw">Tarik</option></select></label><label>Nominal (Rp)<input class="cp104-input" name="amount" type="number" min="1" required value="50000"></label></div>`;
    const form = document.getElementById('cp104Form'); form.onsubmit = (e) => { e.preventDefault(); const data = new FormData(form); const item = this.savings[Number(data.get('index'))]; const amount = Number(data.get('amount')) || 0; if (!item || amount <= 0) return; if (data.get('action') === 'withdraw' && amount > Number(item.balance || 0)) { this.ctx.toast('Saldo tabungan tidak cukup.', 'danger'); return; } item.balance = Number(item.balance || 0) + (data.get('action') === 'deposit' ? amount : -amount); saveJSON(SAV_KEY, this.savings); document.getElementById('cp104FormModal').classList.remove('open'); this.renderFinance(); this.ctx.toast('Saldo tabungan diperbarui.', 'info'); };
    document.getElementById('cp104FormModal').classList.add('open');
  },

  eventDate(note) {
    if (note.eventDate) return String(note.eventDate).slice(0, 10);
    if (note.reminder?.datetime) return String(note.reminder.datetime).slice(0, 10);
    return new Date(note.updatedAt || note.createdAt || Date.now()).toISOString().slice(0, 10);
  },

  renderCalendar() {
    const month = document.getElementById('cp104Month'); const cal = document.getElementById('cp104Calendar');
    if (!month || !cal) return;
    const year = this.calDate.getFullYear(); const monthIndex = this.calDate.getMonth(); const first = new Date(year, monthIndex, 1).getDay(); const days = new Date(year, monthIndex + 1, 0).getDate();
    month.textContent = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(this.calDate);
    cal.innerHTML = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((x) => `<div class="cp104-muted" style="text-align:center;font-weight:700;padding:4px">${x}</div>`).join('');
    for (let i = 0; i < first; i++) cal.insertAdjacentHTML('beforeend', '<div class="cp104-day muted"></div>');
    const notes = this.ctx.getNotes() || [];
    for (let day = 1; day <= days; day++) {
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const events = notes.filter((note) => note.category === 'acara' && this.eventDate(note) === date);
      const cell = document.createElement('div'); cell.className = `cp104-day${date === this.selectedDate ? ' sel' : ''}`; cell.innerHTML = `<b>${day}</b>${events.slice(0, 3).map((note) => `<span class="cp104-dot">🎉 ${esc(note.title)}</span>`).join('')}`; cell.onclick = () => { this.selectedDate = date; this.renderCalendar(); }; cal.appendChild(cell);
    }
    const selectedEvents = notes.filter((note) => note.category === 'acara' && this.eventDate(note) === this.selectedDate);
    const list = document.getElementById('cp104DayEvents');
    document.getElementById('cp104SelCount').textContent = `${selectedEvents.length} acara`;
    list.innerHTML = selectedEvents.length ? selectedEvents.map((note) => `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1;cursor:pointer" data-event-open="${esc(note.id)}"><b>${esc(note.title)}</b><div class="cp104-muted">${note.eventLocation ? `${esc(note.eventLocation)} · ` : ''}${esc(SecurityService.stripHtml(note.bodyHTML || '').slice(0, 120))}</div></div><button type="button" class="cp104-btn" data-event-delete="${esc(note.id)}">Hapus</button></div></div>`).join('') : '<div class="cp104-muted">Tidak ada acara pada tanggal ini.</div>';
    list.querySelectorAll('[data-event-open]').forEach((node) => node.onclick = () => this.ctx.openNote(node.dataset.eventOpen));
    list.querySelectorAll('[data-event-delete]').forEach((node) => node.onclick = async () => this.deleteNote(node.dataset.eventDelete));
  },

  async deleteNote(noteId) {
    if (!window.confirm('Hapus catatan ini?')) return;
    await this.ctx.deleteNote(noteId);
  },

  async batchDelete() {
    const ids = this.ctx.getSelectedIds(); if (!ids.length) return;
    if (!window.confirm(`Hapus ${ids.length} catatan terpilih?`)) return;
    await this.ctx.batchDelete(ids); this.ctx.clearSelection(); this.syncBatchBar();
  },

  async batchMove() {
    const ids = this.ctx.getSelectedIds(); if (!ids.length) return;
    const categories = this.ctx.getCategories().filter((cat) => cat.id !== 'keuangan').map((cat) => `${cat.id} = ${cat.name}`).join('\n');
    const target = window.prompt(`Pilih ID kategori:\n${categories}`);
    if (!target) return;
    await this.ctx.batchMove(ids, target.trim()); this.ctx.clearSelection(); this.syncBatchBar();
  },

  batchExport() {
    const ids = this.ctx.getSelectedIds(); if (!ids.length) return;
    const data = (this.ctx.getNotes() || []).filter((note) => ids.includes(note.id));
    const url = URL.createObjectURL(new Blob([JSON.stringify({ app: 'Catatan Pintar', notes: data }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'catatan-terpilih.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  syncBatchBar() {
    const ids = this.ctx?.getSelectedIds?.() || []; const bar = document.getElementById('cp104Batch'); if (!bar) return;
    bar.classList.toggle('open', ids.length > 0); const count = document.getElementById('cp104BatchCount'); if (count) count.textContent = `${ids.length} dipilih`;
  },

  exportFinance() {
    const payload = { app: 'Catatan Pintar', version: '1.0.4', exportedAt: new Date().toISOString(), transactions: this.getTx().map((n) => ({ id: n.id, title: n.title, type: n.type, amount: n.amount, date: n.date, finance: n.finance })), obligations: this.obligations, savings: this.savings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'catatan-pintar-keuangan-1.0.4.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  buildImageModal() {
    if (document.getElementById('cp104ImageModal')) return;
    const modal = document.createElement('div'); modal.id = 'cp104ImageModal'; modal.className = 'cp104-modal';
    modal.innerHTML = '<div class="cp104-dialog"><div class="cp104-head"><div class="cp104-title">🖼️ Anotasi Gambar</div><button type="button" class="cp104-btn" id="cp104ImgClose">Tutup</button></div><div class="cp104-tools"><button type="button" data-tool="pen">✏️ Pena</button><button type="button" data-tool="line">╱ Garis</button><button type="button" data-tool="rect">□ Kotak</button><button type="button" data-tool="ellipse">○ Elips</button><button type="button" data-tool="arrow">➜ Panah</button><button type="button" data-tool="eraser">⌫ Penghapus</button><button type="button" id="cp104ImgText">Teks</button><input type="color" id="cp104ImgColor" value="#a3402f"><input type="range" id="cp104ImgSize" min="1" max="20" value="4"><button type="button" id="cp104ImgUndo">Undo</button><button type="button" id="cp104ImgRedo">Redo</button><button type="button" id="cp104ImgClear">Bersihkan</button></div><div class="cp104-canvas-wrap"><canvas id="cp104ImgBase"></canvas><canvas id="cp104ImgDraw" style="position:absolute;left:8px;top:8px"></canvas></div><div class="cp104-actions" style="justify-content:flex-end;margin-top:8px"><button type="button" class="cp104-btn" id="cp104ImgCancel">Batal</button><button type="button" class="cp104-btn primary" id="cp104ImgSave">Simpan sebagai lampiran</button></div></div>';
    document.body.appendChild(modal);
    const base = modal.querySelector('#cp104ImgBase'); const draw = modal.querySelector('#cp104ImgDraw'); ImageEditorService.init(base, draw);
    modal.querySelector('#cp104ImgClose').onclick = modal.querySelector('#cp104ImgCancel').onclick = () => modal.classList.remove('open');
    modal.querySelectorAll('[data-tool]').forEach((button) => button.onclick = () => ImageEditorService.setTool(button.dataset.tool));
    modal.querySelector('#cp104ImgColor').oninput = (e) => ImageEditorService.setColor(e.target.value);
    modal.querySelector('#cp104ImgSize').oninput = (e) => ImageEditorService.setSize(e.target.value);
    modal.querySelector('#cp104ImgUndo').onclick = () => ImageEditorService.undo(); modal.querySelector('#cp104ImgRedo').onclick = () => ImageEditorService.redo(); modal.querySelector('#cp104ImgClear').onclick = () => ImageEditorService.clear();
    modal.querySelector('#cp104ImgText').onclick = () => { ImageEditorService.setTool('text'); const text = window.prompt('Teks anotasi:'); if (text) ImageEditorService.addText(20, 30, text); };
    modal.querySelector('#cp104ImgSave').onclick = () => { const data = ImageEditorService.exportFlattened(); const att = { id: uid('img'), name: `anotasi_${today()}.png`, mime: 'image/png', ext: 'png', size: Math.round(data.length * .75), dataURL: data, kind: 'image', createdAt: Date.now() }; this.ctx.openNewNoteWithAttachment(att); modal.classList.remove('open'); this.ctx.toast('Gambar beranotasi siap dilampirkan ke catatan baru.', 'info'); };
  },

  openImageEditor() {
    if (!document.getElementById('cp104ImageModal')) this.buildImageModal();
    let input = document.getElementById('cp104ImagePicker');
    if (!input) {
      input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.id = 'cp104ImagePicker'; input.style.display = 'none'; document.body.appendChild(input);
      input.onchange = () => { const file = input.files?.[0]; input.value = ''; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { await ImageEditorService.loadImage(reader.result); document.getElementById('cp104ImageModal').classList.add('open'); } catch (error) { this.ctx.toast(error.message, 'danger'); } }; reader.readAsDataURL(file); };
    }
    input.click();
  }
};
