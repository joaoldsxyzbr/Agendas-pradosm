import { test, expect } from "@playwright/test";

const counts = new Map([
  ["CD DOCA 01", 15], ["F01", 25], ["F02", 25], ["F03", 21],
  ["F04", 24], ["F05", 21], ["F07", 23], ["F08", 20], ["F09", 20]
]);

// Fixture sem nomes, notas ou pedidos reais. Preserva formato exportado pela empresa:
// BOM, linhas de filtro, cabeçalho com N°, 194 registros, 9 locais, CD/DOCA e ponto e vírgula final.
function layoutExportado() {
  const lines = [
    "Filtros;",
    "Dia: 22/10/2026 ; Filial: Todas ; Doca: Todas ; Busca:  ; ;",
    "",
    "Protocolo;Data agenda;Fornecedor;Filial;Doca;Itens;Vol.;Paletes;Carga batida;Tipo;N° NFe;Pedidos;"
  ];
  let protocol = 10000000;
  const types = ["Nota fiscal", "Pedido", "CNPJ", "Agenda fixa"];
  for (const [code, amount] of counts) {
    for (let n = 0; n < amount; n++) {
      const store = code.startsWith("CD") ? "CD" : code + " - LOJA TESTE";
      const dock = "DOCA 01";
      const start = String(7 + Math.floor(n / 8)).padStart(2, "0") + ":" + String((n % 6) * 10).padStart(2, "0");
      const endMinutes = (7 + Math.floor(n / 8)) * 60 + (n % 6) * 10 + 10;
      const end = String(Math.floor(endMinutes / 60)).padStart(2, "0") + ":" + String(endMinutes % 60).padStart(2, "0");
      lines.push([
        String(++protocol), "22/10/2026 " + start + " às " + end, "FORNECEDOR SINTÉTICO " + n,
        store, dock, String(n % 25), String(n % 50), String(n % 4),
        n % 2 ? "Não" : "-", types[n % types.length],
        n % 3 ? "123" + n : "-", n % 4 ? "987" + n : "-"
      ].join(";") + ";");
    }
  }
  return Buffer.from("\uFEFF" + lines.join("\r\n") + "\r\n", "utf8");
}
const admin = { id: "adm1", nome: "Administrador", papel: "admin", login: "adm" };
async function visit(page) {
  const imported = [];
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({json:admin});
    if (path === "/api/realtime/config") return route.fulfill({json:{mode:"off",protocolVersion:1}});
    if (path === "/api/admin/stores") return route.fulfill({json:[]});
    if (path === "/api/admin/agendas") return route.fulfill({json:[]});
    if (path === "/api/admin/presence") return route.fulfill({json:[]});
    if (path === "/api/admin/agendas/import/bulk") {
      imported.push(route.request().postDataJSON());
      return route.fulfill({status:201,json:{totalAgendas:9,totalAppointments:194}});
    }
    return route.fulfill({status:404,json:{error:"NAO_ENCONTRADO"}});
  });
  await page.goto("/admin");
  await page.locator("[data-open-import]").click();
  await expect(page.getByRole("dialog", {name:"Importar agenda"})).toBeVisible();
  return imported;
}

test("layout empresarial de 194 linhas: seletor real, prévia e envio uma só vez", async ({page}) => {
  const errors=[];
  page.on("pageerror", e => errors.push(e.message));
  const imported=await visit(page);
  const chooserPromise=page.waitForEvent("filechooser");
  await page.locator("[data-import-browse]").click();
  const chooser=await chooserPromise;
  await chooser.setFiles({name:"agenda-de-recebimento.csv",mimeType:"text/csv",buffer:layoutExportado()});
  await expect(page.locator("[data-import-file-name]")).toContainText("agenda-de-recebimento.csv");
  await expect(page.locator(".preview-summary")).toContainText("194 agendamentos");
  await expect(page.locator(".preview-summary")).toContainText("9 lojas");
  await expect(page.locator("[data-import-submit]")).toBeEnabled();
  await expect(page.locator("[data-import-loading]")).toBeHidden();
  expect(imported).toHaveLength(0);
  await page.locator("[data-import-submit]").click();
  expect(imported).toHaveLength(1);
  expect(imported[0].agendas).toHaveLength(9);
  expect(imported[0].agendas.reduce((sum,a)=>sum+a.appointments.length,0)).toBe(194);
  await expect(page.getByRole("dialog", {name:"Importar agenda"})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("selecionar novamente o mesmo CSV mantém prévia e modal estável", async ({page}) => {
  await visit(page);
  const file={name:"agenda-de-recebimento.csv",mimeType:"text/csv",buffer:layoutExportado()};
  await page.locator("[data-import-file]").setInputFiles(file);
  await expect(page.locator(".preview-summary")).toContainText("194 agendamentos");
  const picker=page.locator("[data-import-file]");
  await picker.setInputFiles(file);
  await expect(page.locator(".preview-summary")).toContainText("194 agendamentos");
  await expect(page.getByRole("dialog", {name:"Importar agenda"})).toBeVisible();
});

test("prévia não some após atualização do dashboard", async ({page}) => {
  await visit(page);
  await page.locator("[data-import-file]").setInputFiles({
    name:"agenda-de-recebimento.csv",mimeType:"text/csv",buffer:layoutExportado()
  });
  await expect(page.locator(".preview-summary")).toContainText("194 agendamentos");
  // Atualização de dados e visibilidade não devem descartar o modal.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.locator("[data-refresh]").dispatchEvent("click");
  await expect(page.locator(".preview-summary")).toContainText("194 agendamentos");
  await expect(page.getByRole("dialog", {name:"Importar agenda"})).toBeVisible();
});