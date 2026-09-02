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
    // Contextual copilot additions (v3). Optional: a client that predates
    // them keeps working; a client that sends them is minimised the same way.
    "surface",
    "entity",
    "maintenanceSnapshot",
    "vacancyDetail",
    "propertyPerformance",
    "depositHeld",
  ],
  overdueInvoices: [
    "invoiceCount",
    "totalOutstanding",
    "oldestDueDate",
    "topInvoices",
    "dueTodayCount",
    "dueTodayAmount",
  ],
  overdueInvoice: [
    "invoiceId",
    "contractId",
    "dueDate",
    "remainingAmount",
    "status",
    "tenantName",
    "propertyName",
    "daysOverdue",
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
  // Where the user is right now (route → entity descriptor). No free text
  // beyond a bounded label; ids travel here and never into the answer.
  surface: ["route", "entityType", "entityId", "entityLabel", "section"],
  // Scoped snapshot of the entity the user is looking at. Structured fields
  // only — the server never re-queries and the client never ships free-form
  // "facts". Keys are a superset; each entity type populates its own subset.
  entity: [
    "type",
    "id",
    "name",
    "status",
    "propertyName",
    "unitName",
    "tenantName",
    "rentAmount",
    "monthlyRentAmount",
    "startDate",
    "endDate",
    "unitCount",
    "occupiedUnitCount",
    "activeContractCount",
    "propertyCount",
    "outstandingAmount",
    "oldestOverdueDate",
    "nextDueDate",
  ],
  maintenanceSnapshot: [
    "openCount",
    "inProgressCount",
    "urgentOpenCount",
    "stalledCount",
    "awaitingClosureCount",
    "oldestOpenAgeDays",
    "topRequests",
  ],
  maintenanceRequest: [
    "requestId",
    "propertyName",
    "issue",
    "priority",
    "status",
    "openedDate",
    "ageDays",
  ],
  vacancyDetail: ["topVacantUnits"],
  vacantUnit: ["unitId", "propertyName", "unitName"],
  propertyPerformance: ["topOutstanding"],
  propertyOutstanding: [
    "propertyId",
    "propertyName",
    "outstandingAmount",
    "openInvoiceCount",
  ],
  depositHeld: ["totalHeld", "heldCount"],
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

function hasOptionalSection(value: JsonObject, key: string, contractName: string): boolean {
  const section = value[key];
  if (section === undefined) return true;
  return hasOnlyKeys(section, contractName as keyof typeof contextKeyContract);
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
  if (!hasOptionalSection(value, "surface", "surface")) return false;
  if (!hasOptionalSection(value, "entity", "entity")) return false;
  if (!hasOptionalSection(value, "maintenanceSnapshot", "maintenanceSnapshot")) return false;
  if (!hasOptionalSection(value, "vacancyDetail", "vacancyDetail")) return false;
  if (!hasOptionalSection(value, "propertyPerformance", "propertyPerformance")) return false;
  if (!hasOptionalSection(value, "depositHeld", "depositHeld")) return false;

  const overdueRows = value.overdueInvoices.topInvoices;
  const renewalRows = value.contractRenewals.upcomingContracts;
  const requestRows = isRecord(value.maintenanceSnapshot)
    ? value.maintenanceSnapshot.topRequests
    : undefined;
  const vacantRows = isRecord(value.vacancyDetail)
    ? value.vacancyDetail.topVacantUnits
    : undefined;
  const propertyRows = isRecord(value.propertyPerformance)
    ? value.propertyPerformance.topOutstanding
    : undefined;
  return (
    Array.isArray(overdueRows) &&
    overdueRows.every((row) => hasOnlyKeys(row, "overdueInvoice")) &&
    Array.isArray(renewalRows) &&
    renewalRows.every((row) => hasOnlyKeys(row, "contractRenewal")) &&
    (requestRows === undefined ||
      (Array.isArray(requestRows) &&
        requestRows.every((row) => hasOnlyKeys(row, "maintenanceRequest")))) &&
    (vacantRows === undefined ||
      (Array.isArray(vacantRows) &&
        vacantRows.every((row) => hasOnlyKeys(row, "vacantUnit")))) &&
    (propertyRows === undefined ||
      (Array.isArray(propertyRows) &&
        propertyRows.every((row) => hasOnlyKeys(row, "propertyOutstanding"))))
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

function sectionAt(context: JsonObject, section: string): JsonObject | null {
  const value = context[section];
  return isRecord(value) ? value : null;
}

function integerAt(context: JsonObject, section: string, field: string): number {
  const value = numberAt(context, section, field);
  return Number.isInteger(value) ? value : 0;
}

function stringArrayEntries(
  context: JsonObject,
  section: string,
  field: string,
): JsonObject[] {
  const value = sectionAt(context, section)?.[field];
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function daysBetween(isoFrom: string, isoTo: string): number {
  const from = Date.parse(`${isoFrom}T00:00:00Z`);
  const to = Date.parse(`${isoTo}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function daysUntil(isoDate: string, asOf: string): number {
  return daysBetween(asOf, isoDate);
}

const ARABIC_MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

function arabicDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return isoDate;
  return `${Number(match[3])} ${ARABIC_MONTH_NAMES[monthIndex]} ${match[1]}`;
}

type OverdueInvoiceRow = {
  tenantName?: unknown;
  remainingAmount?: unknown;
  dueDate?: unknown;
};

function asOfRoot(context: JsonObject): string {
  return typeof context.asOf === "string" ? context.asOf : "";
}

function aggregateOverdueByTenant(
  context: JsonObject,
): Array<{ name: string; amount: number; oldestDays: number }> {
  const asOf = asOfRoot(context);
  const rows = stringArrayEntries(context, "overdueInvoices", "topInvoices") as unknown as OverdueInvoiceRow[];
  const totals = new Map<string, { amount: number; oldestDays: number }>();
  for (const row of rows) {
    const name =
      typeof row.tenantName === "string" && row.tenantName.trim()
        ? row.tenantName.trim()
        : "مستأجر غير مسجل";
    const amount = isFiniteNumber(row.remainingAmount) ? Number(row.remainingAmount) : 0;
    if (amount <= 0) continue;
    const entry = totals.get(name) ?? { amount: 0, oldestDays: 0 };
    entry.amount += amount;
    if (typeof row.dueDate === "string" && asOf) {
      entry.oldestDays = Math.max(
        entry.oldestDays,
        Math.max(0, daysBetween(row.dueDate, asOf)),
      );
    }
    totals.set(name, entry);
  }
  return [...totals.entries()]
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((left, right) => right.amount - left.amount);
}

/**
 * Shared "top office actions" derivation for the prioritization action and
 * the daily brief. Returns at most five grounded, read-only suggestions.
 */
function topOfficeActions(context: JsonObject): string[] {
  const actions: string[] = [];
  const asOf = asOfRoot(context);
  const outstanding = numberAt(context, "overdueInvoices", "totalOutstanding");
  const overdueCount = integerAt(context, "overdueInvoices", "invoiceCount");
  if (outstanding > 0) {
    actions.push(`تابع التحصيل: ${formatOmr(outstanding)} على ${overdueCount} فاتورة متأخرة.`);
  }
  const dueToday = numberAt(context, "overdueInvoices", "dueTodayAmount");
  if (dueToday > 0) {
    actions.push(`استحقاق اليوم ${formatOmr(dueToday)} — ابدأ به قبل التواصل مع بقية المتأخرين.`);
  }
  const renewalRows = stringArrayEntries(context, "contractRenewals", "upcomingContracts");
  const weekAhead = renewalRows.filter((row) => {
    if (typeof row.endDate !== "string" || !asOf) return false;
    const delta = daysUntil(row.endDate, asOf);
    return delta >= 0 && delta <= 7;
  });
  if (weekAhead.length > 0) {
    actions.push(`ابدأ إجراءات تجديد ${weekAhead.length} من العقود التي تنتهي خلال 7 أيام.`);
  }
  const maintenance = sectionAt(context, "maintenanceSnapshot");
  if (maintenance) {
    const urgent = integerAt(context, "maintenanceSnapshot", "urgentOpenCount");
    const stalled = integerAt(context, "maintenanceSnapshot", "stalledCount");
    if (urgent > 0 || stalled > 0) {
      actions.push(`راجع طلبات الصيانة: ${urgent} حرجة مفتوحة و${stalled} متوقفة عن التقدم.`);
    }
  }
  const vacant = integerAt(context, "propertyFinancialSnapshot", "vacantUnitCount");
  if (vacant > 0) {
    actions.push(`عالج الشواغر: ${vacant} وحدة متاحة تحتاج تسويقاً أو صيانة استعداداً.`);
  }
  const held = numberAt(context, "depositHeld", "totalHeld");
  if (held > 0) {
    actions.push(`راجع التأمينات المستحفظ عليها بقيمة ${formatOmr(held)} وتحقق من حالات الاستحقاق.`);
  }
  return actions.slice(0, 5);
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
  if (action === "explain_current_surface") {
    const entity = sectionAt(context, "entity");
    if (entity) {
      return explainEntityEntity(entity);
    }
    const surface = sectionAt(context, "surface");
    const section = surface && typeof surface.section === "string" ? surface.section : null;
    const outstanding = numberAt(
      context,
      "propertyFinancialSnapshot",
      "outstandingInvoiceAmount",
    );
    const vacant = integerAt(context, "propertyFinancialSnapshot", "vacantUnitCount");
    const occupancy = numberAt(
      context,
      "propertyFinancialSnapshot",
      "occupancyRate",
    );
    const sectionIntro: Record<string, string> = {
      dashboard: "لقطة اليوم العامة:",
      financials: "الوضع في مساحة المال:",
      reports: "الوضع من زاوية التقارير:",
      maintenance: "الوضع في قسم الصيانة:",
      properties: "الوضع في ملف العقارات:",
      contracts: "الوضع في ملف العقود والمستأجرين:",
    };
    const intro = section && sectionIntro[section] ? sectionIntro[section] : "اللقطة التشغيلية الحالية:";
    return {
      answer: `${intro} المتأخرات الظاهرة ${formatOmr(outstanding)}، الوحدات الشاغرة ${vacant} من الوحدات المسجلة، ونسبة الإشغال ${occupancy.toFixed(2)}٪. من نفس الشاشة يمكنك سؤالي عن المتأخرين أو العقود أو الصيانة، واستخدام أزرار التنقل للانتقال مباشرة إلى الشاشة المناسبة.`,
      grounded: true,
      caveats: ["لقطة قراءة فقط من البيانات الظاهرة ضمن صلاحيتك وقت الطلب."],
    };
  }
  if (action === "identify_riskiest_overdue_tenants") {
    const total = numberAt(context, "overdueInvoices", "totalOutstanding");
    if (total <= 0) {
      return {
        answer: "لا توجد متأخرات ظاهرة ضمن اللقطة الحالية. هذا خبر جيد — راجع شاشة التحصيل للتأكد من عدم وجود دفعات لم تُربط بعد.",
        grounded: true,
        caveats: ["الملخص مبني على الفواتير الظاهرة ضمن صلاحيتك وقت الطلب."],
      };
    }
    const ranked = aggregateOverdueByTenant(context).slice(0, 3);
    const lines = ranked.map(
      (tenant, index) =>
        `${index + 1}) ${tenant.name}: ${formatOmr(tenant.amount)}${tenant.oldestDays > 0 ? `، وأقدمها تجاوز الاستحقاق بـ ${tenant.oldestDays} يوم` : ""}`,
    );
    return {
      answer: `أعلى المستأجرين من حيث المتأخر الظاهر:\n${lines.join("\n")}\nابدأ بالأقدم ثم الأعلى قيمة، وتحقق من السجل قبل أي تواصل لتجنب مذكّرة خاطئة.`,
      grounded: true,
      caveats: ["تجميع من أكبر الفواتير الظاهرة فقط، وليس إقفالاً أو تقريراً معتمداً."],
    };
  }
  if (action === "list_contracts_needing_action_this_week") {
    const asOf = asOfRoot(context);
    const renewalRows = stringArrayEntries(context, "contractRenewals", "upcomingContracts");
    const withinWeek = renewalRows
      .filter((row) => {
        if (typeof row.endDate !== "string" || !asOf) return false;
        const delta = daysUntil(row.endDate, asOf);
        return delta >= 0 && delta <= 7;
      })
      .sort((left, right) =>
        String(left.endDate).localeCompare(String(right.endDate)),
      );
    const lookahead = integerAt(context, "contractRenewals", "lookaheadDays");
    if (withinWeek.length === 0) {
      return {
        answer: `لا توجد عقود تنتهي خلال 7 أيام ضمن النافذة الظاهرة (${lookahead} يوماً). راجع قائمة التجديدات القادمة من شاشة العقود.`,
        grounded: true,
        caveats: ["مبني على تواريخ نهاية العقود الظاهرة وقت الطلب."],
      };
    }
    const totalRent = withinWeek.reduce(
      (acc, row) => acc + (isFiniteNumber(row.rentAmount) ? Number(row.rentAmount) : 0),
      0,
    );
    const next = withinWeek[0];
    return {
      answer: `تنتهي ${withinWeek.length} من العقود خلال 7 أيام بإجمالي إيجارات ${formatOmr(totalRent)}، وأقربها ${arabicDate(String(next.endDate))}. ابدأ باستخراج العقد وطلب قرار التجديد قبل انتهاء النافذة لتجنب فجوات الشغور.`,
      grounded: true,
      caveats: ["قراءة فقط: لا يتخذ المساعد أي قرار تجديد تلقائياً."],
    };
  }
  if (action === "locate_dormant_funds") {
    const held = sectionAt(context, "depositHeld");
    if (!held) {
      return {
        answer: "تعذر قراءة بيانات التأمينات المودعة ضمن هذا الطلب. افتح شاشة التأمينات للتحقق من الأرصدة المستحفظ عليها.",
        grounded: false,
        caveats: ["البيانات غير متوفرة في سياق الطلب الحالي — لا أقدّر المبالغ."],
      };
    }
    const totalHeld = numberAt(context, "depositHeld", "totalHeld");
    const heldCount = integerAt(context, "depositHeld", "heldCount");
    if (totalHeld <= 0) {
      return {
        answer: "لا توجد أرصدة تأمينات مستحفظ عليها ظاهرة ضمن بياناتك الحالية.",
        grounded: true,
        caveats: ["لقطة قراءة فقط من سجلات التأمينات الظاهرة."],
      };
    }
    return {
      answer: `الفلوس المتعطلة الظاهرة الآن: تأمينات مستحفظ عليها بقيمة ${formatOmr(totalHeld)} موزعة على ${heldCount} عقد. راجع شاشة التأمينات لمعرفة أي الحالات تستحق التسوية أو الإيصال قبل نهاية العقد.`,
      grounded: true,
      caveats: ["تأمينات مودعة فقط، ولا يشمل هذا الرصيد أي حسابات بنكية أو أرصدة ملاك."],
    };
  }
  if (action === "list_vacant_units_needing_followup") {
    const vacant = integerAt(context, "propertyFinancialSnapshot", "vacantUnitCount");
    if (vacant <= 0) {
      return {
        answer: "لا توجد وحدات شاغرة ظاهرة ضمن اللقطة الحالية.",
        grounded: true,
        caveats: ["مبني على حالة الوحدات المسجلة وقت الطلب."],
      };
    }
    const units = stringArrayEntries(context, "vacancyDetail", "topVacantUnits");
    const list = units
      .slice(0, 8)
      .map((unit) => {
        const unitName = typeof unit.unitName === "string" && unit.unitName ? unit.unitName : "وحدة";
        const propertyName = typeof unit.propertyName === "string" && unit.propertyName ? ` في ${unit.propertyName}` : "";
        return `• ${unitName}${propertyName}`;
      });
    return {
      answer: `لديك ${vacant} وحدة شاغرة تحتاج متابعة${list.length ? `:\n${list.join("\n")}` : ""}. ابدأ بمعاينة الحالة ثم حدد سعر العرض أو خطة التسويق من شاشة العقارات.`,
      grounded: true,
      caveats: ["لقطة قراءة فقط من حالة الوحدات الظاهرة."],
    };
  }
  if (action === "identify_lowest_performing_properties") {
    const performance = sectionAt(context, "propertyPerformance");
    if (!performance) {
      return {
        answer: "تعذر قراءة توزيع الأداء على العقارات ضمن هذا الطلب. افتح تقرير الأداء للتحليل الكامل.",
        grounded: false,
        caveats: ["البيانات غير متوفرة في سياق الطلب الحالي — لا أقدّر أداء العقارات."],
      };
    }
    const rows = stringArrayEntries(context, "propertyPerformance", "topOutstanding");
    if (rows.length === 0) {
      return {
        answer: "لا توجد متأخرات ظاهرة موزعة على العقارات حالياً — لا مؤشر أداء سلبي واضح من هذه اللقطة.",
        grounded: true,
        caveats: ["القراءة مبنية على الفواتير المتأخرة الظاهرة فقط."],
      };
    }
    const lines = rows.slice(0, 3).map((row, index) => {
      const name = typeof row.propertyName === "string" && row.propertyName ? row.propertyName : "عقار";
      const amount = isFiniteNumber(row.outstandingAmount) ? Number(row.outstandingAmount) : 0;
      const count = isFiniteNumber(row.openInvoiceCount) ? Number(row.openInvoiceCount) : 0;
      return `${index + 1}) ${name}: ${formatOmr(amount)} على ${count} فاتورة`;
    });
    return {
      answer: `العقارات الأعلى متأخراً ضمن اللقطة الحالية:\n${lines.join("\n")}\nابدأ بمتابعة التأخر في أعلى عقار، ثم قارن الإشغال والإيجارات من شاشة العقارات قبل أي قرار.`,
      grounded: true,
      caveats: ["الأداء هنا يُقاس بالتأخر الظاهر فقط وليس بتحليل مالي كامل."],
    };
  }
  if (action === "list_overdue_or_critical_maintenance") {
    const snapshot = sectionAt(context, "maintenanceSnapshot");
    if (!snapshot) {
      return {
        answer: "تعذر قراءة سجل الصيانة ضمن هذا الطلب. افتح شاشة الصيانة لمراجعة الطلبات المفتوحة.",
        grounded: false,
        caveats: ["البيانات غير متوفرة في سياق الطلب الحالي."],
      };
    }
    const open = integerAt(context, "maintenanceSnapshot", "openCount");
    const inProgress = integerAt(context, "maintenanceSnapshot", "inProgressCount");
    const urgent = integerAt(context, "maintenanceSnapshot", "urgentOpenCount");
    const stalled = integerAt(context, "maintenanceSnapshot", "stalledCount");
    const awaitingClosure = integerAt(context, "maintenanceSnapshot", "awaitingClosureCount");
    if (open === 0 && inProgress === 0) {
      return {
        answer: "لا توجد طلبات صيانة مفتوحة أو قيد التنفيذ ضمن اللقطة الحالية.",
        grounded: true,
        caveats: ["لقطة قراءة فقط من سجل الصيانة الظاهر."],
      };
    }
    const requests = stringArrayEntries(context, "maintenanceSnapshot", "topRequests");
    const list = requests
      .slice(0, 4)
      .map((request) => {
        const issue = typeof request.issue === "string" && request.issue ? request.issue : "طلب صيانة";
        const propertyName = typeof request.propertyName === "string" && request.propertyName ? ` (${request.propertyName})` : "";
        const age = isFiniteNumber(request.ageDays) ? Number(request.ageDays) : 0;
        const priority = typeof request.priority === "string" && request.priority ? request.priority : "";
        return `• ${issue}${propertyName}${priority ? ` — ${priority}` : ""}${age > 0 ? ` — ${age} يوم` : ""}`;
      });
    return {
      answer: `الصيانة الظاهرة الآن: ${open} مفتوحة و${inProgress} قيد التنفيذ، منها ${urgent} حرجة و${stalled} متوقفة عن التقدم${awaitingClosure ? ` و${awaitingClosure} منتهية العمل بانتظار الإغلاق` : ""}.\n${list.join("\n")}\nابدأ بالحرجة ثم بالمتوقفة الأطول، وتأكد من إغلاق العمليات التي انتهت فنياً.`,
      grounded: true,
      caveats: ["لقطة قراءة فقط؛ الإغلاق والتسوية يظلان بيد الموظف المخول."],
    };
  }
  if (action === "prioritize_office_actions_top5") {
    const actions = topOfficeActions(context);
    if (actions.length === 0) {
      return {
        answer: "لا توجد إجراءات حرجة ظاهرة من اللقطة الحالية. راجع شاشة اليوم للمتابعة الاعتيادية.",
        grounded: true,
        caveats: ["التقييم مبني على البيانات الظاهرة ضمن صلاحيتك وقت الطلب."],
      };
    }
    return {
      answer: `أهم ما يحتاج تصرف المكتب الآن:\n${actions.map((entry, index) => `${index + 1}. ${entry}`).join("\n")}`,
      grounded: true,
      caveats: ["ترتيب تشغيلي مبني على لقطة البيانات الظاهرة، وليس بديلاً عن القرار البشري."],
    };
  }
  if (action === "generate_daily_brief") {
    const asOf = asOfRoot(context);
    const dateLine = asOf ? `اليوم ${arabicDate(asOf)}.` : "";
    const bullets: string[] = [];
    const dueToday = numberAt(context, "overdueInvoices", "dueTodayAmount");
    const dueTodayCount = integerAt(context, "overdueInvoices", "dueTodayCount");
    if (dueToday > 0) bullets.push(`استحقاق اليوم: ${formatOmr(dueToday)} (${dueTodayCount} فاتورة).`);
    const outstanding = numberAt(context, "overdueInvoices", "totalOutstanding");
    const overdueCount = integerAt(context, "overdueInvoices", "invoiceCount");
    if (outstanding > 0) bullets.push(`متأخرات حرجة: ${formatOmr(outstanding)} على ${overdueCount} فاتورة.`);
    const asOfValue = asOf;
    const renewalWeek = stringArrayEntries(context, "contractRenewals", "upcomingContracts").filter((row) => {
      if (typeof row.endDate !== "string" || !asOfValue) return false;
      const delta = daysUntil(row.endDate, asOfValue);
      return delta >= 0 && delta <= 7;
    }).length;
    if (renewalWeek > 0) bullets.push(`عقود تنتهي هذا الأسبوع: ${renewalWeek}.`);
    const urgent = integerAt(context, "maintenanceSnapshot", "urgentOpenCount");
    const stalled = integerAt(context, "maintenanceSnapshot", "stalledCount");
    if (urgent > 0 || stalled > 0) bullets.push(`صيانة تحتاج عناية: ${urgent} حرجة و${stalled} متوقفة.`);
    const vacant = integerAt(context, "propertyFinancialSnapshot", "vacantUnitCount");
    if (vacant > 0) bullets.push(`وحدات شاغرة: ${vacant}.`);
    const top = topOfficeActions(context).slice(0, 3);
    const brief = [
      "صباح الخير.",
      dateLine,
      "اليوم عندك:",
      bullets.length ? bullets.map((entry) => `• ${entry}`).join("\n") : "• لا عناصر حرجة ظاهرة.",
      top.length ? `أهم ${top.length} إجراءات مقترحة:\n${top.map((entry, index) => `${index + 1}. ${entry}`).join("\n")}` : "",
    ]
      .filter((entry) => entry.trim().length > 0)
      .join("\n");
    return {
      answer: brief,
      grounded: true,
      caveats: ["ملخص تشغيلي مبني على لقطة البيانات الظاهرة وليس تقريراً معتمداً."],
    };
  }
  return null;
}

function explainEntityEntity(entity: JsonObject): AssistantOutput {
  const type = typeof entity.type === "string" ? entity.type : "";
  const name = typeof entity.name === "string" && entity.name ? entity.name : null;
  const outstanding = isFiniteNumber(entity.outstandingAmount) ? Number(entity.outstandingAmount) : 0;
  const oldest = typeof entity.oldestOverdueDate === "string" && entity.oldestOverdueDate ? entity.oldestOverdueDate : null;
  const outstandingLine = outstanding > 0
    ? `المتبقي على فواتيره ${formatOmr(outstanding)}${oldest ? `، وأقدم استحقاق ${arabicDate(oldest)}` : ""}.`
    : "لا توجد متأخرات ظاهرة على هذه اللائحة.";
  if (type === "property" && name) {
    const unitCount = isFiniteNumber(entity.unitCount) ? Number(entity.unitCount) : 0;
    const occupied = isFiniteNumber(entity.occupiedUnitCount) ? Number(entity.occupiedUnitCount) : 0;
    const contracts = isFiniteNumber(entity.activeContractCount) ? Number(entity.activeContractCount) : 0;
    const rent = isFiniteNumber(entity.monthlyRentAmount) ? Number(entity.monthlyRentAmount) : 0;
    return {
      answer: `وضع «${name}»: ${unitCount} وحدة (${occupied} مشغولة)، ${contracts} عقد نشط${rent > 0 ? ` بإيجارات شهرية ${formatOmr(rent)}` : ""}. ${outstandingLine} ابدأ بمتابعة المتأخر إن وجد، ثم شواغر الوحدات.`,
      grounded: true,
      caveats: ["لقطة قراءة فقط من بيانات العقار الظاهرة ضمن صلاحيتك."],
    };
  }
  if (type === "unit" && name) {
    const propertyName = typeof entity.propertyName === "string" && entity.propertyName ? entity.propertyName : null;
    const status = typeof entity.status === "string" && entity.status ? entity.status : null;
    const rent = isFiniteNumber(entity.rentAmount) ? Number(entity.rentAmount) : 0;
    return {
      answer: `الوحدة «${name}»${propertyName ? ` في ${propertyName}` : ""}${status ? ` وحالتها ${status}` : ""}${rent > 0 ? `، والإيجار المسجل ${formatOmr(rent)}` : ""}. ${outstandingLine}`,
      grounded: true,
      caveats: ["لقطة قراءة فقط من بيانات الوحدة الظاهرة."],
    };
  }
  if (type === "contract") {
    const tenantName = typeof entity.tenantName === "string" && entity.tenantName ? entity.tenantName : null;
    const propertyName = typeof entity.propertyName === "string" && entity.propertyName ? entity.propertyName : null;
    const rent = isFiniteNumber(entity.rentAmount) ? Number(entity.rentAmount) : 0;
    const startDate = typeof entity.startDate === "string" ? entity.startDate : null;
    const endDate = typeof entity.endDate === "string" ? entity.endDate : null;
    const parts = [
      tenantName ? `العقد مع «${tenantName}»` : "هذا العقد",
      propertyName ? `في ${propertyName}` : "",
      rent > 0 ? `الإيجار المسجل ${formatOmr(rent)}` : "",
      startDate && endDate ? `والفترة من ${arabicDate(startDate)} إلى ${arabicDate(endDate)}` : "",
    ]
      .filter(Boolean)
      .join("، ");
    const nextDue = typeof entity.nextDueDate === "string" && entity.nextDueDate ? entity.nextDueDate : null;
    return {
      answer: `${parts}. ${outstandingLine}${nextDue ? ` القسط القادم ${arabicDate(nextDue)}.` : ""} راجع شاشة العقد قبل أي تواصل أو قرار تجديد.`,
      grounded: true,
      caveats: ["لقطة قراءة فقط؛ لا يتخذ المساعد قرارات على العقد."],
    };
  }
  if (type === "tenant" && name) {
    const contracts = isFiniteNumber(entity.activeContractCount) ? Number(entity.activeContractCount) : 0;
    return {
      answer: `«${name}»: ${contracts} عقد نشط ظاهر. ${outstandingLine}${outstanding > 0 ? " يُنصح بالتحقق من السجل ثم التواصل بمذكّرة مهذبة عبر مركز التواصل." : ""}`,
      grounded: true,
      caveats: ["لقطة قراءة فقط من عقود وفواتير المستأجر الظاهرة."],
    };
  }
  if (type === "owner" && name) {
    const properties = isFiniteNumber(entity.propertyCount) ? Number(entity.propertyCount) : 0;
    const contracts = isFiniteNumber(entity.activeContractCount) ? Number(entity.activeContractCount) : 0;
    return {
      answer: `ملف «${name}»: ${properties} عقار ظاهر و${contracts} عقد نشط. ${outstandingLine} راجع كشف المالك للوضع المالي التفصيلي المعتمد.`,
      grounded: true,
      caveats: ["لقطة قراءة فقط وليست بديلاً عن كشف المالك المعتمد."],
    };
  }
  if (type === "person" && name) {
    return {
      answer: `«${name}»: ${outstandingLine} للاطلاع الكامل على العقود والتعاملات افتح ملف الشخص.`,
      grounded: true,
      caveats: ["لقطة قراءة فقط من البيانات الظاهرة."],
    };
  }
  return {
    answer: "لم أتمكن من تحديد سياق الصفحة الحالية بدقة. يمكنك سؤالي عن المتأخرات أو العقود أو الصيانة بشكل مباشر.",
    grounded: false,
    caveats: ["سياق الصفحة غير متوفر ضمن هذا الطلب."],
  };
}

const GENERIC_DRAFT_REVIEW_CAVEATS = [
  "مسودة عامة: يجب على موظف مخول مراجعة المستلم والمبالغ والتواريخ من السجلات المعتمدة قبل الإرسال.",
  "لم يتم إرسال أي رسالة تلقائياً.",
] as const;

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
  if (request.action === "draft_contract_renewal_followup") {
    return {
      answer:
        "مرحباً، نود التنسيق معكم بخصوص اقتراب انتهاء فترة الإيجار. نرجو التكرم بالتحقق من رغبتكم في التجديد والشروط المقترحة، حتى يتمكن المكتب من استكمال الإجراءات في الوقت المناسب. شكراً لتعاونكم.",
      grounded: false,
      caveats: [...GENERIC_DRAFT_REVIEW_CAVEATS],
    };
  }
  if (request.action === "draft_maintenance_followup") {
    return {
      answer:
        "مرحباً، نود متابعة حالة الطلب المفتوح لدينا. يرجى التكرم بالاطلاع عليه وتزويدنا بأي تحديث أو موعد مناسب للمعاينة، حتى نستطيع تحديد الخطوات التالية. شكراً لتعاونكم.",
      grounded: false,
      caveats: [...GENERIC_DRAFT_REVIEW_CAVEATS],
    };
  }
  if (request.action === "draft_owner_summary") {
    return {
      answer:
        "تحية طيبة،\nنرفق ملخصاً موجزاً للوضع التشغيلي للعقار: الإشغال الحالي، التحصيل والمتأخر، وطلبات الصيانة المفتوحة. الأرقام التفصيلية تُستكمل من التقارير المعتمدة قبل الإرسال.\nمع الشكر والتقدير.",
      grounded: false,
      caveats: [
        "مسودة هيكلية: تُستكمل الأرقام من كشف المالك المعتمد قبل الإرسال.",
        "لم يتم إرسال أي رسالة تلقائياً.",
      ],
    };
  }
  if (request.action === "draft_internal_note") {
    return {
      answer:
        "ملاحظة داخلية:\nيُرجى متابعة البند المرتبط بهذا الطلب، والتحقق من الحالة الحالية في النظام المعتمد قبل اتخاذ أي إجراء. يُحفظ هذا النص كمسودة فقط.",
      grounded: false,
      caveats: [...GENERIC_DRAFT_REVIEW_CAVEATS],
    };
  }
  return {
    answer:
      "تعذر توليد تحليل موثوق الآن. استخدم الإجراءات الجاهزة للحصول على ملخص حتمي، أو راجع شاشة المصدر والتقارير المعتمدة.",
    grounded: false,
    caveats: ["لم تُنفذ أي عملية ولم تُعدّل أي بيانات."],
  };
}
