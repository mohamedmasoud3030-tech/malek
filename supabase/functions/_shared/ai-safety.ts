import {
  AI_ACTIONS,
  type AiAction,
  type AssistantOutput,
  type ChatMessage,
  type JsonObject,
  type ValidatedAssistantRequest,
  isRecord,
  readBoundedString,
} from "./ai-contract.ts";

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sqlStatementPattern =
  /\b(select|insert|update|delete|drop|alter|truncate|create|grant|revoke)\b[\s\S]*(\bfrom\b|\binto\b|\btable\b|\bset\b|;)/i;
const highRiskInstructionPattern =
  /(ignore|تجاهل).{0,40}(system|developer|instructions?|التعليمات|النظام)|\b(api[_ -]?key|password|secret|token|environment variables?|system prompt)\b|\b(مفتاح|كلمة مرور|رمز).{0,24}(api|سري|الدخول)|تعليمات النظام/i;
const contextKeyContract: Readonly<Record<string, readonly string[]>> = {
  root: [
    "asOf",
    "sampleLimit",
    "overdueInvoices",
    "contractRenewals",
    "propertyFinancialSnapshot",
    "reportSummary",
  ],
  overdueInvoices: [
    "invoiceCount",
    "totalOutstanding",
    "oldestDueDate",
    "topInvoices",
  ],
  overdueInvoice: [
    "invoiceId",
    "contractId",
    "dueDate",
    "remainingAmount",
    "status",
  ],
  contractRenewals: [
    "lookaheadDays",
    "contractCount",
    "totalRentAmount",
    "upcomingContracts",
  ],
  contractRenewal: [
    "contractId",
    "propertyId",
    "tenantId",
    "unitId",
    "endDate",
    "rentAmount",
  ],
  propertyFinancialSnapshot: [
    "propertyCount",
    "activePropertyCount",
    "unitCount",
    "occupiedUnitCount",
    "vacantUnitCount",
    "occupancyRate",
    "outstandingInvoiceAmount",
    "expensesLast90Days",
  ],
  reportSummary: [
    "invoicesLast30Days",
    "invoiceAmountLast30Days",
    "paymentsLast30Days",
    "paymentAmountLast30Days",
    "expensesLast30Days",
    "expenseAmountLast30Days",
  ],
};
const allowedActions = new Set<string>(AI_ACTIONS);

export type RequestValidation =
  | { ok: true; value: ValidatedAssistantRequest }
  | { ok: false; code: string; message: string };

function readHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const result: ChatMessage[] = [];
  for (const entry of value.slice(-6)) {
    if (
      !isRecord(entry) ||
      (entry.role !== "user" && entry.role !== "assistant")
    )
      continue;
    const content = readBoundedString(entry.content, 1_200);
    if (content) result.push({ role: entry.role, content });
  }
  return result;
}

function isFiniteNumber(value: unknown): boolean {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= 1_000_000_000_000
  );
}

function validateJsonShape(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (value === null || typeof value === "boolean" || isFiniteNumber(value))
    return true;
  if (typeof value === "string") return value.length <= 200;
  if (Array.isArray(value))
    return (
      value.length <= 25 &&
      value.every((entry) => validateJsonShape(entry, depth + 1))
    );
  if (!isRecord(value) || Object.keys(value).length > 30) return false;
  return Object.values(value).every((entry) =>
    validateJsonShape(entry, depth + 1),
  );
}

function hasOnlyKeys(
  value: unknown,
  contractName: keyof typeof contextKeyContract,
): value is JsonObject {
  if (!isRecord(value)) return false;
  const allowed = new Set(contextKeyContract[contractName]);
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasStrictContextKeys(value: JsonObject): boolean {
  if (!hasOnlyKeys(value, "root")) return false;
  if (!hasOnlyKeys(value.overdueInvoices, "overdueInvoices")) return false;
  if (!hasOnlyKeys(value.contractRenewals, "contractRenewals")) return false;
  if (
    !hasOnlyKeys(value.propertyFinancialSnapshot, "propertyFinancialSnapshot")
  )
    return false;
  if (!hasOnlyKeys(value.reportSummary, "reportSummary")) return false;

  const overdueRows = value.overdueInvoices.topInvoices;
  const renewalRows = value.contractRenewals.upcomingContracts;
  return (
    Array.isArray(overdueRows) &&
    overdueRows.every((row) => hasOnlyKeys(row, "overdueInvoice")) &&
    Array.isArray(renewalRows) &&
    renewalRows.every((row) => hasOnlyKeys(row, "contractRenewal"))
  );
}

function readContext(value: unknown): JsonObject | null {
  if (!isRecord(value) || !hasStrictContextKeys(value)) return null;
  if (!validateJsonShape(value)) return null;
  const serialized = JSON.stringify(value);
  return serialized.length <= 9_000 ? value : null;
}

export function validateAssistantRequest(body: unknown): RequestValidation {
  if (!isRecord(body))
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "صيغة الطلب غير صحيحة.",
    };

  const requestId = readBoundedString(body.requestId, 64);
  const prompt = readBoundedString(body.prompt, 2_400);
  const rawAction = readBoundedString(body.action, 120) || "freeform";
  const context = readContext(body.context);

  if (!requestIdPattern.test(requestId))
    return {
      ok: false,
      code: "REQUEST_ID_REQUIRED",
      message: "معرّف الطلب غير صالح.",
    };
  if (!prompt || prompt.length < 3)
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      message: "اكتب سؤالاً واضحاً أو اختر إجراءً جاهزاً.",
    };
  if (!allowedActions.has(rawAction))
    return {
      ok: false,
      code: "ACTION_NOT_ALLOWED",
      message: "الإجراء المطلوب غير مدعوم.",
    };
  if (sqlStatementPattern.test(prompt))
    return {
      ok: false,
      code: "SQL_NOT_ACCEPTED",
      message: "لا يقبل المساعد أوامر SQL ولا ينفذ استعلامات مباشرة.",
    };
  if (!context)
    return {
      ok: false,
      code: "CONTEXT_INVALID",
      message: "تعذر التحقق من ملخص البيانات المسموح.",
    };

  return {
    ok: true,
    value: {
      requestId,
      prompt,
      action: rawAction as AiAction,
      context,
      history: readHistory(body.history),
    },
  };
}

export function isHighRiskInstruction(prompt: string): boolean {
  return highRiskInstructionPattern.test(prompt);
}

export function refusalForUnsafePrompt(): AssistantOutput {
  return {
    answer:
      "لا أستطيع كشف تعليمات النظام أو الأسرار أو بيانات الاعتماد. يمكنني المساعدة في سؤال تشغيلي قراءة فقط ضمن البيانات المصرح بها.",
    grounded: false,
    caveats: ["لم يُرسل هذا الطلب إلى مزود الذكاء الاصطناعي."],
  };
}

function readPath(
  context: JsonObject,
  section: string,
  field: string,
): unknown {
  const parent = context[section];
  return isRecord(parent) ? parent[field] : undefined;
}

function numberAt(context: JsonObject, section: string, field: string): number {
  const value = readPath(context, section, field);
  return isFiniteNumber(value) ? Number(value) : 0;
}

function stringAt(
  context: JsonObject,
  section: string,
  field: string,
): string | null {
  const value = readPath(context, section, field);
  return typeof value === "string" && value ? value : null;
}

function formatOmr(value: number): string {
  return `${value.toFixed(3)} ر.ع.`;
}

export function deterministicResponse(
  request: ValidatedAssistantRequest,
): AssistantOutput | null {
  const { context, action } = request;
  if (action === "summarize_overdue_invoices") {
    const count = numberAt(context, "overdueInvoices", "invoiceCount");
    const total = numberAt(context, "overdueInvoices", "totalOutstanding");
    const oldest = stringAt(context, "overdueInvoices", "oldestDueDate");
    return {
      answer: `يوجد ${count} فاتورة متأخرة بإجمالي متبقٍ ${formatOmr(total)}${oldest ? `، وأقدم تاريخ استحقاق هو ${oldest}` : ""}. ابدأ بالأقدم ثم الأعلى قيمة، وتحقق من حالة التحصيل قبل أي تواصل.`,
      grounded: true,
      caveats: ["الملخص قراءة فقط ومبني على لقطة البيانات الظاهرة وقت الطلب."],
    };
  }
  if (action === "summarize_contract_renewals") {
    const count = numberAt(context, "contractRenewals", "contractCount");
    const total = numberAt(context, "contractRenewals", "totalRentAmount");
    const days = numberAt(context, "contractRenewals", "lookaheadDays");
    return {
      answer: `هناك ${count} عقداً ضمن نافذة التجديد القادمة (${days} يوماً)، بإجمالي إيجارات مسجلة ${formatOmr(total)}. راجع العقود الأقرب انتهاءً وتأكد من الموافقات والوثائق قبل التجديد.`,
      grounded: true,
      caveats: ["لا يُعد هذا اعتماداً أو تجديداً للعقود."],
    };
  }
  if (action === "summarize_vacancy") {
    const vacant = numberAt(context, "propertyFinancialSnapshot", "vacantUnitCount");
    const units = numberAt(context, "propertyFinancialSnapshot", "unitCount");
    const occupancy = numberAt(context, "propertyFinancialSnapshot", "occupancyRate");
    return {
      answer: `لديك ${vacant} وحدة شاغرة من إجمالي ${units} وحدة، ونسبة الإشغال الحالية ${occupancy.toFixed(2)}٪. افتح تقرير الإشغال لمعرفة توزيع الشواغر على العقارات والوحدات.`,
      grounded: true,
      caveats: ["العدد قراءة فقط ومبني على حالة الوحدات المسجلة وقت الطلب."],
    };
  }
  if (action === "summarize_month") {
    const payments = numberAt(context, "reportSummary", "paymentAmountLast30Days");
    const paymentCount = numberAt(context, "reportSummary", "paymentsLast30Days");
    const expenses = numberAt(context, "reportSummary", "expenseAmountLast30Days");
    const expenseCount = numberAt(context, "reportSummary", "expensesLast30Days");
    const outstanding = numberAt(context, "overdueInvoices", "totalOutstanding");
    return {
      answer: `خلال آخر 30 يوماً تم تسجيل ${paymentCount} دفعة بإجمالي ${formatOmr(payments)}، و${expenseCount} مصروفاً بإجمالي ${formatOmr(expenses)}. الرصيد المتأخر الحالي ${formatOmr(outstanding)}. هذا ملخص تشغيلي سريع وليس إقفالاً أو تقريراً محاسبياً معتمداً.`,
      grounded: true,
      caveats: ["الملخص يستخدم آخر 30 يوماً حتى تاريخ الطلب، وليس فترة محاسبية مغلقة."],
    };
  }
  if (action === "explain_property_financial_snapshot") {
    const properties = numberAt(
      context,
      "propertyFinancialSnapshot",
      "propertyCount",
    );
    const units = numberAt(context, "propertyFinancialSnapshot", "unitCount");
    const occupancy = numberAt(
      context,
      "propertyFinancialSnapshot",
      "occupancyRate",
    );
    const outstanding = numberAt(
      context,
      "propertyFinancialSnapshot",
      "outstandingInvoiceAmount",
    );
    const expenses = numberAt(
      context,
      "propertyFinancialSnapshot",
      "expensesLast90Days",
    );
    return {
      answer: `تغطي اللقطة ${properties} عقاراً و${units} وحدة، ونسبة الإشغال ${occupancy.toFixed(2)}٪. المتبقي على الفواتير ${formatOmr(outstanding)}، والمصروفات خلال 90 يوماً ${formatOmr(expenses)}. هذه مؤشرات تشغيلية وليست ميزاناً أو تقريراً محاسبياً معتمداً.`,
      grounded: true,
      caveats: ["استخدم التقارير المعتمدة للتحقق المالي النهائي."],
    };
  }
  return null;
}

export function fallbackResponse(
  request: ValidatedAssistantRequest,
): AssistantOutput {
  if (request.action === "draft_tenant_payment_reminder") {
    return {
      answer:
        "مرحباً، نود تذكيركم بلطف بمراجعة الدفعة المستحقة وفق عقد الإيجار. يرجى التحقق من المبلغ وتاريخ الاستحقاق في السجل المعتمد، والتواصل مع المكتب إذا سبق السداد أو كانت لديكم ملاحظة. شكراً لتعاونكم.",
      grounded: false,
      caveats: [
        "مسودة عامة: يجب على موظف مخول مراجعة المستلم والمبلغ والتاريخ قبل الإرسال.",
        "لم يتم إرسال أي رسالة تلقائياً.",
      ],
    };
  }
  return {
    answer:
      "تعذر توليد تحليل موثوق الآن. استخدم الإجراءات الجاهزة للحصول على ملخص حتمي، أو راجع شاشة المصدر والتقارير المعتمدة.",
    grounded: false,
    caveats: ["لم تُنفذ أي عملية ولم تُعدّل أي بيانات."],
  };
}
