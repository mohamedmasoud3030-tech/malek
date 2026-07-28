# MALIK Brand Audit Inventory

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

## Must-change user-visible occurrences
- CSS comments in styles/*.css (Rentrix -> MALIK)
- Favicon.svg (no MALIK identity)
- PWA icon assets missing (legacy Rentrix files removed but not replaced)
- Demo video source reference /landing/rentrix-demo.mp4
- Landing constants hostname
- Index.html localStorage theme key `rentrix-theme`
- Index.html nonce `rentrix-static`
- Error-boundary reset key `rentrix-root`
- CSS token comments

## Intentionally preserved technical identifiers
- package.json / package names
- Supabase schema / RLS / storage keys (`rentrix-auth-session`)
- view-mode storage keys (`rentrix:view-mode:*`)
- auth session keys
- theme storage (`rentrix-theme`) — but user-facing label should say MALIK
- canonical host `rentrixapp.vercel.app`
- repository directory `rentrixxx`
- backend identifiers
