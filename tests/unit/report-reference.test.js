import { describe,it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminReportRoutes } from "../../worker/routes/admin-reports.js";
import { sumReportRows,groupDailyReport } from "../../frontend/report-model.js";
import { renderStatusDonut,renderRateTrend,renderLatestAppointments,statusPresentation } from "../../frontend/report-visuals.js";

describe("Dashboard gerencial — referência",()=>{
 it("últimos registros usam filtros, ordem, limite e classificação automática",async()=>{
   const prepared=[];
   const db={prepare(sql){const record={sql,params:[]};prepared.push(record);
     return {bind(...params){record.params=params;return this;},
       async all(){return {results:[{date:"2026-10-18",startTime:"10:00",storeCode:"F01",
         storeName:"Centro",supplier:"Fornecedor Teste",protocol:"P1",origin:"importado",
         status:"nao_compareceu",classificationOrigin:"sistema"}]};}
     };
   }};
   const request=path=>adminReportRoutes.request("http://localhost"+path,{}, {DB:db});
   assert.equal((await request("/latest?start=2026-10-01&end=2026-10-19&storeCode=")).status,400);
   assert.equal(prepared.length,0);
   const response=await request("/latest?start=2026-10-01&end=2026-10-19&storeCode=F01&storeCode=F02");
   assert.equal(response.status,200);
   const result=await response.json();
   assert.equal(result.rows[0].status,"nao_compareceu");
   assert.deepEqual(prepared[0].params,["2026-10-01","2026-10-19","F01","F02"]);
   assert.match(prepared[0].sql,/ag\.ativo = 1/);
   assert.match(prepared[0].sql,/LIMIT 6/);
   assert.match(prepared[0].sql,/AS classificationOrigin/);
   assert.match(prepared[0].sql,/l\.codigo COLLATE NOCASE IN \(\?,\?\)/);
   assert.match(prepared[0].sql,/ORDER BY a\.data_agenda DESC/);
 });
 it("rosca e linha não inventam valores e suportam estado vazio",()=>{
   const rows=[{date:"2026-10-18",total:6,recebido:4,naoChegou:1,naoCompareceu:1,aguardando:0,recusado:0},
               {date:"2026-10-19",total:4,recebido:2,naoChegou:1,naoCompareceu:0,aguardando:1,recusado:0}];
   const summary=sumReportRows(rows);
   const ring=renderStatusDonut(summary);
   assert.match(ring,/report-donut-ring/);
   assert.match(ring,/60%/);
   assert.match(ring,/Não compareceu/);
   const chart=renderRateTrend(groupDailyReport(rows));
   assert.match(chart,/report-trend-svg/);
   assert.match(chart,/66,7%/);
   assert.match(chart,/50%/);
   assert.match(renderRateTrend([]),/Sem recebimentos/);
   assert.match(renderStatusDonut({total:0}),/Sem agendamentos/);
   assert.match(renderLatestAppointments(null),/indisponíveis/);
   assert.match(renderLatestAppointments([]),/Nenhum agendamento/);
   assert.deepEqual(statusPresentation("nao_compareceu"),["Não compareceu","automatic"]);
   const safe=renderLatestAppointments([{date:"2026-10-18",startTime:"09:00",storeCode:"F01",
       supplier:"<img>",status:"recebido"}]);
   assert.doesNotMatch(safe,/<img>/);
   assert.match(safe,/&lt;img&gt;/);
 });
 it("visualizador mantém GET permitido apenas na área gerencial",()=>{
   const auth=readFileSync(new URL("../../worker/middleware/auth.js",import.meta.url),"utf8");
   assert.match(auth,/path === "\/api\/admin\/reports\/latest"/);
   assert.match(auth,/c\.req\.method !== "GET"/);
   assert.match(auth,/requireAdmin/);
 });
});
