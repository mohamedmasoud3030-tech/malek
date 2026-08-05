# MALEK — سجل المراجعة المستقلة للمراحل العشر

> **محمي:** الوكيل ممنوع من تعديل هذا الملف أو تعليم أي مربع.
>
> تعليم `[x]` يعني أن المراجع فحص الكود والـEvidence بنفسه، ولم يعتمد على وصف الوكيل فقط.

## بروتوكول المراجعة

قبل تعليم أي بند، يجب على المراجع:

1. جلب PR وDiff والـSHA الحالي مباشرة من GitHub.
2. التأكد أن الفرع بدأ من أحدث `main` ولم يخلط مرحلة أخرى.
3. فتح الملفات الفعلية وMigration/RPC/RLS/Frontend المتأثرة.
4. تشغيل أو فحص نتائج الاختبارات المطلوبة بالاسم، لا قبول عبارة «كل الاختبارات نجحت».
5. مراجعة العزل، الصلاحيات، الذرية، Idempotency، 3dp، التوازن، والـRollback عند انطباقها.
6. مقارنة التنفيذ بـADR 0011 وسجل القرارات، لا بالكود القديم.
7. رفض البند إذا كان Evidence ناقصًا أو غير قابل لإعادة التشغيل.
8. كتابة رابط Evidence أو ملاحظة المراجعة بجانب البند عند تعليمه.
9. عدم تعليم مرحلة كاملة قبل دمج PR والتحقق من `main`.
10. لا يجوز للوكيل أو CI اعتبار نفسه Reviewer.

---

## S01 — Baseline, governance and workspace cleanup

- [x] **S01-T01** — Reviewed: branch base verified at main `0b4756df6b36223c40e511c5c7914bcfd7a20553`.
- [x] **S01-T02** — Reviewed: PR #1342 and #1343 closed; zero open PRs verified after #1345 merge.
- [x] **S01-T03** — Reviewed: PR #1344 merged; checksum/CODEOWNERS/canonical guard present on main.
- [x] **S01-T04** — Reviewed: ADR 0011 and `final-decision-register.json` close D01–D18 with `blocked_decisions=0` and `provisional_decisions=0`.
- [x] **S01-T05** — Reviewed: 10-stage plan contains exactly 10 stages and 98 unique task IDs; Agent and Reviewer ledgers have exact parity; Execution Plan Guard succeeded.
- [x] **S01-T06** — Reviewed: stale `business/domain-contract-foundation` is explicitly superseded and forbidden in plan, checklist, status and PR #1345.
- [x] **S01-T07** — Reviewed: Canonical Business Rules Guard, Execution Plan Guard, CI / Typecheck-Lint-Build, SonarCloud, Browser Readiness and Release Blocker Gate all succeeded for head `b741328385569ff7927e1ee5f26a0f5fbf057689`.
- [x] **S01-T08** — Reviewed: PR #1345 merged as `ae645d15e3cdcdf0310e694941f72b7fcd1b5eb7`; post-merge reads verified protected files on `main`; zero open PRs confirmed.

---

## S02 — Tenant isolation, settlement integrity and safe operational imports

- [ ] **S02-T01** — Evidence/notes: ______________________________
- [ ] **S02-T02** — Evidence/notes: ______________________________
- [ ] **S02-T03** — Evidence/notes: ______________________________
- [ ] **S02-T04** — Evidence/notes: ______________________________
- [ ] **S02-T05** — Evidence/notes: ______________________________
- [ ] **S02-T06** — Evidence/notes: ______________________________
- [ ] **S02-T07** — Evidence/notes: ______________________________
- [ ] **S02-T08** — Evidence/notes: ______________________________
- [ ] **S02-T09** — Evidence/notes: ______________________________
- [ ] **S02-T10** — Evidence/notes: ______________________________

---

## S03 — Canonical GL, chart of accounts and accounting periods

- [ ] **S03-T01** — Evidence/notes: ______________________________
- [ ] **S03-T02** — Evidence/notes: ______________________________
- [ ] **S03-T03** — Evidence/notes: ______________________________
- [ ] **S03-T04** — Evidence/notes: ______________________________
- [ ] **S03-T05** — Evidence/notes: ______________________________
- [ ] **S03-T06** — Evidence/notes: ______________________________
- [ ] **S03-T07** — Evidence/notes: ______________________________
- [ ] **S03-T08** — Evidence/notes: ______________________________
- [ ] **S03-T09** — Evidence/notes: ______________________________
- [ ] **S03-T10** — Evidence/notes: ______________________________

---

## S04 — Owner-agency contracts, billing, collections and settlements

- [ ] **S04-T01** — Evidence/notes: ______________________________
- [ ] **S04-T02** — Evidence/notes: ______________________________
- [ ] **S04-T03** — Evidence/notes: ______________________________
- [ ] **S04-T04** — Evidence/notes: ______________________________
- [ ] **S04-T05** — Evidence/notes: ______________________________
- [ ] **S04-T06** — Evidence/notes: ______________________________
- [ ] **S04-T07** — Evidence/notes: ______________________________
- [ ] **S04-T08** — Evidence/notes: ______________________________
- [ ] **S04-T09** — Evidence/notes: ______________________________
- [ ] **S04-T10** — Evidence/notes: ______________________________

---

## S05 — Expenses, deposits, fees, tax, termination and refunds

- [ ] **S05-T01** — Evidence/notes: ______________________________
- [ ] **S05-T02** — Evidence/notes: ______________________________
- [ ] **S05-T03** — Evidence/notes: ______________________________
- [ ] **S05-T04** — Evidence/notes: ______________________________
- [ ] **S05-T05** — Evidence/notes: ______________________________
- [ ] **S05-T06** — Evidence/notes: ______________________________
- [ ] **S05-T07** — Evidence/notes: ______________________________
- [ ] **S05-T08** — Evidence/notes: ______________________________
- [ ] **S05-T09** — Evidence/notes: ______________________________
- [ ] **S05-T10** — Evidence/notes: ______________________________

---

## S06 — Independent master-lease accounting module

- [ ] **S06-T01** — Evidence/notes: ______________________________
- [ ] **S06-T02** — Evidence/notes: ______________________________
- [ ] **S06-T03** — Evidence/notes: ______________________________
- [ ] **S06-T04** — Evidence/notes: ______________________________
- [ ] **S06-T05** — Evidence/notes: ______________________________
- [ ] **S06-T06** — Evidence/notes: ______________________________
- [ ] **S06-T07** — Evidence/notes: ______________________________
- [ ] **S06-T08** — Evidence/notes: ______________________________
- [ ] **S06-T09** — Evidence/notes: ______________________________
- [ ] **S06-T10** — Evidence/notes: ______________________________

---

## S07 — Financial reports, subledger reconciliation and close controls

- [ ] **S07-T01** — Evidence/notes: ______________________________
- [ ] **S07-T02** — Evidence/notes: ______________________________
- [ ] **S07-T03** — Evidence/notes: ______________________________
- [ ] **S07-T04** — Evidence/notes: ______________________________
- [ ] **S07-T05** — Evidence/notes: ______________________________
- [ ] **S07-T06** — Evidence/notes: ______________________________
- [ ] **S07-T07** — Evidence/notes: ______________________________
- [ ] **S07-T08** — Evidence/notes: ______________________________
- [ ] **S07-T09** — Evidence/notes: ______________________________
- [ ] **S07-T10** — Evidence/notes: ______________________________

---

## S08 — Read-only historical analysis

- [ ] **S08-T01** — Evidence/notes: ______________________________
- [ ] **S08-T02** — Evidence/notes: ______________________________
- [ ] **S08-T03** — Evidence/notes: ______________________________
- [ ] **S08-T04** — Evidence/notes: ______________________________
- [ ] **S08-T05** — Evidence/notes: ______________________________
- [ ] **S08-T06** — Evidence/notes: ______________________________
- [ ] **S08-T07** — Evidence/notes: ______________________________
- [ ] **S08-T08** — Evidence/notes: ______________________________
- [ ] **S08-T09** — Evidence/notes: ______________________________
- [ ] **S08-T10** — Evidence/notes: ______________________________

---

## S09 — Append-only historical correction

- [ ] **S09-T01** — Evidence/notes: ______________________________
- [ ] **S09-T02** — Evidence/notes: ______________________________
- [ ] **S09-T03** — Evidence/notes: ______________________________
- [ ] **S09-T04** — Evidence/notes: ______________________________
- [ ] **S09-T05** — Evidence/notes: ______________________________
- [ ] **S09-T06** — Evidence/notes: ______________________________
- [ ] **S09-T07** — Evidence/notes: ______________________________
- [ ] **S09-T08** — Evidence/notes: ______________________________
- [ ] **S09-T09** — Evidence/notes: ______________________________
- [ ] **S09-T10** — Evidence/notes: ______________________________

---

## S10 — Test, pilot, deployment and controlled release

- [ ] **S10-T01** — Evidence/notes: ______________________________
- [ ] **S10-T02** — Evidence/notes: ______________________________
- [ ] **S10-T03** — Evidence/notes: ______________________________
- [ ] **S10-T04** — Evidence/notes: ______________________________
- [ ] **S10-T05** — Evidence/notes: ______________________________
- [ ] **S10-T06** — Evidence/notes: ______________________________
- [ ] **S10-T07** — Evidence/notes: ______________________________
- [ ] **S10-T08** — Evidence/notes: ______________________________
- [ ] **S10-T09** — Evidence/notes: ______________________________
- [ ] **S10-T10** — Evidence/notes: ______________________________

## إغلاق المرحلة

لا تتغير حالة المرحلة إلى `COMPLETE` إلا عندما تكون جميع مربعاتها هنا `[x]`، وجميع مربعات الوكيل `[x]`، وPR مدمج، و`main` أخضر.
