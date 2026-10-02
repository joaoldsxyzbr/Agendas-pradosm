# Incidente: dia do conferente aparentando concluir sozinho

Data: 02/10/2026

## Relato

Um conferente informou que o dia atual estava aparecendo como concluído sem ação manual.

## Evidências

A consulta somente leitura no D1 de produção mostrou que as agendas de 02/10/2026 estavam com `status_dia = 'aberto'`, sem `concluido_em` e sem `concluido_por`.

Os eventos automáticos registrados às 03:05:04 UTC (00:05:04 em `America/Sao_Paulo`) em 02/10/2026 atingiram agendas de 01/10/2026. A rotina automática manteve a regra de concluir somente datas anteriores ao dia operacional atual.

## Causa

A tela `TodayPage` capturava `businessDate()` apenas na montagem. Se a aplicação permanecesse aberta durante a virada da data, a interface podia continuar tratando o dia anterior como "Hoje". Quando o backend concluía automaticamente o dia anterior, a tela podia aparentar que o dia atual havia sido concluído sozinho.

## Correção

- a data operacional da tela passa a ser atualizável;
- a interface sincroniza a virada da data em `America/Sao_Paulo`;
- a sincronização também ocorre quando a janela recebe foco ou a aba volta a ficar visível;
- se o conferente estava no antigo "Hoje", a seleção acompanha o novo dia;
- uma data consultada manualmente continua preservada;
- teste de regressão cobre a virada da data sem remontar a tela.

## Validação

A correção foi implementada primeiro na branch `preview`, no commit `07e023a155d56fd8a4b1daa0767b3fbb11a9e8cd`.

O Workers Build da preview executou `npm run verify:production` e terminou com `build_outcome = success` antes da promoção para produção.
