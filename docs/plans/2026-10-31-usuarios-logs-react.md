# Modernização React — Usuários e Logs/Auditoria (Preview, 31/10/2026)

## Escopo

As rotas administrativas `/admin/users` e `/admin/diagnostics` no frontend React substituem os dois placeholders restantes, mantendo o frontend atual acessível na Preview. A mudança **não altera** o Worker, D1, migrations, variáveis, sessão ou qualquer configuração de produção.

- `/admin/users`: listagem com busca (nome, login, loja ou papel), filtros por papel e situação e contagem de ativos; cadastro e edição no mesmo diálogo nativo, com senha obrigatória (mínimo 12) na criação e opcional na edição, loja obrigatória para conferente (somente ativas na criação, todas com marcador na edição), auditoria do cadastro sob demanda (`GET /api/admin/audit?entity=usuario`), desativação/reativação com confirmação em duas etapas e erros do Worker exibidos sem fechar o diálogo (`LOGIN_EM_USO`, `ULTIMO_ADMIN_ATIVO`).
- `/admin/diagnostics`: abas Erros (`GET /api/admin/diagnostics?nivel=error`), Operações (mesma consulta sem nível, excluindo `error` no cliente como na tela legada) e Auditoria (`GET /api/admin/audit`), filtros por data (UTC), origem, área, usuário e loja (origem e área desabilitados na aba Auditoria), resumo da consulta, botões Filtrar/Atualizar e tabelas distintas por aba.
- Cartões no celular em Usuários e contenção de largura em Logs; nenhuma rolagem horizontal do documento.
- Permissão exclusiva de administrador mantida na sessão React e no Worker.

## Verificação

Testes E2E com dados sintéticos: lista/filtros/contagem, validação client-side antes de gravar, login em uso, edição com auditoria, desativação e reativação, proteção do último administrador, falha de listagem com retry, visualizador bloqueado e celular sem overflow (Usuários); abas com parâmetros corretos, separação de erros, auditoria com filtros, filtragem por origem/área, falha com retry, visualizador bloqueado e celular sem rolagem (Logs). Navegação administrativa atualizada para esperar as telas reais. CI completo é obrigatório para merge na `preview`. Homologação autenticada dos três perfis permanece pendente. Não mexer na `main`.
