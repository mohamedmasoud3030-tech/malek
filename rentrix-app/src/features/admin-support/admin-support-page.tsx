import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Search, ShieldCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { AccessDenied } from "@/components/layout/access-denied";
import { PageHeader } from "@/components/layout/page-header";
import { PageLayout } from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AuthorizationRole } from "@/features/auth/permissions";
import {
  getSupportOperationsSnapshot,
  proposeUserAccessChange,
  triageSupportRequest,
  type MaskedUserInvestigation,
  type SupportOperationsRequest,
} from "./admin-support-service";

const queryKey = ["admin-support-operations"] as const;
const statusLabels: Record<SupportOperationsRequest["status"], string> = {
  ACKNOWLEDGED: "تم الاستلام",
  IN_REVIEW: "قيد المراجعة",
  WAITING_USER: "بانتظار المستخدم",
  RESOLVED: "تم الحل",
  CLOSED: "مغلق",
};

const roles: readonly AuthorizationRole[] = [
  "ADMIN",
  "MANAGER",
  "ACCOUNTANT",
  "OPERATIONS",
  "USER",
  "VIEWER",
];

function nextStatuses(
  request: SupportOperationsRequest,
): readonly SupportOperationsRequest["status"][] {
  if (request.status === "ACKNOWLEDGED") return ["IN_REVIEW"];
  if (request.status === "IN_REVIEW") return ["WAITING_USER", "RESOLVED"];
  if (request.status === "WAITING_USER") return ["IN_REVIEW"];
  return [];
}

export function AdminSupportOperationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [triageTarget, setTriageTarget] = useState<{
    request: SupportOperationsRequest;
    status: SupportOperationsRequest["status"];
    idempotencyKey: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [publicNote, setPublicNote] = useState("");
  const [proposalTarget, setProposalTarget] =
    useState<MaskedUserInvestigation | null>(null);
  const [proposalRole, setProposalRole] = useState<AuthorizationRole>("USER");
  const [proposalActive, setProposalActive] = useState(true);
  const [proposalReason, setProposalReason] = useState("");
  const [proposalKey, setProposalKey] = useState("");

  const snapshotQuery = useQuery({
    queryKey: [...queryKey, submittedSearch],
    queryFn: () => getSupportOperationsSnapshot(submittedSearch),
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const triageMutation = useMutation({
    mutationFn: triageSupportRequest,
    onSuccess: async () => {
      setTriageTarget(null);
      setReason("");
      setPublicNote("");
      await refresh();
      toast.success("تم تسجيل حالة الدعم وحدث التدقيق.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "تعذر تحديث الطلب."),
  });
  const proposalMutation = useMutation({
    mutationFn: proposeUserAccessChange,
    onSuccess: async (result) => {
      setProposalTarget(null);
      setProposalReason("");
      await refresh();
      toast.success(`تم إنشاء مقترح غير منفذ: ${result.status}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "تعذر إنشاء المقترح.",
      ),
  });

  if (snapshotQuery.isPending) {
    return (
      <PageLayout dir="rtl" lang="ar">
        <Card>
          <CardContent className="py-12 text-center" role="status">
            جارٍ تحميل أدوات عمليات الدعم الآمنة...
          </CardContent>
        </Card>
      </PageLayout>
    );
  }
  if (snapshotQuery.isError) {
    return (
      <PageLayout dir="rtl" lang="ar">
        <AccessDenied
          message={
            snapshotQuery.error instanceof Error
              ? snapshotQuery.error.message
              : "تعذر الوصول إلى عمليات الدعم."
          }
        />
      </PageLayout>
    );
  }
  const snapshot = snapshotQuery.data;
  if (!snapshot.capabilities.view)
    return <AccessDenied message="لا تملك صلاحية عرض عمليات الدعم." />;

  return (
    <PageLayout dir="rtl" lang="ar" size="wide" visualVariant="malek-pro">
      <PageHeader
        title="عمليات الدعم والتحقيق"
        description="أدوات محدودة حسب الشركة: طلبات الدعم، بحث مستخدمين مقنّع للمسؤول، وسجل أحداث غير قابل للتعديل. لا انتحال أو تصدير أو إجراءات مالية."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card variant="muted">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground">
              طلبات مفتوحة
            </p>
            <p className="mt-1 text-2xl font-black">
              {snapshot.summary.openRequests}
            </p>
          </CardContent>
        </Card>
        <Card variant="muted">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground">
              عالية أو حرجة
            </p>
            <p className="mt-1 text-2xl font-black text-warning">
              {snapshot.summary.criticalHigh}
            </p>
          </CardContent>
        </Card>
        <Card variant="muted">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground">
              بانتظار المستخدم
            </p>
            <p className="mt-1 text-2xl font-black">
              {snapshot.summary.waitingUser}
            </p>
          </CardContent>
        </Card>
        <Card variant="muted">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground">
              اتصالات DEAD
            </p>
            <p className="mt-1 text-2xl font-black">
              {snapshot.summary.communicationDead}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5 text-primary" />
            تحقيق محدود
          </CardTitle>
          <CardDescription>
            ابحث بمرجع دعم، أو — للمسؤول فقط — بثلاثة أحرف على الأقل من اسم/بريد
            المستخدم. النتائج مقنّعة ولا يدخل البحث في الرابط.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setSubmittedSearch(search.trim().slice(0, 100));
            }}
          >
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              aria-label="بحث عمليات الدعم"
              placeholder="MS-... أو 3 أحرف من المستخدم"
            />
            <Button type="submit" variant="secondary">
              بحث
            </Button>
            {submittedSearch ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setSubmittedSearch("");
                }}
              >
                مسح
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="support-queue-title">
        <div>
          <h2 id="support-queue-title" className="text-xl font-bold">
            قائمة طلبات الدعم
          </h2>
          <p className="text-sm text-muted-foreground">
            لا تظهر أوصاف المستخدم الخاصة. الحد {snapshot.limits.requestRows}{" "}
            صفاً ولا توجد إجراءات جماعية.
          </p>
        </div>
        {snapshot.requests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              لا توجد طلبات مطابقة.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {snapshot.requests.map((request) => (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle dir="ltr" className="text-base">
                        {request.reference}
                      </CardTitle>
                      <CardDescription>
                        {request.category} · {request.route}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        variant={
                          request.urgency === "CRITICAL"
                            ? "danger"
                            : request.urgency === "HIGH"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {request.urgency}
                      </Badge>
                      <Badge variant="info">
                        {statusLabels[request.status]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>الدور: {request.requesterRole}</span>
                    <span>الإصدار: {request.appVersion}</span>
                  </div>
                  {request.publicNote ? (
                    <p className="rounded-xl bg-muted/40 p-3 text-sm">
                      {request.publicNote}
                    </p>
                  ) : null}
                  {snapshot.capabilities.triage &&
                  nextStatuses(request).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {nextStatuses(request).map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setTriageTarget({
                              request,
                              status,
                              idempotencyKey: crypto.randomUUID(),
                            });
                            setReason("");
                            setPublicNote("");
                          }}
                        >
                          {statusLabels[status]}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {snapshot.capabilities.userLookup ? (
        <section className="space-y-3" aria-labelledby="masked-users-title">
          <div>
            <h2 id="masked-users-title" className="text-xl font-bold">
              بحث المستخدمين المقنّع
            </h2>
            <p className="text-sm text-muted-foreground">
              قراءة فقط. أي تغيير وصول ينشئ مقترحاً غير منفذ لمدة 7 أيام.
            </p>
          </div>
          {submittedSearch.length < 3 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                أدخل 3 أحرف على الأقل لبحث المستخدمين.
              </CardContent>
            </Card>
          ) : snapshot.users.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                لا توجد نتائج مستخدمين مطابقة.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.users.map((user) => (
                <Card key={user.id}>
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="font-bold">{user.nameMasked}</p>
                      <p dir="ltr" className="text-xs text-muted-foreground">
                        {user.emailMasked}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{user.appRole}</Badge>
                      <Badge variant={user.isActive ? "success" : "warning"}>
                        {user.isActive ? "نشط" : "متوقف"}
                      </Badge>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setProposalTarget(user);
                        setProposalKey(crypto.randomUUID());
                        setProposalRole(user.appRole);
                        setProposalActive(user.isActive);
                        setProposalReason("");
                      }}
                    >
                      معاينة تغيير الوصول
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section
        className="space-y-3"
        aria-labelledby="investigation-audit-title"
      >
        <div>
          <h2 id="investigation-audit-title" className="text-xl font-bold">
            أحداث عمليات الدعم
          </h2>
          <p className="text-sm text-muted-foreground">
            معاينة مقنّعة لسجل append-only؛ لا تظهر معرفات الأهداف أو الأسباب.
          </p>
        </div>
        {snapshot.audit.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              لا توجد أحداث متاحة لدورك.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {snapshot.audit.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
                >
                  <div>
                    <p className="font-bold">{event.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.actorMasked} · {event.targetType}
                    </p>
                  </div>
                  <Badge variant="outline">{event.outcome}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <Card className="border-warning/40 bg-warning/10">
        <CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-warning">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <p>
            غير متاح عمداً: الانتحال، التصدير، الإجراءات الجماعية، تعديل
            السجلات، رد الأموال، الإلغاءات المالية، أو تنفيذ تغييرات الوصول.
            استخدم المسارات المتخصصة والموافقات الرسمية.
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={triageTarget !== null}
        onOpenChange={(open) => {
          if (!open && !triageMutation.isPending) setTriageTarget(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تأكيد تغيير حالة الدعم</DialogTitle>
            <DialogDescription>
              {triageTarget
                ? `${triageTarget.request.reference} ← ${statusLabels[triageTarget.status]}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-1.5">
            <span className="text-sm font-bold">سبب داخلي إلزامي</span>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-bold">
              ملاحظة آمنة للمستخدم (اختيارية)
            </span>
            <Textarea
              value={publicNote}
              onChange={(event) => setPublicNote(event.target.value)}
              maxLength={500}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            لا تكتب أسماء أو بريد أو هاتف أو معرفات سجلات أو تفاصيل مالية.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setTriageTarget(null)}
              disabled={triageMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              disabled={
                !triageTarget ||
                reason.trim().length < 10 ||
                triageMutation.isPending
              }
              onClick={() => {
                if (!triageTarget) return;
                triageMutation.mutate({
                  requestId: triageTarget.request.id,
                  status: triageTarget.status,
                  publicNote,
                  reason,
                  idempotencyKey: triageTarget.idempotencyKey,
                });
              }}
            >
              تأكيد وتسجيل التدقيق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={proposalTarget !== null}
        onOpenChange={(open) => {
          if (!open && !proposalMutation.isPending) setProposalTarget(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>مقترح تغيير وصول — غير منفذ</DialogTitle>
            <DialogDescription>
              هذه الخطوة لا تغيّر الدور أو حالة الحساب. التنفيذ عالي التأثير غير
              موجود حتى اعتماد المالك وضوابط إعادة التحقق والمراجع الثاني.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p>{proposalTarget?.nameMasked}</p>
            <p dir="ltr" className="text-xs text-muted-foreground">
              {proposalTarget?.emailMasked}
            </p>
          </div>
          <label className="space-y-1.5">
            <span className="text-sm font-bold">الدور المقترح</span>
            <Select
              value={proposalRole}
              onChange={(event) =>
                setProposalRole(event.target.value as AuthorizationRole)
              }
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex min-h-11 items-center justify-between rounded-xl border px-3 text-sm font-bold">
            <span>الحساب نشط</span>
            <input
              type="checkbox"
              className="size-5"
              checked={proposalActive}
              onChange={(event) => setProposalActive(event.target.checked)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-bold">سبب المقترح</span>
            <Textarea
              value={proposalReason}
              onChange={(event) => setProposalReason(event.target.value)}
              maxLength={500}
            />
          </label>
          <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <ShieldCheck className="size-4 shrink-0" />
            <p>
              لا يوجد زر تنفيذ. المقترح ينتهي تلقائياً بعد 7 أيام ويُمنع على
              الحساب الحالي وآخر مسؤول.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setProposalTarget(null)}
              disabled={proposalMutation.isPending}
            >
              إلغاء
            </Button>
            <Button
              disabled={
                !proposalTarget ||
                proposalReason.trim().length < 10 ||
                proposalMutation.isPending
              }
              onClick={() => {
                if (!proposalTarget) return;
                proposalMutation.mutate({
                  targetUserId: proposalTarget.id,
                  proposedRole: proposalRole,
                  proposedActive: proposalActive,
                  reason: proposalReason,
                  idempotencyKey: proposalKey,
                });
              }}
            >
              حفظ المقترح فقط
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
