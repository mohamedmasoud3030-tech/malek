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

const PLACEHOLDER_URLS = ['https://example.supabase.co', 'https://invalid.supabase.local'];
const PLACEHOLDER_KEYS = ['test-anon-key', 'invalid-anon-key'];

function isPlaceholderEnv(url: string | undefined, key: string | undefined): { isPlaceholder: boolean; reason?: string } {
  if (!url || !key) {
    return { isPlaceholder: true, reason: 'VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY مفقود' };
  }
  if (PLACEHOLDER_URLS.includes(url.trim())) {
    return { isPlaceholder: true, reason: `VITE_SUPABASE_URL يستخدم قيمة وهمية: ${url}` };
  }
  if (PLACEHOLDER_KEYS.includes(key.trim())) {
    return { isPlaceholder: true, reason: `VITE_SUPABASE_ANON_KEY يستخدم قيمة وهمية: ${key}` };
  }
  if (url.includes('example.supabase.co') || url.includes('invalid.supabase.local')) {
    return { isPlaceholder: true, reason: `VITE_SUPABASE_URL يحتوي على نطاق وهمي: ${url}` };
  }
  return { isPlaceholder: false };
}

function productionEnvGuardPlugin() {
  return {
    name: 'rentrix-production-env-guard',
    configResolved(config: any) {
      const isTest = process.env.VITEST === 'true' || config.mode === 'test' || process.env.NODE_ENV === 'test';
      const isProdBuild = config.command === 'build' && config.mode === 'production';
      const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV === 'production');
      const isEnforced = process.env.VITE_ENFORCE_PROD_ENV === 'true';

      // Allow test env to use placeholders
      if (isTest) return;

      if (isProdBuild) {
        const url = process.env.VITE_SUPABASE_URL;
        const key = process.env.VITE_SUPABASE_ANON_KEY;
        const check = isPlaceholderEnv(url, key);

        if (check.isPlaceholder) {
          // In Vercel production or when explicitly enforced, fail hard
          if (isVercel || isEnforced) {
            throw new Error(
              `\n\n=== فشل بناء الإنتاج: متغيرات Supabase وهمية ===\n${check.reason}\n\n` +
                `يمنع بناء نسخة Production باستخدام قيم Placeholder.\n` +
                `الحلول:\n` +
                `1. اضبط متغيرات بيئة حقيقية في Vercel/ production .env\n` +
                `2. للإختبارات المحلية استخدم VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY الحقيقية أو اترك الاختبارات تستخدم القيم التجريبية عبر VITEST=true\n` +
                `3. لا تستخدم https://example.supabase.co أو https://invalid.supabase.local في الإنتاج\n\n` +
                `القيم الحالية:\n` +
                `VITE_SUPABASE_URL=${url || '(مفقود)'}\n` +
                `VITE_SUPABASE_ANON_KEY=${key ? key.slice(0, 10) + '...' : '(مفقود)'}\n`
            );
          } else {
            // In local/CI build, allow but warn loudly
            console.warn(
              `\n[rentrix-env-guard] تحذير: بناء الإنتاج يستخدم قيم Supabase وهمية: ${check.reason}\n` +
                `هذا مسموح في CI/التطوير المحلي لكن سيفشل في Vercel production. اضبط متغيرات حقيقية قبل الإطلاق.\n`
            );
          }
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
      registerType: "autoUpdate",
      manifest: false,
      includeAssets: ["offline.html", "icon-rentrix.png", "favicon.svg"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // Offline shell only — never cache authenticated API/financial payloads.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "rentrix-pages",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === "style" ||
              request.destination === "script" ||
              request.destination === "worker" ||
              request.destination === "font",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "rentrix-assets",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
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
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          router: ['@tanstack/react-router'],
          query: ['@tanstack/react-query'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select'],
          charts: ['recharts'],
        },
      },
    },
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
