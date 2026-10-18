# Migração controlada para JavaScript puro

Início: 18/10/2026

## Objetivo
Migrar a interface e o código do projeto para JavaScript nativo (ES Modules), HTML e CSS, preservando **integralmente** os comportamentos e as regras em produção. Não copiar a branch `preview` diretamente sobre a `main`.

## Branches e fluxo
- `main`: produção atual; referência funcional e operacional. Não alterar sem validação e autorização expressa.
- `preview`: ambiente de homologação com D1 isolado; não afetar dados de produção.
- `migracao-js-puro`: branch **temporária explicitamente solicitada pelo usuário**, criada a partir de `main` no commit `7981580e102d507680b6f956d3f6059bd3a97d0d`. Utilizada para implementar e testar a migração.
- Fluxo para aprovação final: **migracao-js-puro → preview → validar → autorização explícita → main**. Sem publicação automática de `migracao-js-puro` no Worker de produção.

## Limites de segurança
- D1 real da produção, IDs, sessões, credenciais, histórico e registros operacionais devem ser preservados.
- Não executar migrações remotas nem substituir bindings de `main`.
- Comparar alterações de esquema existentes: a `preview` tem a migração `0017_appointment_observation.sql`; a `main` termina em `0016_conferente_presence.sql`. Não levar a versão adicional sem avaliação e autorização.
- Preservar autenticação, permissões por papel, agendamento diário, WebSocket e Durable Object de presença, importação CSV/PDF, relatórios, PDFs, auditoria e regras de recebimento.
- A experiência de atualização deve ser incremental, sem piscar, incluindo listas, status e presença.
- Não remover React, TypeScript e Vite da `main` antes de a versão substituta estar homologada.

## Critérios obrigatórios de validação
- [ ] Inventário completo das funcionalidades da `main` e diferenças da `preview`.
- [ ] Paridade de dados, campos, ordem de colunas, ações, telas, permissões e fluxos.
- [ ] Versão JS puro isolada, sem React/TypeScript/Vite em tempo de execução.
- [ ] Atualização de dados e presença sem recriar a tela inteira.
- [ ] Testes locais de API, parser, autenticação, importação e exportação aprovados.
- [ ] E2E por papel (admin, visualizador, conferente), responsividade e acessibilidade aprovados.
- [ ] CI aprovado e deploy confirmado no Worker de homologação (nunca na produção).
- [ ] Comparação de esquema e dados com D1 isolado, com plano de rollback revisado.
- [ ] Validação visual/funcional pelo usuário e autorização explícita para promover a `main`.

Estado inicial: **branch criada; migração ainda não iniciada**.
