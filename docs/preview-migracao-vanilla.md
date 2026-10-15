# Migração da preview: JavaScript puro + HTML + CSS + Cloudflare D1

**Status:** fase A iniciada: protótipo visual estático em HTML/CSS/JavaScript criado; migração funcional e integração ao D1 ainda pendentes.
**Escopo:** exclusivamente a branch `preview` de `joaoldsxyzbr/Agendas-pradosm`.
**Produção:** `main` não pode ser alterada sem validação na preview e autorização expressa.

## Decisão de stack (15/10/2026)

- **Interface:** HTML sem JSX, CSS nativo e módulos JavaScript (ES Modules), sem React e sem Vite.
- **Backend:** JavaScript nativo em Cloudflare Workers para APIs autenticadas, validação e acesso ao D1.
- **Persistência:** Cloudflare D1 e SQL. Nunca usar banco de produção nos testes.
- **Ferramentas:** Wrangler é ferramenta de publicação e administração do Worker, não framework de interface. Node.js pode executar verificações locais, mas não é servidor de produção.
- **Não utilizar:** TypeScript, React, Vite, Python ou C# sem necessidade. Python e C# continuam permitidos pela preferência geral, mas não são necessários nesta migração.
- Manter dependências apenas quando comprovadamente necessárias (p. ex., leitura de PDF); não criar serviços ou runtimes extras para usar linguagens.
- A branch poderá conter implementação antiga **durante a transição**, mas o resultado final deve ser executado somente com a nova stack. Nunca declarar a migração concluída enquanto JSX, React, Vite ou TypeScript continuarem necessários para executar, testar ou publicar a aplicação.

## Funcionalidades obrigatórias

1. Login, sessões seguras, encerramento de sessão, papéis admin/visualizador/conferente e isolamento por loja.
2. Dashboard administrativo, presença e eventos de atualização em tempo real, troca de data, reabertura e conclusão de agenda.
3. Importação CSV/PDF de agendas, fornecedores manuais, ajustes administrativos, histórico e auditoria.
4. **Observações do conferente:** ao selecionar `Não recebido`, exigir motivo de até 240 caracteres; exibir coluna `Obs.`, permitir edição do motivo, preservar auditoria, limpar motivo corrente ao voltar ao status diferente, não inventar motivos. Administrador em modo de edição segue a mesma regra. Preservar alternância do status ao clicar novamente.
5. **Relatórios Gerenciais:** acesso somente leitura a admin e visualizador (não conferente), filtro de datas inclusivo (até 93 dias) e por loja, comparação com período anterior de igual duração, indicadores e tabelas por data e loja, ranking de fornecedores não recebidos, ocorrências com motivo e exportação CSV segura para planilhas.
6. PDF da agenda, inclusive texto longo de fornecedores/observações quando aplicável.
7. Responsividade em desktop e celular; interface operacional rápida para conferente.

## Diretrizes de visual empresarial

- Padrão visual único entre administrador, visualizador e conferente, com tema escuro como padrão e contraste acessível.
- Navegação enxuta, hierarquia tipográfica nítida, espaçamento consistente, alinhamentos de tabelas e controles, densidade adequada à operação.
- Filtros acessíveis, indicadores explicativos, estados de carregamento/erro/vazio, retorno visível ao salvar, diálogos claros e confirmação apenas para ações de risco.
- Não sacrificar legibilidade em telas pequenas e não usar cores como único sinal de status.
- Testar visual com dados **mockados e isolados da produção**.

## Plano de entrega e critérios de aceite

### Fase A — Base da nova aplicação (preview)
- Criar entrada HTML, CSS corporativo e módulos JavaScript sem React/Vite.
- Reproduzir layout e navegação com mocks de preview; preservar contrato dos endpoints.
- Manter tudo isolado da produção.

### Fase B — Backend e integrações
- Portar APIs e regras atuais de TypeScript para JavaScript sem regressão de autenticação, permissões, importação, transações, auditoria e realtime.
- Preservar o esquema D1; migration nova somente aditiva, aplicada **apenas no D1 de preview** depois de validação.
- Não copiar nem expor dados reais na preview.

### Fase C — Funcionalidades e acabamento
- Portar operações dos perfis e fluxos de importação, PDF, histórico, administração e agenda.
- Restaurar observações e relatórios a partir das implementações do histórico Git **como referência**, sem sobrescrever correções mais recentes da main.
- Unificar visual profissional e cobertura mobile.

### Fase D — Qualidade e publicação de teste
- Verificar ausência de dependência de React/Vite/TypeScript no código executado.
- Testes unitários, de API, autenticação/permissões, isolamento D1, E2E e acessibilidade.
- CI obrigatório verde, deploy da preview confirmado, smoke de todos os perfis, importação, alterações de status, motivos, PDF e relatórios.
- Somente após validação do usuário preparar promoção da preview para a main. **Não promover automaticamente**.

## Riscos e medidas

- **Reescrita ampla:** migrar por módulos para evitar perder funcionalidades e regressões.
- **Segurança:** autorização sempre no Worker; nenhuma decisão sensível somente no navegador; inputs validados no servidor; consultas parametrizadas.
- **Dados:** manter D1 como fonte da verdade; evitar migrations destrutivas e jamais apontar preview ao D1 de produção.
- **Deploy:** não substituir o fluxo atual até existir um novo caminho testado e reproduzível.
- **CI:** atualizar os testes junto com cada módulo portado, sem desativar verificações para forçar aprovação.

## Entrega inicial da fase A (15/10/2026)

- Interface empresarial com modo escuro, navegação lateral e responsiva, áreas Recebimento, Relatórios, Conferente, Lojas e Usuários, em `public/vanilla/index.html`, `public/vanilla/styles.css` e `public/vanilla/app.js`.
- Prévia isolada: informações fictícias em memória, sem consultas ou gravações no D1, sem React, JSX ou Vite no protótipo.
- Fluxo demonstrativo do conferente para alterar status, exigir/editar observação e retornar a Aguardando; relatórios demonstrativos, filtros e CSV local.
- Testes de sintaxe adicionados ao CI e testes E2E da prévia em `tests/e2e/vanilla.spec.js`.
- **Atenção:** a aplicação principal, o build e o backend ainda utilizam a stack anterior até a conclusão das fases B–D. O protótipo não substitui as telas reais, nem demonstra funcionamento com o banco. Não promover a main.

## Situação verificada

Na branch inicial da migração (sincronizada com `main` no commit `7981580e`), a aplicação ainda usa React, TypeScript, Vite, Hono/Workers e D1. No histórico de `preview`, commit `5c2df5e`, há implementações prévias das observações e relatórios que servirão como referência. Este documento **não equivale a implementação nem validação**.

## Isolamento Cloudflare do Worker dedicado (15/10/2026)

- Novo Worker: `agendas-pradosm-preview`; branch de publicação: `preview`; raiz do GitHub: `/`.
- Banco exclusivo: D1 `agendas-pradosm-preview` (ID `716cc88e-7da8-400e-b4be-edc4be0c9c03`). Checagem inicial confirmou esquema vazio; deve receber migrações **somente nele**, antes dos testes funcionais.
- `wrangler.jsonc` da branch `preview` aponta o Worker e o banco para recursos isolados, sem cron e com realtime desativado.
- Rate limiter com namespace `2026100101`, sem compartilhar namespace da produção.
- Para publicar, o Worker precisa de segredo `SESSION_SECRET` próprio e forte, cadastrado como segredo Cloudflare (jamais versionado).
- Fluxo esperado de build: `npm run verify:production` (gate de código legado até a migração concluída); deploy: `npm run deploy:cloudflare` (verifica migrações e publica).
- O script de verificação local `scripts/check-deploy-flow.mjs` valida que a configuração de **preview** não aponta para produção.
- Os comandos atuais de build (Vite/TypeScript) são temporários, até a migração para JS puro; não declarar a stack final concluída.

## Login rápido de testes (15/10/2026)

- Somente o Worker `agendas-pradosm-preview` habilita `PREVIEW_DEMO_LOGIN=on` e `PREVIEW_DEPLOYMENT=agendas-pradosm-preview`.
- A tela `/login` verifica `GET /api/auth/demo-status` e mostra três acessos rápidos: Administrador, Visualizador e Conferente.
- `POST /api/auth/demo-login` valida a origem, impõe limite de tentativas e usa as sessões existentes; não recebe senha de demonstração nem aceita escolha arbitrária de usuário.
- Dados são fictícios e ficam no D1 exclusivo de preview. O script versionado `scripts/seed-preview-demo.sql` cria apenas as três contas fictícias e uma loja com uma agenda de exemplo do dia; pode ser reaplicado.
- Credenciais de senha dessas contas são inválidas por projeto; somente o endpoint de demonstração restrito ao Worker de preview permite acessá-las.
- A `main` não possui essas variáveis, portanto não habilita o acesso rápido mesmo se o código for posteriormente revisado para promoção. Não promover sem remover/verificar o recurso conforme política.
- A implementação no login React/TypeScript é **temporária** enquanto o restante da interface ainda não foi migrado para JavaScript puro. O acesso rápido deve ser portado para o login HTML/JS definitivo.

## Testes da interface nativa (15/10/2026)

- A rota de testes `/vanilla/live.html` usa módulos JS, HTML e CSS e conversa com a API do Worker e o D1 isolado.
- `tests/e2e/native-ui.spec.js` cobre login rápido dos três perfis, relatórios, acesso do visualizador e conferência.
- A rota principal `/login` e o build legado ainda dependem de React/Vite/TypeScript até a migração final. Não publicar o novo shell como padrão antes da aprovação de todos os fluxos E2E.
