# Campo condicional de observação — 22/10/2026

## Problema
No modal de **Não recebido**, a descrição destinada a **Outros** podia aparecer mesmo ao escolher motivo predefinido. O JavaScript já aplicava `hidden` ao elemento, mas a regra `display:grid` de `.observation-field` podia prevalecer sobre o estilo padrão do atributo.

## Ajuste na branch
- `frontend/styles/conferente-visual.css`: regra pontual no modal para garantir `display:none!important` quando o campo possui `hidden`.
- `tests/browser/observation.spec.js`: regressões desktop e mobile para estado inicial, cinco motivos predefinidos, alternância para **Outros** e retorno a motivo predefinido; confirma envio apenas do motivo selecionado.
- A lista de motivos, regras compartilhadas de validação e fluxo de confirmação **não foram alterados**.

## Contrato funcional
1. Em **Não recebido**, a seleção do motivo continua obrigatória.
2. Os cinco motivos predefinidos permitem confirmar diretamente, sem texto complementar.
3. **Outros** revela a descrição, obrigatória para confirmar.
4. Cancelar não altera dados; confirmar grava o motivo selecionado.
5. Sem migrações de banco e sem alterações no Worker.

## Validação
Executar `npm test` e `npm run test:e2e`; o CI da pull request para `main` cobre os testes de navegador e demais verificações. Verificar o status do CI antes de integrar. Não efetuar deploy a partir desta branch.