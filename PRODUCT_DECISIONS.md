# MALEK — Product Recommendations & Reversible Assumptions

> **ليست Decision Register حاكمة.** القرارات D01–D18 في `governance/final-decision-register.json` تتقدم دائماً. البنود هنا توصيات تنفيذية؛ أي سياسة قانونية/مالية جديدة تبقى `PROPOSED` حتى اعتمادها بالطريقة الحاكمة.

## قواعد القرار

1. القيمة الأساسية: قرار يومي صحيح + traceability مالية.
2. لا feature جديدة إذا كانت نفس المهمة قابلة للإنجاز في workspace موجود.
3. لا hard-code لرسم/مهلة/صياغة قانونية عُمانية دون اعتماد.
4. defaults المحافظة تكون configurable وfail-closed عند المال/القانون.
5. UI لا يعيد حساب authority المالية ولا يخفي سبب المنع.
6. كل قرار reversible ما لم يرتبط بتاريخ posted؛ التاريخ يُصحح تعويضياً فقط.

## قرارات مختارة

| ID | القرار | الحالة | السبب الحاسم | قابلية الرجوع |
|---|---|---|---|---|
| PD-01 | تعريف MALEK كنظام تشغيل ومحاسبة لمكتب إدارة إيجارات | CONFIRMED | يطابق repository والقيمة التي يدفع المكتب لأجلها | تغيير scope يحتاج قرار مالك جديد |
| PD-02 | إبقاء IA من 7 roots task-centric | CONFIRMED | أقل حمل معرفي مع إبقاء deep links وchildren | labels/order قابلة للتعديل دون data migration |
| PD-03 | أول قيمة = مسودة عقد صحيحة بعد setup، لا مجرد سجل عقار | CONFIRMED | تربط onboarding بالنتيجة التشغيلية | ترتيب UI قابل للرجوع |
| PD-04 | عرض onboarding قبل work/KPI للمكتب غير المكتمل | IMPLEMENTED | المستخدم الجديد لا يملك work queues مفيدة بعد | نقل component فقط |
| PD-05 | حالة الشبكة عالمية وصادقة؛ لا تسمى “مزامنة ناجحة” | IMPLEMENTED | `navigator.onLine` لا يثبت backend sync | listeners/banner قابلة للإزالة |
| PD-06 | الحفاظ على six-role + maker-checker وعدم توسيع صلاحية لتسهيل UX | CONFIRMED | أخطر خطأ هو تنفيذ مالي غير مصرح | permissions تغيّر فقط بمسار governance |
| PD-07 | MASTER_LEASE يبقى خارج RC1 | CONFIRMED ADR 0017 | لا رحلة/reporting/professional review كاملة | يمكن إعادته في release لاحق |
| PD-08 | portals للمالك/المستأجر خارج RC1 | CONFIRMED SCOPE | تزيد auth/privacy/support قبل إثبات office core | outputs الحالية لا تُحذف |
| PD-09 | contract registration evidence يصبح capability configurable | IMPLEMENTED — disabled until legal profile | متوقع في عُمان، لكن authority/deadline/fee تختلف وتحتاج legal | additive schema؛ disabled افتراضياً حتى config |
| PD-10 | move-in/out inspection يصبح evidence workflow مشتركة | IMPLEMENTED — runtime proof pending | يحمي deposit/maintenance disputes | additive templates/records؛ لا يغير التاريخ |
| PD-11 | password recovery قبل pilot | IMPLEMENTED — hosted proof pending | login بلا recovery يخلق lockout ودعماً يدوياً | route/email config قابلة للرجوع |
| PD-12 | لا إعادة تصميم بصري واسع قبل current-SHA browser/AT test | CONFIRMED | الأدلة تظهر hierarchy متماسكة؛ الخطر الآن وظيفي/خارجي | polish لاحقاً بعد قياس |
| PD-13 | reconciliation mismatch يمنع payout/close وفق السلطة الحالية | CONFIRMED | حماية أموال الغير أهم من سرعة الإجراء | لا bypass؛ resolution auditable |
| PD-14 | OMR دائماً 3dp من company-aware formatter | CONFIRMED | خطأ decimal يؤثر مالياً وثقافياً | N/A ضمن baseline Oman |

## الافتراضات المحافظة

| الافتراض | default | لماذا آمن | متى يتغير |
|---|---|---|---|
| jurisdiction | Oman / OMR | canonical baseline | قرار سوق جديد حاكم |
| registration rule | `UNKNOWN / NOT_CONFIGURED` | لا يصنع ادعاء قانونياً | بعد legal configuration |
| registration fee/deadline | فارغ | لا hard-code من مقال | قيمة رسمية effective-dated |
| deposit beneficiary/custodian | explicit per agreement version | يمنع التخمين | تعديل مستقبلي versioned |
| maintenance approval threshold | لا رقم عالمي مخترع | company-specific policy | إعداد شركة + audit |
| notification channel | in-app؛ WhatsApp preview لا إرسال تلقائي | لا التزام بمزود/تكلفة | بعد موافقة paid provider/privacy |
| portal access | disabled | لا surface خارجي غير مثبت | release مستقل |
| offline behavior | read visible state؛ writes may fail | التطبيق ليس offline-authoritative | بعد تصميم queue/idempotency كامل |

## مواصفة القرار الكبير PD-09 — Contract Registration Evidence

**الهدف:** معرفة هل العقد يتطلب تسجيلاً، أين، متى، وما إثبات التسجيل، دون خلطه بـ`contract.status`.

### النموذج المقترح

- `contract_registration_requirements`: company/jurisdiction/effective dates/authority/required/deadline rule/fee rule/template.
- `contract_registration_records`: contract/company/requirement snapshot/status (`NOT_REQUIRED`, `REQUIRED`, `SUBMITTED`, `REGISTERED`, `REJECTED`, `EXPIRED`, `CANCELLED`), reference, submitted/registered/expiry dates, amount/currency, document id, actor/reviewer/timestamps/reason.
- كل تغيير append/audit؛ لا overwrite لإثبات سابق.
- `ACTIVE` يبقى lifecycle تشغيلياً. readiness banner يوضح “نشط تشغيلياً — التسجيل مطلوب/قيد الإجراء” بدل ادعاء قانوني.
- منع document wording “مسجل” حتى status `REGISTERED` + evidence.

### UX

- card “التسجيل الرسمي” في ملف العقد.
- action واحد “بدء/تحديث طلب التسجيل” مع timeline.
- تنبيه Today للعقود المطلوبة أو المرفوضة أو القريبة من انتهاء الإثبات.
- permission منفصلة maker/checker إذا اعتُبر التسجيل designated approval.

### لا يُنفذ قبل

- اعتماد المحامي للجهة/المهلة/المسؤولية/retention.
- تحديد ما إذا كانت القاعدة تختلف حسب المحافظة أو نوع العقار/الطرف.

## مواصفة القرار الكبير PD-10 — Handover & Inspection

- template versioned حسب نوع العقار.
- move-in/move-out record مستقل، meter readings، keys/access items، condition items، photos/documents، notes، signatures، completed/reviewed times.
- بعد التوقيع immutable؛ correction = amendment.
- deposit claim يربط line-by-line إلى invoice/arrears أو inspection evidence ولا يقبل caller-selected accounting target.
- الهاتف هو السطح الأول للتصوير؛ desktop للمراجعة والمقارنة.

## القرارات التي لا تحتاج سؤال المالك

- تحسين copy، ترتيب onboarding، offline notice، focus/touch/RTL، توحيد states، إزالة التكرار البصري الواضح.
- implementation details/libraries/testing.

## قرار المالك المسجل

وافق المالك على **PD-09 + PD-10 كـEvidence & Compliance Journey**. نُفذ الإطار additive دون تفعيل أي ادعاء أو رسم أو مهلة قانونية. لا يزال إدخال `contract_registration_requirement_profiles` الفعلي يحتاج محامياً مخولاً، ولا يُعامل وجود الجداول كاعتماد قانوني.
