# Diagnóstico do GitHub Actions — migração JS

A pipeline de migração `migracao-js-puro.yml` encerra em aproximadamente 1 segundo, antes de disponibilizar etapas ou logs. O arquivo `runner-diagnostico.yml` foi criado propositalmente **sem checkout, npm, dependências, secrets ou acesso Cloudflare**, contendo somente `echo`.

**Critério objetivo:** se até esse workflow mínimo falhar sem uma etapa registrada, o problema acontece na disponibilidade/permissão do runner do GitHub ou na configuração de Actions da conta/repositório, e **não pode ser resolvido com alterações em JavaScript, Vite, D1 ou Wrangler**.

Quando um runner iniciar normalmente, executar a pipeline principal de migração, seguida de `npm run migracao:e2e` com APIs mockadas e D1 isolado.

Se ambos falharem antes de executar etapas, contatar <https://support.github.com/contact> com IDs dos workflows, IDs dos jobs e a informação de que as tentativas não têm logs, anexando o link `https://github.com/joaoldsxyzbr/Agendas-pradosm/actions`.

Nenhuma mudança na produção, `main`, `preview` ou banco.