# MALEK — الحالة التنفيذية الرسمية للمراحل العشر

> **Repository reality baseline:** `main@75832b2f139f3b759325dcf17cf78101093671b4`  
> **Governed stage authority:** `governance/10-stage-master-plan.json` + Agent/Reviewer ledgers  
> **Canonical implementation reality:** `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`  
> **قاعدة إلزامية:** وجود كود/SQL/اختبارات لا يمنح Stage Credit تلقائيًا، وغياب Credit لا يعني أن الكود غير موجود.

## لماذا يوجد عمودان للحقيقة؟

المشروع Brownfield. بعض المراحل لديها تنفيذ فعلي سابق أو أحدث من حالة دفاتر الحوكمة، لكن `D18` يمنع الوكيل من منح Reviewer Credit بنفسه. لذلك نعرض:

1. **Governed Credit** — الحالة الرسمية التي يملكها الـmaster plan والـledgers.
2. **Repository Reality** — ما هو موجود فعليًا في `main` عند الـbaseline، دون ادعاء أنه معتمد أو deployed.

هذا الفصل يمنع خطأين سابقين: وصف مرحلة فيها كود بأنها “لم تبدأ إطلاقًا”، أو اعتبار وجود migration/test دليلًا على أن المرحلة “مكتملة”.

## الحالة الحالية

| المرحلة | Governed Credit | Repository Reality عند baseline | ما يلزم قبل الإغلاق الرسمي |
|---|---|---|---|
| S01 — الأساس والحوكمة | COMPLETE | الحوكمة والقرارات والخطة والـguards موجودة | لا شيء جوهري ضمن هذه الحزمة |
| S02 — العزل وسلامة التسويات والاستيراد | PARTIAL | migrations لعزل الشركات وowner-agreement hardening وsettlement reservations/RPCs واختبارات موجودة؛ focused isolation tests نجحت في التدقيق | مراجعة/اعتماد مستقل + live company/Auth/RLS proof + غلق أي sensitive direct-write gaps |
| S03 — GL ودليل الحسابات والفترات | PARTIAL | نواة GL، 18-account provisioning، periods، posting/reversal/idempotency وreceipt wiring موجودة؛ focused Stage-3 tests نجحت | Reviewer credit مستقل + أي release reconciliation/runtime gates المتبقية |
| S04 — إدارة أملاك الغير | NOT_STARTED | **يوجد تنفيذ فعلي**: `20260809010000_s04_property_management_gl_rpcs.sql` واختبارات `src/s4/`؛ لا يعني ذلك اكتمال الرحلة أو Stage Credit | إغلاق owner-agency E2E: fee wiring، contract/agreement lifecycle، due-from-owner/deposits/settlements/reconciliation ثم مراجعة مستقلة |
| S05 — المصروفات والتأمين والرسوم والضريبة والاسترداد | PARTIAL | توجد أجزاء تشغيلية وGL لعدة مسارات | غلق deposit/tax/refund/termination/late-fee matrix وربطها بالمصالحات |
| S06 — Master Lease | NOT_STARTED | **يوجد تنفيذ فعلي**: `20260809020000_s06_master_lease_gl_lifecycle.sql`، pgTAP/integration/unit contract tests؛ لا يوجد دليل كافٍ على E2E/reporting completion | إكمال UI/service/RPC/report/reconciliation + truthful IFRS labeling + Reviewer credit |
| S07 — التقارير والمصالحات والإقفال | PARTIAL | تقارير/Accounting surfaces وGL موجودة جزئيًا؛ الـmaster plan نفسه يسجل PARTIAL | إكمال financial statements، control reconciliations، cash flow، close blocking وcurrent-SHA evidence |
| S08 — تحليل التاريخ | NOT_STARTED | **يوجد تنفيذ فعلي**: `scripts/s08/` و`evidence/s08/` و`src/s08/` tests؛ لكنه لم يحصل على governed approval/frozen analysis credit | مراجعة مستقلة، frozen baseline، approval/sign-off قبل أي S09 writes |
| S09 — التصحيح التاريخي | NOT_STARTED | لا يجوز الاستدلال على التصحيح من وجود S08 code | ممنوع البدء قبل اعتماد S08؛ بعدها append-only scoped corrections فقط |
| S10 — الاختبارات والPilot والإطلاق | NOT_STARTED | بنية CI/QA واختبارات كثيرة موجودة؛ توجد release blockers/baseline failures خارج هذا doc-only branch | hosted QA، zero release blockers، live config/backup proof، one-office pilot، reconciliation، accountant/owner sign-off |

## أدلة Repository Reality المهمة

- S02 owner agreement isolation: `supabase/migrations/20260804000000_fix_owner_agreement_company_isolation.sql` و`supabase/tests/owner_agreement_company_isolation.sql`.
- S02 settlement reservation: `20260804010000_fa003_owner_settlement_input_reservation_foundation.sql` و`20260804010100_fa003_owner_settlement_atomic_reservation_rpcs.sql`.
- S03 GL core: `20260804030000_stage3_gl_core_chart_of_accounts_and_periods.sql`, `20260804030200_stage3_gl_core_posting_engine_and_rpcs.sql`.
- S04 property-management GL: `20260809010000_s04_property_management_gl_rpcs.sql`, `rentrix-app/src/s4/s04-property-management-gl.test.ts`.
- S06 master-lease GL: `20260809020000_s06_master_lease_gl_lifecycle.sql`, `supabase/tests/master_lease_gl_lifecycle.sql`, `rentrix-app/src/s6/`.
- S08 analysis: `scripts/s08/`, `evidence/s08/`, `rentrix-app/src/s08/`.

## نتائج التدقيق المركز المرتبطة بالـbaseline

- 139/139: navigation/permissions + S03 + S04 + S06 + S08 focused suites.
- 38/38: company-isolation and permission-request lifecycle focused suites.
- الإجمالي: **177/177** focused tests passed.
- TypeScript build: passed with pnpm `10.11.1`.
- Production build: passed with pnpm `10.11.1`.

هذه النتائج تخص Repository Reality فقط. لا تعني أن hosted/live environment أو Reviewer ledger تم اعتمادهما.

## ما تم حسمه كقرارات وليس كـStage Credit

`governance/final-decision-register.json` يقفل D01–D18، ومنها:

- receivable حسب `collection_role`؛
- RATE on collection وFIXED_MONTHLY daily accrual؛
- Due from Owner والـoffset rules؛
- deposit liability/application/reversal؛
- periods/late posting؛
- independent Master Lease؛
- configurable tax؛
- Maker-Checker/signatures؛
- agreement/contract versioning؛
- settlement reservations/refunds؛
- credit note/void/refund؛
- fail-closed Bank CSV؛
- read-only analysis before append-only correction؛
- Agent/Reviewer separation.

وجود قرار نهائي يعني أن التنفيذ يجب أن يتبعه؛ لا يعني أن التنفيذ اكتمل.

## الممنوع

- لا يغيّر الوكيل Reviewer Ledger.
- لا يمنح Stage Credit من تلقاء نفسه.
- لا يكتب “NOT_STARTED = no code exists”.
- لا يكتب “migration/test exists = stage COMPLETE”.
- لا يبدأ historical correction/backfill قبل governed S08 approval.
- لا يستخدم نتيجة CI/test من SHA مختلف كدليل حالي دون ذكرها.

للحالة التفصيلية لكل قاعدة وفجوة راجع `docs/source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`، ولخطة الإغلاق راجع `08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`.
