import { test, expect } from "@playwright/test";

const admin = { id: "admin-sintetico", nome: "Administrador Teste", papel: "admin" };
const conf = { id: "c1", nome: "Conferente Doca", papel: "conferente", lojaId: "s1", lojaCodigo: "F03", lojaNome: "Loja Central" };
const stores = [
  { id: "s1", codigo: "F03", nome: "Loja Central", ativo: true },
  { id: "s2", codigo: "F07", nome: "Loja Norte", ativo: true },
];

function buildAvisos() {
  return {
    // O servidor já entrega só o que o papel enxerga (avisos da loja e globais),
    // em ordem de mais recente para o mais antigo — lista única, sem histórico.
    avisos: [
      { id: "av1", tipo: "aviso", titulo: "Doca 3 fechada", mensagem: "A doca 3 fica fechada nesta semana.", criadoEm: "2026-11-11T10:00:00.000Z", lido: false, urgente: true, autor: "Administrador Teste", lojas: null },
      { id: "av2", tipo: "evento", titulo: "Dia concluído", mensagem: "Dia de conferência concluído: Loja Central em 11/11/2026.", criadoEm: "2026-11-11T09:00:00.000Z", lido: true, urgente: false, autor: "Sistema", lojas: null },
    ],
    naoLidos: 1,
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
    if (path === "/api/avisos/marcar-todos" && method === "POST") {
      const naoLidos = state.data.naoLidos;
      state.data = {
        avisos: state.data.avisos.map(a => ({ ...a, lido: true })),
        naoLidos: 0,
      };
      return route.fulfill({ json: { ok: true, marcados: naoLidos } });
    }
    if (path === "/api/admin/avisos" && method === "POST") {
      const created = {
        id: "av-new-" + ++state.nextId, tipo: "aviso", titulo: body.titulo, mensagem: body.mensagem,
        criadoEm: "2026-11-11T12:00:00.000Z", lido: false, urgente: body.urgente ?? false,
        autor: "Administrador Teste", lojas: body.lojas ?? null,
      };
      state.data = { avisos: [created, ...state.data.avisos], naoLidos: state.data.naoLidos + 1 };
      return route.fulfill({ status: 201, json: created });
    }
    // Mocks mínimos das páginas hospedeiras do sino.
    if (role === "admin") {
      if (path === "/api/admin/presence") return route.fulfill({ json: [] });
      if (path === "/api/admin/stores") return route.fulfill({ json: stores });
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

test("Conferente vê o badge, marca aviso como lido e usa Marcar todos", async ({ page }) => {
  const requests = await setup(page, { role: "conferente" });
  const bell = page.getByRole("button", { name: "Avisos, 1 não lidos" });
  await expect(bell).toBeVisible();
  await expect(page.getByTestId("avisos-badge")).toHaveText("1");
  await bell.click();
  await expect(page.getByTestId("avisos-panel")).toBeVisible();
  // Lista única, do mais recente para o mais antigo; urgente com destaque.
  const urgente = page.getByRole("article", { name: "Doca 3 fechada" });
  await expect(urgente).toBeVisible();
  await expect(urgente.getByText("Urgente")).toBeVisible();
  await expect(urgente.getByText(/por Administrador Teste/)).toBeVisible();
  await expect(urgente.getByText("Todas as lojas")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dia concluído" })).toBeVisible();
  // Conferente só lê e marca como lido: sem ações administrativas e sem
  // exclusão de aviso (registro permanente).
  await expect(page.getByRole("button", { name: "Novo aviso" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Inativar aviso/ })).toHaveCount(0);
  // Marca um aviso: atualização otimista derruba o badge antes da resposta.
  await page.getByRole("button", { name: "Marcar aviso como lido: Doca 3 fechada" }).click();
  await expect(page.getByTestId("avisos-badge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Marcar aviso como lido: Doca 3 fechada" })).toHaveCount(0);
  expect(requests.filter(x => x.path === "/api/avisos/av1/lido" && x.method === "POST")).toHaveLength(1);
});

test("Conferente zera o badge com Marcar todos", async ({ page }) => {
  const requests = await setup(page, { role: "conferente" });
  await page.getByRole("button", { name: "Avisos, 1 não lidos" }).click();
  await page.getByRole("button", { name: "Marcar todos os avisos como lidos" }).click();
  await expect(page.getByTestId("avisos-badge")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Marcar aviso como lido: Doca 3 fechada" })).toHaveCount(0);
  expect(requests.filter(x => x.path === "/api/avisos/marcar-todos" && x.method === "POST")).toHaveLength(1);
});

test("Admin publica aviso urgente direcionado e ele aparece no painel", async ({ page }) => {
  const requests = await setup(page, { role: "admin" });
  await page.getByRole("button", { name: "Avisos, 1 não lidos" }).click();
  // Zera os pendentes para o badge vermelho do urgente novo ser inequívoco.
  await page.getByRole("button", { name: "Marcar todos os avisos como lidos" }).click();
  await expect(page.getByTestId("avisos-badge")).toHaveCount(0);
  await page.getByRole("button", { name: "Novo aviso" }).click();
  const dialog = page.getByRole("dialog", { name: "Novo aviso" });
  await dialog.getByLabel("Título do aviso").fill("Inventário loja Central");
  await dialog.getByLabel("Mensagem do aviso").fill("Inventário geral amanhã às 7h; recebimentos a partir das 9h.");
  // Sem expiração: o aviso é registro permanente.
  await expect(dialog.getByLabel(/expira/i)).toHaveCount(0);
  await dialog.getByLabel("Aviso urgente").check();
  await dialog.getByRole("button", { name: "Escolher lojas" }).click();
  await dialog.getByRole("button", { name: "F03", exact: true }).click();
  await dialog.getByRole("button", { name: "Publicar aviso" }).click();
  await expect(dialog).not.toBeVisible();
  const publicado = page.getByRole("article", { name: "Inventário loja Central" });
  await expect(publicado).toBeVisible();
  await expect(publicado.getByText("Urgente")).toBeVisible();
  await expect(publicado.getByText("Loja F03")).toBeVisible();
  await expect(publicado.getByText(/por Administrador Teste/)).toBeVisible();
  // Badge pulsa em vermelho enquanto houver urgente não lido.
  await expect(page.getByTestId("avisos-badge")).toHaveClass(/bg-red-500/);
  const publish = requests.find(x => x.path === "/api/admin/avisos" && x.method === "POST");
  expect(publish?.body).toEqual({ titulo: "Inventário loja Central", mensagem: "Inventário geral amanhã às 7h; recebimentos a partir das 9h.", urgente: true, lojas: ["F03"] });
  // Registro permanente: ninguém inativa aviso.
  await expect(page.getByRole("button", { name: /Inativar aviso/ })).toHaveCount(0);
});
