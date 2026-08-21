# MALEK PWA Review

Status: Active remediation record  
Repository baseline: `main@b1bb5a901b7adff1aa36b0483195465fe99deeca`  
Reviewed: 2026-08-21  
Scope: `rentrix-app` Vite/React PWA only  
Production mutation: none

## Executive result

MALEK is intentionally **online-first**. Its PWA is an installable secure application shell, not an offline property/financial database.

Three high-priority correctness issues were confirmed in source/build logs and remediated in this branch:

1. `offline.html` was precached but navigation fallback returned `/index.html`, so users could be shown a stale application shell rather than the explicit connection-required state.
2. `registerType: "autoUpdate"` had no user-visible update/reload control. An update could activate while an operator was entering data or completing a sensitive workflow.
3. The Vercel production build could not resolve `workbox-window` from Vite PWA's virtual registration module because pnpm requires it as a direct application dependency.

No source evidence found that Supabase REST/RPC requests, payment responses, private attachments, or authenticated API data are runtime-cached by the current Workbox rules.

## Architecture and deployment assumptions

| Area | Observed behavior | Status |
| --- | --- | --- |
| Framework | React + Vite + `vite-plugin-pwa` | VERIFIED |
| Hosting assumption | Vercel/root deployment; static SPA fallback required server-side | IMPLEMENTED BUT NOT VERIFIED |
| Secure context | Service workers/install require HTTPS or localhost | PLATFORM REQUIREMENT |
| Auth/data | Supabase browser client, persisted session token in local storage | VERIFIED IN SOURCE |
| PWA registration | Vite PWA generated service worker; prompt update lifecycle in this remediation; direct `workbox-window` dependency declared | IMPLEMENTED BUT NOT VERIFIED |
| Base path | Current manifest uses root-relative URLs and assumes `BASE_PATH=/` | VERIFIED ASSUMPTION; non-root hosting requires dedicated validation |

## Manifest and install review

| Item | Result |
| --- | --- |
| Arabic identity, RTL, name/short name | VERIFIED |
| `start_url`, `scope`, standalone display | VERIFIED for root hosting |
| theme/background colors | VERIFIED |
| portrait orientation | VERIFIED |
| business/productivity categories | VERIFIED |
| Any + maskable 192/512 icons | VERIFIED IN SOURCE |
| Apple touch icon and standalone metadata | VERIFIED IN SOURCE |
| Android/Desktop install prompt | IMPLEMENTED BUT NOT VERIFIED on a real browser |
| iOS Safari Add-to-Home-Screen guidance | IMPLEMENTED BUT NOT VERIFIED on device |
| iOS notification/background-sync behavior | CONNECTION/PLATFORM LIMITED; not claimed |

## Data sensitivity and cache strategy

| Category | Sensitivity | Strategy after remediation | Offline result |
| --- | --- | --- | --- |
| Manifest, icon, offline page | Public | Precache | Available |
| CSS, JS, worker, self-hosted fonts | Public application shell | Stale-while-revalidate, bounded 7 days/60 entries | Available only after browser has fetched assets |
| HTML navigation | May lead to authenticated workflow | Network required; fallback only to `offline.html` | Explicit connection-required page |
| Supabase REST/RPC/Auth | Sensitive/authenticated | No Workbox runtime cache rule | Connection required |
| Payment/receipt/report responses | Financial/sensitive | No Workbox runtime cache rule | Connection required |
| Private attachments/documents | Private | No Workbox runtime cache rule | Connection required |
| Mutation requests/queues | Integrity critical | No background queue/sync | Connection required; never queued |
| Third-party resources | None required for core font rendering | Not cached by PWA rules | Connection required |
| Legacy `rentrix-pages` navigation cache | Public SPA HTML only; potentially stale | No longer read/created by new worker; storage cleanup must be observed on update | Not relied on |

## Offline capability matrix

| Journey | Offline capability |
| --- | --- |
| First visit / login | Connection required |
| Installed shell after assets were fetched | Offline fallback page available |
| Authentication/session refresh | Connection required |
| Dashboard, portfolio, leasing, money, reports, settings data | Connection required |
| Create/edit/delete/financial collection/receipt/void | Connection required; never queued |
| Private documents/attachments | Connection required |
| Public manifest/icons/offline page/fonts | Available from cache when installed |
| Retry after connection returns | User reloads/retries; no fake synchronization claim |

## Update lifecycle

- The worker uses the supported Vite PWA prompt registration pattern.
- A detected update shows an explicit Arabic action to reload.
- The user decides when to activate the waiting worker; no forced reload occurs.
- The action uses `updateServiceWorker(true)` only after the user chooses it.
- Cache version cleanup is handled for Workbox precache entries. Runtime asset limits are bounded.
- An update flow still requires production-browser verification because generated worker artifacts are not available in this review environment.

## Confirmed historical defects and remediation

| Severity | Finding | Remediation |
| --- | --- | --- |
| High | `offline.html` unused by navigation fallback | Use `/offline.html` as Workbox navigation fallback |
| High | Auto update had no safe user choice | Use prompt registration plus explicit refresh notification |
| Medium | Navigation HTML runtime cache could serve stale app shell | Remove navigation `NetworkFirst` runtime caching; online navigation now fails closed to offline page |
| Medium | PWA behavior had no focused regression contract | Add PWA configuration/lifecycle contract test |
| Critical | Vercel build failed: virtual PWA registration could not resolve `workbox-window` | Declare `workbox-window@^7.4.1` directly in `rentrix-app`, synchronize `pnpm-lock.yaml`, and add a dependency-contract test |

## Verification ledger

| Check | Result |
| --- | --- |
| Source/config inspection | VERIFIED |
| Manifest/icon reference inspection | VERIFIED IN SOURCE |
| Cache-policy inspection | VERIFIED IN SOURCE |
| Focused PWA regression test | IMPLEMENTED BUT NOT RUN (no runnable checkout in this session) |
| Production build | VERIFIED COMPLETE: Vercel production deployment `dpl_EtLf1g7tzWmoNcrz4jhHSehLWQV1` for `main@91a0ae9` reached READY after the CSS and `workbox-window` corrections |
| Browser registration/update/offline test | BLOCKED: no running preview/QA browser in this session |
| Android Chrome installation | MANUAL DEVICE CHECK REQUIRED |
| iOS Safari Add-to-Home-Screen | MANUAL DEVICE CHECK REQUIRED |
| Deployment HTTPS/headers | IMPLEMENTED BUT NOT VERIFIED: Vercel build logs inspected; current branch must produce a successful preview before header/artifact inspection |

## Phased remediation

1. **P0 complete in code:** fail-closed offline navigation and safe update prompt.
2. **P1 required before claiming PWA readiness:** build and inspect generated manifest/service worker; run focused test and browser offline/update test against preview.
3. **P2 manual evidence:** Android Chrome install, desktop install, iPhone/iPad Safari Add-to-Home-Screen and standalone launch.
4. **P3 optional only after product decision:** push, badges, and background sync. None are enabled or implied today.

## Remaining manual checks

- Install on Android Chrome and desktop Chrome/Edge over HTTPS.
- Confirm iOS Safari manual install instructions and standalone launch.
- Confirm generated service worker precaches only the documented public shell assets.
- Go offline after an online visit, navigate to a protected route, and confirm `offline.html` appears rather than stale/private content.
- Sign out, close/reopen, and verify no account-specific data appears before a fresh authenticated network load.
- Open a waiting update while a form is dirty and confirm the app changes only after the explicit user refresh action.
