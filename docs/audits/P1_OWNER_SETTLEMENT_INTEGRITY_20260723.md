# P1 — Owner Settlement Integrity: عيوب الأمانة في مبالغ التسوية (Client‑Trusted Amounts)

**Date:** 2026-07-23 · **Branch:** `agent/p1-owner-settlement-integrity` · **Base:** `main@8cd87a1` (P0 squash-merge of #1276)
**Scope decision:** المستخدم اختار **الإصلاح الكامل**: الخادم يشتق كل مبالغ التسوية (يتجاهل القيم القادمة من العميل) + نموذج الواجهة يتحول إلى معاينة قراءة-فقط من مشتقات الخادم.

---

## 1) الثغرة (مُثبتة سلوكيًا في P0، تُعاد صياغتها هنا بدلالات الأرقام)

`create_owner_settlement_draft_atomic(p_payload jsonb)` على main (بعد P0) يقرأ المبالغ من الطلب مباشرة:

| السطر (dاخل `supabase/migrations/20260724120000_p0_company_isolation_reports_rls.sql`) | السلوك |
|---|---|
| `v_gross := coalesce(nullif(p_payload->>'gross_collected','')::numeric,0)` | المحصَّل من العميل |
| `v_fee := coalesce(nullif(p_payload->>'office_fee','')::numeric,0)` | أتعاب المكتب من العميل |
| `v_expenses := coalesce(nullif(p_payload->>'owner_expenses','')::numeric,0)` | مصروفات المالك من العميل |
| `v_tax := coalesce(nullif(p_payload->>'tax_amount','')::numeric,0)` | الضريبة من العميل |
| `v_net := greatest(v_gross - v_fee - v_expenses - v_tax, 0)` | الصافي يُشتق لكن من مكونات مُزوّرة |

الأثر مالي مباشر: `pay_owner_settlement_atomic` يصرف `v_row.net_payable` بقيد يومية متوازن (مالك مستحق/نقدية) — أي أن تزوير المسودة = صرف فعلي. P0 أغلق انتحال المالك/العقار المتقاطع (F-SET) لكنه **تعمدًا لم يمس دلالات المبالغ** (مذكور صراحة في ترويسة هجرة P0).

الواجهة تُثبت أن المدخلات حرة: `OwnerSettlementWorkspace.tsx` حقول `grossCollected/officeFee/ownerExpenses/taxAmount` نصية حرة، وتُرسل كما هي عبر `owner-settlements-service.ts → rpc('create_owner_settlement_draft_atomic')`.

## 2) المرجعيات الرسمية التي بُني عليها الاشتقاق (كل مبلغ له مصدر سياقي موثق)

| المكوّن | المرجع | القاعدة |
|---|---|---|
| المحصَّل gross | `rpt_owner_statement` (صَفّ المدفوعات، بعد P0) + تعليق العمود في `20260716000001` | مدفوعات غير ملغاة (`status<>'VOID'`، `deleted_at is null`) لعقود المالك عبر اتفاقياته في الفترة، بنطاق الشركة؛ فلتر بالعقار عند تمريره. |
| أتعاب RATE | نفس التقرير + ADR 0001 («على أساس المحصَّل النقدي»، «تُعترف عند التحصيل») | لكل دفعة `_r3(amount × rate / 100)` ثم الجمع — مطابقة حرفية للتقرير. |
| أتعاب FIXED_MONTHLY | `20260718113414` («accrual is settlement‑controlled») + `20260718113405` («remain settlement inputs until the product accounting policy defines their accrual timing») + ADR 0001 («الإيقاع الافتراضي شهري») | **P1 تقرر السياسة المؤجلة المذكورة في الكود**: الأتعاب = `commission_value ×` عدد الأشهر التقويمية المُغطاة بالفترة (مقصوصًا بصلاحية الاتفاقية). |
| عقد Master‑lease | ADR 0001 («التزام ثابت على المكتب مستقل عن التحصيل… لا يُلغيه الشغور») + `rentrix-app/src/domain/financial-settlements.ts` (`gross=fixedFee, fees=0, net=fixed−expenses`) | gross = `commission_value × الأشهر` (التحصيلات ملك المكتب ولا تدخل)، fee = 0. |
| مصروفات المالك | `_owner_statement_expenses` (تُضاف لها فلاتر الشركة/العقار) | `status='POSTED'` ∧ `charged_to='OWNER'` ∧ ربط `property_owners` يغطي تاريخ المصروف ∧ داخل الفترة. |
| الضريبة على الأتعاب | تعليق العمود: «Optional separately presented tax/VAT **on the office fee**; zero when tax treatment is disabled» + ADR 0001 («configurable, disabled by default») + `company_settings.vat_enabled/vat_rate` | مفعّلة للشركة ⇒ `_r3(office_fee × vat_rate/100)` وإلا `0`. (جدول singleton؛ يُقرأ فقط إن كان الصف تابعًا لشركة المُنفّذ — العزل أولًا.) |
| الصافي | قيد CHECK `owner_settlements_net_payable_check` | `greatest(gross − fee − expenses − tax, 0)` بدقة. |

قرارا سياسةٍ مؤجلان أُخذا هنا بموجب «النطاق الكامل» المُعتمد وهما **موثقان صراحة داخل الاستعلام** (قابلين للنقض بقرار ADR لاحق فقط، كما تشترط الوثيقة):
1. قاعدة استحقاق الأتعاب الثابتة = الأشهر التقويمية المُغطاة (مقصوصة بصلاحية الاتفاقية).
2. تسوية Master‑lease = أساس الالتزام (وليس أساس التحصيل).

## 3) التغيير

### 3.1 هجرة إضافية `20260725000000_p1_owner_settlement_server_derivation.sql`
- `public.calculate_owner_net_payout(p_owner_id uuid, p_period_start date, p_period_end date, p_property_id uuid default null)`
  → `table(gross_collected, office_fee, owner_expenses, tax_amount, net_payable, breakdown jsonb)`.
  - `security definer` + `set search_path = public, pg_temp` + `revoke public/anon` + `grant authenticated, service_role`.
  - سياق الشركة يُشتق محليًا (`auth.jwt()->app_metadata->>company_id` + رفض فارغ 42501) — الهجرة مكتفية ذاتيًا عبر مراحل إعادة التشغيل، ولا تعتمد على مُساعِد P0 مع أن الدلالة مطابقة.
  - حارس الدور: `is_app_user()` (المعاينة متاحة لكل مستخدم تطبيقي؛ النسخة الكاتبة تُبقي حارس ADMIN/MANAGER).
  - المالك/العقار لزم أن يكونا ضمن شركة المُنفّذ (نفس رسالة F-SET: `not in your company`).
- إعادة كتابة `create_owner_settlement_draft_atomic`: تحذف قراءة مفاتيح المبالغ من الطلب نهائيًا وتستدعي `calculate_owner_net_payout` بعد حُرّاس الدور/F-SET/التكرار/القفل الاستشاري (نفس ترتيب P0 حرفيًا). النتيجة تضيف `'amounts_source','server_derived'`.
- لا DROP، لا حذف بيانات، لا تعديل صفوف قائمة (الالتزام الإضافي فقط مثل P0).

### 3.2 Rollback `supabase/rollback/20260725_rollback_p1_owner_settlement_derivation.sql`
يسقط `calculate_owner_net_payout` ويعيد جسم `create_owner_settlement_draft_atomic` إلى نسخة ما بعد P0 **حرفيًا**. تنبيه موثق: التراجع يعيد السلوك السابق كما هو (وهو السلوك المُصاب) — هذا هو تعريف الـ rollback.

### 3.3 الواجهة
- `owner-settlements-service.ts`: حذف مفاتيح المبالغ من `CreateSettlementDraftPayload` + إضافة `previewOwnerSettlement` عبر RPC الجديد.
- `OwnerSettlementWorkspace.tsx`: حذف الحقول الأربعة الحرة؛ معاينة قراءة-فقط (React Query بمفتاح هدف+فترة) تعرض gross/fee/expenses/tax/net + سطر تفصيل (نوع الاتفاق، الأشهر، VAT). الإرسال يرسل الهويات والفترة والملاحظات فقط.

### 3.4 بوابة pgTAP (`release_lifecycle_rehearsal.sql`) — تطوير مثبّت البيانات
تصنيف الفشل: **(3) مثبّت/هارنس غير مكتمل بالنسبة للسلوك الجديد** — التأكيدة القديمة تُثبّت الوثوق بالعميل (`net=600` من مبالغ مُرسلة). التطوير:
- إضافة دفعة ثانية مُسجلة 750 بتاريخ 2026‑09‑10 (تبقى POSTED؛ الأولى 250 ملغاة) ومصروف OWNER مُثبت 50 بتاريخ 2026‑09‑12.
- الحمولة تُرسل مبالغ مُلفّقة عمدًا (9999/1/1/1) لتُثبت البوابة أنها **مُتجاهَلة**؛ التأكيدات تصبح gross=750، fee=75 (‎10%‎)، expenses=50، tax=0، **net=625**، وقيد الصرف 625/625. الخطة 60 → ‏؟‏ (تُحدَّث في الملف).

## 4) السيطرة على التموج (Ripple control)
- `src/p0/replay-bootstrap.ts`: يُستثنى ملفا P1 من هارنس P0 (يبقى يقيس دلتا P0 فقط)؛ P1 لها هارنسها `src/p1/replay-bootstrap.ts` (يعيد تشغيل كل الهجرات بما فيها P0+P1).
- بذلك تبقى بصمة forward‑rollback الخاصة بـ P0 صحيحة حرفيًا، واختبار العزل السلوكي لـ P0 أخضر دون تعديل تأكيداته (نجاح إنشاء المسودة محفوظ؛ دلالات المبالغ تُفحص في حزمة P1).
- SonarCloud: `**/src/p1/**` تُضاف إلى الاستثناءات (هارنس تحقق، مثل p0 تمامًا).

## 5) دليل التنفيذ النهائي (2026-07-24 — مكتمل)

- [x] **RED ثم GREEN**: فشلت الحزمة قبل الهجرة (`function calculate_owner_net_payout does not exist` + `expected 999996 to be 1230` للحمولة الملفّقة) واخضرّت بعدها.
- [x] **حزمة P1 الموسّعة — 27/27** عبر 3 ملفات (`p1-owner-settlement-integrity` 22، `p1-forward-rollback` 4، `zz-rehearsal-verify` 1) — تشمل: الاشتقاق (RATE/FIXED/ماستر/منتهي/متسلسل/فارغ/VAT مفعلة ومعزولة/تقريب 3)، كيل الحمولة الملفّقة (999999/1/1/1 → مخزَّن 1500/150/120/0/**1230** + `amounts_source: server_derived`)، دورة الحياة كاملة (اعتماد يعكس المخزَّن، دفع بقيد متوازن 1230=1230 في دفعة واحدة، idempotent replay بلا أثر ثانٍ، إلغاء)، الحسابات (عزل شركة)، **مناعة المبالغ بالتريغر** (اختبار انحداري)، المحاولات غير الصالحة (دفع DRAFT/اعتماد PAID/اعتماد CANCELLED/عضو/بلا claim)، توازي preview≡draft≡approved≡paid.
- [x] **عزل فشل approve** (تصنيف 2 PGlite↔Supabase — منح جداول) و**فشل pay 1111/2000** (فجوة مثبّت: `accounts.no` فريد كليًا + لا تريغر إمداد — قبل/بعد P1 متطابق، جسم pay بصمة md5 واحدة `9ad0ef78…`): `evidence/p1/approve-failure-classification.md` (+Appendix B) و`pay-accounts-diagnosis.json`.
- [x] **بوابة pgTAP الفعلية** `release_lifecycle_rehearsal.sql` على السلسلة الكاملة (P0+P1): **65/65 تأكيدة، 0 فشل، 0 أخطاء عليا** عبر `zz-rehearsal-verify.test.ts` (الملف الحقيقي، مش نسخة مختصرة).
- [x] **Forward/Rollback**: خط أساس (بدون P1) → تطبيق → تحقق → rollback → **بصمة ≡ حرفيًا** (دوال بأجسامها/owner/prosecdef/proconfig/proacl، سياسات، رايات RLS؛ بما فيها إثبات أن ACL دالة الإنشاء لم تتغير — صُحّحت سهوة `service_role` المؤقتة) → **إعادة تطبيق بعد الـrollback تنجح** → عودة للخط. لا DROP TABLE/COLUMN، لا تعديل بيانات، صفر فشل تطبيق (لا انحدار 42803).
- [x] **اكتشاف إنتاجي ثانٍ أُغلق في نفس الهجرة**: تعديل مبالغ التسوية مباشرة عبر الجدول (سياسة FOR ALL التساهلية + RESTRICTIVE شركة فقط) — أصغر إصلاح: تريغر `p1_owner_settlements_amounts_immutable` يمنع تغيير أعمدة المبالغ بعد الإدراج، مستقل عن RLS (يحمي مسارات DEFINER أيضًا)، لا يمس تحديثات approve/pay/cancel (لا تغيّر مبالغ). الـrollback يسقط التريغر ودالته.
- [x] **الواجهة (ٍ§6)**: الخدمة لا ترسل أي مفاتيح مبالغ (اختبار سلوكي يثبت غيابها من الـpayload)؛ المعاينة عبر `rpc('calculate_owner_net_payout')`؛ `request_id` ثابت للمحاولة ضد النقر المزدوج؛ زر الإنشاء معطّل حتى نجاح المعاينة؛ الاختبار الساكن يمنع رجوع الحاسبات المحلية. حزمة الملاك 63/63.
- [x] **البوابات**: `typecheck` ✓0 · `lint` ✓0 · `typecheck:test` ✓0 · `check:architecture` ✓0 · financials **271/271** · P0 **57/57** · P1 **27/27** · **الجناح الكامل 207 ملفات / 1034/1034** · `vite build` ✓ (13.53s).
- [ ] PR مستقل + CI أخضر + **دمج squash فقط بعد موافقة المستخدم** (هذه النقطة الأخيرة متروكة للحوكمة).

### أرقام قبل/بعد (مثال التوجيه)
قبل: العميل يرسل `gross=1230 fee=150 expenses=120 tax=0` → تُخزَّن حرفيًا وتُدفع. بعد: نفس الطلب + أرقام ملفّقة `gross=999999 fee=1 expenses=1 tax=1` → يُشتق خادميًا من التحصيلات المرحّلة والاتفاقية والمصروفات المعتمدة → تُخزَّن **1500/150/120/0/1230**، والاعتماد/الدفع/القيد كلها على المخزَّن المشتق، وأي UPDATE لاحق للمبالغ يُرفض بالتريغر.

## 6) ملاحظات خارج النطاق (موثقة، لا تُعالَج في P1)
- **تداخل فترات جزئي** لنفس (المالك، العقار): الحامي الحالي يرفض التطابق التام فقط؛ فترتان متداخلتان جزئيًا قد تُحتسبان الدفعات ذاتها مرتين في الأتعاب (سلوك قائم قبل P1 وبعده بنفس الدلالة — ليس ناتجًا عن الثقة بالعميل). يُقترح P2: تشديد الحامي إلى رفض أي تداخل.
- خصم الدفعات المُسوّاة سابقًا من اشتقاق الفترة الجديدة (مكافحة ازدواج الأتعاب عبر الفترات) — قرار محاسبي مستقل، يُوثق لـ P2.
