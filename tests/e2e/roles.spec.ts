import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const password = "senha-segura-123";

async function login(page: Page, loginValue: string) {
  await page.goto("/login");
  await page.getByLabel("Login").fill(loginValue);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function expectNoBlockingAccessibilityViolations(page: Page) {
  const scan = await new AxeBuilder({ page }).analyze();
  const blocking = scan.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking).toEqual([]);
}

test("admin pode reabrir uma agenda concluída", async ({ page }) => {
  await login(page, "admin-e2e");
  await expect(page).toHaveURL(/\/admin$/);

  const card = page.getByTestId("dashboard-store-F05");
  await expect(card).toContainText("Pagani E2E");
  await card.getByRole("button", { name: "Ver detalhes" }).click();

  const dialog = page.getByRole("dialog", { name: "Agenda F05 - Pagani E2E" });
  await expect(dialog.getByRole("button", { name: "Reabrir para conferente" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Editar agenda" }).click();
  await expect(
    dialog.getByRole("button", { name: "Reabrir para conferente" }),
  ).toBeVisible();

  await expectNoBlockingAccessibilityViolations(page);
});

test("visualizador consulta a agenda sem receber ações mutáveis", async ({
  page,
}) => {
  await login(page, "viewer-e2e");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("button", { name: "Importar agenda" }),
  ).toHaveCount(0);

  const card = page.getByTestId("dashboard-store-F05");
  await card.getByRole("button", { name: "Ver detalhes" }).click();

  const dialog = page.getByRole("dialog", { name: "Agenda F05 - Pagani E2E" });
  await expect(dialog.getByText("Somente leitura")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Reabrir para conferente" }),
  ).toHaveCount(0);

  await expectNoBlockingAccessibilityViolations(page);
});

test("conferente acessa apenas a própria loja", async ({ page }) => {
  await login(page, "conferente-e2e");
  await expect(page).toHaveURL(/\/app$/);

  await expect(page.getByText("Pagani E2E")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Fornecedor E2E" })).toBeVisible();

  const tableScroll = page.locator(".agenda-desktop .table-scroll");
  await expect(tableScroll).toBeVisible();
  const tableSize = await tableScroll.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(tableSize.scrollWidth).toBeLessThanOrEqual(tableSize.clientWidth + 1);

  const headerBackground = await page
    .locator(".agenda-desktop thead th")
    .first()
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(headerBackground).not.toBe("rgba(0, 0, 0, 0)");

  await expectNoBlockingAccessibilityViolations(page);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/app$/);
});
