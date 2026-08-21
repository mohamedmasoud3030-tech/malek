import { registerSW } from 'virtual:pwa-register';

export type PwaUpdateHandler = (applyUpdate: () => Promise<void>) => Promise<void> | void;

let registrationStarted = false;

/**
 * Registers the production service worker once and asks the operator before
 * activating a waiting update. Development intentionally does not emulate a
 * production service worker.
 */
export function registerPwaUpdateLifecycle(onNeedRefresh: PwaUpdateHandler): void {
  if (!import.meta.env.PROD || registrationStarted) return;
  registrationStarted = true;

  let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      void onNeedRefresh(async () => {
        if (updateServiceWorker) await updateServiceWorker(true);
      });
    },
    onRegisterError(error) {
      console.error('PWA service worker registration failed.', error);
    },
  });
}
