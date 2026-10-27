import { test, expect } from "@playwright/test";

const admin = { id: "adm-test", nome: "Admin Teste", papel: "admin" };
const viewer = { id: "viewer-test", nome: "Visualizador Teste", papel: "visualizador" };
const date = "2026-10-26";
const appointment = (id, protocol, supplier, startTime) => ({
  id, protocol, supplier, startTime, endTime: "08:30",
  type: "TESTE", status: "aguardando", ativo: true, origin: "importado",
  items: 1, volumes: 24, pallets: 1, nfe: [], orders: [],
  hasExchanges: false, observation: null
});
const appointments = [
  appointment("appt1", "99026101", "DISTRIBUIDORA ALFA", "07:00"),
  appointment("appt2", "99026102", "DISTRIBUIDORA ALFA", "08:10"),
  appointment("appt3", "99026103", "INDUSTRIA BETA", "10:00")
];
const row = {
  storeNumber: "01", storeName: "LOJA UM",
  department: "MERCEARIA", productCode: "12345", description: "PRODUTO SINTETICO",
  gtin: "7896007811298", orderCode: "80776", dispatchCode: "27896007811292",
  packageSize: 24, dispatchQty: 1, separateQty: 24
};
const report = {
  reportDate: date, reportCode: "Scm405", storeCount: 1,
  lines: 1, dispatchQty: 1, separateQty: 24, rows: [row], errors: []
};

async function mockDashboard(page, {
  storeCode = "CD DOCA 01", role = admin, linked = [], unavailable = false, dateStatus = "aberto"
} = {}) {
  const calls = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const json = value => route.fulfill({ json: value });
    if (path === "/api/auth/me") return json(role);
    if (path === "/api/realtime/config") return json({ mode: "off", protocolVersion: 1 });
    if (path === "/api/admin/stores") return json([{ id: "s1", codigo: storeCode, nome: "CD de testes", ativo: true, temConferenteAtivo: true }]);
    if (path === "/api/admin/presence") return json([]);
    if (path === "/api/admin/agendas") return json([{
      id: "agenda1", storeId: "s1", storeCode, storeName: "CD de testes",
      date, dayStatus: dateStatus, total: 3, aguardando: 3, recebido: 0,
      naoChegou: 0, recusado: 0, semAgenda: 0
    }]);
    if (path === "/api/admin/agendas/agenda1") return json({
      agenda: { id: "agenda1", storeCode, storeName: "CD de testes", date,
        dayStatus: dateStatus, completedAt: null, completedBy: null }, appointments
    });
    if (path === "/api/admin/cross/agendas/agenda1" && method === "GET") {
      return unavailable ? route.fulfill({ status: 503, json: { error: "D1_MIGRATION_MISSING" } })
        : json({ agendaId: "agenda1", date, suppliers: linked });
    }
    if (path === "/api/admin/cross/agendas/agenda1/appointments/appt1" && method === "GET") {
      return json({ appointment: linked[0]?.appointment, report: linked[0]?.cross, rows: [row] });
    }
    if (path.startsWith("/api/admin/cross/agendas/agenda1/appointments/") && method === "POST") {
      calls.push({ path, payload: route.request().postDataJSON() });
      return json({ id: "cross1", version: 1 });
    }
    if (path === "/api/diagnostics/events") return route.fulfill({ status: 204 });
    throw Error("API inesperada: " + method + " " + path);
  });
  await page.goto("/admin");
  return calls;
}

test("P2: somente a agenda do ADM da Doca 1 mostra Importar Cross", async ({ page }) => {
  await mockDashboard(page);
  await page.locator('[data-agenda-id="agenda1"]').click();
  const parent = page.locator(".agenda-preview-modal");
  await expect(parent.locator("[data-preview-cross-import]")).toBeVisible();
  await parent.locator("[data-preview-cross-import]").click();
  const modal = page.getByRole("dialog", { name: "Importar Cross" });
  await expect(modal).toBeVisible();
  await expect(modal.locator("[data-cross-agenda-appointment] option")).toHaveCount(4);
  await expect(modal.locator("[data-cross-agenda-appointment]")).toContainText("99026101");
  await expect(modal.locator("[data-cross-agenda-appointment]")).toContainText("99026102");
  await expect(modal.locator("[data-cross-agenda-submit]")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(parent).toBeVisible();
  await expect(parent.locator("[data-preview-cross-import]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(parent).toHaveCount(0);
});

test("P2: não mostra Importar Cross em outra doca, para visualizador ou agenda concluída", async ({ page }) => {
  await mockDashboard(page, { storeCode: "F01" });
  await page.locator('[data-agenda-id="agenda1"]').click();
  await expect(page.locator("[data-preview-cross-import]")).toBeHidden();
});

test("P2: visualizador não pode importar Cross", async ({ page }) => {
  await mockDashboard(page, { role: viewer });
  await page.locator('[data-agenda-id="agenda1"]').click();
  await expect(page.locator("[data-preview-cross-import]")).toHaveCount(0);
});

test("P2: agenda concluída desabilita importação e erro no D1 bloqueia envio", async ({ page }) => {
  await mockDashboard(page, { dateStatus: "concluido" });
  await page.locator('[data-agenda-id="agenda1"]').click();
  await expect(page.locator("[data-preview-cross-import]")).toBeDisabled();
});

test("P2: valida arquivo inválido e falha de migração sem enviar dados", async ({ page }) => {
  const calls = await mockDashboard(page, { unavailable: true });
  await page.locator('[data-agenda-id="agenda1"]').click();
  await page.locator("[data-preview-cross-import]").click();
  const modal = page.getByRole("dialog", { name: "Importar Cross" });
  await expect(modal.getByText(/migrations do D1 de testes/i)).toBeVisible();
  await expect(modal.locator("[data-cross-agenda-submit]")).toBeDisabled();
  expect(calls).toHaveLength(0);
});

test("P2: envia PDF validado no agendamento selecionado, com confirmação de data divergente", async ({ page }) => {
  await page.goto("/admin");
  await page.evaluate(async () => {
    const { openCrossAgendaImport } = await import("/frontend/cross-agenda-import.js");
    window.__crossP2 = { calls: [], imported: null };
    openCrossAgendaImport(document.body, {
      agenda: { id: "agenda1", storeCode: "CD DOCA 01", date: "2026-10-26" },
      appointments: [
        { id: "appt1", protocol: "99026101", supplier: "DISTRIBUIDORA ALFA", startTime: "07:00", ativo: true },
        { id: "appt2", protocol: "99026102", supplier: "DISTRIBUIDORA ALFA", startTime: "08:10", ativo: true }
      ],
      request: async (path, init) => {
        if (!init) return { suppliers: [] };
        const payload = JSON.parse(init.body);
        window.__crossP2.calls.push({ path, method: init.method, payload });
        return { id: "relatorio1", version: 1 };
      },
      extractText: async () => "relatorio sintetico",
      parseReport: () => ({
        reportDate: "2026-10-25", reportCode: "Scm405", storeCount: 1,
        lines: 1, dispatchQty: 1, separateQty: 24,
        errors: [],
        rows: [{
          storeNumber: "01", storeName: "LOJA UM", department: "MERCEARIA",
          productCode: "12345", description: "PRODUTO SINTETICO",
          gtin: "7896007811298", orderCode: "80776", dispatchCode: "27896007811292",
          packageSize: 24, dispatchQty: 1, separateQty: 24
        }]
      }),
      onImported: value => { window.__crossP2.imported = value; }
    });
  });
  const modal = page.getByRole("dialog", { name: "Importar Cross" });
  await modal.locator("[data-cross-agenda-appointment]").selectOption("appt2");
  await modal.locator("[data-cross-agenda-file]").setInputFiles({
    name: "relatorio-sintetico.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 synthetic")
  });
  await expect(modal.getByText("PRODUTO SINTETICO")).toBeHidden();
  await modal.locator(".cross-store summary").click();
  await expect(modal.getByText("PRODUTO SINTETICO")).toBeVisible();
  await expect(modal.locator("[data-cross-agenda-mismatch]")).toBeVisible();
  await expect(modal.locator("[data-cross-agenda-submit]")).toBeDisabled();
  await modal.locator("[data-cross-agenda-ack]").check();
  await expect(modal.locator("[data-cross-agenda-submit]")).toBeEnabled();
  await modal.locator("[data-cross-agenda-submit]").click();
  await expect(modal).toHaveCount(0);
  const captured = await page.evaluate(() => window.__crossP2);
  expect(captured.calls).toHaveLength(1);
  expect(captured.calls[0].path).toBe("/api/admin/cross/agendas/agenda1/appointments/appt2");
  expect(captured.calls[0].method).toBe("POST");
  expect(captured.calls[0].payload.operationalDate).toBe(date);
  expect(captured.calls[0].payload.reportDate).toBe("2026-10-25");
  expect(captured.calls[0].payload.rows[0].productCode).toBe("12345");
  expect(captured.imported.appointmentId).toBe("appt2");
});

test("P2: para substituir um Cross, exige confirmação e envia o ID da versão atual", async ({ page }) => {
  await page.goto("/admin");
  await page.evaluate(async () => {
    const { openCrossAgendaImport } = await import("/frontend/cross-agenda-import.js");
    window.__replacementP2 = { calls: [] };
    openCrossAgendaImport(document.body, {
      agenda: { id: "agenda1", storeCode: "CD DOCA 01", date: "2026-10-26" },
      appointments: [{ id: "ap1", protocol: "99026101", supplier: "ALFA", startTime: "07:00", ativo: true }],
      request: async (path, init) => {
        if (!init) return { suppliers: [{ appointment: { id: "ap1" },
          cross: { id: "cross-atual", version: 3, fileName: "antigo.pdf" } }] };
        window.__replacementP2.calls.push({ path, payload: JSON.parse(init.body) });
        return { id: "cross-novo", version: 4 };
      },
      extractText: async () => "sintetico",
      parseReport: () => ({
        reportDate: "2026-10-26", reportCode: "Scm405", storeCount: 1,
        lines: 1, dispatchQty: 1, separateQty: 24, errors: [],
        rows: [{
          storeNumber: "01", storeName: "LOJA UM", department: "MERCEARIA",
          productCode: "12345", description: "PRODUTO SINTETICO", gtin: "7896007811298",
          orderCode: "80776", dispatchCode: "27896007811292",
          packageSize: 24, dispatchQty: 1, separateQty: 24
        }]
      })
    });
  });
  const modal = page.getByRole("dialog", { name: "Importar Cross" });
  await modal.locator("[data-cross-agenda-appointment]").selectOption("ap1");
  await modal.locator("[data-cross-agenda-file]").setInputFiles({
    name: "novo.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF synthetic")
  });
  await expect(modal.locator("[data-cross-agenda-existing]")).toBeVisible();
  await expect(modal.locator("[data-cross-agenda-submit]")).toBeDisabled();
  await modal.locator("[data-cross-agenda-replace]").check();
  await modal.locator("[data-cross-agenda-submit]").click();
  const sent = await page.evaluate(() => window.__replacementP2.calls);
  expect(sent).toHaveLength(1);
  expect(sent[0].payload.replaceActiveReportId).toBe("cross-atual");
});

test("P4: ADM consulta Cross dentro da agenda, sem menu separado", async ({ page }) => {
  const linked = [{
    appointment: { id: "appt1", protocol: "99026101", supplier: "DISTRIBUIDORA ALFA",
      startTime: "07:00", endTime: "08:30" },
    cross: { id: "r1", agendaId: "agenda1", appointmentId: "appt1", active: true,
      stores: 1, lines: 1, separateQty: 24, dispatchQty: 1, reportDate: date, version: 1 }
  }];
  await mockDashboard(page, { linked });
  await expect(page.locator('a[href="/admin/cross"]')).toHaveCount(0);
  await page.locator('[data-agenda-id="agenda1"]').click();
  const parent=page.locator(".agenda-preview-modal");
  await expect(parent.locator("[data-preview-cross-view]")).toBeVisible();
  await parent.locator("[data-preview-cross-view]").click();
  const modal=page.getByRole("dialog",{name:"Ver Cross"});
  await expect(modal.locator("[data-cross-supplier]")).toHaveCount(1);
  await modal.locator("[data-cross-supplier='appt1']").click();
  await modal.locator(".cross-store summary").click();
  await expect(modal.getByText("PRODUTO SINTETICO")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(parent).toBeVisible();
  await expect(parent.locator("[data-preview-cross-view]")).toBeFocused();
});

test("P4: outras docas e visualizador não recebem consulta Cross administrativa",async({page})=>{
  await mockDashboard(page,{storeCode:"F01"});
  await page.locator('[data-agenda-id="agenda1"]').click();
  await expect(page.locator("[data-preview-cross-view]")).toBeHidden();
});

test("P4: visualizador não tem consulta administrativa Cross",async({page})=>{
  await mockDashboard(page,{role:viewer});
  await page.locator('[data-agenda-id="agenda1"]').click();
  await expect(page.locator("[data-preview-cross-view]")).toHaveCount(0);
});
