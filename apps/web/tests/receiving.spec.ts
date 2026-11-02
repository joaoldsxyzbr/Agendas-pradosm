
import { test, expect } from "@playwright/test";

const admin = { id: "adm", nome: "ADM de teste", papel: "admin" };
const viewer = { id: "viewer", nome: "Visualizador de teste", papel: "visualizador" };
const stores = Array.from({ length: 8 }, (_, i) => ({
  id: "s" + i, codigo: "F" + String(i + 1).padStart(2, "0"),
  nome: "Loja " + (i + 1), ativo: true, temConferenteAtivo: true,
}));
const agendas = stores.slice(0, 7).map((store, index) => ({
  id: "agenda" + index, storeCode: store.codigo, storeName: store.nome,
  date: "2026-10-30", dayStatus: index === 0 ? "concluido" : "aberto",
  total: 20, recebido: index === 0 ? 20 : index + 2,
  aguardando: index === 0 ? 0 : 18 - index,
  naoChegou: 0, recusado: 0, semAgenda: 0,
}));
const detail = {
  agenda: { id: "agenda1", storeCode: "F02", storeName: "Loja 2", date: "2026-10-30", dayStatus: "aberto" },
  appointments: [
    { id: "a1", supplier: "Fornecedor Azul", protocol: "P001", startTime: "08:00", endTime: "09:00", status: "recebido" },
    { id: "a2", supplier: "Fornecedor Verde", protocol: "P002", startTime: "09:00", endTime: "10:00", status: "aguardando" },
  ],
};
async function mock(page, role = "admin", options = {}) {
  const requests = [];
  let failAgenda = false;
  let agendasNow = structuredClone(agendas);
  let detailsNow = structuredClone(detail);
  let completedAgenda0 = true;
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    requests.push({ path, method: route.request().method(), date: url.searchParams.get("date") });
    const json = data => route.fulfill({ json: data });
    if (path === "/api/auth/me") return json(role === "admin" ? admin : viewer);
    if (path === "/api/realtime/config") return json({ mode: options.realtime ?? "off", protocolVersion: 1 });
    if (path === "/api/admin/stores") return json(stores);
    if (path === "/api/admin/presence") return json([{ storeId: "s1", status: "online" }]);
    if (path === "/api/admin/agendas") {
      if (failAgenda) return route.fulfill({ status: 500, json: { error: "FALHOU" } });
      return json(url.searchParams.get("date") === "2026-10-30" ? agendasNow : []);
    }
    if ((path === "/api/admin/agendas/agenda1/status" || path === "/api/admin/agendas/agenda0/status") && route.request().method() === "PATCH") {
      if (options.reopenConflict) return route.fulfill({ status: 409, json: { error: "CONFLITO_ESTADO", message: "Este registro mudou. Atualize a tela e tente novamente." } });
      const body = route.request().postDataJSON();
      if (body.status !== "aberto") throw Error("Status de reabertura inesperado");
      const id = path.includes("agenda0") ? "agenda0" : "agenda1";
      if (id === "agenda0") completedAgenda0 = false;
      else detailsNow.agenda.dayStatus = "aberto";
      agendasNow = agendasNow.map(x => x.id === id ? { ...x, dayStatus: "aberto" } : x);
      return json({ ...detailsNow.agenda, id, dayStatus: "aberto" });
    }
    if (path === "/api/admin/agendas/agenda1/manual" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (!body.supplier?.trim()) return route.fulfill({ status: 400, json: { error: "REQUISICAO_INVALIDA", message: "Informe o fornecedor." } });
      const saved = { id: "manual3", supplier: body.supplier, protocol: "Sem agenda", startTime: "", endTime: "", status: "aguardando", origin: "manual" };
      detailsNow.appointments = [...detailsNow.appointments, saved];
      return route.fulfill({ status: 201, json: saved });
    }
    if (path === "/api/admin/appointments/manual3/manual") {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        detailsNow.appointments = detailsNow.appointments.map(x => x.id === "manual3" ? { ...x, supplier: body.supplier } : x);
        return json(detailsNow.appointments.find(x => x.id === "manual3"));
      }
      if (route.request().method() === "DELETE") {
        detailsNow.appointments = detailsNow.appointments.filter(x => x.id !== "manual3");
        return route.fulfill({ status: 204 });
      }
    }

    const appointmentMatch = /^\/api\/admin\/appointments\/([^/]+)\/(status|exchanges|observation)$/.exec(path);
    if (appointmentMatch && route.request().method() === "PATCH") {
      if (options.appointmentConflict) return route.fulfill({
        status: 409, json: { error: "CONFLITO_ESTADO", message: "Este registro mudou. Atualize a tela e tente novamente." },
      });
      const [, id, action] = appointmentMatch;
      const payload = route.request().postDataJSON();
      if (action === "status" && payload.status === "nao_chegou" && !payload.observation) {
        return route.fulfill({ status: 400, json: { error: "MOTIVO_INVALIDO", message: "Motivo obrigatório." } });
      }
      detailsNow.appointments = detailsNow.appointments.map(item => item.id !== id ? item : {
        ...item,
        ...(action === "status" ? { status: payload.status, observation: payload.observation } : {}),
        ...(action === "exchanges" ? { hasExchanges: payload.hasExchanges } : {}),
        ...(action === "observation" ? { observation: payload.observation } : {}),
      });
      return json(detailsNow.appointments.find(item => item.id === id));
    }
    if (path === "/api/admin/agendas/agenda1") return json(detailsNow);
    if (path === "/api/admin/agendas/agenda0") return json({
      agenda: { ...detailsNow.agenda, id: "agenda0", storeCode: "F01", storeName: "Loja 1", dayStatus: completedAgenda0 ? "concluido" : "aberto" },
      appointments: detailsNow.appointments,
    });
    throw Error("API inesperada: " + path);
  });
  return { requests, setFailAgenda: value => { failAgenda = value; }, setAgendas: value => { agendasNow = value; } };
}

test("Recebimento React mantém cinco indicadores, seis colunas e estados", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await mock(page);
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await expect(page.getByRole("table", { name: "Recebimento por loja" })).toBeVisible();
  const table = page.getByRole("table", { name: "Recebimento por loja" });
  await expect(table.locator("thead th")).toHaveCount(6);
  await expect(table.locator("tbody tr")).toHaveCount(8);
  await expect(table.getByText("Concluído", { exact: true })).toHaveCount(1);
  await expect(table.getByText("Sem agenda", { exact: true })).toHaveCount(2);
  await expect(table.getByText("Online", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Situação do dia").locator("strong")).toHaveCount(5);
  await expect(page.getByLabel("Situação do dia").locator("strong")).toHaveText(["8","7","6","1","1"]);
  const size = await page.evaluate(() => {
    const summary = document.querySelector('[aria-label="Situação do dia"]').getBoundingClientRect();
    const row = document.querySelector("tbody tr").getBoundingClientRect();
    return { summary: summary.height, row: row.height, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(size.summary).toBeLessThanOrEqual(90);
  expect(size.row).toBeLessThanOrEqual(78);
  expect(size.overflow).toBeLessThanOrEqual(2);
});

test("Recebimento React atualiza a data e permite voltar ao dia selecionado", async ({ page }) => {
  const spy = await mock(page);
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await expect(page.getByRole("table", { name: "Recebimento por loja" }).locator("tbody tr")).toHaveCount(8);
  await page.getByRole("button", { name: "Dia anterior" }).click();
  await expect(page.getByLabel("Data da agenda")).toHaveValue("2026-10-29");
  await expect(page.getByLabel("Situação do dia").locator("strong")).toHaveText(["8","0","0","0","8"]);
  await page.getByRole("button", { name: "Dia seguinte" }).click();
  await expect(page.getByLabel("Data da agenda")).toHaveValue("2026-10-30");
  await expect(page.getByLabel("Situação do dia").locator("strong")).toHaveText(["8","7","6","1","1"]);
  expect(spy.requests.some(x => x.path === "/api/admin/agendas" && x.date === "2026-10-29")).toBe(true);
});

test("Recebimento React abre consulta real de agendamentos, pesquisa e fecha com Escape", async ({ page }) => {
  await mock(page);
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await expect(page.getByTestId("receiving-store-F02")).toBeVisible();
  await page.getByTestId("receiving-store-F02").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F02/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Fornecedor Azul")).toBeVisible();
  await expect(dialog.getByText("Fornecedor Verde")).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Pesquisar fornecedor ou protocolo" }).fill("P002");
  await expect(dialog.getByText("Fornecedor Azul")).toHaveCount(0);
  await expect(dialog.getByText("Fornecedor Verde")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Recebimento React aplica permissões e impede importação não migrada", async ({ page }) => {
  await mock(page, "visualizador");
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await expect(page.getByRole("button", { name: /Importar agenda/ })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Recebimento por loja" }).locator("tbody tr")).toHaveCount(8);
  await page.getByTestId("receiving-store-F02").getByRole("button", { name: "Ver detalhes" }).click();
  await expect(page.getByRole("dialog", { name: /Agenda F02/ })).toBeVisible();
  await expect(page.getByText("Somente consulta nesta etapa")).toBeVisible();
});
test("Admin React abre importação sem contornar prévia obrigatória", async ({ page }) => {
  await mock(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Importar agenda" }).click();
  await expect(page).toHaveURL(new RegExp("/admin/import$"));
  await expect(page.getByRole("button", { name: "Confirmar importação" })).toHaveCount(0);
});

test("Recebimento React mostra erro de API e permite tentar novamente", async ({ page }) => {
  const spy = await mock(page);
  spy.setFailAgenda(true);
  await page.goto("/admin");
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar o Recebimento.");
  spy.setFailAgenda(false);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await expect(page.getByRole("table", { name: "Recebimento por loja" }).locator("tbody tr")).toHaveCount(8);
});

test("Recebimento React mantém rolagem somente na tabela em tela móvel", async ({ page }) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  const behavior = await page.evaluate(() => {
    const table = document.querySelector('[data-testid="receiving-table-scroll"]');
    const menu = document.querySelector('[data-testid="mobile-navigation"]');
    const tableScrollable = table.scrollWidth - table.clientWidth;
    const menuScrollable = menu.scrollWidth - menu.clientWidth;
    table.scrollLeft = 120;
    menu.scrollLeft = 120;
    return {
      tableScrollable,
      menuScrollable,
      tablePosition: table.scrollLeft,
      menuPosition: menu.scrollLeft,
      viewportWidth: document.documentElement.clientWidth,
      documentOverflow: getComputedStyle(document.documentElement).overflowX,
    };
  });
  expect(behavior.tableScrollable).toBeGreaterThan(100);
  expect(behavior.menuScrollable).toBeGreaterThan(100);
  expect(behavior.tablePosition).toBeGreaterThan(0);
  expect(behavior.menuPosition).toBeGreaterThan(0);
  expect(behavior.viewportWidth).toBe(390);
  expect(behavior.documentOverflow).toBe("clip");

  // Simula movimento horizontal real fora dos scrollers; window.scrollTo()
  // nao serve para testar isso, porque pode deslocar programaticamente
  // mesmo quando o viewport tem overflow-x: clip.
  await page.mouse.move(150, 20);
  await page.mouse.wheel(600, 0);
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

test("Recebimento React atualiza presença e agenda por eventos WebSocket validados", async ({ page }) => {
  await page.addInitScript(() => {
    window.WebSocket = class FakeRealtimeSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      readyState = 0;
      constructor() {
        window.__fakeRealtimeSocket = this;
        setTimeout(() => {
          this.readyState = 1;
          this.onopen?.();
          this.onmessage?.({ data: JSON.stringify({ version: 1, type: "realtime.ready" }) });
        }, 0);
      }
      send() {}
      close(code = 1000) {
        this.readyState = 3;
        this.onclose?.({ code });
      }
    };
    window.__emitRealtime = event => window.__fakeRealtimeSocket?.onmessage?.({ data: JSON.stringify(event) });
  });
  const controls = await mock(page, "admin", { realtime: "on" });
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await expect(page.getByText("Tempo real conectado")).toBeVisible();
  await expect(page.getByTestId("receiving-store-F03").getByText("Offline")).toBeVisible();

  await page.evaluate(() => window.__emitRealtime({ version: 1, type: "presence.changed", storeId: "s2", status: "online" }));
  await expect(page.getByTestId("receiving-store-F03").getByText("Online")).toBeVisible();
  // Eventos incompletos não devem substituir dados válidos.
  await page.evaluate(() => window.__emitRealtime({ version: 1, type: "presence.changed", status: "offline" }));
  await expect(page.getByTestId("receiving-store-F03").getByText("Online")).toBeVisible();

  const changed = agendas.map((agenda, i) => i === 1
    ? { ...agenda, dayStatus: "concluido", recebido: 20, aguardando: 0 }
    : agenda);
  controls.setAgendas(changed);
  await page.evaluate(() => window.__emitRealtime({
    version: 1, type: "agenda.changed", agendaId: "agenda1",
    storeId: "s1", date: "2026-10-30", reason: "status",
  }));
  await expect(page.getByLabel("Situação do dia").locator("strong")).toHaveText(["8", "7", "5", "2", "1"]);
  await expect(page.getByTestId("receiving-store-F02").getByText("Concluído")).toBeVisible();
});

test("Recebimento React mantém polling se o realtime estiver desativado", async ({ page }) => {
  await mock(page);
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await expect(page.getByRole("table", { name: "Recebimento por loja" }).locator("tbody tr")).toHaveCount(8);
  await expect(page.getByText("Tempo real conectado")).toHaveCount(0);
});

test("Admin React: edição permite cadastrar, renomear e excluir fornecedor manual com confirmação", async ({ page }) => {
  const spy = await mock(page);
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await page.getByTestId("receiving-store-F02").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F02/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Editar agenda" }).click();
  await dialog.getByRole("button", { name: "Fornecedor sem agenda" }).click();
  await dialog.getByLabel("Nome do fornecedor").fill("Fornecedor Manual Teste");
  await dialog.getByRole("button", { name: "Adicionar fornecedor" }).click();
  await expect(dialog.getByText("Fornecedor Manual Teste")).toBeVisible();
  await dialog.getByRole("button", { name: "Renomear Fornecedor Manual Teste" }).click();
  await dialog.getByLabel("Nome do fornecedor").fill("Fornecedor Editado");
  await dialog.getByRole("button", { name: "Salvar fornecedor" }).click();
  await expect(dialog.getByText("Fornecedor Editado")).toBeVisible();
  await dialog.getByRole("button", { name: "Excluir Fornecedor Editado" }).click();
  await expect(dialog.getByText("Excluir Fornecedor Editado desta agenda?")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(dialog.getByText("Fornecedor Editado")).toHaveCount(0);
  expect(spy.requests.filter(x => x.path.endsWith("/manual") && ["POST", "PATCH", "DELETE"].includes(x.method)).map(x => x.method)).toEqual(["POST", "PATCH", "DELETE"]);
});

test("Admin React: reabertura exige confirmação e atualiza a agenda", async ({ page }) => {
  const spy = await mock(page);
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await page.getByTestId("receiving-store-F01").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F01/ });
  await dialog.getByRole("button", { name: "Editar agenda" }).click();
  await dialog.getByRole("button", { name: "Reabrir para conferente" }).click();
  await expect(dialog.getByText("Reabrir esta agenda permitirá")).toBeVisible();
  expect(spy.requests.some(x => x.path.endsWith("/status") && x.method === "PATCH")).toBe(false);
  await dialog.getByRole("button", { name: "Confirmar reabertura" }).click();
  await expect(dialog.getByRole("button", { name: "Reabrir para conferente" })).toHaveCount(0);
  expect(spy.requests.some(x => x.path === "/api/admin/agendas/agenda0/status" && x.method === "PATCH")).toBe(true);
});

test("Admin React: conflito de reabertura preserva o aviso e não informa sucesso", async ({ page }) => {
  await mock(page, "admin", { reopenConflict: true });
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await page.getByTestId("receiving-store-F01").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F01/ });
  await dialog.getByRole("button", { name: "Editar agenda" }).click();
  await dialog.getByRole("button", { name: "Reabrir para conferente" }).click();
  await dialog.getByRole("button", { name: "Confirmar reabertura" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Este registro mudou");
  await expect(dialog.getByRole("button", { name: "Confirmar reabertura" })).toBeVisible();
});

test("Visualizador React não vê edição, reabertura ou mutações administrativas", async ({ page }) => {
  const spy = await mock(page, "visualizador");
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await page.getByTestId("receiving-store-F01").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F01/ });
  await expect(dialog.getByRole("button", { name: "Editar agenda" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Reabrir para conferente" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Fornecedor sem agenda" })).toHaveCount(0);
  expect(spy.requests.filter(x => !["GET"].includes(x.method))).toEqual([]);
});

test("Admin React altera status e exige motivo antes de Não recebido", async ({ page }) => {
  const spy = await mock(page);
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await page.getByTestId("receiving-store-F02").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F02/ });
  await dialog.getByRole("button", { name: "Editar agenda" }).click();
  const group = dialog.getByRole("group", { name: "Alterar status de Fornecedor Verde" });
  await group.getByRole("button", { name: "Não recebido" }).click();
  await expect(dialog.getByText("Motivo de não recebimento")).toBeVisible();
  expect(spy.requests.some(x => x.path.endsWith("/a2/status"))).toBe(false);
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Selecione um motivo");
  await dialog.getByRole("combobox", { name: "Motivo de Fornecedor Verde" }).selectOption("Sem pedido");
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(group.getByRole("button", { name: "Desmarcar não recebido" })).toBeVisible();
  await expect(dialog.getByText("Sem pedido")).toBeVisible();
  await group.getByRole("button", { name: "Desmarcar não recebido" }).click();
  await expect(group.getByRole("button", { name: "Não recebido" })).toBeVisible();
  expect(spy.requests.filter(x => x.path.endsWith("/a2/status") && x.method === "PATCH")).toHaveLength(2);
});

test("Admin React atualiza trocas e observa motivo personalizado", async ({ page }) => {
  const spy = await mock(page);
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await page.getByTestId("receiving-store-F02").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F02/ });
  await dialog.getByRole("button", { name: "Editar agenda" }).click();
  const toggle = dialog.getByRole("checkbox", { name: "Trocas de Fornecedor Verde" });
  await toggle.click();
  await expect(toggle).toBeChecked();
  await dialog.getByRole("button", { name: "Observação de Fornecedor Verde" }).click();
  await dialog.getByRole("combobox", { name: "Motivo de Fornecedor Verde" }).selectOption("Outros");
  await dialog.getByRole("textbox", { name: "Descreva o motivo" }).fill("Entrega parcial");
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(dialog.getByText("Outros: Entrega parcial")).toBeVisible();
  expect(spy.requests.some(x => x.path.endsWith("/a2/exchanges") && x.method === "PATCH")).toBe(true);
  expect(spy.requests.some(x => x.path.endsWith("/a2/observation") && x.method === "PATCH")).toBe(true);
});

test("Admin React mantém dados e exibe conflito no status sem confirmar ação", async ({ page }) => {
  await mock(page, "admin", { appointmentConflict: true });
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await page.getByTestId("receiving-store-F02").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F02/ });
  await dialog.getByRole("button", { name: "Editar agenda" }).click();
  await dialog.getByRole("group", { name: "Alterar status de Fornecedor Verde" })
    .getByRole("button", { name: "Recebido", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Este registro mudou");
  await expect(dialog.getByRole("group", { name: "Alterar status de Fornecedor Verde" })
    .getByRole("button", { name: "Recebido", exact: true })).toBeVisible();
});

test("Visualizador React não consegue alterar status, observações ou trocas", async ({ page }) => {
  const spy = await mock(page, "visualizador");
  await page.goto("/admin");
  await page.getByLabel("Data da agenda").fill("2026-10-30");
  await page.getByTestId("receiving-store-F02").getByRole("button", { name: "Ver detalhes" }).click();
  const dialog = page.getByRole("dialog", { name: /Agenda F02/ });
  await expect(dialog.getByRole("group", { name: "Alterar status de Fornecedor Verde" })).toHaveCount(0);
  await expect(dialog.getByRole("checkbox", { name: "Trocas de Fornecedor Verde" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Observação de Fornecedor Verde" })).toHaveCount(0);
  expect(spy.requests.filter(x => x.method !== "GET")).toEqual([]);
});
