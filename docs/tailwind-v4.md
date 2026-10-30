# Tailwind CSS v4 — adoção incremental na preview

## Motivo
Padronizar novas interfaces sem reescrever a aplicação JavaScript nativa nem alterar Worker, D1 ou autenticação.

## Implementação
- tailwindcss e @tailwindcss/cli são devDependencies na versão exata 4.3.3.
- frontend/styles/tailwind.input.css importa apenas theme e utilities da v4.
- Preflight não é importado: não há reset global de botões, cabeçalhos ou tabelas.
- prefix(tw) gera classes tw:..., separadas dos estilos antigos.
- source(none) e @source "../dashboard.js" restringem a geração ao Recebimento neste primeiro momento.
- npm run build gera dist/frontend/styles/tailwind.css localmente, sem CDN.
- As utilities estão numa camada CSS, preservando a precedência das regras legadas sem camadas.
- Indicadores de Recebimento usam classes para números, rótulos e ícones.

## Expansão
Acrescentar arquivos ao @source conforme a migração de outras telas, removendo CSS antigo apenas após testes.

## Verificações
npm ci --legacy-peer-deps; npm run verify:production; npm run test:e2e.

## Etapa 2: primitivos compartilhados de cadastro
- `frontend/ui/primitives.js` centraliza as classes, independente da logica de negocios.
- `stores.js`, `users.js`, `store-dialog.js` e `user-dialog.js` reutilizam
  `ui-action`, `ui-field`, `ui-table` e `ui-badge`.
- Tailwind compila os primitivos com `@apply` em `tailwind.input.css`,
  preservando cores, bordas e altura dos controles legados.
- As regras estao escopadas em `.prado-admin` e sem Preflight.
- O teste de navegador cobre os dois cadastros, inclusive formulario modal.
