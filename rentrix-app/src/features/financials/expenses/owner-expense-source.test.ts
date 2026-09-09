import { readFileSync } from "node:fs";
import { assumeIdentity, repoRoot } from "@/p1/replay-bootstrap";
import {
  createOwnerOffsetFixture,
  OTHER_OFFSET_OWNER,
} from "@/test/owner-offset-fixture";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  COMPANY,
  MAKER,
  OTHER,
  OTHER_COMPANY,
  OWNER,
  PROPERTY,
  createOfficeCreditorFixture,
} from "@/test/office-creditor-fixture";
import {
  offsetFixtureCommand as command,
  offsetDate as at,
} from "@/test/owner-offset-fixture";
let db: PGlite;
beforeAll(async () => {
  ({ db } = await createOfficeCreditorFixture());
  await db.exec("set role authenticated");
}, 60_000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
  await assumeIdentity(db, MAKER, COMPANY);
});
const payload = () => ({
  property_id: PROPERTY,
  category: "صيانة",
  charged_to: "OWNER",
  amount: 30.125,
  expense_date: at(9),
  request_id: crypto.randomUUID(),
  owner_allocations: [{ owner_id: OWNER, amount: 30.125 }],
  allocation_evidence: "Approved owner repair invoice",
});
it("creates allocated owner obligations through 1300 and does not deduct them automatically from owner funds", async () => {
  const result = await command(
    db,
    "create_expense_with_journal_atomic",
    payload(),
  );
  const rows = (
    await db.query(
      "select d.owner_id,d.amount::text,d.lawful_offset_right,a.no from public.due_from_owners d join public.journal_lines l on l.batch_id=d.journal_batch_id and l.debit>0 join public.accounts a on a.id=l.account_id where d.company_id=$1::uuid and d.source_id=$2",
      [COMPANY, result.expense_id],
    )
  ).rows;
  expect(rows).toEqual([
    {
      owner_id: OWNER,
      amount: "30.125",
      lawful_offset_right: false,
      no: "1300",
    },
  ]);
  expect(
    (
      await db.query(
        "select owner_expenses::text from public.calculate_owner_net_payout($1::uuid,$2::date,$3::date,$4)",
        [OWNER, at(1), at(28), PROPERTY],
      )
    ).rows,
  ).toEqual([{ owner_expenses: "0.000" }]);
  expect(
    (
      await db.query(
        "select subledger_balance::text,gl_balance::text from public.wp05_reconcile_all($1::uuid,$2::date) where account_no='1300'",
        [COMPANY, at(9)],
      )
    ).rows,
  ).toEqual([{ subledger_balance: "30.125", gl_balance: "30.125" }]);
});
it("requires explicit owner allocation evidence rather than attributing the full bill to every owner", async () => {
  const { owner_allocations, allocation_evidence, ...p } = payload();
  await expect(
    command(db, "create_expense_with_journal_atomic", p),
  ).rejects.toThrow(/OWNER_EXPENSE_ALLOCATION_REQUIRED/);
});
it("rejects allocation totals that differ by one OMR mill", async () => {
  const p = payload();
  p.owner_allocations[0].amount = 30.124;
  await expect(
    command(db, "create_expense_with_journal_atomic", p),
  ).rejects.toThrow(/OWNER_EXPENSE_ALLOCATION_TOTAL/);
});
it("retains one source and its exact intent across retries", async () => {
  const p = payload();
  const a = await command(db, "create_expense_with_journal_atomic", p);
  const b = await command(db, "create_expense_with_journal_atomic", p);
  expect(b.expense_id).toBe(a.expense_id);
  await expect(
    command(db, "create_expense_with_journal_atomic", { ...p, amount: 31 }),
  ).rejects.toThrow(/IDEMPOTENCY_KEY_REUSED/);
});

it("freezes an explicit unequal multi-owner split rather than applying the gross amount to each owner", async () => {
  await db.exec("reset role");
  await db.query(
    "insert into public.owners(id,name,full_name,company_id) values($1,'Second','Second',$2)",
    [OTHER_OFFSET_OWNER, COMPANY],
  );
  await db.query(
    "update public.property_owners set ownership_percentage=50 where property_id=$1",
    [PROPERTY],
  );
  await db.query(
    "insert into public.property_owners(owner_id,property_id,company_id,ownership_percentage,is_primary,starts_on) values($1,$2,$3,50,false,$4::date)",
    [OTHER_OFFSET_OWNER, PROPERTY, COMPANY, at(1)],
  );
  await db.exec("set role authenticated");
  const p = {
    ...payload(),
    owner_allocations: [
      { owner_id: OWNER, amount: 10 },
      { owner_id: OTHER_OFFSET_OWNER, amount: 20.125 },
    ],
  };
  const result = await command(db, "create_expense_with_journal_atomic", p);
  expect(
    (
      await db.query(
        "select owner_id,amount::text from public.due_from_owners where source_id=$1 order by amount",
        [result.expense_id],
      )
    ).rows,
  ).toEqual([
    { owner_id: OWNER, amount: "10.000" },
    { owner_id: OTHER_OFFSET_OWNER, amount: "20.125" },
  ]);
  const period = (
    await db.query<{ id: string }>(
      "select id from public.accounting_periods where company_id=$1 and $2::date between start_date and end_date",
      [COMPANY, at(9)],
    )
  ).rows[0].id;
  expect(
    (
      await db.query(
        "select * from public.s08_analyze_expense_misclassification($1,$2) where expense_id=$3",
        [COMPANY, period, result.expense_id],
      )
    ).rows,
  ).toEqual([]);
  await db.exec("reset role");
  await expect(
    db.query(
      "update public.expense_owner_allocations set allocation_evidence=$1 where expense_id=$2",
      ["Rewrite evidence", result.expense_id],
    ),
  ).rejects.toThrow(/IMMUTABLE/);
});
it("rejects an unrelated owner without persisting any expense, allocation or journal", async () => {
  const before = (
    await db.query("select id from public.journal_batches order by id")
  ).rows;
  const p = payload();
  p.owner_allocations[0].owner_id = OTHER;
  await db.exec("savepoint bad_owner");
  await expect(
    command(db, "create_expense_with_journal_atomic", p),
  ).rejects.toThrow(/ALLOCATION_OWNER_FORBIDDEN/);
  await db.exec("rollback to savepoint bad_owner");
  expect(
    (await db.query("select id from public.journal_batches order by id")).rows,
  ).toEqual(before);
  expect(
    (await db.query("select * from public.expense_owner_allocations")).rows,
  ).toEqual([]);
});
it("keeps allocation source immutable through ordinary expense edits", async () => {
  const r = await command(db, "create_expense_with_journal_atomic", payload());
  await command(db, "update_expense_with_journal_atomic", {
    expense_id: r.expense_id,
    description: "Clarified receipt text",
    request_id: crypto.randomUUID(),
  });
  await expect(
    command(db, "update_expense_with_journal_atomic", {
      expense_id: r.expense_id,
      amount: 31,
      request_id: crypto.randomUUID(),
    }),
  ).rejects.toThrow(/SOURCE_IMMUTABLE/);
});
it("isolates allocated source evidence and rejects cross-company creation", async () => {
  await command(db, "create_expense_with_journal_atomic", payload());
  await assumeIdentity(db, OTHER, OTHER_COMPANY);
  expect(
    (await db.query("select * from public.expense_owner_allocations")).rows,
  ).toEqual([]);
  await expect(
    command(db, "create_expense_with_journal_atomic", payload()),
  ).rejects.toThrow(/PROPERTY_FORBIDDEN/);
});
it("joins creation, versioned lawful offset, cash recovery and residual settlement without a double deduction", async () => {
  const f = await createOwnerOffsetFixture();
  const d = f.db;
  try {
    await command(d, "cancel_owner_settlement_atomic", {
      settlement_id: f.settlement,
      request_id: crypto.randomUUID(),
      reason: "Replace with owner-wide source-scoped settlement",
    });
    const p = {
      ...payload(),
      property_id: f.property,
      owner_allocations: [
        { owner_id: OWNER, owner_agreement_id: f.agreement, amount: 30.125 },
      ],
    };
    const e = await command(d, "create_expense_with_journal_atomic", p);
    const source = (
      await d.query<{ id: string; owner_agreement_version_id: string }>(
        "select id,owner_agreement_version_id from public.due_from_owners where source_id=$1",
        [e.expense_id],
      )
    ).rows[0];
    expect(source.owner_agreement_version_id).toBeTruthy();
    const draft = await command(d, "create_owner_settlement_draft_atomic", {
      owner_id: OWNER,
      period_start: at(1),
      period_end: at(28),
      request_id: crypto.randomUUID(),
    });
    expect(Number(draft.net_payable)).toBe(1000);
    const settlement = String(draft.settlement_id);
    await assumeIdentity(d, "c2000000-0000-4000-8000-000000000099", COMPANY);
    await command(d, "approve_owner_settlement_atomic", {
      settlement_id: settlement,
      request_id: crypto.randomUUID(),
    });
    await assumeIdentity(d, MAKER, COMPANY);
    const recovery = {
      due_from_owner_id: source.id,
      amount: 10,
      effective_date: at(10),
      cash_account_no: "1111",
      request_id: crypto.randomUUID(),
    };
    await command(d, "recover_owner_receivable_atomic", recovery);
    await command(d, "recover_owner_receivable_atomic", recovery);
    const offset = {
      due_from_owner_id: source.id,
      owner_settlement_id: settlement,
      amount: 20.125,
      effective_date: at(9),
      lawful_offset_evidence: "Approved allocation and settlement order",
      request_id: crypto.randomUUID(),
    };
    await command(d, "offset_owner_receivable_atomic", offset);
    await command(d, "offset_owner_receivable_atomic", offset);
    expect(
      (
        await d.query(
          "select outstanding::text from public.due_from_owners where id=$1",
          [source.id],
        )
      ).rows,
    ).toEqual([{ outstanding: "0.000" }]);
    const pay = {
      settlement_id: settlement,
      method: "cash",
      request_id: crypto.randomUUID(),
    };
    await expect(
      command(d, "pay_owner_settlement_atomic", pay),
    ).rejects.toThrow(/SELF_PAYMENT_DENIED/);
    await assumeIdentity(d, "c2000000-0000-4000-8000-000000000099", COMPANY);
    await command(d, "pay_owner_settlement_atomic", pay);
    await command(d, "pay_owner_settlement_atomic", pay);
    expect(
      (
        await d.query(
          "select account_no,subledger_balance::text as source,gl_balance::text as control from public.wp05_reconcile_all($1,$2::date) where account_no in ('1300','2000') order by account_no",
          [COMPANY, at(28)],
        )
      ).rows,
    ).toEqual([
      { account_no: "1300", source: "200.000", control: "200.000" },
      { account_no: "2000", source: "0.000", control: "0.000" },
    ]);
    // Reconstruct the earlier balance after later recovery and payout exist;
    // never use the current outstanding field as the historical balance.
    expect(
      (
        await d.query(
          "select subledger_balance::text as source,gl_balance::text as control from public.wp05_reconcile_all($1,$2::date) where account_no='1300'",
          [COMPANY, at(9)],
        )
      ).rows,
    ).toEqual([{ source: "210.000", control: "210.000" }]);
  } finally {
    await d.close();
  }
}, 60_000);
it("preserves pre-adoption history and cached expense identity on upgrade", async () => {
  const f = await createOfficeCreditorFixture({
    throughMigration: "20260909000011",
  });
  const d = f.db;
  try {
    await d.exec("set role authenticated");
    const { owner_allocations, allocation_evidence, ...old } = payload();
    const e = await command(d, "create_expense_with_journal_atomic", old);
    await d.exec("reset role");
    await d.query(
      "insert into public.company_members(company_id,user_id,role) values($1,$2,'ADMIN')",
      [COMPANY, OTHER],
    );
    await d.exec("set role authenticated");
    const oldDraft = await command(d, "create_owner_settlement_draft_atomic", {
      owner_id: OWNER,
      period_start: at(1),
      period_end: at(28),
      request_id: crypto.randomUUID(),
    });
    const approval = {
      settlement_id: oldDraft.settlement_id,
      request_id: "pre-adoption-approval",
    };
    await assumeIdentity(d, OTHER, COMPANY);
    await command(d, "approve_owner_settlement_atomic", approval);
    await assumeIdentity(d, MAKER, COMPANY);
    const period = (
      await d.query<{ id: string }>(
        "select id from public.accounting_periods where company_id=$1 and $2::date between start_date and end_date",
        [COMPANY, at(9)],
      )
    ).rows[0].id;
    const review = await command(d, "s08_create_frozen_review", {
      accounting_period_id: period,
      review_scope: { expense_ids: [e.expense_id] },
      dataset_lineage: "pre12-source-compatibility",
    });
    await d.query(
      "select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')",
      [review.id],
    );
    const batches = (
      await d.query("select * from public.journal_batches order by id")
    ).rows;
    await d.exec("reset role");
    await d.exec(
      readFileSync(
        `${repoRoot}/supabase/migrations/20260909000012_owner_expense_allocation_source.sql`,
        "utf8",
      ),
    );
    await d.exec("set role authenticated");
    expect(
      (await command(d, "create_expense_with_journal_atomic", old)).expense_id,
    ).toBe(e.expense_id);
    expect(
      (await d.query("select * from public.journal_batches order by id")).rows,
    ).toEqual(batches);
    expect(
      (
        await d.query(
          "select owner_allocation_version from public.expenses where id=$1",
          [e.expense_id],
        )
      ).rows,
    ).toEqual([{ owner_allocation_version: null }]);
    await assumeIdentity(d, OTHER, COMPANY);
    expect(
      (await command(d, "approve_owner_settlement_atomic", approval))
        .idempotent,
    ).toBe(true);
    // An unchanged pre12 server snapshot can still be independently reviewed.
    await d.query("select public.s08_approve_frozen_review($1::uuid,$2)", [
      review.id,
      "Verified unchanged historical source",
    ]);
    await expect(
      command(d, "pay_owner_settlement_atomic", {
        settlement_id: oldDraft.settlement_id,
        request_id: "unreviewed-old-pay",
        method: "cash",
      }),
    ).rejects.toThrow(/LEGACY_EXPENSE_REVIEW_REQUIRED/);
    await expect(
      command(d, "create_owner_settlement_draft_atomic", {
        owner_id: OWNER,
        period_start: at(1),
        period_end: at(27),
        request_id: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/LEGACY_EXPENSE_REVIEW_REQUIRED/);
    expect(
      (
        await d.query(
          "select status,paid_at from public.owner_settlements where id::text=$1",
          [oldDraft.settlement_id],
        )
      ).rows,
    ).toEqual([{ status: "APPROVED", paid_at: null }]);
    expect(
      (await d.query("select * from public.journal_batches order by id")).rows,
    ).toEqual(batches);
  } finally {
    await d.close();
  }
}, 60_000);
it("cannot create another standalone claim against an already allocated expense source", async () => {
  const r = await command(db, "create_expense_with_journal_atomic", payload());
  await expect(
    command(db, "create_owner_receivable_atomic", {
      owner_id: OWNER,
      property_id: PROPERTY,
      source_id: r.expense_id,
      amount: 1,
      effective_date: at(9),
      request_id: crypto.randomUUID(),
    }),
  ).rejects.toThrow(/SOURCE_ALREADY_ALLOCATED/);
});
it("retains missing pre-upgrade source lineage as an explicit history failure", async () => {
  const f = await createOfficeCreditorFixture({
    throughMigration: "20260909000011",
  });
  const d = f.db;
  try {
    const r = await command(d, "create_owner_receivable_atomic", {
      owner_id: OWNER,
      amount: 10,
      effective_date: at(1),
      request_id: crypto.randomUUID(),
    });
    await d.exec("reset role");
    await d.query(
      "update public.due_from_owners set journal_batch_id=null where id=$1",
      [r.due_from_owner_id],
    );
    await d.exec(
      readFileSync(
        `${repoRoot}/supabase/migrations/20260909000012_owner_expense_allocation_source.sql`,
        "utf8",
      ),
    );
    await d.exec("set role authenticated");
    await expect(
      d.query(
        "select * from public.wp05_subledger_due_from_owner($1,$2::date)",
        [COMPANY, at(28)],
      ),
    ).rejects.toThrow(/OWNER_RECEIVABLE_HISTORY_EVENT_GAP/);
  } finally {
    await d.close();
  }
}, 60_000);
it("closes a fully offset settlement without inventing another cash payout or owner-funds event", async () => {
  const f = await createOwnerOffsetFixture();
  const d = f.db;
  try {
    const e = await command(d, "create_expense_with_journal_atomic", {
      ...payload(),
      property_id: f.property,
      amount: 1000,
      owner_allocations: [
        { owner_id: OWNER, owner_agreement_id: f.agreement, amount: 1000 },
      ],
    });
    const id = (
      await d.query<{ id: string }>(
        "select id from public.due_from_owners where source_id=$1",
        [e.expense_id],
      )
    ).rows[0].id;
    await command(d, "offset_owner_receivable_atomic", {
      due_from_owner_id: id,
      owner_settlement_id: f.settlement,
      amount: 1000,
      effective_date: at(9),
      lawful_offset_evidence: "Approved full offset order",
      request_id: crypto.randomUUID(),
    });
    await assumeIdentity(d, "c2000000-0000-4000-8000-000000000099", COMPANY);
    const result = await command(d, "pay_owner_settlement_atomic", {
      settlement_id: f.settlement,
      method: "cash",
      request_id: crypto.randomUUID(),
    });
    expect(result.journal_batch_id).toBeNull();
    expect(
      (
        await d.query(
          "select * from public.owner_funds_events where source_type='OWNER_SETTLEMENT_PAYOUT' and source_id=$1",
          [f.settlement],
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await d.query(
          "select subledger_balance::text,gl_balance::text from public.wp05_reconcile_all($1,$2::date) where account_no='2000'",
          [COMPANY, at(28)],
        )
      ).rows,
    ).toEqual([{ subledger_balance: "0.000", gl_balance: "0.000" }]);
  } finally {
    await d.close();
  }
}, 60_000);
it("preserves exact OMR cost and returns the same closure after a lost acknowledgement", async () => {
  const id = (
    await db.query<{ data: { maintenance: { id: string } } }>(
      "select public.create_maintenance_atomic(p_property_id:=$1,p_title:='Owner repair',p_request_id:=$2) as data",
      [PROPERTY, crypto.randomUUID()],
    )
  ).rows[0].data.maintenance.id;
  await db.query(
    "select public.transition_maintenance_status_atomic($1,'in_progress',null)",
    [id],
  );
  await db.query(
    "select public.transition_maintenance_status_atomic($1,'resolved',null)",
    [id],
  );
  const args = [id, JSON.stringify([{ owner_id: OWNER, amount: 30.125 }])];
  const query =
    "select public.close_maintenance_with_expense($1,30.125,'OWNER','Approved repair',null,true,$2::jsonb,'Approved allocation') as data";
  const a = (
    await db.query<{
      data: { maintenance: { cost: number }; expense_id: string };
    }>(query, args)
  ).rows[0].data;
  expect(Number(a.maintenance.cost)).toBe(30.125);
  expect((await db.query<{ data: unknown }>(query, args)).rows[0].data).toEqual(
    a,
  );
  expect(
    (
      await db.query(
        "select amount::text from public.due_from_owners where source_id=$1",
        [a.expense_id],
      )
    ).rows,
  ).toEqual([{ amount: "30.125" }]);
});

it("retains valid technical completion but retires the duplicate unposted maintenance expense writer", async () => {
  const id = (
    await db.query<{ data: { maintenance: { id: string } } }>(
      "select public.create_maintenance_atomic(p_property_id:=$1,p_title:='Legacy completion',p_request_id:=$2) as data",
      [PROPERTY, crypto.randomUUID()],
    )
  ).rows[0].data.maintenance.id;
  await db.query(
    "select public.transition_maintenance_status_atomic($1,'in_progress',null)",
    [id],
  );
  await db.exec("savepoint legacy_completion");
  await expect(
    db.query("select public.resolve_maintenance_with_expense($1,30.125,null)", [
      id,
    ]),
  ).rejects.toThrow(/USE_VERIFIED_FINANCIAL_CLOSURE/);
  await db.exec("rollback to savepoint legacy_completion");
  expect((await db.query("select * from public.expenses")).rows).toEqual([]);
  const r = (
    await db.query<{ data: { maintenance: { status: string } } }>(
      "select public.resolve_maintenance_with_expense($1,0,null) as data",
      [id],
    )
  ).rows[0].data;
  expect(r.maintenance.status).toBe("resolved");
});

it("enforces allocation completeness when deferred constraints actually fire", async () => {
  await command(db, "create_expense_with_journal_atomic", payload());
  await db.exec("set constraints all immediate");
  await db.exec(
    "set constraints all deferred; reset role; savepoint incomplete_source",
  );
  await db.query(
    "insert into public.expenses(property_id,category,amount,expense_date,company_id,charged_to,status,owner_allocation_version) values($1,'maintenance',1,$2::date,$3,'OWNER','POSTED',1)",
    [PROPERTY, at(9), COMPANY],
  );
  await expect(db.exec("set constraints all immediate")).rejects.toThrow(
    /ALLOCATION_INCOMPLETE/,
  );
  await db.exec("rollback to incomplete_source; set role authenticated");
});

it("applies an independently approved and validated pre12 S09 plan after upgrade without changing its source", async () => {
  const { db: d } = await createOfficeCreditorFixture({
    throughMigration: "20260909000011",
  });
  try {
    await d.query(
      "insert into public.company_members(company_id,user_id,role) values($1,$2,'ADMIN')",
      [COMPANY, OTHER],
    );
    await d.exec("set role authenticated");
    const { owner_allocations, allocation_evidence, ...old } = payload();
    const expense = await command(d, "create_expense_with_journal_atomic", old);
    const period = (
      await d.query<{ id: string }>(
        "select id from public.accounting_periods where company_id=$1 and $2::date between start_date and end_date",
        [COMPANY, at(9)],
      )
    ).rows[0].id;
    const review = await command(d, "s08_create_frozen_review", {
      accounting_period_id: period,
      review_scope: { expense_ids: [expense.expense_id] },
      dataset_lineage: "pre12-approved-plan",
    });
    await d.query(
      "select public.s08_analyze_frozen_review($1::uuid,'{}','{}','[]')",
      [review.id],
    );
    await assumeIdentity(d, OTHER, COMPANY);
    await d.query("select public.s08_approve_frozen_review($1::uuid,$2)", [
      review.id,
      "Independent source classification approval",
    ]);
    await assumeIdentity(d, MAKER, COMPANY);
    const proposal = {
      accounting_period_id: period,
      review_id: review.id,
      source_type: "expense",
      source_id: expense.expense_id,
      source_scope: { dataset_lineage: "pre12-approved-plan" },
      reason: "Reviewed historical classification",
      amount: 30.125,
      debit_account_no: "1300",
      credit_account_no: "6100",
      request_id: crypto.randomUUID(),
    };
    const correction = await command(
      d,
      "s09_create_correction_draft",
      proposal,
    );
    await d.query("select public.s09_validate_correction($1::uuid)", [
      correction.id,
    ]);
    const batches = (
      await d.query("select * from public.journal_batches order by id")
    ).rows;
    const original = (
      await d.query(
        "select to_jsonb(e) as data from public.expenses e where id=$1",
        [expense.expense_id],
      )
    ).rows;
    const frozen = (
      await d.query(
        "select to_jsonb(r) as data from public.s08_frozen_reviews r where id=$1",
        [review.id],
      )
    ).rows;
    await d.exec("reset role");
    await d.exec(
      readFileSync(
        `${repoRoot}/supabase/migrations/20260909000012_owner_expense_allocation_source.sql`,
        "utf8",
      ),
    );
    await d.exec("set role authenticated");
    expect(
      (await d.query("select * from public.journal_batches order by id")).rows,
    ).toEqual(batches);
    expect(
      (
        await d.query(
          "select to_jsonb(e)-'owner_allocation_version' as data from public.expenses e where id=$1",
          [expense.expense_id],
        )
      ).rows,
    ).toEqual(original);
    expect(
      (
        await d.query(
          "select to_jsonb(r) as data from public.s08_frozen_reviews r where id=$1",
          [review.id],
        )
      ).rows,
    ).toEqual(frozen);
    expect((await command(d, "s09_create_correction_draft", proposal)).id).toBe(
      correction.id,
    );
    await d.query("select public.s09_apply_correction($1::uuid)", [
      correction.id,
    ]);
    const applied = (
      await d.query("select * from public.journal_batches order by id")
    ).rows;
    expect(applied).toHaveLength(batches.length + 1);
    expect(applied).toEqual(expect.arrayContaining(batches));
    await expect(
      d.query("select public.s09_apply_correction($1::uuid)", [correction.id]),
    ).rejects.toThrow(/S09_APPLY_STATUS_INVALID/);
    expect(
      (await d.query("select * from public.journal_batches order by id")).rows,
    ).toEqual(applied);
    for (const [day, balance] of [
      [8, "0.000"],
      [9, "30.125"],
    ] as const)
      expect(
        (
          await d.query(
            "select subledger_balance::text as source,gl_balance::text as control from public.wp05_reconcile_all($1,$2::date) where account_no='1300'",
            [COMPANY, at(day)],
          )
        ).rows,
      ).toEqual([{ source: balance, control: balance }]);
    // Accounting classification approval does not invent allocation or offset law.
    await expect(
      command(d, "create_owner_settlement_draft_atomic", {
        owner_id: OWNER,
        period_start: at(1),
        period_end: at(28),
        request_id: crypto.randomUUID(),
      }),
    ).rejects.toThrow(/LEGACY_EXPENSE_REVIEW_REQUIRED/);
  } finally {
    await d.close();
  }
}, 60_000);
