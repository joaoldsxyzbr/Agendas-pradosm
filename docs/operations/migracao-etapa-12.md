# Etapa 12 — seletor de datas e virada diária em JS puro

Branch `migracao-js-puro` · 18/10/2026.

Portados os componentes fundamentais compartilhados pelo dashboard e pelo conferente:
- `migration/frontend/agenda-date-picker.js`, equivalente a `src/agenda/AgendaDatePicker.tsx`, com 42 dias, indicação de mês, seleção, destaque para hoje, mês anterior/próximo e classes CSS existentes.
- `migration/frontend/business-date.js`, equivalente a `src/lib/useBusinessDate.ts`, com calendário `America/Sao_Paulo`, timer de virada do dia, atualização quando a aba volta ao foco e limpeza de listeners.
- `tests/migration/date-picker.test.js`, cobrindo dia 29 de fevereiro, troca de ano, 42 células e virada da data local.

Verificações isoladas passaram na preparação: ano bissexto, mudança dezembro/janeiro, 1000 ms até a virada local e 24h após a meia-noite. Execução Node/E2E no CI permanece pendente, pois o Actions continua falhando.

Não há alteração no visual ou contratos da `main`. Os módulos permanecem desacoplados do entrypoint público até a conclusão das telas do sistema. Nenhum deploy, banco ou branch de produção foi modificado.
