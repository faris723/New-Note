/**
 * Editor & DOM Selection Utility
 * Implements modern Selection and Range API replacements for deprecated document.execCommand('insertText', ...)
 * and handles precise caret management for both contenteditable and input/textarea elements.
 */

export const EditorService = {

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
