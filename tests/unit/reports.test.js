import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminReportRoutes } from "../../worker/routes/admin-reports.js";
import { sumReportRows, reportRate, groupDailyReport, groupStoreReport, groupWeekdayReport } from "../../frontend/report-model.js";
import { validReportRange } from "../../frontend/reports.js";

const rows=[
 {date:"2026-10-01",storeCode:"F01",storeName:"Centro",dayStatus:"aberto",total:6,recebido:4,naoChegou:1,aguardando:1,naoCompareceu:0,recusado:0,semAgenda:1},
 {date:"2026-10-02",storeCode:"F01",storeName:"Centro",dayStatus:"concluido",total:4,recebido:2,naoChegou:1,aguardando:0,naoCompareceu:1,recusado:0,semAgenda:0}
];
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
describe("Relatório Gerencial",()=>{
 it("consolida status, datas e lojas sem misturar resultados",()=>{
   const s=sumReportRows(rows);
   assert.deepEqual(s,{total:10,recebido:6,naoChegou:2,aguardando:1,naoCompareceu:1,recusado:0,semAgenda:1,agendas:2,abertas:1});
   assert.equal(reportRate(s),60);
   assert.equal(reportRate({total:0,recebido:0}),0);
   assert.equal(groupDailyReport(rows).length,2);
   assert.deepEqual(groupDailyReport(rows).map(x=>[x.aguardando,x.naoCompareceu]),[[1,0],[0,1]]);
   assert.equal(groupStoreReport(rows)[0].aguardando,1);
   assert.equal(groupStoreReport(rows)[0].naoCompareceu,1);
   assert.equal(s.total,s.recebido+s.naoChegou+s.aguardando+s.naoCompareceu+s.recusado);
   assert.equal(groupStoreReport(rows)[0].total,10);
 });
 it("mantém não recebidos separados dos não comparecimentos automáticos e históricos",async()=>{
   const statements=[];
   const db={prepare(sql){const statement={sql,params:[]};statements.push(statement);
     return {bind(...params){statement.params=params;return this;},
       async all(){return {results:[]};},
       async first(){return {total:0};}
     };
   }};
   const response=await adminReportRoutes.request("http://localhost/?start=2026-10-01&end=2026-10-19",{}, {DB:db});
   assert.equal(response.status,200);
   assert.equal(statements.length,2);
   const totals=statements[0].sql;
   assert.ok(totals.includes("AS naoCompareceu"));
   assert.ok(totals.includes("ag.observacao = 'Não compareceu'"));
   assert.ok(totals.includes("a.status_dia = 'concluido'"));
   assert.ok(totals.includes("COALESCE(ag.observacao, '') <> 'Não compareceu'"));
   const ranking=statements[1].sql;
   assert.ok(ranking.includes("COALESCE(ag.observacao, '') <> 'Não compareceu'"));
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
       async all(){if(sql.includes("ag.fornecedor"))return {results:[{supplier:"Teste",total:5,recebido:3,naoChegou:2}]};return {results:[rows[0]]};},
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
   assert.deepEqual(statements[0].params,["2026-10-01","2026-10-19","F01"]);
   assert.ok(statements[0].sql.includes("ag.ativo = 1"));
   assert.match(statements[0].sql,/ag\.status = 'aguardando' AND a\.status_dia = 'aberto'/);
   assert.match(statements[0].sql,/ag\.status = 'aguardando' AND a\.status_dia = 'concluido'/);
   assert.ok(statements[0].sql.includes("ag.observacao = 'Não compareceu'"));
   assert.ok(statements[0].sql.includes("AS naoCompareceu"));
   assert.equal(data.rows[0].naoCompareceu,0);
   assert.match(statements[1].sql,/HAVING naoChegou > 0/);
   assert.match(statements[1].sql,/ag\.status = 'recebido'/);
   assert.equal(data.suppliers[0].total,5);
   assert.equal(data.suppliers[0].recebido,3);
   assert.equal(data.suppliers[0].naoChegou,2);
   const badPage=await fetch("/occurrences?start=2026-10-01&end=2026-10-19&limit=200");
   assert.equal(badPage.status,400);
 });
 it("consulta todas as seções com múltiplas lojas sem concatenar valores no SQL",async()=>{
   const statements=[];
   const db={prepare(sql){const item={sql,params:[]};statements.push(item);
     return{bind(...params){item.params=params;return this;},
       async all(){return {results:[]};},
       async first(){return {total:0};}
     };
   }};
   const base="start=2026-10-01&end=2026-10-19&storeCode=F01&storeCode=F02";
   const fetch=path=>adminReportRoutes.request("http://localhost"+path,{}, {DB:db});
   assert.equal((await fetch("/?"+base)).status,200);
   assert.equal((await fetch("/occurrences?"+base+"&q=Fornecedor")).status,200);
   assert.equal(statements.length,4);
   for(const item of statements){
     assert.ok(item.sql.includes("l.codigo COLLATE NOCASE IN (?,?)"));
     assert.deepEqual(item.params.slice(0,4),["2026-10-01","2026-10-19","F01","F02"]);
   }
   assert.deepEqual(statements[3].params.slice(-4),["%Fornecedor%","%Fornecedor%",50,0]);
   assert.equal((await fetch("/?"+base+"&storeCode=f01")).status,200);
   assert.ok(statements.at(-1).sql.includes("IN (?,?)"));
   assert.deepEqual(statements.at(-1).params.slice(2),["F01","F02"]);
   assert.equal((await fetch("/?"+base+"&storeCode=")).status,400);
   assert.equal((await fetch("/?start=2026-10-01&end=2026-10-19")).status,200);
   assert.ok(!statements.at(-1).sql.includes("l.codigo COLLATE NOCASE IN"));
   assert.deepEqual(statements.at(-1).params,["2026-10-01","2026-10-19"]);
 });
 it("inclui não compareceu de agenda concluída nas ocorrências, sem incluir pendentes de agenda aberta",async()=>{
   const statements=[];
   const exampleRows=[
     {date:"2026-10-18",storeCode:"F01",storeName:"Centro",protocol:"P02",supplier:"Fornecedor B",observation:null,origin:"importado",occurrenceType:"nao_compareceu"},
     {date:"2026-10-17",storeCode:"F01",storeName:"Centro",protocol:"P01",supplier:"Fornecedor A",observation:"Não chegou",origin:"importado",occurrenceType:"nao_recebido"}
   ];
   const db={prepare(sql){const item={sql,params:[]};statements.push(item);
     return{bind(...args){item.params=args;return this;},
       async all(){return {results:exampleRows};},
       async first(){return {total:2};}
     };
   }};
   const response=await adminReportRoutes.request("http://localhost/occurrences?start=2026-10-01&end=2026-10-19&storeCode=F01&limit=2&offset=0",{}, {DB:db});
   assert.equal(response.status,200);
   const data=await response.json();
   assert.equal(data.total,2);
   assert.equal(data.limit,2);
   assert.equal(data.offset,0);
   assert.deepEqual(data.rows.map(row=>row.occurrenceType),["nao_compareceu","nao_recebido"]);
   const filter="AND ag.ativo = 1 AND (ag.status = 'nao_chegou' OR (ag.status = 'aguardando' AND a.status_dia = 'concluido'))";
   assert.equal(statements.length,2);
   for(const item of statements){
     assert.ok(item.sql.includes(filter),"contagem e listagem devem usar o mesmo filtro");
     assert.deepEqual(item.params.slice(0,3),["2026-10-01","2026-10-19","F01"]);
   }
   assert.match(statements[1].sql,/AS occurrenceType/);
   assert.match(statements[1].sql,/AS classificationOrigin/);
   assert.deepEqual(statements[1].params.slice(-2),[2,0]);
 });
 it("agrupa por dia da semana na ordem operacional e conta os dias",()=>{
   const daily=groupDailyReport(rows);
   const weekdays=groupWeekdayReport(daily);
   assert.deepEqual(weekdays.map(w=>w.weekday),[4,5]);
   assert.deepEqual(weekdays.map(w=>w.days),[1,1]);
   assert.deepEqual(weekdays.map(w=>w.total),[6,4]);
   assert.equal(weekdays[0].recebido,4);
   assert.equal(weekdays[1].recebido,2);
 });
 it("busca ocorrências por fornecedor ou protocolo com curingas escapados",async()=>{
   const statements=[];
   const db={prepare(sql){const item={sql,params:[]};statements.push(item);
     return{bind(...args){item.params=args;return this;},
       async all(){return {results:[]};},
       async first(){return {total:0};}
     };
   }};
   const fetch=path=>adminReportRoutes.request("http://localhost"+path,{}, {DB:db});
   const ok=await fetch("/occurrences?start=2026-10-01&end=2026-10-19&q=Teste%20100%25");
   assert.equal(ok.status,200);
   const search=statements.find(item=>item.sql.includes("LIKE"));
   assert.ok(search,"nenhuma consulta com LIKE registrada");
   assert.ok(search.sql.includes("ag.fornecedor LIKE ? ESCAPE '\\'"));
   assert.ok(search.sql.includes("ag.protocolo LIKE ? ESCAPE '\\'"));
   assert.equal(search.params.filter(value=>value==="%Teste 100\\%%").length,2);
   const beforeWithoutSearch=statements.length;
   const withoutSearch=await fetch("/occurrences?start=2026-10-01&end=2026-10-19");
   assert.equal(withoutSearch.status,200);
   assert.equal(statements.slice(beforeWithoutSearch).filter(item=>item.sql.includes("LIKE")).length,0);
   const tooLong=await fetch("/occurrences?start=2026-10-01&end=2026-10-19&q="+("a".repeat(81)));
   assert.equal(tooLong.status,400);
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