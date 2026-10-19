import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminReportRoutes } from "../../worker/routes/admin-reports.js";
import { sumReportRows, reportRate, groupDailyReport, groupStoreReport } from "../../frontend/report-model.js";
import { validReportRange } from "../../frontend/reports.js";

const rows=[
 {date:"2026-10-01",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",total:6,recebido:4,naoChegou:1,aguardando:1,semConferencia:0,recusado:0,semAgenda:1},
 {date:"2026-10-02",storeCode:"F01",storeName:"Centro",dayStatus:"concluido",total:4,recebido:2,naoChegou:1,aguardando:0,semConferencia:1,recusado:0,semAgenda:0}
];
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
describe("Relatório Gerencial",()=>{
 it("consolida status, datas e lojas sem misturar resultados",()=>{
   const s=sumReportRows(rows);
   assert.deepEqual(s,{total:10,recebido:6,naoChegou:2,aguardando:1,semConferencia:1,recusado:0,semAgenda:1,agendas:2,abertas:1});
   assert.equal(reportRate(s),60);
   assert.equal(reportRate({total:0,recebido:0}),0);
   assert.equal(groupDailyReport(rows).length,2);
   assert.deepEqual(groupDailyReport(rows).map(x=>[x.aguardando,x.semConferencia]),[[1,0],[0,1]]);
   assert.equal(groupStoreReport(rows)[0].aguardando,1);
   assert.equal(groupStoreReport(rows)[0].semConferencia,1);
   assert.equal(s.total,s.recebido+s.naoChegou+s.aguardando+s.semConferencia+s.recusado);
   assert.equal(groupStoreReport(rows)[0].total,10);
 });
 it("valida datas reais e intervalo máximo de 93 dias",()=>{
   assert.equal(validReportRange("2026-10-01","2026-10-19"),true);
   assert.equal(validReportRange("2026-10-19","2026-10-01"),false);
   assert.equal(validReportRange("2026-02-30","2026-03-01"),false);
   assert.equal(validReportRange("2026-01-01","2026-07-01"),false);
 });
 it("retorna dados reais com filtros parametrizados; rejeita período e paginação inválidos",async()=>{
   const statements=[];
   const db={prepare(sql){const item={sql,params:[]};statements.push(item);
     return{bind(...args){item.params=args;return this;},
       async all(){if(sql.includes("ag.fornecedor"))return {results:[{supplier:"Teste",naoChegou:2}]};return {results:[rows[0]]};},
       async first(){return {total:1};}
     };
   }};
   const fetch=path=>adminReportRoutes.request("http://localhost"+path,{}, {DB:db});
   const invalid=await fetch("/?start=2026-01-01&end=2026-09-01");
   assert.equal(invalid.status,400);
   assert.equal(statements.length,0);
   const ok=await fetch("/?start=2026-10-01&end=2026-10-19&storeCode=F01");
   assert.equal(ok.status,200);
   const data=await ok.json();
   assert.equal(data.rows[0].total,6);
   assert.equal(data.rows[0].aguardando,1);
   assert.deepEqual(statements[0].params,["2026-10-01","2026-10-19","F01","F01"]);
   assert.ok(statements[0].sql.includes("ag.ativo = 1"));
   assert.match(statements[0].sql,/ag\.status = 'aguardando' AND a\.status_dia = 'aberto'/);
   assert.match(statements[0].sql,/ag\.status = 'aguardando' AND a\.status_dia = 'concluido'/);
   assert.equal(data.rows[0].semConferencia,0);
   const badPage=await fetch("/occurrences?start=2026-10-01&end=2026-10-19&limit=200");
   assert.equal(badPage.status,400);
 });
 it("exige perfis autorizados e mantém somente GET para visualizador",()=>{
   const auth=read("../../worker/middleware/auth.js");
   const app=read("../../worker/app.js");
   assert.match(auth,/path === "\/api\/admin\/reports"/);
   assert.match(auth,/path === "\/api\/admin\/reports\/occurrences"/);
   assert.match(auth,/c\.req\.method !== "GET"/);
   assert.match(app,/requireAuth/);
   assert.match(app,/requireAdmin/);
   assert.match(app,/restrictDashboardViewer/);
   assert.match(app,/app\.route\("\/api\/admin\/reports"/);
 });
});