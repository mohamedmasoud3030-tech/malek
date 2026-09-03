/**
 * Business advisory knowledge base — Muscat/Oman office & property management.
 *
 * Governance notes:
 * - Every figure is an ADVISORY market benchmark compiled from the public
 *   sources listed below (accessed 2026-09-04). Nothing here is an
 *   authoritative accounting, legal or contractual value, and the assistant
 *   must always label advisory answers as «تقدير إرشادي».
 * - This file is the single, versioned source for advisory knowledge.
 *   Prompt code must inject `BUSINESS_KB_TEXT` verbatim and must not invent
 *   figures beyond it. Update this file (with new sources) instead of
 *   changing prompt wording when the market changes.
 */

export const AI_KB_VERSION = "malek-biz-om-v1";

/** Hard budget so the KB always fits the prompt window. */
export const BUSINESS_KB_MAX_CHARS = 4_000;

export type BusinessKbSource = Readonly<{
  name: string;
  url: string;
  accessed: string;
}>;

export const BUSINESS_KB_SOURCES: readonly BusinessKbSource[] = [
  {
    name: "Sands of Wealth — What are the hidden costs of Muscat property? (2025-09)",
    url: "https://sandsofwealth.com/blogs/news/muscat-hidden-costs-property",
    accessed: "2026-09-04",
  },
  {
    name: "Sands of Wealth — What is the average rent in Muscat? (2025-08)",
    url: "https://sandsofwealth.com/blogs/news/average-rent-muscat",
    accessed: "2026-09-04",
  },
  {
    name: "Oman Property Investment — Buy-to-Let Property Investment in Oman 2026",
    url: "https://www.omanpropertyinvestment.com/en/buy-to-let-oman",
    accessed: "2026-09-04",
  },
  {
    name: "Renttaag — Average Rent in Muscat (2026)",
    url: "https://renttaag.com/rent-average/muscat",
    accessed: "2026-09-04",
  },
  {
    name: "Expat Focus — Oman Property Rental Prices (2026-05)",
    url: "https://www.expatfocus.com/oman/guide/oman-property-rental-prices",
    accessed: "2026-09-04",
  },
  {
    name: "Daleel Oman — Renting in Muscat (2026-07)",
    url: "https://daleeloman.com/muscat/renting-guide/",
    accessed: "2026-09-04",
  },
  {
    name: "Sands of Wealth — Property Taxes, Fees and Costs in Muscat (2026-01)",
    url: "https://sandsofwealth.com/blogs/news/muscat-property-taxes-fees",
    accessed: "2026-09-04",
  },
] as const;

/**
 * Compact Arabic knowledge base, prompt-ready. Injected verbatim into the
 * advisory system prompt. Keep under BUSINESS_KB_MAX_CHARS.
 */
export const BUSINESS_KB_TEXT = `
قاعدة معرفة سوق مسقط/عُمان (تقديرات إرشادية من مراجع عامة، ليست أرقاماً معتمدة):

1) نسبة إدارة العقار:
- المعتاد 8-10% من إجمالي الإيجار الشهري، والنطاق الشائع 5-12%.
- الخدمات الأساسية (شاشة المستأجر، تحصيل الإيجار، تنسيق الصيانة، الجولات): نحو 8%.
- الخدمات المتقدمة (تسويق، تصوير، دعم قانوني، مجتمعات مغلقة/فلل فاخرة): نحو 10-12%.
- بديل الشائع: مبلغ شهري ثابت متفق عليه لكل وحدة في العقد.
- مثال إرشادي: عقار 3 أدوار × 5 وحدات = 15 وحدة بإيجار متوقع 350 ر.ع/الوحدة → إجمالي 5,250 ر.ع شهرياً → نسبة 8% تعطي ~420 ر.ع شهرياً (~5,040 ر.ع سنوياً).

2) إيجارات مسقط الشهرية (2026، ر.ع/شهر):
- استوديو: 120-280 (متوسط ~190).
- غرفة وصالة: 180-450 (متوسط ~280؛ في مواقع متميزة حتى 800).
- غرفتان: 280-700 (متوسط ~420).
- ثلاث غرف: 400-1000 (متوسط ~600).
- فيلا/4 غرف: 600-2000 (متوسط ~950).
- متوسطات أحياء لغرفة وصالة: اللمة ~500، قورم ~380، الخوير ~320، بوشري ~250، روي ~180.
- العوامل: الموقع/الحي، الدور (الأدوار الوسطى الأعلى)، التشطيب، المرافق (مسابح/مواقف)، حالة العقار.

3) قواعد السوق والعقود:
- العقد القياسي 12 شهراً قابلاً للتجديد؛ إشعار المغادرة على الأقل 3 أشهر.
- سقف زيادة الإيجار: ممنوعة في أول 3 سنوات، وبحد أقصى 7% سنوياً بعدها (قرار 6/89 المعدل) — تأكد من الصياغة الحالية قبل الاستدلال.
- السداد السائد: 6-12 شهراً مقدماً بشيكات مؤرخة + تأمين شهر.
- ضريبة/رسوم إيجار بلدية: ~3-5% من الإيجار السنوي حسب نوع العقد وصلاحية التسجيل (بلدية أو وزارة الإسكان) — يُتحقق منها رسمياً عند التسجيل.
- تسجيل العقد إلزامي (بلدية للعقود الأقل من 7 سنوات، وزارة الإسكان لأطول) وإلا لا يُعتد به رسمياً.
- عمولة الوسيط/البروكر السائدة: ~5% من إيجار سنة (غالباً على حساب المستأجر).

4) مؤشرات تشغيلية لمكتب الإدارة:
- صيانة المرافق (service charges): 20-80 ر.ع/الوحدة شهرياً (أو 3-8 ر.ع/م² سنوياً) في المجتمعات المدارة.
- فترة الشغور المتوقعة بين مستأجرين: شهر تقريباً (4-8% من الإيجار السنوي).
- احتياطي الصيانة المقترح: 1% من قيمة العقار سنوياً.
- التأمين (مبنى+محتويات): ~100-500 ر.ع سنوياً.
- العائد الإجمالي الواقعي: 6-8% (نطاق أوسع 3-9% حسب الموقع والنوع).
- صافي الدخل السنوي ≈ إجمالي الإيجار − ضريبة البلدية − نسبة الإدارة − صيانة مرافق محملة − احتياطي صيانة − شغور متوقع.

5) أفضل ممارسات إدارة المكتب (نقاط قصيرة):
- عقد مكتوب ومُسجَّل + كشف حالة/تسليم مصور عند الاستلام والتسليم.
- ترحيل مواعيد الشيكات وتذكير تلقائي قبل الاستحقاق بأسبوع؛ متابعة المتأخر خلال 7 أيام بلغة مهذبة.
- بدء إجراءات التجديد قبل نهاية العقد بـ 3 أشهر لتجنب فجوات الشغور.
- مستوى خدمة صيانة: عاجل خلال 48 ساعة، عادي خلال أسبوع، وإغلاق كل طلب بتوثيق.
- خطة شغور جاهزة (تسعير، تسويق، معاينة) قبل نهاية كل عقد.
- تقرير دوري (شهري/ربع سنوي) للمالك: تحصيل، مصروفات، صيانة، شواغر.
- فصل أموال الملاك عن أموال المكتب وتسوية دورية موثقة.

تنويه إلزامي في كل رد إرشادي: هذه تقديرات إرشادية من مراجع سوق عامة وليست أرقاماً معتمدة أو التزاماً قانونياً/محاسبياً؛ راجع الاتفاق الساري والمراجع الرسمية قبل أي قرار.
`.trim();
