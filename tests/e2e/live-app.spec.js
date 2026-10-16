import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

async function enterDemo(page, role) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.getByRole("button", { name: new RegExp(role, "i") }).click();
}

async function expectNoBlockingAccessibilityViolations(page) {
  const scan = await new AxeBuilder({ page }).analyze();
  const blocking = scan.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(blocking).toEqual([]);
}

test("entrada principal usa o app conectado à API e mantém acessibilidade no login", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("Login")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  await expectNoBlockingAccessibilityViolations(page);
});

test("administrador percorre recebimento, relatórios e cadastros", async ({ page }) => {
  await enterDemo(page, "Administrador");
  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();
  const importUrl = page.url();
  const importButton = page.getByRole("button", { name: "Importar agenda" });
  await importButton.click();
  const importDialog = page.getByRole("dialog", { name: "Importar agenda" });
  await expect(importDialog).toBeVisible();
  await expect(importDialog.getByLabel("Arquivo de agenda")).toBeVisible();
  await expect(page).toHaveURL(importUrl);
  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();
  await importDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(importDialog).toHaveCount(0);
  await expect(importButton).toBeFocused();
  await page.getByRole("link", { name: /Relatórios/ }).click();
  await expect(page.getByRole("heading", { name: "Relatórios gerenciais" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Por loja" })).toBeVisible();
  await expect(page.locator(".report-page .stat")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Evolução diária" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comparativo por loja" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fornecedores com ocorrências" })).toBeVisible();
  await expect(page.locator('#report-form input[name="compare"]')).toBeChecked();
  await expect(page.getByRole("columnheader", { name: "Recusados" }).first()).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Sem agenda" }).first()).toBeVisible();
  await page.getByRole("link", { name: /Lojas/ }).click();
  await expect(page.getByRole("heading", { name: "Lojas", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Usuários/ }).click();
  await expect(page.getByRole("heading", { name: "Usuários", exact: true })).toBeVisible();
});

test("painel de recebimento diferencia ocorrências de agendamentos aguardando", async ({ page }) => {
  await enterDemo(page, "Administrador");
  await expect(page.locator(".dashboard-page .stat")).toHaveCount(4);
  await expect(page.getByRole("columnheader", { name: "Não recebidos" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Aguardando" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Pendentes" })).toHaveCount(0);
  await expect(page.locator("#dash-date")).toBeVisible();
  await expect(page.locator("#dash-store")).toBeVisible();
});

test("visualizador consulta relatórios sem ver cadastros", async ({ page }) => {
  await enterDemo(page, "Visualizador");
  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lojas" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await page.getByRole("link", { name: /Relatórios/ }).click();
  await expect(page.getByRole("heading", { name: "Relatórios gerenciais" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ocorrências e observações" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exportar CSV" })).toHaveCount(0);
});

test("conferente salva motivo obrigatório e volta o status para aguardando", async ({ page }) => {
  await enterDemo(page, "Conferente");
  await expect(page.getByRole("heading", { name: "Conferência de recebimentos" })).toBeVisible();
  await expect(page.getByText("Loja Demonstração").first()).toBeVisible();
  await expect(page.getByText("Distribuidora Exemplo")).toBeVisible();
  await page.locator('button[data-status][data-next="nao_chegou"]').first().click();
  const dialog = page.getByRole("dialog", { name: "Motivo do não recebimento" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toBeVisible();
  const reason = "Fornecedor cancelou a entrega na preview.";
  await dialog.locator('textarea[name="observation"]').fill(reason);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(reason)).toBeVisible();
  await page.locator('button[data-status][data-next="nao_chegou"]').first().click();
  await expect(page.getByText(reason)).toHaveCount(0);
});

test("menu mobile mantém navegação limpa e importar abre popup", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterDemo(page, "Administrador");
  const menu = page.getByRole("button", { name: "Abrir navegação" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Importação" })).toHaveCount(0);
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  const importButton = page.getByRole("button", { name: "Importar agenda" });
  const importUrl = page.url();
  await importButton.click();
  const importDialog = page.getByRole("dialog", { name: "Importar agenda" });
  await expect(importDialog).toBeVisible();
  await expect(page).toHaveURL(importUrl);
  await page.keyboard.press("Escape");
  await expect(importDialog).toHaveCount(0);
  await expect(importButton).toBeFocused();

  await menu.click();
  await page.getByRole("link", { name: /Relatórios/ }).click();
  await expect(page.getByRole("heading", { name: "Relatórios gerenciais" })).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});
