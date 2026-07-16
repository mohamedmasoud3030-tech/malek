# Rentrix Landing — الموقع التسويقي الرسمي

Standalone marketing/landing site for the **Rentrix** rental-property management app.
Built as a fully independent project so it can be deployed & iterated separately from the main app.

> موقع تعريفي تسويقي مستقل لتطبيق Rentrix — منفصل تماماً عن كود التطبيق (`rentrix-app`)،
> بصفحة واحدة غنية تشرح المشكلة والحل والمزايا، بلقطات حقيقية من أحدث نسخة.

## Stack

- **Vite 6 + React 19 + TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **framer-motion** for scroll/tab/counter animations
- **lucide-react** icons
- Custom lightweight i18n (Arabic RTL default + English toggle, persisted)

## Quick start

```bash
cd rentrix-landing
cp .env.example .env        # set the real production links
npm install
npm run dev                 # http://localhost:4400
```

Production build:

```bash
npm run build               # tsc check + vite build → dist/
npm run preview             # serve the built site locally
```

## Environment variables (`.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_APP_URL` | Public URL of the live Rentrix app (all "start now" buttons) |
| `VITE_WHATSAPP_NUMBER` | WhatsApp business number, international format without `+` |
| `VITE_CONTACT_EMAIL` | Contact e-mail shown in the footer |

## Page structure (story-driven)

1. **Hero** — value promise + dual CTA (app / WhatsApp demo) + real dashboard screenshot with floating KPI chips
2. **Stats strip** — animated counters (modules, reports, RTL, roles)
3. **Problem → Solution** — six real pains of spreadsheet-based management, each mapped to its Rentrix cure
4. **Features bento** — spotlight card (dark-mode dashboard) + 8 capability cards
5. **Product tour** — interactive tabs with the 4 real screenshots (dashboard / reports hub / settings / unified form)
6. **How it works** — 3 onboarding steps
7. **Everywhere** — mobile + dark-mode real screenshots in device frames
8. **Security & trust** — RBAC, audit log, RLS, data-integrity checks
9. **FAQ** — 6 pre-launch questions
10. **Final CTA + Footer**

## Assets

All imagery under `public/` is **real product material**, not stock:

- `public/screenshots/*` — captured from the latest Rentrix build (`rentrix-app/public/landing/*` and `docs/ui-ux/evidence/after/*`)
- `public/icon-rentrix.png` — official icon
- `public/opengraph.jpg` — social sharing card

## Deployment

Any static host works (Vercel / Netlify / Cloudflare Pages / S3+CDN):

- Build command: `npm run build`
- Output directory: `dist`

Update the canonical/OG URLs in `index.html` when the final domain is known.

## Notes

- This folder is **intentionally excluded** from the root `pnpm-workspace.yaml` so the main app's install/CI footprint is untouched. Run it with `npm` (or `pnpm`) independently.
- Direction switching (`dir="rtl"`/`dir="ltr"`), `<html lang>`, `<title>` and meta description all follow the active language automatically.
