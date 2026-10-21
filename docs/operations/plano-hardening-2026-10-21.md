# Plano de melhorias técnicas — 21/10/2026

Fonte de verdade: repositório `joaoldsxyzbr/Agendas-pradosm`. Baseline: `0593e47dfa4b7a76eb2fab7fa1ebe883b8855404`. Branch inicial: `fix/auditoria-2026-10-21-hardening`.

## Regras
- Nunca usar D1 de produção para testes, nem modificar migrations anteriores ou histórico.
- Manter JavaScript ES Modules, HTML e CSS, preservando PBKDF2 em 100.000 iterações e contratos de login.
- Alterações via PR, gate `verify`, CodeQL, Preview isolado, confirmação separada do deploy da produção.
- O fato de haver CI verde não comprova as telas reais nem integridade completa do D1.

## Entregas
1. **Segurança** — [ ] confirmar política de Origin/Fetch Metadata, criar testes de regressão e verificar rotas por papel (admin, visualizador, conferente).
2. **Agendas e D1** — [ ] validar atomicidade, concorrência, observações, troca de estado, importação CSV/PDF, fechamento diário e trilhas de auditoria com D1 local.
3. **Testes** — [ ] complementar mocks Playwright com cenários Worker + D1 sintético e erros/reconexões; validar falhas previsíveis.
4. **Visual** — [ ] inspecionar no navegador as telas dos perfis, modais, tabelas, responsividade, teclado e contraste sem redesenhar por hipótese.
5. **Desempenho** — [ ] medir baseline de consultas D1, relatórios, tempo de carregamento e PDF antes de otimizar; não remover bibliotecas sem equivalência demonstrada.
6. **Governança** — [ ] conferir regras da main, Dependabot Alerts, proteção de deploy e recuperação D1; padronizar documentação que ainda cita `preview` em vez de `testes`.

## Aceite por etapa
Testes direcionados e integração local verdes, nenhuma migration destrutiva, nenhuma alteração involuntária de dados, CI `verify` e CodeQL aprovados. Confirmar SHA efetivamente publicado e smoke real separadamente. Qualquer falha bloqueia merge e publicação.

## Rastreamento
Este plano não comprova execução das etapas ainda marcadas. Atualizar caixas somente após anexar evidências de comandos, CI/PR e validação.
