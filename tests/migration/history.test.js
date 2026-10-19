import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatHistoryDate, historyQuery, historyAgendaRow
} from "../../migration/frontend/history.js";

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
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /Concluído/);
    const src = read("../../migration/frontend/history.js");
    for (const text of [
      "<th>Data</th><th>Loja</th><th>Total</th>",
      "Aguardando", "Recebidos", "Status do dia",
      "Horário", "Protocolo", "Fornecedor", "Trocas", "Ver histórico"
    ]) assert.ok(src.includes(text), text);
  });
  it("preserva consulta de detalhes e os endpoints mutáveis da main", () => {
    const src = read("../../migration/frontend/history.js");
    for (const endpoint of [
      "/api/admin/agendas/", "/api/admin/appointments/",
      "/status", "/history", 'field === "status" ? { status: value } : { hasExchanges: value }'
    ]) assert.ok(src.includes(endpoint), endpoint);
    assert.match(src, /method: "PATCH"/);
    assert.match(src, /JSON\.stringify\(\{ status: "aberto" \}\)/);
    assert.match(src, /data-appointment-exchanges/);
    assert.match(src, /data-appointment-status/);
    assert.match(src, /Confirmar|Reabrir para conferente/);
  });
  it("preserva histórico diário, status e auditoria sem atualização global da interface", () => {
    const src = read("../../migration/frontend/history.js");
    for (const label of [
      "Dia concluído", "Dia reaberto", "Dia concluído automaticamente",
      "Ajuste administrativo", "Histórico de status"
    ]) assert.ok(src.includes(label), label);
    assert.match(src, /row\.replaceWith\(temp\.content\)/);
    assert.match(src, /root\.querySelectorAll\("\[data-appointment-id\]"/);
    assert.doesNotMatch(src, /PREVIEW_DEMO_LOGIN|observacao/);
  });
});