import { supabase } from "@/lib/supabase";
import { sanitizeSupportRoute } from "./help-context";

export const supportCategories = [
  "HOW_TO",
  "ACCESS",
  "TECHNICAL",
  "DATA_QUALITY",
  "PAYMENT_POSTING",
  "SECURITY",
] as const;
export type SupportCategory = (typeof supportCategories)[number];

export const supportUrgencies = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export type SupportUrgency = (typeof supportUrgencies)[number];

export type SupportRequestStatus =
  | "ACKNOWLEDGED"
  | "IN_REVIEW"
  | "WAITING_USER"
  | "RESOLVED"
  | "CLOSED";

export type SupportRequestInput = Readonly<{
  category: SupportCategory;
  urgency: SupportUrgency;
  route: string;
  appVersion: string;
  errorReference: string;
  expectedBehavior: string;
  actualBehavior: string;
}>;

export type SupportRequestReceipt = Readonly<{
  id: string;
  reference: string;
  status: SupportRequestStatus;
  urgency: SupportUrgency;
  createdAt: string;
  responseTarget: string;
}>;

export type SupportRequestSummary = SupportRequestReceipt &
  Readonly<{
    category: SupportCategory;
    updatedAt: string;
    publicNote: string | null;
  }>;

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{
  data: unknown;
  error: { message?: string; code?: string } | null;
}>;

const sensitiveContentPattern =
  /password|passcode|كلمة\s*المرور|api[_\s-]?key|secret|token|authorization\s*:|private\s+key|-----begin|reset[_\s-]?link|رابط\s+الاستعادة/i;
const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;
const longNumberPattern = /(?:\d[\s-]*){8,}/;
const safeErrorReferencePattern = /^[\p{L}\p{N}._:\-/]*$/u;

const responseTargets: Readonly<Record<SupportUrgency, string>> = {
  CRITICAL:
    "تصعيد فوري؛ هدف المراجعة البشرية خلال 4 ساعات عمل بعد تشغيل قناة الدعم",
  HIGH: "هدف المراجعة خلال يوم عمل واحد",
  NORMAL: "هدف المراجعة خلال يومي عمل",
  LOW: "هدف المراجعة خلال 3 أيام عمل",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function containsUnsafeSupportContent(value: string): boolean {
  return (
    sensitiveContentPattern.test(value) ||
    emailPattern.test(value) ||
    longNumberPattern.test(value)
  );
}

export function validateSupportRequest(
  input: SupportRequestInput,
): string | null {
  if (!supportCategories.includes(input.category))
    return "اختر نوعاً صالحاً للمشكلة.";
  if (!supportUrgencies.includes(input.urgency))
    return "اختر مستوى أولوية صالحاً.";
  if (
    !input.route.startsWith("/") ||
    input.route.length > 300 ||
    input.route !== sanitizeSupportRoute(input.route)
  )
    return "تعذر التحقق من مسار الشاشة.";
  if (
    input.expectedBehavior.trim().length < 10 ||
    input.actualBehavior.trim().length < 10
  ) {
    return "اكتب وصفاً مختصراً من 10 أحرف على الأقل للمتوقع والفعلي.";
  }
  if (
    input.expectedBehavior.length > 1_000 ||
    input.actualBehavior.length > 1_000
  ) {
    return "يجب ألا يتجاوز كل وصف 1000 حرف.";
  }
  if (
    input.errorReference &&
    !safeErrorReferencePattern.test(input.errorReference)
  ) {
    return "مرجع الخطأ يقبل الحروف والأرقام والرموز . _ : - / فقط.";
  }
  if (
    containsUnsafeSupportContent(
      `${input.expectedBehavior}\n${input.actualBehavior}`,
    )
  ) {
    return "احذف كلمات المرور والرموز والبريد والهاتف والأرقام الطويلة وأي بيانات شخصية من الوصف.";
  }
  return null;
}

function normalizeReceipt(value: unknown): SupportRequestReceipt {
  if (!isRecord(value)) throw new Error("عاد نظام الدعم بإقرار غير صالح.");
  const urgency = readString(value.urgency, 20) as SupportUrgency;
  const status = readString(value.status, 30) as SupportRequestStatus;
  if (!supportUrgencies.includes(urgency) || status !== "ACKNOWLEDGED") {
    throw new Error("تعذر تأكيد استلام طلب الدعم.");
  }
  const id = readString(value.id, 64);
  const reference = readString(value.reference, 40);
  const createdAt = readString(value.created_at, 50);
  if (!id || !reference || !createdAt)
    throw new Error("تعذر تأكيد مرجع طلب الدعم.");
  return {
    id,
    reference,
    status,
    urgency,
    createdAt,
    responseTarget: responseTargets[urgency],
  };
}

function normalizeSummary(value: unknown): SupportRequestSummary | null {
  if (!isRecord(value)) return null;
  const category = readString(value.category, 40) as SupportCategory;
  const urgency = readString(value.urgency, 20) as SupportUrgency;
  const status = readString(value.status, 30) as SupportRequestStatus;
  if (
    !supportCategories.includes(category) ||
    !supportUrgencies.includes(urgency)
  )
    return null;
  if (
    ![
      "ACKNOWLEDGED",
      "IN_REVIEW",
      "WAITING_USER",
      "RESOLVED",
      "CLOSED",
    ].includes(status)
  )
    return null;
  const id = readString(value.id, 64);
  const reference = readString(value.reference, 40);
  const createdAt = readString(value.created_at, 50);
  const updatedAt = readString(value.updated_at, 50);
  if (!id || !reference || !createdAt || !updatedAt) return null;
  return {
    id,
    reference,
    category,
    urgency,
    status,
    createdAt,
    updatedAt,
    publicNote:
      typeof value.public_note === "string"
        ? value.public_note.slice(0, 500)
        : null,
    responseTarget: responseTargets[urgency],
  };
}

export function getSupportAppVersion(): string {
  return import.meta.env.VITE_APP_VERSION?.trim() || "unavailable";
}

function supportBoundaryError(
  error: { message?: string; code?: string } | null,
  fallback: string,
): Error {
  const marker = `${error?.code ?? ""} ${error?.message ?? ""}`.toUpperCase();
  if (marker.includes("SUPPORT_SENSITIVE_CONTENT_REJECTED")) {
    return new Error(
      "احذف أي سر أو بريد أو هاتف أو رقم طويل من الوصف ثم أعد المحاولة.",
    );
  }
  if (
    marker.includes("42501") ||
    marker.includes("SUPPORT_ACTIVE_COMPANY_MEMBERSHIP_REQUIRED")
  ) {
    return new Error("لا تملك صلاحية إنشاء طلب دعم في الشركة الحالية.");
  }
  if (marker.includes("42883")) {
    return new Error("خدمة طلبات الدعم غير مفعلة في هذه البيئة بعد.");
  }
  return new Error(fallback);
}

export async function createSupportRequest(
  input: SupportRequestInput,
): Promise<SupportRequestReceipt> {
  const validationError = validateSupportRequest(input);
  if (validationError) throw new Error(validationError);

  const { data, error } = await (supabase.rpc as unknown as Rpc)(
    "create_support_request_atomic",
    {
      p_category: input.category,
      p_urgency: input.urgency,
      p_route: input.route,
      p_app_version: input.appVersion,
      p_error_reference: input.errorReference || null,
      p_expected_behavior: input.expectedBehavior.trim(),
      p_actual_behavior: input.actualBehavior.trim(),
    },
  );
  if (error) {
    throw supportBoundaryError(
      error,
      "تعذر إرسال طلب الدعم. لم يتم إرسال أي بيانات إلى منصة خارجية.",
    );
  }
  return normalizeReceipt(data);
}

export async function listMySupportRequests(): Promise<
  readonly SupportRequestSummary[]
> {
  const { data, error } = await (supabase.rpc as unknown as Rpc)(
    "list_my_support_requests",
    {},
  );
  if (error) throw supportBoundaryError(error, "تعذر تحميل طلبات الدعم.");
  return Array.isArray(data)
    ? data
        .map(normalizeSummary)
        .filter((row): row is SupportRequestSummary => row !== null)
    : [];
}
