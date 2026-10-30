
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
  let agendasNow = agendas;
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    requests.push({ path, date: url.searchParams.get("date") });
    const json = data => route.fulfill({ json: data });
    if (path === "/api/auth/me") return json(role === "admin" ? admin : viewer);
    if (path === "/api/realtime/config") return json({ mode: options.realtime ?? "off", protocolVersion: 1 });
    if (path === "/api/admin/stores") return json(stores);
    if (path === "/api/admin/presence") return json([{ storeId: "s1", status: "online" }]);
    if (path === "/api/admin/agendas") {
      if (failAgenda) return route.fulfill({ status: 500, json: { error: "FALHOU" } });
      return json(url.searchParams.get("date") === "2026-10-30" ? agendasNow : []);
    }
    if (path === "/api/admin/agendas/agenda1") return json(detail);
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
test("Recebimento React desativa importação até migrar e não simula sucesso", async ({ page }) => {
  await mock(page);
  await page.goto("/admin");
  await expect(page.getByRole("button", { name: "Importar agenda indisponível durante a migração" })).toBeDisabled();
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
  const dimensions = await page.evaluate(() => {
    const scroll = document.querySelector('[data-testid="receiving-table-scroll"]');
    return { table: scroll.scrollWidth - scroll.clientWidth, page: document.documentElement.scrollWidth - innerWidth };
  });
  if (dimensions.page > 2) {
    const offenders = await page.evaluate(() => [...document.querySelectorAll("body *")]
      .map(el => ({ element: el.tagName.toLowerCase(), className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
        right: Math.round(el.getBoundingClientRect().right) }))
      .filter(el => el.right > innerWidth + 2).slice(0, 12));
    console.log("Mobile overflow offenders:", offenders);
  }
  expect(dimensions.table).toBeGreaterThan(100);
  expect(dimensions.page).toBeLessThanOrEqual(2);
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
  await expect(page.getByTestId("receiving-store-F02").getByText("Offline")).toBeVisible();

  await page.evaluate(() => window.__emitRealtime({ version: 1, type: "presence.changed", storeId: "s1", status: "online" }));
  await expect(page.getByTestId("receiving-store-F02").getByText("Online")).toBeVisible();
  // Eventos incompletos não devem substituir dados válidos.
  await page.evaluate(() => window.__emitRealtime({ version: 1, type: "presence.changed", status: "offline" }));
  await expect(page.getByTestId("receiving-store-F02").getByText("Online")).toBeVisible();

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
