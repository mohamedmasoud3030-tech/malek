---
paths:
  - "rentrix-app/src/**/*.ts"
  - "rentrix-app/src/**/*.tsx"
  - "rentrix-app/src/**/*.css"
---

# Frontend and UI rules

- Follow `docs/source-of-truth/06_UX_IA_AND_DESIGN_CONTRACT.md` for UX and IA decisions.
- Use the existing shared design tokens, primitives, and shell before adding new visual abstractions.
- Keep one visual system across the product. Avoid page-specific theme systems, duplicate token sets, competing glass treatments, or repeated wrapper components.
- For redesign work, inspect the current shell, tokens, shared primitives, responsive patterns, and nearby pages first.
- The `frontend-design` skill is design guidance; MALEK's canonical UX contract and existing product identity take precedence.
- Prefer composition and shared primitives over deeply nested cards or repeated page chrome.
- Design desktop and mobile from the same semantic system rather than creating separate visual architectures.
- Preserve RTL and Arabic-first behavior, keyboard focus, reduced-motion behavior, semantic labels, and useful loading, empty, and error states.
- User-facing copy should describe domain actions, not implementation details.
- Inspect the existing CSS cascade before adding specificity or overrides.
- A frontend-only task should stay in the frontend unless the requested behavior truly requires a backend change.
- Shared shell or design-system changes need broader regression and visual validation than isolated page edits.
