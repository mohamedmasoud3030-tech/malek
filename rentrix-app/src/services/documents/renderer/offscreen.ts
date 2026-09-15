/**
 * Print-popup asset helpers.
 *
 * The raster PDF pipeline (offscreen measurement containers, shell capture)
 * is gone — the PDF emitter is vector (@react-pdf/renderer) and the print
 * emitter lets the browser paginate. What remains here is only what the
 * PRINT popup needs:
 *  - font waits never hang forever (bounded by a timeout; on slow networks
 *    printing continues with the approved Arabic fallback stack);
 *  - a broken logo/image never blocks the rest of the document.
 */

/** Max time we wait for web fonts before degrading to the fallback stack. */
export const FONT_WAIT_TIMEOUT_MS = 8000;

/** Max time we wait for a stalled image before degrading (skip its pixels). */
export const IMAGE_WAIT_TIMEOUT_MS = 8000;

/** Max time we wait for the print popup to become ready before failing. */
export const POPUP_READY_TIMEOUT_MS = 10000;

const timeout = (ms: number) => new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms));

const nextFrame = (): Promise<void> =>
  new Promise((resolve) =>
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      : setTimeout(() => resolve(), 0),
  );

/**
 * Waits for a document's FontFaceSet to finish loading. A rejection from
 * the Font Loading API surfaces as a thrown error to the caller; a slow
 * load degrades gracefully instead of hanging the print action.
 */
export async function waitForFontsReady(targetDocument: Document | undefined): Promise<'ready' | 'timeout' | 'unavailable'> {
  const fonts = targetDocument?.fonts;
  if (!fonts || typeof fonts.ready?.then !== 'function') return 'unavailable';
  return Promise.race([fonts.ready.then(() => 'ready' as const), timeout(FONT_WAIT_TIMEOUT_MS)]);
}

/** Waits for every `<img>` inside a root to finish loading (or fail),
 * bounded per image so a stalled logo can never hang the print action
 * forever — after the timeout the document proceeds without those pixels. */
export async function waitForImages(root: ParentNode): Promise<void> {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const timer = setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS);
          const finish = () => {
            clearTimeout(timer);
            resolve();
          };
          img.addEventListener('load', finish, { once: true });
          // A broken logo/image must not block the whole document.
          img.addEventListener('error', finish, { once: true });
        }),
    ),
  );
}

/** Resolves when layout had a chance to settle after fonts/images. */
export const settleLayout = nextFrame;
