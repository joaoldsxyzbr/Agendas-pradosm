import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatHistoryDate, historyQuery, historyAgendaRow, appointmentHistoryList, historyStatusPayload
} from "../../frontend/history.js";

const read = relative => readFileSync(new URL(relative, import.meta.url), "utf8");

describe("Histórico da main em JavaScript puro", () => {
  it("usa a mesma API e os filtros de loja/data", () => {
    assert.equal(historyQuery(), "/api/admin/agendas");
    assert.equal(historyQuery({ storeCode: "F03", date: "2026-10-18" }),
      "/api/admin/agendas?date=2026-10-18&storeCode=F03");
    assert.equal(formatHistoryDate("2026-10-18"), "18/10/2026");
  });
  it("mantém a ordem das colunas e protege nome da loja", () => {
    const html = historyAgendaRow({
      id: "a", date: "2026-10-18", storeName: "Loja <script>",
      total: 3, aguardando: 1, recebido: 2, dayStatus: "concluido"
    });
    assert.match(html, /18\/10\/2026/);
    assert.match(html, /Loja &lt;script&gt;/);
    assert.equal(html.toLowerCase().includes("<script"), false);
    assert.match(html, /Concluído/);
    const src = read("../../frontend/history.js");
    for (const text of [
      "<th>Data</th><th>Loja</th><th>Total</th>",
      "Aguardando", "Recebidos", "Status do dia",
      "Horário", "Protocolo", "Fornecedor", "Trocas", "Ver histórico"
    ]) assert.ok(src.includes(text), text);
  });
  it("preserva consulta de detalhes e os endpoints mutáveis da main", () => {
    const src = read("../../frontend/history.js");
    for (const endpoint of [
      "/api/admin/agendas/", "/api/admin/appointments/",
      "/status", "/history", "historyStatusPayload(value, observation)"
    ]) assert.ok(src.includes(endpoint), endpoint);
    assert.match(src, /method: "PATCH"/);
    assert.match(src, /JSON\.stringify\(\{ status: "aberto" \}\)/);
    assert.match(src, /data-appointment-exchanges/);
    assert.match(src, /data-appointment-status/);
    assert.match(src, /Confirmar|Reabrir para conferente/);
  });
  it("impede não recebido sem motivo na edição do histórico", () => {
    assert.deepEqual(historyStatusPayload("recebido"), { status: "recebido" });
    assert.deepEqual(historyStatusPayload("nao_chegou", "Sem pedido"),
      { status: "nao_chegou", observation: "Sem pedido" });
    assert.deepEqual(historyStatusPayload("nao_chegou", "Outros: Sem romaneio"),
      { status: "nao_chegou", observation: "Outros: Sem romaneio" });
    assert.throws(() => historyStatusPayload("nao_chegou"), /Selecione um motivo/);
    assert.throws(() => historyStatusPayload("nao_chegou", "Outros:  "), /Selecione|Outros/);
    const ui = read("../../frontend/history-observation-dialog.js");
    const history = read("../../frontend/history.js");
    assert.match(ui, /data-observation-reason/);
    assert.match(ui, /data-observation-custom/);
    assert.match(ui, /validateStatusObservation/);
    assert.match(history, /requireHistoryObservation\(item, control\)/);
    assert.match(history, /closeObservationDialog\?\.\(\)/);
  });
  it("exibe motivos do histórico administrativo e escapa HTML", () => {
    const html = appointmentHistoryList([{ statusAnterior: "aguardando", statusNovo: "nao_chegou",
      observation: "Outros: <img src=x onerror=alert(1)>", usuario: { nome: "Teste" } }]);
    assert.match(html, /Obs\.: Outros:/);
    assert.match(html, /&lt;img/);
    assert.doesNotMatch(html, /<img/);
    assert.match(read("../../worker/routes/admin-agendas.js"), /observation: item\.observacao \?\? null/);
  });
  it("preserva histórico diário, status e auditoria sem atualização global da interface", () => {
    const src = read("../../frontend/history.js");
    for (const label of [
      "Dia concluído", "Dia reaberto", "Dia concluído automaticamente",
      "Ajuste administrativo", "Histórico de status"
    ]) assert.ok(src.includes(label), label);
    assert.match(src, /row\.replaceWith\(temp\.content\)/);
    assert.match(src, /root\.querySelectorAll\("\[data-appointment-id\]"/);
    assert.doesNotMatch(src, /PREVIEW_DEMO_LOGIN|observacao/);
  });
});