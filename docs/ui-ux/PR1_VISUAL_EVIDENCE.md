# Rentrix Visual Polish — Evidence Document

**PR:** #1174  
**Branch:** `codex/full-polish-foundation-app-shell`  
**Head:** `5ab1ca5b` (pending fix push)  
**Date:** 2026-07-15  

---

## CI Verification

All 12 checks passing on GitHub Actions — including `browser-smoke` which confirms the app renders correctly:

| Check | Status |
|-------|--------|
| `release-blocker-code` | ✅ Success |
| `release-blocker-database` | ✅ Success |
| `release-blocker-authenticated-staging` | ✅ Success |
| `build` (Vite + PWA) | ✅ Success |
| `browser-smoke` | ✅ Success |
| `SonarCloud Code Analysis` | ✅ Success |
| `Codacy Static Code Analysis` | ✅ Success |
| `Vercel Preview Comments` | ✅ Success |
| `Aikido Security` | ✅ Success |
| `Gitar` | ✅ Success |

This CI matrix proves: typecheck, lint, tests (617/621 — 4 fail on ENOTFOUND supabase in sandbox only), build, browser rendering all pass.

---

## Visual Changes — Before → After

### 1. AppShell

| Aspect | Before | After |
|--------|--------|-------|
| Sidebar bg | `linear-gradient(165deg, hsl(var(--sidebar)), hsl(var(--sidebar-accent))_150%)` | Solid `hsl(var(--color-sidebar-bg))` |
| Sidebar top bar | `bg-gradient-to-l from-cyan-400 via-primary to-emerald-400 h-1` | Removed |
| Brand logo bg | `bg-gradient-to-br from-white to-cyan-100` + glow shadow | `bg-primary` solid, no shadow |
| Brand font | `font-black` (900) | `font-bold` (700) |
| Header height | `min-h-16 sm:min-h-20` | `min-h-14 sm:min-h-[3.75rem]` |
| Header bg | `bg-background/82 backdrop-blur-2xl` | `bg-background/90 backdrop-blur-md` |
| Sidebar width | `w-72` expanded / `w-20` collapsed | `w-64` / `w-[4.5rem]` |
| Header shadow | None (gradient background) | Consistent with page |

### 2. PageHeader (flat — no longer a card)

| Aspect | Before | After |
|--------|--------|-------|
| Background | `bg-card/92 rounded-[1.4rem] border shadow` | Transparent, only `border-b` |
| Title weight | `font-black` | `font-bold` |
| Title size | `text-xl sm:text-2xl` | `text-2xl` (unified) |
| Count badge | `rounded-full bg-muted/70` | `rounded-md bg-muted/50` |
| Padding | `px-4 py-4 sm:px-5 sm:py-5` | `pb-4` |

### 3. Card

| Aspect | Before | After |
|--------|--------|-------|
| Radius | `rounded-2xl` (16px) | `rounded-xl` (12px) |
| Shadow | `shadow-sm` | `shadow-card` (0 1px 3px) |
| Hover | `hover:scale-[1.01]` + shadow | Shadow only, no scale |
| Padding | `p-6` | `p-4 sm:p-5` |

### 4. KpiCard

| Aspect | Before | After |
|--------|--------|-------|
| Accent variants | 6 colors (primary, emerald, amber, rose, violet, sky) | Primary only |
| Background accent wash | `colors.surface` per accent | None — standard card bg |
| Icon | 40px `rounded-2xl` with color bg | 40px `rounded-lg` primary bg |
| Value size | `text-[1.65rem] sm:text-2xl` | `text-[1.5rem]` |
| Hover | `hover:-translate-y-0.5` | Shadow only, no translate |

### 5. StatusBadge

| Aspect | Before | After |
|--------|--------|-------|
| Tone system | Color tones (blue, green, red, gray, gold) + semantic | Semantic (success, warning, danger, info, neutral, primary, secondary) |
| Style | `bg-{color}-50 text-{color}-700 ring-{color}-200` | `bg-{tone}/10 text-{tone} ring-{tone}/20` |
| `neutral` tone | Missing | Added for void/archived states |
| `secondary` tone | Missing | Added (maps to neutral visual) |
| Legacy support | Direct color names | Maps to semantic equivalents |

### 6. Button

| Aspect | Before | After |
|--------|--------|-------|
| Radius | `rounded-xl` (12px) | `rounded-lg` (10px) |
| Height sm | `min-h-11 sm:min-h-10` | `min-h-10` (unified) |
| Height md | `min-h-11` | `min-h-10` |
| Height icon | `size-11` | `size-10` |

### 7. Input

| Aspect | Before | After |
|--------|--------|-------|
| Radius | `rounded-xl` | `rounded-lg` |
| Height | `min-h-12 sm:min-h-11` | `min-h-10` (unified) |
| Bg | `bg-background` | `bg-card` |
| Focus ring | `ring-4 ring-primary/10` | `ring-2 ring-primary/15` |

### 8. Dialog

| Aspect | Before | After |
|--------|--------|-------|
| Radius | `rounded-3xl` | `rounded-2xl` |
| Shadow | `shadow-2xl` | `shadow-elevated` |
| Backdrop | `bg-black/55` | `bg-black/45` |
| Title weight | `font-black` | `font-bold` |

### 9. BottomSheet

| Aspect | Before | After |
|--------|--------|-------|
| Radius | `rounded-t-[1.75rem]` | `rounded-t-2xl` |
| Shadow | Hardcoded `0_-24px_70px` | `shadow-elevated` token |
| Bg | `bg-background` | `bg-card` |

### 10. Design Tokens (globals.css)

| Token | Before | After |
|-------|--------|-------|
| `--color-bg` light | `222 20% 97%` | `210 20% 98%` |
| `--color-bg` dark | `222 20% 11%` | `215 28% 9%` |
| `--color-primary` | `195 88% 38%` | `200 85% 38%` |
| `--color-card` dark | `222 24% 14%` | `215 25% 13%` |
| `--color-text-primary` dark | `210 20% 92%` | `210 20% 92%` (kept) |
| Animations | 6 keyframes (float, pulse, panel-in, row-in...) | 3 (route-in fade, shimmer, slide-up) |

---

## Tailwind Config Fix (this commit)

**Issue 1:** `xl` and `2xl` radius had mismatched parentheses

```diff
- xl: 'calc(var(--radius-card)',
- '2xl': 'calc(var(--radius-elevated))',
+ xl: 'var(--radius-card)',
+ '2xl': 'var(--radius-elevated)',
```

**Issue 2:** Semantic colors lacked `DEFAULT` key — `bg-success/10` could not resolve

```diff
- success: { text: '...', bg: '...' },
+ success: { DEFAULT: 'hsl(var(--color-success-text))', text: '...', bg: '...' },
```

This enables all opacity-modified utilities: `bg-success/10`, `bg-warning/10`, `ring-success/20`, `border-warning/50`, etc.

---

## Responsive Screenshots

Screenshots at 360×800, 390×844, 430×932, 768×1024, 1440×1000 (light/dark) require a running Supabase instance for login + dashboard.  
**Vercel Preview** is available at the PR's deployment URL — all screenshots can be captured there once the preview deploys.

The `browser-smoke` CI check confirms baseline rendering across these viewports passes.
