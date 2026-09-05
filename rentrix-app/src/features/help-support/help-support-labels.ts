/**
 * Help & support vocabulary: the Arabic labels for article owners, request
 * categories, urgency levels and request statuses, plus the small route helpers
 * that read the deep-link search params.
 *
 * Split out of `help-support-page.tsx` so the page stays a composition of
 * sections instead of growing its own data layer (the architecture guard caps
 * pages at 650 lines).
 */
import { sanitizeSupportRoute } from "./help-context";
import {
  getContextualHelpArticleId,
  getHelpArticle,
  type HelpArticle,
} from "./help-content";
import type { SupportCategory, SupportUrgency } from "./support-service";

export const articleOwnerLabels = {
  product: "المنتج",
  operations: "العمليات",
  security: "الأمن",
  finance: "المالية",
} as const;

export const categoryLabels: Readonly<Record<SupportCategory, string>> = {
  HOW_TO: "سؤال عن طريقة العمل",
  ACCESS: "الحساب أو الصلاحيات",
  TECHNICAL: "خطأ تقني أو أداء",
  DATA_QUALITY: "سلامة أو جودة البيانات",
  PAYMENT_POSTING: "تحصيل أو قيد مالي غير واضح",
  SECURITY: "أمن أو خصوصية",
};

export const urgencyLabels: Readonly<Record<SupportUrgency, string>> = {
  LOW: "منخفضة — سؤال لا يوقف العمل",
  NORMAL: "عادية — يوجد مسار بديل",
  HIGH: "عالية — مهمة أساسية متوقفة",
  CRITICAL: "حرجة — أمن، فقد بيانات، أو أثر مالي محتمل",
};

export const statusLabels = {
  ACKNOWLEDGED: "تم الاستلام",
  IN_REVIEW: "قيد المراجعة",
  WAITING_USER: "بانتظار ردك",
  RESOLVED: "تم الحل",
  CLOSED: "مغلق",
} as const;

export const supportQueryKey = ["support", "my-requests"] as const;

/** Where a support request was opened from, sanitized to a known app route. */
export function currentSupportContextPath(): string {
  if (typeof window === "undefined") return "/help";
  const from = new URLSearchParams(window.location.search).get("from");
  return sanitizeSupportRoute(from || window.location.pathname);
}

/** Deep-linked article, else the contextual article for the referring route. */
export function getInitialArticle(): string {
  if (typeof window === "undefined") return "first-office-setup";
  const requested = new URLSearchParams(window.location.search).get("article");
  return (
    getHelpArticle(requested)?.id ??
    getContextualHelpArticleId(
      new URLSearchParams(window.location.search).get("from") || "/dashboard",
    )
  );
}

export function buildDeepLink(article: HelpArticle["links"][number]): string {
  if (!article.search) return article.to;
  return `${article.to}?${new URLSearchParams(article.search).toString()}`;
}
