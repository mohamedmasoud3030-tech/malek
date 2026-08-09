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

  it("keeps the table compact and removes the view-mode switch", () => {
    act(() => { root.render(<EntityTable {...tableProps({ enableViewModeToggle: true, viewModeStorageKey: "test:view-mode", renderMobileCard: (row) => <div>بطاقة {row.name}</div> })} />); });
    expect(container.querySelector('[aria-label="طريقة العرض"]')).toBeNull();
    expect(container.querySelector('[data-compact-responsive-table]')).not.toBeNull();
    expect(container.querySelector('[role="list"]')).toBeNull();
  });
});
