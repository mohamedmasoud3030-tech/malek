# MALEK — Product UX Roadmap

> **تنفيذ غير حاكم:** هذه الخطة ترتب العمل ولا تستبدل Gap Register أو Work Packages canonical. لا تمنح Stage Credit.

## مبدأ الترتيب

الترتيب حسب: منع الضرر → أول قيمة → إغلاق رحلة المجال → إثبات live → تحسين الكفاءة → polish. لا يبدأ expansion قبل pilot.

## Milestone 0 — Safe UX truthfulness (نُفذ في هذه المراجعة)

### M0.1 أول قيمة في أعلى Today

- **قرار:** onboarding قبل queues/KPIs للـAdmin/Manager غير المكتمل.
- **Acceptance:** يظهر بعد hero/error وقبل `work-now`؛ لا يظهر لمستخدم بلا سلطة؛ يحافظ على backend requirements.
- **الحالة:** IMPLEMENTED + focused tests PASS.

### M0.2 Network/offline honesty

- **قرار:** ربط global shell بأحداث browser network، مع banner مرئي على الهاتف وسطح المكتب.
- **Acceptance:** `offline` يحدّث store ويظهر `role=status`; `online` يعيد network state؛ copy لا تدعي حفظاً أو sync.
- **الحالة:** IMPLEMENTED + focused tests PASS.

### M0.3 Onboarding resilience/copy

- **قرار:** منع `NaN`, تسمية النتيجة “أول عملية إيجار”، وتوضيح التأجيل/الإكمال.
- **Acceptance:** optional-only catalog = 100%; لا `NaN`; labels عربية واضحة.
- **الحالة:** IMPLEMENTED + focused tests PASS.

## Milestone 1 — Access & recovery (نُفذ في repository؛ hosted proof متبقٍ)

### M1.1 Password recovery — P0

**الرحلة:**
`نسيت كلمة المرور؟ → أدخل البريد → رسالة محايدة → رابط محدود العمر → كلمة جديدة → نجاح → login`

**Acceptance:**

- لا يكشف هل البريد مسجل.
- email field يدعم password managers/copy-paste.
- expired/used/invalid links لها حالات واضحة وإعادة طلب.
- كلمة المرور لا تُسجل في logs؛ submit idempotent؛ rate limiting من provider.
- redirect URLs مضبوطة للpreview/QA/production.
- keyboard-only, 375px RTL, screen-reader labels, session-expiry pass.
- hosted QA evidence على exact SHA.

**الحالة:** IMPLEMENTED في repository: login link، neutral request state، public reset callback، invalid/expired state، new-password validation وsign-out بعد النجاح. المتبقي hosted email delivery وredirect allowlist proof.

### M1.2 Unified auth recovery copy

- session expired، invalid credentials، network error، email delivery delayed.
- لا رسائل تقنية ولا account enumeration.

## Milestone 2 — Evidence & compliance journey (نُفذ في repository بعد موافقة المالك)

### M2.1 Contract registration evidence — repository COMPLETE / legal activation PENDING

المواصفة في `PRODUCT_DECISIONS.md/PD-09`.

**Acceptance:**

- requirement effective-dated/configurable؛ لا fee/deadline hard-coded.
- status/evidence منفصلان عن contract lifecycle.
- cross-company/RLS/maker-checker/audit/idempotency tests.
- Today queue + contract dossier + document wording متطابقة.
- migration forward-safe + rollback/mitigation.
- legal approval للنسخة الفعلية قبل enabled.

**المنفذ:** profile فارغ افتراضياً، NOT_CONFIGURED UI، submission، distinct verification، evidence document، events، company isolation.

### M2.2 Move-in/move-out inspection — repository COMPLETE / browser-runtime PENDING

المواصفة في `PD-10`.

**Acceptance:**

- template/version، meters، keys، condition، photos، signatures.
- signed record immutable.
- deposit deduction references evidence.
- الهاتف يدعم camera/files/failure/retry بدون فقد draft.
- no legal wording claim before template approval.

**المنفذ:** system checklist templates، draft/complete/review/change-request، meters/keys/docs/signatures، وربط DAMAGE claim بفحص MOVE_OUT مراجع.

## Milestone 3 — Exact environment acceptance

### M3.1 Hosted browser matrix

- Roles: ADMIN, MANAGER, ACCOUNTANT, OPERATIONS, USER, VIEWER.
- Widths: 375/390, 768, 1024, 1440.
- RTL/light/dark, 200% zoom، keyboard، focus، reduced motion.
- States: empty/loading/stale/error/offline/session expired/permission denied.
- Journeys: setup, contract, collection, deposit, settlement, maintenance, bank import, reports/PDF.

**Exit:** لا console/network errors غير مفسرة، لا overflow، كل task critical له positive + negative proof.

### M3.2 Assistive technology manual pass

- headings/landmarks، form errors، dialogs، tables/cards، live regions، focus return.
- NVDA/Chrome أو VoiceOver/Safari وفق الأجهزة المتاحة.
- WCAG 2.2 AA-oriented report؛ هذا ليس ادعاء certification قانوني.

## Milestone 4 — Financial pilot and release

- exact deployed SHA/migrations/Auth/RLS/Storage.
- backup + restore rehearsal.
- full office period.
- daily and close reconciliation 1201/2000/1300/2200/2300 + bank.
- accountant/legal/pilot owner sign-offs.
- progressive release + rollback/incident runbook.

## Milestone 5 — Efficiency after pilot

يبدأ فقط من telemetry/interviews، لا من الذوق:

- قياس time-to-first-draft، collection posting time، maintenance assignment time، reconciliation exceptions، support contacts.
- تقليل خطوات متكررة مثبتة بالبيانات.
- تحسين mobile action density في maintenance إن أثبت الاختبار mis-taps/slow completion.
- saved views/bulk actions فقط إذا تكررت مهمة حقيقية ولم تضعف audit.

## Backlog مؤجل عمداً

- Owner portal / Tenant portal.
- MASTER_LEASE UI/reports.
- Automatic WhatsApp/SMS provider.
- Marketplace/listing syndication.
- AI executing actions.
- Broad visual redesign.

هذه ليست “منسية”؛ استبعادها يحمي RC1 من expansion قبل إثبات القلب التشغيلي.

## Verification ledger لهذه المراجعة

| فحص | النتيجة |
|---|---|
| Running Vite app / HTTP | PASS |
| Existing visual evidence desktop/mobile/RTL | INSPECTED |
| Focused AppShell/Dashboard/Onboarding tests | 24/24 PASS |
| Focused Login/Recovery/Route tests | 27/27 PASS |
| Focused Registration/Handover/Contract/Deposit tests | 21/21 PASS |
| Database replay/integrity | 280/280 replay PASS; DB0 gate 7/7 PASS |
| Financial regression suite | 449/449 PASS |
| TypeScript | PASS |
| Browser automation current change | BLOCKED: Chromium CDN download failed |
| Full application tests | 456 files / 2933 tests PASS |
| Typecheck / lint / architecture / production build | PASS |
| Live/production | NOT RUN / not authorized |
