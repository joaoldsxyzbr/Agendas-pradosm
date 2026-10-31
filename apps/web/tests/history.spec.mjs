import { test, expect } from "@playwright/test";

const admin = { id: "admin-sintetico", nome: "Administrador Teste", papel: "admin" };
const viewer = { id: "viewer-sintetico", nome: "Visualizador Teste", papel: "visualizador" };
const uuid = i => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");

function buildState() {
  return {
    agendas: [
      { id: uuid(10), storeCode: "F01", storeName: "Unidade Central", date: "2026-10-28", dayStatus: "concluido", total: 12, recebido: 10, aguardando: 0, naoChegou: 2, recusado: 0, semAgenda: 0 },
      { id: uuid(11), storeCode: "F02", storeName: "Unidade Sul", date: "2026-10-28", dayStatus: "aberto", total: 5, recebido: 2, aguardando: 3, naoChegou: 0, recusado: 0, semAgenda: 0 },
    ],
    appointments: [
      { id: uuid(20), supplier: "Distribuidora Alfa", protocol: "P100", startTime: "08:00", endTime: "10:00", status: "recebido", hasExchanges: false, origin: "imported", observation: null },
      { id: uuid(21), supplier: "Transporte Beta", protocol: "P101", startTime: "10:00", endTime: "12:00", status: "aguardando", hasExchanges: true, origin: "manual", observation: null },
    ],
  };
}

async function setup(page, { role = "admin", conflict = false, listError = false } = {}) {
  const current = role === "admin" ? admin : viewer;
  const state = buildState();
  const requests = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    const body = method === "GET" ? null : route.request().postDataJSON();
    requests.push({ path, method, body, params: url.searchParams });
    if (path === "/api/auth/me") return route.fulfill({ json: current });
    if (path === "/api/realtime/config") return route.fulfill({ json: { mode: "off", protocolVersion: 1 } });
    if (path === "/api/admin/stores") return route.fulfill({ json: [
      { id: uuid(1), codigo: "F01", nome: "Unidade Central", ativo: true, temConferenteAtivo: true },
      { id: uuid(2), codigo: "F02", nome: "Unidade Sul", ativo: true, temConferenteAtivo: true },
    ] });
    if (path === "/api/admin/agendas" && method === "GET") {
      if (listError) { listError = false; return route.fulfill({ status: 503, json: { error: "FALHA" } }); }
      const storeCode = url.searchParams.get("storeCode") ?? "";
      const date = url.searchParams.get("date") ?? "";
      return route.fulfill({ json: state.agendas.filter(agenda =>
        (!storeCode || agenda.storeCode === storeCode) && (!date || agenda.date === date)) });
    }
    if (path === `/api/admin/agendas/${uuid(10)}` && method === "GET")
      return route.fulfill({ json: { agenda: { ...state.agendas[0] }, appointments: state.appointments } });
    if (path === `/api/admin/agendas/${uuid(10)}/history`)
      return route.fulfill({ json: [{ id: "evt-1", action: "concluido", details: null, changedAt: "2026-10-28T22:00:00.000Z", user: { id: admin.id, name: admin.nome } }] });
    if (path === `/api/admin/appointments/${uuid(21)}/history`)
      return route.fulfill({ json: [{ id: "se-1", appointmentId: uuid(21), statusAnterior: "aguardando", statusNovo: "recebido", observation: null, alteradoEm: "2026-10-28T14:00:00.000Z", usuario: { id: admin.id, nome: admin.nome } }] });
    if (path === `/api/admin/appointments/${uuid(21)}/status` && method === "PATCH") {
      if (conflict) { conflict = false; return route.fulfill({ status: 409, json: { error: "ESTADO_ALTERADO", message: "A agenda mudou desde a consulta. Atualize e tente novamente." } }); }
      state.appointments = state.appointments.map(item =>
        item.id === uuid(21) ? { ...item, status: body.status, observation: body.observation ?? null } : item);
      return route.fulfill({ json: state.appointments.find(item => item.id === uuid(21)) });
    }
    if (path === `/api/admin/appointments/${uuid(21)}/exchanges` && method === "PATCH") {
      state.appointments = state.appointments.map(item =>
        item.id === uuid(21) ? { ...item, hasExchanges: Boolean(body.hasExchanges) } : item);
      return route.fulfill({ json: state.appointments.find(item => item.id === uuid(21)) });
    }
    if (path === `/api/admin/agendas/${uuid(10)}/status` && method === "PATCH") {
      state.agendas = state.agendas.map(agenda =>
        agenda.id === uuid(10) ? { ...agenda, dayStatus: "aberto" } : agenda);
      return route.fulfill({ json: { id: uuid(10), storeCode: "F01", storeName: "Unidade Central", date: "2026-10-28", dayStatus: "aberto" } });
    }
    throw Error("Endpoint inesperado no teste: " + method + " " + path);
  });
  await page.goto("/admin/history");
  return { requests, state };
}

async function openAgenda(page) {
  await page.getByRole("combobox", { name: "Loja" }).selectOption("F01");
  await page.getByLabel("Data").fill("2026-10-28");
  await page.getByRole("button", { name: "Filtrar" }).click();
  const table = page.getByRole("table", { name: "Agendas do histórico" });
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Abrir agenda" }).click();
  await expect(page.getByRole("table", { name: "Agendamentos da agenda" }).locator("tbody tr")).toHaveCount(2);
}

test("Histórico React consulta somente após filtrar e abre detalhe com eventos do dia", async ({ page }) => {
  const state = await setup(page);
  await expect(page.getByText("Use os filtros para consultar agendas.")).toBeVisible();
  expect(state.requests.filter(r => r.path === "/api/admin/agendas")).toHaveLength(0);
  await openAgenda(page);
  const detail = page.getByRole("region", { name: "Detalhe da agenda" });
  await expect(detail).toContainText("F01 - Unidade Central");
  await expect(detail).toContainText("28/10/2026");
  await expect(detail).toContainText("Dia concluído");
  const query = state.requests.find(r => r.path === "/api/admin/agendas");
  expect(query.params.get("storeCode")).toBe("F01");
  expect(query.params.get("date")).toBe("2026-10-28");
});

test("Histórico React exige motivo para Não recebido antes de gravar", async ({ page }) => {
  const state = await setup(page);
  await openAgenda(page);
  await page.getByRole("combobox", { name: "Status de Transporte Beta" }).selectOption("nao_chegou");
  const dialog = page.getByRole("dialog", { name: "Motivo de não recebimento de Transporte Beta" });
  await expect(dialog).toBeVisible();
  expect(state.requests.filter(r => r.method === "PATCH")).toHaveLength(0);
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Selecione um motivo");
  expect(state.requests.filter(r => r.method === "PATCH")).toHaveLength(0);
  await dialog.getByRole("combobox", { name: "Motivo (obrigatório)" }).selectOption("Não veio");
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Status de Transporte Beta" })).toHaveValue("nao_chegou");
  const patch = state.requests.find(r => r.method === "PATCH" && r.path.endsWith("/status"));
  expect(patch.body.status).toBe("nao_chegou");
  expect(patch.body.observation).toBe("Não veio");
});

test("Histórico React permite cancelar motivo sem gravar e mantém status anterior", async ({ page }) => {
  const state = await setup(page);
  await openAgenda(page);
  await page.getByRole("combobox", { name: "Status de Transporte Beta" }).selectOption("nao_chegou");
  const dialog = page.getByRole("dialog", { name: "Motivo de não recebimento de Transporte Beta" });
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Status de Transporte Beta" })).toHaveValue("aguardando");
  expect(state.requests.filter(r => r.method === "PATCH")).toHaveLength(0);
});

test("Histórico React altera status direto e marcação de trocas", async ({ page }) => {
  const state = await setup(page);
  await openAgenda(page);
  await page.getByRole("combobox", { name: "Status de Transporte Beta" }).selectOption("recebido");
  await expect(page.getByRole("combobox", { name: "Status de Transporte Beta" })).toHaveValue("recebido");
  await page.getByRole("checkbox", { name: "Trocas de Transporte Beta" }).uncheck();
  await expect(page.getByRole("checkbox", { name: "Trocas de Transporte Beta" })).not.toBeChecked();
  const statusPatch = state.requests.find(r => r.method === "PATCH" && r.path.endsWith("/status"));
  expect(statusPatch.body).toEqual({ status: "recebido", observation: null });
  const exchangesPatch = state.requests.find(r => r.method === "PATCH" && r.path.endsWith("/exchanges"));
  expect(exchangesPatch.body).toEqual({ hasExchanges: false });
});

test("Histórico React reabre dia concluído e consulta histórico de status", async ({ page }) => {
  const state = await setup(page);
  await openAgenda(page);
  await page.getByRole("button", { name: "Ver histórico de Transporte Beta" }).click();
  await expect(page.getByRole("region", { name: "Histórico de status" })).toContainText("Aguardando → Recebido");
  await expect(page.getByRole("region", { name: "Histórico de status" })).toContainText(admin.nome);
  await page.getByRole("button", { name: "Reabrir para conferente" }).click();
  const detail = page.getByRole("region", { name: "Detalhe da agenda" });
  await expect(detail).toContainText("Em aberto");
  await expect(page.getByRole("button", { name: "Reabrir para conferente" })).toHaveCount(0);
  const reopen = state.requests.find(r => r.method === "PATCH" && r.path === `/api/admin/agendas/${uuid(10)}/status`);
  expect(reopen.body).toEqual({ status: "aberto" });
});

test("Histórico React mostra conflito 409 sem alterar status", async ({ page }) => {
  const state = await setup(page, { conflict: true });
  await openAgenda(page);
  await page.getByRole("combobox", { name: "Status de Transporte Beta" }).selectOption("recebido");
  await expect(page.getByRole("alert").filter({ hasText: "A agenda mudou desde a consulta" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Status de Transporte Beta" })).toHaveValue("aguardando");
});

test("Histórico React recupera falha de listagem com tentativa novamente", async ({ page }) => {
  const state = await setup(page, { listError: true });
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Não foi possível consultar as agendas." })).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("table", { name: "Agendas do histórico" }).locator("tbody tr")).toHaveCount(2);
});

test("Histórico React bloqueia visualizador", async ({ page }) => {
  await setup(page, { role: "visualizador" });
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Histórico" })).toHaveCount(0);
});

test("Histórico React usa cartões no celular sem rolagem horizontal do documento", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page);
  await expect(page.getByRole("heading", { name: "Histórico", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Loja" }).selectOption("F01");
  await page.getByLabel("Data").fill("2026-10-28");
  await page.getByRole("button", { name: "Filtrar" }).click();
  const cards = page.getByLabel("Agendas no celular");
  await expect(cards.locator("article")).toHaveCount(1);
  await expect(page.getByRole("table", { name: "Agendas do histórico" })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  await cards.getByRole("button", { name: "Abrir agenda" }).click();
  const appointmentCards = page.getByLabel("Agendamentos no celular");
  await expect(appointmentCards.locator("article")).toHaveCount(2);
  await expect(page.getByRole("table", { name: "Agendamentos da agenda" })).toHaveCount(0);
  const detailOverflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(detailOverflow).toBeLessThanOrEqual(2);
  await page.getByRole("combobox", { name: "Status de Transporte Beta" }).selectOption("nao_chegou");
  await expect(page.getByRole("dialog", { name: "Motivo de não recebimento de Transporte Beta" })).toBeVisible();
});
