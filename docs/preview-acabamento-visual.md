# Acabamento visual empresarial — preview

Data: 15/10/2026 · Escopo: `preview` · **`main` não alterada**.

## Objetivo

Manter a navegação, organização das telas, fluxos de trabalho, popups e o frontend em **HTML, CSS e JavaScript puro**. Melhorar apenas o acabamento visual e a legibilidade do modo escuro.

## Decisões implementadas

- Paleta única de superfícies escuras e tokens semânticos para contraste, bordas, texto e estados.
- Menos sombras nos cartões padrão; hierarquia por cores de superfícies e bordas. Sombras elevadas apenas para diálogos e autenticação.
- Navegação com ícones SVG locais, sem biblioteca de ícones, fontes externas ou dependências novas.
- Títulos, tabelas, campos e valores destacados com tipografia mais legível.
- Botões, campos, modais, avisos e status usando raios, contrastes e estados coerentes.
- Feedback de foco visível, estado hover, movimento reduzido e regras móveis preservadas.
- Identificação de **PREVIEW / D1 isolado** preservada.

## Limites da alteração

Nenhum fluxo de negócio, rota, banco, permissão, importação ou lógica JavaScript foi alterado. A disposição das telas e os breakpoints existentes foram preservados.

## Validação recomendada antes de qualquer promoção

1. Conferir com contas fictícias os perfis administrador, visualizador e conferente.
2. Revisar visualmente a dashboard, os relatórios, lojas, usuários, recebimento e os modais de importação/agenda.
3. Conferir contraste, estados dos botões, foco de teclado e rolagem das tabelas em desktop e celular.
4. Executar os testes do projeto na branch `preview`.
5. Publicar na `main` **somente após validação e autorização explícita**.
