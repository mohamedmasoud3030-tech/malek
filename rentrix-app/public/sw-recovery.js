/*
 * One-time recovery for clients controlled by the previous MALEK service worker.
 *
 * That worker could serve offline.html for every navigation, which prevented the
 * React app from mounting and therefore prevented the normal prompt-based update
 * flow from activating a corrected worker.
 *
 * If an older worker is active and this recovery has never run, activate the new
 * worker immediately. Activation stores a marker, so subsequent updates return to
 * the normal explicit prompt flow defined in src/lib/pwa-update.ts.
 */

const RECOVERY_CACHE = "malek-pwa-recovery-v1";
const RECOVERY_MARKER = "/__malek_pwa_recovery_v1__";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const hasActiveWorker = Boolean(self.registration.active);
      if (!hasActiveWorker) return;

      const cache = await caches.open(RECOVERY_CACHE);
      const alreadyRecovered = await cache.match(RECOVERY_MARKER);
      if (alreadyRecovered) return;

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(RECOVERY_CACHE);
      await cache.put(
        RECOVERY_MARKER,
        new Response("recovered", {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
      );

      await self.clients.claim();
    })(),
  );
});
