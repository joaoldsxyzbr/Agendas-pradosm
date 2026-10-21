# Recebimento ADM — correção visual baseada na captura (20/10/2026)

## Problema observado no Preview
Captura real da tela com manchas/colunas azuis e cinzas, efeito de tabela recortada no lado direito, células fixas sobrepostas e baixa hierarquia dos dados. A cascata antiga combinava colunas *sticky* de Presença/Loja, larguras de sete colunas herdadas, `background:inherit` e uma tabela com largura mínima maior que parte das telas.

## Correção exclusivamente em `testes`
- Substituídas sete colunas por seis: Loja (incluindo situação de importação da agenda), Conferente, Recebimentos, Pendências, Situação e Ações.
- Nenhuma informação de negócio eliminada: detalhes da importação ficam no campo Loja; as cinco contagens permanecem; presença, dados da agenda e ação de abrir continuam.
- Progresso com número e barra HTML nativa `progress`, calculada com limites numéricos seguros; cores semânticas discretas.
- Eliminação do `sticky` azul dos dois primeiros campos; todas as células da mesma linha usam superfície grafite uniforme, com linhas alternadas e realce somente no hover.
- Larguras coerentes e rolagem **dentro da tabela** no mobile, não da página.
- Mudança em JS puro + CSS existente, nenhum SDK/dependência nova, nenhuma alteração de API/SQL/D1.
- Testes Playwright com dez lojas mockadas, incluindo loja sem agenda, layout desktop sem overflow e rolagem no celular.
- CI do GitHub + Cloudflare Preview; main e dados de produção intocados.

A promoção para `main` dependerá de revisão visual e aprovação explícita do usuário.
## Correção complementar identificada nos testes responsivos
A largura extra não vinha da grid: o cabeçalho de ações usava um `span.sr-only` com `position:absolute` e, após remover as colunas fixas, a âncora de posicionamento ficou fora da área rolável. O cabeçalho final agora usa `position:relative`, mantendo a descrição acessível dentro do contêiner. A grid do Recebimento recebe `minmax(0,1fr)` para isolar o fluxo horizontal. O teste desktop aceita até 6 px de excedente **interno** por arredondamento de colunas, sem aceitar rolagem global da página.
