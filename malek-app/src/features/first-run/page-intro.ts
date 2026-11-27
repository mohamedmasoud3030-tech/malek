/**
 * شرح سطر واحد لكل صفحة — Stream A (تبسيط التجربة الأولى).
 *
 * خريطة من مسار الصفحة إلى جملة عربية بسيطة تشرح للمستخدم الجديد الصفحة دي
 * بتعمل إيه. تظهر أعلى محتوى الصفحة من AppShell، من غير ما نعدل أي صفحة
 * موجودة.
 *
 * المطابقة بأطول بادئة على حدود الأجزاء (segment boundary): تسجيل
 * `/properties` يغطي `/properties/123` ووحداته، بينما `/properties/new`
 * يبقى له شرحه الخاص لأنه أطول.
 */

export interface PageIntroEntry {
  /** مسار الصفحة أو بادئته (يبدأ بـ /). */
  path: string;
  /** جملة واحدة بسيطة تشرح الصفحة. */
  intro: string;
}

export const PAGE_INTROS: readonly PageIntroEntry[] = [
  {
    path: '/dashboard',
    intro: 'الصفحة الرئيسية: ملخص شغل النهارده، الفلوس اللي اتحصلت، والحاجات اللي مستنياك.',
  },
  {
    path: '/properties/new',
    intro: 'هنا تضيف عقار جديد: اكتب بياناته الأساسية واحفظ، وبعدها تقدر تضيف وحداته.',
  },
  {
    path: '/properties',
    intro: 'كل عقاراتك في مكان واحد. دوس على أي عقار عشان تشوف وحداته وعقوده.',
  },
  {
    path: '/lands',
    intro: 'سجل الأراضي اللي بتديرها: بيانات كل أرض ومرفقاتها.',
  },
  {
    path: '/owners',
    intro: 'ملفات الملاك: بياناتهم، العقارات اللي بيديروها معاك، ومستحقاتهم.',
  },
  {
    path: '/tenants',
    intro: 'المستأجرين الحاليين والسابقين: بيانات التواصل وعقود كل واحد.',
  },
  {
    path: '/people',
    intro: 'كل الناس اللي شغال معاهم: ملاك ومستأجرين ووسطاء في مكان واحد.',
  },
  {
    path: '/leads',
    intro: 'العملاء المحتملين: مين اتواصلت معاه ووصلت لحد فين.',
  },
  {
    path: '/communication',
    intro: 'سجل المكالمات والرسايل بينك وبين العملاء.',
  },
  {
    path: '/contracts/new',
    intro: 'هنا تعمل عقد جديد: اختار الوحدة والمستأجر وحدد الإيجار والمدة.',
  },
  {
    path: '/contracts',
    intro: 'كل العقود وحالة كل واحد: الشغال، اللي قرب يخلص، والمنتهي.',
  },
  {
    path: '/financials',
    intro: 'الفلوس الداخلة والخارجة: التحصيل والمصاريف والإيصالات.',
  },
  {
    path: '/commissions',
    intro: 'العمولات: مين ليه كام، واتدفع ولا لسه.',
  },
  {
    path: '/receipts',
    intro: 'إيصالات القبض والصرف اللي اتعملت.',
  },
  {
    path: '/reports',
    intro: 'تقارير جاهزة تجاوب على أسئلة زي: كسبت كام؟ ومين متأخر في الدفع؟',
  },
  {
    path: '/ai-assistant',
    intro: 'اسأل بالعربي عن أي حاجة في بياناتك والمساعد يجاوبك من النظام.',
  },
  {
    path: '/help',
    intro: 'شرح مزايا النظام وطرق التواصل مع الدعم.',
  },
  {
    path: '/maintenance',
    intro: 'طلبات الصيانة: اللي اتبلغ عنه، واللي بيتنفذ، واللي خلص.',
  },
  {
    path: '/service-providers',
    intro: 'الفنيين والشركات اللي بينفذولك الصيانة والخدمات.',
  },
  {
    path: '/utilities',
    intro: 'عدادات الكهربا والميه والغاز: تسجيل القراءات والفواتير.',
  },
  {
    path: '/documents-vault',
    intro: 'المستندات المهمة (عقود ملكية، بطاقات، تراخيص) محفوظة ومرتبة هنا.',
  },
  {
    path: '/settings',
    intro: 'إعدادات الشركة والمستخدمين والصلاحيات وسجل العمليات.',
  },
];

/**
 * يرجّع شرح الصفحة الحالية، أو null لو المسار ملوش شرح (زي صفحات الدخول
 * والبوابات الخارجية) فميظهرش أي سطر زيادة.
 */
export function resolvePageIntro(pathname: string): string | null {
  let best: PageIntroEntry | null = null;
  for (const entry of PAGE_INTROS) {
    if (entry.path.length <= (best?.path.length ?? 0)) continue;
    if (pathname === entry.path || pathname.startsWith(`${entry.path}/`)) {
      best = entry;
    }
  }
  return best?.intro ?? null;
}
