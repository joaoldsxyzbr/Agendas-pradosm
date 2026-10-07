# Edição administrativa da agenda

Data: 2026-10-07

## Objetivo

Permitir que o administrador ajuste informações operacionais da agenda diretamente no painel administrativo, sem precisar entrar com um usuário conferente.

## Escopo implementado na preview

- Alterar status do agendamento para recebido, não recebido ou voltar para aguardando.
- Alterar a marcação de trocas.
- Editar o nome de fornecedor em registros manuais.
- Usar exclusivamente as rotas administrativas já existentes, preservando a identidade do usuário administrador na auditoria.
- Atualizar os indicadores do dashboard após ajustes.
- Manter a possibilidade de reabrir agendas concluídas para o conferente.

## Segurança e rastreabilidade

A interface administrativa usa `/api/admin/appointments/*`. Não reutiliza as rotas de conferente para gravar alterações, portanto os ajustes continuam vinculados ao usuário ADM autenticado e às rotinas de auditoria existentes.

## Preview

Commit funcional: `c0a553b9b3edd5212b6474bba144884d2be5fb67`.

A promoção para `main` só deve ocorrer após validação funcional da preview e autorização explícita.

## Perfis

- Administrador: edição habilitada.
- Visualizador: permanece estritamente em modo somente leitura, sem controles de alteração.


## Proteção contra alterações acidentais

A tela administrativa abre sempre em modo somente leitura. O administrador precisa acionar explicitamente **Editar agenda** antes que controles de status, trocas, edição de fornecedor, reabertura e inclusão de fornecedor sem agenda fiquem disponíveis. Ao sair do modo edição, os controles de mutação desaparecem novamente.

## Fornecedor sem agenda pelo ADM

No modo edição, o administrador pode adicionar um fornecedor sem agenda diretamente na agenda selecionada. O registro é criado como manual e aguardando, com horário operacional do momento. Em dias já concluídos, a inclusão também gera um evento `ajuste_admin` no histórico do dia, sem reabrir a agenda.

## Implementação atual

Commit do modo edição e inclusão manual: `eddb21f96a4d8251e58267dc4940b2ce2d022d7c`.


## Exclusão de fornecedor sem agenda

No modo edição, o ADM pode excluir fornecedores de origem manual ("Sem agenda"). A ação exige confirmação explícita antes da remoção, usa a rota administrativa existente e mantém o registro de auditoria. Fora do modo edição, o controle de exclusão não é exibido.


## Refinamento visual da agenda administrativa

A visualização de agenda no ADM recebeu uma lapidação visual na preview: modal mais amplo, métricas em cartões compactos, busca e inclusão manual com hierarquia melhor, tabela com maior respiro, coluna de ações dimensionada para os quatro controles e badges de status mais fáceis de escanear. O ajuste é somente visual e não altera regras de negócio.
