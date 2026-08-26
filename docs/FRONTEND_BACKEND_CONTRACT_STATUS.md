# Frontend ↔ Backend Contract Acceptance Target

The hardening phase is accepted only when the PR CI proves all of the following on the integrated head:

- migration chain matches generated database types;
- frontend database usage has zero schema/RPC mismatches;
- reviewed-dynamic gate reports zero unreviewed dynamic contracts;
- targeted runtime compatibility suite passes;
- six-role RLS matrix passes, including cross-company denial behavior;
- typecheck, architecture checks, and production bundle build pass.

No production database mutation is part of this acceptance path.
