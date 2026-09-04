/**
 * Business advisory knowledge base — data-driven, region-aware, versioned.
 *
 * Governance notes:
 * - Every figure is an ADVISORY market benchmark compiled from the public
 *   sources listed below (accessed 2026-09-04). Nothing here is an
 *   authoritative accounting, legal or contractual value, and the assistant
 *   must always label advisory answers as «تقدير إرشادي».
 * - This file is the single, versioned source for advisory knowledge.
 *   Prompt code must inject the rendered KB verbatim and must not invent
 *   figures beyond it. Update the data below (with new sources) instead of
 *   changing prompt wording when the market changes.
 * - Structure: countries → regions → rent tables + national rules. Only Oman
 *   is populated today; the shape is deliberately country-extensible for the
 *   multi-country roadmap (add a country object + sources, nothing else).
 */

export const AI_KB_VERSION = "malek-biz-v4";

/** Hard budget so the rendered KB always fits the prompt window. */
export const BUSINESS_KB_MAX_CHARS = 4_800;

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
    name: "Sands of Wealth — What is the average rent in Oman? (2025-09)",
    url: "https://sandsofwealth.com/blogs/news/average-rent-oman",
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
  {
    name: "Living Cost — Nizwa (2026-03)",
    url: "https://www.livingcost.org/cost-of-living/nizwa-oman",
    accessed: "2026-09-04",
  },
  {
    name: "السوق المفتوح (OpenSooq) — إعلانات عقارات نزوى واللاداخلية للبيع والإيجار",
    url: "https://om.opensooq.com/ar/%D8%A7%D9%84%D8%AF%D8%A7%D8%AE%D9%84%D9%8A%D8%A9/%D9%86%D8%B2%D9%88%D9%89",
    accessed: "2026-09-04",
  },
  {
    name: "السوق المفتوح (OpenSooq) — أراضٍ للبيع في نزوى (الداخلية)",
    url: "https://om.opensooq.com/ar/%D8%A7%D9%84%D8%AF%D8%A7%D8%AE%D9%84%D9%8A%D8%A9/%D9%86%D8%B2%D9%88%D9%89/%D8%B9%D9%82%D8%A7%D8%B1%D8%A7%D8%AA/%D8%A3%D8%B1%D8%A7%D8%B6%D9%8A-%D9%84%D9%84%D8%A8%D9%8A%D8%B9",
    accessed: "2026-09-04",
  },
  {
    name: "Bayut Oman — leading real-estate portal (rent & sale)",
    url: "https://www.bayut.om/en/",
    accessed: "2026-09-04",
  },
  {
    name: "OmanDeLux — specialized Oman real-estate platform (rent/resale/industrial)",
    url: "https://omandelux.com/",
    accessed: "2026-09-04",
  },
  {
    name: "Homelist — Oman property listings (Muscat & nationwide)",
    url: "https://homelist.om/",
    accessed: "2026-09-04",
  },
  {
    name: "Muscat Properties — new-build & off-plan Oman real estate",
    url: "https://muscat.properties/",
    accessed: "2026-09-04",
  },
  {
    name: "TravelTables — Nizwa rent index (2023)",
    url: "https://traveltables.com/nizwa-oman/",
    accessed: "2026-09-04",
  },
  {
    name: "Sands of Wealth — Average apartment rent in Riyadh (2025-09)",
    url: "https://sandsofwealth.com/blogs/news/average-apartment-rent-riyadh",
    accessed: "2026-09-04",
  },
  {
    name: "Sands of Wealth — Updated Rents in Saudi Arabia (2026)",
    url: "https://sandsofwealth.com/blogs/news/saudi-arabia-rents",
    accessed: "2026-09-04",
  },
  {
    name: "Jarnias Cyril — Cost of living in Saudi Arabia (2026-01)",
    url: "https://www.jarniascyril.com/expatriation/moving-to-saudi-arabia-as-an-expat-complete-guide/cost-of-living-saudi-arabia-expats/",
    accessed: "2026-09-04",
  },
  {
    name: "Sands of Wealth — Buying and renting out in Saudi Arabia (2026)",
    url: "https://sandsofwealth.com/blogs/news/saudi-arabia-buy-rent-out",
    accessed: "2026-09-04",
  },
  {
    name: "Sands of Wealth — Riyadh rental yields (2026)",
    url: "https://sandsofwealth.com/blogs/news/riyadh-rental-yields",
    accessed: "2026-09-04",
  },
  {
    name: "Riyadh Residential — Rental market dashboard (Q1 2026)",
    url: "https://riyadhresidential.com/dashboards/rental-market-dashboard/",
    accessed: "2026-09-04",
  },
  {
    name: "Expat Focus — Saudi Arabia lease agreements (Ejar)",
    url: "https://www.expatfocus.com/saudi-arabia/guide/saudi-arabia-lease-agreements",
    accessed: "2026-09-04",
  },
  {
    name: "Expat Focus — Saudi Arabia property letting (2025)",
    url: "https://www.expatfocus.com/saudi-arabia/guide/saudi-arabia-property-letting",
    accessed: "2026-09-04",
  },
  {
    name: "Habitare — VAT on real estate in Saudi Arabia (2026)",
    url: "https://habitare.sa/en/value-added-tax-vat-on-real-estate-in-saudi-arabia/",
    accessed: "2026-09-04",
  },
] as const;

/** One monthly-rent benchmark row: property type → advisory range (currency of the country). */
export type BusinessKbRentRow = Readonly<{
  typeAr: string;
  range: string;
  note?: string;
}>;

export type BusinessKbRegion = Readonly<{
  id: string;
  nameAr: string;
  /** Relative positioning vs. the reference region, one line, sourced or qualitative. */
  noteAr?: string;
  rents: readonly BusinessKbRentRow[];
}>;

export type BusinessKbCountry = Readonly<{
  id: string;
  nameAr: string;
  currencyAr: string;
  /** Reference region used when the user's region is unknown (labeled as an assumption). */
  defaultRegionId: string;
  regions: readonly BusinessKbRegion[];
  national: Readonly<{
    managementFeesAr: string;
    contractRulesAr: string;
    feesAndTaxesAr: string;
    opsBenchmarksAr: string;
  }>;
  bestPracticesAr: string;
}>;

const OMAN: BusinessKbCountry = {
  id: "om",
  nameAr: "عُمان",
  currencyAr: "ر.ع",
  defaultRegionId: "muscat",
  regions: [
    {
      id: "muscat",
      nameAr: "مسقط",
      noteAr: "أعلى الأسعار في البلاد وأكبر سوق تأجير.",
      rents: [
        { typeAr: "استوديو", range: "120-280" },
        { typeAr: "غرفة وصالة", range: "180-450", note: "في مواقع متميزة (اللمة/قورم/مصياف) حتى 700-800" },
        { typeAr: "غرفتان", range: "280-700" },
        { typeAr: "ثلاث غرف", range: "400-1000" },
        { typeAr: "فيلا/4 غرف", range: "600-2000" },
      ],
    },
    {
      id: "nizwa",
      nameAr: "نزوي (الداخلية)",
      noteAr: "أرخص عادةً بثلث إلى نصف قيمة مسقط للمقارنات المماثلة؛ الأراضي السكنية تُعلن في نزوى بين 5,000-40,000 ر.ع حسب المخطط — استشر معلومة محلية حديثة للتقدير الدقيق.",
      rents: [
        { typeAr: "غرفة وصالة", range: "100-250", note: "المراجع تتباين؛ الوحدات الجديدة/المطلة أعلى" },
        { typeAr: "ثلاث غرف", range: "150-350" },
        { typeAr: "غرفة يومية (منبسط/ملحق)", range: "6-20", note: "إيجار يومي/أسبوعي في الأحياء القريبة من التقنية" },
        { typeAr: "استراحة/شاليه يومي", range: "20-150", note: "مصيف/بركة الموز/الجبل الأخضر — موسمي" },
      ],
    },
    {
      id: "other-north",
      nameAr: "بقية الداخلية والشمال (بهلاء، منح، الحمراء، إزكي، بدبد، سمائل، أدم، صحار، الرستاق، البريمي)",
      noteAr: "مماثلة أو أقل قليلاً من نزوى؛ الطلب الموسمي في الجبل الأخضر/الحمراء يرفع الإيجار القصير.",
      rents: [
        { typeAr: "غرفة وصالة", range: "90-250", note: "بشكل عام أقل من مسقط" },
        { typeAr: "ثلاث غرف", range: "130-320" },
      ],
    },
    {
      id: "salalah",
      nameAr: "صلالة (ظفار)",
      noteAr: "موسمية واضحة (الضباب يرفع الطلب صيفاً).",
      rents: [{ typeAr: "غرفة وصالة", range: "150-300" }],
    },
  ],
  national: {
    managementFeesAr: [
      "النطاق السائد 5-12% من إجمالي الإيجار الشهري (مراجع مسقط: 5-10% الشائع، ومراجع أخرى 8-12% للخدمات الشاملة).",
      "الخدمات الأساسية (تحصيل الإيجار، تنسيق الصيانة، الجولات): نحو 8%. الخدمات المتقدمة (تسويق، دعم قانوني، مجتمعات فاخرة): 10-12%.",
      "بديل شائع: مبلغ شهري ثابت متفق عليه لكل وحدة في عقد الإدارة.",
      "قاعدة الاختيار بين النسبة والمبلغ الثابت: النسبة أفضل عندما تكون الإيجارات مرتفعة/قابلة للنمو والتحصيل جيد (تشارك في الارتفاع)، والمبلغ الثابت أفضل عندما تكون الإيجارات منخفضة، وسيطة، أو وحداتن كثيرة موحّدة — لأنه يضمن دخل إدارة مستقراً ويُقيِّم جهودك المقبولة. عند وحدات متنوعة (شقق/غرف/محلات/مخازن) قسّم الرسوم: نسبة على المحلّات والمخازن + مبلغ ثابت لكل وحدة سكنية.",
      "مثال إرشادي (إجمالي 6,000 ر.ع شهرياً): نسبة 8% تعني ~480 ر.ع شهرياً؛ مبلغ ثابت 30 ر.ع × 25 وحدة = 750 ر.ع شهرياً — ميّز بالمقارنة قبل الاقتراح.",
    ].join("\n"),
    contractRulesAr: [
      "العقد القياسي 12 شهراً قابلاً للتجديد؛ إشعار المغادرة على الأقل 3 أشهر.",
      "سقف زيادة الإيجار: ممنوعة في أول 3 سنوات، وبحد أقصى 7% سنوياً بعدها — تحقق من الصياغة الحالية قبل الاستدلال.",
      "تسجيل العقد إلزامي (بلدية للأقصر من 7 سنوات، وزارة الإسكان لأطول) وإلا لا يُعتد به رسمياً.",
      "السداد السائد: 6-12 شهراً مقدماً بشيكات مؤرخة + تأمين شهر.",
      "عمولة الوسيط السائدة: ~5% من إيجار سنة (غالباً على حساب المستأجر).",
    ].join("\n"),
    feesAndTaxesAr: [
      "ضريبة إيجار بلدية: ~3% من الإيجار السنوي للأفراد (بعض المراجع تذكر 5% حسب نوع العقد/التسجيل) — يُتحقق منها رسمياً عند التسجيل.",
      "تسجيل التأجير قصير الأجل (نشاط تأجيري): 5% من إجمالي إيجار المدة.",
      "تحويل الملكية (للمقارنة): ~3% من القيمة.",
    ].join("\n"),
    opsBenchmarksAr: [
      "صيانة المرافق (service charges): 20-80 ر.ع/الوحدة شهرياً (أو 3-8 ر.ع/م² سنوياً) في المجتمعات المدارة.",
      "فترة الشغور المتوقعة بين مستأجرين: شهر تقريباً (4-8% من الإيجار السنوي).",
      "احتياطي الصيانة المقترح: 1% من قيمة العقار سنوياً. التأمين (مبنى+محتويات): ~200-500 ر.ع سنوياً.",
      "العائد الإجمالي الواقعي: 6-8% (نطاق أوسع 3-9% حسب الموقع والنوع؛ مسقط حتى ~8.5% لأفضل الوحدات).",
      "صافي الدخل السنوي ≈ إجمالي الإيجار − ضريبة − نسبة الإدارة − مرافق محملة − احتياطي صيانة − شغور متوقع.",
      "حساب تقريبي لعقار مكوّن (برج إيجارات): اجمع دخل كل الوحدات شهرياً ثم اطرح 3% ضريبة بلدية، ونسبة إدارة، ومرافق (20-80 ر.ع/وحدة)، واحتياطي صيانة 1% سنوياً، وشغور ~5%. الناتج صافٍ تقريبي.",
      "نسبة (8-10%) أفضل لسكني متفرق أو أسعار مرتفعة؛ مبلغ ثابت أفضل لوحدات متجانسة (مخازن)؛ المختلط يفضّل مزيجاً: نسبة أعلى على المحلات + مبلغ أقل على السكني.",
      "اعرض على المالك سيناريوهين (نسبة مقابل مبلغ ثابت) بالرقم، دون فرض رقم.",
    ].join("\n"),
  },
  bestPracticesAr: [
    "عقد مكتوب ومُسجَّل + كشف حالة/تسليم مصور عند الاستلام والتسليم.",
    "ترحيل مواعيد الشيكات وتذكير قبل الاستحقاق بأسبوع؛ متابعة المتأخر خلال 7 أيام بلغة مهذبة.",
    "بدء إجراءات التجديد قبل نهاية العقد بـ 3 أشهر لتجنب فجوات الشغور.",
    "مستوى خدمة صيانة: عاجل خلال 48 ساعة، عادي خلال أسبوع، وإغلاق كل طلب بتوثيق.",
    "خطة شغور جاهزة (تسعير، تسويق، معاينة) قبل نهاية كل عقد.",
    "تقرير دوري (شهري/ربع سنوي) للمالك: تحصيل، مصروفات، صيانة، شواغر.",
    "فصل أموال الملاك عن أموال المكتب وتسوية دورية موثقة.",
  ].join("\n"),
};

const SAUDI_ARABIA: BusinessKbCountry = {
  id: "sa",
  nameAr: "السعودية",
  currencyAr: "ر.س",
  defaultRegionId: "riyadh",
  regions: [
    {
      id: "riyadh",
      nameAr: "الرياض",
      noteAr: "أعلى سوق في المملكة؛ تجميد إيجارات 5 سنوات من 25 سبتمبر 2025 يحد الزيادات داخل النطاق العمراني.",
      rents: [
        { typeAr: "استوديو", range: "1,600-6,000" },
        { typeAr: "غرفة وصالة", range: "2,500-4,100", note: "وسط الرياض 3,100-4,100" },
        { typeAr: "غرفتان", range: "3,000-7,000" },
        { typeAr: "ثلاث غرف", range: "4,000-7,000+" },
        { typeAr: "فيلا", range: "10,000-30,000" },
      ],
    },
    {
      id: "jeddah",
      nameAr: "جدة",
      rents: [{ typeAr: "شقق (نطاق عام)", range: "1,200-6,250" }],
    },
    {
      id: "eastern",
      nameAr: "الدمام والمنطقة الشرقية",
      noteAr: "من أدنى المناطق سعراً للمتر المربع وطنياً.",
      rents: [{ typeAr: "شقق (نطاق عام)", range: "1,375-3,750" }],
    },
    {
      id: "other",
      nameAr: "مدن أخرى (أبها، حائل، نجران…)",
      noteAr: "الأقل تكلفة على المستوى الوطني.",
      rents: [{ typeAr: "شقق (نطاق عام)", range: "1,375-2,250" }],
    },
  ],
  national: {
    managementFeesAr: [
      "الإدارة الكاملة السائدة 5-10% من الإيجار المحصل سنوياً (مرجع شائع 5-8%، و8-10% نموذجي للإدارة عن بُعد).",
      "رسوم التأجير (إيجاد مستأجر جديد): نصف إلى شهر إيجار لمرة واحدة لكل مستأجر.",
      "عمولة الوسيط السائدة نحو 2.5% من إيجار السنة (تدفع مرة واحدة).",
    ].join("\n"),
    contractRulesAr: [
      "تسجيل العقد على منصة إيجار إلزامي (الهيئة العامة للعقار) — العقد غير المسجل غير قابل للتنفيذ قانونياً.",
      "المدة القياسية سنة واحدة؛ العقود فوق 3 أشهر تتجدد تلقائياً ما لم يُقدم إشعار 60 يوماً قبل الانتهاء.",
      "سقف التأمين 5% من إجمالي قيمة العقد ويُحفظ عبر منصة إيجار.",
      "الدفع الرقمي إلزامي للسكني (مدى/سداد) منذ يناير 2024، والسائد دفع إيجار السنة مقدماً.",
      "رسوم تسجيل إيجار سكني: 125 ر.س أول سنة و250 ر.س للتجديد السنوي.",
      "زيادة الإيجار خارج الرياض عبر طلب رسمي في إيجار قبل 90 يوماً من الانتهاء.",
    ].join("\n"),
    feesAndTaxesAr: [
      "الإيجار السكني معفى من ضريبة القيمة المضافة؛ الإيجار التجاري يخضع لـ 15%.",
      "ضريبة التصرفات العقارية 5% على بيع العقارات السكنية (للمقارنة — لا تُفرض على التأجير).",
      "دخل الإيجار السكني للأفراد عموماً بدون ضريبة دخل شخصية — تحقق دائماً من زاتكا.",
    ].join("\n"),
    opsBenchmarksAr: [
      "احتياطي الصيانة: 0.75-1.5% من قيمة العقار سنوياً.",
      "التكلفة الشاملة لحمل العقار المؤجر: نحو 25-35% من دخل الإيجار.",
      "صافي العائد السكني في الرياض نحو 4.3% (الإجمالي أعلى قبل التكاليف).",
      "إيجار المتر المربع للشقق وطنياً: 32-75 ر.س/م² شهرياً (الرياض في الطرف الأعلى والشرقية في الأدنى).",
    ].join("\n"),
  },
  bestPracticesAr: [
    "سجّل العقد على إيجار فور التوقيع واحفظ التأمين ضمن المنصة وضمن السقف.",
    "وثّق كل دفعة عبر القنوات الرقمية المعتمدة (مدى/سداد) واربطها بالعقد.",
    "ابدأ إجراءات التجديد أو الإشعار قبل نهاية العقد بـ 90 يوماً على الأقل.",
    "في الرياض: التزم بتجميد الإيجارات الحالي وقيّد أي زيادة بالمستندات الرسمية.",
    "اختر مدير عقار مرخصاً (ترخيص فال) للتعامل مع التسجيل والمنازعات.",
    "تقرير دوري للمالك: تحصيل، مصروفات، صيانة، شواغر، وحالة عقود إيجار.",
  ].join("\n"),
};

export const BUSINESS_KB_COUNTRIES: readonly BusinessKbCountry[] = [OMAN, SAUDI_ARABIA] as const;

export function findBusinessKbCountry(countryId?: string): BusinessKbCountry {
  return BUSINESS_KB_COUNTRIES.find((country) => country.id === countryId) ?? BUSINESS_KB_COUNTRIES[0];
}

/**
 * Deterministic country keywords for advisory routing. Each entry names the
 * market unambiguously; the generic Arabic word for "rent" is deliberately
 * absent so an Oman question like «نسبة الإيجار» can never land on KSA.
 */
const COUNTRY_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  om: [
    "عمان",
    "عُمان",
    "مسقط",
    "نزوى",
    "نزوي",
    "صلالة",
    "صحار",
    "الرستاق",
    "البريمي",
    "oman",
    "muscat",
    "nizwa",
    "salalah",
    "sohar",
  ],
  sa: [
    "السعودية",
    "السعوديه",
    "سعودي",
    "الرياض",
    "جدة",
    "الدمام",
    "الخبر",
    "المنطقة الشرقية",
    "مكة المكرمة",
    "المدينة المنورة",
    "نجران",
    "أبها",
    "منصة إيجار",
    "saudi",
    "riyadh",
    "jeddah",
    "dammam",
    "khobar",
    "ksa",
  ],
};

function normalizeAdvisoryText(value: string): string {
  return value.toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, "");
}

/**
 * Picks the advisory market from the prompt first, then the most recent
 * history turns. Deterministic and keyword-only; the model never decides
 * which country's figures to use. Undefined = the default country (Oman).
 */
export function detectAdvisoryCountryId(
  prompt: string,
  history: ReadonlyArray<{ content: string }>,
): string | undefined {
  const candidates = [prompt, ...[...history].reverse().map((entry) => entry.content)];
  for (const entry of candidates) {
    const text = normalizeAdvisoryText(entry);
    for (const [countryId, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
      if (keywords.some((keyword) => text.includes(normalizeAdvisoryText(keyword)))) {
        return countryId;
      }
    }
  }
  return undefined;
}

function renderRegionBlock(country: BusinessKbCountry, region: BusinessKbRegion): string {
  const lines = [`- ${region.nameAr}:`];
  for (const row of region.rents) {
    lines.push(`  ${row.typeAr}: ${row.range} ${country.currencyAr}${row.note ? ` (${row.note})` : ""}.`);
  }
  if (region.noteAr) lines.push(`  ملاحظة: ${region.noteAr}`);
  return lines.join("\n");
}

/**
 * Renders the prompt-ready KB for a country: all labeled regions first (the
 * model picks the user's region from the conversation), then national rules.
 * Deterministic; always within BUSINESS_KB_MAX_CHARS (guarded by test).
 */
export function renderBusinessKbText(countryId?: string): string {
  const country = findBusinessKbCountry(countryId);
  const regionLines = country.regions.map((region) => renderRegionBlock(country, region)).join("\n");
  const text = `
قاعدة معرفة سوق ${country.nameAr} (تقديرات إرشادية من مراجع سوق عامة، ليست أرقاماً معتمدة أو التزاماً قانونياً/محاسبياً):

1) إيجارات شهرية حسب المنطقة (${country.currencyAr}/شهر):
${regionLines}

2) نسبة إدارة العقار:
${country.national.managementFeesAr}

3) قواعد السوق والعقود (قواعد وطنية):
${country.national.contractRulesAr}

4) ضرائب ورسوم:
${country.national.feesAndTaxesAr}

5) مؤشرات تشغيلية لمكتب الإدارة:
${country.national.opsBenchmarksAr}

6) أفضل ممارسات إدارة المكتب (نقاط قصيرة):
${country.bestPracticesAr}

تنويه إلزامي في كل رد إرشادي: هذه تقديرات إرشادية من مراجع سوق عامة وليست أرقاماً معتمدة؛ راجع الاتفاق الساري والمراجع الرسمية قبل أي قرار.
`.trim();
  if (text.length > BUSINESS_KB_MAX_CHARS) {
    throw new Error(`KB rendering exceeds budget: ${text.length} > ${BUSINESS_KB_MAX_CHARS}`);
  }
  return text;
}

/** Backward-compatible export: the full rendered KB (all regions, default country). */
export const BUSINESS_KB_TEXT = renderBusinessKbText();
