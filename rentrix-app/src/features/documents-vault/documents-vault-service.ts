export type VaultCategory = 'all' | 'contracts' | 'identity' | 'receipts' | 'maintenance' | 'expenses' | 'utilities';

export type VaultDocumentItem = {
  id: string;
  title: string;
  category: VaultCategory;
  relatedEntityTitle: string;
  relatedEntityHref?: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  uploadedAt: string;
  fileSizeBytes?: number;
};

export const vaultCategoryLabels: Record<VaultCategory, string> = {
  all: 'كل المرفقات والمستندات',
  contracts: 'عقود وإتفاقيات',
  identity: 'هويات وإثباتات',
  receipts: 'إيصالات وسدادات',
  maintenance: 'صيانة وبلاغات',
  expenses: 'مصروفات وفواتير',
  utilities: 'عدادات ومرافق',
};

export async function listVaultDocuments(category: VaultCategory = 'all'): Promise<VaultDocumentItem[]> {
  const allDocs: VaultDocumentItem[] = [
    {
      id: 'doc-1',
      title: 'عقد إيجار موثق - شقة 102',
      category: 'contracts',
      relatedEntityTitle: 'برج النيل / شقة 102',
      fileUrl: 'https://placehold.co/600x800/png?text=Contract+PDF',
      fileType: 'pdf',
      uploadedAt: '2026-06-01',
      fileSizeBytes: 1024 * 450,
    },
    {
      id: 'doc-2',
      title: 'بطاقة مقيم / إثبات مستأجر - أحمد علي',
      category: 'identity',
      relatedEntityTitle: 'أحمد علي (مستأجر)',
      fileUrl: 'https://placehold.co/800x600/png?text=ID+Card+Scan',
      fileType: 'image',
      uploadedAt: '2026-06-02',
      fileSizeBytes: 1024 * 820,
    },
    {
      id: 'doc-3',
      title: 'صورة عطل مصعد المبنى الرئيسي',
      category: 'maintenance',
      relatedEntityTitle: 'طلب صيانة #M-8012',
      fileUrl: 'https://placehold.co/800x600/png?text=Maintenance+Photo',
      fileType: 'image',
      uploadedAt: '2026-06-15',
      fileSizeBytes: 1024 * 1200,
    },
    {
      id: 'doc-4',
      title: 'إيصال استلام نقدية - دفعة يونيو',
      category: 'receipts',
      relatedEntityTitle: 'إيصال #REC-0092',
      fileUrl: 'https://placehold.co/600x800/png?text=Receipt+PDF',
      fileType: 'pdf',
      uploadedAt: '2026-06-20',
      fileSizeBytes: 1024 * 310,
    },
  ];

  if (category === 'all') return allDocs;
  return allDocs.filter((doc) => doc.category === category);
}
