/**
 * Security & Sanitization Service (XSS Prevention)
 * Pure client-side HTML sanitization and safe string manipulation.
 */

export const SecurityService = {
  /**
   * Escape standard HTML special characters.
   */
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },

  /**
   * Sanitize HTML string to eliminate dangerous tags, scripts, and attributes
   * before inserting into the DOM or rendering previews.
   */
  sanitizeHTML(html) {
    if (!html) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(String(html), 'text/html');
      const allowedTags = new Set([
        'P','BR','DIV','SPAN','B','STRONG','I','EM','U','S','DEL','MARK',
        'UL','OL','LI','BLOCKQUOTE','PRE','CODE','TABLE','THEAD','TBODY',
        'TFOOT','TR','TH','TD','HR','H1','H2','H3','H4','H5','H6','IMG'
      ]);
      const allowedAttrs = new Set(['class','title','alt','width','height','colspan','rowspan','src']);
      const nodes = Array.from(doc.body.querySelectorAll('*'));

      for (const node of nodes) {
        if (!allowedTags.has(node.tagName)) {
          node.replaceWith(...Array.from(node.childNodes));
          continue;
        }

        for (const attr of Array.from(node.attributes)) {
          const name = attr.name.toLowerCase();
          const value = String(attr.value || '').trim();
          const lower = value.toLowerCase();

          if (name.startsWith('on') || !allowedAttrs.has(name)) {
            node.removeAttribute(attr.name);
            continue;
          }

          if (name === 'src') {
            // Notes must never cause arbitrary network requests. Only embedded
            // image data is allowed. SVG is deliberately excluded.
            if (!/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(value)) {
              node.removeAttribute(attr.name);
            }
          }

          if (name === 'class' && /(?:url\(|expression\(|javascript:)/i.test(value)) {
            node.removeAttribute(attr.name);
          }
        }
      }

      return doc.body.innerHTML;
    } catch (e) {
      console.warn('HTML Sanitization fallback:', e);
      return SecurityService.escapeHtml(html);
    }
  },

  /**
   * Strip all HTML tags to get pure plain text.
   */
  stripHtml(html) {
    if (!html) return '';
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.textContent || d.innerText || '';
  },

  /**
   * Sanitize file names for safe export and archiving.
   */
  sanitizeFileName(name) {
    let safe = String(name || 'file')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/[\u0000-\u001f]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+$/, '')
      .slice(0, 80);
    if (!safe) safe = 'file';
    if (/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(safe)) safe = `_${safe}`;
    return safe;
  }
};
