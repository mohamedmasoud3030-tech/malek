# PHASE — FINANCIAL CORRECTNESS: independent verification (2026-09-13)

Method: live Production metadata and data read through the Supabase Management API
`database/query` (SELECT/WITH only; the runner in `~/tools/live-query.sh` refuses writes and
multiple statements), cross-checked against a clean PGlite replay of the repository migration
chain using the project's own engine (`scripts/db0/lib/replay.mjs`). Project
`nnggcnpcuomwfuupupwg` ("Malek-Plus (live)"), PostgreSQL 17.6, 116 public tables, 2,360 columns,
408 functions.

Two measurement notes that matter for trusting the numbers below:
- `information_schema.columns.numeric_scale` / `numeric_precision` were used as authoritative after
  a first pass computed scale from `atttypmod` with the wrong formula (PostgreSQL encodes
  `typmod = ((precision*scale_digits)+scale)+4` in base 100, not 2^16). The corrected query set is
  what is reported.
- "Same count" was not treated as "same set": repo and Production were compared as **sets**
  of `table.column`.

---

## 1. Double-counting protection — VERIFIED ON LIVE DATA (no defect; nothing changed)

**Claim verified:** a maintenance-recorded cost is never summed together with the posted expense
that the same closure creates.

### 1a. Where the protection actually lives
| Layer | Mechanism | Evidence |
| --- | --- | --- |
| Write path | `close_maintenance_with_expense` creates the expense+journal atomically and **refuses to close** if the link is absent: `if v_expense_id is null then raise 'MAINTENANCE_EXPENSE_LINK_MISSING'` | `supabase/migrations/20260901000038…sql:152-155`, same guard re-normalised in `20260910000001…:119` and `:217` |
| Write path | The *resolve* step cannot carry money at all: `if p_cost is distinct from 0 then raise 'MAINTENANCE_USE_VERIFIED_FINANCIAL_CLOSURE'` | `supabase/migrations/20260909000012_owner_expense_allocation_source.sql:360` |
| Client boundary | The service validates the RPC result, including `(input.cost>0 && !result.expense_id)` → throw | `rentrix-app/src/features/maintenance/maintenance-service.ts:169` |
| Read model | `buildPropertyPerformanceRows()` adds `request.cost` to `maintenanceCost` **only when `!request.expense_id`**, plus completed-status and in-period predicates; `expenses` is summed independently from `expenseRows` | `rentrix-app/src/features/reports/reports-page.helpers.ts:206-228` |
| Data model | **No DB-side aggregate sums maintenance cost at all** — every `from public.maintenance_records` in the 105 migrations is a notification rule, an archive guard or a JSON payload; zero `sum(…cost)` | grep over `supabase/migrations/*.sql` |

That last row is the load-bearing one: there is no SQL view/RPC that could double count, so the
guarantee rests on the `expense_id` link plus the write-path invariants above.

### 1b. Live data census (Production)
| Probe | Value |
| --- | --- |
| `maintenance_records` rows (not soft-deleted) | 5 |
| rows with a non-zero cost | 1 — `status=closed`, `cost=48.000`, `expense_id` set |
| **costed + closed/resolved + `expense_id IS NULL`** (the exact double-count candidate set) | **0**, sum `0` |
| orphan links (`expense_id` → missing/soft-deleted expense) | 0 |
| expenses claimed by more than one maintenance row (inflation vector) | 0 |
| `expenses.amount` ≠ linked `maintenance.cost` | 0 |
| `expenses.property_id` ≠ linked `maintenance.property_id` | 0 |
| live `expenses` (not deleted) | 4 rows / `149.000` |

### 1c. The guard predicate replayed as SQL against live rows
Re-implementing `isCompletedMaintenanceRequest` (`status in (resolved,closed)`),
`getMaintenanceCostDate` (`completed_at ?? resolved_at ?? request_date ?? created_at`, truncated to
10 chars for the lexicographic period test) and the `!expense_id` condition:

| Measure | Result |
| --- | --- |
| expense side, posted-maintenance component | `48.000` |
| maintenance side, unposted component | `0` |
| naive `SUM(cost)` over all maintenance rows | `48.000` |
| **`expenses + maintenanceCost`** | **`149.000`** — identical to the expense-table total |
| rows that would double count | **0** |

Because the unposted component is empty, the two sides are provably disjoint on current data, and
the `48.000` appears exactly once.

### 1d. What the shipped tests do and do not prove
- `rentrix-app/src/features/reports/reports-page.test.ts:182` calls the **real**
  `buildPropertyPerformanceRows` and asserts `{expenses: 700, maintenanceCost: 0}` for a
  posted-cost fixture — a genuine behavioural test (plus a second case proving an open row's cost
  is never treated as actual cost).
- `rentrix-app/src/features/reports/reports-final-closure.test.ts:93` asserts that
  `reports-page.helpers.ts` **as text** contains `!request.expense_id` and does not match
  `/property\.expenses \+= .*maintenance/i`. That is a grep assertion, not a behaviour test — it
  cannot fail if the predicate is kept while the surrounding arithmetic changes. The live-data
  replay in §1c is what closes that gap.

**Verdict: no defect found. No behavioural change made.**

---

## 2. OMR `numeric(18,3)` precision — CLAIM HOLDS AS A SET, ONE REAL DEFECT FOUND AND FIXED

### 2a. The 74/74 claim, measured
| Side | columns at exactly `numeric(18,3)` | total `numeric` columns (public tables+views) | tables / columns |
| --- | --- | --- | --- |
| Production `nnggcnpcuomwfuupupwg` | **74** (73 tables + 1 view) | 148 | 116 / 2,360 |
| Repo, clean replay of 103 migrations (as of `main` @ `13e4f594`) | **74** (73 tables + 1 view) | 148 | 116 / 2,360 |

The two **sets are identical** (0 repo-only, 0 live-only), which is the strongest form of the claim
and is what `74/74 … identical` in `docs/execution/RECONSTRUCTION_INVENTORY.md` means. Confirmed
independently: `maintenance_records.cost` is `numeric(18,3)` on both sides;
functions differ by exactly 1 (408 live vs 407 repo), matching the documented benign
`public.wp05_rpt_cash_flow_gl(date,date)` wrapper.

### 2b. Where "74/74" is a misleading metric (worth knowing, not a defect)
Applying the project's own money-column classifier (`scripts/db0/lib/drift.mjs`: `MONEY_NAME` minus
`MONEY_EXCLUDE`, `udt = numeric`) to live metadata gives **81** money-named numeric columns, of
which only **55** are `numeric(18,3)`:

| Class | Count | Assessed |
| --- | --- | --- |
| exactly `numeric(18,3)` | 55 | compliant |
| unconstrained `numeric` | 11 | `owner_settlements` ×5, `tenant_balances.balance_due`, `commissions` ×2, `lands` ×3 (live census: 39 unconstrained overall) — lossless; narrowing them would round posted history |
| `numeric(14,3)` / `(15,3)` / `(12,3)` | 9 | scale 3, smaller integer capacity — cannot truncate a baisa |
| `numeric(14,4)` / `(18,6)` | 5 | rates and fee snapshots — extra scale is intentional |
| `numeric(14,2)` flagged as money | 1 | **`properties.current_value` — see §2c** |

So: **0 of the 81 money-named columns can lose a third decimal through scale** — the property that
matters is true — but a literal reading of "74/74 money columns" overstates it, since 74 is the
count of columns *at that type*, not the count of money columns.

### 2c. REAL DEFECT FOUND (write-path rounding), now fixed
`docs/execution/RECONSTRUCTION_INVENTORY.md` and `HANDOFF.md` both assert that all 7 scale-2
columns are non-money. **For stored history that is true; for the write path it is not.**

`properties.current_value` is `numeric(14,2)`, yet the property form renders it with the shared OMR
money step and its validator does not constrain scale:

| Fact | Source |
| --- | --- |
| `MONEY_STEP = getCurrencyStep('OMR') = '0.001'` | `rentrix-app/src/lib/money.ts:30-36`, pinned by `money.test.ts:25` |
| `<Input type="number" step={MONEY_STEP}>` on the current-value field | `rentrix-app/src/features/properties/components/property-form-core-fields.tsx:45-46` |
| `current_value: optionalMoney` → `z.number().min(0).nullable()`, no scale check | `rentrix-app/src/features/properties/property-schema.ts:3-6,21-22` |
| write path passes it through unrounded | `create_property_with_agreement(… "p_current_value" numeric …)` |
| **proved on Production (read-only cast)** | `760000.123::numeric(14,2)` → **`760000.12`**; `0.001::numeric(14,2)` → **`0.00`** |

Its sibling `purchase_value` is already `numeric(18,3)`, so the two halves of a capital-gain or
yield comparison were held at different precisions, and the last `numeric`→`numeric(18,3)`
migration (`20260909000021`) left it behind.

Current damage: none observed — 0 of 4 stored non-null `current_value` rows carries a third decimal
(all integral), so no data was lost yet. The defect is latent, not yet realised.

**Fix applied:** `supabase/migrations/20260913000001_owner_valuation_omr_precision.sql` widens
`current_value` to `numeric(18,3)`. Deliberately narrow scope: the other six scale-2 columns
(`company_settings.vat_rate`, `invoices.tax_rate`, `maintenance_records.response_time_hours`,
`utility_bills.{previous_reading,current_reading,consumption_units}`) are untouched, no
unconstrained column is narrowed, and **no application-layer or aggregate change was made** —
`MONEY_STEP` was already correct once the column matches it.

Verified properties of the change (replay):
```
chain 103 -> 104 migrations, 0 failures        type: numeric(14,2) -> numeric(18,3)
stored rows changed by widen: 0                 re-run of the migration: idempotent, OK
money-named columns with scale<3: 1 -> 0        760000.123 now stored as 760000.123
numeric(18,3) column count: 74 -> 75            `pnpm db0:check-types`: database.ts still matches
```
All repo gates still pass unchanged: business-rules hash still `v2.0.0 382a0b8c…` (no accounting
rule added), migration hygiene OK (historical files untouched), 10-stage plan verified,
docs links 102 files OK.

### 2d. Apply-status caveat (owner-gated)
The migration is repo-side only. Production still has `current_value` at `numeric(14,2)`.
Per `HANDOFF.md`, `supabase db push` against Production is blocked pending ledger reconciliation,
and this turn's ledger read shows why that warning is current:

| Probe | Live | Repo |
| --- | --- | --- |
| migration ledger / files | **101** rows, max version `20260912065042` | 104 files (103 before this change) |
| versions on Production, absent from repo | `20260912065042` (1) | — |
| versions in repo, absent from Production | — | `20260912000001`, `20260912000002`, `20260912000003` (the Phase 3–5 direct-write ACL restores) |

Note `20260912065042` is *later* than the three repo-only versions, so version-prefix ordering
cannot be used to decide "caught up"; the schema comparison above is what establishes parity, and it
currently shows the two sides semantically identical for money precision.

---

## 3. Independent status of the two claims

| Claim | Status | Basis |
| --- | --- | --- |
| Maintenance cost cannot be double-counted with posted expenses | **VERIFIED — live** | live row census + guard replay (0 double-count rows; totals additive) + write-path fail-closed link invariant |
| Money columns use `numeric(18,3)` at 74/74 | **VERIFIED as a type-set parity claim**; incomplete as a safety claim | set-equality on live vs replay; the `74/74` number omits the 11 unconstrained + 9 narrower-scale columns, and its companion "none is money at scale 2" missed a live write-path truncation, now fixed |

Everything measured here is *metadata + data on Production* and *replay locally*. Not proven by this
report: UI behaviour in a real browser, and PostgREST/JWT-level read paths (the app's own suites run
against PGlite with mocked auth, per `HANDOFF.md` §D).
