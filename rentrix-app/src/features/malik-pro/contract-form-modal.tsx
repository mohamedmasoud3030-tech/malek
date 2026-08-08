/*
 * ============================================
 * MALIK PRO - Contract Creation Modal
 * إبرام عقد إيجار موحد جديد
 * ============================================
 */

import { useState } from 'react';
import { Building2, Calendar, User, Phone, CreditCard, RefreshCw } from 'lucide-react';
import {
  MalikModal,
  MalikModalBody,
  MalikModalFooter,
  MalikButton,
  MalikInput,
  MalikSelect,
  MalikCheckbox,
  MalikFormGrid,
  MalikFormSection,
  MalikInfoCard,
} from '@/components/malik-pro';
import type { Property, Unit, Person } from '@/types/domain';

export interface ContractFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  units: Unit[];
  tenants: Person[];
  onSubmit: (data: ContractFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface ContractFormData {
  property_id: string;
  unit_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_id_number: string;
  payment_cycle: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  start_date: string;
  end_date: string;
  rent_amount: number;
  security_deposit: number;
  auto_renewal: boolean;
}

const paymentCycleOptions = [
  { value: 'monthly', label: 'شهري' },
  { value: 'quarterly', label: 'ربع سنوي' },
  { value: 'semi_annual', label: 'نصف سنوي' },
  { value: 'annual', label: 'سنوي' },
];

export function ContractFormModal({
  open,
  onOpenChange,
  properties,
  units,
  tenants,
  onSubmit,
  isSubmitting = false,
}: ContractFormModalProps) {
  const [formData, setFormData] = useState<Partial<ContractFormData>>({
    payment_cycle: 'monthly',
    auto_renewal: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.title,
  }));

  const unitOptions = units.map((u) => ({
    value: u.id,
    label: u.unit_number,
  }));

  const handleChange = (field: keyof ContractFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.property_id) newErrors.property_id = 'اختر العقار';
    if (!formData.unit_id) newErrors.unit_id = 'اختر الوحدة';
    if (!formData.tenant_name?.trim()) newErrors.tenant_name = 'أدخل اسم المستأجر';
    if (!formData.tenant_phone?.trim()) newErrors.tenant_phone = 'أدخل رقم الهاتف';
    if (!formData.tenant_id_number?.trim()) newErrors.tenant_id_number = 'أدخل الرقم المدني';
    if (!formData.start_date) newErrors.start_date = 'اختر تاريخ البداية';
    if (!formData.end_date) newErrors.end_date = 'اختر تاريخ النهاية';
    if (!formData.rent_amount || Number(formData.rent_amount) <= 0) {
      newErrors.rent_amount = 'أدخل قيمة الإيجار';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    
    await onSubmit(formData as ContractFormData);
    // Reset form on success
    setFormData({
      payment_cycle: 'monthly',
      auto_renewal: false,
    });
  };

  const selectedProperty = properties.find((p) => p.id === formData.property_id);

  return (
    <MalikModal
      open={open}
      onOpenChange={onOpenChange}
      title="إبرام عقد إيجار موحد جديد"
      description="أدخل بيانات العقد والمستأجر والمواصفات المالية"
      size="xl"
      footer={
        <>
          <MalikButton
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            إلغاء
          </MalikButton>
          <MalikButton
            variant="primary"
            onClick={handleSubmit}
            loading={isSubmitting}
            leftIcon={<CreditCard className="size-4" />}
          >
            {isSubmitting ? 'جارٍ الحفظ...' : 'تأكيد العقد'}
          </MalikButton>
        </>
      }
    >
      <MalikModalBody className="space-y-6">
        {/* Property & Unit Selection */}
        <MalikFormSection
          title="الموقع والعقار"
          description="اختر العقار والوحدة المرتبطة بالعقد"
        >
          <MalikFormGrid>
            <MalikSelect
              name="property_id"
              label="العقار *"
              placeholder="اختر العقار"
              options={propertyOptions}
              value={formData.property_id || ''}
              onChange={(e) => handleChange('property_id', e.target.value)}
              error={errors.property_id}
              required
            />

            <MalikSelect
              name="unit_id"
              label="الوحدة *"
              placeholder="اختر الوحدة"
              options={unitOptions}
              value={formData.unit_id || ''}
              onChange={(e) => handleChange('unit_id', e.target.value)}
              error={errors.unit_id}
              required
            />
          </MalikFormGrid>

          {/* Property Summary Card */}
          {selectedProperty && (
            <div className="mt-4 p-4 bg-[hsl(var(--malik-muted))] rounded-xl border border-[hsl(var(--malik-border-light))]">
              <p className="text-xs font-bold text-[hsl(var(--malik-foreground-muted))] mb-2">
                ملخص العقار المحدد
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MalikInfoCard label="اسم العقار" value={selectedProperty.title} />
                <MalikInfoCard label="النوع" value={selectedProperty.type || 'سكني'} />
                <MalikInfoCard label="الحالة" value="متاح" />
                <MalikInfoCard label="الموقع" value={selectedProperty.location || '—'} />
              </div>
            </div>
          )}
        </MalikFormSection>

        {/* Tenant Information */}
        <MalikFormSection
          title="بيانات المستأجر"
          description="معلومات المستأجر الثلاثية وبيانات التواصل"
        >
          <MalikFormGrid>
            <MalikInput
              name="tenant_name"
              label="اسم المستأجر الثلاثي *"
              placeholder="مثال: أحمد محمد علي"
              value={formData.tenant_name || ''}
              onChange={(e) => handleChange('tenant_name', e.target.value)}
              error={errors.tenant_name}
              leftIcon={<User className="size-4 text-[hsl(var(--malik-foreground-muted))]" />}
              required
            />

            <MalikInput
              name="tenant_phone"
              label="رقم الهاتف *"
              type="tel"
              placeholder="+968 XXXX XXXX"
              value={formData.tenant_phone || ''}
              onChange={(e) => handleChange('tenant_phone', e.target.value)}
              error={errors.tenant_phone}
              leftIcon={<Phone className="size-4 text-[hsl(var(--malik-foreground-muted))]" />}
              required
            />

            <div className="sm:col-span-2">
              <MalikInput
                name="tenant_id_number"
                label="الرقم المدني / السجل التجاري *"
                placeholder="أدخل الرقم"
                value={formData.tenant_id_number || ''}
                onChange={(e) => handleChange('tenant_id_number', e.target.value)}
                error={errors.tenant_id_number}
                required
              />
            </div>
          </MalikFormGrid>
        </MalikFormSection>

        {/* Contract Terms */}
        <MalikFormSection
          title="بنود العقد"
          description="مدة الإيجار ودورية السداد والتكلفة"
        >
          <MalikFormGrid>
            <MalikSelect
              name="payment_cycle"
              label="دورية السداد *"
              options={paymentCycleOptions}
              value={formData.payment_cycle || 'monthly'}
              onChange={(e) => handleChange('payment_cycle', e.target.value)}
              required
            />

            <MalikInput
              name="rent_amount"
              label="قيمة الإيجار المستحق (ر.ع) *"
              type="number"
              placeholder="0.00"
              min="0"
              step="0.001"
              value={formData.rent_amount || ''}
              onChange={(e) => handleChange('rent_amount', parseFloat(e.target.value) || 0)}
              error={errors.rent_amount}
              required
            />

            <MalikInput
              name="start_date"
              label="تاريخ بداية العقد *"
              type="date"
              value={formData.start_date || ''}
              onChange={(e) => handleChange('start_date', e.target.value)}
              error={errors.start_date}
              leftIcon={<Calendar className="size-4 text-[hsl(var(--malik-foreground-muted))]" />}
              required
            />

            <MalikInput
              name="end_date"
              label="تاريخ نهاية العقد *"
              type="date"
              value={formData.end_date || ''}
              onChange={(e) => handleChange('end_date', e.target.value)}
              error={errors.end_date}
              leftIcon={<Calendar className="size-4 text-[hsl(var(--malik-foreground-muted))]" />}
              required
            />

            <div className="sm:col-span-2">
              <MalikInput
                name="security_deposit"
                label="مبلغ التأمين المالي (ر.ع)"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.001"
                value={formData.security_deposit || ''}
                onChange={(e) => handleChange('security_deposit', parseFloat(e.target.value) || 0)}
                hint="مبلغ التأمين يبقى محفوظاً حتى نهاية العقد"
              />
            </div>
          </MalikFormGrid>
        </MalikFormSection>

        {/* Auto Renewal Option */}
        <div className="p-4 bg-[hsl(var(--malik-muted))] rounded-xl border border-[hsl(var(--malik-border-light))]">
          <MalikCheckbox
            name="auto_renewal"
            label="تفعيل التجديد التلقائي للعقد"
            description="سيتم تجديد العقد تلقائياً بنفس الشروط عند انتهاء مدته"
            checked={formData.auto_renewal || false}
            onChange={(e) => handleChange('auto_renewal', e.target.checked)}
          />
        </div>

        {/* Contract Summary */}
        {formData.rent_amount && (
          <div className="p-4 bg-gradient-to-r from-[hsl(var(--malik-primary-soft))] to-[hsl(var(--malik-secondary-soft))] rounded-xl border border-[hsl(var(--malik-primary)/0.2)]">
            <p className="text-xs font-bold text-[hsl(var(--malik-primary-dark))] mb-3">
              ملخص الالتزامات المالية
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-[10px] font-medium text-[hsl(var(--malik-foreground-muted))]">قيمة الإيجار</p>
                <p className="text-lg font-black text-[hsl(var(--malik-primary))]">
                  ر.ع {Number(formData.rent_amount).toLocaleString('ar-OM', { minimumFractionDigits: 3 })}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-[hsl(var(--malik-foreground-muted))]">دورية الدفع</p>
                <p className="text-lg font-black text-[hsl(var(--malik-foreground))]">
                  {paymentCycleOptions.find((o) => o.value === formData.payment_cycle)?.label}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-[hsl(var(--malik-foreground-muted))]">التأمين</p>
                <p className="text-lg font-black text-[hsl(var(--malik-foreground))]">
                  ر.ع {Number(formData.security_deposit || 0).toLocaleString('ar-OM', { minimumFractionDigits: 3 })}
                </p>
              </div>
            </div>
          </div>
        )}
      </MalikModalBody>
    </MalikModal>
  );
}
