# MALEK — Product Experience Scorecard

> **غير حاكم:** هذه scorecard تلخص الأدلة ولا تمنح Stage Credit أو live readiness. المصدر الحاكم هو `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md` وDocument 8.

## منهج الدرجات

- `9–10`: مكتمل ومتسق مع دليل rendered/runtime مناسب.
- `7–8`: قوي مع فجوة محددة غير مدمرة.
- `5–6`: usable لكن يحتاج متابعة أو دليل مهم.
- `<5`: blocker أو رحلة غير موثوقة.

درجة repository UX منفصلة عن launch readiness؛ لا يتم رفع الأخيرة باختبار unit أو screenshot.

## النتيجة

| البعد | الدرجة /10 | الدليل | الحكم |
|---|---:|---|---|
| وضوح تعريف المنتج | 9 | Charter، nav، Dashboard copy | واضح: تشغيل ومحاسبة مكتب إدارة عقارات، لا ERP عام |
| وضوح القيمة لأول زائر | 9 repository / 6 hosted | Login + brand + recovery routes + Today workspace | recovery واضح ومحايد؛ email delivery/redirect يحتاج hosted proof |
| أول قيمة لمستخدم جديد | 8 | backend onboarding + التحسين الحالي | المسار الصحيح ظاهر أولاً الآن؛ التسجيل/الفحص ليسا structured |
| IA والتنقل | 9 | `route-contract.ts`, `app-nav-items.ts` | 7 وجهات task-centric مع children قابلة للاكتشاف وdeep links محفوظة |
| دورة العقار/الوحدة/المالك | 8 | dossiers + agreement versions | source terms قوية؛ evidence القانوني/الميداني ناقص |
| دورة العقد | 9 repository / 5 hosted | maker-checker + renewal/termination + snapshots + registration/handover evidence | الرحلة مكتملة repository؛ legal profile وhosted proof متبقيان |
| التحصيل وأموال الملاك | 9 repository / 4 live | RPC/GL/reconciliation tests | authority قوية؛ لا live/pilot proof |
| التأمينات والاسترداد | 9 repository / 4 live | governed claims/refunds/reversals | immutable و3dp؛ legal return policy خارجية |
| الصيانة والخدمات | 9 repository / 5 hosted | command center + providers + move-in/out inspections | evidence structured ومراجع؛ browser/live proof متبقٍ |
| التقارير والمطابقة | 9 repository / 4 live | GL statements + DB0 + PDF evidence | drill-through قوي؛ hosted acceptance/sign-off مفقود |
| الأدوار والصلاحيات | 9 repository / 5 live | six roles + request UX + maker-checker | fail-closed محلياً؛ deployed Auth/RLS proof مفقود |
| حالات loading/empty/error | 8 | shared states + dashboard stale/error handling | جيدة؛ بعض الصفحات ما زالت تستخدم primitives مختلفة |
| offline/session recovery | 9 repository / 6 hosted | global network notice + session expiry redirect + password recovery | الشبكة صادقة؛ recovery يحتاج hosted email/redirect proof |
| Mobile/RTL/touch | 8 | screenshots + responsive tests + 44px controls | قوي؛ current-SHA browser rerun مطلوب |
| Keyboard/screen reader | 8 repository / 5 runtime | focus restoration, labels, semantic tables, tests | عقود جيدة؛ manual AT pass غير موجود |
| الثقة واللغة | 9 | Arabic copy, OMR 3dp, no fake zero, source labels | واضحة ومحافظة ولا تخفي source authority |
| الوثائق والطباعة | 8 repository / 4 legal | PDF artifacts, private Storage | المخرجات موجودة؛ approval قانوني وhosted font/layout acceptance مفقود |
| جاهزية الإطلاق العام | **4** | G11–G13 | ليست production-ready حتى live, restore, pilot, legal/accounting sign-offs |

**متوسط تجربة repository:** `8.4/10`.  
**جاهزية الإطلاق المثبتة:** `4/10`، ولا يجوز دمج الرقمين.

## Launch blockers

| Blocker | المالك | دليل الإغلاق المطلوب |
|---|---|---|
| Exact live environment | WP-07 / authorized operator | SHA، migrations، Auth Hook، RLS، Storage، secrets، monitoring |
| Backup/restore | authorized infrastructure owner | restore rehearsal موثق بدون فقد |
| One-office pilot | pilot office + accountant | دورة تشغيل ومحاسبة كاملة، فروق غير مفسرة = صفر |
| Oman legal templates | محامٍ عُماني مخول | wording, signatures, retention, registration responsibilities |
| Tax/statutory codes | محاسب/مستشار ضريبي | approved catalog/effective dates؛ لا defaults مخترعة |
| Contract registration legal activation | Omani legal reviewer | framework موجود وNOT_CONFIGURED افتراضياً؛ يلزم effective profile معتمد |
| Password recovery hosted proof | deployed email config | repository flow موجود؛ يلزم email delivery + redirect allowlist + expired-link proof على exact SHA |

## أهم ما يعمل جيداً

1. Dashboard يقدّم العمل قبل التحليلات ولا يصنع صفراً عند فشل المصدر.
2. المال مرتبط بالدفاتر والـRPC وليس بحسابات UI موثوقة من المستخدم.
3. العقود والاتفاقيات تحفظ versions/snapshots بدلاً من تعديل التاريخ.
4. الصلاحيات قابلة للاكتشاف مع طلب وصول، لكن التنفيذ backend-authoritative.
5. mobile registers لا تحاول ضغط desktop table أفقياً.
6. المستندات private وتستخدم signed URLs.

## ما لا يجوز قوله في التسويق الآن

- “جاهز للإنتاج” أو “معتمد قانونياً في عُمان”.
- “متوافق IFRS بالكامل”.
- “مطابقة مالية حية” دون exact environment evidence.
- “بوابة مالك/مستأجر” أو “دفع إلكتروني” إن لم تكن رحلة حية ضمن النطاق.
- “تسجيل بلدي تلقائي”؛ غير موجود ولم يعتمد.

## ملاحظة التحقق

تم تشغيل التطبيق محلياً وفحص الأدلة المرئية الحالية. تعذر browser automation جديد لأن Chromium غير مثبت وفشل تنزيله من CDN. لذلك بقيت درجات runtime أقل عمداً حتى إعادة Browser Readiness على current SHA.
