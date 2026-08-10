import { expect, test } from "@playwright/test";

const fixtureUrl = "/login?e2e-service-providers-workspace=1";

test.describe("Service Providers workspace", () => {
  test("renders the Arabic register and provider operations without horizontal overflow", async ({
    page,
  }) => {
    await page.goto(fixtureUrl);
    await expect(page.locator("[data-e2e-service-providers]")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "مزودو الخدمات" }),
    ).toBeVisible();
    await expect(page.getByText("شركة الأفق للتبريد")).toBeVisible();
    await expect(page.getByText("التكييف والتبريد").first()).toBeVisible();
    await expect(page.getByText("2 جارية").first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });

  test("opens and closes the accessible create workflow", async ({ page }) => {
    await page.goto(fixtureUrl);
    await page.getByRole("button", { name: "إضافة مزود" }).click();
    const dialog = page.getByRole("dialog", { name: "إضافة مزود خدمة" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("اسم مزود الخدمة")).toBeVisible();
    await expect(dialog.getByText("التكييف والتبريد")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("filters the register by active state and keeps 44px actions", async ({
    page,
  }) => {
    await page.goto(fixtureUrl);
    await page
      .getByLabel("تصفية مزودي الخدمات حسب الحالة")
      .selectOption("inactive");
    await expect(page.getByText("مؤسسة الحلول السريعة")).toBeVisible();
    await expect(page.getByText("شركة الأفق للتبريد")).toBeHidden();
    const action = page.getByRole("button", { name: "عرض" }).first();
    const box = await action.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
