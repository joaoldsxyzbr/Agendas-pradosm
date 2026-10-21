import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = readFileSync(new URL("../fixtures/agenda-todas-lojas-real-sanitizada.csv", import.meta.url));
const admin = { id: "adm1", nome: "Admin Teste", papel: "admin", login: "adm" };

async function openImport(page, { conflict = false } = {}) {
  const submissions = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const respond = data => route.fulfill({ json: data });
    if (url === "/api/auth/me") return respond(admin);
    if (url === "/api/realtime/config") return respond({ mode: "off", protocolVersion: 1 });
    if (url === "/api/admin/stores") return respond([
      { id: "store1", codigo: "F01", nome: "Biguaçu", ativo: true, temConferenteAtivo: true },
      { id: "store8", codigo: "F08", nome: "Porto Belo", ativo: true, temConferenteAtivo: true }
    ]);
    if (url === "/api/admin/agendas") return respond([]);
    if (url === "/api/admin/presence") return respond([]);
    if (url === "/api/admin/agendas/import/bulk" && method === "POST") {
      const payload = route.request().postDataJSON();
      submissions.push(payload);
      if (conflict && !payload.agendas.every(agenda => agenda.replace)) {
        return route.fulfill({ status: 409, json: { error: "AGENDAS_JA_EXISTEM", message: "Agendas existentes" } });
      }
      return route.fulfill({
        status: 201, json: { totalAgendas: payload.agendas.length, totalAppointments: payload.agendas.reduce((sum,a) => sum + a.appointments.length, 0) }
      });
    }
    throw Error("API não preparada em import-csv.spec: " + method + " " + url);
  });
  await page.goto("/admin");
  await page.locator("[data-open-import]").click();
  await expect(page.getByRole("dialog", { name: "Importar agenda" })).toBeVisible();
  return submissions;
}

test("CSV válido abre prévia persistente e só importa após confirmação", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const submissions = await openImport(page);
  await page.locator("[data-import-file]").setInputFiles({
    name: "agenda-valida.csv", mimeType: "text/csv", buffer: fixture
  });
  await expect(page.locator("[data-import-file-name]")).toHaveText("agenda-valida.csv");
  await expect(page.locator(".preview-summary")).toContainText("4 agendamentos");
  await expect(page.locator(".preview-summary")).toContainText("3 lojas");
  await expect(page.locator("[data-import-submit]")).toBeEnabled();
  await expect(page.getByRole("dialog", { name: "Importar agenda" })).toBeVisible();
  expect(submissions).toHaveLength(0);
  await page.locator("[data-import-submit]").click();
  await expect(page.getByRole("dialog", { name: "Importar agenda" })).toHaveCount(0);
  expect(submissions).toHaveLength(1);
  expect(submissions[0].agendas.map(a => a.storeCode)).toEqual(["CD", "F01", "F08"]);
  expect(submissions[0].agendas.reduce((sum,a)=>sum+a.appointments.length,0)).toBe(4);
  expect(errors).toEqual([]);
});

test("CSV com colunas inválidas mantém modal aberto e mostra erro", async ({ page }) => {
  const submissions = await openImport(page);
  await page.locator("[data-import-file]").setInputFiles({
    name: "invalido.csv", mimeType: "text/csv", buffer: Buffer.from("x;y\n1;2\n")
  });
  await expect(page.getByRole("dialog", { name: "Importar agenda" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Erros da importação" })).toContainText("não possui as colunas esperadas");
  await expect(page.locator("[data-import-submit]")).toBeDisabled();
  expect(submissions).toHaveLength(0);
});

test("Resposta 409 exige confirmação explícita de substituição", async ({ page }) => {
  const submissions = await openImport(page, { conflict: true });
  await page.locator("[data-import-file]").setInputFiles({
    name: "agenda.csv", mimeType: "text/csv", buffer: fixture
  });
  await expect(page.locator("[data-import-submit]")).toBeEnabled();
  await page.locator("[data-import-submit]").click();
  await expect(page.locator("[data-import-replace]")).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0].agendas.every(a => a.replace)).toBe(false);
  await page.locator("[data-import-replace]").click();
  expect(submissions).toHaveLength(2);
  expect(submissions[1].agendas.every(a => a.replace)).toBe(true);
  await expect(page.getByRole("dialog", { name: "Importar agenda" })).toHaveCount(0);
});

test("CSV Windows-1252 com acentos abre prévia corretamente", async ({ page }) => {
  await openImport(page);
  await page.locator("[data-import-file]").setInputFiles({
    name: "agenda-windows.csv", mimeType: "text/csv",
    buffer: Buffer.from(fixture.toString("utf8"), "latin1")
  });
  await expect(page.locator(".preview-summary")).toContainText("4 agendamentos");
  await expect(page.locator("[data-import-submit]")).toBeEnabled();
});

test("CSV UTF-16LE com BOM abre prévia corretamente", async ({ page }) => {
  await openImport(page);
  const csv = Buffer.concat([
    Buffer.from([0xff, 0xfe]), Buffer.from(fixture.toString("utf8"), "utf16le")
  ]);
  await page.locator("[data-import-file]").setInputFiles({
    name: "agenda-utf16.csv", mimeType: "text/csv", buffer: csv
  });
  await expect(page.locator(".preview-summary")).toContainText("4 agendamentos");
  await expect(page.locator("[data-import-submit]")).toBeEnabled();
});
