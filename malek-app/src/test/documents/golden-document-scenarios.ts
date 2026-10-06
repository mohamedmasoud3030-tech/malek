/**
 * MALEK golden document scenarios — the validation set for the document
 * system (task §19). Every scenario builds through the REAL engine
 * (`documentEngine.buildDocument`) from typed payloads shaped like the
 * data the application actually feeds it, so print/PDF verification runs
 * against genuine output, not hand-tuned fixtures.
 *
 * Coverage:
 *  - short one-page documents (receipt, invoice, contract),
 *  - medium multi-page statement,
 *  - long statements with tables spanning many pages,
 *  - financial documents (income statement, trial balance),
 *  - Arabic, English, and mixed Arabic/English content,
 *  - long text (legal dossier timeline),
 *  - totals + signature blocks,
 *  - professional report bodies with charts and keep-together groups,
 *  - pagination stress (200-account trial balance).
 */
import { documentEngine } from '@/services/documents/DocumentEngine';
import type { DocumentCompanySettings } from '@/services/documents/companyIdentity';
import type { CanonicalDocumentPayloadMap, DocumentTypeId } from '@/services/documents/documentPayloads';
import type { UnifiedDocumentModel } from '@/services/documents/types';

/** A complete, real-looking company identity (never the brand fallback). */
const goldenCompanySettings: DocumentCompanySettings = {
  companyName: 'شركة الأفق لإدارة الأملاك',
  legalName: 'شركة الأفق لإدارة الأملاك ش.م.م',
  registrationNumber: 'CR-1234567',
  taxNumber: 'OM1100222333',
  address: 'مسقط، الغبرة الشمالية، مبنى 42، طريق 35',
  phone: '+968 2412 3456',
  email: 'info@afaq-properties.om',
  logoUrl:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48"><rect width="160" height="48" rx="8" fill="#0F172A"/><text x="14" y="31" font-family="sans-serif" font-size="19" font-weight="bold" fill="#FFFFFF">MALEK · الأفق</text></svg>',
    ),
  currency: 'OMR',
  currencySymbol: 'ر.ع',
  documentPrefixes: { invoice: 'INV', contract: 'CON', receipt: 'REC' },
};

type GoldenExpectation = Readonly<{
  /** Exactly one page in BOTH browser print and the generated PDF. */
  onePage?: boolean;
  /** Must paginate across several pages (long tables/reports). */
  multiPage?: boolean;
  /** Contains a table expected to continue across page boundaries. */
  longTable?: boolean;
}>;

type GoldenScenario = Readonly<{
  id: string;
  name: string;
  model: UnifiedDocumentModel;
  expect: GoldenExpectation;
}>;

const build = <T extends DocumentTypeId>(type: T, payload: CanonicalDocumentPayloadMap[T]): UnifiedDocumentModel =>
  documentEngine.buildDocument(type, { settings: goldenCompanySettings, payload });

/* ------------------------------------------------------------------ */
/* Scenario payloads                                                   */
/* ------------------------------------------------------------------ */

const receipt = build('receipt', {
  reference: 'REC-2026-0042',
  paymentDate: '2026-07-20',
  amount: 250.5,
  paymentMethod: 'cash',
  payerName: 'سالم بن سعيد الحبسي',
  propertyTitle: 'برج الياسمين',
  unitNumber: 'B-12',
  invoiceReference: 'INV-2026-0311',
  collectorName: 'محمد الفارسي',
  paymentReference: 'DAM-889012',
  notes: 'سداد إيجار شهر يوليو 2026',
});

const invoice = build('invoice', {
  reference: 'INV-2026-0311',
  issueDate: '2026-07-01',
  dueDate: '2026-07-31',
  status: 'PARTIALLY_PAID',
  description: 'إيجار شهر يوليو 2026 — الوحدة B-12',
  amount: 320,
  paidAmount: 250.5,
  vatAmount: 16,
  totalAmount: 336,
  tenantName: 'سالم بن سعيد الحبسي',
  propertyTitle: 'برج الياسمين',
  unitNumber: 'B-12',
});

const contract = build('contract', {
  reference: 'CON-2026-0118',
  status: 'active',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  rentAmount: 3840,
  paymentCycle: 'شهرية',
  notes: 'يشمل العقد استخدام مواقف السيارات المخصصة للوحدة، ولا يجوز التأجير من الباطن دون موافقة خطية مسبقة من المالك.',
  tenantName: 'أحمد بن سالم الرواحي',
  tenantNationalId: 'ID-98765432',
  tenantPhone: '+968 9123 4567',
  propertyTitle: 'برج الياسمين',
  unitNumber: 'A-07',
});

const tenantStatementLines = Array.from({ length: 48 }, (_, index) => {
  const debit = index % 2 === 0 ? 320 : 0;
  const credit = index % 2 === 1 ? 320 : 0;
  return {
    date: `2026-${String((index % 12) + 1).padStart(2, '0')}-15`,
    type: debit > 0 ? 'استحقاق إيجار' : 'سداد دفعة',
    description: `${debit > 0 ? 'قسط إيجار شهري للوحدة B-12 — فاتورة' : 'سداد نقدي لدفعة الإيجار — إيصال'} ${1000 + index}`,
    debit,
    credit,
    balance: index % 2 === 0 ? 320 : 0,
  };
});

const tenantStatement = build('tenant_statement', {
  tenantName: 'سالم بن سعيد الحبسي',
  periodFrom: '2026-01-01',
  periodTo: '2026-08-31',
  propertyTitle: 'برج الياسمين',
  unitNumber: 'B-12',
  openingBalance: 0,
  totalInvoiced: 7680,
  totalPaid: 7360,
  closingBalance: 320,
  lines: tenantStatementLines,
});

const ownerStatement = build('owner_statement', {
  ownerName: 'معالي خالد بن عبدالله المنذري',
  periodFrom: '2026-01-01',
  periodTo: '2026-08-31',
  propertyTitle: 'مجمع النخيل السكني',
  totalRent: 28800,
  totalExpenses: 3120.75,
  totalCommission: 2880,
  netAmount: 22799.25,
  statusLabel: 'تسوية معتمدة',
  transactions: Array.from({ length: 150 }, (_, index) => ({
    date: `2026-${String((index % 8) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    type: index % 3 === 0 ? 'مصروف صيانة' : 'تحصيل إيجار',
    description:
      index % 3 === 0
        ? `مصروف صيانة وقائية للوحدة ${101 + (index % 24)} — أمر العمل WO-${2000 + index}`
        : `تحصيل إيجار الوحدة ${101 + (index % 24)} عن شهر ${['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس'][index % 8]} — إيصال REC-${3000 + index}`,
    amount: index % 3 === 0 ? -(85 + (index % 5) * 12.5) : 360 + (index % 4) * 15,
  })),
});

const incomeStatement = build('income_statement', {
  periodFrom: '2026-01-01',
  periodTo: '2026-08-31',
  revenues: [
    { label: 'إيرادات الإيجارات السكنية', amount: 84200 },
    { label: 'إيرادات الإيجارات التجارية', amount: 31500 },
    { label: 'إيرادات مواقف السيارات', amount: 4800 },
    { label: 'إيرادات خدمات الإدارة', amount: 9600 },
  ],
  expenses: [
    { label: 'رواتب وأجور فريق التشغيل', amount: 26400 },
    { label: 'صيانة وقائية وإصلاحات', amount: 8750.25 },
    { label: 'مرافق وخدمات مشتركة', amount: 6120 },
    { label: 'تسويق وتأجير', amount: 3400 },
    { label: 'مصروفات إدارية وعمومية', amount: 5980.5 },
  ],
  totalRevenue: 130100,
  totalExpense: 50650.75,
  netIncome: 79449.25,
});

const trialBalance = build('trial_balance', {
  asOf: '2026-08-31',
  lines: Array.from({ length: 200 }, (_, index) => {
    const debit = index % 2 === 0 ? 1000 + index * 13.75 : 0;
    const credit = index % 2 === 1 ? 1000 + index * 13.75 : 0;
    return {
      no: `${1000 + index}`,
      name:
        index % 4 === 0
          ? `حساب الإيرادات — إيجارات العقار رقم ${1 + (index % 12)}`
          : index % 4 === 1
            ? `حساب الذمم المدينة — مستأجر ${100 + index}`
            : index % 4 === 2
              ? `حساب المصروفات التشغيلية — بند ${50 + index}`
              : `حساب التسويات والقيود العكسية — قيد ${70 + index}`,
      debit,
      credit,
    };
  }),
  totalDebit: Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 1000 + i * 13.75 : 0)).reduce((a, b) => a + b, 0),
  totalCredit: Array.from({ length: 200 }, (_, i) => (i % 2 === 1 ? 1000 + i * 13.75 : 0)).reduce((a, b) => a + b, 0),
});

const englishReport = build('generic_report', {
  reportTitle: 'Occupancy Analysis Report',
  reportType: 'occupancy_analysis',
  periodFrom: '2026-07-01',
  periodTo: '2026-07-31',
  totalSummary: 'Portfolio occupancy reached 92% across 5 managed properties, with 7 units leased during July.',
  sections: [
    {
      title: 'Occupancy by Property',
      columns: ['Property', 'Total Units', 'Occupied', 'Vacant', 'Occupancy'],
      rows: [
        ['Yasmin Tower', '48', '46', '2', '95.8%'],
        ['Nakheel Complex', '36', '33', '3', '91.7%'],
        ['Al Waha Residences', '28', '26', '2', '92.9%'],
        ['Marina Heights', '22', '20', '2', '90.9%'],
        ['Garden Villas', '14', '12', '2', '85.7%'],
      ],
      totals: ['Portfolio Total', '148', '137', '11', '92.6%'],
    },
    {
      title: 'July Leasing Activity',
      columns: ['Date', 'Unit', 'Tenant File', 'Annual Value'],
      rows: [
        ['2026-07-03', 'B-12', 'TEN-4021', '3,840.000 OMR'],
        ['2026-07-08', 'C-04', 'TEN-4095', '4,200.000 OMR'],
        ['2026-07-14', 'A-19', 'TEN-4110', '3,600.000 OMR'],
      ],
    },
  ],
});

const mixedReport = build('generic_report', {
  reportTitle: 'تقرير الذمم المدينة والمتأخرات — Aged Receivables',
  reportType: 'aged_receivables',
  periodFrom: '2026-01-01',
  periodTo: '2026-08-31',
  totalSummary: 'إجمالي المتأخرات المسجلة 4,820.500 ر.ع موزعة على 9 مستأجرين — 62% منها ضمن الفئة العمرية 31-60 يوماً.',
  sections: [
    {
      title: 'الفئات العمرية للذمم (Aging Buckets)',
      columns: ['الفئة العمرية', 'عدد الفواتير', 'المبلغ (ر.ع)', 'النسبة'],
      rows: [
        ['1-30 يوماً (Current)', '14', '1,240.000', '25.7%'],
        ['31-60 يوماً', '9', '2,990.500', '62.0%'],
        ['61-90 يوماً', '4', '410.000', '8.5%'],
        ['أكثر من 90 يوماً', '2', '180.000', '3.7%'],
      ],
      totals: ['الإجمالي', '29', '4,820.500', '100%'],
    },
    {
      title: 'أعلى الأرصدة المتأخرة (Top Overdue Tenants)',
      columns: ['Tenant / المستأجر', 'الوحدة', 'رقم العقد', 'الرصيد المتأخر'],
      rows: [
        ['Ahmed Al Rawahi — أحمد الرواحي', 'A-07', 'CON-2026-0118', '1,280.000'],
        ['Fatima Zaid — فاطمة زيد', 'C-02', 'CON-2025-0871', '960.500'],
        ['John Mathews — جون ماثيوز', 'B-05', 'CON-2026-0033', '640.000'],
      ],
    },
  ],
});

const legalDossier = build('legal_dossier', {
  reference: 'CASE-2026-014',
  contractReference: 'CON-2025-0871',
  tenantName: 'فاطمة زيد الحمادية',
  propertyTitle: 'مجمع الواحة السكني',
  unitNumber: 'C-02',
  caseStatus: 'قيد المتابعة القانونية',
  timelineEvents: Array.from({ length: 24 }, (_, index) => ({
    date: `2026-${String((index % 8) + 1).padStart(2, '0')}-${String((index % 27) + 1).padStart(2, '0')}`,
    eventType:
      index % 4 === 0
        ? 'استحقاق فاتورة غير مسدد'
        : index % 4 === 1
          ? 'إشعار رسمي بالمطالبة'
          : index % 4 === 2
            ? 'محاولة تواصل موثقة'
            : 'وعد سداد جزئي',
    description:
      index % 4 === 0
        ? `فاتورة إيجار شهر ${['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس'][index % 8]} بقيمة 320.000 ر.ع لم يتم سدادها حتى تاريخه، وتم تقييدها في سجل الذمم المدينة برصيد مستحق.`
        : index % 4 === 1
          ? 'تم إرسال إشعار رسمي للمستأجر عبر البريد المسجل والقناة الإلكترونية الموثقة، مع مهلة نظامية للسداد قبل اتخاذ أي إجراءات إضافية.'
          : index % 4 === 2
            ? 'تم توثيق محاولة تواصل هاتفية مع المستأجر من قبل فريق التحصيل، وتم إرسال ملخص المكالمة والنماذج المعتمدة عبر البريد الإلكتروني.'
            : 'قدم المستأجر وعداً بسداد جزء من المتأخرات خلال أسبوعين، وتم تسجيل الوعد في ملف المتابعة دون اعتباره سداداً فعلياً.',
    source: index % 2 === 0 ? 'نظام الفواتير والتحصيل' : 'سجل التواصل المعتمد',
  })),
  unpaidInvoiceRefs: Array.from({ length: 6 }, (_, index) => ({
    reference: `INV-2026-0${200 + index}`,
    amount: 320,
    dueDate: `2026-${String(index + 3).padStart(2, '0')}-28`,
  })),
  totalArrearsAmount: 1920,
  noticeRefs: ['NOT-2026-031', 'NOT-2026-044', 'NOT-2026-052'],
});

const propertyReport = build('property_report', {
  reportTitle: 'تقرير أداء العقار — برج الياسمين',
  reportType: 'property_performance',
  propertyTitle: 'برج الياسمين',
  periodFrom: '2026-01-01',
  periodTo: '2026-08-31',
  generatedAt: '2026-09-13',
  scopeLabel: 'برج الياسمين — جميع الوحدات',
  identity: [
    { label: 'العقار', value: 'برج الياسمين' },
    { label: 'نطاق التقرير', value: 'جميع الوحدات (48)' },
    { label: 'الفترة', value: 'يناير — أغسطس 2026' },
    { label: 'جهة الإدارة', value: 'شركة الأفق لإدارة الأملاك' },
  ],
  groups: [
    {
      keepTogether: true,
      blocks: [
        {
          kind: 'kpis',
          kpis: [
            { label: 'الإيرادات المحققة', value: { kind: 'amount', value: 122400 }, comparison: { kind: 'percent', value: 6.5 } },
            { label: 'نسبة الإشغال', value: { kind: 'percent', value: 95.8 }, comparison: { kind: 'percent', value: 2.1 } },
            { label: 'متوسط أيام التحصيل', value: { kind: 'text', value: '9 أيام' } },
            { label: 'مصروفات التشغيل', value: { kind: 'amount', value: 18340.25 } },
          ],
        },
        {
          kind: 'note',
          note: { text: 'الأداء العام للعقار ضمن المستهدف السنوي؛ لا توجد مؤشرات خطر على التدفق النقدي للفترة.', tone: 'success' },
        },
      ],
    },
    {
      blocks: [
        {
          kind: 'chart',
          chart: {
            chartType: 'bars',
            title: 'الإيرادات الشهرية مقابل الفترة السابقة',
            caption: 'بآلاف الريالات — مقارنة بالفترة المماثلة',
            categories: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس'],
            series: [
              { name: '2026', values: [14.8, 15.1, 15.3, 15.3, 15.6, 15.9, 15.1, 15.3] },
              { name: '2025', values: [13.9, 14.2, 14.5, 14.1, 14.8, 15.0, 14.6, 14.9] },
            ],
            note: 'المصدر: نموذج قراءة التقارير المعتمد — دون إعادة احتساب.',
          },
        },
        {
          kind: 'table',
          table: {
            title: 'أداء الوحدات حسب النوع',
            columns: ['نوع الوحدة', 'العدد', 'المشغولة', 'الشواغر', 'الإشغال', 'متوسط الإيجار'],
            rows: [
              [{ kind: 'text', value: 'شقق غرفتين' }, { kind: 'text', value: '28' }, { kind: 'text', value: '27' }, { kind: 'text', value: '1' }, { kind: 'percent', value: 96.4 }, { kind: 'amount', value: 320 }],
              [{ kind: 'text', value: 'شقق ثلاث غرف' }, { kind: 'text', value: '14' }, { kind: 'text', value: '13' }, { kind: 'text', value: '1' }, { kind: 'percent', value: 92.9 }, { kind: 'amount', value: 410 }],
              [{ kind: 'text', value: 'وحدات تجارية' }, { kind: 'text', value: '6' }, { kind: 'text', value: '6' }, { kind: 'text', value: '0' }, { kind: 'percent', value: 100 }, { kind: 'amount', value: 560 }],
            ],
            totals: [{ kind: 'text', value: 'الإجمالي' }, { kind: 'text', value: '48' }, { kind: 'text', value: '46' }, { kind: 'text', value: '2' }, { kind: 'percent', value: 95.8 }, { kind: 'amount', value: 372 }],
          },
        },
      ],
    },
    {
      keepTogether: true,
      blocks: [
        {
          kind: 'chart',
          chart: {
            chartType: 'hbar',
            title: 'توزيع مصروفات التشغيل',
            categories: ['صيانة', 'مرافق', 'أمن وسلامة', 'نظافة', 'أخرى'],
            series: [{ name: 'المصروفات (ر.ع)', values: [6800, 5240, 2400, 2900, 1000.25] }],
          },
        },
        { kind: 'note', note: { text: 'بند الصيانة أعلى من المتوسط الموسمي بسبب أعمال الصيانة الوقائية للمصاعد.', tone: 'info' } },
      ],
    },
  ],
});

const ownerReportLongTable = build('owner_report', {
  reportTitle: 'كشف المالك التفصيلي — سالم المعشري',
  reportType: 'owner_statement_detail',
  ownerName: 'سالم بن ناصر المعشري',
  periodFrom: '2026-01-01',
  periodTo: '2026-08-31',
  generatedAt: '2026-09-13',
  scopeLabel: 'مجمع النخيل السكني',
  identity: [
    { label: 'اسم المالك', value: 'سالم بن ناصر المعشري' },
    { label: 'نطاق العقارات', value: 'مجمع النخيل السكني' },
    { label: 'الفترة', value: 'يناير — أغسطس 2026' },
  ],
  groups: [
    {
      keepTogether: true,
      blocks: [
        {
          kind: 'kpis',
          kpis: [
            { label: 'إجمالي التحصيلات', value: { kind: 'amount', value: 28800 } },
            { label: 'مصروفات المالك', value: { kind: 'amount', value: 3120.75 } },
            { label: 'عمولة الإدارة', value: { kind: 'amount', value: 2880 } },
            { label: 'صافي المستحق', value: { kind: 'amount', value: 22799.25 } },
          ],
        },
      ],
    },
    {
      blocks: [
        {
          kind: 'table',
          table: {
            title: 'سجل الحركة المالية للفترة',
            columns: ['التاريخ', 'نوع الحركة', 'البيان', 'المبلغ'],
            rows: Array.from({ length: 90 }, (_, index) => [
              { kind: 'text', value: `2026-0${(index % 8) + 1}-15` },
              { kind: 'text', value: index % 3 === 0 ? 'مصروف' : 'تحصيل' },
              { kind: 'text', value: index % 3 === 0 ? `صيانة الوحدة ${101 + (index % 18)}` : `إيجار الوحدة ${101 + (index % 18)} — REC-${4000 + index}` },
              { kind: 'amount', value: index % 3 === 0 ? -(90 + (index % 7) * 10) : 420 },
            ]),
            totals: [
              { kind: 'text', value: 'صافي الرصيد المستحق' },
              { kind: 'text', value: '' },
              { kind: 'text', value: '' },
              { kind: 'amount', value: 22799.25 },
            ],
          },
        },
      ],
    },
    {
      keepTogether: true,
      blocks: [
        { kind: 'note', note: { text: 'صافي المستحق للمالك مبني على التسويات المعتمدة فقط؛ لا يتضمن أي مبالغ غير مثبتة.', tone: 'neutral' } },
      ],
    },
  ],
});

export const goldenScenarios: readonly GoldenScenario[] = [
  { id: 'receipt-short', name: 'إيصال استلام قصير (صفحة واحدة)', model: receipt, expect: { onePage: true } },
  { id: 'invoice-short', name: 'فاتورة مطالبة مالية (صفحة واحدة)', model: invoice, expect: { onePage: true } },
  { id: 'contract-short', name: 'عقد إيجار (صفحة واحدة مع توقيعات)', model: contract, expect: { onePage: true } },
  { id: 'tenant-statement-medium', name: 'كشف حساب مستأجر متوسط (عدة صفحات)', model: tenantStatement, expect: { multiPage: true, longTable: true } },
  { id: 'owner-statement-long', name: 'كشف حساب مالك طويل — جدول يمتد عبر الصفحات', model: ownerStatement, expect: { multiPage: true, longTable: true } },
  { id: 'income-statement', name: 'قائمة الدخل (مستند مالي)', model: incomeStatement, expect: { onePage: true } },
  { id: 'trial-balance-stress', name: 'ميزان مراجعة 200 حساب (إجهاد ترقيم الصفحات)', model: trialBalance, expect: { multiPage: true, longTable: true } },
  { id: 'english-report', name: 'English content report (Latin pipeline removed)', model: englishReport, expect: { onePage: true } },
  { id: 'mixed-ar-en-report', name: 'تقرير مختلط عربي/إنجليزي', model: mixedReport, expect: { onePage: true } },
  { id: 'legal-dossier-long-text', name: 'ملف نزاع قانوني بنص طويل', model: legalDossier, expect: { multiPage: true } },
  { id: 'property-report-professional', name: 'تقرير أداء عقار احترافي (مخططات)', model: propertyReport, expect: { multiPage: false, onePage: false } },
  { id: 'owner-report-long-table', name: 'كشف مالك احترافي بجدول طويل', model: ownerReportLongTable, expect: { multiPage: true, longTable: true } },
];
