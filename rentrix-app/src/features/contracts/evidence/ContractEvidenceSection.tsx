import { useMemo, useState, type FormEvent } from 'react';
import { ClipboardCheck, FileCheck2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { getTodayLocalDateString } from '@/features/financials/financials-date-utils';
import {
  newEvidenceRequestId,
  parseChecklistDefinition,
  parseChecklistResponses,
  type ChecklistResponseItem,
  type ContractInspection,
  type InspectionTemplate,
} from './contract-evidence-service';
import { useContractEvidenceDocuments, useContractEvidenceMutations, useContractEvidenceState } from './use-contract-evidence';

const registrationStatusLabels: Record<string, string> = { SUBMITTED: 'قيد التحقق', REGISTERED: 'مسجل رسمياً', REJECTED: 'مرفوض', CANCELLED: 'ملغي' };
const inspectionStatusLabels: Record<string, string> = { DRAFT: 'مسودة', COMPLETED: 'بانتظار المراجعة', REVIEWED: 'مراجع', CHANGES_REQUESTED: 'مطلوب تعديل' };
const conditionLabels: Record<string, string> = { GOOD: 'جيد', FAIR: 'مقبول', DAMAGED: 'متضرر', NOT_APPLICABLE: 'غير منطبق' };

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.includes('NOT_CONFIGURED')) return 'لم تعتمد الشركة متطلبات التسجيل الرسمية بعد.';
  if (message.includes('SELF_VERIFICATION')) return 'لا يمكن لمقدم الطلب التحقق من طلبه بنفسه.';
  if (message.includes('SELF_REVIEW')) return 'لا يمكن لمن أكمل الفحص أن يراجعه بنفسه.';
  if (message.includes('DOCUMENT_INVALID') || message.includes('EVIDENCE_REQUIRED')) return 'اختر مستند عقد صالحاً كإثبات.';
  if (message.includes('REQUIRED_ITEMS_INCOMPLETE')) return 'أكمل حالة كل بند إلزامي قبل توقيع الفحص.';
  if (message.includes('SIGNATURES_REQUIRED')) return 'توقيع المستأجر وممثل المكتب مطلوبان لإكمال الفحص.';
  return message || 'تعذر تنفيذ الإجراء. حاول مرة أخرى.';
}

function registrationTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'REGISTERED') return 'success';
  if (status === 'SUBMITTED') return 'warning';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

function inspectionTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'REVIEWED') return 'success';
  if (status === 'COMPLETED') return 'warning';
  if (status === 'CHANGES_REQUESTED') return 'danger';
  return 'neutral';
}

type RegistrationForm = { submittedOn: string; externalReference: string; evidenceDocumentId: string };
type DecisionForm = { action: 'REGISTER' | 'REJECT'; registrationReference: string; registeredOn: string; expiresOn: string; feePaid: string; evidenceDocumentId: string; reason: string };
type InspectionForm = {
  inspectionId?: string;
  kind: 'MOVE_IN' | 'MOVE_OUT';
  templateId: string;
  inspectedOn: string;
  checklist: ChecklistResponseItem[];
  electricity: string;
  water: string;
  keyCount: string;
  accessNotes: string;
  summary: string;
  evidenceDocumentId: string;
  tenantSignature: string;
  officeSignature: string;
};

export function ContractEvidenceSection({ contractId }: Readonly<{ contractId: string }>) {
  const { authorization } = useAuth();
  const stateQuery = useContractEvidenceState(contractId);
  const documentsQuery = useContractEvidenceDocuments(contractId);
  const mutations = useContractEvidenceMutations(contractId);
  const canOperate = ['ADMIN', 'MANAGER', 'OPERATIONS'].includes(authorization?.role ?? '');
  const canVerify = ['ADMIN', 'MANAGER'].includes(authorization?.role ?? '');
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [inspectionForm, setInspectionForm] = useState<InspectionForm | null>(null);
  const [reviewInspection, setReviewInspection] = useState<ContractInspection | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REQUEST_CHANGES'>('APPROVE');
  const [reviewReason, setReviewReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [registrationForm, setRegistrationForm] = useState<RegistrationForm>({ submittedOn: getTodayLocalDateString(), externalReference: '', evidenceDocumentId: '' });
  const [decisionForm, setDecisionForm] = useState<DecisionForm>({ action: 'REGISTER', registrationReference: '', registeredOn: getTodayLocalDateString(), expiresOn: '', feePaid: '', evidenceDocumentId: '', reason: '' });

  const state = stateQuery.data;
  const documents = documentsQuery.data ?? [];
  const registration = state?.registration;
  const profile = state?.registration_profile;
  const templates = state?.inspection_templates ?? [];
  const inspections = state?.inspections ?? [];
  const templatesByKind = useMemo(() => new Map(templates.map((template) => [template.kind, template])), [templates]);

  const startInspection = (kind: 'MOVE_IN' | 'MOVE_OUT', existing?: ContractInspection) => {
    const template = existing ? templates.find((item) => item.id === existing.template_id) : templatesByKind.get(kind);
    if (!template) {
      toast.error('لا يوجد نموذج فحص فعّال لهذه المرحلة.');
      return;
    }
    const definition = parseChecklistDefinition(template.checklist_definition);
    const existingResponses = existing ? new Map(parseChecklistResponses(existing.checklist).map((item) => [item.code, item])) : new Map<string, ChecklistResponseItem>();
    const meters = existing?.meter_readings && typeof existing.meter_readings === 'object' && !Array.isArray(existing.meter_readings) ? existing.meter_readings as Record<string, unknown> : {};
    const keys = existing?.keys_and_access && typeof existing.keys_and_access === 'object' && !Array.isArray(existing.keys_and_access) ? existing.keys_and_access as Record<string, unknown> : {};
    setFormError(null);
    setInspectionForm({
      inspectionId: existing?.id,
      kind,
      templateId: template.id,
      inspectedOn: existing?.inspected_on ?? getTodayLocalDateString(),
      checklist: definition.map((item) => existingResponses.get(item.code) ?? { code: item.code, condition: '', note: '' }),
      electricity: String(meters.electricity ?? ''), water: String(meters.water ?? ''),
      keyCount: String(keys.key_count ?? ''), accessNotes: String(keys.notes ?? ''),
      summary: existing?.summary ?? '', evidenceDocumentId: existing?.evidence_document_ids?.[0] ?? '',
      tenantSignature: existing?.tenant_signature ?? '', officeSignature: existing?.office_signature ?? '',
    });
  };

  const saveInspection = async (complete: boolean) => {
    if (!inspectionForm) return;
    setFormError(null);
    try {
      const saved = await mutations.saveInspection.mutateAsync({
        inspectionId: inspectionForm.inspectionId,
        contractId,
        templateId: inspectionForm.templateId,
        kind: inspectionForm.kind,
        inspectedOn: inspectionForm.inspectedOn,
        checklist: inspectionForm.checklist,
        meterReadings: { electricity: inspectionForm.electricity, water: inspectionForm.water },
        keysAndAccess: { key_count: Number(inspectionForm.keyCount || 0), notes: inspectionForm.accessNotes },
        summary: inspectionForm.summary,
        evidenceDocumentIds: inspectionForm.evidenceDocumentId ? [inspectionForm.evidenceDocumentId] : [],
        requestId: newEvidenceRequestId('inspection-draft'),
      });
      if (complete) {
        await mutations.completeInspection.mutateAsync({ inspectionId: saved.id, tenantSignature: inspectionForm.tenantSignature, officeSignature: inspectionForm.officeSignature, requestId: newEvidenceRequestId('inspection-complete') });
        toast.success('تم توقيع الفحص وإرساله للمراجعة.');
        setInspectionForm(null);
      } else {
        toast.success('تم حفظ مسودة الفحص.');
        setInspectionForm((current) => current ? { ...current, inspectionId: saved.id } : current);
      }
    } catch (error) { setFormError(errorMessage(error)); }
  };

  const submitRegistration = async (event: FormEvent) => {
    event.preventDefault(); setFormError(null);
    try {
      await mutations.submitRegistration.mutateAsync({ contractId, submittedOn: registrationForm.submittedOn, externalReference: registrationForm.externalReference, evidenceDocumentId: registrationForm.evidenceDocumentId, requestId: newEvidenceRequestId('registration-submit') });
      toast.success('تم تسجيل طلب التسجيل وإرساله للتحقق.'); setRegistrationOpen(false);
    } catch (error) { setFormError(errorMessage(error)); }
  };

  const decideRegistration = async (event: FormEvent) => {
    event.preventDefault(); if (!registration) return; setFormError(null);
    try {
      await mutations.decideRegistration.mutateAsync({ registrationId: registration.id, action: decisionForm.action, registrationReference: decisionForm.registrationReference, registeredOn: decisionForm.registeredOn, expiresOn: decisionForm.expiresOn, feePaid: decisionForm.feePaid ? Number(decisionForm.feePaid) : undefined, evidenceDocumentId: decisionForm.evidenceDocumentId, reason: decisionForm.reason, requestId: newEvidenceRequestId('registration-decision') });
      toast.success(decisionForm.action === 'REGISTER' ? 'تم التحقق من التسجيل الرسمي.' : 'تم رفض طلب التسجيل مع حفظ السبب.'); setDecisionOpen(false);
    } catch (error) { setFormError(errorMessage(error)); }
  };

  const submitInspectionReview = async (event: FormEvent) => {
    event.preventDefault(); if (!reviewInspection) return; setFormError(null);
    try {
      await mutations.reviewInspection.mutateAsync({ inspectionId: reviewInspection.id, action: reviewAction, reason: reviewReason, requestId: newEvidenceRequestId('inspection-review') });
      toast.success(reviewAction === 'APPROVE' ? 'تم اعتماد الفحص.' : 'تم إرجاع الفحص للتعديل.'); setReviewInspection(null); setReviewReason('');
    } catch (error) { setFormError(errorMessage(error)); }
  };

  if (stateQuery.isLoading) return <Card><CardContent className="p-6 text-sm text-muted-foreground" role="status">جارٍ تحميل أدلة التسجيل والتسليم...</CardContent></Card>;
  if (stateQuery.isError || !state) return <Card><CardContent className="space-y-3 p-6"><p className="font-bold text-danger">تعذر تحميل أدلة العقد.</p><Button variant="secondary" onClick={() => stateQuery.refetch()}>إعادة المحاولة</Button></CardContent></Card>;

  return (
    <section className="space-y-4" aria-labelledby="contract-evidence-title">
      <div><h2 id="contract-evidence-title" className="text-lg font-black">التسجيل والتسليم</h2><p className="mt-1 text-sm text-muted-foreground">إثباتات مستقلة عن حالة العقد التشغيلية؛ لا يصف النظام العقد بأنه مسجل دون تحقق ومستند.</p></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="size-5 text-primary" />التسجيل الرسمي</CardTitle><CardDescription>{profile ? `${profile.authority_name} · ${profile.legal_reference}` : 'لا توجد قاعدة قانونية معتمدة ومفعّلة لهذه الشركة.'}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {!profile ? <div className="rounded-xl border border-warning/30 bg-warning/5 p-3"><p className="font-bold text-warning">غير مهيأ قانونياً</p><p className="mt-1 text-xs leading-5 text-muted-foreground">لن يخترع MALEK جهة أو مهلة أو رسماً. يلزم ملف معتمد ونافذ قبل بدء التسجيل.</p></div>
              : !profile.registration_required ? <StatusBadge tone="neutral">غير مطلوب وفق الملف المعتمد</StatusBadge>
              : registration ? <div className="space-y-2"><StatusBadge tone={registrationTone(registration.status)}>{registrationStatusLabels[registration.status] ?? registration.status}</StatusBadge><p className="text-sm">تاريخ التقديم: <span dir="ltr">{registration.submitted_on}</span></p>{registration.registration_reference ? <p className="text-sm">مرجع التسجيل: <strong dir="ltr">{registration.registration_reference}</strong></p> : null}{registration.decision_reason ? <p className="text-sm text-danger">السبب: {registration.decision_reason}</p> : null}{registration.status === 'SUBMITTED' && canVerify ? <Button variant="secondary" onClick={() => { setFormError(null); setDecisionOpen(true); }}>التحقق من الطلب</Button> : null}</div>
              : <div className="space-y-3"><p className="text-sm text-muted-foreground">التسجيل مطلوب وفق ملف الشركة المعتمد، ولم يُسجل طلب بعد.</p>{canOperate ? <Button onClick={() => { setFormError(null); setRegistrationOpen(true); }}>بدء طلب التسجيل</Button> : null}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" />فحص الدخول والإخلاء</CardTitle><CardDescription>حالة الوحدة والعدادات والمفاتيح والتوقيعات مع مراجعة شخص آخر.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {(['MOVE_IN','MOVE_OUT'] as const).map((kind) => {
              const existing = inspections.find((inspection) => inspection.kind === kind && inspection.status !== 'CHANGES_REQUESTED') ?? inspections.find((inspection) => inspection.kind === kind);
              return <div key={kind} className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{kind === 'MOVE_IN' ? 'فحص الدخول' : 'فحص الإخلاء'}</p><p className="text-xs text-muted-foreground">{existing ? `تاريخ الفحص ${existing.inspected_on}` : 'لم يبدأ'}</p></div>{existing ? <StatusBadge tone={inspectionTone(existing.status)}>{inspectionStatusLabels[existing.status] ?? existing.status}</StatusBadge> : <StatusBadge tone="neutral">غير موجود</StatusBadge>}</div><div className="mt-3 flex flex-wrap gap-2">{canOperate && (!existing || existing.status === 'DRAFT' || existing.status === 'CHANGES_REQUESTED') ? <Button size="sm" variant="secondary" onClick={() => startInspection(kind, existing)}> {existing ? 'متابعة الفحص' : 'بدء الفحص'} </Button> : null}{canVerify && existing?.status === 'COMPLETED' ? <Button size="sm" onClick={() => { setFormError(null); setReviewInspection(existing); }}>مراجعة الفحص</Button> : null}</div>{existing?.review_reason ? <p className="mt-2 text-xs text-danger">ملاحظات المراجع: {existing.review_reason}</p> : null}</div>;
            })}
          </CardContent>
        </Card>
      </div>

      <EntityForm.Overlay open={registrationOpen} onOpenChange={(open) => { setRegistrationOpen(open); if (!open) setFormError(null); }} title="بدء طلب التسجيل الرسمي" description="تُلتقط الجهة والقاعدة والرسوم من الملف القانوني النافذ؛ لا يمكن تعديلها من هذا النموذج.">
        <EntityForm.Root onSubmit={submitRegistration}><EntityForm.ErrorSummary message={formError} /><EntityForm.Field label="تاريخ التقديم"><Input type="date" required value={registrationForm.submittedOn} onChange={(e) => setRegistrationForm((v) => ({ ...v, submittedOn: e.target.value }))} /></EntityForm.Field><EntityForm.Field label="مرجع الطلب الخارجي (اختياري)"><Input dir="ltr" value={registrationForm.externalReference} onChange={(e) => setRegistrationForm((v) => ({ ...v, externalReference: e.target.value }))} /></EntityForm.Field><EntityForm.Field label="مستند التقديم (اختياري)"><DocumentSelect value={registrationForm.evidenceDocumentId} documents={documents} onChange={(value) => setRegistrationForm((v) => ({ ...v, evidenceDocumentId: value }))} /></EntityForm.Field><EntityForm.Actions onCancel={() => setRegistrationOpen(false)} isSubmitting={mutations.submitRegistration.isPending} submitLabel="إرسال الطلب للتحقق" /></EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay open={decisionOpen} onOpenChange={(open) => { setDecisionOpen(open); if (!open) setFormError(null); }} title="التحقق من التسجيل" description="يجب أن يكون المتحقق شخصاً مختلفاً عن مقدم الطلب.">
        <EntityForm.Root onSubmit={decideRegistration}><EntityForm.ErrorSummary message={formError} /><EntityForm.Field label="القرار"><Select value={decisionForm.action} onChange={(e) => setDecisionForm((v) => ({ ...v, action: e.target.value as DecisionForm['action'] }))}><option value="REGISTER">تم التسجيل</option><option value="REJECT">رفض الطلب</option></Select></EntityForm.Field>{decisionForm.action === 'REGISTER' ? <><EntityForm.Field label="مرجع التسجيل"><Input dir="ltr" required value={decisionForm.registrationReference} onChange={(e) => setDecisionForm((v) => ({ ...v, registrationReference: e.target.value }))} /></EntityForm.Field><EntityForm.Field label="تاريخ التسجيل"><Input type="date" required value={decisionForm.registeredOn} onChange={(e) => setDecisionForm((v) => ({ ...v, registeredOn: e.target.value }))} /></EntityForm.Field><EntityForm.Field label="تاريخ الانتهاء (إن وجد)"><Input type="date" value={decisionForm.expiresOn} onChange={(e) => setDecisionForm((v) => ({ ...v, expiresOn: e.target.value }))} /></EntityForm.Field><EntityForm.Field label="الرسم المدفوع"><Input type="number" min="0" step="0.001" value={decisionForm.feePaid} onChange={(e) => setDecisionForm((v) => ({ ...v, feePaid: e.target.value }))} /></EntityForm.Field><EntityForm.Field label="مستند التسجيل"><DocumentSelect required value={decisionForm.evidenceDocumentId} documents={documents} onChange={(value) => setDecisionForm((v) => ({ ...v, evidenceDocumentId: value }))} /></EntityForm.Field></> : <EntityForm.Field label="سبب الرفض"><Textarea required value={decisionForm.reason} onChange={(e) => setDecisionForm((v) => ({ ...v, reason: e.target.value }))} /></EntityForm.Field>}<EntityForm.Actions onCancel={() => setDecisionOpen(false)} isSubmitting={mutations.decideRegistration.isPending} submitLabel="حفظ القرار" /></EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay open={inspectionForm !== null} onOpenChange={(open) => { if (!open) { setInspectionForm(null); setFormError(null); } }} title={inspectionForm?.kind === 'MOVE_OUT' ? 'فحص الإخلاء' : 'فحص الدخول'} description="احفظ مسودة أو أكمل كل البنود والتوقيعات ثم أرسلها لمراجعة شخص آخر." className="max-w-3xl">
        {inspectionForm ? <EntityForm.Root onSubmit={(event) => { event.preventDefault(); void saveInspection(true); }}><EntityForm.ErrorSummary message={formError} /><EntityForm.Field label="تاريخ الفحص"><Input type="date" required value={inspectionForm.inspectedOn} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, inspectedOn: e.target.value }) : v)} /></EntityForm.Field><div className="space-y-3 md:col-span-2">{parseChecklistDefinition(templates.find((t) => t.id === inspectionForm.templateId)?.checklist_definition ?? []).map((item, index) => <div key={item.code} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_12rem]"><div><p className="text-sm font-bold">{item.label_ar}{item.required ? ' *' : ''}</p><Input className="mt-2" placeholder="ملاحظة أو وصف الضرر" value={inspectionForm.checklist[index]?.note ?? ''} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, checklist: v.checklist.map((entry, i) => i === index ? { ...entry, note: e.target.value } : entry) }) : v)} /></div><Select aria-label={`حالة ${item.label_ar}`} required={item.required} value={inspectionForm.checklist[index]?.condition ?? ''} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, checklist: v.checklist.map((entry, i) => i === index ? { ...entry, condition: e.target.value as ChecklistResponseItem['condition'] } : entry) }) : v)}><option value="">اختر الحالة</option>{Object.entries(conditionLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></div>)}</div><EntityForm.Field label="عداد الكهرباء"><Input dir="ltr" inputMode="decimal" value={inspectionForm.electricity} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, electricity: e.target.value }) : v)} /></EntityForm.Field><EntityForm.Field label="عداد المياه"><Input dir="ltr" inputMode="decimal" value={inspectionForm.water} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, water: e.target.value }) : v)} /></EntityForm.Field><EntityForm.Field label="عدد المفاتيح"><Input type="number" min="0" value={inspectionForm.keyCount} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, keyCount: e.target.value }) : v)} /></EntityForm.Field><EntityForm.Field label="وسائل الدخول والملاحظات"><Input value={inspectionForm.accessNotes} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, accessNotes: e.target.value }) : v)} /></EntityForm.Field><EntityForm.Field label="ملخص الفحص" className="md:col-span-2"><Textarea value={inspectionForm.summary} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, summary: e.target.value }) : v)} /></EntityForm.Field><EntityForm.Field label="مستند/صور الفحص" className="md:col-span-2"><DocumentSelect value={inspectionForm.evidenceDocumentId} documents={documents} onChange={(value) => setInspectionForm((v) => v ? ({ ...v, evidenceDocumentId: value }) : v)} /></EntityForm.Field><EntityForm.Field label="توقيع المستأجر"><Input value={inspectionForm.tenantSignature} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, tenantSignature: e.target.value }) : v)} /></EntityForm.Field><EntityForm.Field label="توقيع ممثل المكتب"><Input value={inspectionForm.officeSignature} onChange={(e) => setInspectionForm((v) => v ? ({ ...v, officeSignature: e.target.value }) : v)} /></EntityForm.Field><div className="flex flex-wrap justify-end gap-2 md:col-span-2"><Button type="button" variant="secondary" onClick={() => void saveInspection(false)} disabled={mutations.saveInspection.isPending}>حفظ مسودة</Button><Button type="submit" disabled={mutations.saveInspection.isPending || mutations.completeInspection.isPending}>توقيع وإرسال للمراجعة</Button></div></EntityForm.Root> : null}
      </EntityForm.Overlay>

      <EntityForm.Overlay open={reviewInspection !== null} onOpenChange={(open) => { if (!open) { setReviewInspection(null); setFormError(null); } }} title="مراجعة فحص الوحدة" description="لا يمكن لمن أكمل الفحص أن يعتمد عمله بنفسه."><EntityForm.Root onSubmit={submitInspectionReview}><EntityForm.ErrorSummary message={formError} /><EntityForm.Field label="القرار"><Select value={reviewAction} onChange={(e) => setReviewAction(e.target.value as typeof reviewAction)}><option value="APPROVE">اعتماد الفحص</option><option value="REQUEST_CHANGES">إرجاع للتعديل</option></Select></EntityForm.Field>{reviewAction === 'REQUEST_CHANGES' ? <EntityForm.Field label="ملاحظات التعديل"><Textarea required value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} /></EntityForm.Field> : null}<EntityForm.Actions onCancel={() => setReviewInspection(null)} isSubmitting={mutations.reviewInspection.isPending} submitLabel="حفظ المراجعة" /></EntityForm.Root></EntityForm.Overlay>
    </section>
  );
}

function DocumentSelect({ value, onChange, documents, required = false }: Readonly<{ value: string; onChange: (value: string) => void; documents: readonly { id: string; title: string }[]; required?: boolean }>) {
  return <><Select value={value} required={required} onChange={(e) => onChange(e.target.value)}><option value="">{required ? 'اختر مستنداً' : 'بدون مستند حالياً'}</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</Select>{documents.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">ارفع الإثبات أولاً من قسم مستندات العقد أسفل الصفحة.</p> : null}</>;
}
