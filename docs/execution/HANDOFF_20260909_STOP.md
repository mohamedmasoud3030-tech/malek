# تسليم الجلسة — توقف صريح بطلب المستخدم — 2026-09-09

## 1. التعليمات النهائية والحالة المجمدة

**المستخدم أمر بالتوقف الفوري عن التطوير، وحفظ جميع تغييرات المستودع المحلية وملف التسليم في كوميت ورفعهما إلى الفرع نفسه، دون دمج، ثم التوقف. لا تستأنف العمل تلقائياً اعتماداً على خطط هذه الوثيقة؛ يلزم طلب جديد من المستخدم.**

- المستودع: `mohamedmasoud3030-tech/malek`، مساحة العمل `/home/user/malek`.
- الفرع الوحيد: `reconstruction/checkpoint-20260909`. لا فرع جديد، لا PR، لا merge، لا force-push، لا reset/revert/stash.
- آخر مرحلة مكتملة التحقق ومرفوعة قبل أمر التوقف: **`9cbd15d730efa281edb0957e194fd27abd993ded`**، migration15.
- الكوميت الذي يحتوي هذا الملف يحفظ **migration16 والعمل المحلي غير المكتمل**. ليس إصداراً مكتمل التحقق أو إعلان جاهزية للنشر.
- عند التوقف لم تظهر عمليات Playwright/Vite/Vitest عاملة في فحص العمليات. معرّف المعاينة السابق لم يعد موجوداً. لم يُستأنف تشغيل اختبارات أو بناء أو إصلاح بعد أمر التوقف.
- توقف المستخدم أثناء محاولة متصفح جديدة. الملف المعدل للتجربة موجود، لكن التنفيذ لم يكتمل بنجاح: سجل المحاولة المصححة يحتوي فشل desktop واحداً؛ نتيجة mobile/المجموعة النهائية غير معروفة. لا تعتبر العملية الملغاة نجاحاً.
- مفاتيح GitHub استُخدمت مؤقتاً في بيئة subprocess فقط؛ لا توجد أسرار مقصودة في المستودع أو ملفات التسليم. عنوان origin غير سري. استعادة جلسة العمل قد تحذف `.git/config` والاعتماديات وصلاحيات التنفيذ؛ أعيدت صلاحيات التنفيذ الأصلية لثمانية سكربتات skills دون تعديل محتواها.

## 2. نطاق التكليف الأصلي والقيود التي تظل سارية

إغلاق السلسلة المالية بالكامل، بالأولوية: إنشاء مصروف OWNER، التوزيع، التسوية، والمقاصة القانونية. يجب تتبع:

**expense → source evidence → classification → allocation → offset → settlement → ledger → balance → historical cutoff → reports**.

الحفاظ على التاريخ المالي، ثلاث منازل OMR، maker/checker، الصلاحيات الفعلية، عزل الشركات/الملاك/العقارات/المستأجرين، والـ idempotency. إصلاح المصدر المعتمد لا إخفاء الفروق في التقارير. لا إعادة كتابة السجلات المرحلة ولا اختلاق حقوق مقاصة أو أدلة اعتماد. لا تغيير إنتاج أو ترحيل إنتاج غير معتمد.

قبل أمر التوقف كان المطلوب العمل باستقلالية، مع دورات تنفيذ→اختبارات مركزة→SQL فعلي→متصفح→مراجعة diff→commit→push→مطابقة SHA، وألا تتراكم مرحلة كبيرة محلياً. أمر التوقف الأخير يعلو على طلب الاستمرار السابق.

عند استئناف مصرح به: اقرأ `AGENTS.md` و`DATABASE_RULES.md` و`skills/implementation/SKILL.md` و`skills/database/SKILL.md` و`docs/source-of-truth/00_INDEX.md` وملف traceability. لا تمنح stage credit من مجرد نجاح اختبارات المستودع، ولا تحذف ملفات قبل إثبات عدم وجود مراجع أو وظائف مطلوبة.

## 3. الخلفية المحفوظة قبل هذه الجلسة

البدء كان من الفرع نفسه، مع checkpoint13 مثبت على remote:
`3e7963b3089b7a412bfd5cef48a9d6d9db308233`.

الأعمال السابقة لا تعاد من الصفر:
- توحيد القراءة المالية/الصفحات والـ cache والـ CSV وحدود الجلسة والصلاحيات ومصادر الفواتير/الائتمان/الودائع وإصلاحات cutoff؛ التفاصيل في سجل التنفيذ.
- مراجعات S08/S09 للمصروفات: تجميد المصدر والملكية والعقد والقيد، مراجعة مستقلة، منع انتحال snapshots، تواريخ اقتصادية صحيحة، وحفظ التاريخ والـ retries.
- migration12: توزيع OWNER صريح وأدلة واتفاقية/نسخة؛ ربط receivable1300؛ مسار المصروف والصيانة؛ منع الاستقطاع الآلي القديم غير المعتمد؛ دفع المتبقي بعد المقاصة وإغلاق صفر النقد. لا تبنٍّ تلقائي للتاريخ.
- pagination للاتفاقيات، وإثبات ترقية S09 معتمد قبل12، منجزان.
- migration13: منع تجاوز المقاصة ولو0.001، اشتراط عكس المقاصة قبل الإلغاء، تجميد دليل التسوية المدفوعة ومنع عكس المقاصة بعد الدفع دون تعديل محكوم. حفظ عينات تاريخية خاطئة والـ retries دون إعادة كتابة.
- دليل13 المنقول من السياق: 541 ملفاً/3845 اختباراً، وأنواع وعقود وبوابات، ومتصفح SQL desktop/mobile ناجحان. هذا دليل سابق وليس نتيجة migration16.

## 4. ما أُنجز ورُفع في هذه الجلسة

### migration14 — quotation للدفع المتبقي

الكوميت **`906bb259cc288fbf41a676863f865a5384ff3058`** رُفع وتمت مطابقة remote حرفياً.

- `preview_owner_settlement_payment(text)` يفحص الشركة والصلاحية الفعلية والحالة APPROVED وحداثة المصدر والتوزيع.
- hash اختياري يُفحص داخل قفل الدفع، بعد مسار إعادة الرد المحفوظ. fingerprints القديمة غير المقتبسة محفوظة. لا قبول لمبلغ دفع من العميل.
- pending cash في الموقف المالي = الاستحقاق ناقص المقاصة. لم يُستنتج النقد التاريخي من header قديم متغير.
- الحوار يعرض الاستحقاق/المقاصة/النقد المتبقي، ولا يسمح بالدفع قبل معاينة صالحة؛ محاولة وquote ثابتان عند فقد الرد، وACK صارم للمبلغ والهوية والقيد/الصفر.
- تحديث القراءات المالية عند الخطأ أيضاً، إصلاح nested mobile actions وclosures القديمة للصلاحيات، وتسمية نطاق جميع عقارات المالك.
- إعادة توليد أنواع DB، وتصحيح سجل Guardian لتوقيع الصيانة ذي8 معاملات بدل6 المحذوف، وإضافة فحص صلاحية quote.
- التحقق من grants النهائية أثبت أن migration ACL-lock القائمة تمنع DML مباشرة بالفعل؛ grants الواسعة في baseline ليست الحالة النهائية. أُضيف اختبار منع UPDATE وINSERT/UPDATE/DELETE/TRUNCATE. لا ادعاء باكتشاف bypass عملي لهذا DML.
- نتائج: SQL18 + client/workspace/report36 ناجحة. الأمر القياسي العام:541/3842؛ اختبار accessibility المستثنى منفصلاً:1/15. الأنواع والبوابات والعقود والبناء/PWA ناجحة.
- المتصفح حينها مختلط: مسار الدفع وإعادة المحاولة نجح على العرضين؛ آخر mobile كامل ناجح17.6s، وdesktop تعطل عند فتح تقرير. لم يُعلن نجاح المجموعة كلها.
- حدث نقص اعتماد GitHub بعد استعادة الجلسة؛ المستخدم أعاد توفير اعتماد، فتم رفع14 والتحقق منه. لم يُخزن الاعتماد.

### migration15 — إثبات النقد الأصلي والمطابقة البنكية

الكوميت **`9cbd15d730efa281edb0957e194fd27abd993ded`** رُفع وتمت مطابقة remote حرفياً.

- إعادة إنتاج SQL: تحصيل1000→مقاصة25→دفع975؛ المطابقة القديمة قبلت−1000 ورفضت−975.
- `app_private.owner_settlement_paid_cash(uuid,text)` هو قارئ الدليل المشترك: القيد الأصلي المتوازن2000 مقابل1111/1120، لا header المقاصة الحالي. عدم وجود قيد ليس صفراً؛ ACK أصلي موثق يستطيع إثبات إغلاق بالمقاصة دون نقد. الدليل المفقود/غير الصالح NULL.
- `get_owner_settlement_cash_payments(text[])`: قراءة محكومة بصلاحية bank-view والشركة، بحد200 معرف. الخدمة تتحقق من كل المعرفات والاستجابة، ولا تعيد نتائج جزئية عند فشل دفعة لاحقة.
- الاقتراحات تستخدم النقد المثبت والمطابق يفحص المصدر نفسه؛ قراءة التاريخ محصورة بحد UTC واسع ثم حساب يوم الشركة بدقة، مع pagination كاملة.
- فشل اقتراحات المطابقة ظاهر مع إعادة محاولة، لا يتحول إلى «لا توجد اقتراحات».
- ترقية حقيقية11→15: بعد دفع975 وعكس مقاصة كان مسموحاً قديماً، صار header.offset=0؛ النقد ظل975. حدث owner-funds الخاطئ القديم−1000 وكل الأحداث الأصلية والـ retry محفوظة. **لم تُصلح تلك الفجوة التاريخية خفيةً.**
- النتائج الأخيرة: bank suite14 ملفاً/84 اختباراً؛ **full544/3876 PASS539.96s** بما في ذلك accessibility؛ الأنواع والبوابات الست والعقود ناجحة؛ بناء/PWA ناجح.
- آخر متصفح على البناء المحدّث: **4 PASS57.0s، retries0**: expense/maintenance/quoted payout/report وbank cash/error retry/confirmation على desktop/mobile. مطابقة−979.875 دون أي قيد إضافي.
- التشخيص الخاص بتوقف bootstrap القديم ما زال مفتوحاً رغم نجاح الجولة الأخيرة. أضيفت مرفقات فشل رصدية لـ Web Locks ومسارات طلبات auth/company دون قيم جلسة أو استبدال auth/locks.

## 5. العمل المحلي المحفوظ عند التوقف — migration16 (غير مكتمل)

### الملفات والهدف

- `supabase/migrations/20260909000016_owner_position_cash_evidence.sql`.
- `rentrix-app/src/features/financials/reports/owner-paid-cash-position.test.ts`.
- `rentrix-app/src/features/financials/services/owner-financial-authority-service.ts`.
- `rentrix-app/src/features/owners/components/owner-financial-authority-section.tsx`.
- `rentrix-app/src/features/owners/services/owner-financial-service.test.ts`.
- `rentrix-app/src/features/reports/documents/professional-owner-report.ts` واختباره.
- `rentrix-app/e2e/owner-position-cash.spec.ts` وfixture `e2e/support/fake-supabase-backend.ts`.

### المنفذ محلياً

1. الحفاظ على `paid_net` كاستحقاق تسويات مسوّاة، وإضافة حقول lifetime من قارئ15 نفسه:
   - `paid_cash`: NULL عند وجود أي دليل نقدي مفقود، وإلا الإجمالي المثبت.
   - `paid_cash_proven_total`: المجموع الجزئي المعروف، لا يُسمى إجمالياً كاملاً عند نقص الدليل.
   - `paid_cash_evidence_missing_count`.
2. لا تغيير نطاق lifecycle_all_time إلى فترة التقرير، ولا backfill أو تعديل تاريخي.
3. parser يرفض التناقض بين cash/completeness/count، ويرفض تحويل null/empty/boolean/array/object في الحقول المالية المطلوبة إلى صفر.
4. شاشة الموقف المالي تفصل الاستحقاق عن النقد، وتعرض تحذير النقص ومجموعاً جزئياً موسوماً بوضوح.
5. professional owner report يفصل cash/entitlement، ويزيل الإيحاء الحسابي بطرح صرف كل الفترات من استحقاق فترة واحدة. جدول التسويات يسمي المبلغ استحقاقاً قبل المقاصة، ومرجعاً للإغلاق/الصرف. يطبع نقص الإثبات صراحةً.
6. fixture المتصفح أضيفت إليه حقول النقد الجديدة، وصُحح pending ليطابق remaining في المثال.

### التحقق وحدوده بدقة

- SQL المركز:3 PASS (استحقاق1000/نقد975؛ lifetime مستقل عن فترة2025؛ سجل تاريخي غير مثبت يجعل total=NULL مع known975).
- service15 + professional document17: PASS. الإجمالي المركز **35 PASS**.
- main/test types:PASS؛ build/PWA:PASS، قبل آخر تعديل harness للعلاقة المتداخلة.
- **لا full regression ولا البوابات الست النهائية ولا تحقق نهائي شامل للوثائق على migration16.** آخر full أخضر هو15 فقط.
- متصفح16 الأول: **2 FAIL** قبل الوصول إلى تبويب الموقف المالي. trace: `Cannot read properties of undefined (reading 'find')` من عرض علاقة `property.property_owners`، لأن fake backend لم يُرجع nested relation التي يتوقعها الدوسيه.
- عُدل harness لتزويد properties بعلاقة `property_owners` من SQL فعلي، وunits/contracts/invoices بتمثيل Postgres JSON.
- محاولة ما بعد التصحيح **أُوقفت**: السجل المحفوظ يظهر فشل desktop بعد2m؛ لا نتيجة نهائية مؤكدة للمجموعة/mobile، ولا تشخيص نهائي لهذا الفشل. لا تعتبر التصحيح مثبتاً ولا تضع null fallback في الإنتاج لإخفاء fixture غير صحيح.
- لا تغييرات auth إنتاجية أو ترحيل hosted أو إصلاح بيانات إنتاجية.

## 6. المتبقي — قائمة موحدة للاستئناف المصرح به فقط

### أ. إكمال16 قبل البناء فوقه
- تشخيص المتصفح الفاشل من trace/DOM/network؛ إثبات وصول واجهة المالك إلى حقول النقد، ثم عرض incomplete evidence بعد إضافة fixture تاريخي ناقص.
- التحقق من printable/professional report وتغير labels والصفوف دون حذف ميزات؛ لا احتساب lifetime مقابل period كمعادلة واحدة.
- إعادة focused/type/full/gates/contracts/build/PWA/browser بعد آخر تعديل، ثم diff/commit/push/remote verification. لا تنسب full15 إلى16.
- تدقيق الاستدعاءات والfixtures الأخرى التي تستخدم `rpt_owner_financial_position` مع contract النقد الجديد؛ backend قديم بلا الحقول يجب ألا يتحول إلى أصفار.

### ب. سلطة كشف المالك والوثائق — ما زالت مفتوحة
- `rpt_owner_statement` في baseline ما زال يحوي settlement_rows مبنية على `s.date` و`s.amount`، لا على دليل النقد الأصلي؛ مسار الدفع الحديث يستخدم paid_at/net/offset. هذا **فحص مصدر، وليس إصلاحاً مثبتاً**.
- راجع `_owner_statement_expenses`، الاستقطاعات الآلية القديمة، تخصيص الملكية التاريخية، fees/tax، offset/recovery، وحركات الدفع. لا تفترض أن إصلاح summary النقد أصلح جدول الحركات/الكشف كله.
- استكمال opening/closing/running balance وحقيقة historical cutoff من مصدر معتمد؛ القالب الحالي يعلن DATA AUTHORITY GAP ولا يختلقها.
- تجنب حساب paid cash من net−current offset للتاريخ، أو تغيير إجماليات التقرير لإخفاء فروق1300/2000.

### ج. التبني/المعالجة التاريخية
- تبنٍّ تاريخي محكوم للـ OWNER expenses وتوزيعها وأدلة الاتفاقية/نسختها؛ فك حظر تسويات legacy-netted القديمة بعد مراجعة صحيحة فقط.
- معالجة أحداث صرف owner-funds القديمة بالقيمة الإجمالية بدلاً من residual، والعينات السالبة القديمة؛ append-only/compensating events، لا إعادة كتابة الأصل.
- workflow لتعديل ما بعد الدفع؛ منع عكس المقاصة بعد الدفع في13 ليس بديلاً عن workflow تصحيح قانوني.
- واجهات adjustment/recovery/offset وإظهار أثر adjustment/reversal في المصروف الأصلي. أوامر SQL المثبتة ليست إثباتاً لواجهة إدارة هذه العمليات.
- لا يعيد الإصلاح فتح S09 approved-before12 compatibility أو pagination الاتفاقيات؛ هذان أُنجزا. S08/S09 classification approval وحده لا يمنح حق allocation/offset/adoption.

### د. بقية التدقيق المالي/المصادر
- متابعة balances/cache/rebuild، تواريخ الأحداث مقابل تاريخ الترحيل واليوم المحلي، reconciliation ومصادر التقارير، حدود pagination والقراءة والأخطاء والـ retry.
- مراجعات S08 snapshot لغير المصروفات، S09 dating/validation للأنواع الأخرى، وتجميع legacy compatibility events عند تكرار تعديلات بنفس اليوم: لا تعتبرها محسومة من نجاح اختبارات المصروفات.
- مراجعة grants الأقل صلاحية، ومنها REFERENCES/TRIGGER المتبقية؛ DML المباشر للتسويات حُظر بالفعل باختبار الحالة النهائية.
- مراجعة تراكب SDK retries مع query retries والاحتفاظ بتصنيف الأخطاء؛ تحقق من الكود الأحدث قبل إعادة فتح بند قديم حُسم لاحقاً.

### هـ. خلل bootstrap المتقطع
- ظهر قبل14 عند full-page navigation، وعادةً قبل company-members request الأخير. موضع العرض: `use-company.tsx`؛ listeners المفحوصة في `use-auth.tsx` وonboarding متزامنة.
- فرضية async auth callback deadlock **غير مثبتة**. لا إعادة كتابة auth بالتخمين، لا bypass للـ Web Locks، لا إطالة assertions لمجرد الأخضر.
- نجاح browser15 الأخير ليس إثبات حل جذري. فشل dossier16 له trace مختلف مرتبط بعلاقة fixture، فلا تخلط السببين.

### و. التدقيق النهائي الشامل — لم يبدأ كإقفال نهائي

بعد إغلاق العمل المالي فعلاً: business logic، financial correctness، historical integrity، permissions/auth، عزل company/property/owner/tenant، RLS، reports، data-access boundaries، UI/UX responsive/RTL/accessibility، PWA/offline/cache privacy، migrations، security/secrets، dead code/dependencies، regression coverage، والـ deployment/scale/device gaps في سجلات التغطية. لا إعلان اكتمال التطبيق قبل حسم المخزون أو إثبات ما يمنعه.

### ز. المعطلات الخارجية

لا بيئة hosted/QA معتمدة لاختبار JWT/GoTrue/PostgREST/RLS/Storage/Edge parity والمنافسة متعددة الجلسات وبيانات الترحيل الفعلية. الاختبارات هنا SQL محلي فعلي مع auth وقراءات جانبية mock في المتصفح؛ ليست إثباتاً hosted. نقص hosted لا يبرر تعطيل بقية عمل المستودع عند الاستئناف. لا تغييرات إنتاج.

## 7. المراجع والأدلة المحمولة داخل الريبو

- `RECONSTRUCTION_INVENTORY.md`: التسلسل الحي الكامل، وآخر تفاصيل14/15. بعض الأقسام القديمة تسجل ما كان مفتوحاً آنذاك ثم أصلحته12/13؛ اقرأ زمنياً ولا تعيد العمل المنجز.
- `RECONSTRUCTION_COVERAGE.md` وأدلة execution ذات الصلة، و`../source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`.
- الأدلة المنسوخة عند التوقف: `evidence/session-stop-20260909/`؛ تضم full14/15، browser15، gates/contracts15، focused/types/build16، وفشل المتصفح16 والسجل الجزئي للمحاولة الأخيرة. لا توجد نتيجة متصفح16 ناجحة في هذه الأدلة.
- أدلة مساحة العمل الأصلية الأوسع: `/home/user/validation/offset-safety/` وما سبقه من `owner-expense/`, `expense-correction/`, `expenses/`, `historical/`. ملفات التشغيل/cache/build والبنائيات ليست تغييرات مصدر مطلوباً إدخالها للمستودع.
- `/home/user/RECONSTRUCTION_SESSION.md` ملاحظات مساعدة قديمة نسبياً؛ **هذه الوثيقة وحالة git وسجل التنفيذ أحدث منها عند التوقف**.

## 8. إعادة إعداد البيئة لاحقاً إن طلب المستخدم الاستئناف

Node20.20.2 وpnpm10.11.1. الاعتماديات/المتصفح قد لا تبقى بعد استعادة workspace. شغّل frozen-lockfile install فقط عند الاستئناف المصرح. scripts التي تستدعي `pnpm` تحتاج PATH صحيحاً؛ استخدم corepack shim في `/home/user/.local/bin` عند الحاجة.

الذاكرة نحو2GB: Vitest عامل واحد مع `--max-old-space-size=512 --max-semi-space-size=8`؛ TypeScript احتاج1536MB؛ البناء نجح مع `GOMAXPROCS=2 MALLOC_ARENA_MAX=2` وheap1024/semi8. أوقف preview أثناء الفحوص الثقيلة. IPC_CHANNEL_CLOSED/exit137/heap OOM كانت إخفاقات موارد، لا نجاحات اختبارات. Playwright احتاج Chromium وinstall-deps بعد الاستعادة.

**الحالة النهائية: توقف بطلب المستخدم، حفظ وتسليم فقط. العمل المالي والتطبيق غير معلنين مكتملين.**
