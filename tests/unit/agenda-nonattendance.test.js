import { describe,it } from "node:test";
import assert from "node:assert/strict";
import { changeAgendaDayStatus, listAppointmentHistory } from "../../worker/repositories/agendas.js";
import { closePastOpenAgendas } from "../../worker/services/agenda-maintenance.js";

function fakeDb() {
  const statements=[], batches=[];
  const db={
    prepare(sql){
      const stmt={sql,params:[],
        bind(...values){this.params=values;return this;},
        async first(){
          if(sql.includes("FROM agendas a"))return {
            id:"ag1",loja_id:"store1",status_dia:"concluido",
            store_code:"F01",store_name:"Centro"
          };
          throw Error("Consulta inesperada: "+sql);
        }
      };
      statements.push(stmt);return stmt;
    },
    async batch(batch){batches.push(batch);return batch.map(()=>({meta:{changes:1}}));}
  };
  return {db,statements,batches};
}

describe("Não compareceu automático",()=>{
 it("ao concluir, grava status, motivo e auditoria do sistema em batch único",async()=>{
   const {db,batches}=fakeDb();
   const agenda={id:"ag1",loja_id:"store1",status_dia:"aberto"};
   const result=await changeAgendaDayStatus(db,agenda,"conf1","concluido");
   assert.equal(result.status_dia,"concluido");
   assert.equal(batches.length,1);
   assert.equal(batches[0].length,5);
   const [audit,update,day]=batches[0];
   assert.deepEqual(audit.params.slice(1),["ag1"]);
   assert.match(audit.sql,/nao_compareceu_automaticamente/);
   assert.match(audit.sql,/NULL, 'nao_compareceu_automaticamente'/);
   assert.match(update.sql,/UPDATE agendamentos SET status = 'nao_chegou', observacao = 'Não compareceu'/);
   assert.match(update.sql,/ag\.ativo = 1 AND ag\.status = 'aguardando'/);
   assert.match(update.sql,/status_dia = 'aberto'/);
   assert.match(day.sql,/UPDATE agendas SET status_dia/);
 });
 it("reabrir dia não desfaz o Não compareceu nem gera classificação nova",async()=>{
   const {db,batches}=fakeDb();
   await changeAgendaDayStatus(db,{id:"ag1",loja_id:"store1",status_dia:"concluido"},"admin1","aberto");
   assert.equal(batches.length,1);
   assert.equal(batches[0].length,3);
   assert.ok(batches[0].every(s=>!s.sql.includes("Não compareceu")));
 });
 it("histórico expõe o evento automático pela auditoria, sem usuário humano",async()=>{
   let query="",params=[];
   const db={prepare(sql){query=sql;return{
     bind(...args){params=args;return this;},
     async all(){return{results:[{
       id:"audit-1",agendamento_id:"appt1",usuario_id:null,usuario_nome:"Sistema",
       status_anterior:"aguardando",status_novo:"nao_chegou",
       observacao:"Não compareceu",alterado_em:"2026-10-28T23:00:00Z"
     }]};}
   };}};
   const rows=await listAppointmentHistory(db,"appt1");
   assert.deepEqual(params,["appt1","appt1"]);
   assert.match(query,/FROM historico_status/);
   assert.match(query,/UNION ALL/);
   assert.match(query,/a.acao = 'nao_compareceu_automaticamente'/);
   assert.equal(rows[0].usuario_nome,"Sistema");
   assert.equal(rows[0].usuario_id,null);
   assert.equal(rows[0].observacao,"Não compareceu");
 });
 it("cron classifica somente pendentes de dias elegíveis, sem reprocessar dias reabertos",async()=>{
   const {db,batches}=fakeDb();
   await closePastOpenAgendas(db,new Date("2026-10-29T12:00:00Z"));
   assert.equal(batches.length,1);
   assert.equal(batches[0].length,4);
   const [audit,update,agendaAudit,close]=batches[0];
   assert.match(audit.sql,/status_dia = 'aberto'/);
   assert.match(audit.sql,/<> 'reaberto'/);
   assert.match(update.sql,/ag\.ativo = 1 AND ag\.status = 'aguardando'/);
   assert.match(audit.sql,/nao_compareceu_automaticamente/);
   assert.match(agendaAudit.sql,/dia_concluido_automaticamente/);
   assert.match(close.sql,/UPDATE agendas/);
   assert.equal(audit.params[1],"2026-10-29");
   assert.equal(close.params.at(-1),"2026-10-29");
 });
});
