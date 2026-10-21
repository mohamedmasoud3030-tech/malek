# دليل الأدلة المستضافة — تشغيل واحد يغلق 12 فجوة

> **الحالة:** `READY_TO_EXECUTE` — لم يُنفَّذ بعد لعدم توفر بيانات اعتماد QA.
> **التاريخ:** 2026-10-21 · **الأساس:** `main@d64703003c84`
> **الغرض:** تحويل «نحتاج بيئة QA» من طلب مفتوح إلى **مهمة تنفيذ محددة** تُنجَز في جلسة واحدة.

---

## 1. لماذا هذا الملف

14 فجوة أُثبتت على محرّك PostgreSQL حقيقي محليًا (`pnpm evidence:live`)، لكنها ما زالت تحتاج دليلًا
من بيئة مستضافة: خدمة Auth، وPostgREST، وStorage، وتهيئة منشورة ببصمة SHA محددة.

هذا الدليل يحوّل ذلك إلى خطوات قابلة للتنفيذ. **لا يمكن لوكيل في بيئة بلا بيانات اعتماد أن ينفّذها**،
ولن يدّعي أنه نفّذها.

---

## 2. المتطلبات (لا تُشارَك في المحادثة)

```bash
# بيئة QA — مشروع Supabase منفصل تمامًا عن الإنتاج
QA_ENVIRONMENT_KIND=qa
QA_SUPABASE_PROJECT_REF=<QA ref>
PRODUCTION_SUPABASE_PROJECT_REF=<prod ref>   # للمقارنة فقط؛ الرفض التلقائي إن تطابقا
VITE_SUPABASE_URL=https://<QA ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
QA_ADMIN_EMAIL=<مستخدم QA مُهيّأ>
QA_ADMIN_PASSWORD=<كلمة مرور>
```

> **قاعدة صارمة:** لا يُستخدم `service_role` في أي خطوة من خطوات القبول. المفتاح العام (anon) +
> مستخدم QA مُهيّأ يكفيان. أي خطوة تتطلب `service_role` تُنفَّذ من جهاز المشغّل، لا من وكيل.

---

## 3. التسلسل (بالترتيب — لا تُقفز خطوة)

### الخطوة 1 — إثبات الهوية قبل أي شيء

```bash
corepack pnpm qa:preflight
```

يرفض المشروع إن كان `QA_ENVIRONMENT_KIND != qa`، أو إن تطابق مرجع QA مع الإنتاج، أو إن لم يطابق
`VITE_SUPABASE_URL` مرجع المشروع. **إن فشل هنا: توقف.** لا معنى لأي دليل بعده.

### الخطوة 2 — عقود قاعدة البيانات

```bash
corepack pnpm qa:database-contracts
```

يكشف انحراف المخطط/RPC/RLS بين المستودع والبيئة المستضافة. أي انحراف = توقف.

### الخطوة 3 — دورة حياة مالية معزولة (بيانات QA قابلة للتلف)

```bash
QA_MUTATION_APPROVED=1 E2E_ENVIRONMENT_KIND=qa corepack pnpm qa:lifecycle
```

يتطلب موافقة صريحة لأنه **يكتب** في QA. يشغّل ملف التدخين المعزول لمكتب واحد ثم يتحقق.

### الخطوة 4 — القبول في المتصفح (هذه هي GAP-020)

```bash
corepack pnpm e2e:install         # مرة واحدة على جهاز به متصفح
corepack pnpm e2e                 # سطح مكتب/تابلت/هاتف
```

**مهم:** مهمة CI المتخطاة ليست `PASS`. إن ظهرت `skipping` فلا دليل.

### الخطوة 5 — إثبات هوية النشر

```bash
corepack pnpm --filter ./malek-app run verify:deployment-identity -- \
  --origin https://<QA host> \
  --expected-sha $(git rev-parse HEAD)
```

يقارن `build-proof.json` المنشور مع SHA المتوقع. هذا هو ما يغلق `GAP-021` جزئيًا.

---

## 4. خريطة الفجوات → الخطوة التي تغلقها

| الفجوة | تحتاج | الخطوة |
| --- | --- | --- |
| GAP-001 | ترحيل الأدوار الحي + JWT/RLS | 1، 2، 3 |
| GAP-003 | سلبيات شركتين على البيئة | 2، 3 |
| GAP-006–011 | دورة حياة مالية على بيانات QA | 3 |
| GAP-013/014 | مصالحة وقوائم مالية على بيانات حقيقية | 2، 3 |
| GAP-017 | رحلة استيراد كشف بنكي معتمد | 3 |
| GAP-018 | منح/RLS المنشورة | 2 |
| GAP-020 | قبول متصفح موثّق | 4 |
| GAP-021 | تهيئة/أسرار/هوك/استعادة عند SHA | 1، 5 |

---

## 5. ما يجب حفظه كدليل

لكل خطوة: الأمر، والمخرج الكامل، وSHA، والتاريخ. يُحفظ في `docs/evidence/hosted-<date>/`.

**لا يُقبل** «نجح» بلا مخرج. ولا تُستخدم نتيجة من SHA آخر.

---

## 6. إن لم تتوفر البيئة

البديل الصادق: يبقى البيان «مُثبت محليًا، غير مُثبت مستضافًا». هذا مسجّل في
[`docs/evidence/live-evidence.md`](../evidence/live-evidence.md) لكل فجوة على حدة، مع تحديد الجهة
التي تملك الدليل الناقص.

---

## 7. المراجع

- `scripts/agent-qa-preflight.mjs` — يرفض أي بيئة غير QA.
- `scripts/run-agent-qa-lifecycle.sh` — يتطلب `QA_MUTATION_APPROVED=1`.
- `malek-app/scripts/verify-deployment-identity.mjs` — يرفض بدون `--expected-sha` كامل.
- `docs/SEEDED_STAGING_READINESS_RUNBOOK.md` — التهيئة والبذور.
- `docs/RELEASE_EVIDENCE_LEDGER.md` — حالات الدليل المقبولة.
