# AGENTS.md — Agendas PradoSM

## 1. Objetivo

Este é um sistema empresarial em produção, utilizado diariamente na gestão de agendas de recebimento.

**Prioridades:** segurança dos dados, estabilidade operacional, simplicidade, manutenção e desempenho.

A continuidade da operação é mais importante que a velocidade de implementação.

## 2. Conhecimento do projeto

Antes de realizar alterações:

- Consultar o código atualizado no GitHub.
- Ler `README.md` e `docs/architecture.md`.
- Respeitar a arquitetura, as regras de negócio e os padrões existentes.
- Consultar `docs/operations/production-release.md` em alterações que possam afetar a publicação.
- Consultar `docs/operations/data-recovery.md` em operações de recuperação.

Não presumir que informações de conversas anteriores representem o estado atual do repositório.

## 3. Autonomia técnica

O agente deve assumir as decisões técnicas rotineiras, sem transferir ao usuário escolhas de implementação desnecessárias.

- Selecionar a solução mais simples, segura e sustentável.
- Preservar a arquitetura JavaScript ES Modules, HTML/CSS, Hono, Workers e D1.
- Evitar frameworks, abstrações e dependências desnecessárias.
- Priorizar APIs nativas e dependências oficiais, confiáveis e mantidas.
- Implementar somente o escopo solicitado.
- Não realizar refatorações extensas sem justificativa técnica.
- Preservar compatibilidade com funcionalidades existentes.

## 4. Proteção da produção

A branch `main` corresponde à produção.

- Desenvolver preferencialmente em branches separadas.
- Validar mudanças na homologação ou em ambiente local isolado.
- Não realizar merge na `main` sem autorização explícita.
- Não executar publicações ou operações remotas de produção sem autorização explícita.
- Não modificar segredos, bindings, variáveis operacionais ou configurações de produção sem autorização.
- Considerar que o merge na `main` pode acionar o deploy automático pelo Cloudflare Workers Builds.
- Nunca contornar CI, verificações de segurança ou proteções de branch.

Em caso de dúvida sobre consequências operacionais, preservar o comportamento atual.

## 5. Banco de dados D1

Os dados empresariais devem ser preservados integralmente.

- Nunca executar testes com o D1 de produção.
- Usar banco local sintético ou Preview isolada.
- Nunca editar migrations já aplicadas.
- Preferir migrations aditivas e compatíveis.
- Aplicar expand/contract em mudanças incompatíveis.
- Mudanças destrutivas exigem aprovação e o processo documentado de autorização.
- Preservar históricos, registros de auditoria e relacionamentos.
- Não executar exclusões em massa, restaurações ou alterações manuais remotas sem autorização específica.
- Não substituir dados reais por dados de testes.

## 6. Regras de negócio e segurança

Toda alteração deve preservar:

- Permissões de administrador, visualizador e conferente.
- Autorização efetiva no backend, independentemente da interface.
- Isolamento dos dados e operações entre lojas.
- Integridade de agendas, recebimentos e históricos.
- Validação integral e atomicidade das importações CSV/PDF.
- Tratamento correto da data operacional em `America/Sao_Paulo`.
- Segurança de autenticação, sessões e rate limiting.
- Atualização em tempo real sem comprometer o D1 como fonte da verdade.
- Mecanismos de fallback existentes.

Mudanças nessas regras exigem testes de regressão específicos.

## 7. Qualidade e testes

Antes de entregar uma alteração:

- Executar os testes pertinentes ao código modificado.
- Executar `npm run verify:production` antes de propor um merge para produção.
- Executar `npm run test:e2e` quando a mudança afetar fluxos de navegador.
- Confirmar o sucesso do gate `verify` do CI antes do merge.
- Testar cenários de erro, permissões e casos extremos quando aplicável.
- Corrigir falhas introduzidas pela alteração.
- Nunca ignorar testes falhando ou declarar sucesso sem evidências.

## 8. Segurança e privacidade

- Nunca expor senhas, tokens, segredos ou credenciais.
- Não versionar dados empresariais reais em fixtures ou logs.
- Não introduzir telemetria ou integrações externas desnecessárias.
- Preservar mecanismos de auditoria e observabilidade existentes.
- Validar entradas e permissões no servidor.
- Aplicar o princípio do menor privilégio.

## 9. Entrega e documentação

Para cada alteração, informar objetivamente:

- O que foi modificado.
- Quais testes foram executados e seus resultados.
- Quais riscos e pendências permanecem.
- Se há impacto em banco, segurança ou compatibilidade.
- Se a mudança está apenas na branch, em PR, mesclada ou efetivamente publicada.

Atualizar a documentação técnica quando necessário, sem duplicar informações.

## 10. Incidentes e recuperação

Ao identificar risco de perda de dados, falha crítica ou incompatibilidade:

- Não continuar automaticamente com operações potencialmente destrutivas.
- Preservar evidências sem expor informações sensíveis.
- Seguir os procedimentos documentados de recuperação.
- Diferenciar rollback de aplicação de restauração de dados.
- Exigir autorização para restauração, alteração remota ou intervenção operacional.

**Regra central:** melhorar o sistema sem comprometer a operação da empresa, seus usuários ou seus dados.
