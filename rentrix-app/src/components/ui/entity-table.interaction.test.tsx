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

describe("EntityTable — حالات الجدول الموحد", () => {
  it("renders rows in the shared compact responsive table", () => {
    const html = renderToStaticMarkup(<EntityTable {...tableProps()} />);
    expect(html).toContain('data-compact-responsive-table="true"');
    expect(html).toContain('aria-label="جدول الاختبار"');
    expect(html).toContain("py-2.5");
    expect(html).toContain("الأول");
    expect(html).not.toContain('role="list"');
  });

  it("does not render legacy mobile cards even when a compatibility renderer is supplied", () => {
    const html = renderToStaticMarkup(<EntityTable {...tableProps({ renderMobileCard: (row) => <div>بطاقة {row.name}</div> })} />);
    expect(html).not.toContain("بطاقة الأول");
    expect(html).toContain("الأول");
  });

  it("renders shared empty, loading, and error states", () => {
    expect(renderToStaticMarkup(<EntityTable {...tableProps({ rows: [], emptyTitle: "لا عناصر هنا", emptyDescription: "أضف أول عنصر." })} />)).toContain("لا عناصر هنا");
    const loading = renderToStaticMarkup(<EntityTable {...tableProps({ isLoading: true })} />);
    expect(loading).not.toContain("الأول");
    expect(loading).toContain("skeleton-shimmer");
    const error = renderToStaticMarkup(<EntityTable {...tableProps({ error: new Error("boom"), errorTitle: "فشل الجلب", onRetry: () => undefined })} />);
    expect(error).toContain("فشل الجلب");
    expect(error).toContain("إعادة المحاولة");
  });
});

describe("EntityTable — التفاعل", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("invokes retry, pagination, and row actions", () => {
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

  it("supports sorting, keyboard row activation, progressive disclosure, and nested actions", () => {
    const onSort = vi.fn();
    const onRowClick = vi.fn();
    const nestedAction = vi.fn();
    const richColumns: ColumnDef<Row>[] = [
      { key: "name", header: "الاسم", sortable: true, priority: "identity", render: (row) => row.name },
      { key: "detail", header: "تفصيل كامل", priority: "detail", render: (row) => `تفاصيل ${row.name}` },
      { key: "actions", header: "إجراءات", priority: "actions", render: () => <button type="button" onClick={nestedAction}>إجراء داخلي</button> },
    ];
    act(() => { root.render(<EntityTable {...tableProps({ columns: richColumns, sort: { field: "name", direction: "asc" }, onSort, onRowClick })} />); });

    const sortButton = Array.from(container.querySelectorAll("thead button")).find((button) => button.textContent?.includes("الاسم"));
    act(() => { (sortButton as HTMLElement | undefined)?.click(); });
    expect(onSort).toHaveBeenCalledWith("name", "desc");

    const firstRow = container.querySelector<HTMLTableRowElement>("tbody tr");
    act(() => { firstRow?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    const nested = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "إجراء داخلي");
    act(() => { nested?.click(); });
    expect(nestedAction).toHaveBeenCalledOnce();
    expect(onRowClick).toHaveBeenCalledTimes(1);

    const disclosure = container.querySelector<HTMLButtonElement>('button[aria-label="عرض كل تفاصيل الصف"]');
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    act(() => { disclosure?.click(); });
    expect(container.textContent).toContain("تفاصيل الأول");
    expect(container.querySelector('[data-row-disclosure]')).not.toBeNull();
  });

  it("keeps the table compact and removes the view-mode switch", () => {
    act(() => { root.render(<EntityTable {...tableProps({ enableViewModeToggle: true, viewModeStorageKey: "test:view-mode", renderMobileCard: (row) => <div>بطاقة {row.name}</div> })} />); });
    expect(container.querySelector('[aria-label="طريقة العرض"]')).toBeNull();
    expect(container.querySelector('[data-compact-responsive-table]')).not.toBeNull();
    expect(container.querySelector('[role="list"]')).toBeNull();
  });

  it("keeps ONE designated secondary datum visible on narrow mobile layouts", () => {
    const richColumns: ColumnDef<Row>[] = [
      { key: "name", header: "الاسم", priority: "identity", render: (row) => row.name },
      { key: "amount", header: "المبلغ", priority: "secondary", render: (row) => row.name },
      { key: "date", header: "التاريخ", priority: "detail", render: (row) => row.name },
    ];
    act(() => { root.render(<EntityTable {...tableProps({ columns: richColumns, mobileVisibleSecondaryKey: "amount" })} />); });
    // The designated column loses the narrow-screen hide; the other stays hidden.
    const amountCell = container.querySelector('th[data-column-priority="primary"]');
    expect(amountCell?.textContent).toContain("المبلغ");
    const hiddenDetail = container.querySelector('th[data-column-priority="detail"]');
    expect(hiddenDetail?.getAttribute("class")).toContain("max-sm:hidden");
  });

  it("expands several rows at once and supports expand-all / collapse-all", () => {
    const richColumns: ColumnDef<Row>[] = [
      { key: "name", header: "الاسم", priority: "identity", render: (row) => row.name },
      { key: "detail", header: "تفصيل كامل", priority: "detail", render: (row) => `تفاصيل ${row.name}` },
    ];
    act(() => { root.render(<EntityTable {...tableProps({ rows: rows.concat([{ id: "3", name: "الثالث" }]), columns: richColumns })} />); });

    // Expand the first row, then a second row — both stay expanded.
    const disclosures = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-label="عرض كل تفاصيل الصف"]'));
    act(() => { disclosures[0]?.click(); });
    act(() => { disclosures[1]?.click(); });
    expect(container.querySelectorAll('[data-row-disclosure]').length).toBe(2);
    expect(container.textContent).toContain("تفاصيل الأول");
    expect(container.textContent).toContain("تفاصيل الثاني");

    // Expand all / collapse all toggle every disclosure row.
    const expandAll = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("توسيع الكل"));
    act(() => { (expandAll as HTMLButtonElement | undefined)?.click(); });
    expect(container.querySelectorAll('[data-row-disclosure]').length).toBe(3);

    const collapseAll = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("طي الكل"));
    act(() => { (collapseAll as HTMLButtonElement | undefined)?.click(); });
    expect(container.querySelectorAll('[data-row-disclosure]').length).toBe(0);
  });

  it("never shows bulk disclosure controls for tables without disclosure data", () => {
    act(() => { root.render(<EntityTable {...tableProps()} />); });
    expect(container.querySelector('[data-entity-table-bulk-disclosure]')).toBeNull();
  });
});
