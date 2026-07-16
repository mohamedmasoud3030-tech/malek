export type Lang = 'ar' | 'en';

const ar = {
  meta: {
    title: 'Rentrix | نظام واحد لإدارة عقاراتك الإيجارية بالكامل',
    description:
      'منصة عربية RTL بالكامل لإدارة العقارات الإيجارية: العقارات والوحدات والعقود والفواتير والتحصيلات والصيانة والتقارير.',
  },
  nav: {
    features: 'المزايا',
    problems: 'لماذا Rentrix؟',
    showcase: 'جولة في المنتج',
    how: 'كيف تبدأ',
    security: 'الأمان',
    faq: 'الأسئلة الشائعة',
    start: 'ابدأ الآن',
    login: 'دخول',
  },
  hero: {
    badge: 'منصة عربية لإدارة العقارات الإيجارية',
    earlyAccess: 'الإطلاق التجريبي قريباً — سجّل اهتمامك مبكراً',
    titleA: 'ودّع جداول Excel،',
    titleB: 'وأدِر عقاراتك من مكان واحد',
    subtitle:
      'Rentrix يجمع العقارات والوحدات والعقود والفواتير والتحصيلات والصيانة والتقارير في مساحة عمل عربية واحدة — عربي RTL أصيل، مصمم لمكاتب العقارات في الخليج.',
    ctaPrimary: 'جرّب التطبيق الآن',
    ctaWhatsapp: 'اطلب عرضاً تجريبياً',
    trustItems: ['عربي RTL بالكامل', 'تقارير مالية دقيقة', 'يعمل من المتصفح مباشرة', 'صلاحيات آمنة'],
    screenshotCaption: 'لقطة حقيقية من لوحة تحكم Rentrix — مؤشرات التحصيل والإشغال والمتأخرات لحظة بلحظة',
    scroll: 'اكتشف المزيد',
  },
  stats: [
    { value: 20, suffix: '+', label: 'وحدة وظيفية متكاملة' },
    { value: 10, suffix: '+', label: 'تقرير وكشف حساب جاهز' },
    { value: 100, suffix: '%', label: 'عربي RTL أصيل' },
    { value: 3, suffix: '', label: 'أدوار صلاحيات دقيقة' },
  ],
  problems: {
    kicker: 'المشكلة والحل',
    title: 'كل مشكلة تواجهك في إدارة الإيجارات… لها حل واضح',
    subtitle:
      'بنينا Rentrix فوق فهم حقيقي ليوميات مكاتب العقارات: كل ألم تعرفه جيداً، قابله حل مصمم بدقة.',
    painTitle: 'ما تعانيه اليوم',
    solutionTitle: 'ما يقدمه Rentrix',
    footnote: 'انتقال واحد… يلغي كل هذا العناء.',
    items: [
      {
        pain: 'متأخرات الإيجار تضيع بين الجداول وتُكتشف متأخراً',
        solution: 'قسم «الأولوية الآن» يُبرز الفواتير المتأخرة فوراً ويبدأ المتابعة بنقرة واحدة',
      },
      {
        pain: 'إيصالات وفواتير يدوية مليئة بالأخطاء وصعبة التدقيق',
        solution: 'فواتير وتحصيلات مرتبطة بالدفعات الفعلية، وسجل إيصالات قابل للتدقيق لا يُحذف أثره',
      },
      {
        pain: 'تواريخ انتهاء العقود تفوتك وتخسر التجديدات',
        solution: 'تنبيه «العقود المنتهية قريباً» يعطيك وقتك الكافي قبل كل تجديد',
      },
      {
        pain: 'تجهيز كشف حساب للمالك يستهلك أيام عمل',
        solution: 'كشوف حساب للمالك والمستأجر من مركز التقارير بنقرة — تصدير CSV وPDF وطباعة',
      },
      {
        pain: 'طلبات الصيانة تتوه في رسائل الواتساب',
        solution: 'طلبات صيانة مركزية بأولويات عاجلة، مرتبطة بمصروفاتها الفعلية',
      },
      {
        pain: 'كل موظف يصل لكل شيء… أو لا يصل لشيء',
        solution: 'أدوار ADMIN وMANAGER وUSER بصلاحيات مشاهدة دقيقة لكل قسم',
      },
    ],
  },
  features: {
    kicker: 'المزايا',
    title: 'منظومة متكاملة — لا أدوات متناثرة',
    subtitle:
      'دورة حياة العقار كاملة: من تسجيل أول وحدة، حتى التحصيل الشهري وتقارير الملاك، في مساحة عمل واحدة.',
    spotlight: {
      title: 'لوحة تحكم تقرأ اليوم قبل أن يبدأ',
      description:
        'مؤشرات التحصيل الشهري ونسبة الإشغال وصافي الدخل والمتأخرات في شبكة قرار مرئية، مع إجراءات سريعة: قبض دفعة، عقد جديد، طلب صيانة، إضافة عقار.',
      caption: 'لوحة التحكم الرئيسية — لقطة حقيقية من التطبيق',
    },
    cards: [
      {
        title: 'المالية والتحصيل',
        description: 'فواتير وإيصالات ومصروفات ومتأخرات مربوطة بالدفعات المعتمدة، مع دعم ضريبة القيمة المضافة ومراكز التكلفة.',
      },
      {
        title: 'العقود والوحدات',
        description: 'إنشاء عقود الإيجار وتجديدها وتتبع حالاتها، وحالة كل وحدة: مشغولة أو شاغرة، بلمحة واحدة.',
      },
      {
        title: 'مركز التقارير والكشوف',
        description: 'تحصيلات، متأخرات، إشغال، كشوف ملاك ومستأجرين، تدفق نقدي وإقرار ضريبي — فلاتر موحدة وتصدير فوري.',
      },
      {
        title: 'الصيانة والتواصل',
        description: 'طلبات صيانة بأولويات عاجلة وسجل تواصل موثق لكل عقار وعقد — لا شيء يضيع.',
      },
      {
        title: 'الملاك والمستأجرون',
        description: 'دليل جهات موحد، اتفاقيات الملاك وتسوياتهم، وبيانات مالية موحدة لكل مستأجر.',
      },
      {
        title: 'العملاء المحتملون والعمولات',
        description: 'تابع العملاء المحتملين حتى التعاقد، وإدارة عمولات فريقك من نفس المنظومة.',
      },
      {
        title: 'هوية مكتبك جاهزة',
        description: 'اسم شركتك وسجلها التجاري ورقمها الضريبي وشعارها تنعكس على المستندات والقوالب من مكان واحد.',
      },
      {
        title: 'نماذج موحّدة وسريعة',
        description: 'نموذج إدخال واحد متجاوب للجوال والحاسوب — أقل أخطاء، وأسرع تدريب لفريقك.',
      },
    ],
  },
  showcase: {
    kicker: 'جولة في المنتج',
    title: 'شاهد التطبيق الحقيقي — لا رسومات توضيحية',
    subtitle: 'كل ما تراه هنا لقطات فعلية من أحدث نسخة من Rentrix.',
    watchVideo: 'شاهد الجولة بالفيديو',
    closeVideo: 'إغلاق الفيديو',
    tabs: [
      {
        id: 'dashboard',
        label: 'لوحة التحكم',
        caption: 'نبض مكتبك اليومي: الأولويات، مؤشرات الأداء، قوائم العمل.',
      },
      {
        id: 'properties',
        label: 'العقارات',
        caption: 'أبراج وفلل وعمائر ومجمعات — بقيمتها ومالكيها وحالتها في جدول واحد.',
      },
      {
        id: 'contracts',
        label: 'العقود',
        caption: 'إدارة دورة العقد من مسودة إلى نشط ثم منتهي أو ملغي — وتصدير CSV بضغطة.',
      },
      {
        id: 'financials',
        label: 'مركز المالية',
        caption: 'الفواتير والإيصالات والمصروفات والمتأخرات ومطابقة البنك في منظومة واحدة.',
      },
      {
        id: 'maintenance',
        label: 'الصيانة',
        caption: 'كل طلب بأولوية وحالة وفني مسؤول — مع طباعة كشف A4 جاهز للتوقيع.',
      },
      {
        id: 'ai-assistant',
        label: 'المساعد الذكي',
        caption: 'اسأل عن المتأخرات والتجديدات واللقطة المالية — يجيبك بالعربي بأمان تام.',
      },
      {
        id: 'automation',
        label: 'الأتمتة',
        caption: 'تذكيرات الإيجار وتنبيهات انتهاء العقود وإشعارات الصيانة تعمل وحدها.',
      },
      {
        id: 'workspace',
        label: 'مركز التقارير',
        caption: 'تحصيلات ومتأخرات وإشغال ومحاسبة مع فلاتر موحدة وتصدير CSV/PDF.',
      },
      {
        id: 'settings',
        label: 'إعدادات المكتب',
        caption: 'هوية الشركة والعملة واللغة وقوالب المستندات في مكان واحد.',
      },
      {
        id: 'entity-form',
        label: 'النموذج الموحّد',
        caption: 'إدخال سريع ومتسق لكل الكيانات — على الجوال والحاسوب.',
      },
    ],
  },
  how: {
    kicker: 'كيف تبدأ',
    title: 'ثلاث خطوات… وتعمل من اليوم الأول',
    subtitle: 'لا تثبيت، لا خوادم، لا دورات تدريبية طويلة.',
    steps: [
      {
        title: 'سجّل عقاراتك ووحداتك',
        description: 'أدخل أول عقار خلال دقائق — العقارات، الوحدات، الملاك والمستأجرين في دليل واحد منظم.',
      },
      {
        title: 'أصدر العقود وابدأ التحصيل',
        description: 'عقود إيجار وفواتير وإيصالات قبض مسجلة بدفعات معتمدة ومربوطة بالكشوف تلقائياً.',
      },
      {
        title: 'راقب الأداء وشارك الكشوف',
        description: 'لوحات المؤشرات ومركز التقارير يجعلان قراراتك أسرع — وكشوف الملاك جاهزة دائماً.',
      },
    ],
  },
  devices: {
    kicker: 'في كل مكان',
    title: 'مكتبك العقاري… في جيبك',
    subtitle:
      'واجهة متجاوبة بالكامل تعمل من المتصفح على الجوال والتابلت وسطح المكتب، مع وضع داكن مريح للعمل الليلي.',
    bullets: [
      'لا تطبيقات تُثبّت — افتح المتصفح واعمل فوراً',
      'تصميم متجاوب بنفس القوة على كل المقاسات',
      'وضع داكن وفاتح كاملان بضغطة واحدة',
    ],
    mobileLabel: 'على الجوال',
    darkLabel: 'الوضع الداكن',
  },
  security: {
    kicker: 'الأمان والثقة',
    title: 'بياناتك ملكك — محمية بكل طبقة',
    subtitle: 'بنية أمان من واجهة المستخدم حتى قاعدة البيانات، وليست مجرد شاشة دخول.',
    items: [
      {
        title: 'صلاحيات أدوار دقيقة',
        description: 'ADMIN وMANAGER وUSER — كل قسم يُفتَح بصلاحية مشاهدة محددة، فلا يطلع أحد إلا على ما يخصه.',
      },
      {
        title: 'سجل تدقيق كامل',
        description: 'كل حركة مالية وتشغيلية موثقة: من فعل ماذا ومتى — قابل للمراجعة في أي وقت.',
      },
      {
        title: 'حماية على مستوى قاعدة البيانات',
        description: 'سياسات أمان على مستوى الصفوف (RLS) تمنع الوصول غير المصرح حتى قبل وصوله للواجهة.',
      },
      {
        title: 'فحوص سلامة البيانات',
        description: 'أدوات فحص تكامل مدمجة ترصد أي خلل في الربط المالي قبل أن يتحول إلى مشكلة.',
      },
    ],
  },
  faq: {
    kicker: 'الأسئلة الشائعة',
    title: 'كل ما تريد معرفته قبل البدء',
    subtitle: 'لم تجد إجابتك؟ راسلنا مباشرة وسنرد عليك.',
    items: [
      {
        q: 'هل أحتاج إلى تثبيت برنامج على أجهزتي؟',
        a: 'لا. Rentrix يعمل بالكامل من المتصفح — على حاسوبك وجوالك — بواجهة عربية كاملة، دون أي تثبيت أو تحديثات يدوية.',
      },
      {
        q: 'هل يدعم النظام عملتي المحلية؟',
        a: 'نعم. تُضبط العملة من إعدادات المكتب (ريال عماني، ريال سعودي، درهم إماراتي… إلخ) وتنعكس على الفواتير والتقارير والطباعة.',
      },
      {
        q: 'أعمل حالياً على Excel — كيف أنتقل؟',
        a: 'ابدأ بإدخال أول عقار خلال دقائق، وأكمل بياناتك تدريجياً. عند تفعيل حسابك التجريبي نرافقك خطوة بخطوة في الإعداد الأولي لمساحة عملك.',
      },
      {
        q: 'هل يوجد تطبيق جوال؟',
        a: 'الواجهة متجاوبة بالكامل وتعمل كتطبيق من متصفح الجوال بنفس القوة — من إصدار عقد إلى متابعة التحصيلات وأنت خارج المكتب.',
      },
      {
        q: 'ماذا عن ضريبة القيمة المضافة؟',
        a: 'يدعم Rentrix إعدادات الضريبة والرقم الضريبي لشركتك، مع تقرير إقرار ضريبة القيمة المضافة ضمن مركز التقارير.',
      },
      {
        q: 'كيف تُحمى بياناتي؟',
        a: 'بصلاحيات أدوار دقيقة، وجلسات آمنة، وسجل تدقيق لكل الحركات المالية، وسياسات حماية على مستوى قاعدة البيانات نفسها.',
      },
    ],
  },
  cta: {
    titleA: 'جاهز تدير عقاراتك',
    titleB: 'بعقلية القرن الحالي؟',
    subtitle:
      'كن من أوائل المكاتب التي تجرب Rentrix. اطلب عرضاً تجريبياً اليوم وسنجهز لك مساحة عمل تناسب محفظتك.',
    primary: 'جرّب التطبيق الآن',
    whatsapp: 'تواصل عبر واتساب',
    note: 'إعداد سريع • دعم عربي كامل • بدون التزام',
  },
  footer: {
    tagline:
      'منصة عربية لإدارة العقارات الإيجارية: عقارات، عقود، مالية، صيانة وتقارير — في مساحة عمل واحدة.',
    productTitle: 'المنتج',
    productLinks: ['المزايا', 'جولة في المنتج', 'كيف تبدأ', 'الأسئلة الشائعة'],
    companyTitle: 'الشركة',
    companyLinks: ['اطلب عرضاً تجريبياً', 'تواصل معنا'],
    legalTitle: 'القانونية',
    legalLinks: ['سياسة الخصوصية', 'شروط الاستخدام'],
    contactTitle: 'تواصل',
    motto: 'صُنع بشغف لمكاتب العقارات في الخليج',
    rights: 'جميع الحقوق محفوظة.',
  },
} as const;

// Widen literal types (from `as const`) into their writable string/number forms so the
// English dictionary can reuse the exact same shape without literal-type mismatches.
type WidenLiteral<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends readonly (infer U)[]
      ? readonly WidenLiteral<U>[]
      : { [K in keyof T]: WidenLiteral<T[K]> };

export type Messages = WidenLiteral<typeof ar>;

const en: Messages = {
  meta: {
    title: 'Rentrix | One system to run your entire rental portfolio',
    description:
      'A fully Arabic-RTL property management platform: properties, units, contracts, invoicing, collections, maintenance and reports — in one workspace.',
  },
  nav: {
    features: 'Features',
    problems: 'Why Rentrix?',
    showcase: 'Product tour',
    how: 'How it works',
    security: 'Security',
    faq: 'FAQ',
    start: 'Get started',
    login: 'Sign in',
  },
  hero: {
    badge: 'The Arabic platform for rental property management',
    earlyAccess: 'Early access soon — register your interest today',
    titleA: 'Ditch the spreadsheets,',
    titleB: 'run your properties in one place',
    subtitle:
      'Rentrix unites properties, units, contracts, invoices, collections, maintenance and reports in a single Arabic-first workspace — built for real-estate offices in the Gulf.',
    ctaPrimary: 'Try the app now',
    ctaWhatsapp: 'Book a live demo',
    trustItems: ['Fully Arabic RTL', 'Accurate financial reports', 'Runs straight in the browser', 'Secure permissions'],
    screenshotCaption: 'A real screenshot of the Rentrix dashboard — collection, occupancy and arrears KPIs live',
    scroll: 'Scroll to explore',
  },
  stats: [
    { value: 20, suffix: '+', label: 'Integrated modules' },
    { value: 10, suffix: '+', label: 'Ready reports & statements' },
    { value: 100, suffix: '%', label: 'Native Arabic RTL' },
    { value: 3, suffix: '', label: 'Granular access roles' },
  ],
  problems: {
    kicker: 'Problem & solution',
    title: 'Every rental-management headache… has a clear cure',
    subtitle:
      'We built Rentrix on a real understanding of daily life inside a property office: every pain you know by heart meets a purpose-built solution.',
    painTitle: 'What you suffer today',
    solutionTitle: 'What Rentrix delivers',
    footnote: 'One move… erases all of this.',
    items: [
      {
        pain: 'Overdue rent gets lost between spreadsheets and noticed too late',
        solution: 'The “Priority now” section surfaces overdue invoices instantly and starts follow-up in one click',
      },
      {
        pain: 'Manual receipts and invoices full of errors and impossible to audit',
        solution: 'Invoices and collections tied to posted payments, with an auditable receipt trail that never disappears',
      },
      {
        pain: 'Contract expiry dates slip by and renewals are lost',
        solution: 'The “contracts expiring soon” alert gives you time before every renewal',
      },
      {
        pain: 'Preparing an owner statement takes days of work',
        solution: 'Owner and tenant statements from the reports hub in one click — CSV, PDF and print export',
      },
      {
        pain: 'Maintenance requests drown in WhatsApp chats',
        solution: 'Centralized, urgency-flagged maintenance requests linked to their actual expenses',
      },
      {
        pain: 'Every employee sees everything… or nothing',
        solution: 'ADMIN, MANAGER and USER roles with precise per-section view permissions',
      },
    ],
  },
  features: {
    kicker: 'Features',
    title: 'One integrated system — no scattered tools',
    subtitle:
      'The full property lifecycle: from registering your first unit, to monthly collection and owner reporting, in a single workspace.',
    spotlight: {
      title: 'A dashboard that reads your day before it starts',
      description:
        'Monthly collection, occupancy rate, net income and arrears KPIs in a visual decision grid — plus quick actions: record a payment, new contract, maintenance request, add a property.',
      caption: 'The main dashboard — a real app screenshot',
    },
    cards: [
      {
        title: 'Finance & collections',
        description: 'Invoices, receipts, expenses and arrears tied to posted payments — with VAT support and cost centers.',
      },
      {
        title: 'Contracts & units',
        description: 'Create, renew and track lease contracts, and see every unit as occupied or vacant at a glance.',
      },
      {
        title: 'Reports & statements hub',
        description: 'Collections, arrears, occupancy, owner and tenant statements, cash flow and VAT return — unified filters and instant export.',
      },
      {
        title: 'Maintenance & communication',
        description: 'Urgency-flagged maintenance requests and a documented communication log per property and contract.',
      },
      {
        title: 'Owners & tenants',
        description: 'A unified people directory, owner agreements and settlements, and one financial identity per tenant.',
      },
      {
        title: 'Leads & commissions',
        description: 'Track leads until they sign, and manage your team’s commissions inside the same system.',
      },
      {
        title: 'Your office identity, built-in',
        description: 'Company name, commercial register, tax number and logo reflected on documents and templates from one place.',
      },
      {
        title: 'One fast, unified form',
        description: 'A single responsive input form for mobile and desktop — fewer errors, faster onboarding for your team.',
      },
    ],
  },
  showcase: {
    kicker: 'Product tour',
    title: 'See the real product — not illustrations',
    subtitle: 'Everything below is an actual capture from the latest Rentrix build.',
    watchVideo: 'Watch the video tour',
    closeVideo: 'Close video',
    tabs: [
      { id: 'dashboard', label: 'Dashboard', caption: 'Your office’s daily pulse: priorities, KPIs, worklists.' },
      { id: 'properties', label: 'Properties', caption: 'Towers, villas and compounds with values, owners and status in one register.' },
      { id: 'contracts', label: 'Contracts', caption: 'Full contract lifecycle from draft to active to expired — with one-click CSV export.' },
      { id: 'financials', label: 'Finance hub', caption: 'Invoices, receipts, expenses, arrears and bank reconciliation in one system.' },
      { id: 'maintenance', label: 'Maintenance', caption: 'Every request with priority, status and assignee — plus a signature-ready A4 printout.' },
      { id: 'ai-assistant', label: 'AI assistant', caption: 'Ask about arrears, renewals and financial snapshots — answers in Arabic, fully read-only.' },
      { id: 'automation', label: 'Automation', caption: 'Rent reminders, contract-expiry alerts and maintenance notifications run on their own.' },
      { id: 'workspace', label: 'Reports hub', caption: 'Collections, arrears, occupancy and accounting with unified filters and CSV/PDF export.' },
      { id: 'settings', label: 'Office settings', caption: 'Company identity, currency, language and document templates in one place.' },
      { id: 'entity-form', label: 'Unified form', caption: 'Fast, consistent data entry for every entity — mobile and desktop.' },
    ],
  },
  how: {
    kicker: 'How it works',
    title: 'Three steps… live from day one',
    subtitle: 'No installation, no servers, no long training courses.',
    steps: [
      {
        title: 'Register your properties & units',
        description: 'Enter your first property within minutes — properties, units, owners and tenants in one organized directory.',
      },
      {
        title: 'Issue contracts & start collecting',
        description: 'Leases, invoices and receipts recorded as posted payments, automatically linked to statements.',
      },
      {
        title: 'Track performance & share statements',
        description: 'KPI dashboards and the reports hub make decisions faster — owner statements always ready.',
      },
    ],
  },
  devices: {
    kicker: 'Anywhere',
    title: 'Your real-estate office… in your pocket',
    subtitle:
      'A fully responsive interface that runs in the browser on mobile, tablet and desktop, with a comfortable dark mode for late work nights.',
    bullets: [
      'Nothing to install — open the browser and work',
      'Equally powerful responsive design at every size',
      'Full dark and light modes in one click',
    ],
    mobileLabel: 'On mobile',
    darkLabel: 'Dark mode',
  },
  security: {
    kicker: 'Security & trust',
    title: 'Your data is yours — protected at every layer',
    subtitle: 'Security from the UI down to the database itself — not just a login screen.',
    items: [
      {
        title: 'Granular role permissions',
        description: 'ADMIN, MANAGER and USER — every section gated by a specific view permission, so people only see what concerns them.',
      },
      {
        title: 'A complete audit trail',
        description: 'Every financial and operational action documented: who did what and when — reviewable anytime.',
      },
      {
        title: 'Database-level protection',
        description: 'Row-level security (RLS) blocks unauthorized access before it ever reaches the interface.',
      },
      {
        title: 'Data integrity checks',
        description: 'Built-in integrity scans catch financial linkage issues before they turn into problems.',
      },
    ],
  },
  faq: {
    kicker: 'FAQ',
    title: 'Everything you’d ask before starting',
    subtitle: 'Didn’t find your answer? Message us directly and we’ll reply.',
    items: [
      {
        q: 'Do I need to install any software?',
        a: 'No. Rentrix runs entirely in the browser — on your computer and your phone — with a full Arabic interface and no manual updates.',
      },
      {
        q: 'Does it support my local currency?',
        a: 'Yes. The currency is set from office settings (OMR, SAR, AED…) and flows into invoices, reports and printing.',
      },
      {
        q: 'I currently run everything on Excel — how do I migrate?',
        a: 'Start entering your first property within minutes and grow your data gradually. When your trial activates, we walk with you step by step through the initial setup.',
      },
      {
        q: 'Is there a mobile app?',
        a: 'The interface is fully responsive and works like an app from your phone’s browser — issue a contract or follow up collections while away from the office.',
      },
      {
        q: 'What about VAT?',
        a: 'Rentrix supports tax settings and your company tax number, with a VAT return report inside the reports hub.',
      },
      {
        q: 'How is my data protected?',
        a: 'With granular role permissions, secure sessions, an audit trail for every financial action, and row-level security in the database itself.',
      },
    ],
  },
  cta: {
    titleA: 'Ready to run your properties',
    titleB: 'like it’s 2026?',
    subtitle:
      'Be among the first offices to try Rentrix. Book a demo today and we’ll set up a workspace that fits your portfolio.',
    primary: 'Try the app now',
    whatsapp: 'Chat on WhatsApp',
    note: 'Fast setup • Full Arabic support • No commitment',
  },
  footer: {
    tagline: 'An Arabic platform for rental property management: properties, contracts, finance, maintenance and reports — in one workspace.',
    productTitle: 'Product',
    productLinks: ['Features', 'Product tour', 'How it works', 'FAQ'],
    companyTitle: 'Company',
    companyLinks: ['Book a demo', 'Contact us'],
    legalTitle: 'Legal',
    legalLinks: ['Privacy policy', 'Terms of use'],
    contactTitle: 'Contact',
    motto: 'Built with passion for Gulf real-estate offices',
    rights: 'All rights reserved.',
  },
};

export const messages: Record<Lang, Messages> = { ar, en };
