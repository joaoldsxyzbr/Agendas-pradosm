import { expect, test } from "@playwright/test";

// Cobertura da interface real em HTML/CSS/JavaScript, sem React.
test("interface nativa oferece login rápido para todos os perfis", async ({ page }) => {
  await page.goto("/vanilla/live.html");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Administrador/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Visualizador/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Conferente/ })).toBeVisible();
});

test("administrador consulta relatórios reais na interface nativa", async ({ page }) => {
  await page.goto("/vanilla/live.html");
  await page.getByRole("button", { name: /Administrador/ }).click();
  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();
  await page.getByRole("link", { name: /Relatórios/ }).click();
  await expect(page.getByRole("heading", { name: "Relatórios gerenciais" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ocorrências e observações" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible();
});

test("visualizador permanece sem acesso aos cadastros", async ({ page }) => {
  await page.goto("/vanilla/live.html");
  await page.getByRole("button", { name: /Visualizador/ }).click();
  await expect(page.getByRole("heading", { name: "Recebimento" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lojas" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Usuários" })).toBeHidden();
  await expect(page.getByRole("link", { name: /Relatórios/ })).toBeVisible();
});

test("conferente usa a agenda da loja fictícia", async ({ page }) => {
  await page.goto("/vanilla/live.html");
  await page.getByRole("button", { name: /Conferente/ }).click();
  await expect(page.getByRole("heading", { name: "Conferência de recebimentos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Loja Demonstração" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Relatórios/ })).toBeHidden();
});
