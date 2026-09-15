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

// DOM Elements cache
const el = {};

function cacheElements() {
  const ids = [
    'financeBtn', 'manageCatBtn', 'filterToggleBtn', 'importMainBtn', 'exportMainBtn', 'selectModeBtn',
    'storageBarWrap', 'storageFill', 'storageText', 'storageWarningBanner',
    'searchInput', 'searchClearBtn',
    'filterPanel', 'filterCategory', 'filterAttachType', 'filterDateFrom', 'filterDateTo', 'filterResetBtn',
    'chipsRow', 'notesList', 'emptyState', 'fabChat', 'fabAdd',
    'overlay', 'editorModeLabel', 'pinEditorBtn', 'closeEditorBtn', 'noteTitle', 'toolbar', 'fontSizeSelect', 'fontFamilySelect',
    'insertTableBtn', 'openSketchBtn', 'noteBody',
    'categorySelect', 'categoryHint',
    'reminderRow', 'noteReminderInput', 'clearReminderBtn', 'notifyPermBtn',
    'financeRow', 'financeType', 'financeAmount',
    'financeDebtRow', 'debtTo', 'debtPurpose', 'debtPaid',
    'voiceModeAudio', 'voiceModeText', 'voiceRecordBtn', 'recIndicator', 'recTimer', 'voiceStatus',
    'attachList', 'dropZone', 'fileInput', 'attachStatus',
    'statusMsg', 'saveBtn', 'cancelBtn', 'exportNoteBtn', 'deleteBtn',
    'confirmOverlay', 'confirmMsg', 'confirmCancelBtn', 'confirmOkBtn',
    'catOverlay', 'catList', 'newCatIcon', 'newCatInput', 'newCatColor', 'addCatBtn', 'closeCatBtn',
    'exportOverlay', 'closeExportModalBtn', 'exportCountText', 'cancelExportBtn', 'doExportBtn',
    'importOverlay', 'closeImportModalBtn', 'importDropZone', 'importFileInput', 'importFileInfo', 'importFileName', 'importFileSize', 'importFileStats', 'importStatusMsg', 'cancelImportBtn', 'doImportBtn',
    'financeOverlay', 'closeFinanceTopBtn', 'financeFrom', 'financeTo', 'financeSummary', 'financeChartsWrap', 'donutChartContainer', 'barChartContainer', 'financeTxList', 'debtUnpaidCount', 'debtUnpaidList', 'debtPaidCount', 'debtPaidList', 'exportFinanceBtn', 'closeFinanceBtn',
    'sketchOverlay', 'closeSketchBtn', 'sketchToolPen', 'sketchToolBrush', 'sketchToolEraser', 'sketchSize', 'sketchSizeVal', 'sketchPalette', 'sketchCustomColor', 'sketchUndoBtn', 'sketchRedoBtn', 'sketchClearBtn', 'sketchStage', 'sketchCanvas', 'cancelSketchBtn', 'insertSketchBtn',
    'reminderAlertOverlay', 'reminderAlertTitle', 'reminderAlertBody', 'reminderAlertDismissBtn', 'reminderAlertOpenBtn',
    'chatOverlay', 'closeChatBtn', 'chatMessages', 'chatInput', 'chatSendBtn',
    'viewerOverlay', 'viewerFileName', 'viewerFileMeta', 'downloadViewerBtn', 'closeViewerBtn', 'viewerBody',
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

  const allCount = notes.length;
  const allChip = document.createElement('button');
  allChip.className = `chip ${activeCategory === 'all' ? 'active' : ''}`;
  allChip.innerHTML = `✨ Semua <span class="chip-count">${allCount}</span>`;
  allChip.onclick = () => {
    activeCategory = 'all';
    renderCategoryChips();
    renderNotesList();
  };
  el.chipsRow.appendChild(allChip);

  categories.forEach(cat => {
    const count = notes.filter(n => n.category === cat.id).length;
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
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon || '📁'} ${cat.name}`;
    el.categorySelect.appendChild(opt);
  });

  if (el.filterCategory) {
    const curr = el.filterCategory.value;
    el.filterCategory.innerHTML = '<option value="">Semua Kategori</option>';
    categories.forEach(cat => {
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
  let list = [...notes];

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

    currentAttachments = (note.attachments || []).map(a => ({ ...a }));
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
    el.debtTo.value = '';
    el.debtPurpose.value = '';
    el.debtPaid.checked = false;

    currentAttachments = [];
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
  AudioVoiceService.stopAudioRecording();
  AudioVoiceService.stopSpeechRecognition();
  resetVoiceRecordingUI();
  el.overlay.classList.remove('open');
}

async function saveCurrentNote() {
  const title = el.noteTitle.value.trim() || 'Tanpa Judul';
  const bodyHTML = SecurityService.sanitizeHTML(el.noteBody.innerHTML);
  const category = el.categorySelect.value;

  // Finance
  let finance = null;
  if (category === 'keuangan') {
    const amt = parseFloat(el.financeAmount.value) || 0;
    finance = {
      type: el.financeType.value,
      amount: amt,
      debtTo: el.debtTo.value.trim(),
      debtPurpose: el.debtPurpose.value.trim(),
      debtPaid: el.debtPaid.checked
    };
  }

  // Reminder
  let reminder = null;
  if (el.noteReminderInput.value) {
    reminder = {
      datetime: el.noteReminderInput.value,
      notified: false
    };
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
      attachments: currentAttachments,
      createdAt: now,
      updatedAt: now
    };
    notes.unshift(noteObj);
  }

  // Save to IndexedDB & sync
  await StorageService.saveNote(noteObj);
  await UIService.updateStorageMeter();

  renderCategoryChips();
  renderNotesList();
  closeNoteEditor();
  UIService.showToast('Catatan berhasil disimpan.', 'info');
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

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Hapus Lampiran';
    delBtn.onclick = () => {
      currentAttachments.splice(idx, 1);
      renderAttachmentsList();
    };
    right.appendChild(delBtn);

    item.appendChild(right);
    el.attachList.appendChild(item);
  });
}

async function handleFilesUpload(fileList) {
  if (!fileList || fileList.length === 0) return;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];

    // Check individual file size warning
    if (file.size > 25 * 1024 * 1024) {
      UIService.showToast(`Berkas "${file.name}" terlalu besar (>25MB). Mohon pilih berkas lebih kecil.`, 'danger');
      continue;
    }

    try {
      let dataURL = null;
      let finalSize = file.size;
      let finalMime = file.type || 'application/octet-stream';
      let finalExt = AttachmentService.fileExt(file.name);

      // Canvas image compression for high-res images to conserve memory & storage
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

      const att = {
        id: 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: SecurityService.sanitizeFileName(file.name),
        mime: finalMime,
        ext: finalExt,
        size: finalSize,
        dataURL,
        kind: AttachmentService.classifyAttachment({ mime: finalMime, ext: finalExt }),
        createdAt: Date.now()
      };

      currentAttachments.push(att);
    } catch (err) {
      UIService.showToast(`Gagal memproses berkas "${file.name}": ${err.message}`, 'danger');
    }
  }

  renderAttachmentsList();

  // Real-time Storage Quota Check
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
      const blob = await AttachmentService.dataURLToBlob(fullAtt.dataURL);
      const blobUrl = AttachmentService.createManagedBlobUrl(blob);
      const iframe = document.createElement('iframe');
      iframe.src = blobUrl;
      iframe.className = 'viewer-iframe';
      el.viewerBody.appendChild(iframe);
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
      await StorageService.deleteNote(pendingDeleteId);
      notes = notes.filter(n => n.id !== pendingDeleteId);
      pendingDeleteId = null;
      el.confirmOverlay.classList.remove('open');
      closeNoteEditor();
      renderCategoryChips();
      renderNotesList();
      await UIService.updateStorageMeter();
      UIService.showToast('Catatan berhasil dihapus.', 'info');
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

  // Finance Modal
  el.financeBtn.onclick = openFinanceModal;
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
    const fmt = document.querySelector('input[name="exportFormat"]:checked').value;
    const targets = isSelectMode && selectedNoteIds.size > 0 ? notes.filter(n => selectedNoteIds.has(n.id)) : notes;

    try {
      el.exportOverlay.classList.remove('open');
      UIService.showToast('Menyiapkan berkas ekspor…', 'info');
      await ExportImportService.exportNotes(targets, categories, fmt);
      UIService.showToast(`Ekspor ${targets.length} catatan berhasil!`, 'info');
    } catch (err) {
      UIService.showToast('Gagal ekspor: ' + err.message, 'danger');
    }
  };

  // Import Modal
  el.importMainBtn.onclick = () => {
    pendingImportData = null;
    el.importFileInfo.style.display = 'none';
    el.importStatusMsg.textContent = '';
    el.doImportBtn.disabled = true;
    el.importOverlay.classList.add('open');
  };

  el.closeImportModalBtn.onclick = () => el.importOverlay.classList.remove('open');
  el.cancelImportBtn.onclick = () => el.importOverlay.classList.remove('open');

  el.importDropZone.onclick = () => el.importFileInput.click();
  el.importFileInput.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      el.importStatusMsg.textContent = 'Membaca dan memverifikasi data…';
      el.importStatusMsg.className = 'status-msg';

      pendingImportData = await ExportImportService.parseBackupFile(file);

      el.importFileName.textContent = file.name;
      el.importFileSize.textContent = AttachmentService.formatSize(file.size);
      el.importFileStats.textContent = `✓ Berisi ${pendingImportData.count} catatan & ${pendingImportData.categories.length} kategori kustom.`;
      el.importFileInfo.style.display = 'block';
      el.doImportBtn.disabled = false;
      el.importStatusMsg.textContent = 'Berkas valid dan siap diimpor.';
    } catch (err) {
      el.importStatusMsg.textContent = 'Berkas tidak valid: ' + err.message;
      el.importStatusMsg.className = 'status-msg danger';
      el.doImportBtn.disabled = true;
    }
  };

  el.doImportBtn.onclick = async () => {
    if (!pendingImportData) return;
    const mode = document.querySelector('input[name="importMode"]:checked').value;

    try {
      if (mode === 'replace') {
        notes = pendingImportData.notes;
      } else {
        // Merge: avoid duplicates by ID
        const existingIds = new Set(notes.map(n => n.id));
        const newNotes = pendingImportData.notes.filter(n => !existingIds.has(n.id));
        notes = newNotes.concat(notes);
      }

      // Save all imported notes into IndexedDB
      for (const note of notes) {
        await StorageService.saveNote(note);
      }

      // Save custom categories
      if (pendingImportData.categories && pendingImportData.categories.length > 0) {
        const mergedCats = [...categories];
        pendingImportData.categories.forEach(newCat => {
          if (!mergedCats.some(c => c.id === newCat.id)) {
            mergedCats.push(newCat);
          }
        });
        categories = mergedCats;
        await StorageService.saveCategories(categories);
      }

      el.importOverlay.classList.remove('open');
      renderCategoryChips();
      populateCategorySelect();
      renderNotesList();
      await UIService.updateStorageMeter();
      UIService.showToast(`Berhasil mengimpor ${pendingImportData.count} catatan.`, 'info');
    } catch (err) {
      UIService.showToast('Gagal memproses impor: ' + err.message, 'danger');
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

/* ==========================================================================
   INITIALIZATION BOOTSTRAP
   ========================================================================== */

async function init() {
  cacheElements();
  bindEventListeners();

  // Initialize Canvas Sketch Service
  if (el.sketchCanvas) {
    SketchService.init(el.sketchCanvas);
  }

  // Load Categories & Notes from IndexedDB
  categories = await StorageService.loadCategories();
  await StorageService.autoMigrateLegacyData();
  notes = await StorageService.loadNotes();

  populateCategorySelect();
  renderCategoryChips();
  renderNotesList();
  await UIService.updateStorageMeter();

  // Start Reminder Background Checker
  ReminderService.startReminderChecker(
    () => notes,
    async (triggeredNote) => {
      ReminderService.activeAlertNote = triggeredNote;
      el.reminderAlertTitle.textContent = triggeredNote.title || 'Catatan';
      el.reminderAlertBody.textContent = SecurityService.stripHtml(triggeredNote.bodyHTML || '');
      el.reminderAlertOverlay.classList.add('open');

      // Update storage
      await StorageService.saveNote(triggeredNote);
      renderNotesList();
    }
  );
}

// Boot up once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
