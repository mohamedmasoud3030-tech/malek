# جرد سطح الكتابة المالية المباشرة — PR-C

**المنتج:** Malek  
**القاعدة:** `main@9e44e6f96c04b3f8d4b7673b5204fa8cd7322e01`  
**النطاق:** تحديد مسارات الكتابة المالية وإغلاق المسارات التي لديها بديل RPC مكتمل فقط.

## منهج الفحص

تم فحص:

- خدمات الواجهة داخل `rentrix-app/src/`.
- آخر تعريفات RLS وGrants وRPCs داخل `supabase/migrations/`.
- مسارات إنشاء/تعديل/إلغاء/صرف السجلات المالية.

هذا الجرد مبني على سلسلة Migrations الموجودة في المستودع واختبار Clean Replay. التحقق من انحراف قاعدة إنتاج بعينها يظل خطوة نشر مستقلة، ولا يُستخدم لتخمين تصميم مختلف عن آخر تعريف ساري في المستودع.

## النتيجة المختصرة

| الجدول | مسار الواجهة | الحماية الحالية | القرار |
|---|---|---|---|
| `journal_entries` | لا توجد كتابة مباشرة | كتابة المتصفح محظورة، والسجل Append-only | `ALREADY_CLOSED` |
| `invoices` | قراءة فقط في الخدمة الحالية | الإنشاء المالي عبر المسارات الخادمية | `READ_ONLY` |
| `payments` | قراءة فقط | الإنشاء عبر `record_invoice_payment_atomic` | `ALREADY_CLOSED` |
| `receipts` | قراءة فقط | الإلغاء عبر `void_receipt_atomic` | `ALREADY_CLOSED` |
| `receipt_allocations` | قراءة فقط | تُدار داخل RPC التحصيل والإلغاء | `ALREADY_CLOSED` |
| `expenses` | الكتابة عبر RPCs فقط | `create_expense_with_journal_atomic` و`update_expense_with_journal_atomic` | `ALREADY_CLOSED` |
| `tenant_deposits` | الكتابة عبر RPCs فقط | إنشاء/خصم/استرداد ذري | `ALREADY_CLOSED` |
| `deposit_transactions` | لا كتابة مباشرة | تُدار داخل RPCs الوديعة | `ALREADY_CLOSED` |
| `owner_settlements` | الكتابة عبر RPCs فقط | دورة FA-003 الرسمية | `ALREADY_CLOSED` |
| `owner_settlement_payment_links` | قراءة حسب الشركة | لا Grants أو Policies للكتابة المباشرة | `ALREADY_CLOSED` |
| `owner_settlement_expense_links` | قراءة حسب الشركة | لا Grants أو Policies للكتابة المباشرة | `ALREADY_CLOSED` |
| `owner_agreements` | الكتابة عبر RPCs فقط | FA-004 يعزل الشركة داخل RPC | `ALREADY_CLOSED` |
| `commissions` | INSERT/UPDATE مباشر قبل PR-C | دفع/عكس مؤمّنان فقط؛ الإنشاء والتعديل والإلغاء كانا مباشرين | `SAFE_TO_CLOSE` وتم إغلاقه في PR-C |
| `maintenance_records` | UPDATE مباشر + RPC للإغلاق المالي | يمكن نظريًا تجاوز `resolve_maintenance_with_expense` بطلب مباشر | `BLOCKED_INCOMPLETE_RPC` |

## العمولات — الثغرة التي أُغلقت

قبل PR-C كان الملف:

`rentrix-app/src/features/commissions/services/commissions-service.ts`

ينفذ مباشرة:

- `INSERT` لإنشاء العمولة.
- `UPDATE` لتعديل المبلغ والحالة.
- `UPDATE status='cancelled'` للإلغاء.

وكانت سياسة `manager_write_commissions` تسمح لـADMIN/MANAGER بالكتابة المباشرة مع عزل الشركة بواسطة `p0_tenant_isolation`. ورغم أن Trigger الدفع يمنع تعيين `paid` و`paid_at` و`expense_id` خارج RPC الصرف، فإنه لا يحول الإنشاء والتعديل والإلغاء إلى دورة حياة موثوقة.

تم الإغلاق بواسطة:

- `create_commission_atomic(jsonb)` — الشركة والحالة `pending` خادميتان.
- `update_commission_atomic(jsonb)` — يسمح بالحقول التشغيلية وحالتي `pending/approved` فقط.
- `cancel_commission_atomic(jsonb)` — يلغي العمولة غير المدفوعة، ويرفض المدفوعة لصالح `reverse_commission_atomic`.
- سحب `INSERT/UPDATE/DELETE` من `authenticated`.
- إزالة سياسة الكتابة المباشرة والإبقاء على قراءة معزولة بالشركة.
- تحويل خدمة الواجهة إلى RPCs.

لم يتم تعديل:

- `pay_commission_atomic`.
- `reverse_commission_atomic`.
- حساب المصروف `6100` أو حساب النقد.
- أي Debit/Credit أو مبلغ قيد.
- توقيت الاعتراف بالإيراد.

## عقد حالات العمولات

آخر عقد ساري مثبت في:

`20260718215711_reconcile_ui_database_value_contracts.sql`

هو:

- `pending`
- `approved`
- `paid`
- `cancelled`

القيد القديم ذي الأحرف الكبيرة تم إسقاطه واستبداله، لذلك لا يوجد قرار أعمال معلّق في هذه النقطة.

## المجرى المؤجل: maintenance_records

إنشاء طلب الصيانة والإغلاق مع إنشاء مصروف يمران عبر RPCs، لكن التعديل العام للحالة ما زال مباشرًا. حماية هذا الجدول تتطلب فصل الحقول التشغيلية عن `resolved/expense_id` أو إضافة RPC/Trigger متكامل دون كسر تحديثات التشغيل اليومية.

لذلك لم تُسحب صلاحياته داخل PR-C، ولم يتم الادعاء بإغلاقه. يُنفذ في عمل مستقل بعد حصر Call Sites واختبارات الإغلاق مع المصروف.

## تأكيد النطاق

- لا Backfill مالي.
- لا تغيير تاريخي للعمولات.
- لا تغيير في الحساب `2000`.
- لا تغيير في تسوية المالك.
- لا تنفيذ لـFA-005 أوFA-008.
- لا تعديل لمعالجة `master_lease`.
