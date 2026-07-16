import type { Lang } from './messages';

export type LegalSlug = 'privacy' | 'terms';

export type LegalContent = {
  title: string;
  effective: string;
  intro: string;
  sections: { heading: string; body: string[] }[];
};

const privacyAr: LegalContent = {
  title: 'سياسة الخصوصية',
  effective: 'تاريخ السريان: 16 يوليو 2026',
  intro:
    'نحن في Rentrix نأخذ خصوصيتك على محمل الجد. توضح هذه السياسة ما هي البيانات التي نجمعها عند استخدامك لموقعنا أو تطبيقنا، ولماذا نجمعها، وكيف نحميها، وما هي حقوقك تجاهها.',
  sections: [
    {
      heading: '1. البيانات التي نجمعها',
      body: [
        'بيانات الحساب: اسمك وبريدك الإلكتروني ورقم هاتفك عند التسجيل أو طلب عرض تجريبي.',
        'بيانات التشغيل التي تدخلها أنت: بيانات العقارات والوحدات والملاك والمستأجرين والعقود والفواتير والمدفوعات التي تسجلها في النظام لغرض إدارة أعمالك.',
        'بيانات الاستخدام الأساسية: نوع المتصفح والجهاز وأوقات الوصول، لأغراض تحسين الأداء والأمان فقط.',
        'بيانات التواصل: مراسلاتك معنا عبر البريد الإلكتروني أو واتساب.',
      ],
    },
    {
      heading: '2. كيفية استخدام البيانات',
      body: [
        'تشغيل الخدمة وتقديمها لك ولموظفي مكتبك حسب صلاحيات الأدوار التي تحددها.',
        'التواصل معك بشأن حسابك أو طلبك للعرض التجريبي أو الدعم الفني.',
        'تحسين المنتج وإصلاح الأعطال وتطوير مزايا جديدة.',
        'لا نبيع بياناتك ولا نشاركها لأغراض إعلانية مع أي طرف ثالث — إطلاقاً.',
      ],
    },
    {
      heading: '3. ملكية بيانات العقارات والعمليات',
      body: [
        'جميع البيانات التشغيلية التي تدخلها (عقارات، عقود، فواتير، مدفوعات) تظل ملكك وحدك. نحن نعالجها نيابة عنك فقط لتقديم الخدمة.',
        'يمكنك طلب تصدير بياناتك أو حذفها في أي وقت عبر التواصل معنا.',
      ],
    },
    {
      heading: '4. التخزين والأمان',
      body: [
        'تُخزن البيانات على بنية تحتية سحابية موثوقة (Supabase) مع سياسات حماية على مستوى الصفوف (RLS) داخل قاعدة البيانات نفسها.',
        'نطبق ضوابط وصول مبنية على الأدوار (ADMIN / MANAGER / USER)، وتشفيراً أثناء النقل (HTTPS)، وسجل تدقيق للعمليات المالية والحساسة.',
        'رغم التزامنا بأفضل الممارسات، لا توجد وسيلة نقل أو تخزين إلكتروني آمنة بنسبة 100%، لذا لا يمكننا ضمان أمان مطلق.',
      ],
    },
    {
      heading: '5. مشاركة البيانات',
      body: [
        'لا نشارك بياناتك إلا مع مزودي الخدمة الضروريين لتشغيل المنصة (مثل الاستضافة السحابية) وبموجب التزامات سرية، أو إذا كان القانون يُلزمنا بذلك.',
      ],
    },
    {
      heading: '6. ملفات تعريف الارتباط (Cookies)',
      body: [
        'نستخدم الحد الأدنى من التخزين المحلي في المتصفح لحفظ تفضيلاتك (مثل اللغة) وجلسة الدخول. لا نستخدم كوكيز تتبع إعلانية.',
      ],
    },
    {
      heading: '7. حقوقك',
      body: [
        'يحق لك الوصول إلى بياناتك الشخصية وتصحيحها وطلب حذفها أو تقييد معالجتها، وسحب موافقتك في أي وقت.',
        'لممارسة أي من هذه الحقوق راسلنا على البريد الموضح أدناه وسنستجيب في أقرب وقت ممكن.',
      ],
    },
    {
      heading: '8. التعديلات على هذه السياسة',
      body: [
        'قد نحدّث هذه السياسة من وقت لآخر، وسنُظهر تاريخ أحدث نسخة أعلى هذه الصفحة. استمرارك في استخدام الخدمة بعد أي تعديل يعني قبولك للنسخة المحدثة.',
      ],
    },
    {
      heading: '9. التواصل',
      body: [
        'لأي استفسار يتعلق بالخصوصية: Mohamedms.oud@outlook.com أو عبر واتساب على الرقم ‎+968 9192 8186‎.',
      ],
    },
  ],
};

const termsAr: LegalContent = {
  title: 'شروط الاستخدام',
  effective: 'تاريخ السريان: 16 يوليو 2026',
  intro:
    'مرحباً بك في Rentrix. باستخدامك لموقعنا أو تطبيقنا فأنت توافق على هذه الشروط. إذا كنت لا توافق على أي بند منها، يرجى التوقف عن استخدام الخدمة.',
  sections: [
    {
      heading: '1. وصف الخدمة',
      body: [
        'Rentrix منصة ويب لإدارة العقارات الإيجارية: تسجيل العقارات والوحدات والعقود والفواتير والمدفوعات والصيانة والتقارير، موجهة لمكاتب العقارات.',
        'الخدمة حالياً في مرحلة الإطلاق التجريبي؛ قد تتغير بعض المزايا أو تتحسن مع الوقت.',
      ],
    },
    {
      heading: '2. الحسابات والمسؤوليات',
      body: [
        'أنت مسؤول عن دقة البيانات التي تدخلها، وعن سرية بيانات دخولك، وعن جميع الأنشطة التي تتم عبر حسابك.',
        'يلتزم مدير الحساب بمنح صلاحيات الأدوار بشكل صحيح لموظفي مكتبه وإلغائها عند انتهاء الحاجة.',
      ],
    },
    {
      heading: '3. الاستخدام المقبول',
      body: [
        'يُحظر استخدام الخدمة لأي نشاط غير قانوني أو احتيالي، أو لمحاولة الوصول غير المصرح به إلى النظام أو بيانات مستخدمين آخرين، أو إدخال بيانات لا تملك حق استخدامها.',
        'نحتفظ بحق تعليق أو إنهاء أي حساب يخالف هذه الشروط.',
      ],
    },
    {
      heading: '4. البيانات والملكية',
      body: [
        'بياناتك التشغيلية تظل ملكك. أنت تمنحنا فقط الترخيص اللازم لمعالجتها وتخزينها بهدف تقديم الخدمة.',
        'البرمجيات والتصاميم والعلامة التجارية Rentrix ملك لنا، ولا يجوز نسخها أو إعادة استخدامها دون إذن كتابي.',
      ],
    },
    {
      heading: '5. الرسوم والاشتراك',
      body: [
        'خلال فترة الإطلاق التجريبي قد تُقدم الخدمة مجاناً أو بشروط خاصة تُعلن لاحقاً. عند تطبيق أي رسوم مدفوعة سيتم إشعارك مسبقاً وبشكل واضح قبل أي تحصيل.',
      ],
    },
    {
      heading: '6. حدود المسؤولية',
      body: [
        'تُقدم الخدمة «كما هي». نسعى لأعلى معايير الدقة والاستقرار، لكن المسؤولية النهائية عن قراراتك المالية والقانونية المتخذة بناءً على بياناتك تقع عليك أنت.',
        'في أقصى حد يسمح به القانون، لا نتحمل مسؤولية أي أضرار غير مباشرة أو فقدان أرباح ناتج عن استخدام الخدمة أو تعذر استخدامها.',
      ],
    },
    {
      heading: '7. إنهاء الخدمة',
      body: [
        'يمكنك التوقف عن استخدام الخدمة وطلب حذف حسابك وبياناتك في أي وقت. ويمكننا تعليق الحسابات المخالفة لهذه الشروط بعد إشعار أصحابها متى كان ذلك ممكناً.',
      ],
    },
    {
      heading: '8. القانون المطبق',
      body: [
        'تخضع هذه الشروط لقوانين سلطنة عمان وأنظمتها، وتُحل أي نزاعات ناشئة عنها وفقاً لها.',
      ],
    },
    {
      heading: '9. التواصل',
      body: [
        'لأي استفسار حول هذه الشروط: Mohamedms.oud@outlook.com أو عبر واتساب على الرقم ‎+968 9192 8186‎.',
      ],
    },
  ],
};

const privacyEn: LegalContent = {
  title: 'Privacy Policy',
  effective: 'Effective date: July 16, 2026',
  intro:
    'At Rentrix we take your privacy seriously. This policy explains what data we collect when you use our website or application, why we collect it, how we protect it, and what your rights are.',
  sections: [
    {
      heading: '1. Data we collect',
      body: [
        'Account data: your name, email address and phone number when you register or request a demo.',
        'Operational data you enter: properties, units, owners, tenants, contracts, invoices and payments that you record to run your business.',
        'Basic usage data: browser and device type and access times — used only for performance and security.',
        'Communication data: messages you exchange with us via email or WhatsApp.',
      ],
    },
    {
      heading: '2. How we use data',
      body: [
        'To operate and deliver the service to you and your office staff according to the role permissions you define.',
        'To communicate with you about your account, demo requests or support.',
        'To improve the product, fix defects and build new features.',
        'We never sell your data or share it for advertising purposes with any third party. Ever.',
      ],
    },
    {
      heading: '3. Ownership of your business data',
      body: [
        'All operational data you enter (properties, contracts, invoices, payments) remains solely yours. We only process it on your behalf to provide the service.',
        'You may request an export or deletion of your data at any time by contacting us.',
      ],
    },
    {
      heading: '4. Storage & security',
      body: [
        'Data is stored on trusted cloud infrastructure (Supabase) with row-level security (RLS) enforced inside the database itself.',
        'We apply role-based access controls (ADMIN / MANAGER / USER), encryption in transit (HTTPS), and an audit trail for sensitive financial operations.',
        'While we follow industry best practices, no method of transmission or storage is 100% secure, so absolute security cannot be guaranteed.',
      ],
    },
    {
      heading: '5. Data sharing',
      body: [
        'We only share data with the service providers strictly necessary to run the platform (such as cloud hosting) under confidentiality obligations, or when required by law.',
      ],
    },
    {
      heading: '6. Cookies',
      body: [
        'We use minimal browser storage to keep your preferences (like language) and your sign-in session. We do not use advertising tracking cookies.',
      ],
    },
    {
      heading: '7. Your rights',
      body: [
        'You may access, correct, delete or restrict the processing of your personal data, and withdraw your consent at any time.',
        'To exercise any of these rights, email us at the address below and we will respond as soon as possible.',
      ],
    },
    {
      heading: '8. Changes to this policy',
      body: [
        'We may update this policy from time to time; the latest revision date is shown at the top of this page. Continuing to use the service after an update means you accept the revised policy.',
      ],
    },
    {
      heading: '9. Contact',
      body: [
        'For any privacy questions: Mohamedms.oud@outlook.com or via WhatsApp at +968 9192 8186.',
      ],
    },
  ],
};

const termsEn: LegalContent = {
  title: 'Terms of Use',
  effective: 'Effective date: July 16, 2026',
  intro:
    'Welcome to Rentrix. By using our website or application you agree to these terms. If you do not agree with any part of them, please stop using the service.',
  sections: [
    {
      heading: '1. The service',
      body: [
        'Rentrix is a web platform for rental property management: recording properties, units, contracts, invoices, payments, maintenance and reports, designed for real-estate offices.',
        'The service is currently in early access; some features may evolve or improve over time.',
      ],
    },
    {
      heading: '2. Accounts & responsibilities',
      body: [
        'You are responsible for the accuracy of the data you enter, for the confidentiality of your credentials, and for all activity under your account.',
        'Account owners must assign role permissions correctly to their office staff and revoke them when no longer needed.',
      ],
    },
    {
      heading: '3. Acceptable use',
      body: [
        'You may not use the service for any unlawful or fraudulent activity, attempt unauthorized access to the system or other users’ data, or enter data you have no right to use.',
        'We reserve the right to suspend or terminate any account that violates these terms.',
      ],
    },
    {
      heading: '4. Data & ownership',
      body: [
        'Your operational data remains yours. You grant us only the licence necessary to process and store it in order to provide the service.',
        'The Rentrix software, designs and brand are our property and may not be copied or reused without written permission.',
      ],
    },
    {
      heading: '5. Fees & subscription',
      body: [
        'During early access the service may be offered free of charge or under special terms announced later. If paid fees are introduced, you will be clearly notified in advance before any charge.',
      ],
    },
    {
      heading: '6. Limitation of liability',
      body: [
        'The service is provided “as is”. We pursue the highest standards of accuracy and stability, but final responsibility for financial or legal decisions made based on your data rests with you.',
        'To the maximum extent permitted by law, we are not liable for any indirect damages or loss of profit arising from using — or being unable to use — the service.',
      ],
    },
    {
      heading: '7. Termination',
      body: [
        'You may stop using the service and request deletion of your account and data at any time. We may suspend accounts that violate these terms, notifying their owners whenever possible.',
      ],
    },
    {
      heading: '8. Governing law',
      body: [
        'These terms are governed by the laws and regulations of the Sultanate of Oman, and any disputes arising from them shall be resolved accordingly.',
      ],
    },
    {
      heading: '9. Contact',
      body: [
        'For any questions about these terms: Mohamedms.oud@outlook.com or via WhatsApp at +968 9192 8186.',
      ],
    },
  ],
};

export const legalContent: Record<LegalSlug, Record<Lang, LegalContent>> = {
  privacy: { ar: privacyAr, en: privacyEn },
  terms: { ar: termsAr, en: termsEn },
};
