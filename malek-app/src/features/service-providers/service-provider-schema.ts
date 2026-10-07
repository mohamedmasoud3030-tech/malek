import { z } from 'zod';

const optionalText = (max: number, message: string) => z.string().trim().max(max, message).optional().or(z.literal(''));
const optionalEmail = z.string().trim().max(320, 'البريد الإلكتروني طويل جدًا').email('أدخل بريدًا إلكترونيًا صحيحًا').optional().or(z.literal(''));
const optionalWebsite = z.string().trim().max(500, 'رابط الموقع طويل جدًا').url('أدخل رابط موقع صحيحًا يبدأ بـ http:// أو https://').optional().or(z.literal(''));

export const serviceProviderFormSchema = z.object({
  name: z.string().trim().min(1, 'اسم مزود الخدمة مطلوب').max(200, 'اسم مزود الخدمة طويل جدًا'),
  legal_name: optionalText(200, 'الاسم القانوني طويل جدًا'),
  registration_number: optionalText(100, 'رقم السجل طويل جدًا'),
  tax_number: optionalText(100, 'الرقم الضريبي طويل جدًا'),
  contact_name: optionalText(200, 'اسم جهة الاتصال طويل جدًا'),
  phone: optionalText(50, 'رقم الهاتف طويل جدًا'),
  alternate_phone: optionalText(50, 'رقم الهاتف البديل طويل جدًا'),
  email: optionalEmail,
  website: optionalWebsite,
  address: optionalText(1000, 'العنوان طويل جدًا'),
  service_area: optionalText(500, 'نطاق الخدمة طويل جدًا'),
  availability_notes: optionalText(1000, 'ملاحظات التوفر طويلة جدًا'),
  notes: optionalText(2000, 'الملاحظات طويلة جدًا'),
  is_active: z.boolean(),
  category_ids: z.array(z.string().uuid('معرف نوع الخدمة غير صالح')).default([]),
});

export type ServiceProviderFormValues = z.infer<typeof serviceProviderFormSchema>;

export const serviceProviderCategorySchema = z.object({
  name: z.string().trim().min(1, 'اسم نوع الخدمة مطلوب').max(120, 'اسم نوع الخدمة طويل جدًا'),
  description: optionalText(500, 'وصف نوع الخدمة طويل جدًا'),
});

export type ServiceProviderCategoryValues = z.infer<typeof serviceProviderCategorySchema>;

export const emptyServiceProviderFormValues: ServiceProviderFormValues = {
  name: '',
  legal_name: '',
  registration_number: '',
  tax_number: '',
  contact_name: '',
  phone: '',
  alternate_phone: '',
  email: '',
  website: '',
  address: '',
  service_area: '',
  availability_notes: '',
  notes: '',
  is_active: true,
  category_ids: [],
};
