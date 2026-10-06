/**
 * Low-level HTML rendering primitives shared by document renderers.
 *
 * This module must stay dependency-free so specialized renderers can use it
 * without depending on the document composition layer.
 */
export const escapeDocumentHtml = (value: string | null | undefined): string =>
  (value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
