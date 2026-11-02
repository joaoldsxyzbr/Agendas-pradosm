# Modernização React — Lojas (Preview, 31/10/2026)

## Escopo

A rota administrativa `/admin/stores` no frontend React substitui o placeholder por uma tela funcional, mantendo o frontend atual acessível na Preview. A mudança **não altera** o Worker, D1, migrations, variáveis, sessão ou qualquer configuração de produção.

- Listagem de unidades com contagens de ativas e total; busca por nome/código e filtro de situação.
- Cadastro, edição de nome/código e ativação/desativação, respeitando os limites de 20 e 120 caracteres.
- Histórico de auditoria sob demanda `/api/admin/audit?entity=loja&entityId=...`, sem carregamento desnecessário.
- Exclusão lógica explicitamente confirmada: o Worker recusa exclusão se houver conferentes cadastrados e preserva históricos.
- Indicadores de requisição pendente, erro 409 e tentativa novamente. Atualiza a lista e o recebimento após gravações efetivas.
- Permissão exclusiva de administrador pela sessão e no Worker.
- Diálogo nativo e filtros responsivos, tabela com rolagem interna, teclado e foco no campo inicial.

## Verificação

Testes E2E com dados sintéticos: listagem, filtros, criação, atualização, auditoria, exclusão confirmada ou cancelada, recusa 409, retry, perfil visualizador e celular. CI completo é obrigatório para merge na `preview`. Testar manualmente login real e estilos hospedados antes de substituir o frontend anterior. Não mexer na `main`.
