# MALEK — الحالة التنفيذية الرسمية للمراحل العشر

> **Snapshot base:** `main@ae645d15e3cdcdf0310e694941f72b7fcd1b5eb7`  
> **Decision state:** `0 BLOCKED / 0 PROVISIONAL`  
> **الخطة:** `governance/10-stage-master-plan.json`  
> **تنفيذ الوكيل:** `docs/execution/10_STAGE_AGENT_CHECKLIST_AR.md`  
> **المراجعة:** `docs/execution/10_STAGE_REVIEW_LEDGER_AR.md`

## قاعدة قراءة الحالة

- `COMPLETE`: كل بنود Agent وReviewer مكتملة، PR مدمج، وmain أخضر.
- `IN_PROGRESS`: المرحلة الحالية لها عمل جارٍ على فرع واحد.
- `PARTIAL`: يوجد تنفيذ قديم أو أجزاء مفيدة، لكن لم تُراجع بعد وفق القواعد النهائية، ولذلك لا تُحسب مكتملة.
- `NOT_STARTED`: لا يوجد تنفيذ معتمد وفق الخطة الجديدة.

وجود جدول أو RPC أو صفحة قديمة لا يعطي Credit تلقائيًا. الوكيل يجب أن يفحصها ويثبت توافقها، ثم المراجع يتحقق مستقلًا.

## ملخص الحالة

| المرحلة | الحالة | Agent | Reviewer | ما تم فعليًا | المتبقي الحاسم |
|---|---|---:|---:|---|---|
| S01 — الأساس والحوكمة وتنظيف مساحة العمل | COMPLETE | 8/8 | 8/8 | #1342 و#1343 أُغلقا، #1344 و#1345 دُمجا، القرارات D01–D18 نهائية، الخطة والدفتران والحارسان موجودة على main وكل بوابات #1345 خضراء | لا شيء؛ المرحلة مغلقة |
| S02 — العزل وسلامة التسويات والاستيراد | PARTIAL | 0/10 | 0/10 | توجد طبقات RLS/RPC وعملية استيراد قديمة | فحص كل SECURITY DEFINER، إصلاح اتفاقيات الملاك، حجز عناصر التسوية، RPC-only، وإصلاح CSV fail-closed |
| S03 — GL ودليل الحسابات والفترات | PARTIAL | 0/10 | 0/10 | توجد نواة GL وقرارات/بعض اختبارات سابقة | Gap matrix، company-scoped accounts، immutable posting، 0.001، periods، late posting وidempotency |
| S04 — إدارة أملاك الغير | NOT_STARTED | 0/10 | 0/10 | توجد عقود وفواتير وتسويات Legacy | اتفاقيات versioned، lifecycle، signatures، schedule frozen، OWNER/OFFICE creditor postings والأتعاب الصحيحة |
| S05 — المصروفات والتأمين والرسوم والضريبة والاسترداد | PARTIAL | 0/10 | 0/10 | توجد صفحات وخدمات لبعض المصروفات والتأمين والعمولات | مسارات قيد موحدة، مستفيد التأمين، VAT configurable، late fees، termination، credit notes/refunds |
| S06 — Master Lease | NOT_STARTED | 0/10 | 0/10 | توجد تسمية تشغيلية فقط، لا وحدة محاسبية كاملة | Head lease، ROU، liability schedule، depreciation، remeasurement، modifications، short-term election |
| S07 — التقارير والمصالحات والإقفال | PARTIAL | 0/10 | 0/10 | توجد تقارير تشغيلية ومالية متفرقة | GL statements، control reconciliations، cash-flow completeness، close blocking، truthful bank statuses |
| S08 — تحليل التاريخ | NOT_STARTED | 0/10 | 0/10 | لا يوجد تقرير تحليل معتمد ومجمّد | Read-only inventory لكل الفروق والازدواجيات والاتفاقيات والتأمين وMaster Lease |
| S09 — التصحيح التاريخي | NOT_STARTED | 0/10 | 0/10 | ممنوع البدء قبل S08 | Correction batches append-only مع before/after واعتماد وعكس |
| S10 — الاختبارات والPilot والإطلاق | NOT_STARTED | 0/10 | 0/10 | توجد بنية CI واختبارات كثيرة، لكنها ليست دليل إكمال الخطة | Acceptance matrix، live gates، إزالة استثناءات التغطية الواسعة، pilot دورة كاملة، sign-off وإطلاق تدريجي |

## ما أُغلق كقرار نهائي

- Invoice/receivable حسب `collection_role`.
- RATE على التحصيل وFIXED_MONTHLY يوميًا.
- Brokerage/Renewal/Setup recognition.
- Owner expense وOffset order.
- Deposit beneficiary/application/reversal.
- Monthly periods وHard Close غير قابل لإعادة الفتح.
- Master Lease measurement/modification/short-term election.
- Tax Profile/Tax Codes بلا hard-coded rate.
- Late fees بلا compounding وبحد أقصى.
- Early termination وسجل الإنهاء وعدم حذف الجدول.
- Maker–Checker والتوقيع قبل التفعيل.
- Onboarding templates وإعفاءات Admin الموثقة.
- Agreement/contract versioning.
- Settlement reservations/refunds.
- Credit notes/void/refund.
- Bank CSV fail-closed.
- Historical append-only correction.
- Agent/Reviewer separation.

## الفجوات المكتشفة التي لم تُنسَ

1. `update_owner_agreement_atomic` يحتاج عزل شركة وقفل صف ومنع تغيير owner.
2. عناصر التحصيل والمصروف يمكن أن تتكرر في أكثر من تسوية دون روابط حجز ذرية.
3. بعض الكتابات المالية الحساسة يجب إغلاقها خلف RPC فقط.
4. Bank CSV على main لا يثبت حتى الآن fail-closed/counts/limits/3dp بصورة كافية؛ إصلاح فرع #1343 لم يُدمج وسيعاد من main.
5. مصروفات الصيانة/المالك/المستأجر تحتاج مسار تخصيص واضح ودعم Backend حقيقي قبل أي UI يدعي split.
6. Master Lease غير مكتمل محاسبيًا.
7. استخدام التأمين ومسارات العكس تحتاج قيودًا واختبارات كاملة.
8. تغطية Sonar الواسعة المستثناة (`**/*.ts`, `**/*.tsx`) يجب إزالتها أو تضييقها في S10 وإثبات Coverage حقيقية.
9. لا يجوز استخدام أرقام اختبارات أو Advisor قديمة كدليل حالي؛ Evidence دائمًا مرتبط بالـSHA الحالي.
10. الفرع `business/domain-contract-foundation` ملغى كمصدر تنفيذ؛ ممنوع دمجه أو cherry-pick منه.

## المرحلة التالية

تبدأ **S02 فقط** من أحدث `main`. لا يبدأ S03 بالتوازي، ولا تُنقل Migration من الفرع التجريبي.

## ممنوعات الوكيل

- ممنوع تغيير القرارات بحجة أن الكود القديم مختلف.
- ممنوع تعليم Reviewer Ledger.
- ممنوع كتابة «تم» دون Evidence.
- ممنوع دمج مرحلة أخرى أو إصلاح غير معلن.
- ممنوع استخدام نتائج CI من SHA مختلف.
- ممنوع حذف التاريخ المالي أو تعديل Migration قديمة.
