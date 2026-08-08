/*
 * ============================================
 * MALIK PRO - Maintenance Request Modal
 * تسجيل بلاغ صيانة جديد
 * ============================================
 */

import { useState } from 'react';
import { 
  Wrench, 
  Building2, 
  Home, 
  User, 
  AlertTriangle,
  DollarSign,
  FileText,
} from 'lucide-react';
import {
  MalikModal,
  MalikButton,
  MalikInput,
  MalikSelect,
  MalikTextarea,
  MalikRadioGroup,
  MalikFormGrid,
  MalikFormSection,
  MalikStatusBadge,
  MalikRadioOption,
} from '@/components/malik-pro';
import type { Property, Unit } from '@/types/domain';

export interface MaintenanceRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  units: Unit[];
  onSubmit: (data: MaintenanceFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export interface MaintenanceFormData {
  property_id: string;
  unit_id: string;
  complainant_name: string;
  maintenance_type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_cost: number;
  cost_responsibility: 'tenant' | 'owner' | 'company';
}

const maintenanceTypeOptions = [
  { value: 'ac', label: 'تكييف وتبريد' },
  { value: 'plumbing', label: 'سباكة' },
  { value: 'electrical', label: 'كهرباء' },
  { value: 'structural', label: 'إنشائي' },
  { value: 'pest_control', label: 'مكافحة حشرات' },
  { value: 'cleaning', label: 'تنظيف' },
  { value: 'other', label: 'أخرى' },
];

const priorityOptions: MalikRadioOption[] = [
  {
    value: 'low',
    label: 'منخفضة',
    description: 'لا يحتاج استعجال',
  },
  {
    value: 'medium',
    label: 'متوسطة',
    description: 'خلال أيام قليلة',
  },
  {
    value: 'high',
    label: 'عالية',
    description: 'خلال 24-48 ساعة',
  },
  {
    value: 'urgent',
    label: 'عاجلة',
    description: 'يتطلب تدخل فوري',
    icon: <AlertTriangle className="size-5 text-[hsl(var(--malik-danger))]" />,
  },
];

const costResponsibilityOptions: MalikRadioOption[] = [
  {
    value: 'tenant',
    label: 'المستأجر',
    description: 'فاتورة على المستأجر',
    icon: <User className="size-5" />,
  },
  {
    value: 'owner',
    label: 'المالك',
    description: 'خصم من تسوية المالك',
    icon: <Building2 className="size-5" />,
  },
  {
    value: 'company',
    label: 'الشركة',
    description: 'مصاريف تشغيلية',
    icon: <DollarSign className="size-5" />,
  },
];

export function MaintenanceRequestModal({
  open,
  onOpenChange,
  properties,
  units,
  onSubmit,
  isSubmitting = false,
}: MaintenanceRequestModalProps) {
  const [formData, setFormData] = useState<Partial<MaintenanceFormData>>({
    priority: 'medium',
    cost_responsibility: 'company',
    maintenance_type: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.title,
  }));

  const filteredUnits = units.filter((u) => u.property_id === formData.property_id);
  const unitOptions = filteredUnits.map((u) => ({
    value: u.id,
    label: u.unit_number,
  }));

  const handleChange = (field: keyof MaintenanceFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
    if (!formData.complainant_name?.trim()) newErrors.complainant_name = 'أدخل اسم المشتكي';
    if (!formData.maintenance_type) newErrors.maintenance_type = 'اختر نوع الصيانة';
    if (!formData.title?.trim()) newErrors.title = 'أدخل عنوان المشكلة';
    if (!formData.priority) newErrors.priority = 'حدد درجة الأهمية';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSubmit(formData as MaintenanceFormData);
    // Reset form
    setFormData({
      priority: 'medium',
      cost_responsibility: 'company',
      maintenance_type: '',
    });
  };

  const selectedPriority = formData.priority || 'medium';
  const priorityBadgeVariant = {
    low: 'neutral',
    medium: 'info',
    high: 'warning',
    urgent: 'danger',
  } as const;

  return (
    <MalikModal
      open={open}
      onOpenChange={onOpenChange}
      title="تسجيل بلاغ صيانة جديد"
      description="أبلغ عن مشكلة صيانة أو عطل في الوحدة العقارية"
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
            variant="secondary"
            onClick={handleSubmit}
            loading={isSubmitting}
            leftIcon={<Wrench className="size-4" />}
          >
            {isSubmitting ? 'جارٍ التسجيل...' : 'تسجيل البلاغ'}
          </MalikButton>
        </>
      }
    >
      <div className="space-y-6">
        {/* Location Section */}
        <MalikFormSection
          title="موقع المشكلة"
          description="حدد العقار والوحدة التي توجد بها المشكلة"
        >
          <MalikFormGrid>
            <MalikSelect
              name="property_id"
              label="العقار *"
              placeholder="اختر العقار"
              options={propertyOptions}
              value={formData.property_id || ''}
              onChange={(e) => {
                handleChange('property_id', e.target.value);
                handleChange('unit_id', '');
              }}
              error={errors.property_id}
              required
            />

            <MalikSelect
              name="unit_id"
              label="رقم الوحدة *"
              placeholder={formData.property_id ? 'اختر الوحدة' : 'اختر العقار أولاً'}
              options={unitOptions}
              value={formData.unit_id || ''}
              onChange={(e) => handleChange('unit_id', e.target.value)}
              error={errors.unit_id}
              disabled={!formData.property_id}
              required
            />
          </MalikFormGrid>
        </MalikFormSection>

        {/* Complainant & Type Section */}
        <MalikFormSection
          title="بيانات المشتكي ونوع الصيانة"
          description="معلومات المُبلِّغ ونوع المشكلة"
        >
          <MalikFormGrid>
            <MalikInput
              name="complainant_name"
              label="اسم المشتكي/المستأجر *"
              placeholder="أدخل الاسم الكامل"
              value={formData.complainant_name || ''}
              onChange={(e) => handleChange('complainant_name', e.target.value)}
              error={errors.complainant_name}
              leftIcon={<User className="size-4 text-[hsl(var(--malik-foreground-muted))]" />}
              required
            />

            <MalikSelect
              name="maintenance_type"
              label="نوع الصيانة *"
              placeholder="اختر نوع الصيانة"
              options={maintenanceTypeOptions}
              value={formData.maintenance_type || ''}
              onChange={(e) => handleChange('maintenance_type', e.target.value)}
              error={errors.maintenance_type}
              required
            />
          </MalikFormGrid>
        </MalikFormSection>

        {/* Issue Details Section */}
        <MalikFormSection
          title="تفاصيل المشكلة"
          description="اكتب عنواناً واضحاً ووصفاً تفصيلياً للمشكلة"
        >
          <div className="space-y-4">
            <MalikInput
              name="title"
              label="عنوان المشكلة *"
              placeholder="مثال: تسريب مياه من صنبور المطبخ"
              value={formData.title || ''}
              onChange={(e) => handleChange('title', e.target.value)}
              error={errors.title}
              leftIcon={<AlertTriangle className="size-4 text-[hsl(var(--malik-foreground-muted))]" />}
              required
            />

            <MalikTextarea
              name="description"
              label="وصف وتفاصيل العطل"
              placeholder="اشرح المشكلة بالتفصيل: متى بدأت، مدى خطورتها، أي معلومات إضافية مفيدة..."
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </MalikFormSection>

        {/* Priority & Cost Section */}
        <MalikFormSection
          title="درجة الأهمية والتكلفة"
          description="حدد مدى استعجال المشكلة والجهة المسؤولة عن التكلفة"
        >
          <div className="space-y-6">
            {/* Priority Selection */}
            <div>
              <label className="block text-sm font-bold mb-3">
                درجة الأهمية *
              </label>
              <MalikRadioGroup
                name="priority"
                options={priorityOptions}
                value={selectedPriority}
                onChange={(value) => handleChange('priority', value)}
              />
              {errors.priority && (
                <p className="mt-2 text-xs text-[hsl(var(--malik-danger))]">{errors.priority}</p>
              )}
            </div>

            {/* Cost Responsibility */}
            <div>
              <label className="block text-sm font-bold mb-3">
                الجهة المسؤولة عن التكلفة
              </label>
              <MalikRadioGroup
                name="cost_responsibility"
                options={costResponsibilityOptions}
                value={formData.cost_responsibility || 'company'}
                onChange={(value) => handleChange('cost_responsibility', value)}
              />
            </div>

            {/* Estimated Cost */}
            <MalikInput
              name="estimated_cost"
              label="التكلفة المتوقعة (ر.ع)"
              type="number"
              placeholder="0.00"
              min="0"
              step="0.001"
              value={formData.estimated_cost || ''}
              onChange={(e) => handleChange('estimated_cost', parseFloat(e.target.value) || 0)}
              hint="تقدير أولي لتكلفة الإصلاح"
              leftIcon={<DollarSign className="size-4 text-[hsl(var(--malik-foreground-muted))]" />}
            />
          </div>
        </MalikFormSection>

        {/* Summary Preview */}
        <div className="p-4 bg-[hsl(var(--malik-muted))] rounded-xl border border-[hsl(var(--malik-border-light))]">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-4 text-[hsl(var(--malik-foreground-muted))]" />
            <p className="text-xs font-bold text-[hsl(var(--malik-foreground-muted))]">
              معاينة البلاغ
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {formData.maintenance_type && (
              <MalikStatusBadge
                status={maintenanceTypeOptions.find((t) => t.value === formData.maintenance_type)?.value as 'ac' | 'plumbing' | 'electrical' | 'structural' | 'pest_control' | 'cleaning' | 'other' || 'other'}
              >
                {maintenanceTypeOptions.find((t) => t.value === formData.maintenance_type)?.label}
              </MalikStatusBadge>
            )}
            {formData.priority && (
              <MalikStatusBadge status={formData.priority}>
                {priorityOptions.find((p) => p.value === formData.priority)?.label}
              </MalikStatusBadge>
            )}
            {formData.title && (
              <span className="text-sm font-medium text-[hsl(var(--malik-foreground))]">
                {formData.title}
              </span>
            )}
          </div>
        </div>
      </div>
    </MalikModal>
  );
}
