# Correção das vulnerabilidades de dependências de desenvolvimento — 20/10/2026

## Diagnóstico

A primeira execução da [Auditoria semanal de segurança](https://github.com/joaoldsxyzbr/Agendas-pradosm/actions/runs/39349541431) identificou **zero alertas nas dependências de produção** e **três ocorrências de severidade alta** reportadas pelo `npm audit --audit-level=high` na cadeia de dependências de desenvolvimento `wrangler → miniflare → sharp`.

O aviso é [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), envolvendo a biblioteca de processamento de imagem `sharp` antes de `0.35.5`. A versão anterior do projeto estava travada em `wrangler 4.144.0`, `miniflare 5.20260926.1-alpha` e `sharp 0.35.4`.

O fato de o `npm audit` apresentar três ocorrências decorre da cadeia transitiva (pacote afetado, Miniflare e Wrangler), **não de três falhas independentes no código do Agendas**. A gravidade é relevante para a ferramenta de desenvolvimento, mas o relatório das dependências do Worker de produção permaneceu verde.

## Correção controlada

- Atualizar o SDK/CLI oficial da Cloudflare: **`wrangler 4.151.2`** (versão exata), somente em `devDependencies`.
- Regenerar `package-lock.json` com npm oficial, `--package-lock-only --ignore-scripts --legacy-peer-deps`, sem executar scripts de terceiros ou `npm audit fix --force`.
- Nova cadeia resolvida no runner: **`miniflare 5.20261019.0-beta`** e **`sharp 0.35.5`**.
- A geração temporária foi feita em um workflow **manual e somente de leitura** na branch, sem token de escrita, D1 remoto ou secrets. Esse workflow temporário foi restaurado ao arquivo original da `main` no mesmo commit que atualizou os arquivos de dependências; não há automação de atualização no código final.

## Verificações exigidas

1. `npm ci --legacy-peer-deps` com lockfile coerente; `npm audit --omit=dev` e `npm audit --audit-level=high` sem vulnerabilidades conhecidas acima dos respectivos limiares.
2. `npm run verify:production` e `npx wrangler deploy --dry-run --config wrangler.jsonc` aprovados.
3. Testes unitários, browser/Playwright, CodeQL e publicação da Cloudflare Preview aprovados antes do merge.
4. Após o merge, confirmar Workers Builds na `main` e executar novamente `Auditoria semanal de seguranca` no GitHub Actions.

A mudança é **somente de ferramentas de build/desenvolvimento**. Não altera contratos de API, autenticação, dados do D1, código do Worker de negócio nem cria dependências de runtime. Caso um check reprove, não integrar à `main`.
