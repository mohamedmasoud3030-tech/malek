# تصميم حجز عناصر تسوية المالك — FA-003

**النطاق:** PR-B فقط (منع تكرار التحصيل/المصروف عبر تسويات مالك).
**المستودع:** mohamedmasoud3030-tech/malik
**الفرع:** `fix/owner-settlement-input-reservations`
**القاعدة:** `main@130269e6` (commit إصلاح FA-004).

---

## 1. المشكلة

التحصيل الاقتصادي (الدفعة `payment`) أو مصروف المالك (`expense`) يمكن أن يُحتسب في أكثر من
تسوية مالك غير ملغاة، لا سيما عند:
- فترات متداخلة (نفس المالك/العقار في فترتين متقاطعتين)؛
- طلبات متزامنة على نفس النطاق.

السبب الجذري: التسوية تحسب مبالغها من النطاق الزمني عند كل إنشاء، دون أي سجل عضوية يثبّت
أن هذا العنصر يعود لهذه التسوية تحديدًا.

---

## 2. تتبع مصدر عناصر التسوية

اعتمادًا على آخر تعريف سارٍ في `main@130269e6`:

| الوظيفة | آخر Migration | التوقيع | الحالة |
|---|---|---|---|
| إنشاء Draft | `20260729091000_p1_owner_settlement_property_text_compatibility.sql` | `create_owner_settlement_draft_atomic(jsonb)` | يعرّف المبالغ خادميًا عبر `calculate_owner_net_payout` |
| حساب تسوية المالك | `20260729091000` | `calculate_owner_net_payout(uuid,date,date,text)` | أساس cash collected (ADR 0001) |
| الاعتماد | `20260729090000_phase3a1c_owner_settlement_account_resolution.sql` | `approve_owner_settlement_atomic(jsonb)` | DRAFT → APPROVED |
| الدفع | `20260729090000` | `pay_owner_settlement_atomic(jsonb)` | APPROVED → PAID + قيد 2000/1111 |
| الإلغاء | `20260729090000` | `cancel_owner_settlement_atomic(jsonb)` | DRAFT/APPROVED → CANCELLED |
| إعادة فتح/عكس | — | لا توجد RPC رسمية | — |

**مصدر gross collected:** مجموع `payments.amount` لدفعات عقود المالك (غير `master_lease`)
في الفترة، منضمة إلى `owner_agreements` عبر `contracts.agreement_id`.
**مصدر المصروفات:** `expenses` حيث `status=POSTED` و`charged_to=OWNER` ومغطاة بـ`property_owners`
وداخل الفترة.
**ربط التحصيل بالمالك/العقار/العقد:** كل دفعة تنتمي إلى `contract_id` واحد، والعقد إلى مالك/عقار
واحد عبر اتفاقيته. لا يوجد تقسيم للدفعة عبر ملاك/عقارات في اشتقاق التسوية.

**payments أم receipts أم receipt_allocations؟**
- الاشتقاق يستخدم `public.payments` مباشرة (سطر الدفعة كاملًا).
- لا يقرأ الاشتقاق `receipt_allocations` إطلاقًا.
- ملاحظة جوهرية: منذ `20260723100000_enforce_payment_receipt_shared_identity`، تشترك الدفعة
  والوصول في الهوية (`payments.id = payments.receipt_id`)، أي أن `payment_id` يساوي معرف الوصول.
  وعلى الرغم من إمكانية توزيع مبلغ الوصول على أكثر من فاتورة عبر `receipt_allocations`، فإن
  التوزيع لا يعبر المالك/العقار في حساب التسوية (الدفعة لها عقد واحد = مالك/عقار واحد، ويُستخدم
  مبلغها كاملًا مرة واحدة).

**توزيع دفعة على عدة ملاك/عقارات؟** لا — في النموذج الحالي الدفعة ترتبط بعقد واحد فقط.
**Void / Refund:** الدفعات `VOID` مستثناة من الاشتقاق (`upper(status) <> 'VOID'`) ومن الحجز.
**هل يُقسَّم المصروف؟** لا — المصروف إما مؤهل كاملًا أو لا، ويدخل كاملًا في `owner_expenses`.

---

## 3. أصغر وحدة اقتصادية — قرار مفتاح الحجز

### التحصيلات: `payment_id`
- الاشتقاق يجمع **سطر الدفعة كاملًا** (`p.amount`) لكل عقد مالك في الفترة.
- كل دفعة تنتمي إلى مالك/عقار/عقد واحد، ولا تُقسَّم في حساب التسوية.
- `receipt_allocations` ليست مصدرًا في الاشتقاق، لذا تقسيم الوصول على فواتير لا ينتج عنه
  ازدواج عبر ملاك/عقارات في التسوية.
- **السبب في عدم اختيار `receipt_allocation_id`:** لو استخدمنا سطر التوزيع سنحجز عناصر لا
  تظهر في التسوية (الاشتقاق لا يستخدمها)، وقد نحجب دفعات بصورة خاطئة أو نفتقد التثبيت الصحيح.
- **السبب في عدم اختيار مفتاح مركّب آخر:** لا يوجد سجل Settlement Source في المخطط.

### المصروفات: `expense_id`
- كل مصروف مؤهل يدخل كاملًا في `owner_expenses`؛ لا توجد وحدة أصغر.

---

## 4. جداول الحجز

### `public.owner_settlement_payment_links`
| الحقل | النوع | ملاحظة |
|---|---|---|
| id | uuid PK | |
| company_id | uuid NOT NULL | مشتق خادميًا؛ أبدًا من العميل |
| settlement_id | text NOT NULL | `owner_settlements.id` |
| payment_id | uuid NOT NULL | الوحدة الاقتصادية |
| reserved_at / reserved_by | timestamptz / uuid | وقت/مُنشئ الحجز |
| released_at / released_by / release_reason | nullable | تُضبط فقط من RPC الإلغاء الرسمي |
| created_at / updated_at | timestamptz | |

### `public.owner_settlement_expense_links`
نفس البنية مع `expense_id`.

---

## 5. فهارس التفرد (خط الدفاع الذري)

```sql
CREATE UNIQUE INDEX owner_settlement_payment_links_active_uidx
  ON public.owner_settlement_payment_links (company_id, payment_id)
  WHERE released_at IS NULL;

CREATE UNIQUE INDEX owner_settlement_expense_links_active_uidx
  ON public.owner_settlement_expense_links (company_id, expense_id)
  WHERE released_at IS NULL;
```

- العنصر النشط محجوز لتسوية واحدة فقط لكل شركة، على مستوى قاعدة البيانات.
- التسوية المدفوعة تبقى `released_at = NULL` حتى يظل العنصر محجوزًا نهائيًا.
- لا نستخدم `WHERE EXISTS(...)` أو `settlement.status` داخل Partial Index.

---

## 6. سلامة company_id

طبقتان (لا نعتمد على RLS وحدها):
1. **مفاتيح خارجية مركّبة:** `(settlement_id, company_id) → owner_settlements(id, company_id)`،
   `(payment_id, company_id) → payments(id, company_id)`، `(expense_id, company_id) →
   expenses(id, company_id)`. أضفنا فهارس فريدة مركّبة على الأعمدة المرجعية.
2. **Constraint Trigger** `enforce_owner_settlement_link_company_consistency` يتحقق قبل
   INSERT/UPDATE أن التسوية والعنصر ينتميان إلى نفس `company_id` للرابط، فيستحيل إدخال
   رابط عبر-شركات حتى من SQL مباشر.

`company_id` يُشتق من جلسة المستخدم (`auth.jwt() -> app_metadata.company_id`) ومن السجلات
المستهدفة، ولا يُقبل من Payload.

---

## 7. RLS وGrants

- تفعيل RLS على جدولي الروابط.
- `SELECT` للمصادق فقط ضمن شركته (`using (company_id = public.current_company_id())`).
- **لا** سياسات INSERT/UPDATE/DELETE، ولا Grant كتابة للمصادق → لا يستطيع المتصفح إنشاء أو
  تعديل أو حذف حجز مباشرة.
- الكتابة فقط من RPCs `SECURITY DEFINER` (المالكة postgres)، التي تتجاوز RLS.
- سحب الامتيازات من `PUBLIC`/`anon`، وتعيين `search_path` بأمان.

---

## 8. إنشاء Draft ذريًا (داخل معاملة واحدة)

1. `company_id` من الجلسة.
2. التحقق من المالك والعقار والاتفاقية داخل نفس الشركة.
3. قفل Advisory على نطاق `company + owner + property + period`، وفهرس فريد كخط دفاع نهائي.
4. اشتقاق مجموعة العناصر المؤهلة (دفعات + مصروفات) من دالة `owner_settlement_reservable_*`.
5. فحص: هل أي عنصر محجوز `released_at IS NULL`؟ → `SETTLEMENT_INPUT_ALREADY_RESERVED`.
6. إنشاء سجل التسوية.
7. إنشاء روابط التحصيلات والمصروفات في نفس المعاملة.
8. أي انتهاك Unique من طلب متزامن → Rollback كامل بلا تسوية ناقصة ولا روابط يتيمة.
9. نفس معادلات الحساب الحالية، ولا نعيد فتح Query على الفترة بعد الحجز لتحديد العضوية.
10. الحفاظ على Idempotency الحالية: نفس المفتاح ونفس الحمولة → نفس النتيجة؛ نفس المفتاح بحمولة
    مختلفة → رفض.

---

## 9. سياسة الفترات المتداخلة

- الأمان الأساسي **ليس** مقارنة `start_date`/`end_date`، بل فحص العناصر الاقتصادية.
- إذا شملت الفترة عنصرًا محجوزًا لتسوية غير ملغاة → رفض كامل مع رسالة
  `SETTLEMENT_INPUT_ALREADY_RESERVED` (لا نستبعد العنصر بصمت لننشئ تسوية ناقصة).
- بعد إلغاء تسوية غير مدفوعة وتحرير روابطها، يمكن إنشاء تسوية بديلة.

---

## 10. الإلغاء والتحرير

- إلغاء DRAFT/APPROVED داخل نفس المعاملة: قفل التسوية، تغيير الحالة بالمسار الحالي، ثم
  تحرير الروابط `released_at = now(), released_by = auth.uid(), release_reason = 'SETTLEMENT_CANCELLED'`.
- لا حذف للروابط، ولا تحرير لروابط PAID (الإلغاء يرفض PAID أصلًا).
- إعادة الإلغاء Idempotent.

---

## 11. سياسة PAID

- عند الدفع: يجب أن تكون عناصر التسوية هي الروابط المحجوزة نفسها (لا روابط جديدة، لا روابط محررة).
- روابط PAID تبقى `released_at = NULL` نهائيًا، فالعنصر لا يُعاد استخدامه.
- دفع مزدوج: قفل الصف + التحقق من الحالة يمنعان أي تكرار في Journal/Status.

---

## 12. الاعتماد — الحراس الأدنى

- يجب أن تملك التسوية روابط فعالة (غير محررة) لكل عنصر تُشتقه، ولا رابط محرر.
- لا إعادة اختيار عناصر من النطاق الزمني، ولا تغيير في معادلة المبلغ.

---

## 13. Backfill (روابط فقط)

- `assert_owner_settlement_links_backfillable()`: بوابة توقف تاريخية ترفع `BACKFILL_BLOCKED`
  (بلا Backfill جزئي وبلا اختيار فائز) إذا وُجد عنصر في أكثر من تسوية نشطة أو أي عدم تطابق مبلغ.
- `backfill_owner_settlement_links()`: تنشئ روابط فقط؛ النشطة غير محررة، والملغاة محررة للتدقيق.
- لا تغيّر مبالغ/حالة/تواريخ/صافي أي تسوية. انظر تقرير التشخيص لمزيد.

---

## 14. شروط التوقف والحدود

- لا تغيير في Debit/Credit ولا الحسابات 2000/4000/6100.
- لا تغيير في توقيت الاعتراف بالإيراد/العمولة ولا معادلة صافي التسوية.
- لا تنفيذ FA-008 (Fingerprint/Stale) ولا PR-C ولا PR-D.
- لا Backfill مالي، لا قيد تصحيح تاريخي.
