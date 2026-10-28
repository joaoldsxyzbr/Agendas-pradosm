import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OBSERVATION_REASONS, normalizeObservation, validateStatusObservation } from "../../shared/observations.js";
import { agendaRowHtml } from "../../frontend/agenda-list.js";
import { agendaDetailHtml } from "../../frontend/agenda-details.js";

describe("Observação de recebimento — motivos", () => {
  it("oferece os seis motivos e Personalizado", () => {
    assert.deepEqual(OBSERVATION_REASONS, [
      "Sem agenda", "Sem pedido", "Sem boleto", "Prazo de pagamento incorreto", "Temperatura acima do OK", "Não veio"
    ]);
    assert.equal(normalizeObservation(" Outros:   Sem documentação  "), "Outros: Sem documentação");
    assert.equal(validateStatusObservation("nao_chegou", "Sem pedido"), "Sem pedido");
    assert.equal(validateStatusObservation("nao_chegou", "Não veio"), "Não veio");
  });
  it("impede não recebido sem motivo ou Outros vazio", () => {
    assert.throws(() => validateStatusObservation("nao_chegou", null), /Selecione um motivo/);
    assert.throws(() => validateStatusObservation("nao_chegou", "Outros:   "), /Selecione|Outros/);
    assert.throws(() => normalizeObservation("Motivo inventado"), /Selecione/);
    assert.throws(() => normalizeObservation("Outros: " + "A".repeat(250)), /250/);
    assert.equal(validateStatusObservation("recebido", null), null);
  });
  it("mostra o motivo no desktop, readonly e detalhes e escapa HTML", () => {
    const record = { id:"id1", supplier:"Loja <b>", protocol:"111",startTime:"08:00",
      endTime:"08:30", status:"nao_chegou",type:"Nota fiscal",origin:"imported",
      observation:"Outros: <script> x</script>", history:[{
        statusAnterior:"aguardando",statusNovo:"nao_chegou",observation:"Sem pedido",usuario:{nome:"Conf"}
      }] };
    const row = agendaRowHtml(record, {editable:true,onChanged:()=>{}});
    assert.match(row,/agenda-observation-cell/);
    assert.match(row,/data-edit-observation="id1"/);
    assert.match(row,/&lt;script&gt;/);
    assert.equal(row.toLowerCase().includes("<script"),false);
    const readOnly = agendaRowHtml(record, {editable:false});
    assert.match(readOnly,/&lt;script&gt;/);
    const html = agendaDetailHtml(record);
    assert.match(html,/Obs\./);
    assert.match(html,/Sem pedido/);
    assert.equal(html.toLowerCase().includes("<script"),false);
  });
  it("usa botões para motivos e preserva bloqueio de não recebido na API", () => {
    const html = readFileSync(new URL("../../frontend/agenda-list.js",import.meta.url),"utf8");
    assert.match(html,/data-observation-reason/);
    assert.match(html,/aria-pressed/);
    assert.doesNotMatch(html,/<select data-observation-reason/);
    assert.match(html,/data-observation-custom/);
    assert.match(html,/observation-modal-backdrop/);
    const store = readFileSync(new URL("../../worker/routes/store-agendas.js",import.meta.url),"utf8");
    const admin = readFileSync(new URL("../../worker/routes/admin-agendas.js",import.meta.url),"utf8");
    assert.match(store,/validateStatusObservation/);
    assert.match(admin,/validateStatusObservation/);
    assert.match(store,/changeAppointmentStatus/);
  });
});