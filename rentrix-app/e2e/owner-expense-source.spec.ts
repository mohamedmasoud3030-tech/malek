import { expect, test } from "@playwright/test";
import { COMPANY, MAKER, OWNER } from "../src/test/office-creditor-fixture";
import {
  createOwnerOffsetFixture,
  offsetFixtureCommand as command,
  offsetDate as at,
} from "../src/test/owner-offset-fixture";
import { assumeIdentity } from "../src/p1/replay-bootstrap";
import { installAcceptanceBrowser } from "./support/document-acceptance-session";
import { installFakeSupabaseBackend } from "./support/fake-supabase-backend";

test("OWNER entry retains allocation on uncertain response and reconciles after lawful recovery and settlement", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const f = await createOwnerOffsetFixture();
  const db = f.db;
  try {
    await db.exec("set role authenticated");
    await assumeIdentity(db, MAKER, COMPANY);
    await installAcceptanceBrowser(page);
    const seed = await installFakeSupabaseBackend(page);
    seed.tables.service_provider_categories = [];
    seed.tables.service_providers = [];
    seed.tables.properties = (
      await db.query<Record<string, unknown>>("select * from public.properties")
    ).rows;
    await page.route(/\/rest\/v1\/property_owners(?:\?|$)/, async (route) => {
      const rows = (
        await db.query(
          "select po.*,to_jsonb(o) as owner from public.property_owners po join public.owners o on o.id=po.owner_id where po.property_id=$1",
          [f.property],
        )
      ).rows;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    });
    await page.route(/\/rest\/v1\/owner_agreements(?:\?|$)/, async (route) => {
      const rows = (
        await db.query(
          "select * from public.owner_agreements where property_id=$1",
          [f.property],
        )
      ).rows;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    });
    await page.route(/\/rest\/v1\/expenses(?:\?|$)/, async (route) => {
      const rows = (
        await db.query(
          "select * from public.expenses order by expense_date desc,id",
        )
      ).rows;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    });
    let lose = true;
    const requests: string[] = [];
    let expense = "";
    await page.route(
      "**/rest/v1/rpc/create_expense_with_journal_atomic",
      async (route) => {
        const { p_payload } = route.request().postDataJSON();
        requests.push(p_payload.request_id);
        try {
          const result = await command(
            db,
            "create_expense_with_journal_atomic",
            p_payload,
          );
          expense = String(result.expense_id);
          if (lose) {
            lose = false;
            await route.abort("failed");
            return;
          }
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(result),
          });
        } catch (error) {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: String(error) }),
          });
        }
      },
    );
    await page.goto("/financials?section=expenses&view=expenses");
    await page
      .getByRole("button", { name: "إضافة مصروف", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "إضافة مصروف" });
    await dialog.locator('select[name="property_id"]').selectOption(f.property);
    await dialog.locator('select[name="charged_to"]').selectOption("OWNER");
    await dialog.locator('input[name="amount"]').fill("30.125");
    await dialog.locator('input[name="expense_date"]').fill(at(9));
    await dialog
      .getByRole("button", { name: "إضافة توزيع", exact: true })
      .click();
    await dialog
      .getByRole("combobox", { name: "المالك 1", exact: true })
      .selectOption(OWNER);
    await dialog
      .getByRole("spinbutton", { name: "المبلغ المخصص 1", exact: true })
      .fill("30.125");
    await dialog
      .getByRole("combobox", { name: "الاتفاقية المرجعية 1", exact: true })
      .selectOption(f.agreement);
    await dialog
      .getByRole("textbox", { name: "مرجع اعتماد التوزيع", exact: true })
      .fill("Approved repair allocation and agreement");
    await dialog
      .getByRole("button", { name: "حفظ المصروف", exact: true })
      .click();
    await expect(
      page.getByText("تعذر تأكيد إضافة المصروف. راجع السجل ثم أعد المحاولة."),
    ).toBeVisible();
    await expect(
      dialog.getByRole("spinbutton", { name: "المبلغ المخصص 1", exact: true }),
    ).toHaveValue("30.125");
    await dialog
      .getByRole("button", { name: "حفظ المصروف", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    expect(requests).toHaveLength(2);
    expect(requests[0]).toBe(requests[1]);
    const dfo = (
      await db.query<{
        id: string;
        amount: string;
        owner_agreement_version_id: string;
      }>(
        "select id,amount::text,owner_agreement_version_id from public.due_from_owners where source_id=$1",
        [expense],
      )
    ).rows;
    expect(dfo).toHaveLength(1);
    expect(dfo[0].amount).toBe("30.125");
    expect(dfo[0].owner_agreement_version_id).toBeTruthy();
    // Existing governed commands, not a claim that their management UI is built.
    await command(db, "cancel_owner_settlement_atomic", {
      settlement_id: f.settlement,
      request_id: crypto.randomUUID(),
      reason: "Owner-wide settlement",
    });
    const draft = await command(db, "create_owner_settlement_draft_atomic", {
      owner_id: OWNER,
      period_start: at(1),
      period_end: at(28),
      request_id: crypto.randomUUID(),
    });
    expect(Number(draft.net_payable)).toBe(1000);
    await assumeIdentity(db, "c2000000-0000-4000-8000-000000000099", COMPANY);
    await command(db, "approve_owner_settlement_atomic", {
      settlement_id: draft.settlement_id,
      request_id: crypto.randomUUID(),
    });
    await command(db, "recover_owner_receivable_atomic", {
      due_from_owner_id: dfo[0].id,
      amount: 10,
      effective_date: at(9),
      request_id: crypto.randomUUID(),
    });
    await command(db, "offset_owner_receivable_atomic", {
      due_from_owner_id: dfo[0].id,
      owner_settlement_id: draft.settlement_id,
      amount: 20.125,
      effective_date: at(9),
      lawful_offset_evidence: "Approved order and agreement",
      request_id: crypto.randomUUID(),
    });
    await command(db, "pay_owner_settlement_atomic", {
      settlement_id: draft.settlement_id,
      method: "cash",
      request_id: crypto.randomUUID(),
    });
    const offsetEvent = (await db.query<{id:string}>('select id from public.due_from_owner_offsets where due_from_owner_id=$1',[dfo[0].id])).rows[0].id;
    const paidEvidence = (await db.query('select * from public.owner_settlements where id=$1',[draft.settlement_id])).rows;
    await expect(command(db,'reverse_owner_receivable_offset_atomic',{offset_event_id:offsetEvent,request_id:crypto.randomUUID(),reason:'Attempt after completed payout'})).rejects.toThrow(/PAID_SETTLEMENT_REQUIRES_GOVERNED_ADJUSTMENT/);
    expect((await db.query('select * from public.owner_settlements where id=$1',[draft.settlement_id])).rows).toEqual(paidEvidence);
    await page.route("**/rest/v1/rpc/wp05_reconcile_all", async (route) => {
      const { p_as_of } = route.request().postDataJSON();
      const rows = (
        await db.query("select * from public.wp05_reconcile_all($1,$2::date)", [
          COMPANY,
          p_as_of,
        ])
      ).rows;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    });
    await page.route("**/rest/v1/rpc/rpt_trial_balance", async (route) => {
      const { p_as_of } = route.request().postDataJSON();
      const result = (
        await db.query("select public.rpt_trial_balance($1::date) as data", [
          p_as_of,
        ])
      ).rows[0].data;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    });
    await page.goto(
      `/reports/financial-settlement-pack?view=statements&asOf=${at(28)}`,
    );
    await expect(page.getByText(/جاهز — 6 فحوص/)).toBeVisible();
    expect(
      (
        await db.query(
          "select subledger_balance::text,gl_balance::text from public.wp05_reconcile_all($1,$2::date) where account_no='2000'",
          [COMPANY, at(28)],
        )
      ).rows,
    ).toEqual([{ subledger_balance: "0.000", gl_balance: "0.000" }]);
    // The maintenance UI uses the same allocation authority. A mismatched
    // acknowledgement must retain the form, while a retry creates no duplicate.
    await assumeIdentity(db, MAKER, COMPANY);
    const m = (
      await db.query<{ data: { maintenance: { id: string } } }>(
        "select public.create_maintenance_atomic(p_property_id:=$1::text,p_title:='صيانة توزيع موثقة',p_priority:='medium',p_request_id:=$2::text) as data",
        [f.property, crypto.randomUUID()],
      )
    ).rows[0].data.maintenance;
    for (const status of ["in_progress", "resolved"])
      await db.query(
        "select public.transition_maintenance_status_atomic($1,$2)",
        [m.id, status],
      );
    await page.route(
      /\/rest\/v1\/maintenance_records(?:\?|$)/,
      async (route) => {
        const rows = (
          await db.query(
            "select * from public.maintenance_records where company_id=$1",
            [COMPANY],
          )
        ).rows;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(rows),
        });
      },
    );
    const closureRequests: string[] = [];
    await page.route(
      "**/rest/v1/rpc/close_maintenance_with_expense",
      async (route) => {
        const p = route.request().postDataJSON();
        closureRequests.push(JSON.stringify(p));
        try {
          const result = (
            await db.query<{
              data: {
                maintenance: Record<string, unknown>;
                expense_id: string;
              };
            }>(
              "select public.close_maintenance_with_expense($1,$2,$3,$4,$5,$6,$7::jsonb,$8) as data",
              [
                p.p_request_id,
                p.p_cost,
                p.p_charged_to,
                p.p_notes,
                p.p_evidence_url,
                p.p_confirmed,
                JSON.stringify(p.p_owner_allocations),
                p.p_allocation_evidence,
              ],
            )
          ).rows[0].data;
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(
              closureRequests.length === 1
                ? {
                    ...result,
                    maintenance: { ...result.maintenance, cost: 42.124 },
                  }
                : result,
            ),
          });
        } catch (error) {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: String(error) }),
          });
        }
      },
    );
    await page.goto("/maintenance");
    if ((page.viewportSize()?.width ?? 1280) < 640) {
      await page
        .getByRole("button", {
          name: "المزيد حول صيانة توزيع موثقة",
          exact: true,
        })
        .click();
      await page
        .getByRole("menuitem", { name: "إغلاق بعد التحقق", exact: true })
        .click();
    } else {
      await page
        .getByRole("button", { name: "إجراءات الطلب", exact: true })
        .click();
      await page
        .getByRole("menuitem", { name: "إغلاق بعد التحقق", exact: true })
        .click();
    }
    const closeDialog = page.getByRole("dialog", {
      name: "إغلاق الصيانة بعد التحقق",
    });
    await closeDialog.locator('input[name="cost"]').fill("42.125");
    await closeDialog
      .getByRole("button", { name: /المالك \(ذمة مدينة\)/ })
      .click();
    await closeDialog
      .getByRole("button", { name: "إضافة توزيع", exact: true })
      .click();
    await closeDialog
      .getByRole("combobox", { name: "المالك 1", exact: true })
      .selectOption(OWNER);
    await closeDialog
      .getByRole("spinbutton", { name: "المبلغ المخصص 1", exact: true })
      .fill("42.125");
    await closeDialog
      .getByRole("textbox", { name: "مرجع اعتماد التوزيع", exact: true })
      .fill("Approved maintenance invoice");
    await closeDialog.getByRole("checkbox").check();
    await closeDialog
      .getByRole("button", { name: "تأكيد الإغلاق النهائي", exact: true })
      .click();
    await expect(
      page.getByText(/استجابة الإغلاق لا تطابق الطلب أو التكلفة/),
    ).toBeVisible();
    await expect(closeDialog.locator('input[name="cost"]')).toHaveValue(
      "42.125",
    );
    await closeDialog
      .getByRole("button", { name: "تأكيد الإغلاق النهائي", exact: true })
      .click();
    await expect(closeDialog).toBeHidden();
    expect(closureRequests).toHaveLength(2);
    expect(closureRequests[0]).toBe(closureRequests[1]);
    expect(
      (
        await db.query(
          "select m.status,m.cost::text,d.amount::text,d.lawful_offset_right from public.maintenance_records m join public.due_from_owners d on d.source_id=m.expense_id::text where m.id::text=$1",
          [m.id],
        )
      ).rows,
    ).toEqual([
      {
        status: "closed",
        cost: "42.125",
        amount: "42.125",
        lawful_offset_right: false,
      },
    ]);
    await page.goto(
      `/reports/financial-settlement-pack?view=statements&asOf=${at(28)}`,
    );
    await expect(page.getByText(/جاهز — 6 فحوص/)).toBeVisible();
  } finally {
    await db.close();
  }
});
