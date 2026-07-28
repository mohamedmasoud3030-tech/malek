# MALIK Brand Audit — Final Delivery

## Outcome

The post-#1308 brand audit is corrected and implementation-ready. User-visible
legacy copy remains removed while stable technical identifiers are preserved.
The PWA install regression from a missing icon set is closed with a single MALIK
mark system shared by the app shell and launch surfaces.

## Delivered

- One angular MALIK mark, a MALIK wordmark, and the fixed Arabic tagline.
- A compact mark for the collapsed sidebar, install prompt, favicon, and PWA.
- Complete lockups for login, the login command panel, landing hero/footer,
  expanded navigation, and the offline surface.
- Actual 192×192 and 512×512 regular and maskable PNG assets.
- Manifest purposes split correctly between `any` and `maskable`.
- Apple touch icon and SVG favicon links in the HTML head.
- Brand-contract checks for mark placement, manifest entries, PNG signatures,
  actual dimensions, maximum file size, and favicon identity.
- MALIK naming in non-rendered design-system headings.

## Preserved contracts

- `rentrix-theme`
- `rentrix.pwa-install-dismissed-at`
- `rentrix-root`
- `rentrix-static`
- `/landing/rentrix-demo.mp4`
- `rentrixapp.vercel.app`

These identifiers are not user-facing. Renaming them would reset preferences,
break an existing asset URL, or publish an unapproved hostname.

## Scope

No financial logic, Supabase schema, migrations, RLS, auth semantics, production
data, or backend identifiers are changed.

## Verification

The authoritative results are recorded in the PR after targeted brand/PWA tests,
typecheck, lint, architecture check, full application tests, production build,
and browser readiness complete.
