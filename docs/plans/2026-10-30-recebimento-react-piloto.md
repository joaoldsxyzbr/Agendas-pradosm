# Recebimento React — piloto operacional (2026-10-30)

## Escopo desta etapa
Rota `/admin` agora renderiza React com os dados da **API existente**, não mais
um placeholder. Permanecem no frontend antigo o restante das telas e funções
ainda não migradas.

### Funcionalidades implementadas
- Consulta real `GET /api/admin/stores`, `GET /api/admin/agendas?date=...`
  e `GET /api/admin/presence` com validação Zod.
- 5 indicadores com cálculo e ordenação equivalentes ao `dashboardModel` legado.
- Seis colunas, tabela compacta, indicadores de progresso e estados.
- Navegação de data e campo date nativo; horário de referência America/Sao_Paulo.
- Consulta `GET /api/admin/agendas/:id` em diálogo React, com pesquisa
  por fornecedor/protocolo; sem conteúdo inserido por innerHTML.
- Administrador e visualizador respeitam a restrição de interface; o Worker
  mantém a autorização efetiva.
- TanStack Query para cache, invalidar ao atualizar, polling das agendas
  e presença a cada 30 segundos e consulta quando a aba volta ao foco.
- Estados de carregamento, erro, ausência de lojas e presença indisponível.
- Layout com indicadores ~76px, linhas ~60px e rolagem horizontal local da tabela.

### Diferenças **intencionais**, ainda não homologadas
- Importação: o botão do piloto é **desativado**, a rota Importação ainda
  está em migração e as importações reais continuam no sistema antigo.
- Diálogo de detalhes: apenas consulta e filtro. Modo edição, reabertura do
  dia, edição de fornecedor e observações permanecem na versão antiga.
- Tempo real: eventos autenticados `agenda.changed`, `presence.changed` e
  `presence.snapshot` por WebSocket com validação Zod, ping/pong e reconexão.
  Mantém consultas periódicas como fallback. Ainda falta homologar a integração
  contra Durable Objects real e os casos concorrentes em D1 local.
- Calendário usa controle nativo de data, em vez do calendário mensal legado.
- Não substitui a aplicação publicada: o build React segue em `dist-modern/`
  e o Worker antigo mantém `dist/`.

### Matriz mínima automatizada
- Admin: cinco KPI, seis colunas, dados, ordem, pendências, data, detalhes,
  pesquisa, erro/retry, botão de importação inativo.
- Visualizador: mesmas consultas e acesso sem recursos de mutação.
- Celular: rolagem interna sem aumentar largura do documento.
- As rotas e o CI do frontend anterior também devem continuar verdes.

### Próximas implementações
1. Completar o diálogo de agenda (edição, reabertura, fornecedores manuais,
   observações) com testes de permissão e auditoria.
2. Migrar importação CSV/PDF sem alterar parsers nem API.
3. Homologar WebSocket e reconexão contra Worker local e Durable Objects,
   validando atualizações simultâneas em cenários reais de D1 de teste.
4. Capturar screenshots e aprovar visualmente as larguras homologadas.
5. Promover apenas quando a paridade funcional for completa.

### Regressões corrigidas após o primeiro CI
- Contrato /api/auth/me sem campo login obrigatório, como no Worker real.
- Diálogo HTML nativo compatível com StrictMode; não deve desaparecer com
  o evento de fechamento gerado por desmontagem simulada.
- Header e tabela contidos no viewport móvel, com rolagem isolada.
- Testes automatizados de realtime ligado e desligado, com eventos sintéticos
  válidos e inválidos, sem alterar Worker/D1 reais.
