import { BriefcaseBusiness, FolderCog, Plus, Wrench } from "lucide-react";
import { useState } from "react";
import { ListPage } from "@/components/layout/list-page";
import { ActionMenu } from "@/components/ui/action-menu";
import { EntityForm } from "@/components/ui/entity-form";
import { Button } from "@/components/ui/button";
import { EntityCell } from "@/components/ui/entity-cell";
import { EntityTable } from "@/components/ui/entity-table";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import type {
  ServiceProviderCategory,
  ServiceProviderListItem,
} from "./service-provider-service";

const categories: ServiceProviderCategory[] = [
  {
    id: "cat-hvac",
    company_id: "company-fixture",
    name: "التكييف والتبريد",
    description: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  },
  {
    id: "cat-plumbing",
    company_id: "company-fixture",
    name: "السباكة",
    description: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    deleted_at: null,
  },
];
const providers: ServiceProviderListItem[] = [
  {
    id: "provider-1",
    company_id: "company-fixture",
    name: "شركة الأفق للتبريد",
    legal_name: "شركة الأفق الفنية ش.م.م",
    registration_number: "CR-10452",
    tax_number: "OM-TAX-5012",
    contact_name: "أحمد البلوشي",
    phone: "96890000001",
    alternate_phone: null,
    email: "ops@horizon.invalid",
    website: "https://example.invalid",
    address: "صحار، شمال الباطنة",
    service_area: "صحار ولوى وصحم",
    availability_notes: "التنسيق من 08:00 إلى 18:00",
    notes: null,
    is_active: true,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    categories,
    maintenance_jobs_count: 12,
    open_jobs_count: 2,
  },
  {
    id: "provider-2",
    company_id: "company-fixture",
    name: "مؤسسة الحلول السريعة",
    legal_name: null,
    registration_number: "CR-20987",
    tax_number: null,
    contact_name: "سالم الحوسني",
    phone: "96890000002",
    alternate_phone: null,
    email: null,
    website: null,
    address: "مسقط",
    service_area: "مسقط",
    availability_notes: null,
    notes: null,
    is_active: false,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    categories: [categories[1]!],
    maintenance_jobs_count: 5,
    open_jobs_count: 0,
  },
];

export function ServiceProvidersWorkspaceE2EFixture() {
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = providers.filter(
    (provider) =>
      (status === "all" || provider.is_active === (status === "active")) &&
      provider.name.includes(search),
  );
  return (
    <main
      className="fixed inset-0 z-[200] overflow-y-auto bg-background text-foreground"
      dir="rtl"
      data-e2e-service-providers
    >
      <ListPage
        dir="rtl"
        title="مزودو الخدمات"
        description="سجل الشركات وجهات التنفيذ، تخصصاتها، بيانات التواصل، وأعمال الصيانة المرتبطة."
        count={filtered.length}
        primaryAction={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="me-2 size-4" />
            إضافة مزود
          </Button>
        }
        secondaryActions={
          <Button variant="secondary">
            <FolderCog className="me-2 size-4" />
            إدارة أنواع الخدمات
          </Button>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "بحث بالاسم أو الهاتف أو السجل",
        }}
        filters={
          <Select
            aria-label="تصفية مزودي الخدمات حسب الحالة"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </Select>
        }
      >
        <section
          aria-label="ملخص مزودي الخدمات"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KpiCard
            label="إجمالي المزودين"
            value="2"
            sub="سجلات غير مؤرشفة"
            icon={BriefcaseBusiness}
          />
          <KpiCard
            label="مزودون نشطون"
            value="1"
            sub="متاحون للتعيين الجديد"
            icon={BriefcaseBusiness}
          />
          <KpiCard
            label="أنواع الخدمات"
            value="2"
            sub="أنواع نشطة قابلة للصيانة"
            icon={FolderCog}
          />
          <KpiCard
            label="أعمال جارية"
            value="2"
            sub="مفتوحة أو قيد التنفيذ"
            icon={Wrench}
          />
        </section>
        <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-card">
          <header className="border-b bg-muted/35 px-4 py-4">
            <h2 className="font-black">سجل مزودي الخدمات</h2>
          </header>
          <div className="p-3 sm:p-4">
            <EntityTable
              aria-label="جدول مزودي الخدمات"
              rows={filtered}
              columns={[
                {
                  key: "name",
                  header: "مزود الخدمة",
                  render: (provider) => (
                    <EntityCell
                      icon={BriefcaseBusiness}
                      tone="primary"
                      title={provider.name}
                      subtitle={provider.service_area}
                    />
                  ),
                },
                {
                  key: "categories",
                  header: "الخدمات المدعومة",
                  render: (provider) => (
                    <div className="flex flex-wrap gap-1">
                      {provider.categories.map((category) => (
                        <StatusBadge key={category.id} tone="info">
                          {category.name}
                        </StatusBadge>
                      ))}
                    </div>
                  ),
                },
                {
                  key: "contact",
                  header: "التواصل",
                  render: (provider) => <span dir="ltr">{provider.phone}</span>,
                },
                {
                  key: "jobs",
                  header: "أعمال الصيانة",
                  render: (provider) =>
                    `${provider.maintenance_jobs_count} · ${provider.open_jobs_count} جارية`,
                },
                {
                  key: "status",
                  header: "الحالة",
                  render: (provider) => (
                    <StatusBadge
                      tone={provider.is_active ? "success" : "neutral"}
                    >
                      {provider.is_active ? "نشط" : "غير نشط"}
                    </StatusBadge>
                  ),
                },
                {
                  key: "actions",
                  header: "إجراءات",
                  render: (provider) => (
                    <ActionMenu
                      label={`إجراءات ${provider.name}`}
                      items={[{ id: "view", label: "عرض", onClick: () => undefined }]}
                    />
                  ),
                },
              ]}
              keyOf={(provider) => provider.id}
              emptyTitle="لا توجد نتائج مطابقة"
            />
          </div>
        </section>
      </ListPage>
      <EntityForm.Overlay
        open={formOpen}
        onOpenChange={setFormOpen}
        title="إضافة مزود خدمة"
        description="بيانات الشركة والتواصل ونطاق التشغيل وأنواع الخدمات المدعومة."
        className="max-w-3xl"
      >
        <EntityForm.Root
          onSubmit={(event) => {
            event.preventDefault();
            setFormOpen(false);
          }}
        >
          <EntityForm.Section title="بيانات المنشأة">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="اسم مزود الخدمة *">
                <Input required aria-label="اسم مزود الخدمة" />
              </EntityForm.Field>
              <EntityForm.Field label="رقم السجل التجاري">
                <Input dir="ltr" />
              </EntityForm.Field>
            </div>
          </EntityForm.Section>
          <EntityForm.Section title="بيانات التواصل">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="جهة الاتصال">
                <Input />
              </EntityForm.Field>
              <EntityForm.Field label="الهاتف">
                <Input dir="ltr" />
              </EntityForm.Field>
            </div>
            <EntityForm.Field label="العنوان">
              <Textarea />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Section title="أنواع الخدمات المدعومة">
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex min-h-11 items-center gap-3 rounded-xl border p-3 text-sm font-bold"
                >
                  <input type="checkbox" />
                  {category.name}
                </label>
              ))}
            </div>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel="إنشاء مزود الخدمة"
            onCancel={() => setFormOpen(false)}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>
    </main>
  );
}
