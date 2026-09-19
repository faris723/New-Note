/**
 * Engineer-Friendly Interactive Note Editor Service
 * Provides:
 * - Visual (WYSIWYG) <-> Markdown bidirectional mode toggle
 * - Interactive checklist task items (- [ ] / - [x])
 * - Code blocks with copy button & syntax-friendly formatting
 * - Inline code & developer formatting tools
 * - Keyboard shortcuts (Tab 2-spaces indentation, Ctrl+E, Ctrl+Shift+C, Ctrl+Shift+L, Ctrl+M)
 * - Live stats (words, characters, lines, read-time)
 * - Quick actions (Copy as Markdown, Clean format)
 * - Drawer pills navigation for Reminder, Finance, and Attachments
 */

import { SecurityService } from './security.js';
import { EditorService } from './editor.js';

export const EngineerEditorService = {
  isMarkdownMode: false,
  noteBodyEl: null,
  markdownAreaEl: null,
  toggleBtnEl: null,
  modeLabelEl: null,

  init(options = {}) {
    this.noteBodyEl = options.noteBody || document.getElementById('noteBody');
    this.markdownAreaEl = options.noteMarkdownArea || document.getElementById('noteMarkdownArea');
    this.toggleBtnEl = options.toggleMarkdownBtn || document.getElementById('toggleMarkdownBtn');
    this.modeLabelEl = options.modeToggleLabel || document.getElementById('modeToggleLabel');

    this.bindEditorEvents();
    this.bindToolbarExtras();
    this.bindDrawers();
    this.bindShortcutsModal();
    this.bindLiveStats();
  },

  /**
   * Reset editor state when opening a note
   */
  resetState(currentAttachments = []) {
    this.isMarkdownMode = false;
    if (this.markdownAreaEl) {
      this.markdownAreaEl.style.display = 'none';
      this.markdownAreaEl.value = '';
    }
    if (this.noteBodyEl) {
      this.noteBodyEl.style.display = 'block';
    }
    if (this.toggleBtnEl) {
      this.toggleBtnEl.classList.remove('active');
    }
    if (this.modeLabelEl) {
      this.modeLabelEl.textContent = 'Markdown';
    }

    // Collapse drawers by default unless they have content
    this.updateDrawerStatus(currentAttachments);
    this.updateStats();
  },

  /**
   * Toggle between Visual WYSIWYG and Raw Markdown
   */
  toggleMode() {
    if (!this.noteBodyEl || !this.markdownAreaEl) return;

    if (!this.isMarkdownMode) {
      // Switch from Visual to Markdown
      const html = this.noteBodyEl.innerHTML;
      const md = this.htmlToMarkdown(html);
      this.markdownAreaEl.value = md;
      this.noteBodyEl.style.display = 'none';
      this.markdownAreaEl.style.display = 'block';
      this.isMarkdownMode = true;

      if (this.toggleBtnEl) this.toggleBtnEl.classList.add('active');
      if (this.modeLabelEl) this.modeLabelEl.textContent = 'Visual';
      this.markdownAreaEl.focus();
    } else {
      // Switch from Markdown to Visual
      const md = this.markdownAreaEl.value;
      const html = this.markdownToHtml(md);
      this.noteBodyEl.innerHTML = SecurityService.sanitizeHTML(html);
      this.markdownAreaEl.style.display = 'none';
      this.noteBodyEl.style.display = 'block';
      this.isMarkdownMode = false;

      if (this.toggleBtnEl) this.toggleBtnEl.classList.remove('active');
      if (this.modeLabelEl) this.modeLabelEl.textContent = 'Markdown';
      this.noteBodyEl.focus();
    }
    this.updateStats();
  },

  /**
   * Sync active mode back to noteBody before saving
   */
  syncBeforeSave() {
    if (this.isMarkdownMode && this.markdownAreaEl && this.noteBodyEl) {
      const md = this.markdownAreaEl.value;
      const html = this.markdownToHtml(md);
      this.noteBodyEl.innerHTML = SecurityService.sanitizeHTML(html);
    }
  },

  /**
   * Convert Rich HTML to clean Markdown text
   */
  htmlToMarkdown(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Process code blocks
    temp.querySelectorAll('pre.cp-code-block, pre').forEach(pre => {
      const code = pre.querySelector('code')?.innerText || pre.innerText.replace(/^Salin\n/, '');
      const lang = pre.getAttribute('data-lang') || '';
      pre.replaceWith(`\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n`);
    });

    // Process tasks
    temp.querySelectorAll('.cp-task-item').forEach(item => {
      const checked = item.querySelector('input[type="checkbox"]')?.checked;
      const text = item.querySelector('span')?.innerText || item.innerText;
      item.replaceWith(`\n- [${checked ? 'x' : ' '}] ${text.trim()}\n`);
    });

    // Inline code
    temp.querySelectorAll('code, .cp-inline-code').forEach(c => {
      c.replaceWith(`\`${c.innerText}\``);
    });

    // Headings
    temp.querySelectorAll('h1').forEach(h => h.replaceWith(`\n# ${h.innerText.trim()}\n`));
    temp.querySelectorAll('h2').forEach(h => h.replaceWith(`\n## ${h.innerText.trim()}\n`));
    temp.querySelectorAll('h3').forEach(h => h.replaceWith(`\n### ${h.innerText.trim()}\n`));

    // Bold / Italic / Strike
    temp.querySelectorAll('b, strong').forEach(b => b.replaceWith(`**${b.innerText}**`));
    temp.querySelectorAll('i, em').forEach(i => i.replaceWith(`*${i.innerText}*`));
    temp.querySelectorAll('s, strike, del').forEach(s => s.replaceWith(`~~${s.innerText}~~`));

    // Links
    temp.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || '#';
      a.replaceWith(`[${a.innerText}](${href})`);
    });

    // Blockquotes
    temp.querySelectorAll('blockquote').forEach(bq => {
      bq.replaceWith(`\n> ${bq.innerText.trim()}\n`);
    });

    // Lists
    temp.querySelectorAll('li').forEach(li => {
      li.replaceWith(`\n- ${li.innerText.trim()}`);
    });

    // Paragraphs and breaks
    temp.querySelectorAll('p').forEach(p => {
      p.replaceWith(`\n${p.innerText.trim()}\n`);
    });
    temp.querySelectorAll('br').forEach(br => br.replaceWith('\n'));

    // Preserve inline attachments
    temp.querySelectorAll('.cp104-inline-note').forEach(chip => {
      const id = chip.getAttribute('data-att-id') || '';
      const name = chip.innerText.trim();
      chip.replaceWith(` [📎 ${name}](attachment://${id}) `);
    });

    return temp.innerText.replace(/\n{3,}/g, '\n\n').trim();
  },

  /**
   * Convert Markdown to HTML for visual display
   */
  markdownToHtml(md) {
    if (!md) return '';
    let text = md;

    // Code blocks: ```lang ... ```
    text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const cleanLang = (lang || 'code').trim();
      const escaped = SecurityService.escapeHtml(code.trim());
      return `<pre class="cp-code-block" data-lang="${cleanLang}"><div class="cp-code-header"><span>${cleanLang}</span><button type="button" class="cp-code-copy-btn">Salin</button></div><code>${escaped}</code></pre>`;
    });

    // Tasks: - [ ] Task or - [x] Task
    text = text.replace(/^-\s*\[([ xX])\]\s*(.+)$/gm, (match, check, itemText) => {
      const isDone = check.toLowerCase() === 'x';
      return `<div class="cp-task-item${isDone ? ' done' : ''}"><input type="checkbox" class="cp-task-check"${isDone ? ' checked' : ''}><span>${SecurityService.escapeHtml(itemText.trim())}</span></div>`;
    });

    // Headings
    text = text.replace(/^###\s*(.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^##\s*(.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^#\s*(.+)$/gm, '<h1>$1</h1>');

    // Blockquotes
    text = text.replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>');

    // Unordered lists
    text = text.replace(/^[-*]\s+(?!\[[ xX]\])(.+)$/gm, '<ul><li>$1</li></ul>');
    text = text.replace(/<\/ul>\s*<ul>/g, '');

    // Bold, Italic, Strikethrough
    text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    text = text.replace(/\*(.+?)\*/g, '<i>$1</i>');
    text = text.replace(/~~(.+?)~~/g, '<s>$1</s>');

    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code class="cp-inline-code">$1</code>');

    // Links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
      if (href.startsWith('attachment://')) {
        const attId = href.replace('attachment://', '');
        return `<span class="cp104-inline-note" data-att-id="${attId}">${label}</span>`;
      }
      return `<a href="${encodeURI(href)}" target="_blank" rel="noopener">${label}</a>`;
    });

    // Regular line breaks into paragraphs
    const lines = text.split('\n\n');
    return lines.map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|pre|div|blockquote|ul|table)/i.test(block)) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('');
  },

  /**
   * Bind events to noteBody and markdown textarea
   */
  bindEditorEvents() {
    if (!this.noteBodyEl) return;

    // Toggle interactive task checkboxes via event delegation
    this.noteBodyEl.addEventListener('change', (e) => {
      if (e.target && e.target.classList.contains('cp-task-check')) {
        const item = e.target.closest('.cp-task-item');
        if (item) {
          if (e.target.checked) {
            item.classList.add('done');
            item.setAttribute('data-task-done', 'true');
          } else {
            item.classList.remove('done');
            item.removeAttribute('data-task-done');
          }
        }
        this.updateStats();
      }
    });

    // Copy code button inside code blocks
    this.noteBodyEl.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('.cp-code-copy-btn');
      if (copyBtn) {
        e.preventDefault();
        const pre = copyBtn.closest('pre');
        const codeEl = pre?.querySelector('code');
        const codeText = codeEl ? codeEl.innerText : pre.innerText;
        try {
          await navigator.clipboard.writeText(codeText.trim());
          const orig = copyBtn.textContent;
          copyBtn.textContent = '✓ Tersalin!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1600);
        } catch (err) {
          copyBtn.textContent = 'Gagal';
        }
      }
    });

    // Tab key handling for developer indentation (2 spaces) in both visual and markdown
    this.noteBodyEl.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        EditorService.insertHtmlAtCursor(this.noteBodyEl, '&nbsp;&nbsp;');
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById('saveBtn')?.click();
      } else if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.insertInlineCode();
      } else if (e.key === 'L' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        this.insertTaskItem();
      } else if (e.key === 'C' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        this.insertCodeBlock();
      } else if (e.key === 'm' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.toggleMode();
      } else if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.openShortcutsModal();
      }
    });

    if (this.markdownAreaEl) {
      this.markdownAreaEl.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = this.markdownAreaEl.selectionStart;
          const end = this.markdownAreaEl.selectionEnd;
          const val = this.markdownAreaEl.value;
          this.markdownAreaEl.value = val.substring(0, start) + '  ' + val.substring(end);
          this.markdownAreaEl.selectionStart = this.markdownAreaEl.selectionEnd = start + 2;
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          document.getElementById('saveBtn')?.click();
        } else if (e.key === 'm' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.toggleMode();
        }
      });
    }

    if (this.toggleBtnEl) {
      this.toggleBtnEl.onclick = () => this.toggleMode();
    }
  },

  /**
   * Insert developer interactive elements
   */
  insertTaskItem() {
    if (this.isMarkdownMode) {
      this.insertAtMarkdownCaret('\n- [ ] Task baru\n');
      return;
    }
    const taskHTML = `<div class="cp-task-item"><input type="checkbox" class="cp-task-check"><span>Task baru</span></div><p><br></p>`;
    EditorService.insertHtmlAtCursor(this.noteBodyEl, taskHTML);
    this.updateStats();
  },

  insertInlineCode() {
    if (this.isMarkdownMode) {
      this.wrapMarkdownSelection('`', '`', 'kode');
      return;
    }
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';
    const codeContent = selectedText || 'kode';
    const html = `<code class="cp-inline-code">${SecurityService.escapeHtml(codeContent)}</code>&nbsp;`;
    EditorService.insertHtmlAtCursor(this.noteBodyEl, html);
    this.updateStats();
  },

  insertCodeBlock() {
    const lang = prompt('Bahasa kode (contoh: js, python, sql, bash, html):', 'javascript') || 'code';
    if (this.isMarkdownMode) {
      this.insertAtMarkdownCaret(`\n\`\`\`${lang.trim()}\n// Tulis atau tempel kode di sini\n\`\`\`\n`);
      return;
    }
    const html = `
      <pre class="cp-code-block" data-lang="${SecurityService.escapeHtml(lang.trim())}">
        <div class="cp-code-header">
          <span>${SecurityService.escapeHtml(lang.trim())}</span>
          <button type="button" class="cp-code-copy-btn">Salin</button>
        </div><code>// Tulis atau tempel kode di sini</code>
      </pre><p><br></p>
    `;
    EditorService.insertHtmlAtCursor(this.noteBodyEl, html);
    this.updateStats();
  },

  insertQuote() {
    if (this.isMarkdownMode) {
      this.insertAtMarkdownCaret('\n> Kutipan penting di sini\n');
      return;
    }
    const html = `<blockquote>Kutipan penting di sini</blockquote><p><br></p>`;
    EditorService.insertHtmlAtCursor(this.noteBodyEl, html);
    this.updateStats();
  },

  insertLink() {
    const url = prompt('Masukkan URL tautan:', 'https://');
    if (!url) return;
    const text = prompt('Teks label tautan (opsional):', url) || url;
    if (this.isMarkdownMode) {
      this.insertAtMarkdownCaret(`[${text}](${url})`);
      return;
    }
    const safeUrl = SecurityService.escapeHtml(url.trim());
    const safeText = SecurityService.escapeHtml(text.trim());
    const html = `<a href="${safeUrl}" target="_blank" rel="noopener">${safeText}</a>&nbsp;`;
    EditorService.insertHtmlAtCursor(this.noteBodyEl, html);
    this.updateStats();
  },

  insertHeading(tag = 'h2') {
    if (this.isMarkdownMode) {
      const prefix = tag === 'h1' ? '# ' : '## ';
      this.insertAtMarkdownCaret(`\n${prefix}Judul Bagian\n`);
      return;
    }
    document.execCommand('formatBlock', false, `<${tag}>`);
    this.noteBodyEl.focus();
    this.updateStats();
  },

  insertAtMarkdownCaret(text) {
    if (!this.markdownAreaEl) return;
    const start = this.markdownAreaEl.selectionStart;
    const end = this.markdownAreaEl.selectionEnd;
    const val = this.markdownAreaEl.value;
    this.markdownAreaEl.value = val.substring(0, start) + text + val.substring(end);
    this.markdownAreaEl.selectionStart = this.markdownAreaEl.selectionEnd = start + text.length;
    this.markdownAreaEl.focus();
    this.updateStats();
  },

  wrapMarkdownSelection(prefix, suffix, defaultText = '') {
    if (!this.markdownAreaEl) return;
    const start = this.markdownAreaEl.selectionStart;
    const end = this.markdownAreaEl.selectionEnd;
    const val = this.markdownAreaEl.value;
    const selected = val.substring(start, end) || defaultText;
    const wrapped = prefix + selected + suffix;
    this.markdownAreaEl.value = val.substring(0, start) + wrapped + val.substring(end);
    this.markdownAreaEl.selectionStart = start + prefix.length;
    this.markdownAreaEl.selectionEnd = start + prefix.length + selected.length;
    this.markdownAreaEl.focus();
    this.updateStats();
  },

  /**
   * Bind toolbar buttons
   */
  bindToolbarExtras() {
    document.getElementById('headingH1Btn')?.addEventListener('click', () => this.insertHeading('h1'));
    document.getElementById('headingH2Btn')?.addEventListener('click', () => this.insertHeading('h2'));
    document.getElementById('insertTaskBtn')?.addEventListener('click', () => this.insertTaskItem());
    document.getElementById('insertInlineCodeBtn')?.addEventListener('click', () => this.insertInlineCode());
    document.getElementById('insertCodeBlockBtn')?.addEventListener('click', () => this.insertCodeBlock());
    document.getElementById('insertQuoteBtn')?.addEventListener('click', () => this.insertQuote());
    document.getElementById('insertLinkBtn')?.addEventListener('click', () => this.insertLink());

    // Copy Markdown button
    document.getElementById('copyMarkdownBtn')?.addEventListener('click', async () => {
      const content = this.isMarkdownMode ? this.markdownAreaEl.value : this.htmlToMarkdown(this.noteBodyEl.innerHTML);
      try {
        await navigator.clipboard.writeText(content);
        const btn = document.getElementById('copyMarkdownBtn');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = '✓ Tersalin!';
          setTimeout(() => { btn.textContent = orig; }, 1600);
        }
      } catch (err) {
        alert('Gagal menyalin ke clipboard.');
      }
    });

    // Clean formatting
    document.getElementById('cleanFormatBtn')?.addEventListener('click', () => {
      if (this.isMarkdownMode) {
        this.markdownAreaEl.value = this.markdownAreaEl.value.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
      } else {
        // Clean empty paragraphs and excess breaks
        this.noteBodyEl.querySelectorAll('p:empty, div:empty').forEach(el => el.remove());
        const html = this.noteBodyEl.innerHTML.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
        this.noteBodyEl.innerHTML = SecurityService.sanitizeHTML(html);
      }
      this.updateStats();
    });
  },

  /**
   * Bind Collapsible Drawers (Reminder, Finance, Attachments)
   */
  bindDrawers() {
    const reminderBtn = document.getElementById('drawerReminderBtn');
    const financeBtn = document.getElementById('drawerFinanceBtn');
    const attachBtn = document.getElementById('drawerAttachBtn');

    const reminderPanel = document.getElementById('drawerReminderPanel');
    const financePanel = document.getElementById('drawerFinancePanel');
    const attachPanel = document.getElementById('drawerAttachPanel');

    const toggleDrawer = (btn, panel) => {
      if (!panel) return;
      const isOpen = panel.style.display !== 'none';
      // Close other panels for minimal distraction
      [reminderPanel, financePanel, attachPanel].forEach(p => { if (p) p.style.display = 'none'; });
      [reminderBtn, financeBtn, attachBtn].forEach(b => { if (b) b.classList.remove('active'); });

      if (!isOpen) {
        panel.style.display = 'block';
        btn.classList.add('active');
      }
    };

    reminderBtn?.addEventListener('click', () => toggleDrawer(reminderBtn, reminderPanel));
    financeBtn?.addEventListener('click', () => toggleDrawer(financeBtn, financePanel));
    attachBtn?.addEventListener('click', () => toggleDrawer(attachBtn, attachPanel));

    // When category changes, highlight finance if keuangan
    document.getElementById('categorySelect')?.addEventListener('change', (e) => {
      if (e.target.value === 'keuangan') {
        const finDot = document.getElementById('financeDot');
        if (finDot) finDot.style.display = 'inline';
        if (financePanel && financePanel.style.display === 'none') {
          toggleDrawer(financeBtn, financePanel);
        }
      }
    });

    // When reminder input changes, update reminder indicator dot
    document.getElementById('noteReminderInput')?.addEventListener('change', (e) => {
      const dot = document.getElementById('reminderDot');
      if (dot) dot.style.display = e.target.value ? 'inline' : 'none';
    });
  },

  /**
   * Update drawer indicators based on current note content
   */
  updateDrawerStatus(attachments = []) {
    const reminderInput = document.getElementById('noteReminderInput');
    const reminderDot = document.getElementById('reminderDot');
    const reminderPanel = document.getElementById('drawerReminderPanel');
    const reminderBtn = document.getElementById('drawerReminderBtn');

    if (reminderInput && reminderInput.value) {
      if (reminderDot) reminderDot.style.display = 'inline';
      if (reminderPanel) reminderPanel.style.display = 'block';
      if (reminderBtn) reminderBtn.classList.add('active');
    } else {
      if (reminderDot) reminderDot.style.display = 'none';
      if (reminderPanel) reminderPanel.style.display = 'none';
      if (reminderBtn) reminderBtn.classList.remove('active');
    }

    const catSelect = document.getElementById('categorySelect');
    const financeDot = document.getElementById('financeDot');
    const financePanel = document.getElementById('drawerFinancePanel');
    const financeBtn = document.getElementById('drawerFinanceBtn');

    if (catSelect && catSelect.value === 'keuangan') {
      if (financeDot) financeDot.style.display = 'inline';
      if (financePanel) financePanel.style.display = 'block';
      if (financeBtn) financeBtn.classList.add('active');
    } else {
      if (financeDot) financeDot.style.display = 'none';
      if (financePanel) financePanel.style.display = 'none';
      if (financeBtn) financeBtn.classList.remove('active');
    }

    // Attachments count
    const attachBadge = document.getElementById('attachCountBadge');
    if (attachBadge) {
      attachBadge.textContent = attachments.length;
    }
    const attachPanel = document.getElementById('drawerAttachPanel');
    const attachBtn = document.getElementById('drawerAttachBtn');
    if (attachments.length > 0) {
      if (attachPanel) attachPanel.style.display = 'block';
      if (attachBtn) attachBtn.classList.add('active');
    } else {
      if (attachPanel) attachPanel.style.display = 'none';
      if (attachBtn) attachBtn.classList.remove('active');
    }
  },

  /**
   * Keyboard Shortcuts Cheatsheet Modal
   */
  bindShortcutsModal() {
    const helpBtn = document.getElementById('shortcutHelpBtn');
    const overlay = document.getElementById('shortcutOverlay');
    const closeBtn = document.getElementById('closeShortcutBtn');
    const okBtn = document.getElementById('shortcutOkBtn');

    const open = () => { if (overlay) overlay.style.display = 'flex'; };
    const close = () => { if (overlay) overlay.style.display = 'none'; };

    helpBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    okBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  },

  openShortcutsModal() {
    const overlay = document.getElementById('shortcutOverlay');
    if (overlay) overlay.style.display = 'flex';
  },

  /**
   * Live word, character, line count and read-time
   */
  bindLiveStats() {
    const update = () => this.updateStats();
    this.noteBodyEl?.addEventListener('input', update);
    this.markdownAreaEl?.addEventListener('input', update);
  },

  updateStats() {
    const rawText = this.isMarkdownMode ? (this.markdownAreaEl?.value || '') : (this.noteBodyEl?.innerText || '');
    const cleanText = rawText.trim();

    const charCount = cleanText.length;
    const words = cleanText ? cleanText.split(/\s+/).filter(Boolean) : [];
    const wordCount = words.length;
    const lines = cleanText ? cleanText.split('\n').length : 0;
    const minutes = Math.ceil(wordCount / 200) || 0;

    const wordEl = document.getElementById('statWordCount');
    const charEl = document.getElementById('statCharCount');
    const lineEl = document.getElementById('statLineCount');
    const readEl = document.getElementById('editorReadTime');

    if (wordEl) wordEl.innerHTML = `<b>${wordCount}</b> kata`;
    if (charEl) charEl.innerHTML = `<b>${charCount}</b> karakter`;
    if (lineEl) lineEl.innerHTML = `<b>${lines}</b> baris`;
    if (readEl) readEl.textContent = `~${minutes} mnt baca`;
  }
};
