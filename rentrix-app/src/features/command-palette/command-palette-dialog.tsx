/**
 * The global command/search surface was retired from the product chrome.
 * Navigation now lives in the compact mobile menu and workspace-local search
 * stays inside each operational register where its context is explicit.
 *
 * Keep this no-op export temporarily so existing shell imports remain source
 * compatible while the surrounding command infrastructure is cleaned up in a
 * later repository-only pass.
 */
export function CommandPaletteDialog() {
  return null;
}

export default CommandPaletteDialog;
