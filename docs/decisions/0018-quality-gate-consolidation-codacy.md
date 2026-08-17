# 0018. توحيد بوابة جودة الكود على Codacy وإيقاف سير عمل SonarCloud

## Context

- المشروع مستودع عام يطوّره بشكل أساسي وكلاء ذكيون (AI agents)، ويملك
  أصلاً أكثر من 10 بوابات CI مخصصة (typecheck، build، 2933 اختبار وحدة،
  فحوص DB0 للترحيلات، قواعد العمل، جاهزية المتصفح، Release Blocker).
- التدقيق الشامل 2026-08-17 (PR #1490، النتيجة F1) رصد أن
  `.github/workflows/sonarcloud-ci.yml` يملك شرط
  `if: github.event_name == 'workflow_dispatch'` على مستوى الـjob،
  فيظهر دائماً `skipping` على الـPRs وعلى main — أي أنه لا يعمل تلقائياً
  أبداً، رغم وجود `sonar.qualitygate.wait=true` الذي يوحي ببوابة إلزامية.
- في المقابل تعمل فعلياً بوابتا تحليل ثابت على كل PR عبر GitHub Apps:
  `Codacy Static Code Analysis` و`Aikido Security` (كلاهما `pass` على
  PR #1490)، وبدون أي صيانة workflow.
- الحقائق السعرية الرسمية الحالية (أغسطس 2026): SonarQube Cloud
  (SonarCloud) مجاني بلا حدود للمستودعات العامة (الخاص: 50K LOC / 5
  مستخدمين ثم خطط مدفوعة من ~$32/شهر)؛ Codacy مجاني بلا حدود للمشاريع
  مفتوحة المصدر (الخاص: Pro من $21/مطور/شهر). المستودع عام، فالتكلفة
  صفر في الحالتين اليوم — لكن الفارق سيظهر لو تحول المستودع إلى خاص.

## Decision

الاعتماد على **Codacy (+ Aikido للأمان)** كبوابة التحليل الثابت
التلقائية الوحيدة، وحذف `.github/workflows/sonarcloud-ci.yml`
و`sonar-project.properties` — أي إيقاف SonarCloud نهائياً بدل تركه
سير عمل خاملاً يضلل الوكلاء المستقبليين.

## Alternatives rejected

- **تفعيل SonarCloud تلقائياً (حذف شرط `if:`):** محلل ثالث مكرر فوق
  Codacy + Aikido، يضيف 10-15 دقيقة وقت CI لكل PR (يشغّل سلسلة التغطية
  الكاملة)، وبوابة جودة قد تكسر PRs الوكلاء فوق بوابات المشروع الكثيرة،
  مع صيانة مزدوجة لملفات الإعداد. رُفض رغم أنه مجاني للمستودع العام.
- **إبقاء الوضع الراهن (تشغيل يدوي فقط):** إعداد ميت؛ `skipping` دائم
  يُقرأ كبوابة غير مفعّلة، وأي وكيل مستقبلي قد "يصلحه" أو يعتمد عليه
  بالخطأ. رُفض.

## Consequences

- **أسهل:** سطح فشل أصغر للوكلاء، لا اعتماد على سر `SONAR_TOKEN`
  (يمكن للمالك حذفه لاحقاً من إعدادات المستودع)، سجل PR أنظف، وزمن
  CI أقصر.
- **أصعب/مخاطرة:** فقدنا لوحة SonarCloud وتقرير تغطية الأسطر المتغيرة؛
  يمكن ربط تغطية التغييرات بـCodacy لاحقاً من لوحة Codacy إذا احتاجها
  المالك (إعداد خارج المستودع، لا يمس الكود).
- **قفل بائع:** خفيف على Codacy للجودة، بينما يبقى الأمان ثنائي الإشارة
  عبر Aikido المستقل. العودة لـSonarCloud ممكنة دائماً: استرجاع الملفين
  من تاريخ git وإعادة ربط مشروع SonarCloud في لوحة الخدمة.

## Evidence

- PR #1490 checks: `Codacy Static Code Analysis — pass`،
  `Aikido Security: check code — pass`، `SonarCloud CI Analysis — skipping`.
- `.github/workflows/sonarcloud-ci.yml` سطر 16:
  `if: ${{ github.event_name == 'workflow_dispatch' }}`.
- GitHub API: آخر تشغيلات SonarCloud على main = `skipped`.
- التدقيق: `docs/audits/FULL_PROJECT_AUDIT_20260817_AR.md` النتيجة F1.
- التسعير الرسمي الحالي: sonarsource.com/plans-and-pricing وcodacy.com/pricing.
