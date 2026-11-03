import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = readFileSync(new URL("../../../tests/fixtures/agenda-todas-lojas-real-sanitizada.csv", import.meta.url));
const admin = { id: "adm", nome: "Admin Teste", papel: "admin" };
const viewer = { id: "view", nome: "Visualizador", papel: "visualizador" };

async function setup(page, { conflict = false, missingStores = false, role = "admin" } = {}) {
  const submissions = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === "/api/auth/me") return route.fulfill({ json: role === "admin" ? admin : viewer });
    if (path === "/api/realtime/config") return route.fulfill({ json: { mode: "off", protocolVersion: 1 } });
    // O visualizador redirecionado para /admin carrega as consultas de Recebimento.
    if (role === "visualizador" && ["/api/admin/stores", "/api/admin/agendas", "/api/admin/presence"].includes(path)) {
      return route.fulfill({ json: [] });
    }
    if (path === "/api/admin/agendas/import/bulk" && method === "POST") {
      const payload = route.request().postDataJSON();
      submissions.push(payload);
      if (missingStores) {
        return route.fulfill({ status: 422, json: {
          error: "LOJAS_NAO_ENCONTRADAS",
          message: "Uma ou mais lojas do arquivo não estão cadastradas ou estão inativas.",
          stores: ["CD DOCA 07"],
        } });
      }
      if (conflict && !payload.agendas.every(a => a.replace === true)) {
        return route.fulfill({ status: 409, json: { error: "AGENDAS_JA_EXISTEM", message: "Agendas existentes" } });
      }
      return route.fulfill({ status: 201, json: {
        totalAgendas: payload.agendas.length,
        totalAppointments: payload.agendas.reduce((n, a) => n + a.appointments.length, 0),
      } });
    }
    throw Error("API inesperada no teste React: " + method + " " + path);
  });
  await page.goto("/admin/import");
  return submissions;
}
const upload = (page, { name = "agenda.csv", mimeType = "text/csv", buffer = fixture } = {}) =>
  page.getByLabel("Arquivo CSV ou PDF").setInputFiles({ name, mimeType, buffer });
test("CSV React: prévia correta, sem gravar antes de confirmação", async ({ page }) => {
  const submissions = await setup(page);
  await upload(page);
  const preview = page.getByLabel("Resumo da prévia");
  await expect(preview).toContainText("3 lojas");
  await expect(preview).toContainText("4 agendamentos");
  await expect(page.getByRole("table", { name: "Prévia de agendamentos" }).locator("tbody tr")).toHaveCount(4);
  expect(submissions).toHaveLength(0);
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("status", { name: "Importação concluída" })).toContainText("3 lojas");
  expect(submissions).toHaveLength(1);
  expect(submissions[0].agendas.map(a => a.storeCode)).toEqual(["CD", "F01", "F08"]);
  expect(submissions[0].agendas.every(a => a.originalFileName === "agenda.csv")).toBe(true);
  expect(submissions[0].agendas.flatMap(a => a.appointments).every(a => !("status" in a))).toBe(true);
  await expect(page.getByRole("button", { name: "Confirmar importação" })).toHaveCount(0);
});
test("CSV React: conflito 409 exige segunda confirmação explícita", async ({ page }) => {
  const submissions = await setup(page, { conflict: true });
  await upload(page);
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByRole("alert", { name: "Confirmar substituição" })).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0].agendas.every(a => !a.replace)).toBe(true);
  await page.getByRole("button", { name: "Substituir agendas existentes" }).click();
  await expect(page.getByRole("status", { name: "Importação concluída" })).toBeVisible();
  expect(submissions).toHaveLength(2);
  expect(submissions[1].agendas.every(a => a.replace === true)).toBe(true);
});
test("CSV React: 422 lista as lojas do arquivo não cadastradas", async ({ page }) => {
  const submissions = await setup(page, { missingStores: true });
  await upload(page);
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(page.getByText(/não cadastradas ou inativas/)).toContainText("CD DOCA 07");
  await expect(page.getByRole("button", { name: "Substituir agendas existentes" })).toHaveCount(0);
  expect(submissions).toHaveLength(1);
});
test("CSV React: erro bloqueante impede envio", async ({ page }) => {
  const submissions = await setup(page);
  await upload(page, { name: "invalido.csv", buffer: Buffer.from("x;y\n1;2\n") });
  await expect(page.getByRole("alert", { name: "Erros da importação" })).toContainText("não possui as colunas esperadas");
  await expect(page.getByRole("button", { name: "Confirmar importação" })).toBeDisabled();
  expect(submissions).toHaveLength(0);
});
test("CSV React: protocolo duplicado aparece com mensagem clara", async ({ page }) => {
  const submissions = await setup(page);
  const csv = [
    "Protocolo;Data agenda;Fornecedor;Filial;Doca;Itens;Vol.;Paletes;Carga batida;Tipo;N° NFe;Pedidos",
    "123456;03/11/2026 08:00 às 08:10;FORNECEDOR X;F01 - BIGUAÇU;DOCA 01;1;1;0;-;Nota fiscal;-;-",
    "123456;03/11/2026 09:00 às 09:10;FORNECEDOR Y;F01 - BIGUAÇU;DOCA 01;1;1;0;-;Nota fiscal;-;-",
  ].join("\n");
  await upload(page, { name: "duplicado.csv", buffer: Buffer.from(csv) });
  await expect(page.getByRole("alert", { name: "Erros da importação" }))
    .toContainText("O protocolo 123456 aparece mais de uma vez na loja F01");
  await expect(page.getByRole("button", { name: "Confirmar importação" })).toBeDisabled();
  expect(submissions).toHaveLength(0);
});
test("CSV React: interpreta Windows-1252 e UTF-16LE", async ({ page }) => {
  await setup(page);
  await upload(page, { name: "agenda-ansi.csv", buffer: Buffer.from(fixture.toString("utf8"), "latin1") });
  await expect(page.getByLabel("Resumo da prévia")).toContainText("4 agendamentos");
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(fixture.toString("utf8"), "utf16le")]);
  await upload(page, { name: "agenda-utf16.csv", buffer: utf16 });
  await expect(page.getByLabel("Resumo da prévia")).toContainText("4 agendamentos");
});
test("Importação React rejeita arquivo vazio, formato estranho e arquivo maior que 10MB", async ({ page }) => {
  const submissions = await setup(page);
  await upload(page, { name: "vazio.csv", buffer: Buffer.alloc(0) });
  await expect(page.getByText("O arquivo está vazio.")).toBeVisible();
  await upload(page, { name: "executavel.exe", mimeType: "application/octet-stream", buffer: Buffer.from("wrong") });
  await expect(page.getByText("Selecione um arquivo CSV ou PDF.")).toBeVisible();
  await upload(page, { name: "grande.csv", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 65) });
  await expect(page.getByText("O arquivo excede o limite de 10 MB.")).toBeVisible();
  expect(submissions).toHaveLength(0);
});
test("Importação React: PDF inválido não é tratado como agenda válida", async ({ page }) => {
  const submissions = await setup(page);
  await upload(page, { name: "invalid.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\ninvalid") });
  await expect(page.getByText("Não foi possível ler o PDF selecionado.")).toBeVisible({ timeout: 20000 });
  expect(submissions).toHaveLength(0);
});
test("Visualizador não acessa importação React", async ({ page }) => {
  await setup(page, { role: "visualizador" });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Importar agenda" })).toHaveCount(0);
});
test("Importação React mantém conteúdo dentro do viewport móvel", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page);
  await expect(page.getByRole("table", { name: "Prévia de agendamentos" })).toBeVisible();
  const sizes = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="import-table-scroll"]');
    return { table: t.scrollWidth - t.clientWidth, page: document.documentElement.clientWidth };
  });
  expect(sizes.table).toBeGreaterThan(100);
  expect(sizes.page).toBe(390);
});
