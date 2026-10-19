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

Dependabot PRs: alvo `preview`, limite 2 por ecossistema, sem auto-merge. **Dependabot Alerts ainda desativados** (API GitHub retorna HTTP 403 com mensagem explícita), exigem ativação em *Settings → Security → Code security and analysis*. CI executa `npm audit --omit=dev` como verificação complementar, mas não substitui os alertas do GitHub.

## Segurança de senha PBKDF2

- `worker/lib/password.js` usa WebCrypto nativa, PBKDF2-HMAC-SHA256, salt aleatório de 16 bytes e hash de 32 bytes. `CURRENT_ITERATIONS=100000`; o parser aceita formatos com 100000 e 600000 iterações.
- O PR #96 passou a proteger migração de hash contra mudança de senha concorrente; revoga sessões após alterações relevantes.
- Este PR adiciona testes de compatibilidade de hashes legados/mais fortes e rejeição de hashes malformados, sem alterar o número atual de iterações.
- Para referência local, executar `npm run benchmark:password`: mede três verificações com cada custo (100k, 600k) **somente no Node da máquina**, sem banco e sem credenciais reais. Não extrapolar diretamente para latência nem limites da Cloudflare.
- **Antes de mudar 100k → 600k:** realizar benchmark controlado em Worker **isolado de homologação**, revisar quotas de CPU e rate-limiter, demonstrar login responsivo e recuperação de sessão, depois migrar progressivamente mantendo hashes antigos funcionais. Não gerar migração D1 apenas para mudar parâmetro codificado no hash.

## Divergência e limpeza do GitHub

Comparação de árvores (caminhos e hashes, **não equivale a comparação de histórico Git**) em 19/10/2026:

- `main` vs `preview`: **133 arquivos diferentes/exclusivos na Preview**, e 128 somente na Main. Preview contém frontend legado em `public/vanilla/`, workflows de migração e configurações diferentes. **Não fazer reset/merge cego da Main na Preview**, pois há dados mockados e deploy separado.
- `migracao-js-puro`: 114 arquivos diferentes/exclusivos em relação à Main, e 127 só na Main. Inclui código sob `migration/frontend/` e documentação antiga hoje arquivada.
- `chore-organizacao-js-puro`: 26 arquivos distintos da Main, e 2 presentes somente na Main. Possui alterações antigas em arquivos que receberam correções posteriores.

**Proposta de limpeza:** confirmar ausência de trabalho exclusivo aproveitável e preservar o histórico via PR/commits e `docs/archive/`; somente então excluir `migracao-js-puro` e `chore-organizacao-js-puro`. Branches temporárias dos PRs #95–#97 também podem ser removidas **após comprovar merge**, mas não eliminar `preview` nem branches Dependabot com PR ativo.

## Pendências e aceite

- [x] Inventário de dependências e caminhos de substituição controlada.
- [x] Auditoria do formato de hashes de senha com testes.
- [x] Mapear divergências principais de branches sem alterações destrutivas.
- [ ] Ativar Dependabot Alerts no GitHub e triar vulnerabilidades reais.
- [ ] Benchmark de PBKDF2 no runtime Cloudflare isolado antes de alterar custo em produção.
- [ ] Medir performance D1 com plano de consulta e dados sintéticos para definir necessidade de paginação.
- [ ] Analisar branches antigas por commits exclusivos antes de qualquer exclusão.
- [ ] Planejar eliminação faseada de bibliotecas externas com equivalência de testes.

Nenhum segredo ou dado de usuário foi consultado e nenhum D1 de produção foi alterado nesta etapa.
