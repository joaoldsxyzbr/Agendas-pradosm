# CI recriado — migração para JavaScript puro

## O que mudou

A pipeline `.github/workflows/migracao-js-puro.yml` foi recriada do zero, permanecendo restrita a `migracao-js-puro`.

1. **Runner** — job sem checkout, Node, npm, secrets ou Cloudflare. Executa apenas `echo` e `uname`. Prova se o executor do GitHub inicia.
2. **Código** — instala dependências, checa Worker/ES Modules, roda os testes JS, constrói HTML/CSS/JS e valida PDF, CSP e bloqueio de deploy produtivo.
3. **Navegador** — instala Chromium e executa Playwright com APIs mockadas e D1 local sintético. Não utiliza dados de produção.

Cada etapa depende da anterior, portanto uma falha no runner fica isolada de erro de código. Os testes legados React/Vite foram retirados **desse CI de migração**, mas continuam disponíveis por `npm run verify:legacy` e no CI de `main`/`preview`. Não foram apagados arquivos ou dependências legadas.

## Como interpretar o resultado

- Falha no job **Runner**, antes de executar o `echo CI_RUNNER_OK`: problema de execução de GitHub Actions (conta, cota, regras do repositório, runner hospedado, incidente do serviço ou outros fatores de plataforma). Refazer YAML não resolve essa categoria.
- Runner verde, falha no job **Código**: ler o passo exato, corrigir scripts, dependências, testes ou build.
- Código verde, falha no job **Navegador**: analisar Playwright, comportamento da interface e artefatos de diagnóstico.

Antes desta recriação, um workflow independente com só `echo` já falhou sem executar passos: [run 39181152356](https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39181152356). Por isso não há garantia de que o CI fique verde após a alteração.

## Segurança

- Nenhum deploy remoto é acionado.
- Nenhuma migração ou gravação em D1 real.
- `main` e `preview` não são modificadas.
- A promoção segue `migracao-js-puro` → `preview` (homologação) → `main` somente após validação e autorização explícita.

Quando um runner estiver operacional, todas as etapas devem passar antes de concluir a migração.
