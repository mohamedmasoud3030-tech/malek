/**
 * Interaction guard shared by every menu that unmounts itself when an item is
 * activated (`ActionMenu`, the mobile quick-add sheet).
 *
 * Dismissing synchronously hands the second click of a double-click — or a
 * double-tap, which is what a phone user produces when a menu appears under
 * their thumb — to whatever the panel was covering. On the invoice register
 * that is the card underneath, so the follow-up tap fires an unrelated
 * operation (open quick view, collect payment) the customer never chose.
 *
 * The browser marks the follow-up as part of the same click sequence
 * (`detail >= 2`), so exactly that one click is swallowed and every deliberate
 * later click passes through untouched.
 */

/** Time the guard stays armed; generous enough for a slow double-tap. */
const DOUBLE_CLICK_WINDOW_MS = 600;

export function shieldDoubleClickFollowUp(): void {
  if (typeof document === 'undefined') return;

  const onClickCapture = (event: MouseEvent) => {
    document.removeEventListener('click', onClickCapture, true);
    window.clearTimeout(expiry);
    if (event.detail >= 2) {
      event.stopPropagation();
      event.preventDefault();
    }
  };
  const expiry = window.setTimeout(
    () => document.removeEventListener('click', onClickCapture, true),
    DOUBLE_CLICK_WINDOW_MS,
  );
  document.addEventListener('click', onClickCapture, true);
}
