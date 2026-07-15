import { useMemo, useState } from 'react';
import { Eye, ExternalLink, FileText, Filter, FolderKanban, Image as ImageIcon, Paperclip, Printer, Search, UploadCloud } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileAttachmentField } from '@/components/ui/file-attachment-field';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { DocumentTemplates, type DocumentSettings } from '@/services/documents/DocumentTemplates';
import {
  listVaultDocuments,
  vaultCategoryLabels,
  type VaultCategory,
  type VaultDocumentItem,
} from './documents-vault-service';

const defaultSettings: DocumentSettings = {
  company: {
    name: 'رينتريكس لإدارة العقارات',
    address: 'سلطنة عمان - مسقط',
    phone: '+968 24000000',
  },
  currency: 'OMR',
  currencySymbol: 'ر.ع',
};

export function DocumentsVaultPage() {
  const [selectedCategory, setSelectedCategory] = useState<VaultCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<VaultDocumentItem | null>(null);

  const [documents] = useState<VaultDocumentItem[]>(() => [
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
  ]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (selectedCategory !== 'all' && doc.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          doc.title.toLowerCase().includes(query) ||
          doc.relatedEntityTitle.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [documents, selectedCategory, searchQuery]);

  const totalPdfs = useMemo(() => documents.filter((d) => d.fileType === 'pdf').length, [documents]);
  const totalImages = useMemo(() => documents.filter((d) => d.fileType === 'image').length, [documents]);

  const handlePrintVaultReport = () => {
    DocumentTemplates.renderReportPdf(
      {
        reportTitle: 'سجل وأرشيف المرفقات والمستندات الرسمية',
        reportType: 'Document_Vault_Archive_Report',
        periodFrom: new Date().toISOString().slice(0, 10),
        periodTo: new Date().toISOString().slice(0, 10),
        sections: [
          {
            title: 'جدول المستندات والمرفقات الموثوقة المحفوظة في النظام',
            rows: filteredDocuments.map((d) => ({
              label: `${d.title} - [${vaultCategoryLabels[d.category]}]`,
              value: `الجهة المرتبطة: ${d.relatedEntityTitle} | النوع: ${d.fileType.toUpperCase()} | تاريخ الرفع: ${d.uploadedAt}`,
            })),
            totals: ['إجمالي المستندات المؤرشفة', `${filteredDocuments.length} مستند محفوظ`],
          },
        ],
        totalSummary: `إجمالي المستندات المحفوظة: ${documents.length} | ملفات PDF: ${totalPdfs} | صور ممسوحة ضوئياً: ${totalImages}`,
      },
      defaultSettings,
    );
  };

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="خزينة المستندات والمرفقات"
        description="الأرشيف المركزي لكافة العقود، بطاقات الهوية، الإيصالات، صور الصيانة، وفواتير المرافق المحفوظة بأمان."
        primaryAction={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handlePrintVaultReport} className="min-h-11 gap-2 font-bold">
              <Printer className="size-4 text-primary" aria-hidden="true" />
              طباعة أرشيف المستندات A4
            </Button>
          </div>
        }
      />

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي المستندات" value={documents.length.toLocaleString('ar')} icon={FolderKanban} accent="primary" sub="كل الملفات المحفوظة" />
        <KpiCard label="عقود وإثباتات PDF" value={totalPdfs.toLocaleString('ar')} icon={FileText} accent="sky" sub="مستندات معتمدة" />
        <KpiCard label="صور وبلاغات مرفقة" value={totalImages.toLocaleString('ar')} icon={ImageIcon} accent="emerald" sub="معاينات بصرية" />
        <KpiCard label="سعة التخزين المستغلة" value="~ 2.8 MB" icon={UploadCloud} accent="amber" sub="ضمن السحابة الآمنة" />
      </ResponsiveCardGrid>

      {/* Upload Box Container */}
      <Card className="border-border/60">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
          <CardTitle className="text-sm font-black">رفع مستند أو مرفق جديد للخزينة</CardTitle>
          <CardDescription>ارفع صور الهويات، العقود الموقعة، أو الفواتير لحفظها وأرصفتها آلياً.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <FileAttachmentField
            label="اختر أو اسحب ملف المستند (PDF أو صورة)"
            value={uploadedUrl}
            onChange={(url) => setUploadedUrl(url)}
          />
        </CardContent>
      </Card>

      {/* Search & Categories Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم المستند أو العقار أو المستأجر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pe-3 ps-9"
          />
        </div>
        <div className="w-56">
          <Select
            aria-label="تصفية حسب القسم"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as VaultCategory)}
          >
            {Object.entries(vaultCategoryLabels).map(([cat, label]) => (
              <option key={cat} value={cat}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredDocuments.map((doc) => (
          <Card key={doc.id} className="border-border/60 overflow-hidden hover:border-primary/40 transition">
            <CardHeader className="bg-muted/15 border-b border-border/50 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-bold">{doc.title}</CardTitle>
                  <CardDescription className="text-xs mt-1">{doc.relatedEntityTitle}</CardDescription>
                </div>
                <StatusBadge tone={doc.fileType === 'pdf' ? 'blue' : 'gold'}>
                  {doc.fileType.toUpperCase()}
                </StatusBadge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="aspect-video w-full rounded-xl border border-border bg-muted/30 grid place-items-center overflow-hidden">
                {doc.fileType === 'image' ? (
                  <img src={doc.fileUrl} alt={doc.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FileText className="size-8 text-primary" />
                    <span className="text-xs font-bold">ملف PDF محفوظ</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>تاريخ الرفع: {doc.uploadedAt}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewItem(doc)}
                    className="h-8 px-2 text-xs gap-1"
                  >
                    <Eye className="size-3.5" />
                    معاينة
                  </Button>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline h-8 px-2"
                  >
                    <ExternalLink className="size-3.5" />
                    فتح
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredDocuments.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            <Paperclip className="size-8 mx-auto mb-2 opacity-50" />
            <p className="font-bold text-sm">لا توجد مستندات تطابق شروط البحث أو الفلترة.</p>
          </div>
        ) : null}
      </div>

      {/* Preview Modal Overlay */}
      {previewItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-background border border-border p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-black text-base">{previewItem.title}</h3>
              <Button size="sm" variant="ghost" onClick={() => setPreviewItem(null)}>
                إغلاق
              </Button>
            </div>
            <div className="aspect-video w-full rounded-2xl border border-border bg-muted/20 grid place-items-center overflow-hidden">
              {previewItem.fileType === 'image' ? (
                <img src={previewItem.fileUrl} alt={previewItem.title} className="max-h-80 object-contain" />
              ) : (
                <div className="text-center space-y-3 p-6">
                  <FileText className="size-16 text-primary mx-auto" />
                  <p className="font-bold text-sm">{previewItem.title}</p>
                  <a
                    href={previewItem.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-bold"
                  >
                    تحميل / فتح المستند في نافذة جديدة
                    <ExternalLink className="size-4" />
                  </a>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>القسم: {vaultCategoryLabels[previewItem.category]}</span>
              <span>تاريخ الأرشفة: {previewItem.uploadedAt}</span>
            </div>
          </div>
        </div>
      ) : null}
    </PageLayout>
  );
}

export default DocumentsVaultPage;
