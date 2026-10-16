# Arquitetura e organização do repositório

Este documento registra a organização atual de `joaoldsxyzbr/Agendas-pradosm`, adotando o mesmo princípio usado no projeto **Assistente MCPs**: pastas por responsabilidade visíveis na raiz, código separado da documentação e arquivos de configuração mantidos onde as ferramentas esperam encontrá-los.

## Estrutura

| Diretório | Responsabilidade |
| --- | --- |
| `public/` | Interface servida pelo Worker: `index.html`, `vanilla/live.js`, `vanilla/styles.css`, assets e módulos JS de navegador |
| `worker/` | Servidor Cloudflare, rotas da API, autenticação, serviços, repositórios e realtime |
| `src/` | Fontes de importação e exportação de agendas, incluindo a entrada para preparação do extrator PDF |
| `shared/` | Funções e contratos de domínio reutilizados pelo backend e módulos do projeto |
| `migrations/` | Migrações versionadas e aprovações de mudanças no banco Cloudflare D1 |
| `tests/` | Testes unitários, de integração, de interface, E2E, fixtures e preparação |
| `scripts/` | Scripts auxiliares, validação, manutenção e preparação de recursos |
| `docs/` | Arquitetura, guia operacional, decisões, especificações e procedimentos |
| `.github/` | GitHub Actions e automações do repositório |

`public/` é a entrada que o usuário abre. O Worker responde pelas APIs e pelo acesso ao D1. `src/` não é um segundo frontend: guarda fontes auxiliares do processo de importação/exportação. `scripts/build-pdf-preview.mjs` prepara `src/import/extractPdfText.js` para `public/vanilla/extractPdfText.js` usando esbuild, apenas para o recurso de PDF. `shared/` é reservado a lógica e contratos reutilizáveis: não deve virar outro local para páginas.

## Arquivos mantidos na raiz

- `README.md` — apresentação resumida, comandos e navegação pela documentação.
- `package.json` e `package-lock.json` — instalação reproduzível e scripts npm.
- `wrangler.jsonc` — configuração principal de Cloudflare Workers, assets e D1 de testes na `preview`.
- `wrangler.preview-migrations.jsonc` — configuração específica do fluxo de migrações da preview.
- `playwright.config.js`, `vitest.config.js` e `vitest.parser.config.js` — configurações resolvidas pelos runners e pelos comandos atuais.
- `.gitignore` — arquivos locais e artefatos que não devem ser versionados.

Esses arquivos não são "bagunça": movê-los exigiria atualizar chamadas CLI, caminhos relativos, workflows e documentação, criando risco sem ganho funcional.

## Convenções de organização

1. Mantenha cada módulo no diretório correspondente à sua responsabilidade. Evite criar `app/`, `frontend/` ou `backend/` paralelos enquanto `public/` e `worker/` cumprirem essas funções.
2. Não adicione React, Vite como empacotador da aplicação ou TypeScript. A UI usa **HTML, CSS e JavaScript puro (ES Modules)**. Hono, Zod e ferramentas auxiliares continuam permitidos quando úteis.
3. Não duplique módulos entre `src/` e `public/vanilla/` sem um motivo explícito no processo de build. A preparação do PDF é um caso documentado; importações e caminhos existentes devem ser verificados antes de qualquer consolidação.
4. Histórico e decisões duráveis ficam em `docs/`. Evite arquivos soltos, backups, diagnósticos e documentação temporária na raiz.
5. Arquivo aparentemente vazio ou antigo não deve ser excluído sem conferir referências e testes.
6. Evite reorganizar pastas por aparência. Priorize previsibilidade e facilidade de manutenção.

## Ambientes e fluxo de mudanças

Apenas duas branches são permitidas:

- `preview`: implementação e validação com D1 isolado e dados fictícios.
- `main`: produção, com dados reais.

Fluxo obrigatório: **preview → validar → main**. A `main` só muda após validação e autorização explícita do usuário. Um commit no GitHub, o CI e o deploy do Cloudflare são estados independentes: não confundir arquivo salvo com código publicado.

## Guias relacionados

- [Guia operacional](GUIA-OPERACIONAL.md) — funcionamento, perfis, importação, D1, segurança, operações e testes
- [Migração para JavaScript puro](preview-migracao-vanilla.md)
- [Direção visual da preview](preview-acabamento-visual.md)
- [Release de produção](operations/production-release.md)
- [Recuperação do D1](operations/data-recovery.md)

**Alteração documental nesta etapa:** as responsabilidades foram centralizadas e o README foi simplificado; os diretórios e os caminhos técnicos foram mantidos. Não equivale a uma migração física das pastas nem à eliminação de arquivos ainda não verificados.
