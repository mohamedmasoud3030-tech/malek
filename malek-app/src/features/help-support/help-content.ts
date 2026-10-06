export type HelpArticleCategory =
  | "getting-started"
  | "workflows"
  | "access"
  | "troubleshooting"
  | "privacy";

export type HelpArticle = Readonly<{
  id: string;
  title: string;
  summary: string;
  category: HelpArticleCategory;
  keywords: readonly string[];
  steps: readonly string[];
  note?: string;
  links: readonly {
    label: string;
    to: string;
    search?: Readonly<Record<string, string>>;
  }[];
  owner: "product" | "operations" | "security" | "finance";
  verifiedOn: string;
}>;

export const helpCategoryLabels: Readonly<Record<HelpArticleCategory, string>> =
  {
    "getting-started": "البدء والإعداد",
    workflows: "المهام الأساسية",
    access: "الحساب والصلاحيات",
    troubleshooting: "حل المشكلات",
    privacy: "البيانات والخصوصية",
  };

export const helpArticles: readonly HelpArticle[] = [
  {
    id: "first-office-setup",
    title: "إعداد المكتب لأول مرة",
    summary:
      "ابدأ ببيانات الشركة، ثم العقارات والوحدات والأطراف قبل إنشاء العقود.",
    category: "getting-started",
    keywords: ["بدء", "إعداد", "شركة", "مكتب", "onboarding"],
    steps: [
      "راجع بيانات الشركة من الإعدادات إذا كانت لديك صلاحية إدارة الشركة.",
      "أضف العقار ثم وحداته من مساحة العقارات؛ لا تبدأ بعقد لوحدة غير مسجلة.",
      "سجّل المالك والمستأجر أو جهة التعامل المطلوبة، ثم اربط العلاقة الصحيحة.",
      "أنشئ العقد كمسودة واتبع بوابات المراجعة والوثائق الظاهرة قبل التفعيل.",
    ],
    note: "قد تظهر خطوات إعداد إضافية بحسب دورك ونموذج تشغيل الشركة. لا تتجاوز بوابات المراجعة أو الأدلة.",
    links: [
      { label: "فتح الإعدادات", to: "/settings" },
      { label: "فتح العقارات", to: "/properties" },
      { label: "إنشاء عقد", to: "/contracts/new" },
    ],
    owner: "operations",
    verifiedOn: "2026-08-20",
  },
  {
    id: "property-unit-setup",
    title: "إضافة عقار ووحداته",
    summary: "رتّب بيانات الأصل والوحدات قبل الإشغال أو التعاقد.",
    category: "workflows",
    keywords: ["عقار", "وحدة", "إشغال", "مالك"],
    steps: [
      "من العقارات اختر إضافة عقار وأكمل الحقول المطلوبة فقط بالبيانات المعتمدة.",
      "افتح ملف العقار وأضف الوحدات من قسم الوحدات.",
      "إذا تعذر الحفظ، تحقق من الاتصال وصلاحية الكتابة والحقول المطلوبة قبل التكرار.",
      "لا تؤرشف وحدة مرتبطة بعقد فعال؛ استخدم مسار العقد أولاً.",
    ],
    links: [
      { label: "قائمة العقارات", to: "/properties" },
      { label: "إضافة عقار", to: "/properties/new" },
    ],
    owner: "operations",
    verifiedOn: "2026-08-20",
  },
  {
    id: "contract-lifecycle",
    title: "إنشاء العقد ومراجعته وتفعيله",
    summary:
      "المسودة ليست عقداً فعالاً، والتفعيل يخضع للصلاحية والأدلة والمراجعة.",
    category: "workflows",
    keywords: ["عقد", "مسودة", "تفعيل", "توقيع", "تجديد", "مراجعة"],
    steps: [
      "تحقق من العقار والوحدة والمستأجر وشروط الاتفاق قبل إنشاء المسودة.",
      "راجع المبالغ والتواريخ والنسخة المرتبطة من الاتفاق؛ لا تعتمد على الحساب اليدوي وحده.",
      "أكمل الأدلة والموافقات التي يطلبها ملف العقد. قد يتطلب الاعتماد شخصاً مختلفاً عن المنشئ.",
      "بعد التفعيل استخدم إجراءات دورة العقد الرسمية للتجديد أو الإنهاء؛ لا تعدّل التاريخ المالي مباشرة.",
    ],
    note: "إذا كانت الوحدة مشغولة بعقد متداخل أو كانت الأدلة ناقصة، يجب أن يفشل التفعيل بدلاً من تجاوز التعارض.",
    links: [
      { label: "العقود", to: "/contracts" },
      { label: "إنشاء عقد", to: "/contracts/new" },
    ],
    owner: "operations",
    verifiedOn: "2026-08-20",
  },
  {
    id: "collections-receipts",
    title: "الفواتير والتحصيل والإيصالات",
    summary:
      "سجّل التحصيل من مسار الفاتورة المعتمد، وراجع النتيجة قبل إعادة المحاولة.",
    category: "workflows",
    keywords: ["فاتورة", "تحصيل", "دفعة", "إيصال", "إلغاء", "متأخرات"],
    steps: [
      "افتح المالية ثم التحصيل والفواتير، وتحقق من الفاتورة والعقد والمبلغ المتبقي.",
      "استخدم إجراء تسجيل التحصيل المصرح به؛ لا تنشئ قيداً محاسبياً يدوياً لتعويض فشل العملية.",
      "إذا انقطع الاتصال بعد الإرسال، حدّث السجل وابحث عن الإيصال قبل تكرار الدفع.",
      "إلغاء إيصال منشور يتم بطلب ومراجعة منفصلين عندما يفرض النظام ذلك؛ لا تحذف السجل.",
    ],
    note: "الأرقام الظاهرة في الواجهة ليست بديلاً عن التقرير المحاسبي أو الإيصال المنشور.",
    links: [
      {
        label: "الفواتير",
        to: "/financials",
        search: { section: "collections", view: "invoices" },
      },
      {
        label: "الإيصالات",
        to: "/financials",
        search: { section: "collections", view: "receipts" },
      },
      {
        label: "المتأخرات",
        to: "/financials",
        search: { section: "collections", view: "arrears" },
      },
    ],
    owner: "finance",
    verifiedOn: "2026-08-20",
  },
  {
    id: "bank-import",
    title: "استيراد كشف البنك والمطابقة",
    summary:
      "عاين الملف أولاً، أصلح الصفوف غير الصالحة، ثم نفّذ الاستيراد والمطابقة بصلاحية مناسبة.",
    category: "workflows",
    keywords: ["بنك", "كشف", "CSV", "استيراد", "مطابقة"],
    steps: [
      "افتح البنوك والمطابقة البنكية واختر الحساب الصحيح.",
      "ارفع ملف CSV المسموح للمعاينة؛ لا تعتبر المعاينة استيراداً نهائياً.",
      "راجع الصفوف المرفوضة والتكرارات والتاريخ والمبلغ قبل التأكيد.",
      "نفّذ المطابقة من الاقتراحات أو المراجعة اليدوية، ولا تجبر مطابقة غير مؤكدة.",
    ],
    note: "لا ترفق كشفاً بنكياً أو أرقام حسابات كاملة بطلب دعم. اكتفِ بمرجع الدفعة أو مرجع الخطأ.",
    links: [
      {
        label: "المطابقة البنكية",
        to: "/financials",
        search: { section: "banking", view: "bank_reconciliation" },
      },
    ],
    owner: "finance",
    verifiedOn: "2026-08-20",
  },
  {
    id: "permissions",
    title: "لماذا لا يظهر الإجراء أو تظهر رسالة منع؟",
    summary:
      "إخفاء الزر لا يمنح أو يسحب الصلاحية؛ الخادم هو المرجع النهائي لكل إجراء.",
    category: "access",
    keywords: ["صلاحية", "دور", "منع", "زر", "مدير", "موافقة"],
    steps: [
      "تأكد أنك داخل الشركة الصحيحة وأن الجلسة لم تنتهِ.",
      "راجع اسم الإجراء المطلوب، فصلاحية العرض قد تختلف عن الإنشاء أو الاعتماد أو التصدير.",
      "استخدم طلب الصلاحية الظاهر إن توفر، واذكر المهمة المطلوبة دون إرسال بيانات حساسة.",
      "بعد الموافقة حدّث الصفحة أو أعد فتحها. إذا استمر المنع أرسل طلب دعم مع المسار والدور.",
    ],
    note: "لا تطلب مشاركة حساب مدير أو كلمة مروره. الموافقات الحساسة قد تتطلب منفذاً ومراجعاً مختلفين.",
    links: [
      {
        label: "إعدادات المستخدمين والصلاحيات",
        to: "/settings",
        search: { section: "users-permissions" },
      },
    ],
    owner: "security",
    verifiedOn: "2026-08-20",
  },
  {
    id: "account-recovery",
    title: "تسجيل الدخول واستعادة الحساب",
    summary:
      "استخدم الاستعادة الرسمية، ولا ترسل كلمة المرور أو رابط إعادة التعيين للدعم.",
    category: "access",
    keywords: ["دخول", "كلمة مرور", "استعادة", "جلسة", "رمز"],
    steps: [
      "إذا رفض تسجيل الدخول، تحقق من البريد الصحيح وحالة تأكيده دون تجربة كلمات مرور متكررة.",
      "استخدم نسيت كلمة المرور من شاشة الدخول، ثم افتح أحدث رسالة استعادة فقط.",
      "إذا انتهى الرابط اطلب رابطاً جديداً؛ لا ترسل الرابط أو الرمز لأي شخص.",
      "عند انتهاء الجلسة أثناء العمل سجّل الدخول مجدداً وتحقق من نتيجة آخر عملية قبل تكرارها.",
    ],
    links: [
      {
        label: "تغيير كلمة المرور بعد الدخول",
        to: "/settings",
        search: { section: "security" },
      },
    ],
    owner: "security",
    verifiedOn: "2026-08-20",
  },
  {
    id: "offline-errors",
    title: "العمل دون اتصال وأخطاء التحميل أو الحفظ",
    summary:
      "يمكن مراجعة بعض البيانات الظاهرة دون اتصال، لكن الحفظ والتحديث قد يفشلان.",
    category: "troubleshooting",
    keywords: ["دون اتصال", "شبكة", "خطأ", "تحميل", "حفظ", "فارغ"],
    steps: [
      "تحقق من شريط حالة الاتصال أعلى التطبيق. لا تفترض أن الشاشة الفارغة تعني عدم وجود بيانات إذا ظهر خطأ.",
      "عند خطأ تحميل استخدم إعادة المحاولة مرة واحدة بعد عودة الاتصال.",
      "عند غموض نتيجة حفظ أو دفع، افتح السجل وابحث عن النتيجة قبل تكرار الإرسال.",
      "إذا استمر الخطأ، احتفظ بمرجع الخطأ والمسار والوقت، ثم أنشئ طلب دعم دون نسخ بيانات السجل.",
    ],
    note: "لا توجد مزامنة كتابة مؤجلة مضمونة أثناء انقطاع الشبكة.",
    links: [],
    owner: "product",
    verifiedOn: "2026-08-20",
  },
  {
    id: "reports-documents",
    title: "التقارير والطباعة وملفات PDF",
    summary:
      "راجع نطاق التقرير وبياناته قبل التصدير، واستخدم مخرجات المستند المعتمدة.",
    category: "troubleshooting",
    keywords: ["تقرير", "PDF", "طباعة", "تصدير", "كشف"],
    steps: [
      "حدد الفترة والفلاتر المطلوبة وانتظر اكتمال التحميل قبل الطباعة أو التصدير.",
      "إذا فشل PDF، أعد المحاولة من مستعرض مدعوم وتأكد أن بيانات المستند اكتملت.",
      "قارن الإجماليات بالشاشة أو التقرير المحاسبي المعتمد قبل مشاركة الملف.",
      "لا ترسل المستند الكامل للدعم؛ أرسل نوع المستند ومرجع الخطأ فقط.",
    ],
    links: [{ label: "المحاسبة والتقارير", to: "/reports" }],
    owner: "finance",
    verifiedOn: "2026-08-20",
  },
  {
    id: "data-privacy",
    title: "ما الذي يمكن مشاركته مع الدعم؟",
    summary:
      "شارك وصف المشكلة والمرجع التقني فقط، ولا تشارك أسراراً أو محتوى خاصاً.",
    category: "privacy",
    keywords: ["خصوصية", "بيانات", "دعم", "سر", "هاتف", "هوية"],
    steps: [
      "مسموح: مسار الشاشة، إصدار التطبيق، الدور، وقت المشكلة ومرجع الخطأ.",
      "مسموح: وصف مختصر للنتيجة المتوقعة والفعلية دون أسماء أو مبالغ أو نصوص مستندات.",
      "ممنوع: كلمات المرور، رموز الدخول، مفاتيح API، روابط الاستعادة أو ترويسات Authorization.",
      "ممنوع: أرقام الهوية والحسابات البنكية والهواتف والبريد ومرفقات العقود أو كشوف البنك.",
    ],
    links: [{ label: "سياسة الخصوصية", to: "/privacy" }],
    owner: "security",
    verifiedOn: "2026-08-20",
  },
  {
    id: "product-billing",
    title: "الفوترة التشغيلية مقابل اشتراك MALEK",
    summary:
      "قسم المالية يدير فواتير الإيجار والتشغيل؛ لا توجد حالياً شاشة اشتراك أو دفع لخدمة MALEK داخل التطبيق.",
    category: "getting-started",
    keywords: ["اشتراك", "فوترة", "سعر", "دفع الخدمة", "billing"],
    steps: [
      "استخدم المالية فقط لفواتير العقود والتحصيلات والمصروفات التشغيلية المصرح بها.",
      "لا تسجل رسوم اشتراك MALEK كدفعة مستأجر أو قيد مالي داخل المنتج.",
      "لأي استفسار تجاري عن الخدمة استخدم قناة مالك الحساب المعتمدة خارج بيانات التشغيل.",
    ],
    links: [{ label: "المالية التشغيلية", to: "/financials" }],
    owner: "product",
    verifiedOn: "2026-08-20",
  },
  {
    id: "ai-assistant",
    title: "حدود مساعد الذكاء الاصطناعي",
    summary:
      "المساعد قراءة فقط، ولا ينفذ دفعات أو تعديلات أو قرارات محاسبية أو قانونية.",
    category: "privacy",
    keywords: ["ذكاء اصطناعي", "AI", "مساعد", "خصوصية"],
    steps: [
      "استخدم الإجراءات الجاهزة للملخصات الحتمية متى كانت متاحة.",
      "لا تدخل أسماء أو أرقام هواتف أو وثائق أو أسراراً في السؤال الحر.",
      "راجع مصدر البيانات والتنبيهات المرفقة بالرد قبل اتخاذ قرار.",
      "نفّذ أي إجراء من مساره الرسمي وبعد المراجعة البشرية المطلوبة.",
    ],
    links: [{ label: "فتح المساعد", to: "/ai-assistant" }],
    owner: "product",
    verifiedOn: "2026-08-20",
  },
] as const;

const contextualArticleByRoute: readonly [prefix: string, articleId: string][] =
  [
    ["/financials", "collections-receipts"],
    ["/receipts", "collections-receipts"],
    ["/contracts", "contract-lifecycle"],
    ["/properties", "property-unit-setup"],
    ["/reports", "reports-documents"],
    ["/settings", "permissions"],
    ["/ai-assistant", "ai-assistant"],
  ];

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .toLocaleLowerCase("ar")
    .trim();
}

export function searchHelpArticles(query: string): readonly HelpArticle[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return helpArticles;
  const terms = normalized.split(/\s+/).filter(Boolean);
  return helpArticles
    .map((article, originalIndex) => {
      const title = normalizeSearchText(article.title);
      const summary = normalizeSearchText(article.summary);
      const keywords = normalizeSearchText(article.keywords.join(" "));
      const steps = normalizeSearchText(article.steps.join(" "));
      if (
        !terms.every((term) =>
          `${title} ${summary} ${keywords} ${steps}`.includes(term),
        )
      )
        return null;
      const score = terms.reduce(
        (total, term) =>
          total +
          (title.includes(term) ? 8 : 0) +
          (keywords.includes(term) ? 5 : 0) +
          (summary.includes(term) ? 3 : 0) +
          (steps.includes(term) ? 1 : 0),
        0,
      );
      return { article, score, originalIndex };
    })
    .filter(
      (
        entry,
      ): entry is {
        article: HelpArticle;
        score: number;
        originalIndex: number;
      } => entry !== null,
    )
    .sort(
      (left, right) =>
        right.score - left.score || left.originalIndex - right.originalIndex,
    )
    .map(({ article }) => article);
}

export function getHelpArticle(
  articleId: string | null | undefined,
): HelpArticle | null {
  return helpArticles.find((article) => article.id === articleId) ?? null;
}

export function getContextualHelpArticleId(pathname: string): string {
  return (
    contextualArticleByRoute.find(([prefix]) =>
      pathname.startsWith(prefix),
    )?.[1] ?? "first-office-setup"
  );
}
