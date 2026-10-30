import { test, expect } from "@playwright/test";

const user = { id: "user-1", nome: "Visualizador de Teste", papel: "visualizador" };
const stores = [
  { id: "s1", codigo: "F01", nome: "Loja 01", ativo: true },
  { id: "s2", codigo: "F02", nome: "Loja 02", ativo: true },
];
const rows = [
  { date: "2026-10-29", storeCode: "F01", storeName: "Loja 01", dayStatus: "concluido",
    total: 2, recebido: 1, naoChegou: 1, naoCompareceu: 0, aguardando: 0, recusado: 0, semAgenda: 0 },
  { date: "2026-10-30", storeCode: "F02", storeName: "Loja 02", dayStatus: "aberto",
    total: 1, recebido: 1, naoChegou: 0, naoCompareceu: 0, aguardando: 0, recusado: 0, semAgenda: 0 },
];
const occurrences = { total: 55, rows: [
  { date: "2026-10-29", storeCode: "F01", storeName: "Loja 01", supplier: "Fornecedor Alfa",
    protocol: "P001", observation: "Entrega não realizada", origin: "imported",
    occurrenceType: "nao_recebido", classificationOrigin: "manual" },
]};
const latest = { total: 53, rows: [
  { date: "2026-10-30", storeCode: "F02", time: "10:00",
    supplier: "Fornecedor Beta", status: "recebido" },
]};
async function mock(page, options = {}) {
  const requests = [];
  let failed = false;
  await page.route("**/api/auth/me", route => route.fulfill({ json: user }));
  await page.route("**/api/admin/**", route => {
    const url = new URL(route.request().url());
    const selected = url.searchParams.getAll("storeCode");
    requests.push({ path: url.pathname, stores: selected, start: url.searchParams.get("start"), end: url.searchParams.get("end"),
      offset: url.searchParams.get("offset"), search: url.searchParams.get("q") });
    if (url.pathname === "/api/admin/stores") return route.fulfill({ json: stores });
    if (url.pathname === "/api/admin/reports") {
      if (options.failOnce && !failed) {
        failed = true;
        return route.fulfill({ status: 503, json: { error: "UNAVAILABLE", message: "Serviço indisponível" } });
      }
      return route.fulfill({ json: {
        start: url.searchParams.get("start"), end: url.searchParams.get("end"), storeCodes: selected,
        rows: selected.length ? rows.filter(row => selected.includes(row.storeCode)) : rows,
        suppliers: [{ supplier: "Fornecedor Alfa", total: 2, recebido: 1, naoChegou: 1 }],
      } });
    }
    if (url.pathname === "/api/admin/reports/occurrences") return route.fulfill({ json: {
      ...occurrences, offset: Number(url.searchParams.get("offset") || 0), limit: 50,
      rows: url.searchParams.get("q") === "Inexistente" ? [] : occurrences.rows,
    } });
    if (url.pathname === "/api/admin/reports/latest") return route.fulfill({ json: {
      ...latest, offset: Number(url.searchParams.get("offset") || 0), limit: 50,
    } });
    throw Error("API de teste inesperada: " + url.pathname);
  });
  return requests;
}

test("Relatório React mostra KPIs calculados, gráficos, tabelas e fonte API", async ({ page }) => {
  const requests = await mock(page);
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Relatório Gerencial" })).toBeVisible();
  await expect(page.getByLabel("Indicadores gerenciais")).toContainText("66,7%");
  await expect(page.getByLabel("Indicadores gerenciais")).toContainText("3");
  await expect(page.getByRole("table", { name: "Consolidado por loja" }).locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("table", { name: "Ocorrências e observações" })).toContainText("Fornecedor Alfa");
  await expect(page.getByRole("table", { name: "Agendamentos recentes" })).toContainText("Fornecedor Beta");
  await expect(page.getByRole("heading", { name: "Evolução diária" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Distribuição das situações" })).toBeVisible();
  expect(requests.some(x => x.path === "/api/admin/reports")).toBe(true);
  expect(requests.some(x => x.path === "/api/admin/reports/latest")).toBe(true);
  expect(requests.some(x => x.path === "/api/admin/reports/occurrences")).toBe(true);
});

test("Relatório React filtra intervalo e múltiplas lojas sem permitir período inválido", async ({ page }) => {
  const requests = await mock(page);
  await page.goto("/admin/reports");
  await page.getByText("Todas as lojas", { exact: true }).first().click();
  await page.locator('input[type="checkbox"][value="F01"]').check();
  await page.locator('input[type="checkbox"][value="F02"]').check();
  const fields = page.getByRole("form", { name: "Filtros do relatório" }).locator('input[type="date"]');
  await fields.nth(0).fill("2026-10-20");
  await fields.nth(1).fill("2026-10-30");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect.poll(() => requests.filter(x => x.path === "/api/admin/reports" && x.start === "2026-10-20" && x.end === "2026-10-30" && x.stores.length === 2).length).toBeGreaterThan(0);
  const count = requests.length;
  await fields.nth(0).fill("2026-01-01");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByRole("alert")).toContainText("até 93 dias");
  expect(requests.length).toBe(count);
});

test("Relatório React oferece pesquisa, paginação e comparação sem gravação", async ({ page }) => {
  const requests = await mock(page);
  await page.goto("/admin/reports");
  await expect(page.getByRole("table", { name: "Ocorrências e observações" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar ocorrência por fornecedor ou protocolo" }).fill("Alfa");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect.poll(() => requests.some(x => x.path === "/api/admin/reports/occurrences" && x.search === "Alfa")).toBe(true);
  await page.getByRole("button", { name: "Próxima" }).first().click();
  await expect.poll(() => requests.some(x => x.path === "/api/admin/reports/occurrences" && x.offset === "50")).toBe(true);
  await page.getByRole("button", { name: "Limpar" }).click();
  await expect.poll(() => requests.some(x => x.path === "/api/admin/reports/occurrences" && x.search === null && x.offset === "0")).toBe(true);
  await page.getByRole("checkbox", { name: "Comparar período anterior" }).uncheck();
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page.getByLabel("Indicadores gerenciais")).toContainText("Sem comparação disponível");
  expect(requests.every(x => x.path === "/api/admin/stores" || x.path.startsWith("/api/admin/reports"))).toBe(true);
});

test("Relatório React recupera de erro e mantém permissão somente leitura do visualizador", async ({ page }) => {
  await mock(page, { failOnce: true });
  await page.goto("/admin/reports");
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar os indicadores");
  await page.getByRole("button", { name: "Tentar novamente" }).first().click();
  await expect(page.getByLabel("Indicadores gerenciais")).toContainText("66,7%");
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Importar agenda" })).toHaveCount(0);
});

test("Relatório React não provoca overflow horizontal do documento no celular", async ({ page }) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/reports");
  await expect(page.getByLabel("Indicadores gerenciais")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
