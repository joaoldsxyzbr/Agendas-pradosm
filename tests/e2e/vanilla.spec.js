import { expect, test } from "@playwright/test";

test("prévia vanilla apresenta navegação, indicadores e relatórios sem API", async ({ page }) => {
  const apiCalls = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url());
  });
  await page.goto("/vanilla/index.html");
  await expect(page.getByRole("heading", { name: "Visão geral do recebimento" })).toBeVisible();
  await expect(page.getByText("PREVIEW · MOCK")).toBeVisible();
  await page.getByRole("link", { name: /Relatórios/ }).click();
  await expect(page.getByRole("heading", { name: "Relatórios gerenciais" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ocorrências e justificativas" })).toBeVisible();
  await page.getByRole("combobox", { name: "Loja" }).selectOption("003");
  await expect(page.getByText("Cooperativa Litoral")).not.toBeVisible();
  await expect(page.getByText("Logística Vale do Itajaí").first()).toBeVisible();
  expect(apiCalls).toEqual([]);
});

test("conferente registra motivo obrigatório e redefine status na prévia", async ({ page }) => {
  await page.goto("/vanilla/index.html#conferente");
  await expect(page.getByRole("heading", { name: "Conferência de recebimentos" })).toBeVisible();
  await page.getByRole("button", { name: "Não recebido: Cooperativa Litoral" }).click();
  const dialog=page.getByRole("dialog", { name: "Motivo do não recebimento" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Observação (obrigatória)" }).fill("Fornecedor cancelou a entrega.");
  await dialog.getByRole("button", { name: "Salvar motivo" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Fornecedor cancelou a entrega.")).toBeVisible();
  await page.getByRole("button", { name: "Não recebido: Cooperativa Litoral" }).click();
  await expect(page.getByText("Fornecedor cancelou a entrega.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Não recebido: Cooperativa Litoral" })).toHaveAttribute("aria-pressed", "false");
});

test("prévia vanilla disponibiliza menu no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/vanilla/index.html");
  const menu=page.getByRole("button", { name: "Abrir navegação" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: /Conferente/ }).click();
  await expect(page.getByRole("heading", { name: "Conferência de recebimentos" })).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});
