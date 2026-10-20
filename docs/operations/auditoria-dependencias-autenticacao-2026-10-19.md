# Auditoria de dependências e autenticação — 19/10/2026

## Contexto e objetivo

Repositório: `joaoldsxyzbr/Agendas-pradosm`, `main` = produção. Referência da issue [#102](https://github.com/joaoldsxyzbr/Agendas-pradosm/issues/102).

Regras atuais: **JavaScript ES Modules, HTML, CSS e SQL nativos**, sem React/TypeScript/Vite. Priorizar APIs nativas e SDKs oficiais. Esta etapa **não adiciona dependências**, não reescreve parsing de PDF, não altera o D1 nem força migração de algoritmos criptográficos.

## Inventário de dependências diretas

| Pacote | Uso identificado | Avaliação/decisão |
|---|---|---|
| `hono` | Rotas HTTP, middlewares, cookies e request/response do Worker | Biblioteca externa, não é API nativa do Cloudflare. Substituição exigiria reescrever roteamento/autenticação e equivalência de testes; **não remover em produção sem migração validada**. |
| `zod` | Schemas de entrada da API e validação de dados | Biblioteca externa. Substituir por verificações próprias apenas com testes de todos os contratos de entrada/erros. |
| `@llamaindex/liteparse-wasm` | Extração de texto de PDFs importados | Componente externo WASM. Manter até validar alternativa segura e equivalente com fixtures reais saneadas, inclusive tabelas/layouts. |
| `chart.js` | Gráfico de Relatório Gerencial, carregado sob demanda | Biblioteca externa apenas no frontend. Gráfico HTML nativo já existe como fallback; avaliar remover com teste de paridade visual, acessibilidade e informação. |
| `lucide-static` | SVGs de ícones, copiados para `dist/vendor` | Biblioteca externa apenas no build. Ícones locais após build, sem CDN; pode-se substituir por SVGs próprios com revisão de licença e aparência, sem perda de acessibilidade. |
| `@playwright/test` | Testes browser/CI; mantido pela Microsoft | Ferramenta de desenvolvimento, não distribuída ao Worker. Manter. |
| `wrangler` | Build/deploy Cloudflare; ferramenta oficial Cloudflare | Manter. |

Versões efetivas devem ser conferidas no `package-lock.json`. Bibliotecas externas existentes são **dívida de conformidade à preferência atual**: não implica vulnerabilidade comprovada, nem autoriza reimplementação rápida de funções críticas. Nenhuma biblioteca nova foi introduzida por esta auditoria.

**Remediação dos alertas do primeiro scan semanal:** veja [correção Wrangler/Miniflare/sharp](correcao-wrangler-sharp-2026-10-20.md). O `npm audit` encontrou avisos altos transitivos de `sharp` na dependência oficial de desenvolvimento `wrangler`; a versão `sharp 0.35.5` resolve o advisory. Atualização e auditoria devem ser validadas pelos gates antes do merge.

Dependabot PRs: alvo `preview`, limite 2 por ecossistema, sem auto-merge. **Dependabot Alerts ainda desativados** (API GitHub retorna HTTP 403 com mensagem explícita), exigem ativação em *Settings → Security → Code security and analysis*. CI executa `npm audit --omit=dev` como verificação complementar. A rotina [`auditoria-seguranca.yml`](../../.github/workflows/auditoria-seguranca.yml) também verifica semanalmente o lockfile da `main`, sem auto-fix; ela **não substitui** o Dependabot Alerts ou revisão de avisos.

## Segurança de senha PBKDF2 — decisão definitiva

**Regra de estabilidade confirmada pelo responsável em 20/10/2026: o custo PBKDF2-HMAC-SHA256 fica fixo em 100.000 iterações. Não aumentar para 600.000 nem qualquer valor superior neste projeto.** Experiências de indisponibilidade em outros projetos motivaram a escolha pela estabilidade do login.

- O `worker/lib/password.js` **já gera** hashes com `CURRENT_ITERATIONS = 100000`; manter esse parâmetro e teste automatizado que exige exatamente `100_000`.
- A verificação de hashes antigos com 600 mil iterações continua **somente por compatibilidade**: remover essa leitura poderia bloquear contas caso existam hashes com esse formato. Isso não autoriza gerar novas senhas com custo superior.
- Não há migração de hash, mudança de senha, benchmark remoto de 600 mil, nem alteração da base D1 como parte da auditoria.
- Testes de compatibilidade de hashes antigos podem continuar validando a leitura, mas os benchmarks operacionais automáticos de Node.js e Workerd foram restritos a **100.000** iterações.
- Em vez de aumentar o custo, preservar limites de tentativa de login, WebCrypto nativa, salt aleatório, sessões assinadas, invalidação de sessão e testes de autorização.
- **Não reabrir sugestão de elevar PBKDF2** sem nova decisão explícita do responsável.

### Diagnóstico com Workerd local

O workflow manual `.github/workflows/runner-diagnostico.yml` usa somente o **Wrangler oficial** em `127.0.0.1` para testar o algoritmo real de verificação, com hashes e senhas sintéticos, sem D1, secrets, autenticação de produção ou endpoint remoto de diagnóstico. O benchmark registra cinco tempos de ida e volta HTTP **com 100 mil iterações**; resultados locais não são quota de CPU Cloudflare.

## Divergência e limpeza do GitHub

Comparação de árvores (caminhos e hashes, **não equivale a comparação de histórico Git**) em 19/10/2026:

- `main` vs `preview`: **133 arquivos diferentes/exclusivos na Preview**, e 128 somente na Main. Preview contém frontend legado em `public/vanilla/`, workflows de migração e configurações diferentes. **Não fazer reset/merge cego da Main na Preview**, pois há dados mockados e deploy separado.
- `migracao-js-puro`: 114 arquivos diferentes/exclusivos em relação à Main, e 127 só na Main. Inclui código sob `migration/frontend/` e documentação antiga hoje arquivada.
- `chore-organizacao-js-puro`: 26 arquivos distintos da Main, e 2 presentes somente na Main. Possui alterações antigas em arquivos que receberam correções posteriores.

**Resultado adicional do histórico** (workflow `runner-diagnostico.yml` em 20/10/2026): `main...preview` tem 91 commits exclusivos da Preview; `main...migracao-js-puro` tem **0 exclusivos** da migração; `main...chore-organizacao-js-puro` tem **145 exclusivos** dessa branch. Os contadores não dizem se os commits já foram integrados por squash ou equivalência de conteúdo. **Preservar `preview` e `chore-organizacao-js-puro` até revisão dos commits**.

**Proposta de limpeza:** `migracao-js-puro` e branches de PRs já mesclados são candidatas a remoção somente depois de confirmar as refs, PRs e ausência de trabalho pendente. O MCP GitHub instalado oferece `list_branches`, mas **não dispõe de ação para excluir refs**; não tentar excluir arquivos da `main` como substituto. As branches Dependabot dos PRs abertos #98–#101 e a `preview` devem ser preservadas.

## Decisão de manutenção das bibliotecas (20/10/2026)

Após examinar os imports, scripts de build, teste `tests/unit/vendor-libs.test.js` e testes browser `tests/browser/reports.spec.js`:

- **Chart.js 4.5.1 e Lucide Static 1.57.0:** o usuário solicitou explicitamente essas bibliotecas para o relatório gerencial e o visual do sistema. Ambas são usadas efetivamente, com arquivos distribuídos **localmente**, sem dependência de CDN em tempo de execução; o relatório já tem fallback HTML nativo. **Mantê-las nesta revisão** é a decisão mais segura para preservar visual e funcionalidades; não eliminar apenas para reduzir o número de dependências. Futuras mudanças exigem autorização específica e paridade de acessibilidade, layout e testes.
- **Hono e Zod:** estão integrados a rotas HTTP, cookies, autorização e validações, incluindo limites de entrada. A implementação caseira dessas peças críticas teria elevado risco de regressão; manter até existir proposta testada com contratos equivalentes.
- **LiteParse WASM:** participa da importação de PDF; a remoção sem motor substituto validado pode interromper importações. Preservar e validar PDF com fixtures saneadas antes de discutir migração.
- **Wrangler e Playwright:** ferramentas oficiais de Cloudflare e Microsoft; manter. Wrangler foi atualizado no PR #108 para corrigir o aviso transitivo do `sharp`.
- **Segurança:** o último `npm audit` completo na `main` retornou zero vulnerabilidades conhecidas após #108. Isso não prova ausência de falhas nem dispensa a auditoria semanal e os alertas Dependabot.

**Status da tarefa:** inventário e decisão de manutenção concluídos; **não há substituição segura imediata que justifique mudar o sistema em produção**. Se for priorizado retirar uma biblioteca futuramente, fazer um PR independente com equivalência funcional e aprovação visual, especialmente para Chart.js/Lucide, que foram solicitadas pelo próprio usuário.

## Pendências e aceite

- [x] Inventário de dependências e caminhos de substituição controlada.
- [x] Auditoria do formato de hashes de senha com testes.
- [x] Mapear divergências principais de branches sem alterações destrutivas.
- [ ] Ativar Dependabot Alerts no GitHub e triar vulnerabilidades reais.
- [x] PBKDF2 travado em 100.000 iterações; aumento e benchmark remoto para elevar custo descartados por decisão do responsável.
- [ ] Medir performance D1 com plano de consulta e dados sintéticos para definir necessidade de paginação.
- [ ] Analisar branches antigas por commits exclusivos antes de qualquer exclusão.
- [x] Definida estratégia por biblioteca: manter as dependências efetivamente utilizadas e aprovadas enquanto não houver alternativa equivalente validada; nenhuma remoção arriscada em produção.

Nenhum segredo ou dado de usuário foi consultado e nenhum D1 de produção foi alterado nesta etapa.