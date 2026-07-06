---
name: frontend-integration
description: Use for any Rentrix change that creates, modifies, or claims completion of a user-facing screen, route, component, or workflow. Do not use for purely backend, documentation-only, or non-UI changes unless they affect frontend behavior or feature readiness.
---

# Frontend Integration

Apply this skill whenever work touches a user-visible flow in Rentrix.

## Required workflow

1. Inspect the real route, page, components, hooks, and services before changing behavior.
2. Trace the flow from the UI event to the service call and to the data source. Do not assume a backend feature is usable just because the backend exists.
3. Verify these states in the UI path when relevant:
   - loading
   - empty
   - error
   - permission denied or disabled action
   - mutation success, failure, and in-progress feedback
4. Remove or quarantine mock data, placeholder UI, and cosmetic-only screens from production routes. Production paths must use real services and real data contracts.
5. Confirm navigation, route guards, and permission checks match the intended user journey.
6. Test the user flow from the frontend through the service layer to the expected data source before claiming the feature is complete.

## Completion standard

A user-facing feature is not complete until the screen exists, is reachable through the intended route, is connected to the real service/data source, handles the required states, and has documented verification of the flow.
