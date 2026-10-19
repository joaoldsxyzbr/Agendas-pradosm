# Candidato de produção — sem publicação

Workflow manual `production-candidate.yml`: prepara em `.release-candidate/` uma cópia do frontend HTML/CSS/JS da `preview` e gera `wrangler.production-candidate.jsonc`, usando a configuração real lida de `origin/main:wrangler.jsonc` **sem alterá-la**.

Guardrails: Worker prod preservado, D1 distinto da preview, cron de fechamento preservado, realtime ligado, ausência de flags de login demo e remoção de etiquetas de testes no HTML/JS. A migration `0017_appointment_observation.sql` é validada quanto ao conteúdo aditivo. Executa apenas `wrangler deploy --dry-run`, sem tocar em Worker/D1 remoto.

**Isto é um teste de empacotamento, não é deploy.** Antes de promover à `main`, requer backup da produção, verificação de esquema D1, validação visual do candidato e estratégia de rollback. Nunca fazer merge direto de `preview` porque `wrangler.jsonc` contém o D1 isolado. PR #91 permanece draft.
