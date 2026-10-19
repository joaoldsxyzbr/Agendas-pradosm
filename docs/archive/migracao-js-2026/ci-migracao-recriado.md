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

## Execução confirmada após a recriação — 19/10/2026

CI novo: <https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39230300933> (commit `051a14195296458b13ad3a554f24b9ce44a8d9f6`).

Resultado observado:
- Job **1 — Verificar executor GitHub**: falhou, de 09:28:17 UTC a 09:28:19 UTC.
- Job **2 — Validar backend, frontend e build JS**: ignorado por dependência do job 1.
- Job **3 — Validar fluxos reais com APIs mockadas**: ignorado por dependência do job 1.
- Tentativa de baixar logs do job 1 pela API: HTTP 404.

Conclusão: mesmo após reconstrução integral do YAML e mudança para o runner `ubuntu-24.04`, a falha persiste **antes de qualquer passo do pipeline**. Não há falha confirmada de Node, npm, JS, D1 ou navegador; tampouco há CI verde.

**Ação necessária para liberar execução:** verificar as permissões e políticas de Actions do repositório (Settings → Actions → General), o status de cobrança/cota e eventuais restrições da conta/organização. Se não houver restrição aparente, abrir chamado com o suporte do GitHub, anexando os links deste run e do controle mínimo `39181152356`. A mensagem de erro da plataforma/conta, quando disponível, é necessária para identificar a causa definitiva.

A `main`, a `preview` e a produção permanecem intactas.