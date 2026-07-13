import { Link } from '@tanstack/react-router';
import { Building2, Eye, LinkIcon, Pencil, Plus, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { EntityCell } from '@/components/ui/entity-cell';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { MobileCard } from '@/components/ui/mobile-card';
import { ActionMenu } from '@/components/ui/action-menu';
import { FilterBar } from '@/components/ui/filter-bar';
import { EntityForm } from '@/components/ui/entity-form';
import { SearchInput } from '@/components/ui/search-input';
import { AsyncContentState } from '@/components/async-content-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { DataTable } from '@/components/ui/data-table';
import { Textarea } from '@/components/ui/textarea';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyNumber } from '@/lib/companyFormatters';
import { getAppLanguageState, translateSharedLabel } from '@/lib/i18n';
import { OwnerCheckbox } from './components/owner-checkbox';
import { OwnerPropertySelect } from './components/owner-property-select';
import type { Owner, PropertyOwner, PropertyWithOwners } from './services/owner-service';
import {
  useCreateOwner,
  useLinkOwnerToProperty,
  useOwnerActiveContracts,
  useOwners,
  usePropertiesWithOwners,
  useUnlinkOwnerFromProperty,
  useUpdateOwner,
  useUpdatePropertyOwnerLink,
} from './useOwners';
import {
  buildOwnerWorkspaceRows,
  emptyOwnerFormValues,
  emptyPropertyOwnershipLinkFormValues,
  filterOwnerWorkspaceRows,
  getOwnerDisplayLabel,
  getOwnerPropertyOwnershipLabel,
  isActivePropertyOwnerLink,
  ownerToFormValues,
  propertyOwnerLinkToFormValues,
  propertyOwnershipLinkFormToPayload,
  summarizeOwners,
  validateOwnerForm,
  validateOwnerFormFields,
  validatePropertyOwnershipLinkForm,
  type OwnerFormValues,
  type OwnerWorkspaceRow,
  type PropertyOwnershipLinkFormValues,
} from './utils/owner-ui-helpers';

// ─── local types & helpers ───────────────────────────────────────────────────

type FieldProps = Readonly<{ label: string; children: ReactNode }>;
type EditingPropertyOwnerLink = Readonly<{ id: string; propertyId: string; ownerId: string }>;
type LinkedPropertyItem = Readonly<{ property: PropertyWithOwners; links: PropertyOwner[] }>;

function Field({ label, children }: FieldProps) {
  return <label className="space-y-2 text-sm font-bold"><span>{label}</span>{children}</label>;
}

function FieldError({ message }: Readonly<{ message?: string }>) {
  return message ? <p className="text-xs font-bold text-destructive">{message}</p> : null;
}

function getOwnerPageErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getLinkedPropertiesForOwner(owner: Owner | null, properties: PropertyWithOwners[]): LinkedPropertyItem[] {
  if (!owner) return [];
  return properties
    .map((property) => ({ property, links: property.property_owners.filter((link) => link.owner_id === owner.id && isActivePropertyOwnerLink(link)) }))
    .filter((item) => item.links.length > 0);
}

function getAvailablePropertiesForLink(owner: Owner | null, properties: PropertyWithOwners[], editingLink: EditingPropertyOwnerLink | null): PropertyWithOwners[] {
  if (!owner) return [];
  if (editingLink) return properties.filter((p) => p.id === editingLink.propertyId);
  return properties.filter((p) => !p.property_owners.some((link) => link.owner_id === owner.id && isActivePropertyOwnerLink(link)));
}

// ─── sub-components ──────────────────────────────────────────────────────────

type OwnerFormDialogProps = Readonly<{ owner: Owner | null; open: boolean; onOpenChange: (open: boolean) => void }>;

function OwnerFormDialog({ owner, open, onOpenChange }: OwnerFormDialogProps) {
  const [values, setValues] = useState<OwnerFormValues>(emptyOwnerFormValues);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof OwnerFormValues, string>>>({});
  const createOwner = useCreateOwner();
  const updateOwner = useUpdateOwner(owner?.id ?? '');
  const isEditing = Boolean(owner);
  const isPending = createOwner.isPending || updateOwner.isPending;

  useEffect(() => {
    if (open) { setValues(ownerToFormValues(owner)); setError(null); setFieldErrors({}); }
  }, [open, owner]);

  const setField = <K extends keyof OwnerFormValues>(field: K, value: OwnerFormValues[K]) => {
    setValues((cur) => ({ ...cur, [field]: value }));
    setError(null);
    setFieldErrors((cur) => ({ ...cur, [field]: undefined }));
  };

  const initialValues = useMemo(() => ownerToFormValues(owner), [owner]);
  const isDirty = useMemo(() => {
    return Object.keys(initialValues).some((key) => {
      const field = key as keyof OwnerFormValues;
      return (initialValues[field] ?? '') !== (values[field] ?? '');
    });
  }, [initialValues, values]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextFieldErrors = validateOwnerFormFields(values);
    const validationError = validateOwnerForm(values);
    setFieldErrors(nextFieldErrors);
    if (validationError) { setError(validationError); return; }
    const payload = {
      full_name: values.full_name, display_name: values.display_name, phone: values.phone,
      email: values.email, national_id: values.national_id, tax_number: values.tax_number,
      address: values.address, notes: values.notes, is_active: values.is_active,
    };
    try {
      if (owner) await updateOwner.mutateAsync(payload);
      else await createOwner.mutateAsync(payload);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ بيانات المالك. تحقق من الصلاحيات وحاول مرة أخرى.');
    }
  };

  return (
    <EntityForm.Overlay open={open} onOpenChange={onOpenChange} title={isEditing ? 'تعديل بيانات المالك' : 'إضافة مالك'} description="بيانات تعريفية خفيفة للملاك بدون إضافة أرصدة أو تسويات مالية." className="max-w-2xl" headerExtra={isDirty && !isPending ? <StatusBadge tone="gold">{translateSharedLabel('unsavedChanges', getAppLanguageState().language)}</StatusBadge> : undefined}>
      <EntityForm.Root onSubmit={handleSubmit}>
        <EntityForm.ErrorSummary message={error} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="اسم المالك *"><Input value={values.full_name} onChange={(e) => setField('full_name', e.target.value)} /><FieldError message={fieldErrors.full_name} /></Field>
          <Field label="الاسم المختصر"><Input value={values.display_name} onChange={(e) => setField('display_name', e.target.value)} /></Field>
          <Field label="الهاتف"><Input value={values.phone} onChange={(e) => setField('phone', e.target.value)} /><FieldError message={fieldErrors.phone} /></Field>
          <Field label="البريد الإلكتروني"><Input dir="ltr" value={values.email} onChange={(e) => setField('email', e.target.value)} /><FieldError message={fieldErrors.email} /></Field>
          <Field label="الرقم المدني"><Input value={values.national_id} onChange={(e) => setField('national_id', e.target.value)} /><FieldError message={fieldErrors.national_id} /></Field>
          <Field label="الرقم الضريبي"><Input value={values.tax_number} onChange={(e) => setField('tax_number', e.target.value)} /></Field>
        </div>
        <Field label="العنوان"><Textarea value={values.address} onChange={(e) => setField('address', e.target.value)} /></Field>
        <Field label="ملاحظات"><Textarea value={values.notes} onChange={(e) => setField('notes', e.target.value)} /></Field>
        <OwnerCheckbox checked={values.is_active} label="مالك نشط" onCheckedChange={(checked) => setField('is_active', checked)} />
        <EntityForm.Actions onCancel={() => onOpenChange(false)} isSubmitting={isPending} submitLabel={isEditing ? 'حفظ التعديلات' : 'إنشاء المالك'} />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

function OwnerContact({ owner }: Readonly<{ owner: Owner }>) {
  return <div className="space-y-1 text-sm"><div dir="ltr" className="text-right">{owner.phone ?? '—'}</div><div dir="ltr" className="text-right text-muted-foreground">{owner.email ?? '—'}</div></div>;
}

function OwnerPropertyLinks({ row }: Readonly<{ row: OwnerWorkspaceRow }>) {
  if (!row.properties.length) return <span className="text-muted-foreground">—</span>;
  return <div className="flex flex-wrap gap-2">{row.properties.map((p) => <Button key={`${row.owner.id}-${p.id}`} variant="secondary" className="min-h-11 px-3 text-xs" asChild><Link to="/properties/$propertyId" params={{ propertyId: p.id }}>{p.title}</Link></Button>)}</div>;
}

function OwnershipSummary({ row }: Readonly<{ row: OwnerWorkspaceRow }>) {
  if (!row.properties.length) return <span className="text-muted-foreground">—</span>;
  return <div className="space-y-1 text-xs text-muted-foreground">{row.properties.map((p) => <div key={`${row.owner.id}-${p.id}-ownership`}>{getOwnerPropertyOwnershipLabel(p)}</div>)}</div>;
}

// OwnerWorkspaceRowView inlined into EntityTable columns (see OwnerWorkspaceTable)

type OwnerWorkspaceTableProps = Readonly<{
  rows: OwnerWorkspaceRow[];
  search: string;
  selectedOwner: Owner | null;
  onCreateOwner: () => void;
  onEditOwner: (owner: Owner) => void;
  onSearchChange: (search: string) => void;
  onSelectOwner: (ownerId: string) => void;
}>;

function OwnerWorkspaceTable({ rows, search, selectedOwner, onCreateOwner, onEditOwner, onSearchChange, onSelectOwner }: OwnerWorkspaceTableProps) {
  const hasSearch = Boolean(search.trim());
  const emptyState = (
    <EmptyState
      title={hasSearch ? 'لا توجد نتائج مطابقة' : 'لا يوجد ملاك'}
      description={hasSearch ? 'جرّب البحث باسم أو هاتف أو بريد أو اسم عقار آخر.' : 'أضف أول مالك لبدء ربطه بالعقارات.'}
      action={hasSearch ? undefined : <Button onClick={onCreateOwner}>إضافة مالك</Button>}
    />
  );

  return (
    <div className="space-y-4">
      <FilterBar
        searchValue={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="بحث باسم المالك أو الهاتف أو الإيميل أو العقار"
        searchAriaLabel="بحث في الملاك"
      />
      {rows.length > 0 ? (
        <DataTable
          aria-label="جدول الملاك"
          rows={rows}
          onRowClick={(row) => onSelectOwner(row.owner.id)}
          columns={[
            { key: 'name', header: 'اسم المالك', render: (row) => (
              <EntityCell
                icon={Users}
                title={<button type="button" className="hover:text-primary text-start font-bold" onClick={() => onSelectOwner(row.owner.id)}>{getOwnerDisplayLabel(row.owner)}</button>}
                subtitle={row.owner.display_name ? row.owner.full_name : null}
                meta={<span dir="ltr">معرّف السجل: #{row.owner.id.slice(0, 8)}</span>}
              />
            )},
            { key: 'contact', header: 'الهاتف والإيميل', render: (row) => <OwnerContact owner={row.owner} /> },
            { key: 'property_count', header: 'عدد العقارات', render: (row) => formatCompanyNumber(defaultCompanyLocalSettings, row.propertyCount) },
            { key: 'property_links', header: 'أسماء العقارات', render: (row) => <OwnerPropertyLinks row={row} /> },
            { key: 'ownership', header: 'نسبة الملكية/الدور', render: (row) => <OwnershipSummary row={row} /> },
            { key: 'contracts', header: 'العقود النشطة', render: (row) => row.activeContractCount > 0 ? formatCompanyNumber(defaultCompanyLocalSettings, row.activeContractCount) : '—' },
            { key: 'actions', header: 'روابط آمنة', render: (row) => (
              <div className="flex" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <ActionMenu
                  label="إجراءات المالك"
                  items={[
                    { id: 'relationships', label: 'العلاقات', icon: LinkIcon, onClick: () => onSelectOwner(row.owner.id) },
                    { id: 'edit', label: 'تعديل', icon: Pencil, onClick: () => onEditOwner(row.owner) },
                  ]}
                />
              </div>
            )},
          ]}
          keyOf={(row) => row.owner.id}
          emptyTitle="لا يوجد ملاك"
          emptyDescription="أضف أول مالك لبدء ربطه بالعقارات."
          renderMobileCard={(row) => (
            <MobileCard
              title={getOwnerDisplayLabel(row.owner)}
              subtitle={row.owner.display_name ? row.owner.full_name : 'مالك'}
              badge={<span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">مالك</span>}
              meta={(
                <div className="space-y-1 text-xs text-muted-foreground">
                  {row.owner.phone ? <p dir="ltr">{row.owner.phone}</p> : null}
                  {row.owner.email ? <p dir="ltr" className="truncate">{row.owner.email}</p> : null}
                </div>
              )}
              stats={(
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span><Building2 className="me-1 inline size-3.5" />{formatCompanyNumber(defaultCompanyLocalSettings, row.propertyCount)} عقار</span>
                  <span className="font-bold text-primary">{formatCompanyNumber(defaultCompanyLocalSettings, row.activeContractCount)} عقد نشط</span>
                </div>
              )}
              actions={(
                <div className="grid w-full grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" className="min-h-11 text-xs" asChild><Link to="/owners/$ownerId" params={{ ownerId: row.owner.id }}><Eye className="me-1 size-4" />التفاصيل</Link></Button>
                  <Button type="button" variant="secondary" className="min-h-11 text-xs" asChild><Link to="/reports"><Eye className="me-1 size-4" />كشف الحساب</Link></Button>
                  <Button type="button" variant="secondary" className="min-h-11 text-xs" onClick={() => onSelectOwner(row.owner.id)}><LinkIcon className="me-1 size-4" />العلاقات</Button>
                  <Button type="button" variant="secondary" className="min-h-11 text-xs" onClick={() => onEditOwner(row.owner)}><Pencil className="me-1 size-4" />تعديل</Button>
                </div>
              )}
              onClick={() => onSelectOwner(row.owner.id)}
            />
          )}
        />
      ) : emptyState}
    </div>
  );
}

function OwnerRelationshipsList({ linkedProperties, endLinkPending, onEditLink, onEndLink }: Readonly<{ linkedProperties: LinkedPropertyItem[]; endLinkPending: boolean; onEditLink: (link: PropertyOwner) => void; onEndLink: (link: PropertyOwner) => void }>) {
  if (!linkedProperties.length) return <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">لا توجد عقارات مرتبطة بهذا المالك بعد.</p>;
  return (
    <>
      {linkedProperties.map(({ property, links }) =>
        links.map((link) => (
          <div key={link.id} className="rounded-2xl border border-border bg-muted/25 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-black">{property.title}</p><p className="text-xs text-muted-foreground">{property.address}</p></div>
              <StatusBadge tone={link.is_primary ? 'blue' : 'gray'}>{link.is_primary ? 'أساسي' : 'ثانوي'}</StatusBadge>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              <span>نسبة الملكية: <b className="text-foreground">{link.ownership_percentage}%</b></span>
              <span>من: <b className="text-foreground">{link.starts_on ?? '—'}</b></span>
              <span>إلى: <b className="text-foreground">{link.ends_on ?? '—'}</b></span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" className="min-h-11 px-3" onClick={() => onEditLink(link)}>تعديل العلاقة</Button>
              <Button type="button" variant="danger" className="min-h-11 px-3" disabled={endLinkPending} onClick={() => onEndLink(link)}>إنهاء العلاقة</Button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

type OwnershipLinkFormProps = Readonly<{
  values: PropertyOwnershipLinkFormValues;
  availableProperties: PropertyWithOwners[];
  editingLink: EditingPropertyOwnerLink | null;
  error: string | null;
  isSaving: boolean;
  onCancelEdit: () => void;
  onSubmit: (event: FormEvent) => void;
  onValueChange: <K extends keyof PropertyOwnershipLinkFormValues>(field: K, value: PropertyOwnershipLinkFormValues[K]) => void;
}>;

function OwnershipLinkForm({ values, availableProperties, editingLink, error, isSaving, onCancelEdit, onSubmit, onValueChange }: OwnershipLinkFormProps) {
  const isEditing = Boolean(editingLink);
  return (
    <EntityForm.Root onSubmit={onSubmit}>
      <EntityForm.ErrorSummary message={error} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <OwnerPropertySelect value={values.property_id} onValueChange={(propertyId) => onValueChange('property_id', propertyId)} disabled={isEditing || !availableProperties.length} properties={availableProperties} />
        <Input type="number" min="0.01" inputMode="decimal" max="100" step="0.01" value={values.ownership_percentage} onChange={(e) => onValueChange('ownership_percentage', e.target.value)} aria-label="نسبة الملكية" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="تاريخ البداية"><Input type="date" value={values.starts_on} onChange={(e) => onValueChange('starts_on', e.target.value)} /></Field>
        <Field label="تاريخ النهاية"><Input type="date" value={values.ends_on} onChange={(e) => onValueChange('ends_on', e.target.value)} /></Field>
      </div>
      <OwnerCheckbox checked={values.is_primary} label="مالك أساسي" onCheckedChange={(checked) => onValueChange('is_primary', checked)} className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 text-sm font-bold" />
      <EntityForm.Actions
        onCancel={onCancelEdit}
        isSubmitting={isSaving}
        submitDisabled={!values.property_id}
        submitLabel={isEditing ? 'حفظ علاقة الملكية' : 'ربط المالك بالعقار'}
      />
    </EntityForm.Root>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

export function OwnersPage() {
  const ownersQuery = useOwners();
  const propertiesQuery = usePropertiesWithOwners();
  const linkMutation = useLinkOwnerToProperty();
  const updateLinkMutation = useUpdatePropertyOwnerLink();
  const unlinkMutation = useUnlinkOwnerFromProperty();
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [linkFormValues, setLinkFormValues] = useState<PropertyOwnershipLinkFormValues>(emptyPropertyOwnershipLinkFormValues);
  const [linkFormError, setLinkFormError] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<EditingPropertyOwnerLink | null>(null);
  const [linkFormOpen, setLinkFormOpen] = useState(false);

  const owners = ownersQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties]);
  const activeContractsQuery = useOwnerActiveContracts(propertyIds);
  const activeContracts = activeContractsQuery.data ?? [];
  const isSavingLink = linkMutation.isPending || updateLinkMutation.isPending;
  const selectedOwner = owners.find((o) => o.id === selectedOwnerId) ?? owners[0] ?? null;
  const summary = useMemo(() => summarizeOwners(owners, properties), [owners, properties]);
  const ownerWorkspaceRows = useMemo(() => buildOwnerWorkspaceRows(owners, properties, activeContracts), [activeContracts, owners, properties]);
  const filteredOwnerRows = useMemo(() => filterOwnerWorkspaceRows(ownerWorkspaceRows, ownerSearch), [ownerSearch, ownerWorkspaceRows]);
  const linkedProperties = useMemo(() => getLinkedPropertiesForOwner(selectedOwner, properties), [properties, selectedOwner]);
  const availableProperties = useMemo(() => getAvailablePropertiesForLink(selectedOwner, properties, editingLink), [editingLink, properties, selectedOwner]);

  useEffect(() => {
    if (!selectedOwnerId && owners[0]) setSelectedOwnerId(owners[0].id);
  }, [owners, selectedOwnerId]);

  const openCreateForm = () => { setEditingOwner(null); setFormOpen(true); };
  const openEditForm = (owner: Owner) => { setEditingOwner(owner); setFormOpen(true); };
  const setLinkField = <K extends keyof PropertyOwnershipLinkFormValues>(field: K, value: PropertyOwnershipLinkFormValues[K]) => {
    setLinkFormValues((cur) => ({ ...cur, [field]: value })); setLinkFormError(null);
  };
  const beginEditLink = (link: PropertyOwner) => {
    setEditingLink({ id: link.id, propertyId: link.property_id, ownerId: link.owner_id });
    setLinkFormValues(propertyOwnerLinkToFormValues(link));
    setLinkFormError(null);
    setLinkFormOpen(true);
  };
  const resetLinkForm = () => { setEditingLink(null); setLinkFormValues(emptyPropertyOwnershipLinkFormValues); setLinkFormError(null); setLinkFormOpen(false); };
  const openLinkForm = () => {
    setEditingLink(null);
    setLinkFormValues(emptyPropertyOwnershipLinkFormValues);
    setLinkFormError(null);
    setLinkFormOpen(true);
  };
  const handleEndPropertyOwnership = async (link: PropertyOwner) => {
    try {
      await unlinkMutation.mutateAsync({ linkId: link.id, propertyId: link.property_id, ownerId: link.owner_id });
      if (editingLink?.id === link.id) resetLinkForm();
    } catch (error) {
      setLinkFormError(error instanceof Error ? error.message : 'تعذر إنهاء علاقة الملكية. تحقق من الصلاحيات وحاول مرة أخرى.');
    }
  };
  const handleLinkProperty = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedOwner) return;
    const validationError = validatePropertyOwnershipLinkForm(linkFormValues);
    if (validationError) { setLinkFormError(validationError); return; }
    try {
      if (editingLink) await updateLinkMutation.mutateAsync({ linkId: editingLink.id, payload: propertyOwnershipLinkFormToPayload(linkFormValues) });
      else await linkMutation.mutateAsync({ owner_id: selectedOwner.id, property_id: linkFormValues.property_id, ...propertyOwnershipLinkFormToPayload(linkFormValues) });
      resetLinkForm();
    } catch (error) {
      setLinkFormError(error instanceof Error ? error.message : 'تعذر حفظ علاقة الملكية. تحقق من الصلاحيات وحاول مرة أخرى.');
    }
  };

  const firstLoadError = ownersQuery.error ?? propertiesQuery.error ?? activeContractsQuery.error;
  const hasLoadError = ownersQuery.isError || propertiesQuery.isError || activeContractsQuery.isError;
  const retryOwnerWorkspace = async () => {
    await Promise.all([ownersQuery.refetch(), propertiesQuery.refetch(), activeContractsQuery.refetch()]);
  };

  if (ownersQuery.isLoading || propertiesQuery.isLoading || activeContractsQuery.isLoading || hasLoadError) {
    return (
      <AsyncContentState
        status={ownersQuery.isLoading || propertiesQuery.isLoading || activeContractsQuery.isLoading ? 'loading' : 'error'}
        error={firstLoadError}
        errorTitle="تعذر تحميل مساحة عمل الملاك"
        errorFallbackMessage={getOwnerPageErrorMessage(firstLoadError, 'حدث خطأ غير متوقع أثناء تحميل الملاك والعقارات المرتبطة.')}
        errorAction={<Button type="button" onClick={retryOwnerWorkspace}>إعادة المحاولة</Button>}
      >
        {null}
      </AsyncContentState>
    );
  }

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="إدارة الملاك"
        description="إدارة علاقات ملكية العقارات بشكل منفصل عن الحسابات والتسويات المالية."
        action={<Button onClick={openCreateForm}><Plus className="me-2 size-4" />إضافة مالك</Button>}
      />

      {/* KPI grid */}
      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي الملاك" value={summary.totalOwners} icon={Users} accent="primary" />
        <KpiCard label="الملاك النشطون" value={summary.activeOwners} icon={Users} accent="emerald" />
        <KpiCard label="عقارات مرتبطة" value={summary.linkedPropertiesCount} icon={Building2} accent="sky" />
        <KpiCard label="عقارات بلا مالك" value={summary.propertiesWithoutLinkedOwner} icon={LinkIcon} accent="amber" />
      </ResponsiveCardGrid>

      {/* Workspace */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(24rem,0.9fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>مساحة عمل الملاك</CardTitle>
            <CardDescription>ملخص آمن من بيانات الملاك والعقارات والعقود الحالية بدون أرصدة أو تسويات افتراضية.</CardDescription>
          </CardHeader>
          <CardContent>
            <OwnerWorkspaceTable
              rows={filteredOwnerRows}
              search={ownerSearch}
              selectedOwner={selectedOwner}
              onCreateOwner={openCreateForm}
              onEditOwner={openEditForm}
              onSearchChange={setOwnerSearch}
              onSelectOwner={setSelectedOwnerId}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>علاقات الملكية</CardTitle>
              <CardDescription>{selectedOwner ? `العقارات المرتبطة بـ ${getOwnerDisplayLabel(selectedOwner)}` : 'اختر مالكاً لعرض علاقات الملكية.'}</CardDescription>
            </div>
            <Button type="button" variant="secondary" disabled={!selectedOwner || availableProperties.length === 0} onClick={openLinkForm}>
              <Plus className="me-2 size-4" />ربط عقار
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedOwner ? (
              <>
                <div className="space-y-3">
                  <OwnerRelationshipsList linkedProperties={linkedProperties} endLinkPending={unlinkMutation.isPending} onEditLink={beginEditLink} onEndLink={handleEndPropertyOwnership} />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <OwnerFormDialog owner={editingOwner} open={formOpen} onOpenChange={setFormOpen} />
      <EntityForm.Overlay
        open={linkFormOpen}
        onOpenChange={(open) => { if (!open) resetLinkForm(); else setLinkFormOpen(true); }}
        title={editingLink ? 'تعديل علاقة الملكية' : 'ربط عقار بالمالك'}
        description={editingLink ? 'تحديث النسبة والتواريخ دون إنشاء سجل مالي.' : 'أضف علاقة ملكية مستقلة عن اتفاقية إدارة المكتب والحسابات المالية.'}
      >
        <OwnershipLinkForm values={linkFormValues} availableProperties={availableProperties} editingLink={editingLink} error={linkFormError} isSaving={isSavingLink} onCancelEdit={resetLinkForm} onSubmit={handleLinkProperty} onValueChange={setLinkField} />
      </EntityForm.Overlay>
    </PageLayout>
  );
}
