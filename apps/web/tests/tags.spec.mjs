import { test, expect } from "@playwright/test";

const user = { id: "conf-1", nome: "Conferente Teste", papel: "conferente",
  lojaId: "s1", lojaCodigo: "F01", lojaNome: "Loja 01" };
const tid = number => "00000000-0000-4000-8000-" + String(number).padStart(12, "0");

async function setup(page, options = {}) {
  let tags = options.initial ?? [{ id: tid(1), name: "Prioridade", color: "azul" }];
  let assignments = { a1: options.assigned ?? [] };
  let completed = options.completed ?? false;
  const requests = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    const body = method === "GET" ? null : route.request().postDataJSON();
    requests.push({ path, method, body });
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/store/tags" && method === "GET") return route.fulfill({ json: tags });
    if (path === "/api/store/tags" && method === "POST") {
      if (options.duplicate) return route.fulfill({ status: 409, json: { error: "TAG_DUPLICADA", message: "Já existe uma tag com este nome." } });
      const next = { id: tid(tags.length + 10), name: body.name, color: body.color };
      tags = [...tags, next];
      return route.fulfill({ status: 201, json: next });
    }
    if (path.startsWith("/api/store/tags/agenda/")) return route.fulfill({ json: { tags, assignments } });
    if (path === "/api/store/tags/appointments/a1" && method === "PUT") {
      if (options.errorAssign) return route.fulfill({ status: 409, json: { error: "DIA_CONCLUIDO", message: "Este dia está concluído." } });
      assignments = { ...assignments, a1: tags.filter(tag => body.tagIds.includes(tag.id)) };
      return route.fulfill({ json: { tags: assignments.a1 } });
    }
    if (path.startsWith("/api/store/tags/") && method === "DELETE") {
      const id = decodeURIComponent(path.split("/").at(-1));
      tags = tags.filter(tag => tag.id !== id);
      return route.fulfill({ status: 204 });
    }
    if (path === "/api/store/today") return route.fulfill({ json: { agenda: { id: "ag1", date: "2026-10-30",
      storeCode: "F01", storeName: "Loja 01", dayStatus: completed ? "concluido" : "aberto" },
      appointments: [{ id: "a1", supplier: "Fornecedor Alfa", protocol: "P1", startTime: "08:00",
        endTime: "08:30", type: "Nota fiscal", status: "aguardando", hasExchanges: false }] } });
    throw Error("Rota não simulada: " + method + " " + path);
  });
  return { requests, setCompleted(value) { completed = value; } };
}

test("Tags React cadastra, filtra e arquiva somente após confirmação", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/app/tags");
  await expect(page.getByRole("heading", { name: "Tags", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Biblioteca de tags" })).toContainText("Prioridade");
  await page.getByRole("textbox", { name: "Nome da tag" }).fill("Descarga urgente");
  await page.getByRole("combobox", { name: "Cor" }).selectOption("vermelho");
  await page.getByRole("button", { name: "Criar tag" }).click();
  await expect(page.getByRole("list", { name: "Biblioteca de tags" })).toContainText("Descarga urgente");
  expect(state.requests.some(x => x.method === "POST" && x.body.name === "Descarga urgente" && x.body.color === "vermelho")).toBe(true);
  await page.getByRole("searchbox", { name: "Buscar tags" }).fill("Prior");
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Arquivar tag Prioridade" }).click();
  await expect(page.getByRole("dialog", { name: "Confirmar arquivamento de tag" })).toBeVisible();
  expect(state.requests.filter(x => x.method === "DELETE")).toHaveLength(0);
  await page.getByRole("button", { name: "Confirmar arquivamento" }).click();
  await expect(page.getByRole("list", { name: "Biblioteca de tags" })).toContainText("Nenhuma tag encontrada.");
  expect(state.requests.filter(x => x.method === "DELETE")).toHaveLength(1);
});

test("Tags React exibe conflito de duplicidade sem criar elemento local falso", async ({ page }) => {
  await setup(page, { duplicate: true });
  await page.goto("/app/tags");
  await page.getByRole("textbox", { name: "Nome da tag" }).fill("Prioridade");
  await page.getByRole("button", { name: "Criar tag" }).click();
  await expect(page.getByRole("alert")).toContainText("Já existe uma tag");
  await expect(page.getByRole("listitem")).toHaveCount(1);
});

test("Conferência React usa tags do dia e salva seleção apenas após confirmação da API", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/app");
  const row = page.getByTestId("conference-row-a1");
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "+ Tag" }).click();
  await expect(page.getByRole("form", { name: "Editar tags de Fornecedor Alfa" })).toBeVisible();
  await page.getByRole("checkbox", { name: "Selecionar tag Prioridade" }).check();
  expect(state.requests.some(x => x.method === "PUT")).toBe(false);
  await page.getByRole("button", { name: "Salvar tags" }).click();
  await expect(row.locator('[aria-label="Tags de Fornecedor Alfa"]')).toContainText("Prioridade");
  expect(state.requests.some(x => x.path.endsWith("/appointments/a1") && x.body.tagIds.length === 1)).toBe(true);
});

test("Conferência React limita a cinco tags e preserva tags quando o dia está concluído", async ({ page }) => {
  await setup(page, { initial: Array.from({ length: 6 }, (_, i) => ({
    id: tid(i + 1), name: "Etiqueta " + (i + 1), color: "verde",
  })) });
  await page.goto("/app");
  await page.getByRole("button", { name: "+ Tag" }).click();
  for (let i = 1; i <= 6; i++) await page.getByRole("checkbox", { name: "Selecionar tag Etiqueta " + i }).check();
  await expect(page.getByText("Selecione no máximo 5 tags.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar tags" })).toBeDisabled();
});

test("Conferência React mantém tags históricas visíveis e bloqueia edição após conclusão", async ({ page }) => {
  await setup(page, { completed: true, assigned: [{ id: tid(1), name: "Prioridade", color: "azul" }] });
  await page.goto("/app");
  const row = page.getByTestId("conference-row-a1");
  await expect(row.locator('[aria-label="Tags de Fornecedor Alfa"]')).toContainText("Prioridade");
  await expect(row.getByRole("button", { name: "+ Tag" })).toHaveCount(0);
});

test("Tags React é responsiva no celular", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/tags");
  await expect(page.getByRole("heading", { name: "Tags", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
});
