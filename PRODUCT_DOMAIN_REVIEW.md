# MALEK — Product & Domain Review

> **نوع الوثيقة:** مراجعة منتج غير حاكمة وليست بديلاً عن `docs/source-of-truth/`. عند التعارض، تتقدم القرارات والوثائق canonical.  
> **خط الأساس المفحوص:** `arena/01a0109a-malik@63bc6a2` ثم تغييرات هذه المراجعة غير المدمجة.  
> **التاريخ:** 2026-08-17 — Oman (`ar-OM`, OMR 3dp).

## 1. كيف تمت المراجعة

- شُغّل التطبيق الحقيقي محلياً على `Vite` وربط على `0.0.0.0:5173`، وتم التحقق من استجابة الصفحة.
- فُحصت تجربة الدخول، shell، التنقل، لوحة اليوم، الإعداد الأول، العقارات، العقود، المالية، التقارير، الصيانة، الملاك، التسويات، المستندات والإعدادات من route إلى service/RPC.
- فُحصت الأدلة المرئية الفعلية في `evidence/dashboard-v2-visual-redesign/`, `evidence/ui-malek-pro-wave-1/`, `evidence/ui-wave5-malekpro-parity/` و`evidence/wp06-document-output/` على الهاتف واللوحي وسطح المكتب وRTL والوضع الداكن.
- فُحصت حالات loading/empty/error/permission/session/offline واختبارات keyboard/focus/touch.
- لم تُنفذ رحلة متصفح جديدة محمية على البيئة الحية: تنزيل Chromium تعطل من CDN، ولا توجد موافقة على بيانات إنتاجية. لذلك لا تُحوّل هذه المراجعة أدلة repository إلى ادعاء live.

## 2. تشخيص المنتج

MALEK يجب أن يكون **نظام تشغيل ومحاسبة عربي لمكاتب إدارة الإيجارات في عُمان**، وليس ERP عاماً ولا سوق عقارات. قيمته الأساسية:

1. معرفة ما يحتاج عملاً اليوم.
2. تحويل عقار مملوك/مدار إلى وحدة جاهزة وعقد معتمد.
3. معرفة ما استحق وما حُصّل ولمن تعود الأموال.
4. تشغيل الصيانة مع إثبات ومسؤولية واضحة.
5. تسوية المالك من قيود قابلة للمراجعة، لا من أرقام يكتبها المستخدم.
6. إغلاق الشهر بمطابقة البنك والدفاتر الفرعية وGL.

**الحكم:** تعريف المنتج وقلبه المالي صحيحان ومتماسكان. التجربة لم تعد مجموعة صفحات منفصلة؛ IA الحالية task-centric: **اليوم → المحفظة → التأجير → المالية → الخدمات → التقارير → الإعدادات**. أكبر المخاطر المتبقية ليست تجميلية: إثبات البيئة الحية، التسجيل الرسمي للعقود، دليل التسليم/الإخلاء، استعادة كلمة المرور، والمراجعة القانونية/pilot.

## 3. المستخدمون والأدوار

| الدور | المهمة الأساسية | ما يجب أن يراه أولاً | سلطة القرار |
|---|---|---|---|
| `ADMIN` | إعداد الشركة والمستخدمين والضوابط | جاهزية المكتب والتنبيهات الحرجة | إعدادات وصلاحيات واستثناء sole-admin المدقق فقط |
| `MANAGER` | تشغيل المحفظة واعتماد الأعمال | قائمة العمل: عقود، متأخرات، صيانة، تسويات | checker للأعمال المحددة؛ لا يعتمد عمله بنفسه |
| `ACCOUNTANT` | التحصيل، المطابقة، الإقفال والتقارير | الاستثناءات المالية والمطابقة | قيود/تقارير ومراجعات محاسبية حسب الصلاحية |
| `OPERATIONS` | العقارات والوحدات والعقود والصيانة | الأعمال التشغيلية المستحقة | إنشاء ومتابعة؛ لا اعتماد مالي ذاتي |
| `USER` | إدخال/متابعة محدودة | المهام المسموح بها فقط | أقل صلاحية تشغيلية ممنوحة |
| `VIEWER` | قراءة ومراجعة | ملخص موثوق بلا أزرار زائفة | لا كتابة |
| المالك | يستلم كشفاً وتسوية موثقة | **ليس مستخدم portal في RC1** | اعتماد خارجي/توقيع حسب العقد |
| المستأجر | يوقّع، يدفع، يبلغ عن صيانة | **ليس مستخدم portal في RC1** | طرف خارجي، لا صلاحية داخل النظام |

وجود بيانات المالك والمستأجر لا يعني أن portal خارجي جزء من RC1؛ هذا قرار نطاق صحيح وليس نقصاً خفياً.

## 4. Jobs-to-be-done

- عندما أبدأ إدارة عقار، أريد إثبات سلطة المالك واتفاقية الإدارة قبل تأجير وحدة.
- عندما أنشئ عقداً، أريد أن أعرف فوراً إن كانت الوحدة والاتفاقية والفترة صالحة، ثم يمر العقد بمراجعة وتوقيع وتفعيل.
- عندما يصل دفع، أريد ربطه بالمستأجر والفاتورة والعقد وتحديد مالك الأموال آلياً.
- عندما تُصرف نفقة أو تأمين أو تسوية، أريد منع تجاوز الرصيد ومنع استخدام أموال مالك لمالك آخر.
- عندما ترد صيانة، أريد triage وأولوية ومسؤولاً ومزوداً وإثبات إنجاز وتكلفة.
- عند نهاية الشهر، أريد مطابقة البنك والدفاتر وGL ثم كشف مالك يمكن تفسير كل سطر فيه.

## 5. خريطة الرحلات الصحيحة

### الرحلة A — أول قيمة
`شركة وصلاحيات → مالك/سلطة → عقار + ملكية → وحدة → اتفاقية إدارة versioned → مسودة عقد`

الناتج الأول المفيد ليس “إضافة سجل”، بل **مسودة عقد صالحة للمرور إلى الاعتماد**. تم نقل checklist لهذه الرحلة إلى أعلى لوحة اليوم للمدير الجديد.

### الرحلة B — التأجير
`DRAFT → REVIEW → APPROVED → SIGNED → ACTIVE → RENEWED أو TERMINATED/EXPIRED`

- التعديل التجاري لا يغير التاريخ؛ ينشئ نسخة/تجديداً.
- التفعيل يلتقط agreement version وcollection role والشروط.
- التسجيل البلدي/الرسمي يجب أن يكون حالة إثبات مستقلة عن حالة التشغيل، ولا يجوز اختراع متطلب قانوني أو رسم ثابت داخل الكود.

### الرحلة C — المال
`Invoice/obligation → collection → allocation → fee/tax → owner position → settlement → bank reconciliation → period close`

التأمين liability مستقل. VOID/credit/refund/reversal تعويضية وتحفظ التاريخ. أي فرق reconciliation يمنع الادعاء بالإقفال.

### الرحلة D — الصيانة
`REPORTED → TRIAGED → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED` مع `CANCELLED` بسبب موثق.

كل طلب يحتاج عقار/وحدة، أولوية، مسؤول، مزود عند الإسناد، صور/فاتورة عند الحاجة، وقت وتكلفة، وموافقة مالية إذا تجاوزت السلطة. التطبيق يغطي الأساس، لكن التسليم/الفحص قبل وبعد الإيجار ليس رحلة structured كاملة.

### الرحلة E — الإخلاء/إنهاء العقد
`notice → obligations freeze/cancel future schedule → move-out evidence → deposit claim/refund → final tenant balance → owner statement → archive`

الأجزاء المالية موجودة بدرجة قوية؛ evidence checklist للحالة المادية والتسجيل الرسمي ما زال يحتاج specification وتنفيذ.

## 6. سجل القضايا والقرارات

| ID / النوع | المستخدم المتأثر | التجربة الحالية | توقع المجال | الأثر والشدة | قرار المنتج | التصحيح الدقيق | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| PX-01 DEFECT | Admin/Manager جديد | checklist الإعداد كان بعد كل محتوى اليوم | أول قيمة يجب أن تسبق analytics | تأخر التفعيل؛ HIGH | **أُصلح** | وضع رحلة الإعداد مباشرة بعد header/error وقبل قائمة العمل | المدير الجديد يرى الخطوة التالية قبل KPIs؛ المستخدم غير المخول لا يراها |
| PX-02 DEFECT | الجميع/الهاتف | badge كان يقول متصل دائماً لأن store لا يستمع للشبكة | حالة اتصال صادقة وقابلة للإدراك | حفظ يفشل بلا تفسير؛ HIGH | **أُصلح** | ربط `online/offline` وإظهار تنبيه عالمي صريح | offline يغيّر الحالة ويظهر `role=status`; online يزيلها؛ لا ادعاء بأن البيانات synchronized |
| PX-03 DEFECT | Admin | catalog اختياري فقط ينتج `NaN%` | progress صالح لكل إعداد | تشويش؛ MEDIUM | **أُصلح** | 100% عند عدم وجود متطلبات إلزامية | لا `NaN`; progressbar بين 0 و100 |
| PX-04 DEFECT | كل مستخدم نسي كلمة المرور | login كان بلا recovery | self-service reset مع رابط محدود العمر | lockout ودعم يدوي؛ HIGH | **أُصلح في repository** | `resetPasswordForEmail` + public callback + neutral success + expired state | لا يكشف وجود البريد؛ routes/tests موجودة؛ redirect/email delivery يحتاج hosted proof |
| PX-05 REGULATORY SPEC | Manager/Operations | لا توجد حالة structured لتسجيل عقد الإيجار لدى الجهة المختصة | التسجيل الرسمي وإثباته منفصلان عن `ACTIVE` | نزاع/عدم امتثال؛ BLOCKER قبل ادعاء Oman-ready | إضافة configurable registration evidence، بعد اعتماد قانوني | authority, jurisdiction, required?, status, submitted/registered dates, reference, fee, expiry, document | لا hard-coded fee/deadline؛ required config يمنع “جاهز قانونياً” لا التشغيل التاريخي؛ audit trail |
| PX-06 MISSING EXPECTED CAPABILITY | Operations/Tenant/Owner | المستندات موجودة لكن لا move-in/move-out condition workflow structured | فحص، عدادات، مفاتيح، صور وتوقيعات قبل/بعد | نزاع تأمين وصيانة؛ HIGH | مواصفة handover مشتركة | checklist template + immutable inspection + attachments + signatures + comparison | claim للتأمين يربط evidence؛ لا تعديل بعد التوقيع؛ mobile photo flow usable |
| PX-07 EXTERNAL BLOCKER | Accountant/Admin | repository reconciliation قوي لكن live/pilot غير مثبت | exact deployed proof + full-period pilot | أموال وتقارير غير مثبتة؛ BLOCKER | لا إطلاق عام | تنفيذ WP-07 كما هو canonical | exact SHA؛ restore drill؛ 0 unexplained variance؛ sign-offs |
| PX-08 EXTERNAL BLOCKER | جميع الأطراف | قوالب موجودة بلا اعتماد عُماني | wording/retention/signature review | قابلية إنفاذ؛ BLOCKER | مراجعة قانونية مستقلة | اعتماد templates وretention وregistration wording | versioned approval record؛ approved template id داخل signed artifact |
| PX-09 RESEARCH-BACKED | Accountant | التقارير والمطابقة متكاملة تقنياً | bank/book/subledger tie-out دوري | خطر تشغيلي إن لم يثبت live؛ HIGH | إبقاء reconciliation بوابة صرف/إقفال | لا تخفيف controls؛ إظهار exceptions قبل الإجراءات | mismatch ظاهر؛ payout/close fail closed وفق القواعد؛ drill-through متاح |
| PX-10 DEFECT/DOC DRIFT | مستخدم جديد وفريق المنتج | canonical UX وصف roots قديمة أكثر من IA الحالية | خريطة واحدة مطابقة للتنقل | قرارات تصميم متضاربة؛ MEDIUM | تحديث Document 6 | تثبيت 7 roots وchildren الحالية | route contract وDocument 6 متطابقان وتنجح guards |
| PX-11 SUBJECTIVE PREFERENCE | مستخدم هاتف | بعض سجلات الصيانة طويلة وبها أزرار كاملة متكررة | primary action واحد + menu ثانوي | كثافة وتمرير؛ LOW | لا تغيير واسع الآن | قياس task completion أولاً؛ المحافظة على touch targets | لا إزالة capability؛ اختبار مستخدم قبل refactor |
| PX-12 OUT OF SCOPE | Owner/Tenant | لا portal خارجي | portals شائعة لكن ليست لازمة للـoffice RC1 | scope/identity/security كبير؛ DEFERRED | لا إضافتها الآن | outputs آمنة وcommunication links تكفي للـpilot | لا claims بوجود portal؛ documents قابلة للمشاركة وفق السياسة |
| PX-13 CORRECT CONTROL | جميع الأدوار | MASTER_LEASE kernels موجودة لكن UI مخفية في RC1 | لا عرض module غير مكتمل | يمنع تضليل IFRS؛ GOOD | الإبقاء على الاستبعاد | لا nav/create/report claims | كل RC1 paths fail closed؛ التاريخ محفوظ |
| PX-14 CORRECT CONTROL | مستخدم محدود | locked child يظهر مع طلب صلاحية؛ backend authoritative | discoverability بلا privilege widening | ثقة أعلى؛ GOOD | الإبقاء | permission request مع سبب وسياق | لا زر كتابة غير مسموح؛ self-approval مرفوض |

## 7. البحث الخارجي وفصل نوع الدليل

### ممارسة مجال شائعة وليست حكماً قانونياً عُمانياً

- الأنظمة المهنية تجمع lease, collection, maintenance, owner reporting وaccounting في مصدر واحد؛ وهذا يدعم اتجاه MALEK الحالي: [Gartner property-management market overview](https://www.gartner.com/reviews/market/property-management-software).
- NARPM يشرح فصل أموال كل مالك، audit trail وthree-way reconciliation الدورية: [NARPM trust-accounting material](https://www.narpm.org/indexed/21-internalaffairs-mumford-pdf/).
- هذه ممارسات محافظة لحماية أموال الغير، وليست تصريحاً بأن قانون ولاية أمريكية ينطبق في عُمان.

### دليل قانوني/تنظيمي يحتاج محامياً عُمانياً قبل تحويله إلى rule

- بوابة عمان تشير إلى توثيق علاقة الإيجار والتسجيل خلال شهر وتطلب مستندات هوية/ملكية: [Omanuna — New rent contract registration](https://omanuna.oman.om/en/online-services/online-service-detail/new-rent-contract-registration).
- يوجد تعديل حديث بالمرسوم السلطاني 12/2025 للعلاقة بين المؤجر والمستأجر وتسجيل العقود: [Royal Decree 12/2025](https://decree.om/2025/rd20250012/).
- لذلك القرار الصحيح هو configurable registration evidence مع legal sign-off، لا hard-code لمهلة أو رسم من مقال.

### معيار منصة/وصول

- WCAG 2.2 يطلب keyboard operation، focus غير محجوب، target spacing/size ورسائل أخطاء قابلة للإدراك: [W3C WCAG 2.2 Techniques](https://www.w3.org/WAI/WCAG22/Techniques/).

## 8. الخلاصة

المنتج الصحيح هو **office operating system موثوق مالياً**. لا يحتاج ميزات أكثر قبل الإطلاق؛ يحتاج إغلاق الأدلة الخارجية وثلاث فجوات رئيسية: contract registration evidence، move-in/out evidence، وlive pilot. Password recovery أصبح منفذاً في repository ويحتاج فقط hosted email/redirect proof. أي توسع CRM/marketplace/portal الآن يقلل فرصة إطلاق آمن.
