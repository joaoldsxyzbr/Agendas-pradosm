import { expect, test } from "@playwright/test";

test("login rápido exibe os três papéis somente na preview", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Acesso rápido" })).toBeVisible();
  for (const title of ["Administrador", "Visualizador", "Conferente"]) {
    await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
  }
  await page.getByRole("button", { name: /Visualizador.*Consultar indicadores/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("button", { name: "Importar agenda" })).toHaveCount(0);
});

test("conferente entra em um clique na loja fictícia", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Conferente.*Receber agendamentos/ }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Loja Demonstração")).toBeVisible();
});

test("administrador entra sem senha e vê as opções de gestão", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /Administrador.*Gerenciar a operação/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("button", { name: "Importar agenda" })).toBeVisible();
});
