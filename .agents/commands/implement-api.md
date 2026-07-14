# Command: /implement-api [&lt;ticket-slug&gt;]

You are the **Rentrix API/Service Agent**. You implement the TypeScript service
layer and TanStack Query hooks for the ticket at
`tickets/&lt;ticket-slug&gt;.md`.

## Read FIRST

1. The ticket.
2. `.agents/guardrails/LESSONS_LEARNED.md` (especially #10: never move
   financial integrity to the client — services wrap RPCs, they don't do their
   own multi-table writes).
3. `.agents/skills/react-patterns/SKILL.md`,
   `.agents/skills/supabase-data-contracts/SKILL.md`,
   `.agents/skills/error-handling/SKILL.md`.
4. For financial features, also `.agents/skills/financial-reporting/SKILL.md`.
5. The nearest existing service/hook pair that is a good pattern to copy.
   Find it with:
   - `rg -l "\.rpc\(" rentrix-app/src/features/`
   - `rg -l "useMutation|useQuery" rentrix-app/src/features/&lt;area&gt;/`
   Good reference pairs:
     - `features/financials/payments/paymentService.ts` + `usePayments.ts`
     - `features/contracts/services/contractService.ts` + `useContracts.ts`
     - `features/owners/ownerAgreementService.ts` + `useOwnerAgreements.ts`

## Hard rules

- **Service files** (`*Service.ts`) do NOT contain React hooks. They contain
  only async functions that call `supabase.from(...)` or `supabase.rpc(...)`
  and return typed data. They must handle errors through
  `handleSupabaseError` (see `lib/supabase-error.ts`).
- **Hooks** (`use*.ts`) wrap services with TanStack Query:
  - Reads → `useQuery` with stable `queryKey` array.
  - Writes → `useMutation` with `onSuccess` that invalidates relevant query
    keys.
- All money values pass through `lib/moneyNormalization.ts` (do NOT format raw
  numbers inline).
- All dates pass through `lib/formatters.ts` date helpers. Do NOT use
  `toISOString().slice(0,10)` for date-only fields (lesson #7).
- All inputs are validated with zod schemas (see
  `features/contracts/domain/contractSchema.ts` as reference) before being
  sent to RPCs.
- Service functions return typed domain objects from `types/domain.ts` — do
  not leak raw Supabase row shapes to components.
- No direct `supabase.from('...').insert()/.update()/.delete()` for tables
  protected by atomic RPCs (money, contracts, settlements, receipts,
  maintenance resolution). Go through the RPC.
- Implement `idempotency-key` generation client-side (uuid v4 per user
  action, persisted into the mutation payload) for every RPC that uses
  `financial_operation_idempotency`.

## Tests

- Add colocated `*.test.ts` files covering:
  - happy path for each service function (mocked supabase client)
  - error path (network, RLS denial, invalid input)
  - idempotency-key presence
  - zod validation rejects bad shapes
- Run: `pnpm --filter ./rentrix-app test -- &lt;feature-glob&gt;`.
- For financial features, also run `pnpm --filter ./rentrix-app run test:financials`.

## Summarize

List services/hooks created, RPCs wrapped, any shared type additions, and tests added.
