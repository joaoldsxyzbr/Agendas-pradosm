import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dashboardModel, dashboardRowHtml, addDashboardDays, presenceLabel, formatDashboardDate
} from "../../migration/frontend/dashboard-model.js";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

const stores = [
  { id: "a", codigo: "F03", nome: "Loja & Filial", ativo: true, temConferenteAtivo: true },
  { id: "b", codigo: "F08", nome: "Loja B", ativo: true, temConferenteAtivo: true },
  { id: "c", codigo: "F09", nome: "Inativa", ativo: false, temConferenteAtivo: true },
  { id: "d", codigo: "F10", nome: "Sem conferente", ativo: true, temConferenteAtivo: false }
];
const agendas = [
  { id: "agenda-a", storeCode: "F03", total: 5, recebido: 4, aguardando: 1, naoChegou: 0, recusado: 0, semAgenda: 0, dayStatus: "aberto" }
];
const presence = [{ storeId: "a", status: "online" }, { storeId: "b", status: "away" }];

describe("Dashboard administrativo em JS puro — paridade com a main", () => {
  it("aplica filtros de lojas e mantém todos os indicadores operacionais", () => {
    const model = dashboardModel(stores, agendas, presence);
    assert.equal(model.totalStores, 2);
    assert.equal(model.storesWithAgenda, 1);
    assert.equal(model.openStores, 1);
    assert.equal(model.completedStores, 0);
    assert.equal(model.storesWithoutAgenda, 1);
    assert.deepEqual(model.rows.map(x => x.store.id), ["a", "b"]);
    assert.equal(model.rows[0].presenceStatus, "online");
    assert.equal(model.rows[1].presenceStatus, "away");
  });
  it("mantém presença, andamento, pendências e a ordem das colunas", () => {
    const row = dashboardRowHtml(dashboardModel(stores, agendas, presence).rows[0], "2026-10-18");
    assert.match(row, /presence-dot online/);
    assert.match(row, /4 \/ 5/);
    assert.match(row, /1 aguardando/);
    assert.match(row, /Em andamento/);
    assert.match(row, /Ver detalhes/);
    assert.match(row, /Loja &amp; Filial/);
    const noAgenda = dashboardRowHtml(dashboardModel(stores, agendas, presence).rows[1], "2026-10-18");
    assert.match(noAgenda, /Não importada em 18\/10\/2026/);
    assert.match(noAgenda, /Pendente/);
    const controller = read("../../migration/frontend/dashboard.js");
    for (const heading of [
      "Presença", "Loja", "Agenda", "Andamento", "Pendências", "Situação",
      "Recebimento por loja", "Nenhuma loja com conferente ativo."
    ]) assert.ok(controller.includes(heading), heading);
  });
  it("usa apenas células alteradas no refresh, sem reabrir a tela", () => {
    const source = read("../../migration/frontend/dashboard.js");
    assert.match(source, /oldCells\[i\]\.replaceWith\(newCells\[i\]\)/);
    assert.match(source, /request\(`\/api\/admin\/agendas\?date=/);
    assert.match(source, /event\.type === "agenda.changed"/);
    assert.match(source, /event\.type === "presence.changed"/);
    assert.match(source, /75\)/);
  });
  it("mantém calendário local e estados de presença", () => {
    assert.equal(addDashboardDays("2026-12-31", 1), "2027-01-01");
    assert.equal(formatDashboardDate("2026-10-18"), "18/10/2026");
    assert.equal(presenceLabel("online"), "Online");
    assert.equal(presenceLabel("away"), "Ausente");
    assert.equal(presenceLabel("offline"), "Offline");
  });
});
