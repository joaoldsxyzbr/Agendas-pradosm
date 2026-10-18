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


## Recuperação de funções das agendas — 16/10/2026

- Conferente: pesquisa por fornecedor/protocolo, atalho `Hoje`, detalhes do agendamento com horário, itens, volumes, paletes, NF-e, pedidos e histórico de status.
- Popup administrativo da agenda: pesquisa por fornecedor/protocolo, detalhes consultáveis mesmo sem modo editar, histórico individual de status e histórico do dia (apenas administrador).
- Os dados são carregados pelas APIs existentes `/api/store/appointments/:id`, `/api/admin/appointments/:id/history` e `/api/admin/agendas/:id/history`. Visualizador mantém acesso somente às informações permitidas; nenhuma permissão foi ampliada.
- Pesquisa filtra apenas os itens visíveis, preservando a agenda real e os controles. Fluxos existentes de status/fornecedores continuam com as rotas já usadas.
- Sem React, TypeScript nem build frontend; sem alterações no Worker, D1 e `main`. Rodar bateria completa somente na validação final.


## Ajustes finais de paridade — 16/10/2026

- O painel Recebimento também tem navegação por dia anterior/próximo e retorno rápido para Hoje, mantendo o filtro de loja.
- A edição de loja recuperou a exclusão controlada do cadastro, usando `DELETE /api/admin/stores/:id`, que preserva registros e bloqueia a operação enquanto há usuários vinculados.
- Na agenda concluída, o administrador pode entrar em **Modo editar** e ajustar status inclusive recusado, com motivo obrigatório para não recebido. A API atual registra as alterações para auditoria. Essa possibilidade substitui a necessidade de recriar a antiga aba de Histórico.
- UI segue HTML, CSS e JS puro; nenhuma alteração em `main`, D1 ou backend.

- O seletor avançado de status da agenda concluída é exclusivo do administrador; o conferente mantém os botões operacionais de recebimento e não recebimento.

## Bibliotecas selecionadas para a preview — 16/10/2026

- **Chart.js 4.5.1 (MIT):** visualização interativa empilhada da evolução diária nos Relatórios, usando dados e agrupamentos já existentes. Gráfico HTML/CSS permanece como fallback e para impressão; tabelas de dados continuam disponíveis.
- **Lucide Static 1.57.0 (ISC):** cinco SVGs oficiais na navegação, um para cada tela, sem carregar a coleção completa no navegador.
- **Versões e distribuição:** `package.json` e `package-lock.json` fixam exatamente os dois pacotes e verificam integridade SHA-512. `scripts/build-vendor.mjs` copia Chart.js UMD, SVGs e licenças de `node_modules` para `public/vanilla/vendor/` no `npm ci` (`prepare`) e no `npm run build`. A pasta gerada é ignorada pelo Git; a publicação exige execução correta da instalação. Nenhum CDN é solicitado pelo navegador.
- **Não adotadas agora:** Tabulator (tabelas nativas já suficientes), Papa Parse (parsing CSV empresarial próprio e validado; migrar sem comparar fixtures reais pode alterar agendas). Manter Hono, Zod, LiteParse WASM e JavaScript nativo.
- **Segurança:** sem mudança de Worker, D1, migrations nem `main`. Confirmar build, navegador e deploy antes de autorizar produção; não confundir commit com publicação.

## Cópia isolada do D1 de produção para validações — 16/10/2026

Foi criado um terceiro banco D1, **`agendas-pradosm-preview-copia`**, a partir de leituras da produção, com pseudonimização seletiva de dados sensíveis. O D1 real e o D1 mock atual da `preview` continuam intactos. Nenhuma variável do Worker ou vínculo do D1 foi alterado.

- Banco de produção: `agendas-pradosm` (somente origem de leitura).
- Banco mock da preview: `agendas-pradosm-preview` (continua ligado ao Worker e não foi substituído).
- Banco da cópia: `agendas-pradosm-preview-copia` (banco independente, **não vinculado à aplicação** nesta etapa).
- Procedimentos, diferenças e validações: [Operação da cópia isolada do D1](operations/preview-d1-copia.md).

Promover ou ligar o Worker `preview` ao banco copiado exige testar autenticação de demonstração, validar os dados e garantir que só há escrita na cópia. O banco da produção jamais deve ser vinculado ao Worker de testes.

## D1 de dados operacionais de teste — 16/10/2026

A branch `preview` passou a configurar o D1 `agendas-pradosm-preview-copia` (`6b2c7fec-5fbf-4db7-a0c4-d51860799c29`), cópia pseudonimizada do banco produtivo. O D1 mock anterior foi preservado; a branch `main` e seu banco real não foram modificados. Três contas exclusivas de demonstração permitem acesso rápido com os papéis admin, visualizador e conferente.

Detalhes, verificação de integridade, reverter binding e cuidados com a publicação: [Cópia D1 da preview](operations/preview-d1-copia.md). Configuração no GitHub e publicação efetiva na Cloudflare devem ser validadas separadamente.
## Paridade de ordem operacional entre main e preview — 18/10/2026

A reconstrução da interface em JavaScript puro deve preservar a **ordem dos campos e o agrupamento operacional** do sistema em produção, independentemente da evolução visual:

- **Recebimento (admin e visualizador):** Presença → Loja → Agenda → Andamento (recebidos/total) → Pendências (aguardando, não recebidos, recusados e fornecedores sem agenda) → Situação → Ações. Os indicadores resumidos seguem visíveis nos cartões.
- **Usuários:** Nome → Login → Loja → Perfil → Situação → Ação.
- **Agenda do conferente e popup administrativo:** Horário → Fornecedor → Protocolo → Tipo → Status → Ações → Trocas. A coluna adicional **Observações**, necessária à preview, continua ao final; também permanece disponível nos detalhes.
- **Lojas:** Código → Nome → Situação → Ação (já coincidia com a main).
- **Sequência das agendas:** horário inicial crescente, desempate por protocolo, como ordem inicial na `main`.

Testes E2E da branch `preview` passaram a conferir cabeçalhos e ordem nessas telas. As APIs, Worker, D1 e a branch `main` não são alterados. Exigir build/CI aprovados e validação visual antes de considerar a paridade concluída para publicação.
## Atualização da UI sem piscar — 18/10/2026

A `preview` passou a consultar as mesmas rotas de leitura em segundo plano a cada 30 segundos (fallback quando o WebSocket está desligado). `public/vanilla/features/auto-refresh.js` compara as respostas das consultas usadas pela tela atual e **somente re-renderiza quando os dados realmente mudam**. Uma consulta sem mudanças mantém o DOM, o scroll, o foco e a tela, sem exibir novamente `Carregando informações…`.

O processo ignora períodos em que há modal aberto, operação pendente, aba oculta, formulário de relatório alterado sem aplicar ou um campo de entrada ativo. Falhas de conexão deixam a visualização atual intacta. O login deixou de disparar simultaneamente `hashchange` e `navigate`. O gráfico gerencial só é destruído no momento da substituição real de conteúdo. Cobertura do comparador adicionada em `tests/ui/auto-refresh.test.js`, executada por `vitest.parser.config.js`.

A atualização em segundo plano continua podendo substituir a parte principal da tela quando houve efetiva mudança de dados; melhorias incrementais de DOM podem ser feitas futuramente se uma mudança real ainda produzir sensação de salto. Branch `main` e D1 de produção não foram modificados. CI e publicação Cloudflare devem ser validados antes de considerar o ajuste disponível no site.
