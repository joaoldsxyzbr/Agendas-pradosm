import { test, expect } from "@playwright/test";
import { createSessionToken } from "../../worker/lib/session.js";
import { businessDate } from "../../shared/time.js";
import { syntheticCrossPdf } from "../e2e/synthetic-cross-pdf.js";

// A execução compartilha um D1 local: uma tentativa falha não pode repetir seeds no mesmo banco.
test.describe.configure({ retries: 0 });

// Integração P5: nenhuma interceptação de API nem acesso ao D1 remoto.
// O Playwright usa o Worker real e o D1 local preparado por prepare-e2e.mjs.
const BASE = "http://127.0.0.1:8789";
const SECRET = "agendas-prado-migracao-e2e-somente-local";
const ADMIN_ID = "20000000-0000-4000-8000-000000000001";
const VIEWER_ID = "20000000-0000-4000-8000-000000000002";
const F05_CLERK_ID = "20000000-0000-4000-8000-000000000003";

async function sessionCookie(id) {
  return "agenda_session=" + await createSessionToken(id, 1, SECRET);
}

async function headers(id, mutation = false) {
  return {
    Cookie: await sessionCookie(id),
    ...(mutation ? { Origin: BASE } : {})
  };
}

const crossRow = {
  storeNumber: "01",
  storeName: "LOJA SINTETICA 01",
  department: "MERCEARIA",
  productCode: "12345",
  description: "PRODUTO CROSS SINTETICO",
  gtin: "7896007811298",
  orderCode: "80776",
  dispatchCode: "27896007811292",
  packageSize: 24,
  dispatchQty: 1,
  separateQty: 24
};

function crossInput(date, row = crossRow) {
  return {
    operationalDate: date,
    reportDate: date,
    reportCode: "Scm405",
    fileName: "cross-e2e-sintetico.pdf",
    reference: "Teste isolado",
    declared: { lines: 1, dispatchQty: 1, separateQty: 24 },
    rows: [row]
  };
}

async function browseAs(page, id, path) {
  await page.context().clearCookies();
  await page.context().addCookies([{
    name: "agenda_session",
    value: (await sessionCookie(id)).slice("agenda_session=".length),
    url: BASE,
    httpOnly: true,
    sameSite: "Strict"
  }]);
  await page.goto(path);
}

test("P5: Worker e D1 locais validam Cross, três perfis, interface, versões e dia concluído", async ({ request, page }) => {
  const date = businessDate();
  const admin = await headers(ADMIN_ID, true);

  // Todos os dados são sintéticos e existem somente no D1 efêmero do CI.
  const newStore = await request.post("/api/admin/stores", {
    headers: admin,
    data: { codigo: "CD DOCA 01", nome: "CD Doca 01 (E2E sintético)" }
  });
  expect(newStore.status(), await newStore.text()).toBe(201);
  const store = await newStore.json();

  const newClerk = await request.post("/api/admin/users", {
    headers: admin,
    data: {
      nome: "Conferente Cross E2E",
      login: "conferente-cross-e2e",
      senha: "SenhaE2ESomenteLocal2026!",
      papel: "conferente",
      lojaId: store.id
    }
  });
  expect(newClerk.status(), await newClerk.text()).toBe(201);
  const clerk = await newClerk.json();

  const imported = await request.post("/api/admin/agendas/import/bulk", {
    headers: admin,
    data: { agendas: [{
      storeCode: "CD DOCA 01",
      date,
      originalFileName: "agenda-cross-e2e-sintetica.csv",
      appointments: [{
        protocol: "998812340001",
        startTime: "08:00",
        endTime: "09:00",
        supplier: "FORNECEDOR CROSS SINTETICO",
        items: 1, volumes: 24, pallets: 1,
        cargaBatida: null, type: "Nota fiscal",
        nfe: [], orders: []
      }]
    }] }
  });
  expect(imported.status(), await imported.text()).toBe(201);
  const agendaId = (await imported.json()).agendas[0].agendaId;
  const details = await request.get("/api/admin/agendas/" + agendaId, {
    headers: await headers(ADMIN_ID)
  });
  expect(details.status()).toBe(200);
  const appointmentId = (await details.json()).appointments[0].id;
  const crossPath = "/api/admin/cross/agendas/" + agendaId + "/appointments/" + appointmentId;
  const storePath = "/api/store/cross/agendas/" + agendaId;

  expect((await request.get(crossPath)).status()).toBe(401);
  expect((await request.get(crossPath, { headers: await headers(VIEWER_ID) })).status()).toBe(403);
  expect((await request.get(storePath, { headers: await headers(F05_CLERK_ID) })).status()).toBe(403);
  expect((await request.post(crossPath, {
    headers: { ...admin, Origin: "https://origem-externa.example" },
    data: crossInput(date)
  })).status()).toBe(403);

  const created = await request.post(crossPath, {
    headers: admin, data: crossInput(date)
  });
  expect(created.status(), await created.text()).toBe(201);
  const first = await created.json();
  expect(first.version).toBe(1);
  expect(first.appointmentId).toBe(appointmentId);

  const clerkList = await request.get(storePath, {
    headers: await headers(clerk.id)
  });
  expect(clerkList.status()).toBe(200);
  const activeSuppliers = (await clerkList.json()).suppliers;
  expect(activeSuppliers).toHaveLength(1);
  expect(activeSuppliers[0].appointment.id).toBe(appointmentId);

  const clerkDetail = await request.get(storePath + "/appointments/" + appointmentId, {
    headers: await headers(clerk.id)
  });
  expect(clerkDetail.status()).toBe(200);
  expect((await clerkDetail.json()).rows[0].description).toBe(crossRow.description);
  expect((await request.post(crossPath, {
    headers: admin, data: crossInput(date)
  })).status()).toBe(409);

  const replacement = await request.post(crossPath, {
    headers: admin,
    data: {
      ...crossInput(date, {
        ...crossRow,
        description: "PRODUTO CROSS REVISADO"
      }),
      replaceActiveReportId: first.id
    }
  });
  expect(replacement.status(), await replacement.text()).toBe(201);
  expect((await replacement.json()).version).toBe(2);

  const history = await request.get(crossPath + "/history", {
    headers: await headers(ADMIN_ID)
  });
  expect(history.status()).toBe(200);
  expect((await history.json()).versions.map(item => [item.version, item.active]))
    .toEqual([[2, true], [1, false]]);
  const archived = await request.get(crossPath + "/history/" + first.id, {
    headers: await headers(ADMIN_ID)
  });
  expect(archived.status()).toBe(200);
  expect((await archived.json()).rows[0].description).toBe(crossRow.description);
  expect((await request.get(storePath + "/appointments/" + appointmentId + "/history", {
    headers: await headers(clerk.id)
  })).status()).toBe(404);

  // UI completa consumindo a API real do Worker (sem page.route).
  await browseAs(page, clerk.id, "/app");
  await expect(page.locator("[data-store-cross-context]")).toBeVisible();
  await page.locator("[data-store-cross-context]").click();
  const clerkModal = page.getByRole("dialog", { name: "Ver Cross" });
  await expect(clerkModal.locator("[data-cross-supplier]")).toHaveCount(1);
  await clerkModal.locator("[data-cross-supplier]").click();
  await clerkModal.locator(".cross-store summary").click();
  await expect(clerkModal.getByText("PRODUTO CROSS REVISADO")).toBeVisible();
  await expect(clerkModal.locator("[data-cross-history]")).toHaveCount(0);

  await browseAs(page, ADMIN_ID, "/admin");
  await page.locator('[data-agenda-id="' + agendaId + '"]').click();
  const preview = page.locator(".agenda-preview-modal");
  await expect(preview.locator("[data-preview-cross-view]")).toBeVisible();
  await preview.locator("[data-preview-cross-view]").click();
  const adminModal = page.getByRole("dialog", { name: "Ver Cross" });
  await adminModal.locator("[data-cross-supplier]").click();
  await adminModal.locator(".cross-store summary").click();
  await expect(adminModal.getByText("PRODUTO CROSS REVISADO")).toBeVisible();

  // Histórico operacional deve ser consultável pelo ADM na interface,
  // sem restaurar nem modificar o relatório ativo.
  await adminModal.locator("[data-cross-history]").click();
  await expect(adminModal.locator("[data-cross-version]")).toHaveCount(2);
  await adminModal.locator('[data-cross-version="1"]').click();
  await adminModal.locator(".cross-store summary").click();
  await expect(adminModal.getByText("PRODUTO CROSS SINTETICO")).toBeVisible();
  await expect(adminModal.getByText("PRODUTO CROSS REVISADO")).toHaveCount(0);
  await adminModal.locator("[data-cross-history-back]").click();
  await adminModal.locator('[data-cross-version="2"]').click();
  await adminModal.locator(".cross-store summary").click();
  await expect(adminModal.getByText("PRODUTO CROSS REVISADO")).toBeVisible();

  // Importação real na UI: PDF 1.4 sintético -> LiteParse WASM -> prévia ->
  // confirmação de substituição -> POST no Worker e persistência no D1 local.
  await adminModal.locator("[data-cross-close]").click();
  await preview.locator("[data-preview-cross-import]").click();
  const importModal = page.getByRole("dialog", { name: "Importar Cross" });
  await expect(importModal).toBeVisible();
  await importModal.locator("[data-cross-agenda-appointment]").selectOption(appointmentId);
  await expect(importModal.locator("[data-cross-agenda-existing]")).toBeVisible();
  await importModal.locator("[data-cross-agenda-file]").setInputFiles({
    name: "scm405-sintetico.pdf",
    mimeType: "application/pdf",
    buffer: syntheticCrossPdf(date)
  });
  await expect(importModal.locator("[data-cross-agenda-preview]"))
    .toContainText("PRODUTO IMPORTADO VIA PDF", { timeout: 30000 });
  await expect(importModal.locator("[data-cross-agenda-submit]")).toBeDisabled();
  await importModal.locator("[data-cross-agenda-replace]").check();
  await expect(importModal.locator("[data-cross-agenda-submit]")).toBeEnabled();
  await importModal.locator("[data-cross-agenda-submit]").click();
  await expect(importModal).toHaveCount(0);
  const importedFromPdf = await request.get(crossPath, { headers: await headers(ADMIN_ID) });
  expect(importedFromPdf.status()).toBe(200);
  const importedPdfReport = await importedFromPdf.json();
  expect(importedPdfReport.report.version).toBe(3);
  expect(importedPdfReport.rows[0].description).toBe("PRODUTO IMPORTADO VIA PDF");
  expect(importedPdfReport.report.lines).toBe(1);
  expect(importedPdfReport.report.separateQty).toBe(24);
  const finalHistory = await request.get(crossPath + "/history", {
    headers: await headers(ADMIN_ID)
  });
  expect((await finalHistory.json()).versions.map(item => [item.version, item.active]))
    .toEqual([[3, true], [2, false], [1, false]]);

  const finish = await request.patch("/api/admin/agendas/" + agendaId + "/status", {
    headers: admin, data: { status: "concluido" }
  });
  expect(finish.status()).toBe(200);
  expect((await request.post(crossPath, {
    headers: admin,
    data: { ...crossInput(date), replaceActiveReportId: first.id }
  })).status()).toBe(409);
  expect((await request.get(storePath, {
    headers: await headers(clerk.id)
  })).status()).toBe(200);
});
