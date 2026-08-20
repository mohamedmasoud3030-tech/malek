import { supabase } from "@/lib/supabase";
import type { AuthorizationRole } from "@/features/auth/permissions";

export type SupportOperationsRequest = Readonly<{
  id: string;
  reference: string;
  category: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
  status: "ACKNOWLEDGED" | "IN_REVIEW" | "WAITING_USER" | "RESOLVED" | "CLOSED";
  route: string;
  appVersion: string;
  requesterRole: string;
  publicNote: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type MaskedUserInvestigation = Readonly<{
  id: string;
  nameMasked: string;
  emailMasked: string;
  appRole: AuthorizationRole;
  companyRole: string;
  status: string;
  isActive: boolean;
  lastLogin: string | null;
}>;

export type SupportAuditPreview = Readonly<{
  id: string;
  actorMasked: string;
  capability: string;
  action: string;
  targetType: string;
  outcome: string;
  createdAt: string;
}>;

export type SupportOperationsSnapshot = Readonly<{
  capabilities: { view: boolean; triage: boolean; userLookup: boolean };
  summary: {
    openRequests: number;
    criticalHigh: number;
    waitingUser: number;
    oldestOpenAt: string | null;
    communicationDead: number;
    communicationSuppressedToday: number;
    aiReservedTodayMicrousd: number;
  };
  requests: readonly SupportOperationsRequest[];
  users: readonly MaskedUserInvestigation[];
  audit: readonly SupportAuditPreview[];
  limits: {
    requestRows: number;
    userRows: number;
    bulkActions: number;
    exports: boolean;
    impersonation: boolean;
  };
}>;

type Rpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{
  data: unknown;
  error: { message?: string; code?: string } | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : Number(value) || 0;
}

function supportError(
  error: { message?: string; code?: string } | null,
  fallback: string,
): Error {
  const marker = `${error?.code ?? ""} ${error?.message ?? ""}`.toUpperCase();
  if (
    marker.includes("42501") ||
    marker.includes("REQUIRED") ||
    marker.includes("PROHIBITED")
  ) {
    return new Error(
      "لا تملك الصلاحية المطلوبة لهذه العملية، أو أن ضابط الحماية منعها.",
    );
  }
  if (marker.includes("SENSITIVE") || marker.includes("INPUT_INVALID")) {
    return new Error(
      "احذف البيانات الخاصة واكتب سبباً تشغيلياً واضحاً من 10 أحرف على الأقل.",
    );
  }
  if (marker.includes("42883"))
    return new Error("أدوات عمليات الدعم غير مفعلة في هذه البيئة بعد.");
  return new Error(fallback);
}

function normalizeSnapshot(value: unknown): SupportOperationsSnapshot {
  if (
    !isRecord(value) ||
    !isRecord(value.capabilities) ||
    !isRecord(value.summary) ||
    !isRecord(value.limits)
  ) {
    throw new Error("عاد مصدر عمليات الدعم ببيانات غير صالحة.");
  }
  const requestRows = Array.isArray(value.requests) ? value.requests : [];
  const userRows = Array.isArray(value.users) ? value.users : [];
  const auditRows = Array.isArray(value.audit) ? value.audit : [];
  return {
    capabilities: {
      view: value.capabilities.view === true,
      triage: value.capabilities.triage === true,
      userLookup: value.capabilities.user_lookup === true,
    },
    summary: {
      openRequests: count(value.summary.open_requests),
      criticalHigh: count(value.summary.critical_high),
      waitingUser: count(value.summary.waiting_user),
      oldestOpenAt: text(value.summary.oldest_open_at, 50) || null,
      communicationDead: count(value.summary.communication_dead),
      communicationSuppressedToday: count(
        value.summary.communication_suppressed_today,
      ),
      aiReservedTodayMicrousd: count(value.summary.ai_reserved_today_microusd),
    },
    requests: requestRows
      .filter(isRecord)
      .map((row) => ({
        id: text(row.id, 64),
        reference: text(row.reference, 40),
        category: text(row.category, 40),
        urgency: text(row.urgency, 20) as SupportOperationsRequest["urgency"],
        status: text(row.status, 30) as SupportOperationsRequest["status"],
        route: text(row.route, 300),
        appVersion: text(row.app_version, 100),
        requesterRole: text(row.requester_role, 40),
        publicNote: text(row.public_note, 500) || null,
        createdAt: text(row.created_at, 50),
        updatedAt: text(row.updated_at, 50),
      }))
      .filter((row) => row.id && row.reference),
    users: userRows
      .filter(isRecord)
      .map((row) => ({
        id: text(row.id, 64),
        nameMasked: text(row.name_masked, 120) || "م***",
        emailMasked: text(row.email_masked, 254) || "***",
        appRole: text(row.app_role, 30) as AuthorizationRole,
        companyRole: text(row.company_role, 30),
        status: text(row.status, 30),
        isActive: row.is_active === true,
        lastLogin: text(row.last_login, 50) || null,
      }))
      .filter((row) => row.id),
    audit: auditRows
      .filter(isRecord)
      .map((row) => ({
        id: String(row.id ?? ""),
        actorMasked: text(row.actor_masked, 120),
        capability: text(row.capability, 120),
        action: text(row.action, 120),
        targetType: text(row.target_type, 80),
        outcome: text(row.outcome, 80),
        createdAt: text(row.created_at, 50),
      }))
      .filter((row) => row.id),
    limits: {
      requestRows: count(value.limits.request_rows),
      userRows: count(value.limits.user_rows),
      bulkActions: count(value.limits.bulk_actions),
      exports: value.limits.exports === true,
      impersonation: value.limits.impersonation === true,
    },
  };
}

export async function getSupportOperationsSnapshot(
  query = "",
): Promise<SupportOperationsSnapshot> {
  const safeQuery = query.trim().slice(0, 100);
  const { data, error } = await (supabase.rpc as unknown as Rpc)(
    "get_admin_support_operations_snapshot",
    {
      p_query: safeQuery || null,
    },
  );
  if (error) throw supportError(error, "تعذر تحميل عمليات الدعم.");
  return normalizeSnapshot(data);
}

export async function triageSupportRequest(
  input: Readonly<{
    requestId: string;
    status: SupportOperationsRequest["status"];
    publicNote: string;
    reason: string;
    idempotencyKey: string;
  }>,
) {
  const { data, error } = await (supabase.rpc as unknown as Rpc)(
    "triage_support_request_atomic",
    {
      p_request_id: input.requestId,
      p_status: input.status,
      p_public_note: input.publicNote.trim() || null,
      p_reason: input.reason.trim(),
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error) throw supportError(error, "تعذر تحديث حالة طلب الدعم.");
  return data;
}

export async function proposeUserAccessChange(
  input: Readonly<{
    targetUserId: string;
    proposedRole: AuthorizationRole;
    proposedActive: boolean;
    reason: string;
    idempotencyKey: string;
  }>,
) {
  const { data, error } = await (supabase.rpc as unknown as Rpc)(
    "propose_user_access_change_atomic",
    {
      p_target_user_id: input.targetUserId,
      p_proposed_role: input.proposedRole,
      p_proposed_active: input.proposedActive,
      p_reason: input.reason.trim(),
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error) throw supportError(error, "تعذر إنشاء مقترح تغيير الوصول.");
  if (!isRecord(data) || data.executed !== false)
    throw new Error("تعذر تأكيد أن المقترح غير منفذ.");
  return {
    proposalId: text(data.proposal_id, 64),
    status: text(data.status, 40),
    duplicate: data.duplicate === true,
    expiresAt: text(data.expires_at, 50),
    executed: false as const,
  };
}
