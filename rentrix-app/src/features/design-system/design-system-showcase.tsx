import { Check, Mail, Plus, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Skeleton,
  Spinner,
  StatusBadge,
  StatusBadgePill,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableEmpty,
  TableError,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  TextAreaField,
  TextField,
  Typography,
} from '@/components/ui';
import { useUiStore } from '@/store/ui-store';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <Typography variant="h4">{title}</Typography>
        {description ? <Typography variant="caption">{description}</Typography> : null}
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-5">{children}</CardContent>
      </Card>
    </section>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="size-12 rounded-lg border border-border shadow-sm" style={{ background: value }} aria-hidden="true" />
      <div>
        <p className="text-xs font-bold">{name}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function useSwatches(theme: 'light' | 'dark') {
  const [swatches, setSwatches] = useState<Array<{ name: string; value: string }>>([]);
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (v: string) => {
      const raw = styles.getPropertyValue(v).trim();
      return raw.startsWith('hsl') || raw.startsWith('#') ? raw : `hsl(${raw})`;
    };
    setSwatches([
      { name: 'primary', value: read('--color-primary') },
      { name: 'background', value: read('--color-background') },
      { name: 'card', value: read('--color-card') },
      { name: 'success', value: read('--color-success') },
      { name: 'warning', value: read('--color-warning') },
      { name: 'danger', value: read('--color-danger') },
      { name: 'info', value: read('--color-info') },
      { name: 'financial-positive', value: read('--color-financial-positive') },
      { name: 'financial-negative', value: read('--color-financial-negative') },
      { name: 'financial-neutral', value: read('--color-financial-neutral') },
    ]);
  }, [theme]);
  return swatches;
}

export function DesignSystemShowcase() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const swatches = useSwatches(theme);
  const [dir, setDir] = useState<'rtl' | 'ltr'>(document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl');

  const toggleDir = () => {
    const next = dir === 'rtl' ? 'ltr' : 'rtl';
    document.documentElement.dir = next;
    setDir(next);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6">
      <header className="space-y-2">
        <Typography variant="display" className="text-3xl">
          MALEK Design System
        </Typography>
        <Typography variant="subtitle">
          Wave 3 foundation — معرض المطورين فقط (development-only). لا يظهر في التنقل الإنتاجي.
        </Typography>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="secondary" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          </Button>
          <Button size="sm" variant="outline" onClick={toggleDir}>
            الاتجاه: {dir.toUpperCase()}
          </Button>
        </div>
      </header>

      <Section title="Tokens — الألوان" description="Semantic + financial tokens (Light/Dark)">
        {swatches.map((s) => (
          <Swatch key={s.name} {...s} />
        ))}
      </Section>

      <Section title="Typography">
        <div className="w-full space-y-2">
          <Typography variant="display">Display</Typography>
          <Typography variant="h1">Heading 1</Typography>
          <Typography variant="h2">Heading 2</Typography>
          <Typography variant="h3">Heading 3</Typography>
          <Typography variant="title">Title</Typography>
          <Typography variant="subtitle">Subtitle</Typography>
          <Typography variant="body-lg">Body Large — كل أملاكك في مكان واحد</Typography>
          <Typography variant="body">Body — كل أملاكك في مكان واحد</Typography>
          <Typography variant="caption">Caption</Typography>
          <Typography variant="overline">Overline</Typography>
          <Typography variant="mono">Mono — 1,234.56</Typography>
        </div>
      </Section>

      <Section title="Buttons" description="Variants · sizes · states · icons · loading">
        <Button type="button">أساسي</Button>
        <Button type="button" variant="secondary">ثانوي</Button>
        <Button type="button" variant="outline">Outline</Button>
        <Button type="button" variant="ghost">Ghost</Button>
        <Button type="button" variant="soft">Soft</Button>
        <Button type="button" variant="success">نجاح</Button>
        <Button type="button" variant="warning">تحذير</Button>
        <Button type="button" variant="danger">خطر</Button>
        <Button type="button" variant="link">رابط</Button>
        <div className="w-full" />
        <Button type="button" size="xs">XS</Button>
        <Button type="button" size="sm">SM</Button>
        <Button type="button" size="md">MD</Button>
        <Button type="button" size="lg">LG</Button>
        <Button type="button" size="xl">XL</Button>
        <Button type="button" size="icon" aria-label="إضافة"><Plus className="size-4" /></Button>
        <div className="w-full" />
        <Button type="button" leftIcon={<Plus className="size-4" />}>أيقونة يسار</Button>
        <Button type="button" rightIcon={<Mail className="size-4" />}>أيقونة يمين</Button>
        <Button type="button" loading>جارٍ الحفظ</Button>
        <Button type="button" disabled>معطّل</Button>
        <Button type="button" fullWidth>بعرض كامل</Button>
      </Section>

      <Section title="Inputs" description="States · label · error · icons · loading · currency">
        <div className="grid w-full gap-4 sm:grid-cols-2">
          <TextField label="الاسم" placeholder="أدخل الاسم" />
          <TextField label="البريد" type="email" leadingIcon={<Mail className="size-4" />} placeholder="name@example.com" />
          <TextField label="بحث" leadingIcon={<Search className="size-4" />} placeholder="بحث..." />
          <TextField label="المبلغ" type="number" inputMode="decimal" currency="ر.ع" placeholder="0.000" />
          <TextField label="تحميل" loading defaultValue="نص" />
          <TextField label="نجاح" success="متاح" defaultValue="مالك" />
          <TextField label="تحذير" warning="راجع القيمة" defaultValue="10" />
          <TextField label="خطأ" error="هذا الحقل مطلوب" defaultValue="" />
          <TextField label="للقراءة فقط" readOnly defaultValue="قيمة ثابتة" />
          <TextField label="معطّل" disabled defaultValue="غير متاح" />
          <TextAreaField label="ملاحظات" placeholder="اكتب هنا..." className="sm:col-span-2" />
        </div>
      </Section>

      <Section title="Cards" description="Variants">
        <Card variant="default" className="w-64">
          <CardHeader><CardTitle>Default</CardTitle><CardDescription>وصف البطاقة</CardDescription></CardHeader>
          <CardContent>محتوى</CardContent>
          <CardFooter><Button type="button" size="sm">إجراء</Button></CardFooter>
        </Card>
        <Card variant="outlined" className="w-64"><CardContent className="p-5">Outlined</CardContent></Card>
        <Card variant="elevated" className="w-64"><CardContent className="p-5">Elevated</CardContent></Card>
        <Card variant="interactive" className="w-64"><CardContent className="p-5">Interactive — hover/focus</CardContent></Card>
        <Card variant="compact" className="w-64">
          <CardHeader><CardTitle>Compact</CardTitle></CardHeader>
          <CardContent>مسافات مضغوطة</CardContent>
        </Card>
        <Card variant="statistic" className="w-64">
          <Typography variant="caption">إجمالي التحصيل</Typography>
          <Typography variant="h2" className="mt-1 text-financial-positive">12,450 ر.ع</Typography>
        </Card>
        <Card variant="financial" className="w-64">
          <Typography variant="caption">رصيد المالك</Typography>
          <Typography variant="h2" className="mt-1">4,820 ر.ع</Typography>
        </Card>
      </Section>

      <Section title="Badges" description="Variants + business status presets">
        <Badge>Default</Badge>
        <Badge variant="primary">Primary</Badge>
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="outline">Outline</Badge>
        <div className="w-full" />
        {(['active', 'inactive', 'draft', 'pending', 'paid', 'overdue', 'cancelled', 'archived', 'void'] as const).map((s) => (
          <StatusBadgePill key={s} status={s} />
        ))}
        <div className="w-full" />
        <StatusBadge tone="emerald">StatusBadge emerald</StatusBadge>
        <StatusBadge tone="rose">StatusBadge rose</StatusBadge>
      </Section>

      <Section title="Dialogs / Feedback" description="Alert · Spinner · Skeleton (dialogs reuse existing Radix Dialog)">
        <Alert variant="info" title="معلومة" description="هذا تنبيه معلوماتي." />
        <Alert variant="success" title="تم الحفظ" description="تم حفظ التغييرات بنجاح." />
        <Alert variant="warning" title="تنبيه" description="هناك شيء يحتاج مراجعتك." />
        <Alert variant="danger" title="خطأ" description="تعذر إكمال الإجراء." />
        <div className="flex w-full items-center gap-4">
          <Spinner size="xs" />
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
        <div className="w-full space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Section>

      <Section title="Table" description="Foundation primitives + visual states (no data grid)">
        <Table>
          <TableCaption>جدول توضيحي</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>المبلغ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow selected>
              <TableCell>عقد #1002</TableCell>
              <TableCell><Badge variant="success">نشط</Badge></TableCell>
              <TableCell className="font-mono text-financial-positive">+450.000</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>عقد #1003</TableCell>
              <TableCell><Badge variant="danger">متأخر</Badge></TableCell>
              <TableCell className="font-mono text-financial-negative">-120.000</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="w-full" />
        <Table>
          <TableBody>
            <TableLoading columns={3} rows={3} />
          </TableBody>
        </Table>
        <Table>
          <TableEmpty colSpan={3} title="لا توجد سجلات" description="ابدأ بإضافة أول سجل." action={<Button type="button" size="sm"><Check className="size-4" /> إضافة</Button>} />
        </Table>
      </Section>

      <Section title="States" description="Empty / Error / Offline / No permission (reused primitives)">
        <Card variant="outlined" className="w-full">
          <CardContent className="p-0">
            <Table>
              <TableError colSpan={1} title="تعذر تحميل البيانات" onRetry={() => {}} />
            </Table>
          </CardContent>
        </Card>
        <Alert variant="info" title="EmptyState / ErrorState / OfflineState / NoPermissionState" description="هذه الأسطح مبنية على Card/Alert الموجودة وتُستخدم في صفحات Wave 4." />
      </Section>

      <footer className="pb-10">
        <Typography variant="caption">
          MALEK Pro — Visual Wave 3 · Enterprise Design System Foundation
        </Typography>
      </footer>
    </div>
  );
}
