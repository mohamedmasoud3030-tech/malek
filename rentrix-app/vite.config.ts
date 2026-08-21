import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;

if (rawPort && (Number.isNaN(port) || port <= 0)) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";

const PLACEHOLDER_URLS = new Set([
  "https://example.supabase.co",
  "https://invalid.supabase.local",
]);
const PLACEHOLDER_KEYS = new Set(["test-anon-key", "invalid-anon-key"]);

function isPlaceholderEnv(
  url: string | undefined,
  key: string | undefined,
): { isPlaceholder: boolean; reason?: string } {
  if (!url || !key) {
    return {
      isPlaceholder: true,
      reason: "VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY مفقود",
    };
  }

  const normalizedUrl = url.trim();
  const normalizedKey = key.trim();
  if (PLACEHOLDER_URLS.has(normalizedUrl)) {
    return {
      isPlaceholder: true,
      reason: `VITE_SUPABASE_URL يستخدم قيمة وهمية: ${url}`,
    };
  }
  if (PLACEHOLDER_KEYS.has(normalizedKey)) {
    return {
      isPlaceholder: true,
      reason: `VITE_SUPABASE_ANON_KEY يستخدم قيمة وهمية: ${key}`,
    };
  }
  if (
    normalizedUrl.includes("example.supabase.co") ||
    normalizedUrl.includes("invalid.supabase.local")
  ) {
    return {
      isPlaceholder: true,
      reason: `VITE_SUPABASE_URL يحتوي على نطاق وهمي: ${url}`,
    };
  }
  return { isPlaceholder: false };
}

function productionEnvGuardPlugin() {
  return {
    name: "rentrix-production-env-guard",
    configResolved(config: any) {
      const isTest =
        process.env.VITEST === "true" ||
        config.mode === "test" ||
        process.env.NODE_ENV === "test";
      const isProdBuild =
        config.command === "build" && config.mode === "production";
      const isVercel = Boolean(
        process.env.VERCEL || process.env.VERCEL_ENV === "production",
      );
      const isEnforced = process.env.VITE_ENFORCE_PROD_ENV === "true";

      if (isTest) return;

      if (isProdBuild) {
        const url = process.env.VITE_SUPABASE_URL;
        const key = process.env.VITE_SUPABASE_ANON_KEY;
        const check = isPlaceholderEnv(url, key);

        if (check.isPlaceholder) {
          if (isVercel || isEnforced) {
            throw new Error(
              `\n\n=== فشل بناء الإنتاج: متغيرات Supabase وهمية ===\n${check.reason}\n\n` +
                `يمنع بناء نسخة Production باستخدام قيم Placeholder.\n` +
                `الحلول:\n` +
                `1. اضبط متغيرات بيئة حقيقية في Vercel/ production .env\n` +
                `2. للإختبارات المحلية استخدم VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY الحقيقية أو اترك الاختبارات تستخدم القيم التجريبية عبر VITEST=true\n` +
                `3. لا تستخدم https://example.supabase.co أو https://invalid.supabase.local في الإنتاج\n\n` +
                `القيم الحالية:\n` +
                `VITE_SUPABASE_URL=${url || "(مفقود)"}\n` +
                `VITE_SUPABASE_ANON_KEY=${key ? `${key.slice(0, 10)}...` : "(مفقود)"}\n`,
            );
          }

          console.warn(
            `\n[rentrix-env-guard] تحذير: بناء الإنتاج يستخدم قيم Supabase وهمية: ${check.reason}\n` +
              `هذا مسموح في CI/التطوير المحلي لكن سيفشل في Vercel production. اضبط متغيرات حقيقية قبل الإطلاق.\n`,
          );
        }
      }
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    productionEnvGuardPlugin(),
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "prompt",
      // Registration is owned by src/lib/pwa-update.ts so updates can wait
      // for an explicit user action instead of replacing an active workflow.
      injectRegister: false,
      manifest: false,
      // Keep MALEK's launch and offline identity available with the app shell.
      // Do not also list offline/brand assets here: workbox.globPatterns already
      // precaches them. includeAssets + globPatterns would emit duplicate SW entries.
      includeAssets: [],
      workbox: {
        // Measured production build on 2026-08-17 (Vite 7.3.2): a catch-all
        // asset glob precached 335 entries / 5558 KiB, including every lazy
        // JS chunk (DocumentRenderer 651 kB, html2canvas 201 kB) and landing
        // PNG screenshots. The app is online-first (Supabase). Precache only
        // the install shell. Runtime StaleWhileRevalidate caches only public
        // static assets after the first visit; Supabase and private data are
        // intentionally excluded from all Workbox runtime caches.
        globPatterns: [
          "offline.html",
          "manifest.json",
          "assets/*.css",
          "fonts/**/*.{css,woff2}",
          "malek-*.svg",
          "malek-icon-*.png",
          "malek-maskable-*.png",
          "malek-apple-touch-180.png",
        ],
        cleanupOutdatedCaches: true,
        // MALEK is online-first. A protected route must never fall back to a
        // cached SPA document that may be stale or imply offline data access.
        navigateFallback: "/offline.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === "style" ||
              request.destination === "script" ||
              request.destination === "worker" ||
              request.destination === "font",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "rentrix-assets",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  css: {
    postcss: {
      plugins: [
        (await import("@tailwindcss/postcss")).default,
        (await import("autoprefixer")).default,
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
