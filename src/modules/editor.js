/**
 * Editor & DOM Selection Utility
 * Implements modern Selection and Range API replacements for deprecated document.execCommand('insertText', ...)
 * and handles precise caret management for both contenteditable and input/textarea elements.
 */

export const EditorService = {

  /**
   * Creates a DOM bookmark at the current caret. Unlike a cloned Range, the
   * bookmark survives Android/WebView file pickers and modal focus changes.
   */
  createInsertionMarker(targetElement) {
    if (!targetElement) return null;
    const sel = window.getSelection();
    let range = null;
    if (sel && sel.rangeCount) {
      const candidate = sel.getRangeAt(0);
      if (targetElement.contains(candidate.commonAncestorContainer)) range = candidate.cloneRange();
    }
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(targetElement);
      range.collapse(false);
    }
    range.deleteContents();
    const id = `cp104_caret_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const marker = document.createElement('span');
    marker.setAttribute('data-cp104-caret', id);
    marker.setAttribute('contenteditable', 'false');
    marker.textContent = '\u200b';
    range.insertNode(marker);
    const after = document.createRange();
    after.setStartAfter(marker); after.collapse(true);
    if (sel) { sel.removeAllRanges(); sel.addRange(after); }
    this._savedMarker = { target: targetElement, id };
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    return id;
  },

  /** Insert HTML exactly where createInsertionMarker() placed the bookmark. */
  insertHtmlAtMarker(targetElement, markerId, htmlString) {
    if (!targetElement || !markerId) return false;
    const marker = targetElement.querySelector(`[data-cp104-caret="${String(markerId).replace(/"/g, "")}"]`);
    if (!marker) return false;
    const template = document.createElement('template');
    template.innerHTML = String(htmlString || '').trim();
    const fragment = template.content;
    const lastNode = fragment.lastChild;
    marker.replaceWith(fragment);
    if (lastNode) {
      const range = document.createRange();
      range.setStartAfter(lastNode); range.collapse(true);
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    }
    this._savedMarker = null;
    targetElement.focus();
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  },

  removeInsertionMarker(targetElement, markerId) {
    if (!targetElement || !markerId) return;
    const marker = targetElement.querySelector(`[data-cp104-caret="${String(markerId).replace(/"/g, "")}"]`);
    if (marker) marker.remove();
    if (this._savedMarker?.id === markerId) this._savedMarker = null;
  },

  clearInsertionMarker() {
    const saved = this._savedMarker;
    if (saved?.target && saved.id) this.removeInsertionMarker(saved.target, saved.id);
  },

  /** Save the current contenteditable selection so a file picker or modal can open without losing the caret. */
  captureSelection(targetElement) {
    if (!targetElement) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!targetElement.contains(range.commonAncestorContainer)) return null;
    const saved = range.cloneRange();
    this._savedSelection = { target: targetElement, range: saved };
    return saved;
  },

  restoreSelection(targetElement) {
    const saved = this._savedSelection;
    if (!saved || saved.target !== targetElement) return false;
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(saved.range);
      targetElement.focus();
      return true;
    } catch (e) {
      return false;
    }
  },
  /**
   * Insert text at current cursor/selection position.
   * Uses modern Selection/Range API for contenteditable elements and
   * string concatenation via selectionStart/selectionEnd for input/textarea.
   */
  insertTextAtCursor(targetElement, text) {
    if (!targetElement) return;

    // 1. Input or Textarea elements
    if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
      const start = targetElement.selectionStart !== null && targetElement.selectionStart !== undefined
        ? targetElement.selectionStart
        : targetElement.value.length;
      const end = targetElement.selectionEnd !== null && targetElement.selectionEnd !== undefined
        ? targetElement.selectionEnd
        : targetElement.value.length;

      const currentValue = targetElement.value;
      targetElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);

      const nextPos = start + text.length;
      targetElement.selectionStart = nextPos;
      targetElement.selectionEnd = nextPos;
      targetElement.focus();
      targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    // 2. Regular or contenteditable text elements
    targetElement.focus();
    this.restoreSelection(targetElement);
    const sel = window.getSelection();
    if (!sel) return;

    let range;
    if (sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
      // Ensure the range is contained inside targetElement
      if (!targetElement.contains(range.commonAncestorContainer)) {
        range = document.createRange();
        range.selectNodeContents(targetElement);
        range.collapse(false);
      }
    } else {
      range = document.createRange();
      range.selectNodeContents(targetElement);
      range.collapse(false);
    }

    // Delete any active selections
    range.deleteContents();

    // Insert new text node using modern Range API
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    // Reposition cursor immediately after the newly inserted text node
    const newRange = document.createRange();
    newRange.setStartAfter(textNode);
    newRange.setEndAfter(textNode);
    sel.removeAllRanges();
    sel.addRange(newRange);

    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
  },

  /**
   * Insert HTML fragment at current selection within contenteditable container.
   */
  insertHtmlAtCursor(targetElement, htmlString) {
    if (!targetElement) return;
    targetElement.focus();
    this.restoreSelection(targetElement);

    const sel = window.getSelection();
    if (!sel) return;

    let range;
    if (sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
      if (!targetElement.contains(range.commonAncestorContainer)) {
        range = document.createRange();
        range.selectNodeContents(targetElement);
        range.collapse(false);
      }
    } else {
      range = document.createRange();
      range.selectNodeContents(targetElement);
      range.collapse(false);
    }

    range.deleteContents();

    const template = document.createElement('template');
    template.innerHTML = htmlString.trim();
    const fragment = template.content;
    const lastNode = fragment.lastChild;

    range.insertNode(fragment);

    if (lastNode) {
      const newRange = document.createRange();
      newRange.setStartAfter(lastNode);
      newRange.setEndAfter(lastNode);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
  }
};
