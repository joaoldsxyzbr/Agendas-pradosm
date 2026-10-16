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

## Organização da interface na `preview` — 16/10/2026

```text
public/
  index.html                     Entrada HTML
  vanilla/
    live.js                      Sessão, login, navegação, realtime
    pages/
      recebimento.js             Tela de Recebimento
      conferente.js              Tela do Conferente
      lojas.js                   Tela de Lojas
      usuarios.js                Tela de Usuários
      relatorios.js              Tela de Relatórios
    features/
      agenda.js                  Popup de agenda, status e fornecedores
      importacao.js              Popup de importação CSV/PDF
    reports.js                   Cálculos dos relatórios
    parseAgendaBatch.js          Importador CSV/lotes
    parseAgendaText.js           Importador PDF/texto
    extractPdfText.js            Extrator gerado de PDF
    exportAgendaPdf.js           PDF da agenda
    styles.css                   Estilos compartilhados
    styles/
      recebimento.css            Refinamentos de Recebimento
      relatorios.css             Gráficos e tabelas de Relatórios
```

Cada página deve ser alterada preferencialmente em `pages/`, e cada fluxo compartilhado em `features/`. Todos os módulos são **ES modules nativos** e os três CSS são carregados na ordem original de cascata (base, recebimento, relatórios). `src/` contém fontes necessárias ao build do PDF; não se deve apagar arquivos gerados ou workflows sem verificar referências.

A tela antiga de Histórico, que já havia sido removida do menu, saiu do **código ativo**. Os dados históricos no D1 permanecem intactos. Não foi possível excluir fisicamente workflows legados via MCP GitHub atual (sem operação de exclusão).

Correções: datas sem agenda não derrubam o conferente; resposta atrasada não substitui navegação nova; presença HTTP funciona com realtime desligado; filtros são zerados ao retornar ao login; atualização automática respeita filtros do relatório em edição.

Nenhuma alteração em `main`, Worker, D1 ou migrations. CI, publicação e testes completos continuam para a finalização.

## Recuperação de recursos de cadastros — 16/10/2026

- Lojas: busca por código/nome e filtro por situação, com contagem filtrada.
- Usuários: busca por nome/login/loja, filtros por perfil e situação.
- Auditoria no próprio modal de edição de lojas/usuários, usando a API já existente `/api/admin/audit`, com carregamento sob demanda.
- Os filtros são mantidos na sessão e resetados ao sair. Código reutilizável em `public/vanilla/features/filtros.js` e `features/auditoria.js`.
- CSS compartilhado desses controles em `public/vanilla/styles/funcionalidades.css`.
- `main`, Worker e D1 não alterados; validação final completa será realizada quando a versão estiver pronta.
