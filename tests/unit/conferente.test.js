import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  STATUS_LABELS, requestedAgendaStatus, appointmentTime,
  normalizeAgendaSearch, sortAgendaAppointments, nextAgendaSort, agendaRowHtml
} from "../../frontend/agenda-list.js";
import {
  countAgendaStatus, storeAgendaMetrics, filterStoreAppointments,
  storeAgendaEndpoint, addStoreDays
} from "../../frontend/store-agenda-model.js";
import { agendaDetailHtml } from "../../frontend/agenda-details.js";

const files = path => readFileSync(new URL(path, import.meta.url), "utf8");
const first = {
  id:"a",protocol:"12",startTime:"08:00",endTime:"08:30",
  supplier:"São Miguel",type:"B",status:"recebido",hasExchanges:true,
  items:3,volumes:3,pallets:1,cargaBatida:null,nfe:["NF-1"],orders:["P-1"],ativo:true
};
const second = { ...first, id:"b",protocol:"2",supplier:"Loja B",startTime:"07:00",
  status:"aguardando",hasExchanges:false,nfe:[],orders:[] };
const manual = { ...first, id:"m",origin:"manual",supplier:"Manual",startTime:"00:00" };

describe("Conferente nativo — contratos da main", () => {
  it("mantém a alternância de status para aguardando", () => {
    assert.equal(requestedAgendaStatus("recebido","recebido"),"aguardando");
    assert.equal(requestedAgendaStatus("nao_chegou","nao_chegou"),"aguardando");
    assert.equal(requestedAgendaStatus("aguardando","recebido"),"recebido");
    assert.equal(STATUS_LABELS.recusado,"Recusado");
  });
  it("mantém ordenação padrão, ordenação de colunas e pesquisa sem acentos", () => {
    assert.deepEqual(sortAgendaAppointments([first,second]).map(x=>x.id),["b","a"]);
    assert.equal(filterStoreAppointments([first,second],"SAO").length,1);
    assert.equal(normalizeAgendaSearch("São"),"sao");
    assert.deepEqual(nextAgendaSort(null,"supplier"),{key:"supplier",direction:"desc"});
    assert.deepEqual(nextAgendaSort({key:"supplier",direction:"desc"},"supplier"),{key:"supplier",direction:"asc"});
    assert.equal(nextAgendaSort({key:"supplier",direction:"asc"},"supplier"),null);
    assert.equal(appointmentTime(manual),"00:00");
  });
  it("mantém as métricas e APIs de hoje/histórico", () => {
    assert.equal(countAgendaStatus([first,second],"recebido"),1);
    assert.deepEqual(storeAgendaMetrics([first,second]),{
      total:2,aguardando:1,recebido:1,naoChegou:0,trocas:1
    });
    assert.equal(storeAgendaEndpoint("2026-10-18","2026-10-18"),"/api/store/today");
    assert.equal(storeAgendaEndpoint("2026-10-17","2026-10-18"),"/api/store/history/2026-10-17");
    assert.equal(addStoreDays("2026-12-31",1),"2027-01-01");
  });
  it("renderiza ordem original e versões desktop/mobile com dados escapados", () => {
    const dangerous={...first,supplier:"<script>alert(1)</script>"};
    const row=agendaRowHtml(dangerous,{editable:true,onChanged:()=>{}});
    assert.match(row,/data-testid="agenda-desktop-row"/);
    assert.match(row,/data-status="recebido"/);
    assert.match(row,/data-exchanges="a"/);
    assert.match(row,/data-edit-observation="a"/);
    assert.match(row,/agenda-observation-cell/);
    assert.match(row,/&lt;script&gt;/);
    assert.equal(row.toLowerCase().includes("<script"), false);
    const list=files("../../frontend/agenda-list.js");
    for(const token of ["agenda-mobile","agenda-card","data-testid=\"agenda-mobile-card\"",
      "Horário","Fornecedor","Protocolo","Tipo","Status","Ações","Trocas"])assert.ok(list.includes(token),token);
  });
  it("mantém detalhes, NF-e, pedidos e histórico da main", () => {
    const markup=agendaDetailHtml({...first,history:[]});
    assert.match(markup,/Horário/);
    assert.match(markup,/NF-e/);
    assert.match(markup,/Pedidos/);
    assert.match(markup,/Nenhuma alteração de status registrada/);
  });
  it("mantém fechamento, manual e atualização incremental sem navegar", () => {
    const src=files("../../frontend/today.js");
    const dialogs=files("../../frontend/store-modals.js");
    for(const expected of ["renderAgendaList","renderAgendaDatePicker","Exportar PDF",
      "Concluir dia","Fornecedor sem agenda","onRealtime","load({silent:true})",
      "storeAgendaEndpoint"]) assert.ok(src.includes(expected),expected);
    for(const expected of ["/api/store/agenda/","/api/store/appointments/",
      "method:\"DELETE\"","/complete","aria-modal=\"true\""]) {
      assert.ok(dialogs.includes(expected),expected);
    }
    assert.doesNotMatch(src,/PREVIEW_DEMO_LOGIN|observacao|window\.location\.reload/);
  });
});