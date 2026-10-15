import { expect, test } from "@playwright/test";

test("JavaScript puro: painel e navegação após login rápido", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.getByRole("button", { name: /Administrador/ }).click();
  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();
  await page.getByRole("link", { name: /Lojas/ }).click();
  await expect(page.getByRole("heading", { name: "Lojas", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Usuários/ }).click();
  await expect(page.getByRole("heading", { name: "Usuários", exact: true })).toBeVisible();
});

test("JavaScript puro: conferente vê dados reais do D1 fictício", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Conferente/ }).click();
  await expect(page.getByRole("heading", { name: "Conferência de recebimentos" })).toBeVisible();
  await expect(page.getByText("Loja Demonstração").first()).toBeVisible();
  await expect(page.getByText("Distribuidora Exemplo")).toBeVisible();
});

test("JavaScript puro: visualizador consulta relatórios sem acessar cadastros", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Visualizador/ }).click();
  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Lojas" })).toHaveCount(0);
  await page.getByRole("link", { name: /Relatórios/ }).click();
  await expect(page.getByRole("heading", { name: "Relatórios gerenciais" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Por loja" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ocorrências e observações" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible();
});
