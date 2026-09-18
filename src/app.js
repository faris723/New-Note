/**
 * Catatan Pintar — Offline
 * Main Application Orchestrator & UI Controller
 */

import { SecurityService } from './modules/security.js';
import { AttachmentService } from './modules/attachment.js';
import { StorageService, CORE_CATEGORIES } from './modules/storage.js';
import { AudioVoiceService } from './modules/audio.js';
import { ReminderService } from './modules/reminder.js';
import { SketchService } from './modules/sketch.js';
import { FinanceService } from './modules/finance.js';
import { ExportImportService } from './modules/exportImport.js';
import { AssistantService } from './modules/assistant.js';
import { EditorService } from './modules/editor.js';
import { PWAService } from './modules/pwa.js';
import { UpdateService } from './modules/update.js';
import { FileOpenService } from './modules/fileOpen.js';
import { APP_VERSION } from './version.js';
import { FeaturePackService } from './modules/featurePack.js';
import { App as CapacitorApp } from '@capacitor/app';
import { PdfViewer } from './modules/pdfViewer.js';

// Application State
let notes = [];
let categories = [];
let activeCategory = 'all';
let currentNoteId = null;
let currentNoteIsPinned = false;
let currentAttachments = [];
let pendingDeleteId = null;
let pendingImportData = null;
let isSelectMode = false;
let selectedNoteIds = new Set();
let recTimerInterval = null;
let recSeconds = 0;
let autoDetectCategoryEnabled = true;
const TOOL_ONLY_CATEGORIES = new Set(['keuangan', 'acara']);

// DOM Elements cache
const el = {};

function cacheElements() {
  const ids = [
    'financeBtn', 'manageCatBtn', 'filterToggleBtn', 'importMainBtn', 'exportMainBtn', 'selectModeBtn',
    'installAppBtn', 'updateBadgeBtn', 'installModalOverlay', 'closeInstallModalBtn', 'closeInstallModalFootBtn', 'doInstallPromptBtn', 'offlineIndicator',
    'storageBarWrap', 'storageFill', 'storageText', 'storageWarningBanner',
    'envBadgeBtn', 'envBadgeIcon', 'envBadgeText',
    'storageEnvModalOverlay', 'closeStorageEnvModalBtn', 'closeStorageEnvModalFootBtn', 'envModalActiveName', 'switchEnvBtn', 'copyBrowserToAppBtn', 'copyAppToBrowserBtn',
    'browserWipedRecoveryBanner', 'quickRestoreVaultBtn', 'dismissRecoveryBannerBtn',
    'openApkInfoBtn', 'apkModalOverlay', 'closeApkModalBtn', 'closeApkModalFootBtn',
    'updateModalOverlay', 'closeUpdateModalBtn', 'closeUpdateModalLaterBtn', 'updateModalBody', 'updateDownloadBtn', 'updateVersionText', 'updateStatusText', 'checkUpdateBtn',
    'vaultStatusBox', 'vaultStatusText', 'linkVaultBtn', 'restoreVaultBtn', 'downloadBackupBtn',
    'searchInput', 'searchClearBtn',
    'filterPanel', 'filterCategory', 'filterAttachType', 'filterDateFrom', 'filterDateTo', 'filterResetBtn',
    'chipsRow', 'notesList', 'emptyState', 'fabChat', 'fabAdd',
    'overlay', 'editorModeLabel', 'pinEditorBtn', 'closeEditorBtn', 'noteTitle', 'toolbar', 'fontSizeSelect', 'fontFamilySelect',
    'insertTableBtn', 'openSketchBtn', 'insertFileBtn', 'inlineFileInput', 'noteBody',
    'categorySelect', 'categoryHint',
    'reminderRow', 'noteReminderInput', 'clearReminderBtn', 'notifyPermBtn',
    'financeRow', 'financeType', 'financeAmount',
    'financeDebtRow', 'debtTo', 'debtPurpose', 'debtPaid',
    'voiceModeAudio', 'voiceModeText', 'voiceRecordBtn', 'recIndicator', 'recTimer', 'voiceStatus',
    'attachList', 'dropZone', 'fileInput', 'attachStatus',
    'statusMsg', 'saveBtn', 'cancelBtn', 'exportNoteBtn', 'deleteBtn',
    'confirmOverlay', 'confirmMsg', 'confirmCancelBtn', 'confirmOkBtn',
    'catOverlay', 'catList', 'newCatIcon', 'newCatInput', 'newCatColor', 'addCatBtn', 'closeCatBtn',
    'exportOverlay', 'closeExportModalBtn', 'exportCountText', 'cancelExportBtn', 'doExportBtn', 'exportProgressWrap', 'exportProgressBar', 'exportProgressText',
    'importOverlay', 'closeImportModalBtn', 'importDropZone', 'importFileInput', 'importFileInfo', 'importFileName', 'importFileSize', 'importFileStats', 'importStatusMsg', 'importProgressWrap', 'importProgressBar', 'importProgressText', 'cancelImportBtn', 'doImportBtn',
    'financeOverlay', 'closeFinanceTopBtn', 'financeFrom', 'financeTo', 'financeSummary', 'financeChartsWrap', 'donutChartContainer', 'barChartContainer', 'financeTxList', 'debtUnpaidCount', 'debtUnpaidList', 'debtPaidCount', 'debtPaidList', 'exportFinanceBtn', 'closeFinanceBtn',
    'sketchOverlay', 'closeSketchBtn', 'sketchToolPen', 'sketchToolBrush', 'sketchToolEraser', 'sketchSize', 'sketchSizeVal', 'sketchPalette', 'sketchCustomColor', 'sketchUndoBtn', 'sketchRedoBtn', 'sketchClearBtn', 'sketchStage', 'sketchCanvas', 'cancelSketchBtn', 'insertSketchBtn',
    'reminderAlertOverlay', 'reminderAlertTitle', 'reminderAlertBody', 'reminderAlertDismissBtn', 'reminderAlertOpenBtn',
    'chatOverlay', 'closeChatBtn', 'chatMessages', 'chatInput', 'chatSendBtn',
    'viewerOverlay', 'viewerFileName', 'viewerFileMeta', 'downloadViewerBtn', 'editViewerBtn', 'closeViewerBtn', 'viewerBody',
    'toastContainer', 'printArea'
  ];
  ids.forEach(id => {
    el[id] = document.getElementById(id);
  });
}

const UIService = {
  debounce(func, wait = 200) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  showToast(message, type = 'info', actionText = null, onAction = null, duration = 4000) {
    if (!el.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    if (actionText && onAction) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = actionText;
      btn.onclick = () => {
        onAction();
        toast.remove();
      };
      toast.appendChild(btn);
    }

    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  },

  async updateStorageMeter() {
    const { percentage, formattedUsed, formattedMax } = await StorageService.getStorageUsage();
    if (el.storageFill && el.storageText) {
      el.storageFill.style.width = `${percentage}%`;
      el.storageFill.className = 'storage-fill' + (percentage >= 85 ? ' danger' : percentage >= 70 ? ' warn' : '');
      el.storageText.textContent = `${formattedUsed} / ~${formattedMax} (${percentage}%)`;
    }
    if (el.storageWarningBanner) {
      if (percentage >= 80) {
        el.storageWarningBanner.classList.add('show');
      } else {
        el.storageWarningBanner.classList.remove('show');
      }
    }
  },

  formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' +
           d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
};

/* ==========================================================================
   CATEGORY HELPERS & AUTO-DETECTION
   ========================================================================== */

function getCategory(id) {
  return categories.find(c => c.id === id) || null;
}

function detectCategoryFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const cat of categories) {
    if (TOOL_ONLY_CATEGORIES.has(cat.id)) continue;
    if (cat.core && Array.isArray(cat.keywords)) {
      for (const kw of cat.keywords) {
        const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        if (regex.test(lower)) return cat.id;
      }
    }
  }
  return null;
}

function renderCategoryChips() {
  if (!el.chipsRow) return;
  el.chipsRow.innerHTML = '';

  const visibleNotes = notes.filter(n => !TOOL_ONLY_CATEGORIES.has(n.category));
  const allCount = visibleNotes.length;
  const allChip = document.createElement('button');
  allChip.className = `chip ${activeCategory === 'all' ? 'active' : ''}`;
  allChip.innerHTML = `✨ Semua <span class="chip-count">${allCount}</span>`;
  allChip.onclick = () => {
    activeCategory = 'all';
    renderCategoryChips();
    renderNotesList();
  };
  el.chipsRow.appendChild(allChip);

  categories.filter(cat => !TOOL_ONLY_CATEGORIES.has(cat.id)).forEach(cat => {
    const count = visibleNotes.filter(n => n.category === cat.id).length;
    const chip = document.createElement('button');
    chip.className = `chip ${activeCategory === cat.id ? 'active' : ''}`;
    chip.innerHTML = `${cat.icon || '📁'} ${SecurityService.escapeHtml(cat.name)} <span class="chip-count">${count}</span>`;
    chip.onclick = () => {
      activeCategory = cat.id;
      renderCategoryChips();
      renderNotesList();
    };
    el.chipsRow.appendChild(chip);
  });
}

function populateCategorySelect() {
  if (!el.categorySelect) return;
  el.categorySelect.innerHTML = '';
  categories.filter(cat => !TOOL_ONLY_CATEGORIES.has(cat.id)).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon || '📁'} ${cat.name}`;
    el.categorySelect.appendChild(opt);
  });

  if (el.filterCategory) {
    const curr = el.filterCategory.value;
    el.filterCategory.innerHTML = '<option value="">Semua Kategori</option>';
    categories.filter(cat => !TOOL_ONLY_CATEGORIES.has(cat.id)).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = `${cat.icon || '📁'} ${cat.name}`;
      el.filterCategory.appendChild(opt);
    });
    el.filterCategory.value = curr || '';
  }
}

/* ==========================================================================
   NOTES LIST RENDERING & DEBT ACTIONS
   ========================================================================== */

function getFilteredNotes() {
  let list = notes.filter(n => !TOOL_ONLY_CATEGORIES.has(n.category));

  // Category filter
  if (activeCategory !== 'all') {
    list = list.filter(n => n.category === activeCategory);
  }

  // Search keyword filter
  const q = (el.searchInput && el.searchInput.value || '').trim().toLowerCase();
  if (q) {
    list = list.filter(n => {
      const titleMatch = (n.title || '').toLowerCase().includes(q);
      const bodyMatch = SecurityService.stripHtml(n.bodyHTML || '').toLowerCase().includes(q);
      const attachMatch = (n.attachments || []).some(a => (a.name || '').toLowerCase().includes(q));
      return titleMatch || bodyMatch || attachMatch;
    });
  }

  // Extra filter panel
  if (el.filterCategory && el.filterCategory.value) {
    list = list.filter(n => n.category === el.filterCategory.value);
  }

  if (el.filterAttachType && el.filterAttachType.value) {
    const targetType = el.filterAttachType.value;
    list = list.filter(n => {
      if (!n.attachments || n.attachments.length === 0) return false;
      return n.attachments.some(a => AttachmentService.classifyAttachment(a) === targetType);
    });
  }

  if (el.filterDateFrom && el.filterDateFrom.value) {
    const fromTs = new Date(el.filterDateFrom.value + 'T00:00:00').getTime();
    list = list.filter(n => (n.updatedAt || n.createdAt) >= fromTs);
  }

  if (el.filterDateTo && el.filterDateTo.value) {
    const toTs = new Date(el.filterDateTo.value + 'T23:59:59').getTime();
    list = list.filter(n => (n.updatedAt || n.createdAt) <= toTs);
  }

  // Sort: pinned notes first, then newest updated first
  list.sort((a, b) => {
    const aPinned = Boolean(a.isPinned);
    const bPinned = Boolean(b.isPinned);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }
    return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
  });

  return list;
}

function renderNotesList() {
  if (!el.notesList) return;
  el.notesList.innerHTML = '';

  const filtered = getFilteredNotes();

  if (filtered.length === 0) {
    if (el.emptyState) {
      el.emptyState.style.display = 'block';
      el.emptyState.innerHTML = `
        <div style="font-size:32px; margin-bottom:8px;">📝</div>
        <p style="font-size:15px; font-weight:600; color:var(--ink);">Belum ada catatan ditemukan</p>
        <p style="font-size:12px; color:var(--ink-soft); margin-top:4px;">Klik tombol "+" di sudut kanan bawah untuk menulis catatan baru.</p>
      `;
    }
    return;
  }

  if (el.emptyState) el.emptyState.style.display = 'none';

  filtered.forEach(note => {
    const cat = getCategory(note.category);
    const card = document.createElement('div');
    card.className = `note-card ${selectedNoteIds.has(note.id) ? 'selected' : ''} ${note.isPinned ? 'is-pinned' : ''}`;
    card.id = `card_${note.id}`;

    // Header row with category, pinned indicator, and pin toggle button
    const headerRow = document.createElement('div');
    headerRow.className = 'note-card-header-row';

    const catBar = document.createElement('div');
    catBar.className = 'note-card-cat';
    catBar.style.color = cat ? cat.color : 'var(--ink-soft)';
    catBar.innerHTML = `${cat ? cat.icon : '📁'} ${cat ? SecurityService.escapeHtml(cat.name) : 'Umum'}`;

    if (note.isPinned) {
      const pinnedTag = document.createElement('span');
      pinnedTag.className = 'note-pinned-tag';
      pinnedTag.textContent = '📌 Disematkan';
      catBar.appendChild(pinnedTag);
    }

    // Select mode checkbox
    if (isSelectMode) {
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = selectedNoteIds.has(note.id);
      chk.onclick = (e) => {
        e.stopPropagation();
        if (chk.checked) {
          selectedNoteIds.add(note.id);
          card.classList.add('selected');
        } else {
          selectedNoteIds.delete(note.id);
          card.classList.remove('selected');
        }
        updateSelectModeUI();
      };
      catBar.prepend(chk);
    }

    // Pin toggle button on card
    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = `note-pin-btn ${note.isPinned ? 'active' : ''}`;
    pinBtn.title = note.isPinned ? 'Lepas sematan catatan' : 'Sematkan catatan ke posisi paling atas';
    pinBtn.innerHTML = note.isPinned ? '📌' : '📍';
    pinBtn.onclick = async (e) => {
      e.stopPropagation();
      note.isPinned = !note.isPinned;
      note.updatedAt = Date.now();
      await StorageService.saveNote(note);
      renderNotesList();
      UIService.showToast(note.isPinned ? 'Catatan disematkan ke atas.' : 'Sematan catatan dilepas.', 'info');
    };

    headerRow.appendChild(catBar);
    headerRow.appendChild(pinBtn);
    card.appendChild(headerRow);

    // Title
    const title = document.createElement('div');
    title.className = 'note-card-title';
    title.textContent = note.title || 'Tanpa Judul';
    card.appendChild(title);

    // Reminder badge
    if (note.reminder && note.reminder.datetime) {
      const badgeInfo = ReminderService.formatReminderBadge(note.reminder);
      if (badgeInfo) {
        const badge = document.createElement('span');
        badge.className = `reminder-badge ${badgeInfo.status}`;
        badge.textContent = badgeInfo.text;
        card.appendChild(badge);
      }
    }

    // Body snippet
    const snippet = document.createElement('div');
    snippet.className = 'note-card-snippet';
    const plain = SecurityService.stripHtml(note.bodyHTML || '');
    snippet.textContent = plain.slice(0, 160) + (plain.length > 160 ? '…' : '');
    card.appendChild(snippet);

    // Finance badge & debt quick toggle
    if (note.category === 'keuangan' && note.finance && note.finance.amount) {
      const finRow = document.createElement('div');
      finRow.className = 'flex items-center justify-between gap-2 mt-2 pt-1 border-t border-[var(--card-edge)] text-xs';

      const finBadge = document.createElement('span');
      finBadge.className = `cat-badge ${note.finance.type === 'income' ? 'income' : note.finance.type === 'debt' ? 'debt' : 'expense'}`;
      const typeLabel = note.finance.type === 'income' ? 'Pemasukan' : note.finance.type === 'debt' ? 'Hutang' : 'Pengeluaran';
      finBadge.textContent = `${typeLabel}: ${FinanceService.formatRupiah(note.finance.amount)}`;
      finRow.appendChild(finBadge);

      // Quick toggle for debt
      if (note.finance.type === 'debt') {
        const toggleDebtBtn = document.createElement('button');
        toggleDebtBtn.type = 'button';
        toggleDebtBtn.className = `btn-subtle text-[11px] ${note.finance.debtPaid ? 'text-[var(--moss)] font-semibold' : 'text-[var(--danger)] font-medium'}`;
        toggleDebtBtn.innerHTML = note.finance.debtPaid ? '✅ Sudah Lunas' : '⏳ Tandai Lunas';
        toggleDebtBtn.title = note.finance.debtPaid ? 'Klik untuk tandai belum lunas' : 'Klik untuk tandai sudah lunas';
        toggleDebtBtn.onclick = async (e) => {
          e.stopPropagation();
          note.finance.debtPaid = !note.finance.debtPaid;
          note.updatedAt = Date.now();
          await StorageService.saveNote(note);
          renderNotesList();
          UIService.showToast(note.finance.debtPaid ? 'Hutang ditandai lunas.' : 'Hutang ditandai belum lunas.', 'info');
        };
        finRow.appendChild(toggleDebtBtn);
      }

      card.appendChild(finRow);
    }

    // Attachment badges count
    if (note.attachments && note.attachments.length > 0) {
      const attachInfo = document.createElement('div');
      attachInfo.className = 'text-[11px] text-[var(--ink-soft)] mt-2';
      attachInfo.innerHTML = `📎 <b>${note.attachments.length}</b> lampiran`;
      card.appendChild(attachInfo);
    }

    // Date footer
    const dateFooter = document.createElement('div');
    dateFooter.className = 'note-card-date';
    dateFooter.textContent = UIService.formatDate(note.updatedAt || note.createdAt);
    card.appendChild(dateFooter);

    // Card click opens note
    card.onclick = () => {
      if (isSelectMode) {
        if (selectedNoteIds.has(note.id)) {
          selectedNoteIds.delete(note.id);
          card.classList.remove('selected');
        } else {
          selectedNoteIds.add(note.id);
          card.classList.add('selected');
        }
        updateSelectModeUI();
      } else {
        openNoteEditor(note);
      }
    };

    el.notesList.appendChild(card);
  });
}

function updateSelectModeUI() {
  if (isSelectMode) {
    el.selectModeBtn.textContent = `☑ Selesai (${selectedNoteIds.size})`;
    el.selectModeBtn.classList.add('active');
  } else {
    el.selectModeBtn.textContent = '☑ Pilih';
    el.selectModeBtn.classList.remove('active');
  }
}

/* ==========================================================================
   NOTE EDITOR WORKFLOW
   ========================================================================== */

function openNoteEditor(note = null) {
  AttachmentService.revokeAllBlobUrls();

  if (note) {
    currentNoteId = note.id;
    currentNoteIsPinned = Boolean(note.isPinned);
    el.editorModeLabel.textContent = 'Sunting Catatan';
    el.noteTitle.value = note.title || '';
    el.noteBody.innerHTML = SecurityService.sanitizeHTML(note.bodyHTML || '');
    el.categorySelect.value = note.category || 'pribadi';
    autoDetectCategoryEnabled = false; // Disable auto-detect when editing existing note

    // Reminder setting
    if (note.reminder && note.reminder.datetime) {
      el.noteReminderInput.value = note.reminder.datetime;
    } else {
      el.noteReminderInput.value = '';
    }

    // Finance settings
    if (note.category === 'keuangan' && note.finance) {
      el.financeRow.style.display = 'flex';
      el.financeType.value = note.finance.type || 'expense';
      el.financeAmount.value = note.finance.amount || '';
      const financeDateEl = document.getElementById('cp104FinanceDate');
      if (financeDateEl) financeDateEl.value = note.finance.date || new Date(note.updatedAt || note.createdAt || Date.now()).toISOString().slice(0,10);
      if (note.finance.type === 'debt') {
        el.financeDebtRow.style.display = 'block';
        el.debtTo.value = note.finance.debtTo || '';
        el.debtPurpose.value = note.finance.debtPurpose || '';
        el.debtPaid.checked = !!note.finance.debtPaid;
      } else {
        el.financeDebtRow.style.display = 'none';
      }
    } else {
      el.financeRow.style.display = 'none';
      el.financeDebtRow.style.display = 'none';
      el.financeAmount.value = '';
    }

    const incomeFromEl = document.getElementById('cp104IncomeFrom');
    const expenseForEl = document.getElementById('cp104ExpenseFor');
    if (incomeFromEl) incomeFromEl.value = note.finance?.incomeFrom || '';
    if (expenseForEl) expenseForEl.value = note.finance?.expenseFor || '';
    const eventDateEl = document.getElementById('cp104EventDate');
    const eventLocationEl = document.getElementById('cp104EventLocation');
    if (eventDateEl) eventDateEl.value = note.eventDate || (note.reminder?.datetime ? note.reminder.datetime.slice(0,10) : '');
    if (eventLocationEl) eventLocationEl.value = note.eventLocation || '';

    currentAttachments = (note.attachments || []).map(a => ({ ...a }));
    removeOrphanInlineAttachmentChips();
    if (note.finance?.type === 'expense') FeaturePackService.setEditorFunding(note.finance.funding || [{id:'net',amount:Number(note.finance.amount)||0}], Number(note.finance.amount)||0, note.id);
    el.deleteBtn.style.display = 'inline-block';
    el.exportNoteBtn.style.display = 'inline-block';
  } else {
    // New Note
    currentNoteId = null;
    el.editorModeLabel.textContent = 'Tulis Catatan Baru';
    el.noteTitle.value = '';
    el.noteBody.innerHTML = '';
    el.categorySelect.value = activeCategory !== 'all' ? activeCategory : 'pribadi';
    autoDetectCategoryEnabled = true;
    el.noteReminderInput.value = '';

    el.financeRow.style.display = el.categorySelect.value === 'keuangan' ? 'flex' : 'none';
    el.financeDebtRow.style.display = 'none';
    el.financeAmount.value = '';
    const financeDateEl = document.getElementById('cp104FinanceDate');
    if (financeDateEl) financeDateEl.value = new Date().toISOString().slice(0,10);
    el.debtTo.value = '';
    el.debtPurpose.value = '';
    el.debtPaid.checked = false;
    const incomeFromEl = document.getElementById('cp104IncomeFrom');
    const expenseForEl = document.getElementById('cp104ExpenseFor');
    if (incomeFromEl) incomeFromEl.value = '';
    if (expenseForEl) expenseForEl.value = '';
    const eventDateEl = document.getElementById('cp104EventDate');
    const eventLocationEl = document.getElementById('cp104EventLocation');
    if (eventDateEl) eventDateEl.value = '';
    if (eventLocationEl) eventLocationEl.value = '';

    currentAttachments = [];
    FeaturePackService.setEditorFunding([{id:'net',amount:0}], 0, null);
    currentNoteIsPinned = false;
    el.deleteBtn.style.display = 'none';
    el.exportNoteBtn.style.display = 'none';
  }

  updateEditorPinUI();

  // Check notification permission state
  if (ReminderService.getPermissionState() === 'default' && el.notifyPermBtn) {
    el.notifyPermBtn.style.display = 'inline-block';
  } else if (el.notifyPermBtn) {
    el.notifyPermBtn.style.display = 'none';
  }

  renderAttachmentsList();
  el.overlay.classList.add('open');
  el.noteTitle.focus();
}

function updateEditorPinUI() {
  if (!el.pinEditorBtn) return;
  if (currentNoteIsPinned) {
    el.pinEditorBtn.classList.add('pinned');
    el.pinEditorBtn.innerHTML = '📌 Disematkan';
    el.pinEditorBtn.title = 'Klik untuk melepas sematan catatan';
  } else {
    el.pinEditorBtn.classList.remove('pinned');
    el.pinEditorBtn.innerHTML = '📍 Sematkan';
    el.pinEditorBtn.title = 'Klik untuk menyematkan catatan ke posisi paling atas';
  }
}

function closeNoteEditor() {
  AttachmentService.revokeAllBlobUrls();
  EditorService.clearInsertionMarker?.();
  AudioVoiceService.stopAudioRecording();
  AudioVoiceService.stopSpeechRecognition();
  resetVoiceRecordingUI();
  el.overlay.classList.remove('open');
}

async function saveCurrentNote() {
  const previousNote = currentNoteId ? notes.find(n => n.id === currentNoteId) : null;
  const title = el.noteTitle.value.trim() || 'Tanpa Judul';
  const bodyHTML = SecurityService.sanitizeHTML(el.noteBody.innerHTML);
  const category = el.categorySelect.value;

  // Finance
  let finance = null;
  if (category === 'keuangan') {
    const amt = parseFloat(el.financeAmount.value) || 0;
    if (amt <= 0) {
      UIService.showToast('Nominal transaksi harus lebih besar dari 0.', 'danger');
      el.financeAmount.focus();
      return;
    }
    finance = {
      type: el.financeType.value,
      amount: amt,
      date: (document.getElementById('cp104FinanceDate')?.value || new Date().toISOString().slice(0,10)),
      debtTo: el.debtTo.value.trim(),
      debtPurpose: el.debtPurpose.value.trim(),
      debtPaid: el.debtPaid.checked,
      incomeFrom: (document.getElementById('cp104IncomeFrom')?.value || '').trim(),
      expenseFor: (document.getElementById('cp104ExpenseFor')?.value || '').trim()
    };
    if (finance.type === 'expense') {
      try { finance.funding = FeaturePackService.readEditorFunding(amt, previousNote); }
      catch (fundErr) { UIService.showToast(fundErr.message, 'danger'); return; }
    }
  }

  // Reminder
  let reminder = null;
  if (el.noteReminderInput.value) {
    reminder = {
      datetime: el.noteReminderInput.value,
      notified: false
    };
  }

  const eventDateEl = document.getElementById('cp104EventDate');
  const eventLocationEl = document.getElementById('cp104EventLocation');
  const eventDate = category === 'acara' ? ((eventDateEl?.value || '').trim() || (el.noteReminderInput.value ? el.noteReminderInput.value.slice(0,10) : '')) : '';
  const eventLocation = category === 'acara' ? (eventLocationEl?.value || '').trim() : '';
  if (category === 'acara' && !eventDate) {
    UIService.showToast('Tanggal acara wajib diisi.', 'danger');
    return;
  }

  const now = Date.now();
  let noteObj;

  if (currentNoteId) {
    const existing = notes.find(n => n.id === currentNoteId);
    noteObj = {
      ...existing,
      title,
      bodyHTML,
      category,
      isPinned: currentNoteIsPinned,
      finance,
      reminder,
      eventDate,
      eventLocation,
      attachments: currentAttachments,
      updatedAt: now
    };
    const idx = notes.findIndex(n => n.id === currentNoteId);
    if (idx !== -1) notes[idx] = noteObj;
  } else {
    noteObj = {
      id: 'note_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      bodyHTML,
      category,
      isPinned: currentNoteIsPinned,
      finance,
      reminder,
      eventDate,
      eventLocation,
      attachments: currentAttachments,
      createdAt: now,
      updatedAt: now
    };
    notes.unshift(noteObj);
  }

  // Jika transaksi lama tadinya memakai tabungan tetapi sekarang bukan pengeluaran, kembalikan saldo tabungan lama.
  if (previousNote?.finance?.type === 'expense' && finance?.type !== 'expense') {
    try { FeaturePackService.applySavingsDelta(previousNote.finance.funding || [{ id:'net', amount:Number(previousNote.finance.amount)||0 }], 1); }
    catch (restoreErr) { UIService.showToast(restoreErr.message, 'danger'); return; }
  }

  // Terapkan perubahan sumber dana untuk pengeluaran. Dana tabungan benar-benar berkurang; Dana Bersih dihitung dari transaksi.
  if (finance?.type === 'expense') {
    try { FeaturePackService.applyEditorFunding(finance.funding || [{ id:'net', amount: finance.amount }], previousNote); }
    catch (fundErr) { UIService.showToast(fundErr.message, 'danger'); return; }
    await FeaturePackService.recordFundingHistory('transaction', noteObj.id, currentNoteId ? 'Ubah pengeluaran' : 'Pengeluaran', finance.amount, finance.funding || [], { note: finance.expenseFor || '' });
  } else if (finance?.type === 'income') {
    await FeaturePackService.recordFundingHistory('transaction', noteObj.id, currentNoteId ? 'Ubah pemasukan' : 'Pemasukan', finance.amount, [], { note: finance.incomeFrom || '' });
  }

  // Save to storage only after all funding changes are valid. If persistence fails,
  // restore both the old note state and any source balances changed above.
  try {
    await StorageService.saveNote(noteObj);
  } catch (saveErr) {
    if (finance?.type === 'expense') {
      try { FeaturePackService.applySavingsDelta(finance.funding || [], 1); } catch (rollbackErr) { console.warn('Rollback sumber dana baru gagal:', rollbackErr); }
      if (previousNote?.finance?.type === 'expense') {
        try { FeaturePackService.applySavingsDelta(previousNote.finance.funding || [{ id:'net', amount:Number(previousNote.finance.amount)||0 }], -1); } catch (rollbackErr) { console.warn('Rollback sumber dana lama gagal:', rollbackErr); }
      }
    } else if (previousNote?.finance?.type === 'expense' && !finance?.type) {
      try { FeaturePackService.applySavingsDelta(previousNote.finance.funding || [{ id:'net', amount:Number(previousNote.finance.amount)||0 }], -1); } catch (rollbackErr) { console.warn('Rollback pengembalian sumber dana gagal:', rollbackErr); }
    }
    const idx = currentNoteId ? notes.findIndex(n => n.id === currentNoteId) : -1;
    if (idx >= 0 && previousNote) notes[idx] = previousNote;
    UIService.showToast('Catatan gagal disimpan. Perubahan saldo dibatalkan.', 'danger');
    return;
  }
  await UIService.updateStorageMeter();

  renderCategoryChips();
  renderNotesList();
  closeNoteEditor();
  UIService.showToast('Catatan berhasil disimpan.', 'info');
  document.dispatchEvent(new Event('cp104:refresh'));
}

/* ==========================================================================
   ATTACHMENTS & PREVIEWS
   ========================================================================== */

function renderAttachmentsList() {
  if (!el.attachList) return;
  el.attachList.innerHTML = '';

  currentAttachments.forEach((att, idx) => {
    const item = document.createElement('div');
    item.className = 'attach-item';

    const left = document.createElement('div');
    left.className = 'attach-item-left';

    const icon = document.createElement('span');
    icon.className = 'attach-item-icon';
    const kind = AttachmentService.classifyAttachment(att);
    icon.textContent = kind === 'image' ? '🖼️' : kind === 'pdf' ? '📄' : kind === 'audio' ? '🎙️' : kind === 'doc' ? '📑' : '📎';
    left.appendChild(icon);

    const name = document.createElement('span');
    name.className = 'attach-item-name';
    name.textContent = att.name;
    left.appendChild(name);

    const size = document.createElement('span');
    size.className = 'attach-item-size';
    size.textContent = AttachmentService.formatSize(att.size);
    left.appendChild(size);

    item.appendChild(left);

    const right = document.createElement('div');
    right.className = 'attach-item-actions';

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.innerHTML = '👁️';
    viewBtn.title = 'Pratinjau Berkas';
    viewBtn.onclick = () => previewAttachment(att);
    right.appendChild(viewBtn);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Edit Berkas';
    editBtn.onclick = () => editAttachment(att);
    const editKind = AttachmentService.classifyAttachment(att);
    if (!['image','text','doc'].includes(editKind)) editBtn.style.display = 'none';
    right.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Hapus Lampiran';
    delBtn.onclick = () => {
      const removed = currentAttachments[idx];
      if (!removed) return;
      currentAttachments.splice(idx, 1);
      removeInlineAttachmentChips(removed.id);
      renderAttachmentsList();
      el.noteBody.dispatchEvent(new Event('input', { bubbles: true }));
      UIService.showToast(`Lampiran "${removed.name || 'berkas'}" dihapus dari catatan.`, 'info');
    };
    right.appendChild(delBtn);

    item.appendChild(right);
    el.attachList.appendChild(item);
  });
}

async function fileToAttachment(file) {
  if (!file) throw new Error('Berkas tidak valid.');
  if (file.size > 25 * 1024 * 1024) throw new Error('Ukuran berkas melebihi batas 25MB.');

  let dataURL = null;
  let finalSize = file.size;
  let finalMime = file.type || 'application/octet-stream';
  let finalExt = AttachmentService.fileExt(file.name);

  if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
    try {
      const comp = await AttachmentService.compressImage(file);
      dataURL = comp.dataURL;
      finalSize = comp.size;
      finalMime = comp.mime;
      finalExt = comp.ext;
    } catch (e) {
      dataURL = await AttachmentService.blobToDataURL(file);
    }
  } else {
    dataURL = await AttachmentService.blobToDataURL(file);
  }

  let safeName = SecurityService.sanitizeFileName(file.name);
  const originalExt = AttachmentService.fileExt(safeName);
  if (finalExt && originalExt && finalExt !== originalExt && finalMime.startsWith('image/')) {
    safeName = safeName.replace(/\.[^.]+$/, `.${finalExt}`);
  }

  return {
    id: 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: safeName,
    mime: finalMime,
    ext: finalExt,
    size: finalSize,
    dataURL,
    kind: AttachmentService.classifyAttachment({ mime: finalMime, ext: finalExt }),
    createdAt: Date.now()
  };
}

function inlineIconForAttachment(att) {
  const kind = AttachmentService.classifyAttachment(att);
  return kind === 'image' ? '🖼️' : kind === 'pdf' ? '📄' : kind === 'doc' ? '📑' : kind === 'audio' ? '🎙️' : kind === 'video' ? '🎬' : '📎';
}

function removeInlineAttachmentChips(attachmentId) {
  if (!el.noteBody || !attachmentId) return 0;
  let removed = 0;
  el.noteBody.querySelectorAll('.cp104-inline-note').forEach((chip) => {
    if (chip.getAttribute('data-att-id') !== String(attachmentId)) return;
    const next = chip.nextSibling;
    chip.remove();
    if (next && next.nodeType === Node.TEXT_NODE && /^[\u00a0\u200b\s]*$/.test(next.nodeValue || '')) next.remove();
    removed++;
  });
  return removed;
}

function removeOrphanInlineAttachmentChips() {
  if (!el.noteBody) return 0;
  const valid = new Set(currentAttachments.map((a) => String(a.id)));
  let removed = 0;
  el.noteBody.querySelectorAll('.cp104-inline-note').forEach((chip) => {
    if (!valid.has(String(chip.getAttribute('data-att-id') || ''))) {
      chip.remove();
      removed++;
    }
  });
  return removed;
}

function insertInlineAttachment(att, markerId = null) {
  if (!att?.id) return false;
  const icon = inlineIconForAttachment(att);
  const label = SecurityService.escapeHtml(att.name || 'Berkas');
  const html = `<span class="cp104-inline-note" contenteditable="false" data-att-id="${SecurityService.escapeHtml(att.id)}" title="Ketuk untuk melihat berkas">${icon} ${label} <small>lihat</small></span>&nbsp;`;
  if (markerId && EditorService.insertHtmlAtMarker(el.noteBody, markerId, html)) return true;
  EditorService.restoreSelection(el.noteBody);
  EditorService.insertHtmlAtCursor(el.noteBody, html);
  return true;
}

async function handleInlineFilesUpload(fileList, markerId = null) {
  if (!fileList || fileList.length === 0) {
    if (markerId) EditorService.removeInsertionMarker(el.noteBody, markerId);
    return;
  }
  let inserted = 0;
  let activeMarker = markerId;
  for (let i = 0; i < fileList.length; i++) {
    try {
      const att = await fileToAttachment(fileList[i]);
      const ok = insertInlineAttachment(att, activeMarker);
      if (!ok) throw new Error('Posisi penyisipan tidak ditemukan.');
      currentAttachments.push(att);
      inserted++;
      // The insertion function leaves the caret after the chip; create a new
      // bookmark there so the next selected file remains in sequence.
      activeMarker = EditorService.createInsertionMarker(el.noteBody);
    } catch (err) {
      UIService.showToast(`Gagal menyisipkan berkas "${fileList[i]?.name || 'file'}": ${err.message}`, 'danger');
    }
  }
  if (activeMarker) EditorService.removeInsertionMarker(el.noteBody, activeMarker);
  renderAttachmentsList();
  if (inserted) UIService.showToast(`${inserted} berkas disisipkan ke dalam teks catatan.`, 'info');
}

async function handleFilesUpload(fileList) {
  if (!fileList || fileList.length === 0) return;
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    try {
      const att = await fileToAttachment(file);
      currentAttachments.push(att);
    } catch (err) {
      UIService.showToast(`Gagal memproses berkas "${file?.name || 'file'}": ${err.message}`, 'danger');
    }
  }

  renderAttachmentsList();
  try {
    const storageInfo = await StorageService.getStorageUsage();
    await UIService.updateStorageMeter();
    if (storageInfo.percentage >= 85) {
      UIService.showToast(`Peringatan: Kapasitas penyimpanan telah terpakai ${storageInfo.percentage}%. Disarankan mengekspor cadangan secara berkala.`, 'danger');
    }
  } catch (e) {
    console.warn('Storage check warning:', e);
  }
}


async function unzipEntries(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (o) => view.getUint32(o, true);
  const u16 = (o) => view.getUint16(o, true);
  let eocd = -1;
  const start = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= start; i--) {
    if (u32(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Format ZIP/Office Open XML tidak valid.');

  const count = u16(eocd + 10);
  const centralOffset = u32(eocd + 16);
  const entries = new Map();
  let pos = centralOffset;

  for (let i = 0; i < count; i++) {
    if (u32(pos) !== 0x02014b50) throw new Error('Struktur ZIP tidak valid.');
    const method = u16(pos + 10);
    const compressedSize = u32(pos + 20);
    const nameLen = u16(pos + 28);
    const extraLen = u16(pos + 30);
    const commentLen = u16(pos + 32);
    const localOffset = u32(pos + 42);
    const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLen));
    entries.set(name, { method, compressedSize, localOffset });
    pos += 46 + nameLen + extraLen + commentLen;
  }

  const read = async (name) => {
    const entry = entries.get(name);
    if (!entry) return null;
    const local = entry.localOffset;
    if (u32(local) !== 0x04034b50) throw new Error('Header berkas ZIP tidak valid.');
    const nameLen = u16(local + 26);
    const extraLen = u16(local + 28);
    const dataStart = local + 30 + nameLen + extraLen;
    const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method !== 8 || typeof DecompressionStream === 'undefined') {
      throw new Error('Perangkat ini tidak mendukung pembacaan kompresi Office secara langsung.');
    }
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
  return { names: [...entries.keys()], read };
}

function xmlDocument(bytes) {
  return new DOMParser().parseFromString(new TextDecoder('utf-8').decode(bytes), 'application/xml');
}
function xmlText(node) {
  return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
}

async function previewOfficeOpenXml(fullAtt, kind) {
  const buffer = await AttachmentService.dataURLToArrayBuffer(fullAtt.dataURL);
  const zip = await unzipEntries(buffer);

  if (kind === 'docx') {
    const xml = await zip.read('word/document.xml');
    if (!xml) throw new Error('Isi dokumen Word tidak ditemukan.');
    const doc = xmlDocument(xml);
    const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const runsToHtml = (parent) => [...parent.children].map((runNode) => {
      if (runNode.localName !== 'r') return '';
      const textNodes = [...runNode.getElementsByTagNameNS(ns, 't')];
      const text = textNodes.map(n => String(n.textContent || '')).join('');
      if (!text && !runNode.getElementsByTagNameNS(ns, 'br').length) return '';
      const rPr = runNode.getElementsByTagNameNS(ns, 'rPr')[0];
      const bold = !!rPr?.getElementsByTagNameNS(ns, 'b').length;
      const italic = !!rPr?.getElementsByTagNameNS(ns, 'i').length;
      const underline = !!rPr?.getElementsByTagNameNS(ns, 'u').length;
      const strike = !!rPr?.getElementsByTagNameNS(ns, 'strike').length;
      let html = SecurityService.escapeHtml(text);
      if (runNode.getElementsByTagNameNS(ns, 'br').length) html += '<br>';
      if (bold) html = `<strong>${html}</strong>`;
      if (italic) html = `<em>${html}</em>`;
      if (underline) html = `<u>${html}</u>`;
      if (strike) html = `<s>${html}</s>`;
      return html;
    }).join('');
    const paragraphHtml = (pNode) => {
      const pPr = pNode.getElementsByTagNameNS(ns, 'pPr')[0];
      const styleNode = pPr?.getElementsByTagNameNS(ns, 'pStyle')[0];
      const style = String(styleNode?.getAttributeNS(ns, 'val') || '').toLowerCase();
      const headingMatch = style.match(/heading([1-6])/);
      const alignNode = pPr?.getElementsByTagNameNS(ns, 'jc')[0];
      const align = String(alignNode?.getAttributeNS(ns, 'val') || '').toLowerCase();
      const alignStyle = ['center','right','left','both','justify'].includes(align) ? ` style="text-align:${align==='both'?'justify':align}"` : '';
      const content = runsToHtml(pNode) || '<br>';
      return headingMatch ? `<h${headingMatch[1]}${alignStyle}>${content}</h${headingMatch[1]}>` : `<p${alignStyle}>${content}</p>`;
    };
    const renderTable = (tbl) => {
      const rows = [...tbl.children].filter(n => n.localName === 'tr').map(tr => `<tr>${[...tr.children].filter(n => n.localName === 'tc').map(tc => `<td>${[...tc.children].filter(n => n.localName === 'p').map(paragraphHtml).join('') || '<br>'}</td>`).join('')}</tr>`).join('');
      return `<table><tbody>${rows}</tbody></table>`;
    };
    const body = doc.getElementsByTagNameNS(ns, 'body')[0];
    const blocks = body ? [...body.children].filter(n => ['p','tbl'].includes(n.localName)).map(n => n.localName === 'tbl' ? renderTable(n) : paragraphHtml(n)).join('') : '';
    return `<div class="viewer-doc"><div class="viewer-doc-paper">${blocks || '<p>Dokumen tidak memiliki teks yang dapat ditampilkan.</p>'}</div></div>`;
  }

  if (kind === 'pptx') {
    const slideNames = zip.names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n)).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!slideNames.length) throw new Error('Slide PowerPoint tidak ditemukan.');
    const slides = [];
    for (let i = 0; i < slideNames.length; i++) {
      const xml = await zip.read(slideNames[i]);
      const doc = xmlDocument(xml);
      const texts = [...doc.getElementsByTagNameNS('*', 't')].map(xmlText).filter(Boolean);
      slides.push(`<section class="viewer-slide"><h4>Slide ${i + 1}</h4>${texts.map((t) => `<p>${SecurityService.escapeHtml(t)}</p>`).join('')}</section>`);
    }
    return `<div class="viewer-doc"><h3>Pratinjau PowerPoint</h3>${slides.join('')}</div>`;
  }

  // XLSX: tampilkan sheet pertama sebagai tabel tanpa membutuhkan SheetJS.
  const sharedXml = await zip.read('xl/sharedStrings.xml');
  const shared = [];
  if (sharedXml) {
    const doc = xmlDocument(sharedXml);
    for (const si of [...doc.getElementsByTagNameNS('*', 'si')]) {
      shared.push([...si.getElementsByTagNameNS('*', 't')].map(xmlText).join(''));
    }
  }
  const sheetName = zip.names.find((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n));
  if (!sheetName) throw new Error('Lembar Excel tidak ditemukan.');
  const sheetXml = await zip.read(sheetName);
  const sheet = xmlDocument(sheetXml);
  const columnIndex = (ref) => {
    const letters = String(ref || '').replace(/\d+$/, '').toUpperCase();
    let n = 0;
    for (const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
    return Math.max(0, n - 1);
  };
  const rows = [];
  for (const row of [...sheet.getElementsByTagNameNS('*', 'row')]) {
    const cells = [];
    for (const cell of [...row.getElementsByTagNameNS('*', 'c')]) {
      const type = cell.getAttribute('t') || '';
      const valueNode = cell.getElementsByTagNameNS('*', 'v')[0];
      let value = valueNode ? xmlText(valueNode) : '';
      if (type === 's') value = shared[Number(value)] ?? value;
      if (type === 'inlineStr') value = [...cell.getElementsByTagNameNS('*', 't')].map(xmlText).join('');
      cells[columnIndex(cell.getAttribute('r'))] = value;
    }
    if (cells.some((value) => value !== undefined && value !== '')) rows.push(cells);
  }
  const colCount = Math.max(1, ...rows.map((r) => r.length));
  const html = rows.slice(0, 300).map((row, r) => `<tr>${Array.from({length: colCount}, (_, i) => `<${r===0?'th':'td'}>${SecurityService.escapeHtml(row[i] ?? '')}</${r===0?'th':'td'}>`).join('')}</tr>`).join('');
  return `<div class="viewer-table"><h3>Pratinjau Excel</h3><div class="viewer-table-scroll"><table><tbody>${html || '<tr><td>Tidak ada data yang dapat ditampilkan.</td></tr>'}</tbody></table></div><p class="viewer-note">Pratinjau menampilkan maksimal 300 baris dari lembar pertama.</p></div>`;
}

function replaceAttachmentInCurrentNote(updatedAttachment, originalId) {
  const idx = currentAttachments.findIndex(a => a.id === originalId);
  if (idx < 0) return false;
  currentAttachments[idx] = { ...currentAttachments[idx], ...updatedAttachment, id: originalId, updatedAt: Date.now() };
  renderAttachmentsList();
  return true;
}

async function persistAttachmentEditToCurrentNote() {
  if (!currentNoteId) return false;
  const existing = notes.find(n => n.id === currentNoteId);
  if (!existing) return false;
  const updated = {
    ...existing,
    title: el.noteTitle.value.trim() || existing.title || 'Tanpa Judul',
    bodyHTML: SecurityService.sanitizeHTML(el.noteBody.innerHTML),
    attachments: currentAttachments.map(a => ({ ...a })),
    updatedAt: Date.now()
  };
  const idx = notes.findIndex(n => n.id === currentNoteId);
  if (idx >= 0) notes[idx] = updated;
  await StorageService.saveNote(updated);
  currentAttachments = (updated.attachments || []).map(a => ({ ...a }));
  renderAttachmentsList();
  renderNotesList();
  await UIService.updateStorageMeter();
  document.dispatchEvent(new Event('cp104:refresh'));
  return true;
}

function ensureEditModal() {
  let modal = document.getElementById('cp104FileEditModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'cp104FileEditModal';
  modal.className = 'cp104-modal';
  modal.innerHTML = `<div class="cp104-dialog cp104-file-edit-dialog">
    <div class="cp104-head"><div class="cp104-title" id="cp104EditTitle">Edit Berkas</div><button type="button" class="cp104-btn" id="cp104EditClose">Tutup</button></div>
    <div id="cp104EditInfo" class="cp104-muted" style="margin-bottom:8px"></div>
    <div id="cp104EditArea"></div>
    <div class="cp104-actions" style="justify-content:flex-end;margin-top:10px"><button type="button" class="cp104-btn" id="cp104EditCancel">Batal</button><button type="button" class="cp104-btn primary" id="cp104EditSave">💾 Simpan Perubahan</button></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#cp104EditClose').onclick = modal.querySelector('#cp104EditCancel').onclick = () => modal.classList.remove('open');
  return modal;
}

function xmlEscapeText(value) {
  return SecurityService.escapeHtml(String(value ?? '')).replace(/&#39;/g, '&apos;');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeStoredZip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = enc.encode(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : enc.encode(String(entry.data));
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true);
    v.setUint16(8, 0, true); v.setUint16(10, 0, true); v.setUint16(12, 0, true); v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true); v.setUint32(22, data.length, true); v.setUint16(26, name.length, true); v.setUint16(28, 0, true);
    local.set(name, 30); chunks.push(local, data); offset += local.length + data.length;
    const c = new Uint8Array(46 + name.length); const cv = new DataView(c.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true); cv.setUint16(8,0x0800,true);
    cv.setUint16(10,0,true); cv.setUint16(12,0,true); cv.setUint16(14,0,true); cv.setUint32(16,crc,true);
    cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true); cv.setUint16(28,name.length,true); cv.setUint16(30,0,true); cv.setUint16(32,0,true); cv.setUint16(34,0,true); cv.setUint16(36,0,true); cv.setUint32(38,0,true); cv.setUint32(42,offset-(local.length+data.length),true);
    c.set(name,46); central.push(c);
  }
  const centralSize = central.reduce((n,x)=>n+x.length,0); const eocd = new Uint8Array(22); const ev=new DataView(eocd.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(8,entries.length,true); ev.setUint16(10,entries.length,true); ev.setUint32(12,centralSize,true); ev.setUint32(16,offset,true);
  chunks.push(...central,eocd); return new Blob(chunks,{type:'application/zip'});
}

function htmlToDocxXml(html) {
  const doc = new DOMParser().parseFromString(SecurityService.sanitizeHTML(html), 'text/html');
  const run = (node, props = {}) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ? `<w:r>${Object.keys(props).length ? `<w:rPr>${props.bold?'<w:b/>':''}${props.italic?'<w:i/>':''}${props.underline?'<w:u w:val="single"/>':''}</w:rPr>`:''}<w:t xml:space="preserve">${xmlEscapeText(node.nodeValue)}</w:t></w:r>` : '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const p = {...props}; const tag=node.tagName.toLowerCase();
    if(tag==='strong'||tag==='b')p.bold=true; if(tag==='em'||tag==='i')p.italic=true; if(tag==='u')p.underline=true;
    if(tag==='br') return '<w:r><w:br/></w:r>';
    return [...node.childNodes].map(ch=>run(ch,p)).join('');
  };
  const blocks=[];
  const walk = (node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag=node.tagName.toLowerCase();
    if(tag==='table'){
      const rows=[...node.querySelectorAll(':scope > tbody > tr, :scope > tr')];
      blocks.push(`<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${rows.map(tr=>`<w:tr>${[...tr.children].map(td=>`<w:tc><w:p>${run(td)}</w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`);
      return;
    }
    if(['p','div','li','blockquote','pre','h1','h2','h3','h4','h5','h6'].includes(tag)){
      const style = /^h([1-6])$/.test(tag) ? `<w:pPr><w:pStyle w:val="Heading${tag.slice(1)}"/></w:pPr>` : '';
      const content=run(node); if(content || tag!=='div') blocks.push(`<w:p>${style}${content||'<w:r><w:t></w:t></w:r>'}</w:p>`); return;
    }
    if(tag==='ul'||tag==='ol'){ [...node.children].forEach(li=>blocks.push(`<w:p><w:r><w:t>${tag==='ul'?'•':'1.'} </w:t></w:r>${run(li)}</w:p>`)); return; }
    [...node.children].forEach(walk);
  };
  [...doc.body.childNodes].forEach(n=>{ if(n.nodeType===Node.ELEMENT_NODE) walk(n); else if(n.textContent?.trim()) blocks.push(`<w:p>${run(n)}</w:p>`); });
  return blocks.join('') || '<w:p><w:r><w:t></w:t></w:r></w:p>';
}

function buildDocxFromHtml(html) {
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${htmlToDocxXml(html)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style></w:styles>`;
  const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const wrels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return makeStoredZip([{name:'[Content_Types].xml',data:types},{name:'_rels/.rels',data:rels},{name:'word/document.xml',data:documentXml},{name:'word/styles.xml',data:styles},{name:'word/_rels/document.xml.rels',data:wrels}]);
}

function buildXlsxFromTable(table) {
  const rows=[...table.querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>String(td.textContent||'')));
  const sheetRows=rows.map((row,r)=>`<row r="${r+1}">${row.map((value,c)=>{let n=c+1,s='';while(n){const rem=(n-1)%26;s=String.fromCharCode(65+rem)+s;n=Math.floor((n-1)/26);}return `<c r="${s}${r+1}" t="inlineStr"><is><t xml:space="preserve">${xmlEscapeText(value)}</t></is></c>`;}).join('')}</row>`).join('');
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
  const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const wrels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  return makeStoredZip([{name:'[Content_Types].xml',data:types},{name:'_rels/.rels',data:rels},{name:'xl/workbook.xml',data:workbook},{name:'xl/_rels/workbook.xml.rels',data:wrels},{name:'xl/worksheets/sheet1.xml',data:sheet}]);
}

async function editAttachment(att) {
  const kind=AttachmentService.classifyAttachment(att); if(!['image','text','doc'].includes(kind)) { UIService.showToast('Jenis berkas ini belum memiliki editor internal.', 'info'); return; }
  let full={...att}; if(!full.dataURL) full.dataURL=await StorageService.readMediaAttachment(full); if(!full.dataURL) { UIService.showToast('Data berkas tidak ditemukan.', 'danger'); return; }
  const modal=ensureEditModal(); const area=modal.querySelector('#cp104EditArea'); area.innerHTML=''; modal.querySelector('#cp104EditTitle').textContent=`Edit: ${att.name}`; modal.querySelector('#cp104EditInfo').textContent='Perubahan disimpan sebagai versi baru dari lampiran yang sama.';
  let saveFn=null;
  if(kind==='image'){
    modal.classList.remove('open');
    FeaturePackService.openImageEditor(full);
    return;
  } else if(kind==='text'){
    const ta=document.createElement('textarea'); ta.className='cp104-file-editor'; ta.value=AttachmentService.decodeBase64Text(full.dataURL); area.appendChild(ta); saveFn=()=>new Blob([ta.value],{type:full.mime||'text/plain'});
  } else if(['docx','doc'].includes((full.ext||'').toLowerCase())){
    const buffer=await AttachmentService.dataURLToArrayBuffer(full.dataURL); let html='';
    if(window.mammoth){ const result=await window.mammoth.convertToHtml({arrayBuffer:buffer}); html=SecurityService.sanitizeHTML(result.value); }
    else { const preview=SecurityService.sanitizeHTML(await previewOfficeOpenXml(full,'docx')); const holder=document.createElement('div'); holder.innerHTML=preview; html=holder.querySelector('.viewer-doc-paper')?.innerHTML || preview; }
    const div=document.createElement('div'); div.className='cp104-file-editor cp104-doc-editor'; div.contentEditable='true'; div.innerHTML=html; area.appendChild(div); saveFn=()=>buildDocxFromHtml(div.innerHTML);
  } else if(['xlsx','xls'].includes((full.ext||'').toLowerCase())){
    const html=await previewOfficeOpenXml(full,'xlsx'); const temp=document.createElement('div'); temp.innerHTML=SecurityService.sanitizeHTML(html); const table=temp.querySelector('table');
    if(!table) throw new Error('Tabel Excel tidak ditemukan.'); table.contentEditable='true'; table.classList.add('cp104-edit-table'); area.appendChild(table); saveFn=()=>buildXlsxFromTable(table);
  }
  modal.querySelector('#cp104EditSave').onclick=async()=>{ try{ const blob=saveFn?.(); if(!blob){modal.classList.remove('open'); return;} const dataURL=await AttachmentService.blobToDataURL(blob); const isSheet=['xlsx','xls'].includes((att.ext||'').toLowerCase()); const updated={...full,id:att.id,dataURL,mime:isSheet?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':full.mime,ext:isSheet?'xlsx':full.ext,name:isSheet&&att.ext==='xls'?String(att.name||'lembar').replace(/\.xls$/i,'.xlsx'):att.name,size:blob.size,filePath:null,fileUri:null,webviewSrc:null,createdAt:att.createdAt||Date.now()}; if(!replaceAttachmentInCurrentNote(updated,att.id)) throw new Error('Lampiran tidak lagi berada di catatan yang sedang diedit.'); if(currentNoteId){ await persistAttachmentEditToCurrentNote(); } modal.classList.remove('open'); UIService.showToast(currentNoteId ? 'Berkas berhasil diperbarui dan disimpan.' : 'Berkas diperbarui di editor. Simpan catatan untuk menyimpannya.', 'info'); }catch(e){UIService.showToast('Gagal menyimpan perubahan: '+e.message,'danger');} };
  modal.classList.add('open');
}

async function previewAttachment(att) {
  let fullAtt = { ...att };
  
  // If dataURL is missing, retrieve from Capacitor Filesystem or storage
  if (!fullAtt.dataURL) {
    if (fullAtt.filePath || fullAtt.fileUri) {
      fullAtt.dataURL = await StorageService.readMediaAttachment(fullAtt);
    }
    if (!fullAtt.dataURL && fullAtt.id) {
      const stored = await StorageService.getAttachment(fullAtt.id);
      if (stored) {
        fullAtt = { ...fullAtt, ...stored };
      }
    }
  }

  const mediaSrc = fullAtt.webviewSrc || fullAtt.dataURL;

  if (!mediaSrc && !fullAtt.dataURL) {
    UIService.showToast('Berkas lampiran tidak ditemukan atau data belum termuat.', 'danger');
    return;
  }

  el.viewerFileName.textContent = fullAtt.name;
  el.viewerFileMeta.textContent = `${fullAtt.mime || 'Berkas'} · ${AttachmentService.formatSize(fullAtt.size)}`;
  el.viewerBody.innerHTML = '';

  const kind = AttachmentService.classifyAttachment(fullAtt);
  if (el.editViewerBtn) {
    const editable = ['image','text','doc'].includes(kind);
    el.editViewerBtn.style.display = editable ? 'inline-block' : 'none';
    el.editViewerBtn.onclick = () => editAttachment(fullAtt);
  }

  // Setup download button
  el.downloadViewerBtn.onclick = async () => {
    try {
      let dataUrlToSave = fullAtt.dataURL;
      if (!dataUrlToSave) {
        dataUrlToSave = await StorageService.readMediaAttachment(fullAtt);
      }
      if (!dataUrlToSave) {
        throw new Error('Data berkas belum siap diunduh.');
      }
      const blob = await AttachmentService.dataURLToBlob(dataUrlToSave);
      AttachmentService.downloadBlob(blob, fullAtt.name);
    } catch (e) {
      UIService.showToast('Gagal mengunduh: ' + e.message, 'danger');
    }
  };

  try {
    if (kind === 'image') {
      const img = document.createElement('img');
      img.src = mediaSrc || fullAtt.dataURL;
      img.className = 'viewer-img';
      el.viewerBody.appendChild(img);
    } else if (kind === 'audio') {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = mediaSrc || fullAtt.dataURL;
      audio.className = 'w-full my-6';
      el.viewerBody.appendChild(audio);
    } else if (kind === 'pdf') {
      const pdfPlugin = PdfViewer;
      if (window.Capacitor?.isNativePlatform?.() && pdfPlugin?.render) {
        const base64 = String(fullAtt.dataURL).split(',')[1] || '';
        const result = await pdfPlugin.render({ base64 });
        const pages = Array.isArray(result?.pages) ? result.pages : [];
        if (!pages.length) throw new Error('PDF tidak memiliki halaman yang dapat ditampilkan.');
        const wrap = document.createElement('div');
        wrap.className = 'viewer-pdf-pages';
        pages.forEach((src, index) => {
          const page = document.createElement('div');
          page.className = 'viewer-pdf-page';
          page.innerHTML = `<div class="viewer-pdf-label">Halaman ${index + 1}${result.totalPages > result.shownPages && index === pages.length - 1 ? ` dari ${result.totalPages} (maksimal ${result.shownPages} halaman ditampilkan)` : ''}</div>`;
          const img = document.createElement('img');
          img.src = src;
          img.alt = `Halaman ${index + 1}`;
          page.appendChild(img);
          wrap.appendChild(page);
        });
        el.viewerBody.appendChild(wrap);
      } else if (window.pdfjsLib?.getDocument) {
        // Web/GitHub Pages path: PDF.js gives a consistent in-app preview.
        const pdfjs = window.pdfjsLib;
        pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const bytes = new Uint8Array(await AttachmentService.dataURLToArrayBuffer(fullAtt.dataURL));
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        const wrap = document.createElement('div');
        wrap.className = 'viewer-pdf-pages';
        const maxPages = Math.min(pdf.numPages, 20);
        for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
          const pdfPage = await pdf.getPage(pageNo);
          const baseViewport = pdfPage.getViewport({ scale: 1 });
          const scale = Math.min(1.6, 1100 / Math.max(1, baseViewport.width));
          const viewport = pdfPage.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.className = 'viewer-pdf-canvas';
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          const page = document.createElement('div');
          page.className = 'viewer-pdf-page';
          page.innerHTML = `<div class="viewer-pdf-label">Halaman ${pageNo}${pdf.numPages > maxPages && pageNo === maxPages ? ` dari ${pdf.numPages} (maksimal ${maxPages} halaman ditampilkan)` : ''}</div>`;
          page.appendChild(canvas);
          wrap.appendChild(page);
          await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
        el.viewerBody.appendChild(wrap);
      } else {
        const blob = await AttachmentService.dataURLToBlob(fullAtt.dataURL);
        const blobUrl = AttachmentService.createManagedBlobUrl(blob);
        const frame = document.createElement('iframe');
        frame.src = blobUrl;
        frame.title = fullAtt.name || 'PDF';
        frame.className = 'viewer-frame';
        frame.setAttribute('allow', 'fullscreen');
        el.viewerBody.appendChild(frame);
      }
    } else if (kind === 'text') {
      const text = AttachmentService.decodeBase64Text(fullAtt.dataURL);
      const pre = document.createElement('pre');
      pre.className = 'viewer-pre';
      pre.textContent = text;
      el.viewerBody.appendChild(pre);
    } else if (kind === 'doc' && window.mammoth && (fullAtt.ext === 'docx' || fullAtt.ext === 'doc')) {
      const buffer = await AttachmentService.dataURLToArrayBuffer(fullAtt.dataURL);
      const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
      const docDiv = document.createElement('div');
      docDiv.className = 'viewer-doc';
      docDiv.innerHTML = SecurityService.sanitizeHTML(result.value);
      el.viewerBody.appendChild(docDiv);
    } else if (kind === 'doc' && window.XLSX && (fullAtt.ext === 'xlsx' || fullAtt.ext === 'xls')) {
      const buffer = await AttachmentService.dataURLToArrayBuffer(fullAtt.dataURL);
      const workbook = window.XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const htmlTable = window.XLSX.utils.sheet_to_html(sheet);
      const tableDiv = document.createElement('div');
      tableDiv.className = 'viewer-table';
      tableDiv.innerHTML = SecurityService.sanitizeHTML(htmlTable);
      el.viewerBody.appendChild(tableDiv);
    } else if (kind === 'doc' && ['docx','xlsx','xls','pptx'].includes((fullAtt.ext || '').toLowerCase())) {
      const ext = (fullAtt.ext || '').toLowerCase();
      const html = await previewOfficeOpenXml(fullAtt, ext);
      el.viewerBody.innerHTML = SecurityService.sanitizeHTML(html);
    } else {
      el.viewerBody.innerHTML = `
        <div class="text-center py-12 text-[var(--ink-soft)]">
          <p class="text-3xl mb-2">📁</p>
          <p class="text-sm">Pratinjau langsung tidak tersedia untuk jenis berkas ini.</p>
          <p class="text-xs mt-1">Silakan klik tombol "Unduh" di atas untuk membuka berkas dengan aplikasi di perangkat Anda.</p>
        </div>
      `;
    }
  } catch (err) {
    el.viewerBody.innerHTML = `
      <div class="text-center py-8 text-[var(--danger)]">
        <p>Gagal menampilkan pratinjau: ${SecurityService.escapeHtml(err.message)}</p>
      </div>
    `;
  }

  el.viewerOverlay.classList.add('open');
}

/* ==========================================================================
   SKETCH CANVAS WORKFLOW
   ========================================================================== */

function openSketchModal() {
  el.sketchOverlay.classList.add('open');
  setTimeout(() => {
    SketchService.resizeCanvas(el.sketchStage);
  }, 50);
}

function closeSketchModal() {
  el.sketchOverlay.classList.remove('open');
}

/* ==========================================================================
   VOICE RECORDING CONTROLS
   ========================================================================== */

function resetVoiceRecordingUI() {
  if (recTimerInterval) {
    clearInterval(recTimerInterval);
    recTimerInterval = null;
  }
  recSeconds = 0;
  if (el.recIndicator) el.recIndicator.style.display = 'none';
  if (el.recTimer) el.recTimer.textContent = '00:00';
  if (el.voiceRecordBtn) el.voiceRecordBtn.textContent = '🎙️ Mulai Rekam';
  if (el.voiceStatus) el.voiceStatus.textContent = '';
}

function toggleVoiceRecording() {
  const mode = document.querySelector('input[name="voiceMode"]:checked').value;

  if (mode === 'audio') {
    if (AudioVoiceService.isRecordingAudio) {
      AudioVoiceService.stopAudioRecording();
      resetVoiceRecordingUI();
    } else {
      AudioVoiceService.startAudioRecording({
        onStart: () => {
          el.voiceRecordBtn.textContent = '⏹️ Hentikan Rekam';
          el.recIndicator.style.display = 'inline-flex';
          recSeconds = 0;
          recTimerInterval = setInterval(() => {
            recSeconds++;
            const m = String(Math.floor(recSeconds / 60)).padStart(2, '0');
            const s = String(recSeconds % 60).padStart(2, '0');
            el.recTimer.textContent = `${m}:${s}`;
          }, 1000);
          el.voiceStatus.textContent = 'Sedang merekam suara…';
        },
        onSuccess: (rec) => {
          const att = {
            id: 'voice_' + Date.now().toString(36),
            name: `rekaman_${new Date().toISOString().slice(0, 10)}.webm`,
            mime: rec.mime,
            ext: rec.ext,
            size: rec.size,
            dataURL: rec.dataURL,
            kind: 'voice-audio',
            createdAt: Date.now()
          };
          currentAttachments.push(att);
          renderAttachmentsList();
          UIService.showToast('Rekaman suara berhasil disimpan sebagai lampiran.', 'info');
        },
        onError: (err) => {
          resetVoiceRecordingUI();
          UIService.showToast(err, 'danger');
        }
      });
    }
  } else {
    // Speech-to-text mode
    if (AudioVoiceService.isRecordingSpeech) {
      AudioVoiceService.stopSpeechRecognition();
      resetVoiceRecordingUI();
    } else {
      AudioVoiceService.startSpeechRecognition({
        onStart: () => {
          el.voiceRecordBtn.textContent = '⏹️ Hentikan Dikte';
          el.recIndicator.style.display = 'inline-flex';
          el.voiceStatus.textContent = 'Mendengarkan suara Anda (Bahasa Indonesia)…';
        },
        onResult: ({ final, interim }) => {
          el.voiceStatus.textContent = interim ? `Mendengar: "${interim}"` : 'Mendengarkan…';
          if (final) {
            EditorService.insertTextAtCursor(el.noteBody, final + ' ');
          }
        },
        onError: (err) => {
          resetVoiceRecordingUI();
          UIService.showToast(err, 'danger');
        },
        onEnd: () => {
          resetVoiceRecordingUI();
        }
      });
    }
  }
}

/* ==========================================================================
   FINANCE MODAL & CHARTS
   ========================================================================== */

function openFinanceModal() {
  updateFinanceView();
  el.financeOverlay.classList.add('open');
}

function updateFinanceView() {
  try {
    const from = el.financeFrom ? el.financeFrom.value : null;
    const to = el.financeTo ? el.financeTo.value : null;
    const totals = FinanceService.calculateTotals(notes || [], from, to) || {
      income: 0,
      expense: 0,
      debtUnpaid: 0,
      debtPaid: 0,
      balance: 0,
      transactions: []
    };

    // Summary header metrics
    if (el.financeSummary) {
      el.financeSummary.innerHTML = `
        <div class="fin-card">
          <span class="fin-card-label">Pemasukan</span>
          <span class="fin-card-val val-inc">${FinanceService.formatRupiah(totals.income || 0)}</span>
        </div>
        <div class="fin-card">
          <span class="fin-card-label">Pengeluaran</span>
          <span class="fin-card-val val-exp">${FinanceService.formatRupiah(totals.expense || 0)}</span>
        </div>
        <div class="fin-card">
          <span class="fin-card-label">Saldo Bersih</span>
          <span class="fin-card-val ${(totals.balance || 0) >= 0 ? 'val-bal-pos' : 'val-bal-neg'}">${FinanceService.formatRupiah(totals.balance || 0)}</span>
        </div>
        <div class="fin-card">
          <span class="fin-card-label">Hutang Aktif</span>
          <span class="fin-card-val val-debt">${FinanceService.formatRupiah(totals.debtUnpaid || 0)}</span>
        </div>
      `;
    }

    // Pure SVG Charts Rendering
    if (el.donutChartContainer) {
      FinanceService.renderDonutChart(el.donutChartContainer, totals);
    }
    if (el.barChartContainer) {
      FinanceService.renderBarChart(el.barChartContainer, totals);
    }

    // Transaction list
    if (el.financeTxList) {
      el.financeTxList.innerHTML = '';
      const txs = Array.isArray(totals.transactions) ? totals.transactions : [];
      if (txs.length === 0) {
        el.financeTxList.innerHTML = '<div class="text-xs text-[var(--ink-soft)] text-center py-4">Tidak ada riwayat transaksi.</div>';
      } else {
        txs.slice(0, 25).forEach(tx => {
          const item = document.createElement('div');
          item.className = 'finance-tx-item';
          const typeClass = tx.type === 'income' ? 'tx-income' : tx.type === 'debt' ? 'tx-debt' : 'tx-expense';
          const sign = tx.type === 'income' ? '+' : '-';
          item.innerHTML = `
            <div>
              <div style="font-weight:600; color:var(--ink);">${SecurityService.escapeHtml(tx.title || 'Transaksi')}</div>
              <div style="font-size:11px; color:var(--ink-soft);">${new Date(tx.date || Date.now()).toLocaleDateString('id-ID')}</div>
            </div>
            <div class="finance-tx-amount ${typeClass}">${sign}${FinanceService.formatRupiah(tx.amount || 0)}</div>
          `;
          item.onclick = () => {
            if (el.financeOverlay) el.financeOverlay.classList.remove('open');
            const n = notes.find(x => x.id === tx.noteId);
            if (n) openNoteEditor(n);
          };
          el.financeTxList.appendChild(item);
        });
      }
    }

    // Unpaid and Paid Debts Table
    const txList = Array.isArray(totals.transactions) ? totals.transactions : [];
    const unpaidDebts = txList.filter(t => t.type === 'debt' && !t.debtPaid);
    const paidDebts = txList.filter(t => t.type === 'debt' && t.debtPaid);

    if (el.debtUnpaidCount) el.debtUnpaidCount.textContent = unpaidDebts.length;
    if (el.debtPaidCount) el.debtPaidCount.textContent = paidDebts.length;

    renderDebtTable(el.debtUnpaidList, unpaidDebts, false);
    renderDebtTable(el.debtPaidList, paidDebts, true);
  } catch (err) {
    console.error('Error updating finance view:', err);
  }
}

function renderDebtTable(container, debts, isPaid) {
  if (!container) return;
  container.innerHTML = '';
  if (debts.length === 0) {
    container.innerHTML = `<div class="text-xs text-[var(--ink-soft)] p-3 text-center">Tidak ada hutang ${isPaid ? 'sudah lunas' : 'belum lunas'}.</div>`;
    return;
  }

  const table = document.createElement('table');
  table.className = 'debt-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Catatan</th>
        <th>Kepada</th>
        <th>Jumlah</th>
        <th>Aksi</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  debts.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><b>${SecurityService.escapeHtml(d.title)}</b></td>
      <td>${SecurityService.escapeHtml(d.debtTo || '-')}</td>
      <td style="font-family:'IBM Plex Mono', monospace; font-weight:600;">${FinanceService.formatRupiah(d.amount)}</td>
      <td>
        <button type="button" class="btn-subtle" style="padding:2px 6px; font-size:11px;">
          ${isPaid ? 'Batal Lunas' : 'Lunasi'}
        </button>
      </td>
    `;
    const btn = tr.querySelector('button');
    btn.onclick = async () => {
      const note = notes.find(n => n.id === d.noteId);
      if (note && note.finance) {
        note.finance.debtPaid = !isPaid;
        note.updatedAt = Date.now();
        await StorageService.saveNote(note);
        updateFinanceView();
        renderNotesList();
        UIService.showToast(`Status hutang "${note.title}" diperbarui.`, 'info');
      }
    };
    tbody.appendChild(tr);
  });

  container.appendChild(table);
}

/* ==========================================================================
   EVENT LISTENERS & BINDINGS
   ========================================================================== */

function bindEventListeners() {
  // Add Note FAB
  el.fabAdd.onclick = () => openNoteEditor(null);

  // Close editor
  el.closeEditorBtn.onclick = closeNoteEditor;
  el.cancelBtn.onclick = closeNoteEditor;

  // Pin / Unpin button in editor header
  if (el.pinEditorBtn) {
    el.pinEditorBtn.onclick = () => {
      currentNoteIsPinned = !currentNoteIsPinned;
      updateEditorPinUI();
      UIService.showToast(currentNoteIsPinned ? 'Catatan akan disematkan ke atas.' : 'Sematan catatan dilepas.', 'info');
    };
  }

  // Save Note
  el.saveBtn.onclick = saveCurrentNote;

  // Delete Note confirmation
  el.deleteBtn.onclick = () => {
    if (!currentNoteId) return;
    pendingDeleteId = currentNoteId;
    el.confirmMsg.textContent = 'Hapus catatan ini? Tindakan ini tidak dapat dibatalkan.';
    el.confirmOverlay.classList.add('open');
  };

  el.confirmCancelBtn.onclick = () => {
    pendingDeleteId = null;
    el.confirmOverlay.classList.remove('open');
  };

  el.confirmOkBtn.onclick = async () => {
    if (pendingDeleteId) {
      const deletedNote = notes.find(n => n.id === pendingDeleteId);
      if (deletedNote?.finance?.type === 'expense') {
        try { FeaturePackService.applySavingsDelta(deletedNote.finance.funding || [{ id:'net', amount:Number(deletedNote.finance.amount)||0 }], 1); }
        catch (restoreErr) { UIService.showToast(restoreErr.message, 'danger'); return; }
        await FeaturePackService.recordFundingHistory('transaction', deletedNote.id, 'Hapus pengeluaran', deletedNote.finance.amount, deletedNote.finance.funding || [], { note: 'Saldo sumber dana internal dikembalikan.' });
      }
      if (deletedNote?.finance?.type === 'debt' && Array.isArray(deletedNote.finance.payments)) {
        for (const payment of deletedNote.finance.payments) { try { FeaturePackService.applySavingsDelta(payment.funding || [], 1); } catch (restoreErr) { UIService.showToast(restoreErr.message, 'danger'); return; } }
        await FeaturePackService.recordFundingHistory('transaction', deletedNote.id, 'Hapus hutang', deletedNote.finance.paidAmount || 0, deletedNote.finance.payments.flatMap(p=>p.funding||[]), { note: 'Saldo sumber dana pembayaran hutang dikembalikan.' });
      }
      await StorageService.deleteNote(pendingDeleteId);
      notes = notes.filter(n => n.id !== pendingDeleteId);
      pendingDeleteId = null;
      el.confirmOverlay.classList.remove('open');
      closeNoteEditor();
      renderCategoryChips();
      renderNotesList();
      await UIService.updateStorageMeter();
      UIService.showToast('Catatan berhasil dihapus.', 'info');
      document.dispatchEvent(new Event('cp104:refresh'));
    }
  };

  // Rich-text Toolbar commands
  el.toolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
    btn.onclick = () => {
      const cmd = btn.getAttribute('data-cmd');
      document.execCommand(cmd, false, null);
      el.noteBody.focus();
    };
  });

  el.fontSizeSelect.onchange = () => {
    document.execCommand('fontSize', false, el.fontSizeSelect.value);
    el.noteBody.focus();
  };

  el.fontFamilySelect.onchange = () => {
    document.execCommand('fontName', false, el.fontFamilySelect.value);
    el.noteBody.focus();
  };

  el.insertTableBtn.onclick = () => {
    const tableHTML = `
      <table border="1" style="border-collapse:collapse; width:100%; margin:8px 0;">
        <tr><th style="padding:6px; background:#f4efe2;">Kolom 1</th><th style="padding:6px; background:#f4efe2;">Kolom 2</th></tr>
        <tr><td style="padding:6px;">Data 1</td><td style="padding:6px;">Data 2</td></tr>
      </table><p><br></p>
    `;
    EditorService.insertHtmlAtCursor(el.noteBody, tableHTML);
  };

  // Canvas Sketch button
  el.openSketchBtn.onclick = openSketchModal;
  el.closeSketchBtn.onclick = closeSketchModal;
  el.cancelSketchBtn.onclick = closeSketchModal;

  el.insertSketchBtn.onclick = () => {
    const sketchAtt = SketchService.exportToAttachment();
    currentAttachments.push(sketchAtt);
    renderAttachmentsList();
    closeSketchModal();
    UIService.showToast('Sketsa berhasil disisipkan ke lampiran.', 'info');
  };

  // Sketch toolbar tools
  el.sketchToolPen.onclick = () => {
    SketchService.setTool('pen');
    el.sketchToolPen.classList.add('active');
    el.sketchToolBrush.classList.remove('active');
    el.sketchToolEraser.classList.remove('active');
  };

  el.sketchToolBrush.onclick = () => {
    SketchService.setTool('brush');
    el.sketchToolBrush.classList.add('active');
    el.sketchToolPen.classList.remove('active');
    el.sketchToolEraser.classList.remove('active');
  };

  el.sketchToolEraser.onclick = () => {
    SketchService.setTool('eraser');
    el.sketchToolEraser.classList.add('active');
    el.sketchToolPen.classList.remove('active');
    el.sketchToolBrush.classList.remove('active');
  };

  el.sketchSize.oninput = () => {
    const val = el.sketchSize.value;
    el.sketchSizeVal.textContent = val + 'px';
    SketchService.setSize(val);
  };

  el.sketchPalette.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.onclick = () => {
      el.sketchPalette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const c = swatch.getAttribute('data-color');
      SketchService.setColor(c);
      el.sketchCustomColor.value = c;
    };
  });

  el.sketchCustomColor.onchange = () => {
    el.sketchPalette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    SketchService.setColor(el.sketchCustomColor.value);
  };

  el.sketchUndoBtn.onclick = () => SketchService.undo();
  el.sketchRedoBtn.onclick = () => SketchService.redo();
  el.sketchClearBtn.onclick = () => {
    if (confirm('Bersihkan seluruh kanvas coretan?')) {
      SketchService.clearAll();
    }
  };

  document.querySelectorAll('input[name="sketchBg"]').forEach(r => {
    r.onchange = () => SketchService.setBackground(r.value);
  });

  // Reminder interactions
  el.clearReminderBtn.onclick = () => {
    el.noteReminderInput.value = '';
  };

  if (el.notifyPermBtn) {
    el.notifyPermBtn.onclick = async () => {
      const state = await ReminderService.requestPermission();
      if (state === 'granted') {
        el.notifyPermBtn.style.display = 'none';
        UIService.showToast('Izin notifikasi pengingat berhasil diaktifkan!', 'info');
      } else {
        UIService.showToast('Izin notifikasi tidak diberikan.', 'danger');
      }
    };
  }

  // Reminder alert dialog
  el.reminderAlertDismissBtn.onclick = () => {
    el.reminderAlertOverlay.classList.remove('open');
  };

  el.reminderAlertOpenBtn.onclick = () => {
    el.reminderAlertOverlay.classList.remove('open');
    if (ReminderService.activeAlertNote) {
      openNoteEditor(ReminderService.activeAlertNote);
    }
  };

  // Category auto-detection on typing in editor
  const handleAutoCategory = () => {
    if (!autoDetectCategoryEnabled) return;
    const text = el.noteTitle.value + ' ' + SecurityService.stripHtml(el.noteBody.innerHTML);
    const detected = detectCategoryFromText(text);
    if (detected && el.categorySelect.value !== detected) {
      el.categorySelect.value = detected;
      el.categorySelect.dispatchEvent(new Event('change'));
      el.categoryHint.textContent = `Kategori otomatis disesuaikan ke "${getCategory(detected)?.name}".`;
      el.categoryHint.style.color = 'var(--teal)';
    }
  };

  el.noteTitle.addEventListener('input', handleAutoCategory);
  el.noteBody.addEventListener('input', handleAutoCategory);
  el.noteBody.addEventListener('click', (event) => {
    const chip = event.target.closest('.cp104-inline-note');
    if (!chip) return;
    const id = chip.getAttribute('data-att-id');
    const att = currentAttachments.find((item) => item.id === id);
    if (att) previewAttachment(att);
    else {
      chip.remove();
      UIService.showToast('Sisipan berkas ini sudah tidak memiliki lampiran.', 'info');
    }
  });

  el.categorySelect.onchange = () => {
    const isFin = el.categorySelect.value === 'keuangan';
    el.financeRow.style.display = isFin ? 'flex' : 'none';
    if (!isFin) {
      el.financeDebtRow.style.display = 'none';
    } else {
      el.financeDebtRow.style.display = el.financeType.value === 'debt' ? 'block' : 'none';
    }
  };

  el.financeType.onchange = () => {
    el.financeDebtRow.style.display = el.financeType.value === 'debt' ? 'block' : 'none';
  };

  // Voice recording button
  el.voiceRecordBtn.onclick = toggleVoiceRecording;

  // File uploads
  el.dropZone.onclick = () => el.fileInput.click();
  el.fileInput.onchange = (e) => {
    handleFilesUpload(e.target.files);
    el.fileInput.value = '';
  };

  if (el.insertFileBtn && el.inlineFileInput) {
    // Some Android WebViews reject click() on an input with display:none.
    // Keep the input visually hidden, capture the caret before the native
    // picker opens, and prefer showPicker() when available.
    el.inlineFileInput.classList.add('cp104-file-picker-input');
    const armInlinePicker = () => {
      const markerId = EditorService.createInsertionMarker(el.noteBody);
      el.inlineFileInput.dataset.cp104Marker = markerId || '';
    };
    el.insertFileBtn.addEventListener('pointerdown', armInlinePicker);
    el.insertFileBtn.onclick = () => {
      if (!el.inlineFileInput.dataset.cp104Marker) armInlinePicker();
      try {
        if (typeof el.inlineFileInput.showPicker === 'function') el.inlineFileInput.showPicker();
        else el.inlineFileInput.click();
      } catch (_) {
        el.inlineFileInput.click();
      }
    };
    el.inlineFileInput.onchange = async (e) => {
      const markerId = el.inlineFileInput.dataset.cp104Marker || null;
      await handleInlineFilesUpload(e.target.files, markerId);
      el.inlineFileInput.dataset.cp104Marker = '';
      el.inlineFileInput.value = '';
    };
  }

  el.dropZone.ondragover = (e) => {
    e.preventDefault();
    el.dropZone.classList.add('dragover');
  };

  el.dropZone.ondragleave = () => el.dropZone.classList.remove('dragover');
  el.dropZone.ondrop = (e) => {
    e.preventDefault();
    el.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files) handleFilesUpload(e.dataTransfer.files);
  };

  // Search & Filter
  el.searchInput.oninput = UIService.debounce(() => renderNotesList(), 200);
  el.searchClearBtn.onclick = () => {
    el.searchInput.value = '';
    renderNotesList();
  };

  el.filterToggleBtn.onclick = () => {
    const isShown = el.filterPanel.classList.toggle('open');
    el.filterPanel.classList.toggle('show', isShown);
    el.filterToggleBtn.classList.toggle('active', isShown);
  };

  el.filterCategory.onchange = () => renderNotesList();
  el.filterAttachType.onchange = () => renderNotesList();
  el.filterDateFrom.onchange = () => renderNotesList();
  el.filterDateTo.onchange = () => renderNotesList();

  el.filterResetBtn.onclick = () => {
    el.filterCategory.value = '';
    el.filterAttachType.value = '';
    el.filterDateFrom.value = '';
    el.filterDateTo.value = '';
    renderNotesList();
  };

  // Select Mode
  el.selectModeBtn.onclick = () => {
    isSelectMode = !isSelectMode;
    selectedNoteIds.clear();
    updateSelectModeUI();
    renderNotesList();
  };

  // Finance shortcut: arahkan ke tool Keuangan baru agar tidak ada dua logika keuangan berbeda.
  el.financeBtn.onclick = () => FeaturePackService.switchTab('finance');
  el.closeFinanceBtn.onclick = () => el.financeOverlay.classList.remove('open');
  el.closeFinanceTopBtn.onclick = () => el.financeOverlay.classList.remove('open');
  el.financeFrom.onchange = updateFinanceView;
  el.financeTo.onchange = updateFinanceView;
  el.exportFinanceBtn.onclick = () => window.print();

  // Export Modal
  el.exportMainBtn.onclick = () => {
    const targets = isSelectMode && selectedNoteIds.size > 0 ? notes.filter(n => selectedNoteIds.has(n.id)) : notes;
    el.exportCountText.textContent = `Mengekspor ${targets.length} catatan.`;
    el.exportOverlay.classList.add('open');
  };

  el.closeExportModalBtn.onclick = () => el.exportOverlay.classList.remove('open');
  el.cancelExportBtn.onclick = () => el.exportOverlay.classList.remove('open');

  el.doExportBtn.onclick = async () => {
    const fmt = document.querySelector('input[name="exportFormat"]:checked')?.value || 'json';
    const targets = isSelectMode && selectedNoteIds.size > 0 ? notes.filter(n => selectedNoteIds.has(n.id)) : notes;
    const setProgress = (pct, text) => {
      if (el.exportProgressWrap) el.exportProgressWrap.style.display = 'block';
      if (el.exportProgressBar) el.exportProgressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      if (el.exportProgressText) el.exportProgressText.textContent = text || `${pct}%`;
    };
    try {
      el.doExportBtn.disabled = true;
      el.cancelExportBtn.disabled = true;
      setProgress(5, 'Menyiapkan data…');
      UIService.showToast('Menyiapkan berkas ekspor…', 'info');
      setProgress(25, 'Mengumpulkan catatan dan lampiran…');
      const result = await ExportImportService.exportNotes(targets, categories, fmt);
      setProgress(100, 'Ekspor selesai.');
      const savedLocation = result?.result?.location || (result?.result?.method === 'android-downloads' ? 'Download/Catatan Pintar/' : 'folder unduhan yang dipilih');
      const formatLabel = fmt === 'pdf' ? 'PDF' : fmt.toUpperCase();
      UIService.showToast(`Ekspor ${targets.length} catatan ke ${formatLabel} berhasil. Lokasi: ${savedLocation}`, 'info', null, null, 6500);
      setTimeout(() => el.exportOverlay.classList.remove('open'), 700);
      return result;
    } catch (err) {
      setProgress(0, 'Ekspor gagal.');
      UIService.showToast('Gagal ekspor: ' + err.message, 'danger');
    } finally {
      el.doExportBtn.disabled = false;
      el.cancelExportBtn.disabled = false;
      setTimeout(() => { if (el.exportProgressWrap) el.exportProgressWrap.style.display = 'none'; }, 900);
    }
  };

  // Import Modal
  el.importMainBtn.onclick = () => {
    pendingImportData = null;
    el.importFileInfo.style.display = 'none';
    el.importStatusMsg.textContent = '';
    el.importProgressWrap.style.display = 'none';
    el.importProgressBar.style.width = '0%';
    el.importProgressText.textContent = '0%';
    el.doImportBtn.disabled = true;
    el.importOverlay.classList.add('open');
    requestAnimationFrame(() => el.importOverlay.querySelector('.import-modal')?.scrollTo({top:0, behavior:'auto'}));
  };

  el.closeImportModalBtn.onclick = () => el.importOverlay.classList.remove('open');
  el.cancelImportBtn.onclick = () => el.importOverlay.classList.remove('open');

  const openImportPicker = () => {
    try {
      if (el.importFileInput?.showPicker) el.importFileInput.showPicker();
      else el.importFileInput?.click();
    } catch (_) { el.importFileInput?.click(); }
  };
  el.importDropZone.onclick = openImportPicker;
  el.importFileInput.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      el.importStatusMsg.textContent = '⏳ Membaca dan memverifikasi cadangan…';
      el.importStatusMsg.className = 'status-msg';
      el.importProgressWrap.style.display = 'block';
      el.importProgressBar.style.width = '10%';
      el.importProgressText.textContent = '10% — Membaca berkas';
      pendingImportData = await ExportImportService.parseBackupFile(file);
      el.importProgressBar.style.width = '35%';
      el.importProgressText.textContent = '35% — Validasi selesai';
      el.importFileName.textContent = file.name;
      el.importFileSize.textContent = AttachmentService.formatSize(file.size);
      el.importFileStats.textContent = `✓ Berisi ${pendingImportData.count} catatan & ${pendingImportData.categories.length} kategori kustom.`;
      el.importFileInfo.style.display = 'block';
      el.doImportBtn.disabled = false;
      el.importStatusMsg.textContent = '✓ Berkas valid. Pilih metode lalu tekan Mulai Impor.';
    } catch (err) {
      pendingImportData = null;
      el.importStatusMsg.textContent = 'Berkas tidak valid: ' + err.message;
      el.importStatusMsg.className = 'status-msg danger';
      el.doImportBtn.disabled = true;
      el.importProgressWrap.style.display = 'none';
    } finally {
      e.target.value = '';
    }
  };

  el.doImportBtn.onclick = async () => {
    if (!pendingImportData) return;
    const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';
    const incoming = pendingImportData.notes || [];
    try {
      el.doImportBtn.disabled = true;
      el.cancelImportBtn.disabled = true;
      el.importProgressWrap.style.display = 'block';
      el.importProgressBar.style.width = '45%';
      el.importProgressText.textContent = `45% — Menyiapkan ${incoming.length} catatan`;
      el.importStatusMsg.className = 'status-msg';
      el.importStatusMsg.textContent = mode === 'replace' ? 'Menghapus data lama dan menyiapkan cadangan…' : 'Menggabungkan cadangan dengan data saat ini…';

      if (mode === 'replace') {
        const oldIds = notes.map(n => n.id);
        for (let i = 0; i < oldIds.length; i++) {
          await StorageService.deleteNote(oldIds[i]);
          if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
        }
        notes = [...incoming];
        categories = [...CORE_CATEGORIES];
      } else {
        const existingIds = new Set(notes.map(n => n.id));
        const newNotes = incoming.filter(n => !existingIds.has(n.id));
        notes = newNotes.concat(notes);
      }

      el.importProgressBar.style.width = '60%';
      el.importProgressText.textContent = '60% — Menyimpan catatan';
      await new Promise(r => setTimeout(r, 0));
      // Persist in one canonical transaction path; saveNotes also offloads attachment bytes.
      await StorageService.saveNotes(notes, categories);
      el.importProgressBar.style.width = '85%';
      el.importProgressText.textContent = '85% — Menyimpan lampiran, kategori & data keuangan';

      if (pendingImportData.financeState && typeof pendingImportData.financeState === 'object') {
        const fs = pendingImportData.financeState;
        const mergeArray = (current, incomingItems) => {
          if (!Array.isArray(incomingItems)) return current;
          if (mode === 'replace') return incomingItems;
          const ids = new Set(current.map(x => x && x.id).filter(Boolean));
          return current.concat(incomingItems.filter(x => !x?.id || !ids.has(x.id)));
        };
        const oldOb = JSON.parse(localStorage.getItem('cp_obligations_v2') || '[]');
        const oldSav = JSON.parse(localStorage.getItem('cp_savings_v2') || '[]');
        const oldHist = JSON.parse(localStorage.getItem('cp_finance_history_v1') || '[]');
        localStorage.setItem('cp_obligations_v2', JSON.stringify(mergeArray(Array.isArray(oldOb)?oldOb:[], fs.obligations)));
        localStorage.setItem('cp_savings_v2', JSON.stringify(mergeArray(Array.isArray(oldSav)?oldSav:[], fs.savings)));
        localStorage.setItem('cp_finance_history_v1', JSON.stringify(mergeArray(Array.isArray(oldHist)?oldHist:[], fs.history)));
      }

      if (pendingImportData.categories && pendingImportData.categories.length > 0) {
        const mergedCats = [...categories];
        pendingImportData.categories.forEach(newCat => {
          if (!mergedCats.some(c => c.id === newCat.id)) mergedCats.push(newCat);
        });
        categories = mergedCats;
        await StorageService.saveCategories(categories);
      }

      el.importProgressBar.style.width = '100%';
      el.importProgressText.textContent = '100% — Impor selesai';
      el.importStatusMsg.textContent = `✓ Impor selesai: ${incoming.length} catatan diproses.`;
      renderCategoryChips();
      populateCategorySelect();
      renderNotesList();
      await UIService.updateStorageMeter();
      try { FeaturePackService.renderFinance?.(); } catch (_) {}
      UIService.showToast(`Berhasil mengimpor ${incoming.length} catatan dan data pendukung.`, 'info');
      pendingImportData = null;
      setTimeout(() => el.importOverlay.classList.remove('open'), 900);
    } catch (err) {
      el.importStatusMsg.textContent = 'Gagal memproses impor: ' + err.message;
      el.importStatusMsg.className = 'status-msg danger';
      UIService.showToast('Gagal memproses impor: ' + err.message, 'danger');
    } finally {
      el.doImportBtn.disabled = !pendingImportData;
      el.cancelImportBtn.disabled = false;
    }
  };

  // Local AI Assistant Chat
  el.fabChat.onclick = () => {
    el.chatOverlay.classList.add('open');
    if (el.chatMessages.children.length === 0) {
      addChatMessage('assistant', 'Halo! Saya asisten pintar lokal catatan Anda. Tanyakan tentang catatan keuangan, hutang, pengingat jadwal, atau cari ide apa pun di sini secara offline & privat.');
    }
    el.chatInput.focus();
  };

  el.closeChatBtn.onclick = () => el.chatOverlay.classList.remove('open');

  const handleSendChat = () => {
    const q = el.chatInput.value.trim();
    if (!q) return;

    addChatMessage('user', q);
    el.chatInput.value = '';

    setTimeout(() => {
      const response = AssistantService.ask(q, notes, categories);
      addChatMessage('assistant', response.text, response.references);
    }, 150);
  };

  el.chatSendBtn.onclick = handleSendChat;
  el.chatInput.onkeydown = (e) => {
    if (e.key === 'Enter') handleSendChat();
  };

  // File Viewer
  el.closeViewerBtn.onclick = () => {
    AttachmentService.revokeAllBlobUrls();
    el.viewerOverlay.classList.remove('open');
  };

  // Category Manager Modal
  el.manageCatBtn.onclick = () => {
    renderCategoryManagerList();
    el.catOverlay.classList.add('open');
  };

  el.closeCatBtn.onclick = () => el.catOverlay.classList.remove('open');

  el.addCatBtn.onclick = async () => {
    const name = el.newCatInput.value.trim();
    if (!name) return;
    const icon = el.newCatIcon.value.trim() || '📁';
    const color = el.newCatColor.value || '#9c5a3c';
    const id = 'cat_' + Date.now().toString(36);

    categories.push({ id, name, icon, color, core: false });
    await StorageService.saveCategories(categories);

    el.newCatInput.value = '';
    renderCategoryManagerList();
    renderCategoryChips();
    populateCategorySelect();
    UIService.showToast(`Kategori "${name}" berhasil ditambahkan.`, 'info');
  };

  // Storage Isolation Badge & Modal
  if (el.envBadgeBtn) {
    el.envBadgeBtn.onclick = () => {
      const cfg = StorageService.getStorageConfig();
      if (el.envModalActiveName) {
        el.envModalActiveName.textContent = `${cfg.icon} ${cfg.fullLabel}`;
      }
      if (el.storageEnvModalOverlay) {
        el.storageEnvModalOverlay.classList.add('open');
      }
    };
  }

  if (el.closeStorageEnvModalBtn) {
    el.closeStorageEnvModalBtn.onclick = () => {
      if (el.storageEnvModalOverlay) el.storageEnvModalOverlay.classList.remove('open');
    };
  }
  if (el.closeStorageEnvModalFootBtn) {
    el.closeStorageEnvModalFootBtn.onclick = () => {
      if (el.storageEnvModalOverlay) el.storageEnvModalOverlay.classList.remove('open');
    };
  }

  if (el.switchEnvBtn) {
    el.switchEnvBtn.onclick = async () => {
      const cur = StorageService.getStorageEnvironment();
      const target = cur === 'app' ? 'browser' : 'app';
      StorageService.setStorageEnvironment(target);
      notes = await StorageService.loadNotes();
      categories = await StorageService.loadCategories();
      populateCategorySelect();
      renderCategoryChips();
      renderNotesList();
      updateEnvironmentBadgeUI();
      await UIService.updateStorageMeter();
      const newCfg = StorageService.getStorageConfig();
      if (el.envModalActiveName) {
        el.envModalActiveName.textContent = `${newCfg.icon} ${newCfg.fullLabel}`;
      }
      UIService.showToast(`Beralih ke ${newCfg.label}. Data di ruang ini terpisah dan mandiri.`, 'info');
    };
  }

  if (el.copyBrowserToAppBtn) {
    el.copyBrowserToAppBtn.onclick = async () => {
      if (confirm('Salin semua catatan dari ruang Browser ke ruang Aplikasi?')) {
        UIService.showToast('Menyalin data…', 'info');
        const res = await StorageService.copyDataBetweenEnvironments('browser', 'app');
        if (res.success) {
          UIService.showToast(res.message, 'info');
          if (StorageService.getStorageEnvironment() === 'app') {
            notes = await StorageService.loadNotes();
            categories = await StorageService.loadCategories();
            populateCategorySelect();
            renderCategoryChips();
            renderNotesList();
            await UIService.updateStorageMeter();
          }
        } else {
          UIService.showToast(res.message, 'danger');
        }
      }
    };
  }

  if (el.copyAppToBrowserBtn) {
    el.copyAppToBrowserBtn.onclick = async () => {
      if (confirm('Salin semua catatan dari ruang Aplikasi ke ruang Browser?')) {
        UIService.showToast('Menyalin data…', 'info');
        const res = await StorageService.copyDataBetweenEnvironments('app', 'browser');
        if (res.success) {
          UIService.showToast(res.message, 'info');
          if (StorageService.getStorageEnvironment() === 'browser') {
            notes = await StorageService.loadNotes();
            categories = await StorageService.loadCategories();
            populateCategorySelect();
            renderCategoryChips();
            renderNotesList();
            await UIService.updateStorageMeter();
          }
        } else {
          UIService.showToast(res.message, 'danger');
        }
      }
    };
  }

  // Pemeriksaan pembaruan manual
  if (el.checkUpdateBtn) {
    el.checkUpdateBtn.onclick = async () => {
      el.checkUpdateBtn.disabled = true;
      try {
        const result = await UpdateService.manualCheck();
        if (!result?.available) UIService.showToast(result?.error ? 'Gagal memeriksa pembaruan.' : `Tidak ada versi lebih baru dari ${APP_VERSION}.`, result?.error ? 'danger' : 'info');
      } finally {
        el.checkUpdateBtn.disabled = false;
      }
    };
  }

  // APK Standalone Modal
  if (el.openApkInfoBtn) {
    el.openApkInfoBtn.onclick = () => {
      if (el.apkModalOverlay) el.apkModalOverlay.classList.add('open');
    };
  }
  if (el.closeApkModalBtn) {
    el.closeApkModalBtn.onclick = () => {
      if (el.apkModalOverlay) el.apkModalOverlay.classList.remove('open');
    };
  }
  if (el.closeApkModalFootBtn) {
    el.closeApkModalFootBtn.onclick = () => {
      if (el.apkModalOverlay) el.apkModalOverlay.classList.remove('open');
    };
  }

  // Real Device Vault Handlers (Anti-Browser Wipe)
  const updateVaultStatusUI = () => {
    if (!el.vaultStatusText) return;
    if (StorageService.hasActiveFileHandle()) {
      const fileName = StorageService.getActiveFileName() || 'catatan_pintar_vault.json';
      el.vaultStatusText.replaceChildren();
      const strong = document.createElement('b');
      strong.style.color = '#15803d';
      strong.textContent = '🟢 Terhubung ke Berkas Fisik: ';
      const code = document.createElement('code');
      code.textContent = fileName;
      el.vaultStatusText.append(strong, code, document.createTextNode(' (Catatan kebal pembersihan browser)'));
    } else {
      el.vaultStatusText.innerHTML = '⚪ Belum terhubung ke berkas fisik perangkat.';
    }
  };

  if (el.linkVaultBtn) {
    el.linkVaultBtn.onclick = async () => {
      try {
        UIService.showToast('Membuka pemilih berkas perangkat…', 'info');
        const res = await StorageService.linkDeviceVaultFile();
        if (res.success) {
          await StorageService.saveNotes(notes, categories);
          updateVaultStatusUI();
          UIService.showToast(`Berhasil menghubungkan berkas "${res.name}". Catatan Anda kini otomatis disimpan ke memori fisik HP/Laptop!`, 'info');
        }
      } catch (err) {
        alert(err.message || 'Gagal menghubungkan berkas perangkat.');
      }
    };
  }

  const handleRestoreFromVault = async () => {
    try {
      UIService.showToast('Membuka berkas brankas…', 'info');
      const res = await StorageService.openDeviceVaultFile();
      if (res && res.success && res.data) {
        const importedNotes = res.data.notes || [];
        const importedCats = res.data.categories || [];
        if (Array.isArray(importedNotes) && importedNotes.length > 0) {
          notes = importedNotes;
          if (Array.isArray(importedCats) && importedCats.length > 0) {
            categories = importedCats;
          }
          await StorageService.saveNotes(notes, categories);
          populateCategorySelect();
          renderCategoryChips();
          renderNotesList();
          await UIService.updateStorageMeter();
          updateVaultStatusUI();
          if (el.browserWipedRecoveryBanner) el.browserWipedRecoveryBanner.style.display = 'none';
          UIService.showToast(`Berhasil memulihkan ${notes.length} catatan dari berkas "${res.fileName}"!`, 'info');
        } else {
          UIService.showToast('Berkas brankas dibuka, namun tidak ada data catatan di dalamnya.', 'warning');
        }
      }
    } catch (err) {
      alert(err.message || 'Gagal membuka berkas brankas.');
    }
  };

  if (el.restoreVaultBtn) {
    el.restoreVaultBtn.onclick = handleRestoreFromVault;
  }
  if (el.quickRestoreVaultBtn) {
    el.quickRestoreVaultBtn.onclick = handleRestoreFromVault;
  }

  if (el.dismissRecoveryBannerBtn) {
    el.dismissRecoveryBannerBtn.onclick = () => {
      if (el.browserWipedRecoveryBanner) el.browserWipedRecoveryBanner.style.display = 'none';
    };
  }

  if (el.downloadBackupBtn) {
    el.downloadBackupBtn.onclick = async () => {
      try {
        UIService.showToast('Menyiapkan berkas cadangan fisik…', 'info');
        await ExportImportService.exportNotes(notes, categories, 'json');
        UIService.showToast('Cadangan fisik berhasil diunduh ke folder perangkat Anda!', 'info');
      } catch (err) {
        UIService.showToast('Gagal mengunduh cadangan: ' + err.message, 'danger');
      }
    };
  }
}

function renderCategoryManagerList() {
  if (!el.catList) return;
  el.catList.innerHTML = '';

  categories.forEach((cat) => {
    const row = document.createElement('div');
    row.className = 'cat-item';
    row.innerHTML = `
      <div class="cat-item-left">
        <span class="cat-item-dot" style="background:${cat.color};"></span>
        <span>${cat.icon || '📁'} <b>${SecurityService.escapeHtml(cat.name)}</b></span>
        ${cat.core ? '<span class="text-[10px] text-[var(--ink-soft)] bg-[var(--card-edge)] px-1.5 py-0.5 rounded ml-2">Inti</span>' : ''}
      </div>
    `;

    if (!cat.core) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-subtle text-[var(--danger)] text-xs';
      delBtn.textContent = 'Hapus';
      delBtn.onclick = async () => {
        categories = categories.filter(c => c.id !== cat.id);
        await StorageService.saveCategories(categories);
        renderCategoryManagerList();
        renderCategoryChips();
        populateCategorySelect();
      };
      row.appendChild(delBtn);
    }

    el.catList.appendChild(row);
  });
}

function addChatMessage(role, text, references = []) {
  const msg = document.createElement('div');
  msg.className = `chat-bubble ${role}`;

  const textDiv = document.createElement('div');
  textDiv.style.whiteSpace = 'pre-wrap';
  textDiv.textContent = text;
  msg.appendChild(textDiv);

  if (references && references.length > 0) {
    const refsDiv = document.createElement('div');
    refsDiv.className = 'chat-refs';
    references.forEach(note => {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'chat-ref-link';
      link.innerHTML = `📌 <b>${SecurityService.escapeHtml(note.title)}</b>`;
      link.onclick = () => {
        el.chatOverlay.classList.remove('open');
        openNoteEditor(note);
      };
      refsDiv.appendChild(link);
    });
    msg.appendChild(refsDiv);
  }

  el.chatMessages.appendChild(msg);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function updateEnvironmentBadgeUI() {
  const cfg = StorageService.getStorageConfig();
  if (el.envBadgeIcon) el.envBadgeIcon.textContent = cfg.icon;
  if (el.envBadgeText) el.envBadgeText.textContent = cfg.label;
  if (el.envBadgeBtn) el.envBadgeBtn.title = `Ruang penyimpanan aktif: ${cfg.fullLabel}. Klik untuk rincian isolasi data.`;
}

/* ==========================================================================
   INITIALIZATION BOOTSTRAP
   ========================================================================== */

async function init() {
  cacheElements();
  bindEventListeners();
  updateEnvironmentBadgeUI();

  // Initialize Canvas Sketch Service
  try {
    if (el.sketchCanvas) {
      SketchService.init(el.sketchCanvas);
    }
  } catch (e) {
    console.warn('SketchService init notice:', e);
  }

  // Load Categories & Notes from Storage / IndexedDB
  try {
    categories = await StorageService.loadCategories();
    await StorageService.autoMigrateLegacyData();
    notes = await StorageService.loadNotes();
  } catch (storageErr) {
    console.warn('StorageService load notice:', storageErr);
    categories = CORE_CATEGORIES;
    notes = [];
  }

  try {
    populateCategorySelect();
    renderCategoryChips();
    renderNotesList();
    await UIService.updateStorageMeter();

    // Disaster Recovery Detection (e.g. user cleared browser cookies and site data)
    if (notes.length > 0) {
      try { sessionStorage.setItem('cp_had_data', 'true'); } catch (e) {}
    } else {
      try {
        const hadData = sessionStorage.getItem('cp_had_data');
        if (hadData === 'true' && el.browserWipedRecoveryBanner) {
          el.browserWipedRecoveryBanner.style.display = 'block';
        }
      } catch (e) {}
    }
  } catch (uiErr) {
    console.warn('UI render notice:', uiErr);
  }

  // Initialize Progressive Web App (PWA) Install & Connectivity Service
  try {
    PWAService.init({
      installAppBtn: el.installAppBtn,
      installModalOverlay: el.installModalOverlay,
      closeInstallModalBtn: el.closeInstallModalBtn,
      closeInstallModalFootBtn: el.closeInstallModalFootBtn,
      doInstallPromptBtn: el.doInstallPromptBtn,
      offlineIndicator: el.offlineIndicator
    });
  } catch (pwaErr) {
    console.warn('PWAService init notice:', pwaErr);
  }

  // Cek Pembaruan Aplikasi (otomatis + dapat dipicu manual)
  if (el.updateStatusText) el.updateStatusText.textContent = `Versi saat ini: ${APP_VERSION}`;
  try {
    const updateElements = {
      updateModalOverlay: el.updateModalOverlay,
      closeUpdateModalBtn: el.closeUpdateModalBtn,
      closeUpdateModalLaterBtn: el.closeUpdateModalLaterBtn,
      updateModalBody: el.updateModalBody,
      updateDownloadBtn: el.updateDownloadBtn,
      updateVersionText: el.updateVersionText,
      updateStatusText: el.updateStatusText
    };
    const showUpdateResult = async (options = {}) => {
      const result = await UpdateService.check(updateElements, APP_VERSION, options);
      if (result?.available && !result.dismissed) {
        if (el.updateBadgeBtn) {
          el.updateBadgeBtn.style.display = 'inline-flex';
          el.updateBadgeBtn.textContent = `⬆️ Update ${result.version}`;
          el.updateBadgeBtn.onclick = () => el.updateModalOverlay?.classList.add('open');
        }
        if (!options.silent) UIService.showToast(`Versi baru ${result.version} tersedia.`, 'info', 'Lihat', () => el.updateModalOverlay?.classList.add('open'), 7000);
      }
      return result;
    };
    const isNativeApp = Boolean(window.Capacitor?.isNativePlatform?.());
    if (el.installAppBtn && isNativeApp) {
      el.installAppBtn.style.display = 'inline-flex';
      el.installAppBtn.textContent = '🔎 Periksa Pembaruan';
      el.installAppBtn.title = 'Periksa versi terbaru di GitHub';
      el.installAppBtn.onclick = async () => {
        el.installAppBtn.disabled = true;
        el.installAppBtn.textContent = '⏳ Memeriksa…';
        try {
          const result = await UpdateService.manualCheck();
          if (!result?.available) UIService.showToast(result?.error ? 'Pemeriksaan pembaruan gagal.' : `Anda sudah menggunakan versi ${APP_VERSION}.`, result?.error ? 'danger' : 'info');
        } finally {
          el.installAppBtn.disabled = false;
          el.installAppBtn.textContent = '🔎 Periksa Pembaruan';
        }
      };
    }
    UpdateService.init(updateElements, APP_VERSION).then((result) => {
      if (result?.available && !result.dismissed && el.updateBadgeBtn) {
        el.updateBadgeBtn.style.display = 'inline-flex';
        el.updateBadgeBtn.textContent = `⬆️ Update ${result.version}`;
        el.updateBadgeBtn.onclick = () => el.updateModalOverlay?.classList.add('open');
      }
    }).catch(() => {});
    // Android/WebView kadang baru memiliki koneksi internet beberapa saat setelah startup.
    // Cek setelah UI siap, saat koneksi pulih, saat kembali ke foreground, dan berkala.
    setTimeout(() => showUpdateResult({ silent: false }), 2500);
    window.addEventListener('online', () => setTimeout(() => showUpdateResult({ silent: false }), 500));
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) setTimeout(() => showUpdateResult({ silent: false }), 800);
    });
    setInterval(() => {
      if (navigator.onLine !== false) showUpdateResult({ silent: false });
    }, 6 * 60 * 60 * 1000);
  } catch (updErr) {
    console.warn('UpdateService init notice:', updErr);
  }

  // Buka Catatan dari Berkas .cnote (tap berkas di file manager)
  try {
    FileOpenService.init(async (rawText) => {
      try {
        const parsed = ExportImportService.parseBackupText(rawText);
        if (!parsed.notes.length) {
          throw new Error('Berkas tidak berisi data catatan.');
        }
        const incoming = parsed.notes[0];
        const idx = notes.findIndex(n => n.id === incoming.id);
        if (idx >= 0) {
          notes[idx] = incoming;
        } else {
          notes.unshift(incoming);
        }
        await StorageService.saveNote(incoming);
        renderCategoryChips();
        populateCategorySelect();
        renderNotesList();
        openNoteEditor(incoming);
        UIService.showToast('Catatan berhasil dibuka dari berkas.', 'info');
      } catch (parseErr) {
        UIService.showToast('Gagal membuka berkas catatan: ' + parseErr.message, 'danger');
      }
    });
  } catch (foErr) {
    console.warn('FileOpenService init notice:', foErr);
  }

  // Start Reminder Background Checker
  try {
    ReminderService.startReminderChecker(
      () => notes,
      async (triggeredNote) => {
        ReminderService.activeAlertNote = triggeredNote;
        if (el.reminderAlertTitle) el.reminderAlertTitle.textContent = triggeredNote.title || 'Catatan';
        if (el.reminderAlertBody) el.reminderAlertBody.textContent = SecurityService.stripHtml(triggeredNote.bodyHTML || '');
        if (el.reminderAlertOverlay) el.reminderAlertOverlay.classList.add('open');

        // Update storage
        await StorageService.saveNote(triggeredNote);
        renderNotesList();
      }
    );
  } catch (remErr) {
    console.warn('ReminderService notice:', remErr);
  }

  // Feature pack: keuangan, jadwal, batch tools, kategori cepat, anotasi gambar.
  try {
    FeaturePackService.init({
      getNotes: () => notes,
      getCategories: () => categories,
      openNote: (noteOrId) => {
        const n = typeof noteOrId === 'string' ? notes.find(x => x.id === noteOrId) : noteOrId;
        if (!n) return;
        if (n.category === 'keuangan' && n.finance) { FeaturePackService.openFinanceForm(n.finance.type || 'expense', n); return; }
        if (n.category === 'acara') { FeaturePackService.openEventForm(n.eventDate || new Date().toISOString().slice(0,10), n); return; }
        openNoteEditor(n);
      },
      persistNote: async (note) => {
        const idx = notes.findIndex(n => n.id === note.id);
        if (idx >= 0) notes[idx] = note;
        else notes.unshift(note);
        await StorageService.saveNote(note);
        renderCategoryChips();
        renderNotesList();
        await UIService.updateStorageMeter();
        document.dispatchEvent(new Event('cp104:refresh'));
        return note;
      },
      deleteNote: async (noteId) => {
        await StorageService.deleteNote(noteId);
        notes = notes.filter(n => n.id !== noteId);
        renderCategoryChips();
        renderNotesList();
        await UIService.updateStorageMeter();
        document.dispatchEvent(new Event('cp104:refresh'));
      },
      openNewNoteWithAttachment: (attachment) => {
        openNoteEditor(null);
        currentAttachments = [attachment];
        renderAttachmentsList();
        UIService.showToast('Lampiran gambar sudah ditambahkan. Isi judul lalu simpan catatan.', 'info');
      },
      captureEditorSelection: () => EditorService.captureSelection(el.noteBody),
      createEditorInsertionMarker: () => {
        if (!el.overlay.classList.contains('open')) return null;
        return EditorService.createInsertionMarker(el.noteBody);
      },
      removeEditorInsertionMarker: (markerId) => EditorService.removeInsertionMarker(el.noteBody, markerId),
      getAttachmentData: async (attachment) => StorageService.readMediaAttachment(attachment),
      getCurrentAttachment: (attachmentId) => currentAttachments.find(a => a.id === attachmentId) || null,
      replaceAttachmentInCurrentNote: (attachment, attachmentId) => {
        if (!currentNoteId || !el.overlay.classList.contains('open')) return false;
        const idx = currentAttachments.findIndex(a => a.id === attachmentId);
        if (idx < 0) return false;
        currentAttachments[idx] = { ...currentAttachments[idx], ...attachment, id: attachmentId };
        renderAttachmentsList();
        return true;
      },
      addAttachmentToCurrentNote: (attachment, options = {}) => {
        if (!el.overlay.classList.contains('open')) {
          if (options.markerId) EditorService.removeInsertionMarker(el.noteBody, options.markerId);
          UIService.showToast('Buka editor catatan terlebih dahulu sebelum menambahkan anotasi.', 'danger');
          return false;
        }
        currentAttachments.push({ ...attachment });
        const inserted = insertInlineAttachment(attachment, options.markerId || null);
        if (!inserted && options.markerId) EditorService.removeInsertionMarker(el.noteBody, options.markerId);
        renderAttachmentsList();
        return inserted;
      },
      addCategory: async (cat) => {
        categories.push(cat);
        await StorageService.saveCategories(categories);
        populateCategorySelect();
        renderCategoryChips();
        if (el.categorySelect) { el.categorySelect.value = cat.id; el.categorySelect.dispatchEvent(new Event('change')); }
        UIService.showToast(`Kategori "${cat.name}" berhasil dibuat.`, 'info');
      },
      toast: (message, type='info') => UIService.showToast(message, type),
      getSelectedIds: () => Array.from(selectedNoteIds),
      clearSelection: () => { selectedNoteIds.clear(); isSelectMode = false; updateSelectModeUI(); renderNotesList(); },
      batchDelete: async (ids) => {
        for (const noteId of ids) {
          const deletedNote = notes.find(n => n.id === noteId);
          if (deletedNote?.finance?.type === 'expense') {
            try { FeaturePackService.applySavingsDelta(deletedNote.finance.funding || [{ id:'net', amount:Number(deletedNote.finance.amount)||0 }], 1); } catch (restoreErr) { console.warn('Gagal mengembalikan sumber dana batch:', restoreErr); }
            await FeaturePackService.recordFundingHistory('transaction', deletedNote.id, 'Hapus pengeluaran batch', deletedNote.finance.amount, deletedNote.finance.funding || [], { note: 'Saldo sumber dana internal dikembalikan.' });
          }
          if (deletedNote?.finance?.type === 'debt' && Array.isArray(deletedNote.finance.payments)) {
            for (const payment of deletedNote.finance.payments) { try { FeaturePackService.applySavingsDelta(payment.funding || [], 1); } catch (restoreErr) { console.warn('Gagal mengembalikan cicilan hutang batch:', restoreErr); } }
          }
          await StorageService.deleteNote(noteId);
        }
        notes = notes.filter(n => !ids.includes(n.id));
        renderCategoryChips(); renderNotesList(); await UIService.updateStorageMeter();
        document.dispatchEvent(new Event('cp104:refresh'));
      },
      batchMove: async (ids, targetCategory) => {
        const target = categories.find(c => c.id === targetCategory);
        if (!target) throw new Error('Kategori tidak ditemukan.');
        for (const noteId of ids) {
          const n = notes.find(x => x.id === noteId);
          if (!n) continue;
          n.category = targetCategory;
          n.updatedAt = Date.now();
          await StorageService.saveNote(n);
        }
        renderCategoryChips(); renderNotesList();
        document.dispatchEvent(new Event('cp104:refresh'));
      }
    });
  } catch (featureErr) {
    console.warn('FeaturePack init notice:', featureErr);
  }
}

// Boot up once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
