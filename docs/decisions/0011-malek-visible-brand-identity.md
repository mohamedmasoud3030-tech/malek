# ADR 0011 — MALEK visible brand identity

## Status

Accepted — 2026-08-04.

## Decision

The user-visible English product name is **MALEK**. The Arabic name remains **مالك** and the approved Arabic tagline remains **كل أملاكك في مكان واحد**.

The canonical angular M is published through `/malek-mark.svg`. The complete image lockup, including the corrected word **MALEK**, is published through `/malek-lockup.svg`; the maskable PWA variant is `/malek-maskable.svg`.

All visible application surfaces must consume these canonical assets or the shared brand components that reference them. Alternate legacy marks and images containing the old visible spelling are not valid runtime assets.

## Compatibility boundary

The repository name, historical migrations, persisted storage keys, package paths, database objects, and other non-visible technical contracts may retain their current spelling until a separately planned migration can change them safely. This compatibility exception does not permit the old spelling to appear in user-facing product UI.

## Consequences

- Login and PWA lockups display MALEK inside the image itself.
- Expanded and collapsed navigation use the same angular M geometry.
- The manifest publishes MALEK and canonical icons.
- Brand contract tests prevent accidental reintroduction of the old visible identity.
