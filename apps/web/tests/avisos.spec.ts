import { test, expect } from "@playwright/test";

const admin = { id: "admin-sintetico", nome: "Administrador Teste", papel: "admin" };
const conf = { id: "c1", nome: "Conferente Doca", papel: "conferente", lojaId: "s1", lojaCodigo: "F03", lojaNome: "Loja Central" };

function buildAvisos() {
  return {
    avisos: [
      { id: "av1", tipo: "aviso", titulo: "Doca 3 fechada", mensagem: "A doca 3 fica fechada nesta semana.", criadoEm: "2026-11-11T10:00:00.000Z", expiraEm: null, lido: false },
      { id: "av2", tipo: "evento", titulo: "Dia concluído", mensagem: "Dia de conferência concluído: Loja Central em 11/11/2026.", criadoEm: "2026-11-11T11:00:00.000Z", expiraEm: "2026-11-13T02:59:59.000Z", lido: false },
    ],
    naoLidos: 2,
  };
}

async function setup(page, { role = "admin" } = {}) {
  const user = role === "admin" ? admin : conf;
  const state = { data: buildAvisos(), nextId: 0 };
  const requests = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    const body = method === "GET" ? null : route.request().postDataJSON();
    requests.push({ path, method, body });
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/realtime/config") return route.fulfill({ json: { mode: "off", protocolVersion: 1 } });
    if (path === "/api/avisos" && method === "GET") return route.fulfill({ json: state.data });
    if (/^\/api\/avisos\/([^/]+)\/lido$/.test(path) && method === "POST") {
      const id = path.split("/")[3]!;
      state.data = {
        avisos: state.data.avisos.map(a => (a.id === id ? { ...a, lido: true } : a)),
        naoLidos: Math.max(0, state.data.naoLidos - 1),
      };
      return route.fulfill({ json: { jaLido: false } });
    }
    if (path === "/api/admin/avisos" && method === "POST") {
      const created = {
        id: "av-new-" + ++state.nextId, tipo: "aviso", titulo: body.titulo, mensagem: body.mensagem,
        criadoEm: "2026-11-11T12:00:00.000Z", expiraEm: body.expiraEm ?? null, lido: false,
      };
      state.data = { avisos: [created, ...state.data.avisos], naoLidos: state.data.naoLidos + 1 };
      return route.fulfill({ status: 201, json: created });
    }
    if (/^\/api\/admin\/avisos\/([^/]+)\/inativar$/.test(path) && method === "POST") {
      const id = path.split("/")[4]!;
      const alvo = state.data.avisos.find(a => a.id === id);
      state.data = {
        avisos: state.data.avisos.filter(a => a.id !== id),
        naoLidos: Math.max(0, state.data.naoLidos - (alvo && !alvo.lido ? 1 : 0)),
      };
      return route.fulfill({ json: { ok: true } });
    }
    // Mocks mínimos das páginas hospedeiras do sino.
    if (role === "admin") {
      if (path === "/api/admin/presence") return route.fulfill({ json: [] });
      if (path === "/api/admin/stores") return route.fulfill({ json: [] });
      if (path === "/api/admin/users" && method === "GET") return route.fulfill({ json: [] });
      if (path === "/api/admin/agendas") return route.fulfill({ json: [] });
      if (path === "/api/admin/audit") return route.fulfill({ json: [] });
    } else {
      if (path.startsWith("/api/store/tags/agenda/")) return route.fulfill({ json: { tags: [], assignments: {} } });
      if (path === "/api/store/today" || path.startsWith("/api/store/history/")) return route.fulfill({ json: { agenda: null, appointments: [] } });
      if (path === "/api/store/presence") {
        if (method === "DELETE") return route.fulfill({ status: 204, body: "" });
        return route.fulfill({ json: { ok: true, recordedAt: "2026-11-11T09:00:00.000Z" } });
      }
    }
    throw Error("Endpoint inesperado no teste de avisos: " + method + " " + path);
  });
  await page.goto(role === "admin" ? "/admin/users" : "/app");
  return requests;
}

test("Conferente vê o badge de não lidos e marca aviso como lido", async ({ page }) => {
  const requests = await setup(page, { role: "conferente" });
  const bell = page.getByRole("button", { name: "Avisos, 2 não lidos" });
  await expect(bell).toBeVisible();
  await expect(page.getByTestId("avisos-badge")).toHaveText("2");
  await bell.click();
  await expect(page.getByTestId("avisos-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doca 3 fechada" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dia concluído" })).toBeVisible();
  // Conferente só lê e marca como lido: sem ações administrativas.
  await expect(page.getByRole("button", { name: "Novo aviso" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Inativar aviso: Doca 3 fechada" })).toHaveCount(0);
  await page.getByRole("button", { name: "Marcar aviso como lido: Doca 3 fechada" }).click();
  // Atualização otimista: o badge cai antes da resposta da API.
  await expect(page.getByTestId("avisos-badge")).toHaveText("1");
  await expect(page.getByRole("button", { name: "Marcar aviso como lido: Doca 3 fechada" })).toHaveCount(0);
  expect(requests.filter(x => x.path === "/api/avisos/av1/lido" && x.method === "POST")).toHaveLength(1);
});

test("Admin publica aviso com expiração e ele aparece no painel", async ({ page }) => {
  const requests = await setup(page, { role: "admin" });
  await page.getByRole("button", { name: "Avisos, 2 não lidos" }).click();
  await page.getByRole("button", { name: "Novo aviso" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo aviso" });
  await dialog.getByLabel("Título do aviso").fill("Mudança de horário");
  await dialog.getByLabel("Mensagem do aviso").fill("O expediente termina às 16h nesta sexta.");
  await dialog.getByLabel("Data de expiração do aviso").fill("2026-11-13");
  await dialog.getByRole("button", { name: "Publicar aviso" }).click();
  // O diálogo fecha e o aviso novo entra no topo com o badge atualizado.
  await expect(page.getByRole("heading", { name: "Mudança de horário" })).toBeVisible();
  await expect(page.getByTestId("avisos-badge")).toHaveText("3");
  const publish = requests.find(x => x.path === "/api/admin/avisos" && x.method === "POST");
  expect(publish?.body).toEqual({
    titulo: "Mudança de horário",
    mensagem: "O expediente termina às 16h nesta sexta.",
    // Fim do dia de Brasília (23h59 UTC-3), sem dependência do fuso da máquina.
    expiraEm: "2026-11-14T02:59:59.000Z",
  });
});

test("Admin inativa aviso e ele sai da lista", async ({ page }) => {
  const requests = await setup(page, { role: "admin" });
  await page.getByRole("button", { name: "Avisos, 2 não lidos" }).click();
  await page.getByRole("button", { name: "Inativar aviso: Doca 3 fechada" }).click();
  await expect(page.getByRole("heading", { name: "Doca 3 fechada" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Dia concluído" })).toBeVisible();
  await expect(page.getByTestId("avisos-badge")).toHaveText("1");
  expect(requests.filter(x => x.path === "/api/admin/avisos/av1/inativar" && x.method === "POST")).toHaveLength(1);
});
