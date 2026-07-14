import { expect, test, type Page } from "@playwright/test";

const isReleaseBlockerRun = process.env.E2E_ENVIRONMENT_KIND === "staging";
const authStorageKey = "rentrix-auth-session";
const fallbackEmailDomain = "gmail.com";

function requireEnv(name: "E2E_TEST_EMAIL" | "E2E_TEST_PASSWORD"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required. Release-blocker authentication tests must fail, not skip, when staging credentials are unavailable.`,
    );
  }

  if (name === "E2E_TEST_EMAIL" && value.endsWith("@")) {
    return `${value}${fallbackEmailDomain}`;
  }

  return value;
}

const email = isReleaseBlockerRun ? requireEnv("E2E_TEST_EMAIL") : "";
const password = isReleaseBlockerRun ? requireEnv("E2E_TEST_PASSWORD") : "";

async function submitLogin(page: Page, candidatePassword: string) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByPlaceholder("••••••••").fill(candidatePassword);
  await page.getByRole("button", { name: /^تسجيل الدخول$/ }).click();
}

async function expectProtectedShell(page: Page) {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("لوحة التحكم").first()).toBeVisible();
}

test.describe("release blocker: real authentication lifecycle", () => {
  test.skip(
    !isReleaseBlockerRun,
    "The general browser smoke does not own staging credentials; the dedicated release-blocker job runs this suite with zero skips.",
  );

  test("valid staging credentials create a usable session that can be logged out", async ({
    page,
  }) => {
    await submitLogin(page, password);
    await expectProtectedShell(page);

    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "مرحباً بعودتك" }),
    ).toBeVisible();
  });

  test("invalid credentials do not create a session or enter the protected shell", async ({
    page,
  }) => {
    await submitLogin(page, `${password}-invalid`);

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "مرحباً بعودتك" }),
    ).toBeVisible();
    await expect(page.getByText("لوحة التحكم")).toHaveCount(0);

    const authStorageValue = await page.evaluate(
      (storageKey) => localStorage.getItem(storageKey),
      authStorageKey,
    );
    expect(authStorageValue).toBeNull();
  });

  test("an invalidated stored session returns to login without a redirect loop", async ({
    page,
  }) => {
    await submitLogin(page, password);
    await expectProtectedShell(page);

    await page.evaluate((storageKey) => {
      const rawSession = localStorage.getItem(storageKey);
      if (!rawSession)
        throw new Error(`Auth storage value is missing for ${storageKey}.`);

      const session = JSON.parse(rawSession) as Record<string, unknown>;
      session.access_token = "expired.invalid.token";
      session.refresh_token = "invalid-refresh-token";
      session.expires_at = 1;
      localStorage.setItem(storageKey, JSON.stringify(session));
    }, authStorageKey);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "مرحباً بعودتك" }),
    ).toBeVisible();
  });
});
