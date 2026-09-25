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
import { APP_VERSION } from '../version.js';
import { AttachmentService } from './attachment.js';
import { FinancePdfReportService } from './financePdfReport.js';
import { StorageService } from './storage.js';
import { ExportImportService } from './exportImport.js';

const OBL_KEY = 'cp_obligations_v2';
const SAV_KEY = 'cp_savings_v2';
const HIST_KEY = 'cp_finance_history_v1';
const esc = (v) => SecurityService.escapeHtml(String(v ?? ''));
const rupiah = (v) => 'Rp ' + Number(v || 0).toLocaleString('id-ID');
const localDateFromTimestamp = (value = Date.now()) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const today = () => localDateFromTimestamp();
const uid = (prefix = 'item') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const EVENT_TYPES = [
  { id: 'umum', label: 'Umum', icon: '📌', defaultColor: '#47593f' },
  { id: 'kerja', label: 'Pekerjaan', icon: '💼', defaultColor: '#2563eb' },
  { id: 'pribadi', label: 'Pribadi', icon: '👤', defaultColor: '#10b981' },
  { id: 'rapat', label: 'Rapat / Meeting', icon: '🤝', defaultColor: '#8b5cf6' },
  { id: 'ulang_tahun', label: 'Ulang Tahun / Acara', icon: '🎂', defaultColor: '#ec4899' },
  { id: 'belajar', label: 'Belajar / Kuliah', icon: '📚', defaultColor: '#0d9488' },
  { id: 'kesehatan', label: 'Kesehatan / Janji', icon: '🏥', defaultColor: '#f59e0b' },
  { id: 'mendesak', label: 'Penting / Mendesak', icon: '⭐', defaultColor: '#ef4444' },
  { id: 'lainnya', label: 'Lainnya', icon: '🎈', defaultColor: '#475569' }
];

export const EVENT_COLOR_PRESETS = [
  { name: 'Hijau Lumut', hex: '#47593f' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Biru Samudera', hex: '#2563eb' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Ungu Violet', hex: '#8b5cf6' },
  { name: 'Oranye Amber', hex: '#f59e0b' },
  { name: 'Merah Koral', hex: '#ef4444' },
  { name: 'Merah Muda', hex: '#ec4899' },
  { name: 'Biru Teal', hex: '#0d9488' },
  { name: 'Abu Gelap', hex: '#475569' }
];

export function formatIndonesianDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m - 1, d);
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const dayName = dayNames[dateObj.getDay()] || '';
  const monthName = monthNames[m - 1] || '';
  return `${dayName}, ${d} ${monthName} ${y}`;
}
const loadJSON = (key, fallback = []) => {
  try {
    const state = StorageService.getFinanceState();
    if (key === OBL_KEY) return Array.isArray(state.obligations) ? state.obligations : fallback;
    if (key === SAV_KEY) return Array.isArray(state.savings) ? state.savings : fallback;
    if (key === HIST_KEY) return Array.isArray(state.history) ? state.history : fallback;
    return fallback;
  } catch (_) { return fallback; }
};
const saveJSON = (key, value) => {
  const state = StorageService.getFinanceState();
  if (key === OBL_KEY) state.obligations = Array.isArray(value) ? value : [];
  else if (key === SAV_KEY) state.savings = Array.isArray(value) ? value : [];
  else if (key === HIST_KEY) state.history = Array.isArray(value) ? value.slice(-1000) : [];
  StorageService.saveFinanceState(state);
};
const loadHistory = () => loadJSON(HIST_KEY, []);
const saveHistory = (items) => saveJSON(HIST_KEY, items.slice(-1000));
const addHistory = (entry) => { const items = loadHistory(); items.push({ id: uid('hist'), at: Date.now(), ...entry }); saveHistory(items); };
const fundingLabel = (id, savings = []) => id === 'net' ? 'Dana Bersih' : id === 'other' ? 'Lainnya / sumber manual' : (savings.find(s => s.id === id)?.name || id);
const sumFunding = (funding = []) => funding.reduce((n, x) => n + Number(x.amount || 0), 0);
const debtPaidAmount = (note) => { const f = note?.finance || {}; if (Array.isArray(f.payments) && f.payments.length) return Math.min(Number(f.amount || 0), f.payments.reduce((n,p)=>n+Number(p.amount||0),0)); return Math.min(Number(f.amount || 0), f.debtPaid ? Number(f.amount || 0) : Number(f.paidAmount || 0)); };
const obligationPaidAmount = (item) => Math.min(Number(item?.amount||0), Array.isArray(item?.payments) ? item.payments.reduce((n,p)=>n+Number(p.amount||0),0) : (item?.isPaid ? Number(item?.amount||0) : Number(item?.paidAmount||0)));
const remainingAmount = (total, paid) => Math.max(0, Number(total||0)-Number(paid||0));
const debtPayments = (note) => { const f = note?.finance || {}; if (Array.isArray(f.payments) && f.payments.length) return f.payments; const paid = debtPaidAmount(note); return paid > 0 ? [{ amount: paid, funding: f.funding || (f.debtPaid ? [{ id: 'net', amount: paid }] : []) }] : []; };
const obligationPayments = (item) => Array.isArray(item?.payments) && item.payments.length ? item.payments : (item?.isPaid ? [{ amount: item.amount, funding: item.funding || (item.deductFromNet ? [{ id: 'net', amount: item.amount }] : []) }] : (Number(item?.paidAmount || 0) > 0 ? [{ amount: item.paidAmount, funding: item.funding || [] }] : []));
const netFromPayments = (payments = []) => payments.reduce((n, p) => n + sumFunding((p.funding || []).filter(f => f.id === 'net')), 0);

function addStyle() {
  if (document.getElementById('cp104-style')) return;
  const style = document.createElement('style');
  style.id = 'cp104-style';
  style.textContent = `
    .cp104-nav{position:fixed;left:0;right:0;bottom:0;width:100%;transform:none;z-index:90;display:flex;gap:0;padding:5px 8px calc(5px + env(safe-area-inset-bottom));background:rgba(255,252,244,.98);border-top:1px solid var(--card-edge,#ddd);box-shadow:0 -6px 22px rgba(0,0,0,.12);backdrop-filter:blur(10px);border-radius:0}
    .cp104-nav button{border:0;background:transparent;padding:10px 8px;border-radius:9px;flex:1;min-width:0;font:600 12px inherit;color:var(--ink-soft,#667);cursor:pointer;text-align:center}.cp104-nav button.active{background:var(--ink,#27352b);color:#fff}
    .cp104-panel{position:fixed;inset:0;z-index:80;background:var(--paper,#f8f4e9);overflow-x:hidden;overflow-y:auto;padding:16px 12px 140px;display:none;box-sizing:border-box}.cp104-panel.open{display:block}
    .cp104-head{max-width:960px;margin:0 auto 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;box-sizing:border-box}
    .cp104-title{font:700 20px 'Source Serif 4',Georgia,serif}
    .cp104-actions{display:flex;gap:6px;flex-wrap:wrap}
    .cp104-finance-head .cp104-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;width:100%;max-width:180px;flex:0 0 auto}
    .cp104-finance-head .cp104-actions .cp104-btn{min-height:34px;padding:5px 6px;font-size:11px;line-height:1.15;white-space:nowrap;text-align:center}
    .cp104-finance-head .cp104-actions .cp104-tool-export{background:#f3ead2;border-color:#cdbb88;color:#4b3b1e}
    .cp104-actions .cp104-tool-income{background:#dfead9;border-color:#9eb894;color:#31462d}
    .cp104-actions .cp104-tool-expense{background:#f3ddd8;border-color:#d6a59b;color:#6b3027}
    .cp104-actions .cp104-tool-debt{background:#e5def1;border-color:#b6a4d0;color:#493761}
    .cp104-btn{border:1px solid var(--card-edge,#ddd);background:#fff;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:700;cursor:pointer}
    .cp104-btn.primary{background:var(--ink,#27352b);color:#fff;border-color:var(--ink,#27352b)}
    .cp104-grid{max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:10px;width:100%;box-sizing:border-box}
    .cp104-card{width:100%;box-sizing:border-box;background:#fff;border:1px solid var(--card-edge,#ddd);border-radius:10px;padding:12px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
    .cp104-card h3{margin:0 0 6px;font:700 14px 'Source Serif 4',Georgia,serif}
    .cp104-val{font:700 18px 'IBM Plex Mono',monospace}
    .cp104-muted{font-size:11px;color:var(--ink-soft,#667)}
    .cp104-wide{width:100%}
    .cp104-scroll{overflow:auto;max-height:320px}
    .cp104-input{width:100%;box-sizing:border-box;border:1px solid var(--card-edge,#ddd);border-radius:7px;padding:9px;background:#fff}
    .cp104-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    .cp104-row>*{flex:1;min-width:0}
    .cp104-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;border:1px solid #ddd;font-size:11px;background:#fff}
    .cp104-bar{height:9px;border-radius:8px;background:#eee9dc;overflow:hidden}
    .cp104-bar>i{display:block;height:100%;background:var(--moss,#47593f)}
    .cp104-finance-stats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;box-sizing:border-box}
    .cp104-stat{display:flex;align-items:center;gap:6px;padding:9px 8px;border-radius:12px;border:1px solid var(--card-edge,#ddd);background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04);cursor:pointer;user-select:none;transition:transform .12s ease,box-shadow .12s ease;-webkit-tap-highlight-color:transparent;min-width:0;box-sizing:border-box}
    .cp104-stat:active{transform:scale(.96);box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .cp104-stat:focus-visible{outline:2px solid var(--ink,#27352b);outline-offset:2px}
    .cp104-stat-ico{font-size:16px;width:30px;height:30px;flex:0 0 30px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#f3ead2}
    .cp104-stat-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px;overflow:hidden}
    .cp104-stat-txt .cp104-val{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cp104-stat-txt .cp104-muted{font-size:9px;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cp104-stat-go{font-size:14px;color:var(--ink-soft,#667);flex:0 0 auto;transition:transform .12s ease}
    .cp104-stat:active .cp104-stat-go{transform:translateX(2px)}
    .cp104-stat-net .cp104-stat-ico{background:#f3ead2}
    .cp104-stat-income .cp104-stat-ico{background:#dfead9;color:#31462d}
    .cp104-stat-expense .cp104-stat-ico{background:#f3ddd8;color:#6b3027}
    .cp104-stat-debt .cp104-stat-ico{background:#e5def1;color:#493761}
    .cp104-stat-savings .cp104-stat-ico{background:#dcebf0;color:#274752}
    .cp104-stat-obligation .cp104-stat-ico{background:#f3ead2;color:#4b3b1e}
    .cp104-schedule-card{background:#fffdf9;border:1px solid #e3dccf;border-radius:14px;padding:16px;box-shadow:0 4px 16px rgba(40,30,20,.04)}
    .cp104-schedule-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
    .cp104-month-title-wrap{display:flex;align-items:center;gap:10px}
    .cp104-month-title{font-size:18px;font-weight:800;color:var(--ink,#27352b);letter-spacing:-.01em}
    .cp104-month-badge{font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;background:#f1ebd9;color:#5d513c}
    .cp104-cal-nav-group{display:inline-flex;align-items:center;background:#ede6d6;padding:3px;border-radius:10px;gap:2px}
    .cp104-cal-nav-btn{border:none;background:transparent;padding:5px 11px;border-radius:7px;font-size:12px;font-weight:700;color:var(--ink,#27352b);cursor:pointer;transition:background .15s ease}
    .cp104-cal-nav-btn:hover{background:#fff}
    .cp104-type-filters{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:10px;scrollbar-width:thin}
    .cp104-type-chip{white-space:nowrap;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid #dfd8c8;background:#faf7ee;color:var(--ink-soft,#556);cursor:pointer;transition:all .15s ease}
    .cp104-type-chip:hover{border-color:var(--moss,#47593f);background:#fff}
    .cp104-type-chip.active{background:var(--ink,#27352b);color:#fff;border-color:var(--ink,#27352b)}
    .cp104-type-chip .chip-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
    .cp104-cal-legend{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 10px;font-size:11px;color:var(--ink-soft,#667);align-items:center}
    .cp104-cal-legend span{display:inline-flex;align-items:center;gap:4px}
    .cp104-legend-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:0 0 auto}
    .cp104-legend-dot.today{background:#d1fae5;border:2px solid #10b981;width:7px;height:7px}
    .cp104-legend-dot.sel{background:transparent;border:2px solid var(--ink,#27352b);width:7px;height:7px}
    .cp104-legend-dot.ev{background:var(--moss,#47593f)}
    .cp104-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
    .cp104-cal-head{text-align:center;font-weight:700;padding:4px 0 6px;font-size:11px;color:#736b5e;letter-spacing:.02em}
    .cp104-cal-head.weekend{color:#b91c1c}
    .cp104-day{position:relative;min-height:60px;border:1px solid #e5dfd2;background:#fff;border-radius:9px;padding:5px 4px;font-size:11px;cursor:pointer;display:flex;flex-direction:column;gap:3px;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease;user-select:none;-webkit-tap-highlight-color:transparent}
    .cp104-day:hover{border-color:#b8af9d;box-shadow:0 2px 6px rgba(0,0,0,.03)}
    .cp104-day:active{transform:scale(.94)}
    .cp104-day.muted{visibility:hidden;pointer-events:none}
    .cp104-day.today{border-color:#10b981;background:#f0fdf4}
    .cp104-day.today b{color:#065f46;background:#d1fae5;padding:0 4px;border-radius:4px;display:inline-block;width:fit-content}
    .cp104-day.sel{outline:2px solid var(--ink,#27352b);outline-offset:-1px;box-shadow:0 3px 12px rgba(0,0,0,.12);border-color:var(--ink,#27352b)}
    .cp104-day b{font-weight:700;font-size:12px;color:#2d3748}
    .cp104-day-dots{display:flex;gap:3px;flex-wrap:wrap;align-items:center;margin-top:auto;padding-top:2px}
    .cp104-day-dot{width:7px;height:7px;border-radius:50%;background:var(--moss,#47593f);flex:0 0 auto;transition:transform .1s}
    .cp104-day:hover .cp104-day-dot{transform:scale(1.15)}
    .cp104-day-more{font-size:8.5px;color:#555;font-weight:700;line-height:1;background:#ede6d6;padding:1px 3px;border-radius:3px}
    .cp104-selected-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:16px 0 10px;padding-top:14px;border-top:1px solid #ece4d4}
    .cp104-selected-title{font-size:14.5px;font-weight:800;color:var(--ink,#27352b);display:flex;align-items:center;gap:7px}
    .cp104-event-item{background:#fff;border:1px solid #e8e2d5;border-left:5px solid #47593f;border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;box-shadow:0 2px 6px rgba(0,0,0,.02);transition:transform .15s ease,box-shadow .15s ease}
    .cp104-event-item:hover{box-shadow:0 4px 10px rgba(0,0,0,.05);transform:translateY(-1px)}
    .cp104-event-main{flex:1;min-width:0}
    .cp104-event-top{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:4px}
    .cp104-event-type-tag{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;border:1px solid transparent}
    .cp104-event-title{font-size:14.5px;font-weight:700;color:#1a261c;cursor:pointer}
    .cp104-event-title:hover{text-decoration:underline}
    .cp104-event-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:4px 0 2px}
    .cp104-event-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#4a5568;background:#f7f4ed;padding:2px 8px;border-radius:6px;border:1px solid #ebe4d6}
    .cp104-event-pill.location{background:#eef4f0;color:#204b2b;border-color:#d4e5d8}
    .cp104-event-pill-icon{font-size:12px;line-height:1}
    .cp104-event-desc{font-size:12px;color:#64748b;margin-top:4px;line-height:1.4}
    .cp104-event-actions{display:flex;gap:4px;align-items:center;flex-shrink:0}
    .cp104-btn-icon{border:1px solid #e2dac9;background:#fff;border-radius:7px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;transition:all .15s ease}
    .cp104-btn-icon:hover{background:#f4eee1;border-color:#bbb}
    .cp104-btn-icon.del:hover{background:#fef2f2;border-color:#fca5a5;color:#dc2626}
    .cp104-event-empty{text-align:center;padding:22px 14px;background:#faf8f2;border:1px dashed #ded7c7;border-radius:12px;margin-top:6px}
    .cp104-empty-icon{font-size:28px;margin-bottom:6px}
    .cp104-empty-title{font-size:13.5px;font-weight:700;color:#3b3a36;margin-bottom:3px}
    .cp104-empty-sub{font-size:11.5px;color:#78716c;margin-bottom:12px}
    .cp104-color-palette{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
    .cp104-color-swatch{width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #d6cebf;cursor:pointer;position:relative;transition:transform .15s ease,box-shadow .15s ease}
    .cp104-color-swatch:hover{transform:scale(1.15)}
    .cp104-color-swatch.selected{transform:scale(1.15);box-shadow:0 0 0 2px var(--ink,#27352b)}
    .cp104-color-swatch.selected::after{content:'✓';color:#fff;font-size:12px;font-weight:900;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-shadow:0 1px 2px rgba(0,0,0,.6)}
    .cp104-custom-color-btn{display:inline-flex;align-items:center;gap:4px;height:26px;padding:0 8px;border-radius:13px;border:1px solid #d6cebf;background:#fff;font-size:11px;font-weight:600;color:#555;cursor:pointer}
    .cp104-custom-color-btn input[type=color]{width:16px;height:16px;border:none;padding:0;background:none;cursor:pointer}
    .cp104-event-preview-bar{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:#fdfbf7;border:1px solid #e7dfd0;margin-top:4px;font-size:11.5px;font-weight:600}
    .cp104-preview-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
    .cp104-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:160;display:none;align-items:center;justify-content:center;padding:12px}.cp104-modal.open{display:flex}.cp104-dialog{width:min(760px,100%);max-height:92vh;overflow:auto;background:#fffdf7;border-radius:12px;border:1px solid #ddd5c5;padding:14px}.cp104-form{display:grid;gap:10px}.cp104-form label{display:grid;gap:4px;font-size:12px;font-weight:700}.cp104-check{display:flex!important;grid-template-columns:auto 1fr;align-items:center;gap:7px!important}.cp104-check input{width:auto}.cp104-funding{border:1px dashed #d8d0bf;border-radius:8px;padding:9px;background:#faf7ee}.cp104-funding-search{margin-bottom:7px}.cp104-fund-row{display:grid;grid-template-columns:auto 1fr 120px;gap:7px;align-items:center;padding:5px 0}.cp104-fund-row input[type=number]{width:100%;box-sizing:border-box}.cp104-history{margin-top:8px;border-top:1px solid #eee8dc;padding-top:7px}.cp104-history-item{padding:7px 0;border-bottom:1px solid #eee8dc;font-size:11px}.cp104-help{font-size:11px;color:var(--ink-soft,#667);font-weight:400}
    .cp104-batch{position:fixed;left:10px;right:10px;bottom:74px;z-index:89;display:none;background:#fffdf7;border:1px solid #d8d0bf;border-radius:12px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,.14)}.cp104-batch.open{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.cp104-batch button{border:1px solid #ddd;background:#fff;border-radius:7px;padding:6px 8px;font-size:11px;font-weight:700}
    .cp104-tools{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.cp104-tools button{padding:6px 8px;border:1px solid #ddd;border-radius:7px;background:#fff;cursor:pointer;font-size:11px}.cp104-canvas-wrap{overflow:auto;background:#eee9dc;padding:8px;border-radius:8px;text-align:center;position:relative;min-height:180px}.cp104-canvas-wrap canvas{max-width:100%;touch-action:none;display:block;margin:0 auto}.cp104-canvas-wrap canvas+canvas{position:absolute;left:8px;top:8px;margin:0}.cp104-inline-note{display:inline-flex;align-items:center;gap:6px;padding:3px 8px;margin:2px 3px;border:1px solid var(--card-edge,#d8d0bb);border-radius:7px;background:#faf7ef;cursor:pointer;user-select:none}.cp104-inline-note:hover{border-color:var(--moss,#47593f);background:#f4f0e5}.cp104-inline-note small{color:var(--ink-soft,#667);font-size:9px}
    @media(max-width:650px){.cp104-head{gap:7px}.cp104-finance-head .cp104-actions{grid-template-columns:repeat(2,minmax(0,1fr));max-width:160px}.cp104-finance-head .cp104-actions .cp104-btn{font-size:10px;padding:5px 4px}.cp104-finance-stats-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.cp104-stat{padding:7px 6px;gap:5px}.cp104-stat-ico{width:26px;height:26px;flex-basis:26px;font-size:14px;border-radius:7px}.cp104-stat-txt .cp104-val{font-size:12px}.cp104-stat-txt .cp104-muted{font-size:8.5px}.cp104-day{min-height:48px;padding:4px 3px}.cp104-nav button{padding:9px 5px}.cp104-title{font-size:18px}.cp104-schedule-toolbar{gap:8px}.cp104-month-title{font-size:16px}.cp104-event-item{padding:8px 10px}}
  `;
  document.head.appendChild(style);
}

export const FeaturePackService = {
  ctx: null,
  obligations: [],
  savings: [],
  calDate: new Date(),
  selectedDate: today(),
  eventFilterType: 'all',
  _bound: false,
  _imageEditAttachmentId: null,
  _imageInsertionMarkerId: null,

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
        <div class="cp104-head cp104-finance-head">
          <div><div class="cp104-title">💰 Keuangan</div><div class="cp104-muted">Pemasukan, pengeluaran, hutang, kewajiban dan tabungan tersimpan di data aplikasi.</div></div>
          <div class="cp104-actions"><button type="button" class="cp104-btn cp104-tool-export" id="cp104ExportFinance">📤 Ekspor</button><button type="button" class="cp104-btn cp104-tool-income" id="cp104AddIncome">＋ Pemasukan</button><button type="button" class="cp104-btn cp104-tool-expense" id="cp104AddExpense">－ Pengeluaran</button><button type="button" class="cp104-btn cp104-tool-debt" id="cp104AddDebt">＋ Hutang</button></div>
        </div>
        <div class="cp104-grid cp104-finance-sections">
          <div class="cp104-finance-stats-grid">
            <div class="cp104-stat cp104-stat-net" id="cp104HistoryNet" role="button" tabindex="0" aria-label="Lihat Riwayat Saldo Bersih"><span class="cp104-stat-ico">💰</span><span class="cp104-stat-txt"><span class="cp104-muted">Saldo Bersih</span><span class="cp104-val" id="cp104Balance">Rp 0</span></span><span class="cp104-stat-go">›</span></div>
            <div class="cp104-stat cp104-stat-income" id="cp104HistoryIncome" role="button" tabindex="0" aria-label="Lihat Riwayat Pemasukan"><span class="cp104-stat-ico">⬆️</span><span class="cp104-stat-txt"><span class="cp104-muted">Pemasukan</span><span class="cp104-val" id="cp104Income">Rp 0</span></span><span class="cp104-stat-go">›</span></div>
            <div class="cp104-stat cp104-stat-expense" id="cp104HistoryExpense" role="button" tabindex="0" aria-label="Lihat Riwayat Pengeluaran"><span class="cp104-stat-ico">⬇️</span><span class="cp104-stat-txt"><span class="cp104-muted">Pengeluaran</span><span class="cp104-val" id="cp104Expense">Rp 0</span></span><span class="cp104-stat-go">›</span></div>
            <div class="cp104-stat cp104-stat-debt" id="cp104HistoryDebt" role="button" tabindex="0" aria-label="Lihat Riwayat Hutang"><span class="cp104-stat-ico">🧾</span><span class="cp104-stat-txt"><span class="cp104-muted">Hutang</span><span class="cp104-val" id="cp104Debt">Rp 0</span></span><span class="cp104-stat-go">›</span></div>
            <div class="cp104-stat cp104-stat-savings" id="cp104HistorySavings" role="button" tabindex="0" aria-label="Lihat Riwayat Tabungan"><span class="cp104-stat-ico">🐷</span><span class="cp104-stat-txt"><span class="cp104-muted">Tabungan</span><span class="cp104-val" id="cp104Savings">Rp 0</span></span><span class="cp104-stat-go">›</span></div>
            <div class="cp104-stat cp104-stat-obligation" id="cp104HistoryObligations" role="button" tabindex="0" aria-label="Lihat Riwayat Pengeluaran Wajib"><span class="cp104-stat-ico">📌</span><span class="cp104-stat-txt"><span class="cp104-muted">Pengeluaran Wajib</span><span class="cp104-val" id="cp104Obligation">Rp 0</span></span><span class="cp104-stat-go">›</span></div>
          </div>
          <div class="cp104-card cp104-wide"><div class="cp104-row"><input class="cp104-input" type="date" id="cp104FinFrom"><input class="cp104-input" type="date" id="cp104FinTo"><button type="button" class="cp104-btn" id="cp104ResetFin">Semua tanggal</button></div><div style="height:10px"></div><div id="cp104FinanceChart"></div></div>
          <div class="cp104-card cp104-wide"><h3>Transaksi</h3><div class="cp104-scroll" id="cp104TxList"></div><div class="cp104-history"><button type="button" class="cp104-btn" id="cp104HistoryAll">Riwayat Semua Dana & Transaksi</button></div></div>
          <div class="cp104-card cp104-wide"><h3>Hutang</h3><div class="cp104-scroll" id="cp104DebtList"></div></div>
          <div class="cp104-card cp104-wide"><div class="cp104-row"><h3 style="margin-right:auto">Dana Pengeluaran Wajib</h3><button type="button" class="cp104-btn" id="cp104AddOb">+ Tambah</button></div><div class="cp104-row"><input class="cp104-input" id="cp104ObName" placeholder="Nama kewajiban"><input class="cp104-input" id="cp104ObAmount" type="number" min="0" placeholder="Nominal"><input class="cp104-input" id="cp104ObDue" type="date"></div><div class="cp104-help">Sumber dana dipilih saat kewajiban dibayar. Bisa Dana Bersih, satu/lebih tabungan, atau Lainnya.</div><div class="cp104-scroll" id="cp104ObList"></div></div>
          <div class="cp104-card cp104-wide"><div class="cp104-row"><h3 style="margin-right:auto">Pos Tabungan</h3><button type="button" class="cp104-btn" id="cp104AddSav">+ Pos Baru</button><button type="button" class="cp104-btn" id="cp104DepositSav">Setor / Tarik</button></div><div class="cp104-scroll" id="cp104SavList"></div></div>
        </div>`;
      document.body.appendChild(fin);
    }

    if (!document.getElementById('cp104Schedule')) {
      const sch = document.createElement('section');
      sch.id = 'cp104Schedule';
      sch.className = 'cp104-panel';
      sch.innerHTML = `
        <div class="cp104-head cp104-schedule-head">
          <div>
            <div class="cp104-title">📅 Jadwal & Acara</div>
            <div class="cp104-muted">Kelola kegiatan, jadwal rapat, dan janji temu dengan kalender warna terstruktur.</div>
          </div>
          <div class="cp104-actions">
            <button type="button" class="cp104-btn primary" id="cp104AddEvent">＋ Tambah Acara</button>
          </div>
        </div>
        <div class="cp104-card cp104-schedule-card" style="max-width:960px;margin:auto">
          <div class="cp104-schedule-toolbar">
            <div class="cp104-month-title-wrap">
              <span class="cp104-month-title" id="cp104Month"></span>
              <span class="cp104-month-badge" id="cp104SelCount">0 acara</span>
            </div>
            <div class="cp104-cal-nav-group">
              <button type="button" class="cp104-cal-nav-btn" id="cp104Prev" title="Bulan Sebelumnya">‹</button>
              <button type="button" class="cp104-cal-nav-btn" id="cp104Today" title="Ke Hari Ini">Hari ini</button>
              <button type="button" class="cp104-cal-nav-btn" id="cp104Next" title="Bulan Berikutnya">›</button>
            </div>
          </div>

          <div class="cp104-type-filters" id="cp104TypeFilters"></div>

          <div class="cp104-cal-legend">
            <span><i class="cp104-legend-dot today"></i>Hari ini</span>
            <span><i class="cp104-legend-dot sel"></i>Terpilih</span>
            <span><i class="cp104-legend-dot ev" style="background:#47593f"></i>Titik warna = Acara terjadwal</span>
          </div>

          <div class="cp104-cal" id="cp104Calendar"></div>

          <div class="cp104-selected-header">
            <div class="cp104-selected-title">
              <span>🗓️</span>
              <span id="cp104SelectedDateLabel">Acara pada tanggal terpilih</span>
              <span class="cp104-month-badge" id="cp104DayCountBadge">0</span>
            </div>
            <button type="button" class="cp104-btn" id="cp104QuickAddDayBtn" style="font-size:11px;padding:4px 9px">＋ Acara di Tanggal Ini</button>
          </div>
          <div class="cp104-scroll" id="cp104DayEvents"></div>
        </div>`;
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
    if (fin && !document.getElementById('cp104EditorFunding')) {
      const wrap = document.createElement('div'); wrap.id='cp104EditorFunding'; wrap.style.cssText='display:none;margin-top:8px';
      wrap.innerHTML=this.fundingPickerHTML([{id:'net',amount:0}],0,null);
      fin.parentElement?.appendChild(wrap);
    }
    const rem = document.getElementById('reminderRow');
    if (rem && !document.getElementById('cp104ScheduleExtra')) {
      const row = document.createElement('div');
      row.id = 'cp104ScheduleExtra'; row.style.cssText = 'display:none;margin-top:8px';
      row.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Jenis Acara</label>
            <select id="cp104EventType" class="cp104-input">
              ${EVENT_TYPES.map(t => `<option value="${t.id}">${t.icon} ${t.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">Warna Kalender</label>
            <div style="display:flex;align-items:center;gap:6px">
              <input id="cp104EventColor" class="cp104-input" type="color" value="#47593f" style="width:38px;height:34px;padding:2px;cursor:pointer">
              <span id="cp104EventColorLabel" style="font-size:11px;color:var(--ink-soft,#667)">Warna kartu & titik</span>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">📅 Tanggal Acara</label>
            <input id="cp104EventDate" class="cp104-input" type="date">
          </div>
          <div>
            <label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px">🕐 Jam Acara</label>
            <input id="cp104EventTime" class="cp104-input" type="time" value="09:00">
          </div>
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;margin-bottom:3px">
            <span>📍</span> Lokasi acara
          </label>
          <input id="cp104EventLocation" class="cp104-input" placeholder="Contoh: Gedung A, Ruang Rapat 2, atau Google Meet">
        </div>
      `;
      rem.parentElement?.appendChild(row);
      const typeSelect = row.querySelector('#cp104EventType');
      const colorInput = row.querySelector('#cp104EventColor');
      if (typeSelect && colorInput) {
        typeSelect.addEventListener('change', () => {
          const match = EVENT_TYPES.find(t => t.id === typeSelect.value);
          if (match && match.defaultColor) colorInput.value = match.defaultColor;
        });
      }
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
    document.getElementById('cp104HistoryAll').onclick = () => this.openHistoryModal();
    document.getElementById('cp104HistoryNet').onclick = () => this.openSectionHistory('net','Riwayat Saldo Bersih');
    document.getElementById('cp104HistoryIncome').onclick = () => this.openSectionHistory('income','Riwayat Pemasukan');
    document.getElementById('cp104HistoryExpense').onclick = () => this.openSectionHistory('expense','Riwayat Pengeluaran');
    document.getElementById('cp104HistoryDebt').onclick = () => this.openSectionHistory('debt','Riwayat Hutang');
    document.getElementById('cp104HistorySavings').onclick = () => this.openSectionHistory('savings','Riwayat Tabungan');
    document.getElementById('cp104HistoryObligations').onclick = () => this.openSectionHistory('obligation','Riwayat Pengeluaran Wajib');
    document.querySelectorAll('.cp104-stat[role="button"]').forEach((el) => el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } }));
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
    const quickAddBtn = document.getElementById('cp104QuickAddDayBtn');
    if (quickAddBtn) quickAddBtn.onclick = () => this.openEventForm(this.selectedDate);

    const syncEditorExtras = () => {
      const category = document.getElementById('categorySelect')?.value;
      const type = document.getElementById('financeType')?.value;
      const eventRow = document.getElementById('cp104ScheduleExtra');
      const financeRow = document.getElementById('cp104FinanceExtra');
      if (eventRow) eventRow.style.display = category === 'acara' ? 'block' : 'none';
      if (financeRow) financeRow.style.display = category === 'keuangan' ? 'flex' : 'none';
      const editorFunding = document.getElementById('cp104EditorFunding');
      if (editorFunding) editorFunding.style.display = category === 'keuangan' && type === 'expense' ? 'block' : 'none';
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
    document.getElementById('cp104ImageBtn')?.addEventListener('mousedown', () => { try { this._imageInsertionMarkerId = this.ctx.createEditorInsertionMarker?.() || null; } catch (_) { this._imageInsertionMarkerId = null; } });
    document.getElementById('cp104ImageBtn')?.addEventListener('click', () => this.openImageEditor(null, this._imageInsertionMarkerId));
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

  setEditorFunding(funding = [], amount = 0, excludeNoteId = null) {
    const wrap=document.getElementById('cp104EditorFunding'); if(!wrap)return;
    wrap.innerHTML=this.fundingPickerHTML(funding.length?funding:[{id:'net',amount}],amount,excludeNoteId, funding);
    const form=wrap.closest('.finance-row')?.parentElement || document;
    const amountInput=document.getElementById('financeAmount');
    this.bindFundingPicker(wrap,amountInput);
    wrap.querySelector('#cp104FundingSearch')?.addEventListener('input',()=>{});
  },

  readEditorFunding(amount, existingNote = null) {
    const wrap=document.getElementById('cp104EditorFunding');
    if(!wrap || getComputedStyle(wrap).display==='none') return [{id:'net',amount:Number(amount)||0}];
    const existingFunding = Array.isArray(existingNote?.finance?.funding) ? existingNote.finance.funding : [];
    return this.readFunding(wrap,amount,existingNote?.id || null,existingFunding);
  },

  applyEditorFunding(funding, existingNote = null) {
    const old = existingNote?.finance?.funding || (existingNote?.finance?.type==='expense' ? [{id:'net',amount:Number(existingNote.finance.amount)||0}] : []);
    if(existingNote?.finance?.type==='expense') this.applySavingsDelta(old,1);
    this.applySavingsDelta(funding,-1);
  },

  getTxBase() {
    const notes = this.ctx?.getNotes?.() || [];
    return notes.filter((note) => note.category === 'keuangan' && note.finance).map((note) => {
      const amount = Number(note.finance.amount) || 0;
      const type = note.finance.type || 'expense';
      return {
        ...note,
        amount,
        type,
        date: note.finance.date || localDateFromTimestamp(note.updatedAt || note.createdAt || Date.now()),
        funding: Array.isArray(note.finance.funding) && note.finance.funding.length ? note.finance.funding : [{ id: 'net', amount }],
        paidAmount: type === 'debt' ? debtPaidAmount(note) : Number(note.finance.paidAmount || 0),
        payments: Array.isArray(note.finance.payments) ? note.finance.payments : []
      };
    });
  },

  getBaseNetBalance(excludeNoteId = null) {
    const tx = this.getTxBase().filter(n => n.id !== excludeNoteId);
    const income = tx.filter(x => x.type === 'income').reduce((n,x)=>n+x.amount,0);
    const netExpense = tx.filter(x => x.type === 'expense').reduce((n,x)=>n+sumFunding(x.funding.filter(f=>f.id==='net')),0);
    const netDebtPayment = tx.filter(x => x.type === 'debt').reduce((n,x)=>n+netFromPayments(debtPayments(x)),0);
    const netObligation = this.obligations.reduce((n,x)=>n+netFromPayments(obligationPayments(x)),0);
    return income - netExpense - netDebtPayment - netObligation;
  },

  getFundingSources(excludeNoteId = null, currentFunding = []) {
    const net = this.getBaseNetBalance(excludeNoteId) + sumFunding(currentFunding.filter(f=>f.id==='net'));
    const sources = [{ id:'net', label:'Dana Bersih', balance:net }];
    this.savings.forEach(s => {
      const current = sumFunding(currentFunding.filter(f=>f.id===s.id));
      sources.push({ id:s.id, label:s.name, balance:Number(s.balance||0)+current });
    });
    sources.push({ id:'other', label:'Lainnya / sumber manual', balance:null });
    return sources;
  },

  fundingPickerHTML(selected = [], amount = 0, excludeNoteId = null, availableAdjustment = []) {
    const sources = this.getFundingSources(excludeNoteId, availableAdjustment);
    const selectedMap = Object.fromEntries(selected.map(f=>[f.id,Number(f.amount)||0]));
    return `<div class="cp104-funding"><b>Sumber dana</b><div class="cp104-help">Pilih satu atau beberapa sumber. Jumlah seluruh sumber harus tepat sama dengan nominal.</div><input class="cp104-input cp104-funding-search" id="cp104FundingSearch" placeholder="🔎 Cari sumber dana…"><div id="cp104FundingRows">${sources.map(src=>`<label class="cp104-fund-row" data-fund-label="${esc(src.label).toLowerCase()}"><input type="checkbox" name="fundSource" value="${esc(src.id)}" ${selectedMap[src.id] != null ? 'checked' : ''}><span>${esc(src.label)}${src.balance != null ? ` <small>(${rupiah(src.balance)})</small>` : ''}</span><input class="cp104-input" type="number" min="0" step="1" name="fundAmount:${esc(src.id)}" value="${selectedMap[src.id] || ''}" placeholder="Rp"></label>`).join('')}</div><label style="display:none" id="cp104OtherSourceWrap">Nama sumber manual<input class="cp104-input" name="otherSource" placeholder="Contoh: Uang tunai, pasangan, rekening lain"></label><div class="cp104-help" id="cp104FundingTotal">Terpakai: Rp 0 / ${rupiah(amount)}</div></div>`;
  },

  bindFundingPicker(form, amountInput) {
    const search = form.querySelector('#cp104FundingSearch');
    const rows = () => Array.from(form.querySelectorAll('.cp104-fund-row'));
    const sync = () => {
      const term=(search?.value||'').toLowerCase().trim(); rows().forEach(r=>r.style.display=!term||r.dataset.fundLabel.includes(term)?'grid':'none');
      const selected=Array.from(form.querySelectorAll('input[name="fundSource"]:checked')).map(c=>c.value);
      form.querySelector('#cp104OtherSourceWrap')?.style.setProperty('display',selected.includes('other')?'grid':'none');
      const total=selected.reduce((n,id)=>n+(Number(form.querySelector(`[name="fundAmount:${CSS.escape(id)}"]`)?.value)||0),0);
      const target=Number(amountInput?.value)||0; const node=form.querySelector('#cp104FundingTotal'); if(node) node.textContent=`Terpakai: ${rupiah(total)} / ${rupiah(target)}`;
      const netCb=form.querySelector('input[name="fundSource"][value="net"]'); if(netCb && selected.length===1 && netCb.checked){ const inp=form.querySelector('[name="fundAmount:net"]'); if(inp && !inp.dataset.touched) inp.value=target||''; }
    };
    search?.addEventListener('input',sync);
    form.querySelectorAll('input[name="fundSource"]').forEach(cb=>cb.addEventListener('change',()=>{ const inp=form.querySelector(`[name="fundAmount:${CSS.escape(cb.value)}"]`); if(cb.checked && inp && !inp.value) inp.value=Number(amountInput?.value)||''; if(!cb.checked&&inp) inp.value=''; sync(); }));
    form.querySelectorAll('input[name^="fundAmount:"]').forEach(inp=>inp.addEventListener('input',()=>{inp.dataset.touched='1';sync();}));
    amountInput?.addEventListener('input',()=>{ const net=form.querySelector('input[name="fundSource"][value="net"]:checked'); if(net){const inp=form.querySelector('[name="fundAmount:net"]');if(inp&&!inp.dataset.touched)inp.value=Number(amountInput.value)||'';} sync(); });
    sync();
  },

  readFunding(form, amount, excludeNoteId = null, availableAdjustment = []) {
    const ids=Array.from(form.querySelectorAll('input[name="fundSource"]:checked')).map(c=>c.value);
    const funding=ids.map(id=>({id,amount:Number(form.querySelector(`[name="fundAmount:${CSS.escape(id)}"]`)?.value)||0})).filter(x=>x.amount>0);
    if(sumFunding(funding)!==Number(amount)){ throw new Error(`Jumlah sumber dana ${rupiah(sumFunding(funding))} harus sama dengan nominal ${rupiah(amount)}.`); }
    const sources=this.getFundingSources(excludeNoteId, availableAdjustment);
    for(const f of funding){const src=sources.find(s=>s.id===f.id); if(src?.balance!=null && f.amount>src.balance) throw new Error(`Saldo ${src.label} tidak cukup. Tersedia ${rupiah(src.balance)}.`);}
    if(funding.some(f=>f.id==='other')){const manual=String(form.querySelector('[name="otherSource"]')?.value||'').trim();if(!manual)throw new Error('Isi nama sumber manual jika memilih Lainnya.');funding.find(f=>f.id==='other').label=manual;}
    return funding;
  },

  applySavingsDelta(funding, sign=1) {
    const items = (funding || []).filter((f) => f && f.id !== 'other' && f.id !== 'net' && Number(f.amount || 0) > 0);
    // Validate the whole operation before mutating anything. This prevents a
    // multi-source payment from partially changing balances when one source fails.
    if (sign < 0) {
      for (const f of items) {
        const s = this.savings.find(x => x.id === f.id);
        if (!s) throw new Error('Pos tabungan sumber dana tidak ditemukan.');
        if (Number(f.amount || 0) > Number(s.balance || 0)) throw new Error(`Saldo tabungan ${s.name} tidak mencukupi.`);
      }
    } else {
      for (const f of items) {
        if (!this.savings.some(x => x.id === f.id)) throw new Error('Pos tabungan sumber dana tidak ditemukan.');
      }
    }
    for (const f of items) {
      const s = this.savings.find(x => x.id === f.id);
      s.balance = Number(s.balance || 0) + sign * Number(f.amount || 0);
    }
    saveJSON(SAV_KEY,this.savings);
  },

  sourceSummary(funding=[]) { return funding.map(f=>`${esc(f.label || fundingLabel(f.id,this.savings))}: ${rupiah(f.amount)}`).join(' + ') || '—'; },

  async recordFundingHistory(entityType, entityId, action, amount, funding, extra={}) {
    const normalized=(funding||[]).map(f=>({id:f.id,label:f.label||fundingLabel(f.id,this.savings),amount:Number(f.amount)||0}));
    addHistory({entityType,entityId,action,amount:Number(amount)||0,funding:normalized,...extra});
    // Salin juga ke riwayat masing-masing sumber internal agar setiap dana punya audit trail sendiri.
    normalized.forEach(f=>{
      if(f.id==='net') addHistory({entityType:'net',entityId:'net',action,amount:f.amount,funding:[f],relatedEntityId:entityId,...extra});
      else if(this.savings.some(s=>s.id===f.id)) addHistory({entityType:'savings',entityId:f.id,action,amount:f.amount,funding:[f],relatedEntityId:entityId,...extra});
    });
    if(entityType==='transaction' && action.toLowerCase().includes('pemasukan')) addHistory({entityType:'net',entityId:'net',action:'Pemasukan ke Dana Bersih',amount:Number(amount)||0,funding:[{id:'net',label:'Dana Bersih',amount:Number(amount)||0}],relatedEntityId:entityId,...extra});
  },

  openSectionHistory(section, title) {
    const all = loadHistory();
    const matches = all.filter(h => {
      if (section === 'income') return h.entityType === 'transaction' && String(h.action || '').toLowerCase().includes('pemasukan');
      if (section === 'expense') return h.entityType === 'transaction' && String(h.action || '').toLowerCase().includes('pengeluaran');
      if (section === 'debt') return h.entityType === 'transaction' && (String(h.action || '').toLowerCase().includes('hutang') || String(h.action || '').toLowerCase().includes('cicilan'));
      if (section === 'net') return h.entityType === 'net';
      if (section === 'savings') return h.entityType === 'savings';
      if (section === 'obligation') return h.entityType === 'obligation';
      return false;
    }).sort((a,b)=>b.at-a.at);
    this.openHistoryModal('__section__', '__section__', title, matches);
  },

  openHistoryModal(entityType=null, entityId=null, title='Riwayat Transaksi', prefiltered=null) {
    let modal=document.getElementById('cp104HistoryModal');
    if(!modal){modal=document.createElement('div');modal.id='cp104HistoryModal';modal.className='cp104-modal';modal.innerHTML='<div class="cp104-dialog"><div class="cp104-head"><div class="cp104-title" id="cp104HistoryTitle">Riwayat Transaksi</div><button type="button" class="cp104-btn" id="cp104HistoryClose">Tutup</button></div><div class="cp104-scroll" id="cp104HistoryList"></div></div>';document.body.appendChild(modal);modal.querySelector('#cp104HistoryClose').onclick=()=>modal.classList.remove('open');}
    const all=(Array.isArray(prefiltered) ? prefiltered : loadHistory().filter(h=>{
      const typeOk = !entityType || (Array.isArray(entityType) ? entityType.includes(h.entityType) : h.entityType===entityType);
      return typeOk && (!entityId||h.entityId===entityId);
    })).sort((a,b)=>b.at-a.at);
    document.getElementById('cp104HistoryTitle').textContent=title;
    document.getElementById('cp104HistoryList').innerHTML=all.length?all.map(h=>`<div class="cp104-history-item"><b>${esc(h.action)}</b> · ${rupiah(h.amount)}<div>${esc(new Date(h.at).toLocaleString('id-ID'))}</div><div>Sumber: ${this.sourceSummary(h.funding||[])}</div>${h.note?`<div>${esc(h.note)}</div>`:''}</div>`).join(''):'<div class="cp104-muted">Belum ada riwayat.</div>';
    modal.classList.add('open');
  },

  getTx() {
    const from = document.getElementById('cp104FinFrom')?.value || '';
    const to = document.getElementById('cp104FinTo')?.value || '';
    return this.getTxBase().filter((note) => (!from || note.date >= from) && (!to || note.date <= to)).sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  renderFinance() {
    this.obligations = loadJSON(OBL_KEY, []);
    this.savings = loadJSON(SAV_KEY, []);
    const tx = this.getTx();
    const income = tx.filter((x) => x.type === 'income').reduce((sum, x) => sum + x.amount, 0);
    const expense = tx.filter((x) => x.type === 'expense').reduce((sum, x) => sum + x.amount, 0);
    const debt = tx.reduce((sum, x) => x.type === 'debt' ? sum + remainingAmount(x.amount, debtPaidAmount(x)) : sum, 0);
    const obligation = this.obligations.reduce((sum, x) => sum + remainingAmount(x.amount, obligationPaidAmount(x)), 0);
    const savings = this.savings.reduce((sum, x) => sum + Number(x.balance || 0), 0);
    const netExpense = tx.filter(x=>x.type==='expense').reduce((n,x)=>n+sumFunding(x.funding.filter(f=>f.id==='net')),0);
    const paidDebtNet = tx.filter(x=>x.type==='debt').reduce((n,x)=>n+netFromPayments(debtPayments(x)),0);
    const paidObNet = this.obligations.reduce((n,x)=>n+netFromPayments(obligationPayments(x)),0);
    const balance = income - netExpense - paidDebtNet - paidObNet;
    const values = { Income: income, Expense: expense, Balance: balance, Debt: debt, Obligation: obligation, Savings: savings };
    Object.entries(values).forEach(([key, value]) => { const node = document.getElementById(`cp104${key}`); if (node) node.textContent = rupiah(value); });

    const max = Math.max(income, expense, debt, 1);
    const chart = document.getElementById('cp104FinanceChart');
    if (chart) chart.innerHTML = `<div class="cp104-muted">Arus kas</div><div style="display:flex;gap:10px;align-items:flex-end;height:100px;margin-top:8px"><div style="flex:1;text-align:center"><div class="cp104-bar"><i style="width:${Math.round(income / max * 100)}%"></i></div><small>Pemasukan<br>${rupiah(income)}</small></div><div style="flex:1;text-align:center"><div class="cp104-bar"><i style="width:${Math.round(expense / max * 100)}%;background:var(--danger,#a3402f)"></i></div><small>Pengeluaran<br>${rupiah(expense)}</small></div><div style="flex:1;text-align:center"><div class="cp104-bar"><i style="width:${Math.round(debt / max * 100)}%;background:#b8922f"></i></div><small>Hutang<br>${rupiah(debt)}</small></div></div>`;

    const list = document.getElementById('cp104TxList');
    if (list) {
      list.innerHTML = tx.length ? tx.slice(0, 50).map((note) => `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1;cursor:pointer" data-tx-open="${esc(note.id)}"><b>${esc(note.title)}</b><div class="cp104-muted">${note.type === 'income' ? '+' : '-'} ${rupiah(note.amount)} · ${esc(note.date)}</div>${note.type==='expense'?`<div class="cp104-help">Sumber: ${this.sourceSummary(note.funding)}</div>`:''}</div><button type="button" class="cp104-btn" data-tx-history="${esc(note.id)}">Riwayat</button><button type="button" class="cp104-btn" data-tx-delete="${esc(note.id)}">Hapus</button></div></div>`).join('') : '<div class="cp104-muted">Belum ada transaksi.</div>';
      list.querySelectorAll('[data-tx-open]').forEach((node) => node.onclick = () => this.ctx.openNote(node.dataset.txOpen));
      list.querySelectorAll('[data-tx-history]').forEach((node) => node.onclick = () => this.openHistoryModal('transaction', node.dataset.txHistory, 'Riwayat Transaksi'));
      list.querySelectorAll('[data-tx-delete]').forEach((node) => node.onclick = async () => { await this.deleteNote(node.dataset.txDelete); });
    }

    const debts = tx.filter((note) => note.type === 'debt');
    const debtList = document.getElementById('cp104DebtList');
    if (debtList) {
      debtList.innerHTML = debts.length ? debts.map((note) => { const paid=debtPaidAmount(note); const pct=note.amount?Math.min(100,Math.round(paid/note.amount*100)):0; const remain=remainingAmount(note.amount,paid); return `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1;cursor:pointer" data-debt-open="${esc(note.id)}"><b>${esc(note.title)}</b><div class="cp104-muted">Total ${rupiah(note.amount)} · Dibayar ${rupiah(paid)} · Sisa ${rupiah(remain)} · kepada ${esc(note.finance.debtTo || '-')}</div><div class="cp104-bar" style="margin-top:5px"><i style="width:${pct}%"></i></div><div class="cp104-muted">Progres ${pct}%</div></div><button type="button" class="cp104-btn primary" data-debt-pay="${esc(note.id)}">${remain>0?'Bayar / Cicil':'Lunas'}</button><button type="button" class="cp104-btn" data-debt-history="${esc(note.id)}">Riwayat</button></div></div>`; }).join('') : '<div class="cp104-muted">Belum ada hutang.</div>';
      debtList.querySelectorAll('[data-debt-open]').forEach((node) => node.onclick = () => this.ctx.openNote(node.dataset.debtOpen));
      debtList.querySelectorAll('[data-debt-pay]').forEach((node) => node.onclick = () => { const note=(this.ctx.getNotes()||[]).find(x=>x.id===node.dataset.debtPay); if(note) this.openDebtPaymentForm(note); });
      debtList.querySelectorAll('[data-debt-history]').forEach((node) => node.onclick = () => this.openHistoryModal('transaction', node.dataset.debtHistory, 'Riwayat Hutang'));
    }

    const obList = document.getElementById('cp104ObList');
    if (obList) {
      obList.innerHTML = this.obligations.length ? this.obligations.map((item, i) => { const paid=obligationPaidAmount(item); const pct=item.amount?Math.min(100,Math.round(paid/item.amount*100)):0; const remain=remainingAmount(item.amount,paid); return `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1"><b>${esc(item.name)}</b><div class="cp104-muted">Target ${rupiah(item.amount)} · Terbayar ${rupiah(paid)} · Sisa ${rupiah(remain)}${item.dueDate ? ` · jatuh tempo ${esc(item.dueDate)}` : ''}</div><div class="cp104-bar" style="margin-top:5px"><i style="width:${pct}%"></i></div><div class="cp104-muted">Progres ${pct}%</div></div><button type="button" class="cp104-btn primary" data-ob-toggle="${i}">${remain>0?'Bayar / Cicil':'Lunas'}</button><button type="button" class="cp104-btn" data-ob-history="${esc(item.id)}">Riwayat</button><button type="button" class="cp104-btn" data-ob-del="${i}">×</button></div></div>`; }).join('') : '<div class="cp104-muted">Belum ada kewajiban.</div>';
      obList.querySelectorAll('[data-ob-toggle]').forEach((button) => button.onclick = () => { const i=Number(button.dataset.obToggle); if(this.obligations[i]?.isPaid) this.unpayObligation(i); else this.openObligationPaymentForm(i); });
      obList.querySelectorAll('[data-ob-history]').forEach((button) => button.onclick = () => this.openHistoryModal('obligation', button.dataset.obHistory, 'Riwayat Dana Pengeluaran Wajib'));
      obList.querySelectorAll('[data-ob-del]').forEach((button) => button.onclick = () => { const i=Number(button.dataset.obDel); const item=this.obligations[i]; if(!item)return; const payments=Array.isArray(item.payments)&&item.payments.length?item.payments:(item.isPaid?[{amount:item.amount,funding:item.funding||[]}]:[]); payments.forEach(p=>this.applySavingsDelta(p.funding||[],1)); if(payments.length) this.recordFundingHistory('obligation',item.id,'Hapus dana wajib',payments.reduce((n,p)=>n+Number(p.amount||0),0),[],{note:'Saldo sumber tabungan dari seluruh pembayaran dikembalikan.'}); this.obligations.splice(i,1); saveJSON(OBL_KEY, this.obligations); this.renderFinance(); });
    }

    const savList = document.getElementById('cp104SavList');
    if (savList) {
      savList.innerHTML = this.savings.length ? this.savings.map((item, i) => { const pct = item.target ? Math.min(100, Math.round(Number(item.balance || 0) / Number(item.target) * 100)) : 0; return `<div style="padding:8px;border-bottom:1px solid #eee8dc"><div class="cp104-row"><div style="flex:1"><b>${esc(item.name)}</b><div class="cp104-muted">${rupiah(item.balance)} / ${rupiah(item.target || 0)}${item.source ? ` · ${esc(item.source)}` : ''}</div></div><button type="button" class="cp104-btn" data-sav-history="${esc(item.id)}">Riwayat</button><button type="button" class="cp104-btn" data-sav-del="${i}">×</button></div><div class="cp104-bar"><i style="width:${pct}%"></i></div><div class="cp104-muted">${pct}%</div></div>`; }).join('') : '<div class="cp104-muted">Belum ada pos tabungan.</div>';
      savList.querySelectorAll('[data-sav-history]').forEach((button) => button.onclick = () => this.openHistoryModal('savings', button.dataset.savHistory, 'Riwayat Pos Tabungan'));
      savList.querySelectorAll('[data-sav-del]').forEach((button) => button.onclick = () => { this.savings.splice(Number(button.dataset.savDel), 1); saveJSON(SAV_KEY, this.savings); this.renderFinance(); });
    }
  },

  openFinanceForm(type, existing = null) {
    const labels = { income: 'Pemasukan', expense: 'Pengeluaran', debt: 'Hutang' };
    const note = existing || {}; const finance = note.finance || {};
    const fields = document.getElementById('cp104FormFields');
    document.getElementById('cp104FormTitle').textContent = `${existing ? 'Edit' : 'Tambah'} ${labels[type]}`;
    const oldFunding = Array.isArray(finance.funding) && finance.funding.length ? finance.funding : (type === 'expense' ? [{id:'net',amount:Number(finance.amount)||0}] : []);
    fields.innerHTML = `<label>Judul<input class="cp104-input" name="title" required value="${esc(note.title || labels[type])}" placeholder="Contoh: Gaji September"></label><div class="cp104-row"><label>Nominal (Rp)<input class="cp104-input" name="amount" type="number" min="0" step="1" required value="${Number(finance.amount || 0) || ''}"></label><label>Tanggal<input class="cp104-input" name="date" type="date" required value="${esc(finance.date || today())}"></label></div>${type === 'income' ? '<label>Sumber pemasukan<input class="cp104-input" name="source" value=""></label>' : ''}${type === 'expense' ? this.fundingPickerHTML(oldFunding, Number(finance.amount)||0, existing?.id || null, existing ? oldFunding : []) + '<label>Pengeluaran untuk<input class="cp104-input" name="purpose" value=""></label>' : ''}${type === 'debt' ? '<div class="cp104-row"><label>Hutang kepada<input class="cp104-input" name="debtTo" value=""></label><label>Untuk apa<input class="cp104-input" name="debtPurpose" value=""></label></div><div class="cp104-help">Hutang dilunasi melalui tombol <b>Bayar / Cicil</b>. Setiap cicilan memiliki sumber dana dan riwayat sendiri.</div>' : ''}<label>Catatan tambahan<textarea class="cp104-input" name="body" rows="4" placeholder="Opsional"></textarea></label>`;
    const form = document.getElementById('cp104Form');
    form.querySelector('[name="source"]')?.setAttribute('value', finance.incomeFrom || ''); form.querySelector('[name="purpose"]')?.setAttribute('value', finance.expenseFor || ''); form.querySelector('[name="debtTo"]')?.setAttribute('value', finance.debtTo || ''); form.querySelector('[name="debtPurpose"]')?.setAttribute('value', finance.debtPurpose || '');
    if (form.querySelector('[name="debtPaid"]')) form.querySelector('[name="debtPaid"]').checked = Boolean(finance.debtPaid); form.querySelector('[name="body"]').value = SecurityService.stripHtml(note.bodyHTML || '');
    if(type==='expense') this.bindFundingPicker(form, form.querySelector('[name="amount"]'));
    form.onsubmit = async (event) => { event.preventDefault(); await this.saveFinanceForm(type, existing?.id || null); };
    document.getElementById('cp104FormModal').classList.add('open'); form.querySelector('[name="title"]').focus();
  },

  async saveFinanceForm(type, existingId = null) {
    const form = document.getElementById('cp104Form'); const data = new FormData(form); const amount = Number(data.get('amount')) || 0;
    if (amount <= 0) { this.ctx.toast('Nominal harus lebih besar dari 0.', 'danger'); return; }
    const notes = this.ctx.getNotes() || []; const existing = existingId ? notes.find((n) => n.id === existingId) : null;
    const oldFunding = existing?.finance?.funding || (type==='expense' ? [{id:'net',amount:Number(existing?.finance?.amount)||0}] : []);
    let funding=[];
    try { if(type==='expense') funding=this.readFunding(form,amount,existingId,oldFunding); } catch(e) { this.ctx.toast(e.message,'danger'); return; }
    if(type==='expense' && existing) this.applySavingsDelta(oldFunding,1);
    if(type==='expense') { try { this.applySavingsDelta(funding,-1); } catch(e) { if(existing) this.applySavingsDelta(oldFunding,1); this.ctx.toast(e.message,'danger'); return; } }
    const legacyPaid = existing?.finance?.debtPaid ? Number(existing.finance.amount || 0) : Number(existing?.finance?.paidAmount || 0);
    const finance = { type, amount, date: String(data.get('date') || today()), debtTo: String(data.get('debtTo') || '').trim(), debtPurpose: String(data.get('debtPurpose') || '').trim(), debtPaid: type==='debt' ? ((Array.isArray(existing?.finance?.payments) && existing.finance.payments.length) ? debtPaidAmount(existing) >= amount : legacyPaid >= amount) : false, paidAmount: type==='debt' ? Math.min(amount, (Array.isArray(existing?.finance?.payments) && existing.finance.payments.length) ? debtPaidAmount(existing) : legacyPaid) : 0, payments: type==='debt' ? (Array.isArray(existing?.finance?.payments) ? existing.finance.payments : []) : undefined, incomeFrom: String(data.get('source') || '').trim(), expenseFor: String(data.get('purpose') || '').trim(), funding };
    const note = existing ? { ...existing, title: String(data.get('title') || 'Tanpa Judul').trim(), bodyHTML: SecurityService.escapeHtml(String(data.get('body') || '')), finance, category: 'keuangan', attachments: Array.isArray(existing.attachments) ? existing.attachments : [], updatedAt: Date.now() } : { id: uid('note'), title: String(data.get('title') || 'Tanpa Judul').trim(), bodyHTML: SecurityService.escapeHtml(String(data.get('body') || '')), category: 'keuangan', finance, reminder: null, eventDate: '', eventLocation: '', attachments: [], createdAt: Date.now(), updatedAt: Date.now() };
    try {
      await this.ctx.persistNote(note);
    } catch (err) {
      if (type === 'expense') {
        try { this.applySavingsDelta(funding, 1); if (existing) this.applySavingsDelta(oldFunding, -1); } catch (rollbackErr) { console.warn('Rollback pengeluaran gagal:', rollbackErr); }
      }
      this.ctx.toast('Gagal menyimpan transaksi. Perubahan saldo sumber dana dibatalkan.', 'danger');
      return;
    }
    if(type==='expense') await this.recordFundingHistory('transaction',note.id,existing?'Ubah pengeluaran':'Pengeluaran',amount,funding,{note:String(data.get('purpose')||'').trim()});
    else await this.recordFundingHistory('transaction',note.id,type==='income'?'Pemasukan':'Hutang',amount,[],{note: type==='income'?String(data.get('source')||'').trim():String(data.get('debtTo')||'').trim()});
    document.getElementById('cp104FormModal').classList.remove('open'); this.renderFinance(); this.ctx.toast(`${type === 'income' ? 'Pemasukan' : type === 'expense' ? 'Pengeluaran' : 'Hutang'} berhasil disimpan.`, 'info');
  },

  openDebtPaymentForm(note) {
    const total=Number(note?.finance?.amount)||0; const paid=debtPaidAmount(note); const remain=remainingAmount(total,paid); if(remain<=0){this.ctx.toast('Hutang ini sudah lunas.','info');return;}
    document.getElementById('cp104FormTitle').textContent=`Bayar / Cicil Hutang: ${note.title}`;
    document.getElementById('cp104FormFields').innerHTML=`<label>Total hutang<input class="cp104-input" value="${total}" readonly></label><div class="cp104-muted">Sudah dibayar ${rupiah(paid)} · Sisa ${rupiah(remain)}</div><label>Nominal pembayaran<input class="cp104-input" name="amount" type="number" min="1" max="${remain}" step="1" value="${remain}" required></label>${this.fundingPickerHTML([{id:'net',amount:remain}],remain,null)}<label>Catatan pembayaran<textarea class="cp104-input" name="body" rows="3"></textarea></label>`;
    const form=document.getElementById('cp104Form'); const amountInput=form.querySelector('[name="amount"]'); this.bindFundingPicker(form,amountInput);
    form.onsubmit=async(e)=>{
      e.preventDefault();
      const pay=Number(amountInput.value)||0;
      if(pay<=0||pay>remain){this.ctx.toast('Nominal cicilan tidak valid.','danger');return;}
      let funding;
      try{funding=this.readFunding(form,pay,null);this.applySavingsDelta(funding,-1);}catch(err){this.ctx.toast(err.message,'danger');return;}
      const f=note.finance||{};
      const payments=Array.isArray(f.payments)?f.payments:[];
      const payment={id:uid('pay'),at:Date.now(),amount:pay,funding,note:String(new FormData(form).get('body')||'')};
      payments.push(payment);
      note.finance={...f,payments,paidAmount:Math.min(total,paid+pay),debtPaid:paid+pay>=total};
      note.updatedAt=Date.now();
      try{
        await this.ctx.persistNote(note);
      }catch(err){
        try{this.applySavingsDelta(funding,1);}catch(rollbackErr){console.warn('Gagal rollback saldo pembayaran hutang:',rollbackErr);}
        payments.pop();
        note.finance={...f,payments,paidAmount:paid,debtPaid:paid>=total};
        this.ctx.toast('Pembayaran gagal disimpan. Saldo sumber dana dikembalikan.','danger');
        return;
      }
      await this.recordFundingHistory('transaction',note.id,'Pembayaran hutang',pay,funding,{note:payment.note,paymentId:payment.id,progress:`${note.finance.paidAmount}/${total}`});
      document.getElementById('cp104FormModal').classList.remove('open');
      this.renderFinance();
      this.ctx.toast(note.finance.debtPaid?'Hutang lunas.':'Cicilan hutang tersimpan.','info');
    };
    document.getElementById('cp104FormModal').classList.add('open');
  },

  openObligationPaymentForm(index) {
    const item=this.obligations[index]; if(!item)return; const total=Number(item.amount)||0; const paid=obligationPaidAmount(item); const remain=remainingAmount(total,paid); if(remain<=0){this.ctx.toast('Dana wajib ini sudah lunas.','info');return;}
    document.getElementById('cp104FormTitle').textContent=`Bayar / Cicil Dana Wajib: ${item.name}`;
    document.getElementById('cp104FormFields').innerHTML=`<label>Target dana wajib<input class="cp104-input" value="${total}" readonly></label><div class="cp104-muted">Terbayar ${rupiah(paid)} · Sisa ${rupiah(remain)}</div><label>Nominal pembayaran / cicilan<input class="cp104-input" name="amount" type="number" min="1" max="${remain}" step="1" value="${remain}" required></label>${this.fundingPickerHTML([{id:'net',amount:remain}],remain,null)}<label>Catatan pembayaran<textarea class="cp104-input" name="body" rows="3"></textarea></label>`;
    const form=document.getElementById('cp104Form'); const amountInput=form.querySelector('[name="amount"]'); this.bindFundingPicker(form,amountInput);
    form.onsubmit=async(e)=>{
      e.preventDefault();
      const pay=Number(amountInput.value)||0;
      if(pay<=0||pay>remain){this.ctx.toast('Nominal cicilan tidak valid.','danger');return;}
      let funding;
      try{funding=this.readFunding(form,pay,null);this.applySavingsDelta(funding,-1);}catch(err){this.ctx.toast(err.message,'danger');return;}
      const payments=Array.isArray(item.payments)?item.payments:[];
      const payment={id:uid('pay'),at:Date.now(),amount:pay,funding,note:String(new FormData(form).get('body')||'')};
      payments.push(payment);
      item.payments=payments; item.paidAmount=Math.min(total,paid+pay); item.isPaid=item.paidAmount>=total; item.funding=funding; item.paidAt=item.isPaid?Date.now():item.paidAt;
      try{saveJSON(OBL_KEY,this.obligations);}catch(err){
        try{this.applySavingsDelta(funding,1);}catch(rollbackErr){console.warn('Gagal rollback saldo pembayaran dana wajib:',rollbackErr);}
        payments.pop(); item.paidAmount=paid; item.isPaid=paid>=total; item.funding=[];
        this.ctx.toast('Pembayaran gagal disimpan. Saldo sumber dana dikembalikan.','danger'); return;
      }
      await this.recordFundingHistory('obligation',item.id,'Pembayaran dana wajib',pay,funding,{note:payment.note,paymentId:payment.id,progress:`${item.paidAmount}/${total}`});
      document.getElementById('cp104FormModal').classList.remove('open'); this.renderFinance();
      this.ctx.toast(item.isPaid?'Dana wajib lunas.':'Cicilan dana wajib tersimpan.','info');
    };
    document.getElementById('cp104FormModal').classList.add('open');
  },
  unpayObligation(index) {
    const item=this.obligations[index];if(!item)return;
    const payments=Array.isArray(item.payments)&&item.payments.length?item.payments:[{amount:item.amount,funding:item.funding || (item.deductFromNet?[{id:'net',amount:item.amount}]:[])}];
    payments.forEach(p=>this.applySavingsDelta(p.funding||[],1)); const total=payments.reduce((n,p)=>n+Number(p.amount||0),0); item.payments=[]; item.paidAmount=0; item.funding=[]; item.isPaid=false; delete item.paidAt; saveJSON(OBL_KEY,this.obligations); this.recordFundingHistory('obligation',item.id,'Batalkan pembayaran',total,[],{note:'Seluruh pembayaran dikembalikan ke sumber tabungan internal.'}); this.renderFinance();
  },



  openEventForm(dateValue = today(), existing = null) {
    const note = existing || {};
    const fields = document.getElementById('cp104FormFields');
    document.getElementById('cp104FormTitle').textContent = existing ? 'Edit Acara' : 'Tambah Acara Baru';

    const curType = note.eventType || 'umum';
    const curColor = note.eventColor || (EVENT_TYPES.find(t => t.id === curType)?.defaultColor || '#47593f');
    const curTime = note.reminder?.datetime ? String(note.reminder.datetime).slice(11, 16) : (note.eventTime || '09:00');
    const curDate = note.eventDate || dateValue || today();

    fields.innerHTML = `
      <label>Nama Acara
        <input class="cp104-input" name="title" required value="${esc(note.title || '')}" placeholder="Contoh: Rapat Proyek, Ulang Tahun Sarah, Kuliah...">
      </label>

      <div class="cp104-row">
        <label>Jenis Acara
          <select class="cp104-input" name="type" id="cp104EventTypeSelect">
            ${EVENT_TYPES.map(t => `<option value="${t.id}" ${t.id === curType ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
          </select>
        </label>
        <label>Warna di Kalender
          <input type="hidden" name="color" id="cp104EventColorVal" value="${esc(curColor)}">
          <div class="cp104-color-palette" id="cp104ColorPalette">
            ${EVENT_COLOR_PRESETS.map(c => `
              <button type="button" class="cp104-color-swatch ${c.hex.toLowerCase() === curColor.toLowerCase() ? 'selected' : ''}" 
                data-color="${c.hex}" title="${c.name}" style="background:${c.hex}"></button>
            `).join('')}
            <label class="cp104-custom-color-btn" title="Pilih warna kustom">
              🎨 Kustom
              <input type="color" id="cp104CustomColorPicker" value="${esc(curColor)}">
            </label>
          </div>
        </label>
      </div>

      <div class="cp104-event-preview-bar" id="cp104EventPreviewBar">
        <span class="cp104-preview-dot" id="cp104PreviewDot" style="background:${esc(curColor)}"></span>
        <span id="cp104PreviewLabel">Tampilan Kalender: ${EVENT_TYPES.find(t=>t.id===curType)?.icon || '📌'} ${EVENT_TYPES.find(t=>t.id===curType)?.label || 'Umum'}</span>
      </div>

      <div class="cp104-row">
        <label>Tanggal Pelaksanaan
          <input class="cp104-input" name="date" type="date" required value="${esc(curDate)}">
        </label>
        <label>Jam Pelaksanaan
          <input class="cp104-input" name="time" type="time" value="${esc(curTime)}">
        </label>
      </div>

      <label>
        <span style="display:inline-flex;align-items:center;gap:4px"><span>📍</span> Lokasi Acara</span>
        <input class="cp104-input" name="location" value="${esc(note.eventLocation || '')}" placeholder="Contoh: Gedung A Lt. 2, Cafe Kenangan, atau Google Meet">
      </label>

      <label>Catatan / Agenda Acara
        <textarea class="cp104-input" name="body" rows="3" placeholder="Detail acara, peserta, agenda pembahasan, tautan meeting..."></textarea>
      </label>

      <label class="cp104-check" style="margin-top:4px">
        <input type="checkbox" name="reminder" ${note.reminder ? 'checked' : (existing ? '' : 'checked')}> 
        <span>🔔 Pasang pengingat notifikasi alarm</span>
      </label>
    `;

    const form = document.getElementById('cp104Form');
    form.querySelector('[name="body"]').value = SecurityService.stripHtml(note.bodyHTML || '');

    const colorInput = form.querySelector('#cp104EventColorVal');
    const previewDot = form.querySelector('#cp104PreviewDot');
    const customPicker = form.querySelector('#cp104CustomColorPicker');
    const swatches = form.querySelectorAll('.cp104-color-swatch');
    const typeSelect = form.querySelector('#cp104EventTypeSelect');
    const previewLabel = form.querySelector('#cp104PreviewLabel');

    const updateColor = (hex) => {
      colorInput.value = hex;
      if (previewDot) previewDot.style.background = hex;
      if (customPicker) customPicker.value = hex;
      swatches.forEach(s => {
        s.classList.toggle('selected', s.dataset.color.toLowerCase() === hex.toLowerCase());
      });
    };

    swatches.forEach(swatch => {
      swatch.onclick = (e) => {
        e.preventDefault();
        updateColor(swatch.dataset.color);
      };
    });

    if (customPicker) {
      customPicker.oninput = (e) => {
        updateColor(e.target.value);
      };
    }

    if (typeSelect) {
      typeSelect.onchange = (e) => {
        const selected = EVENT_TYPES.find(t => t.id === e.target.value);
        if (selected) {
          if (previewLabel) previewLabel.textContent = `Tampilan Kalender: ${selected.icon} ${selected.label}`;
          if (!existing) {
            updateColor(selected.defaultColor);
          }
        }
      };
    }

    form.onsubmit = async (event) => {
      event.preventDefault();
      await this.saveEventForm(existing?.id || null);
    };

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
    const eventType = String(data.get('type') || 'umum');
    const eventColor = String(data.get('color') || '#47593f');
    const location = String(data.get('location') || '').trim();
    const notes = this.ctx.getNotes() || [];
    const existing = existingId ? notes.find((n) => n.id === existingId) : null;
    const note = existing ? {
      ...existing,
      title,
      bodyHTML: SecurityService.escapeHtml(String(data.get('body') || '')),
      category: 'acara',
      eventDate: date,
      eventTime: time,
      eventType,
      eventColor,
      eventLocation: location,
      reminder: form.querySelector('[name="reminder"]')?.checked ? { datetime: `${date}T${time}`, notified: false } : null,
      updatedAt: Date.now()
    } : {
      id: uid('note'),
      title,
      bodyHTML: SecurityService.escapeHtml(String(data.get('body') || '')),
      category: 'acara',
      eventDate: date,
      eventTime: time,
      eventType,
      eventColor,
      eventLocation: location,
      reminder: form.querySelector('[name="reminder"]')?.checked ? { datetime: `${date}T${time}`, notified: false } : null,
      finance: null,
      attachments: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await this.ctx.persistNote(note);
    this.selectedDate = date;
    this.calDate = new Date(`${date}T12:00:00`);
    document.getElementById('cp104FormModal').classList.remove('open');
    this.switchTab('schedule');
    this.renderCalendar();
    this.ctx.toast('Acara berhasil disimpan.', 'info');
  },

  renderCalendar() {
    const month = document.getElementById('cp104Month');
    const cal = document.getElementById('cp104Calendar');
    if (!month || !cal) return;
    const year = this.calDate.getFullYear();
    const monthIndex = this.calDate.getMonth();
    const first = new Date(year, monthIndex, 1).getDay();
    const days = new Date(year, monthIndex + 1, 0).getDate();
    month.textContent = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(this.calDate);
    cal.innerHTML = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((x, i) => `<div class="cp104-cal-head${i === 0 || i === 6 ? ' weekend' : ''}">${x}</div>`).join('');
    for (let i = 0; i < first; i++) cal.insertAdjacentHTML('beforeend', '<div class="cp104-day muted"></div>');
    
    const notes = this.ctx.getNotes() || [];
    const allEvents = notes.filter((n) => n.category === 'acara');
    
    // Render Event Type Filter chips
    const filtersContainer = document.getElementById('cp104TypeFilters');
    if (filtersContainer) {
      const countsByType = { all: allEvents.length };
      allEvents.forEach(e => {
        const t = e.eventType || 'umum';
        countsByType[t] = (countsByType[t] || 0) + 1;
      });

      const filterList = [
        { id: 'all', label: 'Semua Acara', icon: '✨', count: countsByType.all || 0 },
        ...EVENT_TYPES.map(t => ({
          ...t,
          count: countsByType[t.id] || 0
        }))
      ];

      filtersContainer.innerHTML = filterList.map(f => `
        <button type="button" class="cp104-type-chip ${this.eventFilterType === f.id ? 'active' : ''}" data-filter="${f.id}">
          <span>${f.icon}</span>
          <span>${f.label}</span>
          <span style="opacity:0.7;font-size:10px">(${f.count})</span>
        </button>
      `).join('');

      filtersContainer.querySelectorAll('[data-filter]').forEach(chip => {
        chip.onclick = () => {
          this.eventFilterType = chip.dataset.filter;
          this.renderCalendar();
        };
      });
    }

    const filteredEvents = this.eventFilterType === 'all' 
      ? allEvents 
      : allEvents.filter(e => (e.eventType || 'umum') === this.eventFilterType);

    const todayStr = today();
    let monthEventsCount = 0;

    for (let day = 1; day <= days; day++) {
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = filteredEvents.filter((note) => this.eventDate(note) === date);
      if (dayEvents.length) monthEventsCount += dayEvents.length;

      const cell = document.createElement('div');
      cell.className = `cp104-day${date === todayStr ? ' today' : ''}${date === this.selectedDate ? ' sel' : ''}`;
      
      const dots = dayEvents.slice(0, 4).map((note) => {
        const dotColor = note.eventColor || '#47593f';
        const typeObj = EVENT_TYPES.find(t => t.id === (note.eventType || 'umum'));
        const tip = `${typeObj?.icon || '📌'} ${note.title || 'Acara'}`;
        return `<span class="cp104-day-dot" style="background:${esc(dotColor)}" title="${esc(tip)}"></span>`;
      }).join('');

      const more = dayEvents.length > 4 ? `<span class="cp104-day-more">+${dayEvents.length - 4}</span>` : '';
      cell.innerHTML = `<b>${day}</b>${dayEvents.length ? `<div class="cp104-day-dots">${dots}${more}</div>` : ''}`;
      cell.onclick = () => { this.selectedDate = date; this.renderCalendar(); };
      cal.appendChild(cell);
    }

    document.getElementById('cp104SelCount').textContent = `${monthEventsCount} acara bulan ini`;

    const selectedEvents = filteredEvents
      .filter((note) => this.eventDate(note) === this.selectedDate)
      .sort((a, b) => String(a.eventTime || a.reminder?.datetime?.slice(11, 16) || '99:99').localeCompare(String(b.eventTime || b.reminder?.datetime?.slice(11, 16) || '99:99')));

    const list = document.getElementById('cp104DayEvents');
    const dayBadge = document.getElementById('cp104DayCountBadge');
    if (dayBadge) dayBadge.textContent = `${selectedEvents.length} acara`;

    const labelEl = document.getElementById('cp104SelectedDateLabel');
    if (labelEl) {
      labelEl.textContent = formatIndonesianDate(this.selectedDate) || this.selectedDate;
    }

    if (selectedEvents.length) {
      list.innerHTML = selectedEvents.map((note) => {
        const time = note.reminder?.datetime ? String(note.reminder.datetime).slice(11, 16) : (note.eventTime || '');
        const typeObj = EVENT_TYPES.find(t => t.id === (note.eventType || 'umum')) || EVENT_TYPES[0];
        const color = note.eventColor || typeObj.defaultColor || '#47593f';
        const descSnippet = SecurityService.stripHtml(note.bodyHTML || '').slice(0, 120);

        return `
          <div class="cp104-event-item" style="border-left-color:${esc(color)}">
            <div class="cp104-event-main">
              <div class="cp104-event-top">
                <span class="cp104-event-type-tag" style="background:${esc(color)}18;color:${esc(color)};border-color:${esc(color)}40">
                  <span>${typeObj.icon}</span> ${esc(typeObj.label)}
                </span>
                <span class="cp104-event-title" data-event-open="${esc(note.id)}" title="Buka detail catatan">${esc(note.title || 'Tanpa Judul')}</span>
              </div>
              <div class="cp104-event-meta">
                ${time ? `<span class="cp104-event-pill"><span class="cp104-event-pill-icon">🕐</span> ${esc(time)} WIB</span>` : ''}
                ${note.eventLocation ? `<span class="cp104-event-pill location"><span class="cp104-event-pill-icon">📍</span> ${esc(note.eventLocation)}</span>` : ''}
                ${note.reminder ? '<span class="cp104-event-pill" style="color:#d97706;background:#fef3c7;border-color:#fde68a"><span class="cp104-event-pill-icon">🔔</span> Pengingat aktif</span>' : ''}
              </div>
              ${descSnippet ? `<div class="cp104-event-desc">${esc(descSnippet)}</div>` : ''}
            </div>
            <div class="cp104-event-actions">
              <button type="button" class="cp104-btn-icon" data-event-edit="${esc(note.id)}" title="Edit Acara">✏️</button>
              <button type="button" class="cp104-btn-icon del" data-event-delete="${esc(note.id)}" title="Hapus Acara">🗑️</button>
            </div>
          </div>
        `;
      }).join('');
    } else {
      list.innerHTML = `
        <div class="cp104-event-empty">
          <div class="cp104-empty-icon">📅</div>
          <div class="cp104-empty-title">Tidak ada acara pada tanggal ini</div>
          <div class="cp104-empty-sub">Jadwalkan rapat, janji, ulang tahun, atau agenda Anda dengan rapi.</div>
          <button type="button" class="cp104-btn primary" id="cp104EmptyAddBtn" style="font-size:12px;padding:6px 14px">＋ Tambah Acara di Tanggal Ini</button>
        </div>
      `;
      const emptyAddBtn = list.querySelector('#cp104EmptyAddBtn');
      if (emptyAddBtn) emptyAddBtn.onclick = () => this.openEventForm(this.selectedDate);
    }

    list.querySelectorAll('[data-event-open]').forEach((node) => {
      node.onclick = () => this.ctx.openNote(node.dataset.eventOpen);
    });

    list.querySelectorAll('[data-event-edit]').forEach((node) => {
      node.onclick = () => {
        const found = notes.find(n => n.id === node.dataset.eventEdit);
        if (found) this.openEventForm(this.selectedDate, found);
      };
    });

    list.querySelectorAll('[data-event-delete]').forEach((node) => {
      node.onclick = async () => this.deleteNote(node.dataset.eventDelete);
    });
  },

  addObligation() {
    const nameEl=document.getElementById('cp104ObName'), amountEl=document.getElementById('cp104ObAmount'), dueEl=document.getElementById('cp104ObDue');
    const name=nameEl.value.trim(), amount=Number(amountEl.value)||0; if(!name||amount<=0){this.ctx.toast('Nama dan nominal kewajiban wajib diisi.','danger');return;}
    const item={id:uid('ob'),name,amount,dueDate:dueEl.value||'',isPaid:false,createdAt:Date.now(),funding:[]}; this.obligations.push(item); saveJSON(OBL_KEY,this.obligations); nameEl.value='';amountEl.value='';dueEl.value='';this.renderFinance();this.ctx.toast('Kewajiban dibuat. Saat dibayar Anda dapat memilih satu atau beberapa sumber dana.','info');
  },

  openSavingsForm() {
    document.getElementById('cp104FormTitle').textContent = 'Tambah Pos Tabungan';
    document.getElementById('cp104FormFields').innerHTML = '<label>Nama pos<input class="cp104-input" name="name" required placeholder="Contoh: Dana darurat"></label><div class="cp104-row"><label>Target (Rp)<input class="cp104-input" name="target" type="number" min="0" value="0"></label><label>Saldo awal (Rp)<input class="cp104-input" name="balance" type="number" min="0" value="0"></label></div><label>Sumber utama (opsional)<input class="cp104-input" name="source" placeholder="Gaji, bonus, dll."></label>';
    const form = document.getElementById('cp104Form'); form.onsubmit = (e) => { e.preventDefault(); const data = new FormData(form); const name = String(data.get('name') || '').trim(); if (!name) return; const item={ id: uid('sav'), name, target: Number(data.get('target')) || 0, balance: Number(data.get('balance')) || 0, source: String(data.get('source') || '').trim(), createdAt: Date.now() }; this.savings.push(item); saveJSON(SAV_KEY, this.savings); addHistory({entityType:'savings',entityId:item.id,action:'Pos tabungan dibuat',amount:item.balance,funding:item.balance?[{id:'other',label:item.source||'Saldo awal',amount:item.balance}]:[],note:item.source||'Saldo awal'}); document.getElementById('cp104FormModal').classList.remove('open'); this.renderFinance(); this.ctx.toast('Pos tabungan berhasil dibuat.', 'info'); };
    document.getElementById('cp104FormModal').classList.add('open'); form.querySelector('[name="name"]').focus();
  },

  openSavingsTransactionForm() {
    if (!this.savings.length) { this.ctx.toast('Buat pos tabungan terlebih dahulu.', 'danger'); return; }
    document.getElementById('cp104FormTitle').textContent = 'Setor / Tarik Tabungan';
    document.getElementById('cp104FormFields').innerHTML = `<label>Pos tabungan<select class="cp104-input" name="index">${this.savings.map((s, i) => `<option value="${i}">${esc(s.name)} — ${rupiah(s.balance)}</option>`).join('')}</select></label><div class="cp104-row"><label>Aksi<select class="cp104-input" name="action"><option value="deposit">Setor</option><option value="withdraw">Tarik</option></select></label><label>Nominal (Rp)<input class="cp104-input" name="amount" type="number" min="1" required value="50000"></label></div>`;
    const form = document.getElementById('cp104Form'); form.onsubmit = (e) => { e.preventDefault(); const data = new FormData(form); const item = this.savings[Number(data.get('index'))]; const amount = Number(data.get('amount')) || 0; if (!item || amount <= 0) return; if (data.get('action') === 'withdraw' && amount > Number(item.balance || 0)) { this.ctx.toast('Saldo tabungan tidak cukup.', 'danger'); return; } item.balance = Number(item.balance || 0) + (data.get('action') === 'deposit' ? amount : -amount); saveJSON(SAV_KEY, this.savings); addHistory({entityType:'savings',entityId:item.id,action:data.get('action')==='deposit'?'Setor tabungan':'Tarik tabungan',amount,funding:[{id:item.id,label:item.name,amount}],note:data.get('action')==='deposit'?'Saldo bertambah':'Saldo berkurang'}); document.getElementById('cp104FormModal').classList.remove('open'); this.renderFinance(); this.ctx.toast('Saldo tabungan diperbarui.', 'info'); };
    document.getElementById('cp104FormModal').classList.add('open');
  },

  eventDate(note) {
    if (note.eventDate) return String(note.eventDate).slice(0, 10);
    if (note.reminder?.datetime) return String(note.reminder.datetime).slice(0, 10);
    return localDateFromTimestamp(note.updatedAt || note.createdAt || Date.now());
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
    const categories = this.ctx.getCategories().filter((cat) => !['keuangan','acara'].includes(cat.id)).map((cat) => `${cat.id} = ${cat.name}`).join('\n');
    const target = window.prompt(`Pilih ID kategori:\n${categories}`);
    if (!target) return;
    await this.ctx.batchMove(ids, target.trim()); this.ctx.clearSelection(); this.syncBatchBar();
  },

  async batchExport() {
    const ids = this.ctx.getSelectedIds(); if (!ids.length) return;
    try {
      const data = (this.ctx.getNotes() || []).filter((note) => ids.includes(note.id));
      const categories = this.ctx.getCategories?.() || [];
      const exported = await ExportImportService.exportNotes(data, categories, 'json');
      const result = exported?.result || exported;
      this.ctx.toast(result?.method === 'android-downloads' ? 'Ekspor catatan terpilih tersimpan di Download/Catatan Pintar.' : 'Ekspor catatan terpilih berhasil dibuat.', 'info');
    } catch (err) {
      this.ctx.toast(`Gagal mengekspor catatan terpilih: ${err.message || err}`, 'danger');
    }
  },

  syncBatchBar() {
    const ids = this.ctx?.getSelectedIds?.() || []; const bar = document.getElementById('cp104Batch'); if (!bar) return;
    bar.classList.toggle('open', ids.length > 0); const count = document.getElementById('cp104BatchCount'); if (count) count.textContent = `${ids.length} dipilih`;
  },

  async exportFinance() {
    this.openExportFinanceModal();
  },

  openExportFinanceModal() {
    let modal = document.getElementById('cp104ExportModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'cp104ExportModal';
      modal.className = 'cp104-modal';
      modal.innerHTML = `
        <div class="cp104-dialog" style="max-width:580px">
          <div class="cp104-head">
            <div class="cp104-title">📄 Ekspor Laporan Keuangan (PDF)</div>
            <button type="button" class="cp104-btn" id="cp104ExportClose">✕</button>
          </div>
          <form class="cp104-form" id="cp104ExportForm" style="margin-top:10px">
            <div style="background:#f4f7f2;border:1px solid #d8e2d4;border-radius:8px;padding:9px 12px;font-size:12px;color:#284228;display:flex;align-items:center;gap:8px">
              <span style="font-size:18px">📑</span>
              <div><b>Pilih Data yang Ingin Diekspor:</b> Anda dapat memilih mengekspor hanya transaksi pengeluaran, hanya pemasukan, hutang, atau laporan lengkap secara rapi dan tertata.</div>
            </div>

            <!-- 1. Pilihan Apa yang Ingin Diekspor -->
            <div style="font-weight:700;font-size:12.5px;color:var(--ink,#27352b);margin-top:10px">
              1. Pilih Fokus / Jenis Data yang Diekspor
            </div>
            <div id="cp104ScopeGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:6px">
              <button type="button" class="cp104-btn cp-scope-btn active" data-scope="expense_only" style="display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:8px;gap:2px">
                <span style="font-size:18px">💸</span>
                <span style="font-size:11.5px;font-weight:600">Hanya Pengeluaran</span>
              </button>
              <button type="button" class="cp104-btn cp-scope-btn" data-scope="income_only" style="display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:8px;gap:2px">
                <span style="font-size:18px">💰</span>
                <span style="font-size:11.5px;font-weight:600">Hanya Pemasukan</span>
              </button>
              <button type="button" class="cp104-btn cp-scope-btn" data-scope="debt_only" style="display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:8px;gap:2px">
                <span style="font-size:18px">🧾</span>
                <span style="font-size:11.5px;font-weight:600">Hanya Hutang</span>
              </button>
              <button type="button" class="cp104-btn cp-scope-btn" data-scope="all_transactions" style="display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:8px;gap:2px">
                <span style="font-size:18px">⚖️</span>
                <span style="font-size:11.5px;font-weight:600">Semua Transaksi</span>
              </button>
              <button type="button" class="cp104-btn cp-scope-btn" data-scope="obligation_only" style="display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:8px;gap:2px">
                <span style="font-size:18px">📌</span>
                <span style="font-size:11.5px;font-weight:600">Pos Dana Wajib</span>
              </button>
              <button type="button" class="cp104-btn cp-scope-btn" data-scope="savings_only" style="display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:8px;gap:2px">
                <span style="font-size:18px">🏦</span>
                <span style="font-size:11.5px;font-weight:600">Pos Tabungan</span>
              </button>
              <button type="button" class="cp104-btn cp-scope-btn" data-scope="full_recap" style="display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:8px;gap:2px">
                <span style="font-size:18px">📊</span>
                <span style="font-size:11.5px;font-weight:600">Laporan Lengkap</span>
              </button>
              <button type="button" class="cp104-btn cp-scope-btn" data-scope="custom" style="display:flex;flex-direction:column;align-items:center;padding:8px 4px;border-radius:8px;gap:2px">
                <span style="font-size:18px">⚙️</span>
                <span style="font-size:11.5px;font-weight:600">Kustom Sendiri</span>
              </button>
            </div>

            <!-- 2. Rentang Tanggal -->
            <div style="font-weight:700;font-size:12.5px;color:var(--ink,#27352b);margin-top:10px">
              2. Pilih Rentang Tanggal
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
              <button type="button" class="cp104-btn" id="cp104ExpPresetAll" style="font-size:11px;padding:3px 8px">Semua Waktu</button>
              <button type="button" class="cp104-btn" id="cp104ExpPresetToday" style="font-size:11px;padding:3px 8px">Hari Ini</button>
              <button type="button" class="cp104-btn" id="cp104ExpPreset7Days" style="font-size:11px;padding:3px 8px">7 Hari Terakhir</button>
              <button type="button" class="cp104-btn" id="cp104ExpPresetThisMonth" style="font-size:11px;padding:3px 8px">Bulan Ini</button>
              <button type="button" class="cp104-btn" id="cp104ExpPresetLastMonth" style="font-size:11px;padding:3px 8px">Bulan Lalu</button>
              <button type="button" class="cp104-btn" id="cp104ExpPresetYear" style="font-size:11px;padding:3px 8px">Tahun Ini</button>
            </div>
            <div class="cp104-row">
              <label>Dari Tanggal
                <input class="cp104-input" id="cp104ExpFrom" type="date">
              </label>
              <label>Sampai Tanggal
                <input class="cp104-input" id="cp104ExpTo" type="date">
              </label>
            </div>

            <!-- 3. Rincian Komponen Dokumen PDF -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
              <div style="font-weight:700;font-size:12.5px;color:var(--ink,#27352b)">
                3. Rincian Komponen Laporan
              </div>
              <span id="cp104SecScopeBadge" style="font-size:11px;color:#284228;background:#e9f0e6;padding:2px 7px;border-radius:4px;font-weight:600">Mode: Hanya Pengeluaran</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px;background:#fff;border:1px solid #e2ded4;border-radius:8px;padding:10px">
              <label class="cp104-check" style="font-size:12px">
                <input type="checkbox" id="cp104SecSummary" checked> Kotak Ringkasan & Total
              </label>
              <label class="cp104-check" style="font-size:12px">
                <input type="checkbox" id="cp104SecTxExpense" checked> Rincian Transaksi Pengeluaran
              </label>
              <label class="cp104-check" style="font-size:12px">
                <input type="checkbox" id="cp104SecTxIncome"> Rincian Transaksi Pemasukan
              </label>
              <label class="cp104-check" style="font-size:12px">
                <input type="checkbox" id="cp104SecDebt"> Daftar Hutang & Pelunasan
              </label>
              <label class="cp104-check" style="font-size:12px">
                <input type="checkbox" id="cp104SecObligation"> Pos Pengeluaran Wajib
              </label>
              <label class="cp104-check" style="font-size:12px">
                <input type="checkbox" id="cp104SecSavings"> Pos Tabungan & Aset
              </label>
              <label class="cp104-check" style="font-size:12px">
                <input type="checkbox" id="cp104SecHistory"> Riwayat Audit / Log Mutasi
              </label>
            </div>

            <!-- Live Preview Data -->
            <div id="cp104ExpLivePreview" style="background:#faf8f5;border:1px solid #e5dfd3;border-radius:8px;padding:9px 12px;font-size:12px;color:#27352b;margin-top:8px">
              Sedang menghitung pratinjau data…
            </div>

            <div class="cp104-actions" style="justify-content:flex-end;margin-top:14px;border-top:1px solid #eee8dc;padding-top:10px;gap:8px">
              <button type="button" class="cp104-btn" id="cp104ExpCancel">Batal</button>
              <button type="button" class="cp104-btn" id="cp104ExpJsonBackup" title="Ekspor file JSON teknis untuk backup restore">💾 Unduh JSON</button>
              <button type="submit" class="cp104-btn primary" id="cp104ExpSubmitPdf" style="font-weight:600">📥 Unduh Laporan PDF</button>
            </div>
          </form>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listeners dialog ekspor
      modal.querySelector('#cp104ExportClose').onclick = () => modal.classList.remove('open');
      modal.querySelector('#cp104ExpCancel').onclick = () => modal.classList.remove('open');
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

      // Scope Selection State
      let currentScope = 'expense_only';

      const updateScopeButtonsUI = (scope) => {
        currentScope = scope;
        modal.dataset.reportScope = scope;
        modal.querySelectorAll('.cp-scope-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.scope === scope);
          btn.classList.toggle('primary', btn.dataset.scope === scope);
          if (btn.dataset.scope === scope) {
            btn.style.borderColor = '#27352b';
            btn.style.background = '#27352b';
            btn.style.color = '#fff';
          } else {
            btn.style.borderColor = '';
            btn.style.background = '';
            btn.style.color = '';
          }
        });

        const badge = modal.querySelector('#cp104SecScopeBadge');
        if (badge) {
          const names = {
            expense_only: 'Hanya Pengeluaran',
            income_only: 'Hanya Pemasukan',
            debt_only: 'Hanya Hutang',
            all_transactions: 'Semua Transaksi',
            obligation_only: 'Pengeluaran Wajib',
            savings_only: 'Pos Tabungan',
            full_recap: 'Laporan Lengkap',
            custom: 'Kustom Pilihan Sendiri'
          };
          badge.textContent = `Mode: ${names[scope] || scope}`;
        }
      };

      const applyScopeCheckboxes = (scope) => {
        const cSummary = modal.querySelector('#cp104SecSummary');
        const cExp = modal.querySelector('#cp104SecTxExpense');
        const cInc = modal.querySelector('#cp104SecTxIncome');
        const cDebt = modal.querySelector('#cp104SecDebt');
        const cObl = modal.querySelector('#cp104SecObligation');
        const cSav = modal.querySelector('#cp104SecSavings');
        const cHist = modal.querySelector('#cp104SecHistory');

        if (scope === 'expense_only') {
          cSummary.checked = true;
          cExp.checked = true;
          cInc.checked = false;
          cDebt.checked = false;
          cObl.checked = false;
          cSav.checked = false;
          cHist.checked = false;
        } else if (scope === 'income_only') {
          cSummary.checked = true;
          cExp.checked = false;
          cInc.checked = true;
          cDebt.checked = false;
          cObl.checked = false;
          cSav.checked = false;
          cHist.checked = false;
        } else if (scope === 'debt_only') {
          cSummary.checked = true;
          cExp.checked = false;
          cInc.checked = false;
          cDebt.checked = true;
          cObl.checked = false;
          cSav.checked = false;
          cHist.checked = false;
        } else if (scope === 'obligation_only') {
          cSummary.checked = true;
          cExp.checked = false;
          cInc.checked = false;
          cDebt.checked = false;
          cObl.checked = true;
          cSav.checked = false;
          cHist.checked = false;
        } else if (scope === 'savings_only') {
          cSummary.checked = true;
          cExp.checked = false;
          cInc.checked = false;
          cDebt.checked = false;
          cObl.checked = false;
          cSav.checked = true;
          cHist.checked = false;
        } else if (scope === 'all_transactions') {
          cSummary.checked = true;
          cExp.checked = true;
          cInc.checked = true;
          cDebt.checked = true;
          cObl.checked = false;
          cSav.checked = false;
          cHist.checked = false;
        } else if (scope === 'full_recap') {
          cSummary.checked = true;
          cExp.checked = true;
          cInc.checked = true;
          cDebt.checked = true;
          cObl.checked = true;
          cSav.checked = true;
          cHist.checked = true;
        }
        updateScopeButtonsUI(scope);
        updateLivePreview();
      };

      modal.querySelectorAll('.cp-scope-btn').forEach((btn) => {
        btn.onclick = () => {
          applyScopeCheckboxes(btn.dataset.scope);
        };
      });

      // Jika pengguna mengubah checkbox secara manual, ubah mode jadi custom
      [
        '#cp104SecSummary', '#cp104SecTxExpense', '#cp104SecTxIncome',
        '#cp104SecDebt', '#cp104SecObligation', '#cp104SecSavings', '#cp104SecHistory'
      ].forEach((sel) => {
        modal.querySelector(sel).onchange = () => {
          updateScopeButtonsUI('custom');
          updateLivePreview();
        };
      });

      // Presets Rentang Tanggal
      modal.querySelector('#cp104ExpPresetAll').onclick = () => {
        modal.querySelector('#cp104ExpFrom').value = '';
        modal.querySelector('#cp104ExpTo').value = '';
        updateLivePreview();
      };
      modal.querySelector('#cp104ExpPresetToday').onclick = () => {
        const t = today();
        modal.querySelector('#cp104ExpFrom').value = t;
        modal.querySelector('#cp104ExpTo').value = t;
        updateLivePreview();
      };
      modal.querySelector('#cp104ExpPreset7Days').onclick = () => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        modal.querySelector('#cp104ExpFrom').value = localDateFromTimestamp(d.getTime());
        modal.querySelector('#cp104ExpTo').value = today();
        updateLivePreview();
      };
      modal.querySelector('#cp104ExpPresetThisMonth').onclick = () => {
        const now = new Date();
        const start = localDateFromTimestamp(new Date(now.getFullYear(), now.getMonth(), 1).getTime());
        const end = localDateFromTimestamp(new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime());
        modal.querySelector('#cp104ExpFrom').value = start;
        modal.querySelector('#cp104ExpTo').value = end;
        updateLivePreview();
      };
      modal.querySelector('#cp104ExpPresetLastMonth').onclick = () => {
        const now = new Date();
        const start = localDateFromTimestamp(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
        const end = localDateFromTimestamp(new Date(now.getFullYear(), now.getMonth(), 0).getTime());
        modal.querySelector('#cp104ExpFrom').value = start;
        modal.querySelector('#cp104ExpTo').value = end;
        updateLivePreview();
      };
      modal.querySelector('#cp104ExpPresetYear').onclick = () => {
        const now = new Date();
        const start = localDateFromTimestamp(new Date(now.getFullYear(), 0, 1).getTime());
        const end = localDateFromTimestamp(new Date(now.getFullYear(), 11, 31).getTime());
        modal.querySelector('#cp104ExpFrom').value = start;
        modal.querySelector('#cp104ExpTo').value = end;
        updateLivePreview();
      };

      modal.querySelector('#cp104ExpFrom').onchange = updateLivePreview;
      modal.querySelector('#cp104ExpTo').onchange = updateLivePreview;

      function updateLivePreview() {
        const fromDate = modal.querySelector('#cp104ExpFrom').value;
        const toDate = modal.querySelector('#cp104ExpTo').value;
        const cExp = modal.querySelector('#cp104SecTxExpense').checked;
        const cInc = modal.querySelector('#cp104SecTxIncome').checked;
        const cDebt = modal.querySelector('#cp104SecDebt').checked;
        const cObl = modal.querySelector('#cp104SecObligation').checked;
        const cSav = modal.querySelector('#cp104SecSavings').checked;

        const allBase = FeaturePackService.getTxBase();
        const expList = allBase.filter((n) => n.type === 'expense' && (!fromDate || n.date >= fromDate) && (!toDate || n.date <= toDate));
        const incList = allBase.filter((n) => n.type === 'income' && (!fromDate || n.date >= fromDate) && (!toDate || n.date <= toDate));
        const debtList = allBase.filter((n) => n.type === 'debt' && (!fromDate || n.date >= fromDate) && (!toDate || n.date <= toDate));

        const totalExp = expList.reduce((sum, x) => sum + Number(x.amount || 0), 0);
        const totalInc = incList.reduce((sum, x) => sum + Number(x.amount || 0), 0);
        const totalDebt = debtList.reduce((sum, x) => sum + Number(x.amount || 0), 0);

        const periodLabel = (fromDate || toDate) ? `Periode: <b>${fromDate || 'Awal'}</b> s/d <b>${toDate || 'Sekarang'}</b>` : 'Periode: <b>Semua Waktu</b>';

        let infoText = '';
        if (cExp && !cInc && !cDebt && !cObl && !cSav) {
          infoText = `🔍 <b>Pratinjau Data:</b> Akan mengekspor <b>${expList.length} transaksi pengeluaran</b> dengan total <b>${rupiah(totalExp)}</b> (${periodLabel}).`;
        } else if (cInc && !cExp && !cDebt && !cObl && !cSav) {
          infoText = `🔍 <b>Pratinjau Data:</b> Akan mengekspor <b>${incList.length} transaksi pemasukan</b> dengan total <b>${rupiah(totalInc)}</b> (${periodLabel}).`;
        } else if (cDebt && !cExp && !cInc && !cObl && !cSav) {
          infoText = `🔍 <b>Pratinjau Data:</b> Akan mengekspor <b>${debtList.length} catatan hutang</b> dengan total pokok <b>${rupiah(totalDebt)}</b> (${periodLabel}).`;
        } else if (cExp && cInc && !cObl && !cSav) {
          infoText = `🔍 <b>Pratinjau Data:</b> ${expList.length} Pengeluaran (${rupiah(totalExp)}) & ${incList.length} Pemasukan (${rupiah(totalInc)}) (${periodLabel}).`;
        } else {
          infoText = `🔍 <b>Pratinjau Data:</b> Laporan gabungan terpilih: ${cExp ? `${expList.length} Pengeluaran, ` : ''}${cInc ? `${incList.length} Pemasukan, ` : ''}${cDebt ? `${debtList.length} Hutang, ` : ''}${cObl ? `${FeaturePackService.obligations.length} Pos Wajib, ` : ''}${cSav ? `${FeaturePackService.savings.length} Tabungan` : ''} (${periodLabel}).`;
        }

        const previewEl = modal.querySelector('#cp104ExpLivePreview');
        if (previewEl) previewEl.innerHTML = infoText;
      }

      // Default awal
      updateScopeButtonsUI('expense_only');
      applyScopeCheckboxes('expense_only');

      // Backup JSON opsional
      modal.querySelector('#cp104ExpJsonBackup').onclick = async () => {
        try {
          const payload = {
            app: 'Catatan Pintar',
            backupFormat: 'finance-v2',
            version: APP_VERSION,
            exportedAt: new Date().toISOString(),
            transactions: this.getTxBase().map((n) => ({ id: n.id, title: n.title, type: n.type, amount: n.amount, date: n.date, finance: n.finance })),
            obligations: this.obligations,
            savings: this.savings,
            history: loadHistory()
          };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          const jsonSaveResult = await AttachmentService.saveOrDownloadBlob(blob, `catatan-pintar-keuangan-${today()}.json`, 'application/json');
          if (jsonSaveResult?.cancelled) {
            this.ctx.toast('Ekspor JSON dibatalkan.', 'info');
          } else {
            this.ctx.toast('Data JSON keuangan berhasil diunduh.', 'info');
          }
          modal.classList.remove('open');
        } catch (err) {
          this.ctx.toast(`Gagal ekspor JSON: ${err.message || err}`, 'danger');
        }
      };

      // Submit Form PDF
      modal.querySelector('#cp104ExportForm').onsubmit = async (e) => {
        e.preventDefault();
        await this.processPdfExport();
      };
    }

    // Sinkronisasi input tanggal awal berdasarkan filter aktif di layar
    const currentFrom = document.getElementById('cp104FinFrom')?.value || '';
    const currentTo = document.getElementById('cp104FinTo')?.value || '';
    modal.querySelector('#cp104ExpFrom').value = currentFrom;
    modal.querySelector('#cp104ExpTo').value = currentTo;

    // Reset ke scope default atau pertahankan state
    const activeBtn = modal.querySelector('.cp-scope-btn.active') || modal.querySelector('.cp-scope-btn[data-scope="expense_only"]');
    if (activeBtn) activeBtn.click();

    modal.classList.add('open');
  },

  async processPdfExport() {
    const modal = document.getElementById('cp104ExportModal');
    if (!modal) return;
    const submitBtn = modal.querySelector('#cp104ExpSubmitPdf');
    const reportScope = modal.dataset.reportScope || 'expense_only';
    const fromDate = modal.querySelector('#cp104ExpFrom')?.value || '';
    const toDate = modal.querySelector('#cp104ExpTo')?.value || '';

    const sections = {
      summary: modal.querySelector('#cp104SecSummary')?.checked || false,
      txExpense: modal.querySelector('#cp104SecTxExpense')?.checked || false,
      txIncome: modal.querySelector('#cp104SecTxIncome')?.checked || false,
      debts: modal.querySelector('#cp104SecDebt')?.checked || false,
      obligations: modal.querySelector('#cp104SecObligation')?.checked || false,
      savings: modal.querySelector('#cp104SecSavings')?.checked || false,
      history: modal.querySelector('#cp104SecHistory')?.checked || false
    };

    if (!Object.values(sections).some(Boolean)) {
      this.ctx.toast('Pilih setidaknya satu bagian laporan untuk diekspor.', 'danger');
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Merender PDF…';
      this.ctx.toast('Sedang menata dan merender laporan PDF resmi…', 'info');

      // Filter daftar transaksi sesuai rentang tanggal
      const allTx = this.getTxBase().filter((n) => {
        if (fromDate && n.date < fromDate) return false;
        if (toDate && n.date > toDate) return false;
        return true;
      }).sort((a, b) => String(a.date).localeCompare(String(b.date)) || (a.createdAt || 0) - (b.createdAt || 0));

      const expenseList = allTx.filter((x) => x.type === 'expense');
      const incomeList = allTx.filter((x) => x.type === 'income');
      const debtList = allTx.filter((x) => x.type === 'debt');

      // Perhitungan Statistik Khusus
      const expenseTotal = expenseList.reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const expenseCount = expenseList.length;
      const expenseAvg = expenseCount > 0 ? Math.round(expenseTotal / expenseCount) : 0;
      let expenseMax = 0;
      let expenseMaxTitle = '';
      expenseList.forEach((x) => {
        if (x.amount > expenseMax) {
          expenseMax = x.amount;
          expenseMaxTitle = x.title || 'Pengeluaran';
        }
      });

      const incomeTotal = incomeList.reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const incomeCount = incomeList.length;
      const incomeAvg = incomeCount > 0 ? Math.round(incomeTotal / incomeCount) : 0;
      let incomeMax = 0;
      let incomeMaxTitle = '';
      incomeList.forEach((x) => {
        if (x.amount > incomeMax) {
          incomeMax = x.amount;
          incomeMaxTitle = x.title || 'Pemasukan';
        }
      });

      const debtTotal = debtList.reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const debtPaid = debtList.reduce((sum, x) => sum + (x.paidAmount || 0), 0);
      const debtRemain = Math.max(0, debtTotal - debtPaid);
      const debtCount = debtList.length;
      const debtPaidRatio = debtTotal > 0 ? Math.min(100, Math.round((debtPaid / debtTotal) * 100)) : 0;

      const obligationTotal = this.obligations.reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const obligationPaid = this.obligations.reduce((sum, x) => sum + (x.paidAmount || (x.isPaid ? x.amount : 0)), 0);
      const obligationRemain = Math.max(0, obligationTotal - obligationPaid);

      const savingsTotal = this.savings.reduce((sum, x) => sum + Number(x.balance || 0), 0);

      const netExpenseFromNet = expenseList.reduce((sum, x) => sum + sumFunding((x.funding || []).filter(f => f.id === 'net')), 0);
      const paidDebtNet = debtList.reduce((sum, x) => sum + netFromPayments(debtPayments(x)), 0);
      const paidObNet = this.obligations.reduce((sum, x) => sum + netFromPayments(obligationPayments(x)), 0);
      const netBalance = incomeTotal - netExpenseFromNet - paidDebtNet - paidObNet;

      const summaryData = {
        expenseTotal,
        expenseCount,
        expenseAvg,
        expenseMax,
        expenseMaxTitle,
        incomeTotal,
        incomeCount,
        incomeAvg,
        incomeMax,
        incomeMaxTitle,
        debtTotal,
        debtPaid,
        debtRemain,
        debtCount,
        debtPaidRatio,
        obligationTotal,
        obligationPaid,
        obligationRemain,
        savingsTotal,
        netBalance
      };

      // Filter history log jika disertakan
      const allHistory = loadHistory().filter((h) => {
        if (!h.at) return false;
        const hDate = localDateFromTimestamp(h.at);
        if (fromDate && hDate < fromDate) return false;
        if (toDate && hDate > toDate) return false;
        return true;
      }).sort((a, b) => b.at - a.at);

      // Generate PDF Blob
      const pdfBlob = await FinancePdfReportService.generateReport({
        reportScope,
        fromDate,
        toDate,
        sections,
        expenseList,
        incomeList,
        debtList,
        obligationList: this.obligations,
        savingsList: this.savings,
        historyList: allHistory,
        summaryData
      });

      const safeDateTag = fromDate && toDate ? `${fromDate}_sd_${toDate}` : (fromDate || toDate || today());
      let filePrefix = 'Laporan_Keuangan';
      if (sections.txExpense && !sections.txIncome && !sections.debts && !sections.obligations && !sections.savings) {
        filePrefix = 'Laporan_Pengeluaran';
      } else if (sections.txIncome && !sections.txExpense && !sections.debts && !sections.obligations && !sections.savings) {
        filePrefix = 'Laporan_Pemasukan';
      } else if (sections.debts && !sections.txExpense && !sections.txIncome && !sections.obligations && !sections.savings) {
        filePrefix = 'Laporan_Hutang';
      }
      const fileName = `${filePrefix}_CatatanPintar_${safeDateTag}.pdf`;

      const saveResult = await AttachmentService.saveOrDownloadBlob(pdfBlob, fileName, 'application/pdf');
      if (saveResult?.cancelled) {
        this.ctx.toast('Ekspor PDF dibatalkan.', 'info');
      } else if (saveResult?.method === 'android-save-picker' || saveResult?.method === 'android-downloads') {
        const loc = saveResult?.location || 'lokasi yang kamu pilih';
        this.ctx.toast(`✅ PDF tersimpan di ${loc}`, 'info', 6000);
      } else if (saveResult?.method === 'blob-download') {
        this.ctx.toast('PDF diproses lewat metode unduhan browser biasa — kalau tidak ketemu filenya, cek folder Download utama HP kamu, atau update aplikasi ke versi terbaru.', 'info', 7000);
      } else {
        this.ctx.toast('Laporan PDF berhasil dibuat dan diunduh.', 'info');
      }
      modal.classList.remove('open');
    } catch (err) {
      this.ctx.toast(`Gagal membuat PDF: ${err.message || err}`, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '📥 Unduh Laporan PDF';
    }
  },

  buildImageModal() {
    if (document.getElementById('cp104ImageModal')) return;
    const modal = document.createElement('div'); modal.id = 'cp104ImageModal'; modal.className = 'cp104-modal';
    modal.innerHTML = '<div class="cp104-dialog"><div class="cp104-head"><div class="cp104-title">🖼️ Anotasi Gambar</div><button type="button" class="cp104-btn" id="cp104ImgClose">Tutup</button></div><div class="cp104-tools"><button type="button" data-tool="pen">✏️ Pena</button><button type="button" data-tool="line">╱ Garis</button><button type="button" data-tool="rect">□ Kotak</button><button type="button" data-tool="ellipse">○ Elips</button><button type="button" data-tool="arrow">➜ Panah</button><button type="button" data-tool="eraser">⌫ Penghapus</button><button type="button" id="cp104ImgText">Teks</button><input type="color" id="cp104ImgColor" value="#a3402f"><input type="range" id="cp104ImgSize" min="1" max="20" value="4"><button type="button" id="cp104ImgUndo">Undo</button><button type="button" id="cp104ImgRedo">Redo</button><button type="button" id="cp104ImgClear">Bersihkan</button></div><div class="cp104-canvas-wrap"><canvas id="cp104ImgBase"></canvas><canvas id="cp104ImgDraw"></canvas><canvas id="cp104ImgTextLayer"></canvas></div><div class="cp104-actions" style="justify-content:flex-end;margin-top:8px"><button type="button" class="cp104-btn" id="cp104ImgCancel">Batal</button><button type="button" class="cp104-btn primary" id="cp104ImgSave">Simpan sebagai lampiran</button></div></div>';
    document.body.appendChild(modal);
    const base = modal.querySelector('#cp104ImgBase'); const draw = modal.querySelector('#cp104ImgDraw'); const textLayer = modal.querySelector('#cp104ImgTextLayer'); ImageEditorService.init(base, draw, textLayer);
    modal.querySelector('#cp104ImgClose').onclick = modal.querySelector('#cp104ImgCancel').onclick = () => { modal.classList.remove('open'); this._imageEditAttachmentId=null; if(this._imageInsertionMarkerId){this.ctx.removeEditorInsertionMarker?.(this._imageInsertionMarkerId);this._imageInsertionMarkerId=null;} };
    modal.querySelectorAll('[data-tool]').forEach((button) => button.onclick = () => ImageEditorService.setTool(button.dataset.tool));
    modal.querySelector('#cp104ImgColor').oninput = (e) => ImageEditorService.setColor(e.target.value);
    modal.querySelector('#cp104ImgSize').oninput = (e) => ImageEditorService.setSize(e.target.value);
    modal.querySelector('#cp104ImgUndo').onclick = () => ImageEditorService.undo();
    modal.querySelector('#cp104ImgRedo').onclick = () => ImageEditorService.redo();
    modal.querySelector('#cp104ImgClear').onclick = () => ImageEditorService.clear();
    modal.querySelector('#cp104ImgText').onclick = () => { ImageEditorService.setTool('text'); const text = window.prompt('Teks anotasi (setelah muncul, pilih alat Teks lalu seret teks untuk memindahkannya):'); if (text) { const item = ImageEditorService.addText(Math.round(ImageEditorService.width * 0.12), Math.round(ImageEditorService.height * 0.18), text); if (item) this.ctx.toast('Teks ditambahkan. Pilih alat Teks lalu seret teks untuk memindahkannya.', 'info'); } };
    modal.querySelector('#cp104ImgSave').onclick = () => {
      try {
        const data = ImageEditorService.exportFlattened();
        const id = this._imageEditAttachmentId || uid('img');
        const old = this.ctx.getCurrentAttachment?.(id);
        const att = { id, name: this._imageEditAttachmentId ? (old?.name || `anotasi_${today()}.png`) : `anotasi_${today()}.png`, mime: 'image/png', ext: 'png', size: Math.round(data.length * .75), dataURL: data, kind: 'image', createdAt: old?.createdAt || Date.now() };
        if (this._imageEditAttachmentId) {
          const ok = this.ctx.replaceAttachmentInCurrentNote?.(att, id);
          if (!ok) throw new Error('Catatan yang memuat lampiran sudah tidak aktif. Perubahan dibatalkan.');
          this.ctx.toast('Anotasi gambar diperbarui tanpa menghapus isi catatan atau lampiran lain.', 'info');
        } else {
          const ok = this.ctx.addAttachmentToCurrentNote?.(att, { markerId: this._imageInsertionMarkerId });
          if (!ok) throw new Error('Catatan yang sedang diedit tidak ditemukan.');
          this.ctx.toast('Gambar beranotasi ditambahkan tanpa menghapus isi atau lampiran sebelumnya.', 'info');
        }
        this._imageEditAttachmentId=null; this._imageInsertionMarkerId=null; modal.classList.remove('open');
      } catch (error) { this.ctx.toast(error.message || 'Gagal menyimpan anotasi.', 'danger'); }
    };
  },

  async openImageEditor(sourceAttachment = null, markerId = null) {
    if (!document.getElementById('cp104ImageModal')) this.buildImageModal();
    this._imageEditAttachmentId = sourceAttachment?.id || null;
    this._imageInsertionMarkerId = markerId || null;
    if (sourceAttachment) {
      try {
        const dataURL = sourceAttachment.dataURL || await this.ctx.getAttachmentData?.(sourceAttachment);
        if (!dataURL) throw new Error('Data gambar tidak ditemukan.');
        await ImageEditorService.loadImage(dataURL);
        const modal=document.getElementById('cp104ImageModal'); modal.querySelector('#cp104ImgSave').textContent='💾 Simpan Perubahan'; modal.querySelector('.cp104-title').textContent='🖼️ Edit / Anotasi Gambar'; modal.classList.add('open');
      } catch (error) { this.ctx.toast(error.message, 'danger'); this._imageEditAttachmentId=null; }
      return;
    }
    const input = document.getElementById('cp104ImagePicker') || (() => { const i=document.createElement('input'); i.type='file'; i.accept='image/*'; i.id='cp104ImagePicker'; i.style.display='none'; document.body.appendChild(i); return i; })();
    input.onchange = () => {
      const file=input.files?.[0]; input.value='';
      if(!file){ if(this._imageInsertionMarkerId)this.ctx.removeEditorInsertionMarker?.(this._imageInsertionMarkerId); this._imageInsertionMarkerId=null; return; }
      const reader=new FileReader(); reader.onload=async()=>{ try { await ImageEditorService.loadImage(reader.result); const modal=document.getElementById('cp104ImageModal'); modal.querySelector('#cp104ImgSave').textContent='📥 Simpan sebagai Lampiran'; modal.querySelector('.cp104-title').textContent='🖼️ Anotasi Gambar'; modal.classList.add('open'); } catch(error){ this.ctx.toast(error.message,'danger'); if(this._imageInsertionMarkerId)this.ctx.removeEditorInsertionMarker?.(this._imageInsertionMarkerId); this._imageInsertionMarkerId=null; } }; reader.readAsDataURL(file);
    };
    input.click();
  }
};
