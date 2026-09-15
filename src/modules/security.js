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
      const doc = parser.parseFromString(html, 'text/html');

      // Tags that must be stripped completely
      const forbiddenTags = [
        'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'STYLE',
        'LINK', 'META', 'BASE', 'APPLET', 'FRAME', 'FRAMESET'
      ];

      function cleanNode(node) {
        if (!node) return;
        if (forbiddenTags.includes(node.nodeName)) {
          if (node.parentNode) node.parentNode.removeChild(node);
          return;
        }

        // Clean attributes on element nodes
        if (node.nodeType === Node.ELEMENT_NODE && node.attributes) {
          for (let i = node.attributes.length - 1; i >= 0; i--) {
            const attr = node.attributes[i];
            const attrName = attr.name.toLowerCase();
            const attrVal = (attr.value || '').toLowerCase().trim();

            // Disallow any inline JavaScript event handlers (onclick, onerror, onload, etc.)
            if (attrName.startsWith('on')) {
              node.removeAttribute(attr.name);
              continue;
            }

            // Disallow javascript: or data: URIs in resource/link attributes (except safe data:image/)
            if (['src', 'href', 'action', 'data', 'xlink:href'].includes(attrName)) {
              if (
                attrVal.startsWith('javascript:') ||
                attrVal.startsWith('vbscript:') ||
                (attrVal.startsWith('data:') && !attrVal.startsWith('data:image/'))
              ) {
                node.removeAttribute(attr.name);
              }
            }
          }
        }

        // Recursively clean children
        const children = Array.from(node.childNodes);
        children.forEach(cleanNode);
      }

      cleanNode(doc.body);
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
    return String(name || 'file')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'file';
  }
};
