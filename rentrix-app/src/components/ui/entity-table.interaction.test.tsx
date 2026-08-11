// @vitest-environment happy-dom
import { createRoot } from "react-dom/client";
import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EntityTable, type ColumnDef } from "./entity-table";

interface Row { id: string; name: string }
const rows: Row[] = [{ id: "1", name: "الأول" }, { id: "2", name: "الثاني" }];
const columns: ColumnDef<Row>[] = [{ key: "name", header: "الاسم", render: (row) => row.name }];
function tableProps(overrides: Partial<Parameters<typeof EntityTable<Row>>[0]> = {}) {
  return { "aria-label": "جدول الاختبار", rows, columns, keyOf: (row: Row) => row.id, ...overrides };
}

const richColumns: ColumnDef<Row>[] = [
  { key: "name", header: "الاسم", sortable: true, priority: "identity", render: (row) => row.name },
  { key: "amount", header: "المبلغ", priority: "primary", render: (row) => `${row.name} مبلغ` },
  { key: "detail", header: "تفصيل كامل", priority: "detail", render: (row) => `تفاصيل ${row.name}` },
  { key: "actions", header: "إجراءات", priority: "actions", render: (row) => (
    <div className="flex gap-2">
      <button type="button" onClick={() => undefined}>إجراء داخلي</button>
      <button type="button" onClick={() => undefined}>أرشفة</button>
    </div>
  ) },
];

describe("EntityTable — السجل الموحد: عرض الجدول على سطح المكتب وعرض البطاقات على الجوال", () => {
  it("renders the dense semantic table for desktop/tablet and a true card list for mobile", () => {
    const html = renderToStaticMarkup(<EntityTable {...tableProps({ columns: richColumns })} />);
    // Desktop table foundation remains present in the DOM (md+).
    expect(html).toContain('data-compact-responsive-table="true"');
    expect(html).toContain('data-entity-table="true"');
    expect(html).toContain('aria-label="جدول الاختبار"');
    // Mobile register presentation (max-md) — a real list, never a squeezed table.
    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="جدول الاختبار"');
    expect(html).toContain("data-entity-table-mobile-card");
    expect(html).toContain("data-entity-table-mobile-actions");
  });

  it("shows identity + ONE datum + actions on each mobile card, without expansion or bulk disclosure", () => {
    const html = renderToStaticMarkup(<EntityTable {...tableProps({ columns: richColumns, mobileVisibleSecondaryKey: "amount" })} />);
    expect(html).toContain("الأول");
    expect(html).toContain("مبلغ");
    expect(html).toContain("إجراءات");
    // No «توسيع الكل», no row disclosure buttons, no sticky action columns on mobile.
    expect(html).not.toContain("توسيع الكل");
    expect(html).not.toContain("طي الكل");
    expect(html).not.toContain("عرض كل تفاصيل الصف");
    expect(html).not.toContain("data-entity-table-bulk-disclosure");
    // The mobile datum is driven by column metadata (mobileVisibleSecondaryKey).
    expect(html).toContain("data-entity-table-mobile-datum");
  });

  it("renders shared empty, loading, and error states", () => {
    expect(renderToStaticMarkup(<EntityTable {...tableProps({ rows: [], emptyTitle: "لا عناصر هنا", emptyDescription: "أضف أول عنصر." })} />)).toContain("لا عناصر هنا");
    const loading = renderToStaticMarkup(<EntityTable {...tableProps({ isLoading: true })} />);
    expect(loading).not.toContain("الأول");
    expect(loading).toContain("skeleton-shimmer");
    expect(loading).toContain("data-entity-table-mobile-skeleton");
    const error = renderToStaticMarkup(<EntityTable {...tableProps({ error: new Error("boom"), errorTitle: "فشل الجلب", onRetry: () => undefined })} />);
    expect(error).toContain("فشل الجلب");
    expect(error).toContain("إعادة المحاولة");
  });

  it("does not render legacy page-supplied mobile cards even when a compatibility renderer is supplied", () => {
    const html = renderToStaticMarkup(<EntityTable {...tableProps({ renderMobileCard: (row) => <div>بطاقة {row.name}</div> })} />);
    expect(html).not.toContain("بطاقة الأول");
    expect(html).toContain("الأول");
  });
});

describe("EntityTable — التفاعل", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("invokes retry, pagination, and desktop row actions", () => {
    const onRetry = vi.fn();
    const onPageChange = vi.fn();
    const onRowClick = vi.fn();
    act(() => { root.render(<EntityTable {...tableProps({ error: new Error("boom"), onRetry })} />); });
    act(() => { Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("إعادة المحاولة"))?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onRetry).toHaveBeenCalledTimes(1);

    act(() => { root.render(<EntityTable {...tableProps({ pagination: { page: 1, pageSize: 10, total: 30, onPageChange }, onRowClick })} />); });
    act(() => { container.querySelector('button[aria-label="الصفحة التالية"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onPageChange).toHaveBeenCalledWith(2);
    act(() => { container.querySelector("tbody tr")?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("supports sorting and keyboard row activation on the desktop table", () => {
    const onSort = vi.fn();
    const onRowClick = vi.fn();
    act(() => { root.render(<EntityTable {...tableProps({ columns: richColumns, sort: { field: "name", direction: "asc" }, onSort, onRowClick })} />); });

    const sortButton = Array.from(container.querySelectorAll("thead button")).find((button) => button.textContent?.includes("الاسم"));
    act(() => { (sortButton as HTMLElement | undefined)?.click(); });
    expect(onSort).toHaveBeenCalledWith("name", "desc");

    const firstRow = container.querySelector<HTMLTableRowElement>("tbody tr");
    act(() => { firstRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    const nested = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "إجراء داخلي");
    act(() => { nested?.click(); });
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("keeps custom row expansion on desktop and never on the mobile card list", () => {
    const setExpanded = vi.fn();
    act(() => {
      root.render(
        <EntityTable
          {...tableProps({ columns: richColumns, renderRowExpansion: (row) => <div>بيانات المستأجر {row.name}</div>, expandedRowId: null, onExpandedRowChange: setExpanded })}
        />,
      );
    });

    const disclosure = container.querySelector<HTMLButtonElement>('button[aria-label="عرض كل تفاصيل الصف"]');
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    act(() => { disclosure?.click(); });
    expect(setExpanded).toHaveBeenCalledWith("1");

    // Mobile cards carry no disclosure controls — the list never shows them.
    const mobileList = container.querySelector('[data-entity-table-mobile-list]');
    expect(mobileList).not.toBeNull();
    expect(mobileList?.querySelector('[aria-label="عرض كل تفاصيل الصف"]')).toBeNull();
    expect(mobileList?.textContent).not.toContain("بيانات المستأجر");
  });

  it("opens the mobile actions menu and exposes only the actions already available for the record", () => {
    const nestedAction = vi.fn();
    const archiveAction = vi.fn();
    const customActions: ColumnDef<Row>[] = [
      { key: "name", header: "الاسم", priority: "identity", render: (row) => row.name },
      { key: "actions", header: "إجراءات", priority: "actions", render: () => (
        <div className="flex gap-2">
          <button type="button" onClick={nestedAction}>إجراء داخلي</button>
          <button type="button" onClick={archiveAction}>أرشفة</button>
        </div>
      ) },
    ];
    act(() => { root.render(<EntityTable {...tableProps({ columns: customActions })} />); });

    const trigger = container.querySelector<HTMLButtonElement>("[data-entity-table-mobile-actions]");
    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(trigger?.className).toContain("min-h-11");

    act(() => { trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    const panel = container.querySelector("[data-entity-table-mobile-actions-panel]");
    expect(panel).not.toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    const inner = Array.from(panel?.querySelectorAll("button") ?? []);
    expect(inner).toHaveLength(2);
    act(() => { inner[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(nestedAction).toHaveBeenCalledTimes(1);

    // Escape closes the menu and restores focus to the trigger.
    act(() => { trigger?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(container.querySelector("[data-entity-table-mobile-actions-panel]")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("activates the record detail action from the mobile card body when onRowClick exists", () => {
    const onRowClick = vi.fn();
    act(() => { root.render(<EntityTable {...tableProps({ onRowClick })} />); });
    const primary = container.querySelector<HTMLButtonElement>("[data-entity-table-mobile-primary]");
    expect(primary).not.toBeNull();
    act(() => { primary?.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  it("falls back to the first primary column after identity for the mobile datum", () => {
    const fallbackColumns: ColumnDef<Row>[] = [
      { key: "name", header: "الاسم", priority: "identity", render: (row) => row.name },
      { key: "status", header: "الحالة", priority: "primary", render: (row) => `حالة ${row.name}` },
      { key: "notes", header: "ملاحظات", priority: "detail", render: (row) => `ملاحظة ${row.name}` },
    ];
    act(() => { root.render(<EntityTable {...tableProps({ columns: fallbackColumns })} />); });
    const datum = container.querySelector("[data-entity-table-mobile-datum]");
    expect(datum?.textContent).toContain("الحالة");
    expect(datum?.textContent).toContain("حالة الأول");
    expect(datum?.textContent).not.toContain("ملاحظة");
  });

  it("keeps the shared view-mode switch removed", () => {
    act(() => { root.render(<EntityTable {...tableProps({ enableViewModeToggle: true, viewModeStorageKey: "test:view-mode", renderMobileCard: (row) => <div>بطاقة {row.name}</div> })} />); });
    expect(container.querySelector('[aria-label="طريقة العرض"]')).toBeNull();
    expect(container.querySelector('[data-compact-responsive-table]')).not.toBeNull();
  });
});
