import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MAX_SOURCE_FILE_BYTES, isCsvAgenda, isPdfAgenda,
  importErrorLabel, buildImportPayload, canConfirmImport,
  countAgendaLabel, countStoreLabel
} from "../../frontend/import-agenda.js";

const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const file={name:"agenda-18-10.csv",size:1536,type:"text/csv"};
const appointment={
  protocol:"5001",supplier:"Fornecedor",startTime:"07:00",endTime:"08:00",
  status:"recebido",items:1,volumes:2
};
const parsed={
  date:"2026-10-18",totalAppointments:1,
  agendas:[{storeCode:"F03",date:"2026-10-18",appointments:[appointment]}],
  blockingErrors:[],warnings:[]
};
describe("Importação CSV/PDF JS fiel à main",()=>{
  it("mantém 10 MB e formatos suportados",()=>{
    assert.equal(MAX_SOURCE_FILE_BYTES,10485760);
    assert.equal(isCsvAgenda(file),true);
    assert.equal(isPdfAgenda({name:"arquivo.PDF",type:""}),true);
    assert.equal(isCsvAgenda({name:"arquivo.exe",type:""}),false);
  });
  it("não envia status do arquivo e exige prévia válida",()=>{
    assert.equal(canConfirmImport(file,parsed),true);
    assert.equal(canConfirmImport(file,{...parsed,blockingErrors:["PROTOCOL"]}),false);
    assert.equal(canConfirmImport(file,{...parsed,totalAppointments:0}),false);
    const data=buildImportPayload(file,parsed);
    assert.equal(data.agendas.length,1);
    assert.equal(data.agendas[0].originalFileName,file.name);
    assert.equal("status" in data.agendas[0].appointments[0],false);
    assert.equal("replace" in data.agendas[0],false);
    assert.deepEqual(buildImportPayload(file,parsed,true).agendas[0].replace,true);
  });
  it("impede envio parcial de lojas não identificadas",()=>{
    assert.equal(buildImportPayload(file,{...parsed,
      agendas:[...parsed.agendas,{storeCode:null,date:"2026-10-18",appointments:[]}]
    }),null);
  });
  it("mantém mensagens originais, confirmação 409 e segurança de substituição",()=>{
    assert.match(importErrorLabel("PROTOCOLO_DUPLICADO:5001"),/Há protocolo duplicado/);
    assert.equal(countAgendaLabel(1),"1 agendamento");
    assert.equal(countAgendaLabel(2),"2 agendamentos");
    assert.equal(countStoreLabel(1),"1 loja");
    const src=read("../../frontend/import-agenda.js");
    for(const expected of [
      "Confirmar importação", "Substituir agendas existentes",
      "/api/admin/agendas/import/bulk", "err.status===409",
      "status,","blockingErrors","Avisos","Corrija antes de importar",
      "Nenhuma agenda é gravada até você conferir a prévia e confirmar"
    ])assert.ok(src.includes(expected),expected);
    assert.match(src,/if\(modal\)close\(true\)/);
  });
});