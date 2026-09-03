import { describe, expect, it } from "vitest";
import evaluationCases from "./ai-assistant-evaluation.json";
import {
  deterministicResponse,
  fallbackResponse,
  isHighRiskInstruction,
  validateAssistantRequest,
} from "../../../../../supabase/functions/_shared/ai-safety";
import {
  AI_KB_VERSION,
  BUSINESS_KB_MAX_CHARS,
  BUSINESS_KB_SOURCES,
  BUSINESS_KB_TEXT,
} from "../../../../../supabase/functions/_shared/ai-business-kb";
import {
  PLANNING_INTENTS,
  validateAssistantOutput,
  validateAssistantPlanning,
} from "../../../../../supabase/functions/_shared/ai-contract";

const requestId = "018f4f36-7c7a-7c2a-8b1d-2c3d4e5f6071";
const context = {
  asOf: "2026-08-19",
  sampleLimit: 500,
  overdueInvoices: {
    invoiceCount: 2,
    totalOutstanding: 12.345,
    oldestDueDate: "2026-08-01",
    topInvoices: [],
  },
  contractRenewals: {
    lookaheadDays: 90,
    contractCount: 1,
    totalRentAmount: 250,
    upcomingContracts: [],
  },
  propertyFinancialSnapshot: {
    propertyCount: 2,
    activePropertyCount: 2,
    unitCount: 4,
    occupiedUnitCount: 3,
    vacantUnitCount: 1,
    occupancyRate: 75,
    outstandingInvoiceAmount: 12.345,
    expensesLast90Days: 4.5,
  },
  reportSummary: {
    invoicesLast30Days: 1,
    invoiceAmountLast30Days: 12.345,
    paymentsLast30Days: 1,
    paymentAmountLast30Days: 5,
    expensesLast30Days: 1,
    expenseAmountLast30Days: 4.5,
  },
};

function validateCase(testCase: (typeof evaluationCases)[number]) {
  return validateAssistantRequest({
    requestId,
    prompt: testCase.prompt,
    action: testCase.action,
    context,
    history: [],
  });
}

describe("AI assistant evaluation set", () => {
  it("covers the required safe representative categories", () => {
    const categories = new Set(evaluationCases.map((entry) => entry.category));
    for (const required of [
      "success_ar",
      "multilingual",
      "ambiguity",
      "adversarial",
      "refusal",
      "unsafe_input",
      "malformed_input",
    ]) {
      expect(categories.has(required)).toBe(true);
    }
  });

  it.each(evaluationCases.filter((entry) => entry.expect === "deterministic"))(
    "$id uses deterministic code rather than a paid model",
    (testCase) => {
      const result = validateCase(testCase);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const output = deterministicResponse(result.value);
        expect(output?.grounded).toBe(true);
        expect(output?.answer).toMatch(/[\u0600-\u06ff]/);
      }
    },
  );

  it("answers vacancy from an explicit context fact", () => {
    const result = validateAssistantRequest({
      requestId,
      prompt: "عندي كام وحدة فاضية؟",
      action: "summarize_vacancy",
      context,
      history: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = deterministicResponse(result.value);
      expect(output?.grounded).toBe(true);
      expect(output?.answer).toContain("1 وحدة شاغرة");
      expect(output?.answer).toContain("75.00٪");
    }
  });

  it("builds the month summary only from allowed 30-day facts", () => {
    const result = validateAssistantRequest({
      requestId,
      prompt: "اعمل لي ملخص الشهر ده",
      action: "summarize_month",
      context,
      history: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = deterministicResponse(result.value);
      expect(output?.grounded).toBe(true);
      expect(output?.answer).toContain("آخر 30 يوماً");
      expect(output?.answer).toContain("5.000 ر.ع.");
    }
  });

  it.each(evaluationCases.filter((entry) => entry.expect === "refusal"))(
    "$id refuses before provider use",
    (testCase) => {
      const result = validateCase(testCase);
      expect(result.ok).toBe(true);
      if (result.ok)
        expect(isHighRiskInstruction(result.value.prompt)).toBe(true);
    },
  );

  it.each(
    evaluationCases.filter((entry) => entry.expect === "validation_error"),
  )("$id fails closed during validation", (testCase) => {
    expect(validateCase(testCase).ok).toBe(false);
  });

  it("returns a safe generic draft when the provider fails", () => {
    const result = validateAssistantRequest({
      requestId,
      prompt: "اكتب تذكيراً مهذباً",
      action: "draft_tenant_payment_reminder",
      context,
      history: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const fallback = fallbackResponse(result.value);
      expect(fallback.grounded).toBe(false);
      expect(fallback.answer).not.toContain("12.345");
      expect(fallback.caveats.join(" ")).toContain("مراجعة");
    }
  });

  it("rejects malformed or oversized structured model output", () => {
    expect(
      validateAssistantOutput({ answer: "رد", grounded: true, caveats: [] }),
    ).toEqual({ answer: "رد", grounded: true, caveats: [] });
    expect(
      validateAssistantOutput({ answer: "", grounded: true, caveats: [] }),
    ).toBeNull();
    expect(
      validateAssistantOutput({ answer: "رد", grounded: "yes", caveats: [] }),
    ).toBeNull();
    expect(
      validateAssistantOutput({
        answer: "رد",
        grounded: true,
        caveats: Array(6).fill("تنبيه"),
      }),
    ).toBeNull();
  });

  it("rejects context fields outside the explicit data minimization contract", () => {
    const result = validateAssistantRequest({
      requestId,
      prompt: "لخص البيانات",
      action: "freeform",
      context: { ...context, tenantPassword: "secret" },
      history: [],
    });
    expect(result.ok).toBe(false);
  });

  it("validates planning intents against the closed action union plus advisory", () => {
    expect(validateAssistantPlanning({ intent: "freeform" })).toEqual({ intent: "freeform" });
    expect(validateAssistantPlanning({ intent: "summarize_overdue_invoices" })).toEqual({
      intent: "summarize_overdue_invoices",
    });
    expect(validateAssistantPlanning({ intent: "advisory" })).toEqual({ intent: "advisory" });
    // Unknown or free-text intents must fail closed.
    expect(validateAssistantPlanning({ intent: "delete_company" })).toBeNull();
    expect(validateAssistantPlanning({ intent: "SELECT * FROM users" })).toBeNull();
    expect(validateAssistantPlanning({})).toBeNull();
    expect(validateAssistantPlanning(null)).toBeNull();
  });

  it("keeps the business knowledge base versioned, bounded and fully cited", () => {
    expect(AI_KB_VERSION).toMatch(/^malek-biz-om-v\d+$/);
    // The KB must always fit the prompt window with headroom.
    expect(BUSINESS_KB_TEXT.length).toBeGreaterThan(500);
    expect(BUSINESS_KB_TEXT.length).toBeLessThanOrEqual(BUSINESS_KB_MAX_CHARS);
    // Every entry is an https source with an access date.
    expect(BUSINESS_KB_SOURCES.length).toBeGreaterThanOrEqual(3);
    for (const source of BUSINESS_KB_SOURCES) {
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.name.length).toBeGreaterThan(0);
    }
    // The KB carries the mandatory advisory disclaimer.
    expect(BUSINESS_KB_TEXT).toContain("تقديرات إرشادية");
    // The closed planning union includes advisory alongside the real actions.
    expect(PLANNING_INTENTS).toContain("advisory");
    expect(PLANNING_INTENTS).toContain("freeform");
  });
});
