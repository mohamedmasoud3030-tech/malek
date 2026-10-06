// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { defaultCompanySettingsContract } from "@/lib/companySettings";
import type { MonthlyCashflowChartRow } from "../financial-performance";
import { FinancialPerformanceSection } from "./financial-performance-section";

vi.mock("@/components/ui/report-bar-chart", () => ({
  ReportBarChart: ({ ariaLabel }: { ariaLabel: string }) => (
    <div data-report-chart role="img" aria-label={ariaLabel} />
  ),
}));

afterEach(cleanup);

const rows: MonthlyCashflowChartRow[] = [
  { month: "2026-05", label: "مايو", collected: 1200, expenses: 300 },
  { month: "2026-06", label: "يونيو", collected: 1800, expenses: 450 },
];

function renderSection(
  overrides: Partial<ComponentProps<typeof FinancialPerformanceSection>> = {},
) {
  return render(
    <FinancialPerformanceSection
      settings={defaultCompanySettingsContract}
      window="six_months"
      onWindowChange={vi.fn()}
      chartRows={rows}
      chartIsLoading={false}
      chartIsError={false}
      onChartRetry={vi.fn()}
      {...overrides}
    />,
  );
}

describe("FinancialPerformanceSection — one authoritative async state at a time", () => {
  it("does not render an empty chart while the report is loading", () => {
    const { container } = renderSection({ chartIsLoading: true });

    expect(
      container.querySelector(
        '[data-loading-state][aria-label="جارٍ تحميل الأداء المالي"]',
      ),
    ).not.toBeNull();
    expect(container.querySelector("[data-report-chart]")).toBeNull();
    expect(
      container.querySelector("[data-dashboard-performance-empty]"),
    ).toBeNull();
  });

  it("does not render stale chart content alongside a report error", () => {
    const { container, getByText } = renderSection({ chartIsError: true });

    expect(getByText("تعذر تحميل الأداء المالي")).toBeTruthy();
    expect(container.querySelector("[data-report-chart]")).toBeNull();
    expect(
      container.querySelector("[data-dashboard-performance-summary]"),
    ).toBeNull();
  });

  it("renders an explicit empty state only when the successful report has no rows", () => {
    const { container, getByText } = renderSection({ chartRows: [] });

    expect(getByText("لا توجد حركة مالية مسجلة ضمن هذه الفترة")).toBeTruthy();
    expect(
      container.querySelector("[data-dashboard-performance-empty]"),
    ).not.toBeNull();
    expect(container.querySelector("[data-report-chart]")).toBeNull();
  });

  it("keeps exact monthly values available as a text table beside the chart", () => {
    const { container, getByText } = renderSection();

    expect(container.querySelector("[data-report-chart]")).not.toBeNull();
    expect(
      container.querySelector("[data-dashboard-performance-data]"),
    ).not.toBeNull();
    expect(getByText("مايو")).toBeTruthy();
    expect(getByText("يونيو")).toBeTruthy();
    expect(
      container.querySelector("[data-dashboard-performance-summary]"),
    ).not.toBeNull();
  });
});
