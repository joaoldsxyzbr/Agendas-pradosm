// Protege o sistema produtivo de um deploy acidental da branch de migração.
// O fluxo autorizado exige homologação isolada e aprovação explícita.
console.error("Deploy bloqueado: a branch migracao-js-puro é exclusivamente para desenvolvimento local.");
console.error("Valide os testes no D1 isolado e homologue na preview antes de pedir promoção à main.");
process.exitCode = 1;
