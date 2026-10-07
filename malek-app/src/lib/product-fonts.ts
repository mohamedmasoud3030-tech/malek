const PRODUCT_FONTS_ID = 'malek-product-fonts';

/**
 * Self-hosted product fonts (Cairo + Sora) — OD-12.
 *
 * The stylesheet is local (`public/fonts/fonts.css`), so the PWA precaches the
 * woff2 files and the app keeps its full Arabic-first typography offline.
 * Injection stays deferred until window load so first paint never blocks on
 * the font stylesheet; `font-display: swap` in fonts.css covers the swap-in.
 */
export function productFontsHref(baseUrl: string = import.meta.env.BASE_URL): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}fonts/fonts.css`;
}

export function installProductFonts(doc: Document = document): void {
  if (doc.getElementById(PRODUCT_FONTS_ID)) return;
  const stylesheet = doc.createElement('link');
  stylesheet.id = PRODUCT_FONTS_ID;
  stylesheet.rel = 'stylesheet';
  stylesheet.href = productFontsHref();
  doc.head.appendChild(stylesheet);
}

/** Deferred bootstrap used by the app entry point. */
export function loadProductFonts(win: Window = window): void {
  const install = () => installProductFonts(win.document);
  if (win.document.readyState === 'complete') {
    install();
    return;
  }
  win.addEventListener('load', install, { once: true });
}
