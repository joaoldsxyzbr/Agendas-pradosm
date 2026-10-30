import { test, expect } from "@playwright/test";

const admin = { id: "adm", nome: "ADM Teste", papel: "admin" };
const viewer = { id: "view", nome: "Visualizador", papel: "visualizador" };
const conference = { id: "conf", nome: "Doca 01", papel: "conferente", lojaId: "1" };

async function sessionMocks(page, initialUser = null) {
  let current = initialUser;
  await page.route("**/api/realtime/config", route => route.fulfill({ json: { mode: "off", protocolVersion: 1 } }));
  await page.route("**/api/admin/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/admin/stores") return route.fulfill({ json: [] });
    if (path === "/api/admin/agendas") return route.fulfill({ json: [] });
    if (path === "/api/admin/presence") return route.fulfill({ json: [] });
    throw new Error("Endpoint administrativo não previsto: " + path);
  });
  await page.route("**/api/auth/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path === "/api/auth/me") {
      if (!current) return route.fulfill({ status: 401, json: { error: "SEM_SESSAO" } });
      return route.fulfill({ json: current });
    }
    if (path === "/api/auth/login" && method === "POST") {
      const body = route.request().postDataJSON();
      if (body.login !== "adm" || body.senha !== "senha-de-teste") {
        return route.fulfill({ status: 401, json: { error: "CREDENCIAIS_INVALIDAS", message: "Login ou senha inválidos." } });
      }
      current = admin;
      return route.fulfill({ json: current });
    }
    if (path === "/api/auth/logout" && method === "POST") {
      current = null;
      return route.fulfill({ status: 204 });
    }
    throw new Error("Endpoint não previsto: " + method + " " + path);
  });
}

test("React: login usa API e redireciona corretamente, sem frontend legado", async ({ page }) => {
  await sessionMocks(page);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.getByRole("textbox", { name: "Login" }).fill("adm");
  await page.locator('input[name="senha"]').fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Recebimento", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recebimento por loja" })).toBeVisible();
  await expect(page.locator(".prado-admin")).toHaveCount(0);
});
test("React: login inválido exibe erro sem trocar de página", async ({ page }) => {
  await sessionMocks(page);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Login" }).fill("adm");
  await page.locator('input[name="senha"]').fill("senha-errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("Login ou senha inválidos.");
  await expect(page).toHaveURL(/\/login$/);
});
test("React: visualizador mantém somente as duas rotas permitidas", async ({ page }) => {
  await sessionMocks(page, viewer);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await page.getByRole("link", { name: "Relatório Gerencial" }).click();
  await expect(page.getByRole("heading", { name: "Relatório Gerencial" })).toBeVisible();
});
test("React: conferente acessa Tags e não acessa rotas administrativas", async ({ page }) => {
  await sessionMocks(page, conference);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("link", { name: "Tags" }).click();
  await expect(page).toHaveURL(/\/app\/tags$/);
  await expect(page.getByRole("heading", { name: "Tags" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
});
test("React: administrador pode navegar nas rotas sem dados operacionais falsos", async ({ page }) => {
  await sessionMocks(page, admin);
  for (const [path, heading] of [
    ["/admin", "Recebimento"],
    ["/admin/history", "Histórico"],
    ["/admin/import", "Importar agenda"],
    ["/admin/stores", "Lojas"],
    ["/admin/users", "Usuários"],
    ["/admin/reports", "Relatório Gerencial"],
    ["/admin/diagnostics", "Logs e Auditoria"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    if (path === "/admin") {
      await expect(page.getByRole("heading", { name: "Recebimento por loja" })).toBeVisible();
    } else if (path === "/admin/import") {
      await expect(page.getByRole("group", { name: "Área para arrastar arquivos de agenda" })).toBeVisible();
    } else {
      await expect(page.getByText("Esta tela ainda funciona somente na versão atual")).toBeVisible();
    }
  }
});
test("React: logout desautoriza navegação", async ({ page }) => {
  await sessionMocks(page, admin);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});
test("React: layout compacto não cria rolagem lateral em celular", async ({ page }) => {
  await sessionMocks(page, viewer);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Recebimento", exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
