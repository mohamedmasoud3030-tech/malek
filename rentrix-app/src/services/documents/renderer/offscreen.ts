/**
 * Offscreen DOM helpers for the PDF render path.
 *
 * Contract:
 *  - containers are tagged (`data-document-render-root`) and ALWAYS removed
 *    by callers in `finally`, on success and on failure alike — nothing is
 *    left in the DOM after a failed render;
 *  - font waits never hang forever (bounded by a timeout; on slow networks
 *    rendering continues with the approved Arabic fallback stack rather
 *    than freezing the action);
 *  - a broken logo/image never blocks the rest of the document.
 */

/** Max time we wait for web fonts before degrading to the fallback stack. */
export const FONT_WAIT_TIMEOUT_MS = 8000;

/** Max time we wait for a stalled image before degrading (skip its pixels). */
export const IMAGE_WAIT_TIMEOUT_MS = 8000;

/** Max time we wait for the print popup to become ready before failing. */
export const POPUP_READY_TIMEOUT_MS = 10000;

export const RENDER_ROOT_ATTRIBUTE = 'data-document-render-root';

const timeout = (ms: number) => new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms));

const nextFrame = (): Promise<void> =>
  new Promise((resolve) =>
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      : setTimeout(() => resolve(), 0),
  );

export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Waits for a document's FontFaceSet to finish loading. A rejection from
 * the Font Loading API surfaces as a thrown error to the caller; a slow
 * load degrades gracefully instead of hanging the print/PDF action.
 */
export async function waitForFontsReady(targetDocument: Document | undefined): Promise<'ready' | 'timeout' | 'unavailable'> {
  const fonts = targetDocument?.fonts;
  if (!fonts || typeof fonts.ready?.then !== 'function') return 'unavailable';
  const result = await Promise.race([fonts.ready.then(() => 'ready' as const), timeout(FONT_WAIT_TIMEOUT_MS)]);
  return result;
}

/**
 * Waits for every `<img>` inside a root to finish loading (or fail),
 * bounded per image so a stalled logo can never hang the print/PDF action
 * forever — after the timeout the document proceeds without those pixels.
 */
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

/**
 * Creates the offscreen measurement container. Body-fragment HTML only —
 * never a full document with `<style>`/`<link>` tags (those would leak
 * into the live app DOM while rendering).
 */
export function createOffscreenContainer(bodyFragmentHtml: string): HTMLDivElement {
  const container = document.createElement('div');
  container.setAttribute(RENDER_ROOT_ATTRIBUTE, '');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width at 96dpi
  container.style.direction = 'rtl';
  container.style.background = '#FFFFFF';
  container.style.fontFamily = '"Cairo", "Segoe UI", Tahoma, sans-serif';
  container.style.color = '#0F172A';
  container.style.lineHeight = '1.6';
  container.style.fontSize = '12px';
  container.innerHTML = bodyFragmentHtml;
  document.body.appendChild(container);
  return container;
}

/** Removes every leftover render container (defensive cleanup). */
export function removeAllRenderContainers(): void {
  document.querySelectorAll(`[${RENDER_ROOT_ATTRIBUTE}]`).forEach((element) => element.remove());
}
