# MALIK Brand Audit Inventory

Verified against `main` after PR #1308 and corrected on
`audit/malik-brand-audit-20260728`.

## Brand surfaces mapped
- Login: login-page.tsx
- App shell: layout/app-shell.tsx
- Sidebar: components/layout/sidebar
- Mobile drawer: components/layout/mobile-drawer
- Top nav: components/layout/top-nav
- Page titles: route-tree.tsx
- Breadcrumbs: components/layout/breadcrumbs
- Dashboard: features/dashboard/*
- Empty/loading/error states: components/ui/*
- Onboarding: features/onboarding/*
- Settings: features/settings/*
- System pages: features/system/*
- Change-password: auth/*
- Landing: features/landing/*
- Legal pages: features/landing/components/LegalPage
- WhatsApp messages: automation-whatsapp
- Email-like templates: outbound-communication-service
- Notifications: components/notifications
- Offline page: public/offline.html
- Install prompt: pwa-install.ts
- Browser title: index.html
- Open Graph / Twitter / JSON-LD: index.html
- Manifest: public/manifest.json
- Print/PDF: services/documents/*
- Receipts/invoices: features/financials/*
- Report headers: services/documents/DocumentTemplates

## Corrected user-facing/build surfaces
- CSS design-system headings now use MALIK.
- The MALIK identity now has one angular mark, a Latin wordmark, and the fixed
  Arabic tagline. The mark source is isolated at `public/malik-mark.svg`.
- PWA icons exist at truthful 192×192 and 512×512 dimensions.
- Regular and maskable icons share the same MALIK mark and stay under 100KB.
- `manifest.json` declares separate `any` and `maskable` purposes.
- `index.html` exposes an SVG favicon and Apple touch icon.

## Intentionally preserved technical identifiers
- package.json / package names
- Supabase schema / RLS / storage keys (`rentrix-auth-session`)
- view-mode storage keys (`rentrix:view-mode:*`)
- auth session keys
- theme storage (`rentrix-theme`) — invisible persisted preference
- canonical host `rentrixapp.vercel.app`
- demo asset path `/landing/rentrix-demo.mp4`
- install-dismissal key `rentrix.pwa-install-dismissed-at`
- CatchBoundary reset key `rentrix-root`
- static nonce label `rentrix-static`
- repository directory `rentrixxx`
- backend identifiers

## Rejected audit changes
- A fictional `malikapp.vercel.app` fallback was not adopted; the deployed
  canonical host remains unchanged until a real MALIK domain is approved.
- Persisted theme/install keys were not renamed, preventing preference resets.
- The 19MB demo was not pointed at a missing `malik-demo.mp4` URL.
- Four unrelated generated M logos were removed. The PWA, favicon, app shell,
  login, landing, offline surface, and install prompt now use one mark system.
