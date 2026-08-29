import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  LifeBuoy,
  LockKeyhole,
  Search,
  Send,
  ShieldAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeSupportRoute } from "./help-context";
import {
  getContextualHelpArticleId,
  getHelpArticle,
  helpArticles,
  helpCategoryLabels,
  searchHelpArticles,
  type HelpArticle,
  type HelpArticleCategory,
} from "./help-content";
import {
  createSupportRequest,
  getSupportAppVersion,
  listMySupportRequests,
  supportCategories,
  supportUrgencies,
  validateSupportRequest,
  type SupportCategory,
  type SupportRequestInput,
  type SupportUrgency,
} from "./support-service";
const articleOwnerLabels = {
  product: "المنتج",
  operations: "العمليات",
  security: "الأمن",
  finance: "المالية",
} as const;
const categoryLabels: Readonly<Record<SupportCategory, string>> = {
  HOW_TO: "سؤال عن طريقة العمل",
  ACCESS: "الحساب أو الصلاحيات",
  TECHNICAL: "خطأ تقني أو أداء",
  DATA_QUALITY: "سلامة أو جودة البيانات",
  PAYMENT_POSTING: "تحصيل أو قيد مالي غير واضح",
  SECURITY: "أمن أو خصوصية",
};
const urgencyLabels: Readonly<Record<SupportUrgency, string>> = {
  LOW: "منخفضة — سؤال لا يوقف العمل",
  NORMAL: "عادية — يوجد مسار بديل",
  HIGH: "عالية — مهمة أساسية متوقفة",
  CRITICAL: "حرجة — أمن، فقد بيانات، أو أثر مالي محتمل",
};
const statusLabels = {
  ACKNOWLEDGED: "تم الاستلام",
  IN_REVIEW: "قيد المراجعة",
  WAITING_USER: "بانتظار ردك",
  RESOLVED: "تم الحل",
  CLOSED: "مغلق",
} as const;
const supportQueryKey = ["support", "my-requests"] as const;
function currentSupportContextPath(): string {
  if (typeof window === "undefined") return "/help";
  const from = new URLSearchParams(window.location.search).get("from");
  return sanitizeSupportRoute(from || window.location.pathname);
}
function getInitialArticle(): string {
  if (typeof window === "undefined") return "first-office-setup";
  const requested = new URLSearchParams(window.location.search).get("article");
  return (
    getHelpArticle(requested)?.id ??
    getContextualHelpArticleId(
      new URLSearchParams(window.location.search).get("from") || "/dashboard",
    )
  );
}
function buildDeepLink(article: HelpArticle["links"][number]): string {
  if (!article.search) return article.to;
  return `${article.to}?${new URLSearchParams(article.search).toString()}`;
}
function ArticleCard({
  article,
  expanded,
  onToggle,
}: Readonly<{
  article: HelpArticle;
  expanded: boolean;
  onToggle: () => void;
}>) {
  const panelId = `help-article-${article.id}`;
  return (
    <Card data-help-article={article.id} className="overflow-hidden">
      <button
        type="button"
        className="flex min-h-14 w-full items-start justify-between gap-3 p-4 text-start outline-none hover:bg-muted/40 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/20"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="min-w-0">
          <span className="block font-bold">{article.title}</span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            {article.summary}
          </span>
        </span>
        <ChevronDown
          className={`mt-1 size-5 shrink-0 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {expanded ? (
        <CardContent id={panelId} className="space-y-4 border-t pt-4">
          <ol className="space-y-2 text-sm leading-7">
            {article.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span
                  className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {article.note ? (
            <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm leading-6 text-warning">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>{article.note}</p>
            </div>
          ) : null}
          {article.links.length > 0 ? (
            <div
              className="flex flex-wrap gap-2"
              aria-label="روابط مرتبطة بالمقال"
            >
              {article.links.map((link) => (
                <Button
                  key={`${article.id}-${link.label}`}
                  asChild
                  variant="secondary"
                  size="sm"
                >
                  <a href={buildDeepLink(link)}>
                    {link.label}
                    <ExternalLink
                      className="ms-1 size-3.5"
                      aria-hidden="true"
                    />
                  </a>
                </Button>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            آخر تحقق: {article.verifiedOn} · المالك:{" "}
            {articleOwnerLabels[article.owner]}
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
function KnowledgeBase() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpArticleCategory | "all">("all");
  const [expandedArticle, setExpandedArticle] = useState(getInitialArticle);
  const filtered = useMemo(
    () =>
      searchHelpArticles(query).filter(
        (article) => category === "all" || article.category === category,
      ),
    [category, query],
  );

  return (
    <section aria-labelledby="help-articles-title" className="space-y-4">
      <div>
        <h2 id="help-articles-title" className="text-xl font-bold">
          دليل المهام
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ابحث عن المهمة أو المشكلة؛ المقالات المختصرة تربطك بمسار العمل الفعلي.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <label className="relative block">
          <span className="sr-only">البحث في المساعدة</span>
          <Search
            className="pointer-events-none absolute start-3 top-3.5 size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="مثال: صلاحية، عقد، فاتورة، دون اتصال"
            className="ps-11"
          />
        </label>
        <label>
          <span className="sr-only">تصنيف المقالات</span>
          <Select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as HelpArticleCategory | "all")
            }
          >
            <option value="all">كل التصنيفات</option>
            {Object.entries(helpCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="text-xs text-muted-foreground"
      >
        {filtered.length} مقالات مطابقة
      </p>
      {filtered.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              expanded={expandedArticle === article.id}
              onToggle={() =>
                setExpandedArticle((current) =>
                  current === article.id ? "" : article.id,
                )
              }
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <CircleHelp
              className="mx-auto size-8 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 font-bold">لا توجد مقالة مطابقة</p>
            <p className="mt-1 text-sm text-muted-foreground">
              جرّب كلمة أقصر، أو أنشئ طلب دعم دون إدخال بيانات خاصة.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
function SystemStatusCard() {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {online ? (
            <Wifi className="size-5 text-success" />
          ) : (
            <WifiOff className="size-5 text-warning" />
          )}
          حالة هذه الجلسة
        </CardTitle>
        <CardDescription>
          فحص محلي صادق؛ لا توجد حالياً صفحة حالة خارجية مرتبطة.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span>اتصال المتصفح</span>
          <Badge variant={online ? "success" : "warning"}>
            {online ? "متصل" : "دون اتصال"}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>إصدار التطبيق</span>
          <code dir="ltr" className="rounded bg-muted px-2 py-1 text-xs">
            {getSupportAppVersion()}
          </code>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          لا يعني اتصال المتصفح أن كل خدمة خلفية سليمة. استخدم مرجع الخطأ عند
          استمرار المشكلة.
        </p>
      </CardContent>
    </Card>
  );
}
function SupportIntake() {
  const queryClient = useQueryClient();
  const [receipt, setReceipt] = useState<Awaited<
    ReturnType<typeof createSupportRequest>
  > | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    category: "HOW_TO" as SupportCategory,
    urgency: "NORMAL" as SupportUrgency,
    errorReference: "",
    expectedBehavior: "",
    actualBehavior: "",
  });
  const route = currentSupportContextPath();
  const requests = useQuery({
    queryKey: supportQueryKey,
    queryFn: listMySupportRequests,
  });
  const mutation = useMutation({
    mutationFn: createSupportRequest,
    onSuccess: async (result) => {
      setReceipt(result);
      setForm((current) => ({
        ...current,
        errorReference: "",
        expectedBehavior: "",
        actualBehavior: "",
      }));
      await queryClient.invalidateQueries({ queryKey: supportQueryKey });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const input: SupportRequestInput = {
      ...form,
      route,
      appVersion: getSupportAppVersion(),
    };
    const validationError = validateSupportRequest(input);
    if (validationError) {
      mutation.reset();
      setValidationMessage(validationError);
      return;
    }
    setValidationMessage(null);
    setReceipt(null);
    mutation.mutate(input);
  }
  const errorMessage =
    mutation.error instanceof Error ? mutation.error.message : null;

  return (
    <section aria-labelledby="support-intake-title" className="space-y-4">
      <div>
        <h2 id="support-intake-title" className="text-xl font-bold">
          طلب دعم آمن
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          يُحفظ الطلب داخل قاعدة MALEK الحالية فقط، ولا يُرسل إلى منصة دعم
          خارجية.
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="size-5 text-primary" />
              وصف المشكلة
            </CardTitle>
            <CardDescription>
              سنضيف المسار والإصدار والدور تلقائياً. لا تضف أسماء أو مبالغ أو
              هواتف أو بريد أو أسرار.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-bold">النوع</span>
                  <Select
                    value={form.category}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category: event.target.value as SupportCategory,
                      }))
                    }
                  >
                    {supportCategories.map((value) => (
                      <option key={value} value={value}>
                        {categoryLabels[value]}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-bold">الأولوية</span>
                  <Select
                    value={form.urgency}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        urgency: event.target.value as SupportUrgency,
                      }))
                    }
                  >
                    {supportUrgencies.map((value) => (
                      <option key={value} value={value}>
                        {urgencyLabels[value]}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">
                  مرجع الخطأ{" "}
                  <span className="font-normal text-muted-foreground">
                    (اختياري)
                  </span>
                </span>
                <Input
                  dir="ltr"
                  value={form.errorReference}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      errorReference: event.target.value,
                    }))
                  }
                  maxLength={120}
                  placeholder="ERR-... أو PGRST... دون نسخ الرسالة كاملة"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">ما النتيجة المتوقعة؟</span>
                <Textarea
                  value={form.expectedBehavior}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expectedBehavior: event.target.value,
                    }))
                  }
                  maxLength={1000}
                  required
                  aria-describedby="support-safe-hint"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-bold">ماذا حدث فعلياً؟</span>
                <Textarea
                  value={form.actualBehavior}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      actualBehavior: event.target.value,
                    }))
                  }
                  maxLength={1000}
                  required
                  aria-describedby="support-safe-hint"
                />
              </label>
              <div
                id="support-safe-hint"
                className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-5 text-warning"
              >
                <LockKeyhole
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <p>
                  يُرفض الوصف إذا احتوى كلمة مرور أو رمزاً أو بريداً أو رقماً
                  طويلاً. المرفقات غير مدعومة.
                </p>
              </div>
              {validationMessage || errorMessage ? (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {validationMessage ?? errorMessage}
                </p>
              ) : null}
              {receipt?.id ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-success/30 bg-success/10 p-3 text-sm text-success"
                >
                  <p className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="size-4" />
                    تم استلام الطلب: <span dir="ltr">{receipt.reference}</span>
                  </p>
                  <p className="mt-1 text-xs leading-5">
                    {receipt.responseTarget}. هذه أهداف تشغيلية وليست ضماناً
                    تعاقدياً.
                  </p>
                </div>
              ) : null}
              <Button type="submit" disabled={mutation.isPending}>
                <Send className="me-2 size-4" />
                {mutation.isPending ? "جارٍ الإرسال..." : "إرسال داخل MALEK"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <SystemStatusCard />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-warning" />
                التصعيد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6">
              <p>
                <strong>أمن أو خصوصية:</strong> اختر أمن، وتوقف عن استخدام
                المسار المتأثر.
              </p>
              <p>
                <strong>فقد أو اختلاط بيانات:</strong> لا تحاول إصلاح السجلات
                يدوياً.
              </p>
              <p>
                <strong>دفع أو قيد غير واضح:</strong> لا تكرر العملية قبل مراجعة
                السجل.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>طلباتي الأخيرة</CardTitle>
          <CardDescription>
            يعرض المرجع والحالة فقط؛ لا يعيد نشر وصف المشكلة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              جارٍ تحميل الطلبات...
            </p>
          ) : requests.isError ? (
            <div role="alert" className="text-sm text-destructive">
              تعذر تحميل الطلبات. تحقق من الاتصال أو تطبيق تحديث قاعدة البيانات.
            </div>
          ) : requests.data && requests.data.length > 0 ? (
            <ul className="divide-y">
              {requests.data.map((request) => (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-bold" dir="ltr">
                      {request.reference}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {categoryLabels[request.category]} ·{" "}
                      {new Date(request.updatedAt).toLocaleDateString("ar-OM")}
                    </p>
                    {request.publicNote ? (
                      <p className="mt-1 text-xs">{request.publicNote}</p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      request.status === "RESOLVED" ||
                      request.status === "CLOSED"
                        ? "success"
                        : request.status === "WAITING_USER"
                          ? "warning"
                          : "info"
                    }
                  >
                    {statusLabels[request.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              لا توجد طلبات دعم مسجلة لهذا الحساب في الشركة الحالية.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
export function HelpSupportPage() {
  return (
    <PageLayout size="wide" dir="rtl" lang="ar" visualVariant="malek-pro">
      <PageHeader
        title="المساعدة والدعم"
        description="إرشادات قصيرة مرتبطة بالمهام، تشخيص آمن، وطلبات دعم داخلية دون مشاركة البيانات مع طرف خارجي."
      />
      <KnowledgeBase />
      <SupportIntake />
      <Card variant="muted">
        <CardContent className="flex items-start gap-3 py-4 text-sm leading-6">
          <BookOpen
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p>
            هذه المقالات تشرح السلوك المتحقق في التطبيق ولا تستبدل السياسة
            المحاسبية أو القانونية. عند اختلاف المقال عن الشاشة، أرسل طلب دعم
            واذكر المسار والإصدار.
          </p>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
