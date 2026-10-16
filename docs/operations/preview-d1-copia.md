# Cópia isolada do D1 para testes — 16/10/2026

## Objetivo

Reproduzir **volume, datas, status, relacionamentos e índices** do D1 da produção com valores operacionais pseudonimizados, sem expor credenciais ou documentos reais e sem interferir na produção.

## Bancos

| Papel | D1 | UUID | Estado |
| --- | --- | --- | --- |
| Produção (somente leitura) | `agendas-pradosm` | `0a7d7d8b-e033-4644-90d4-fbc9ddc64532` | Intacto |
| Preview existente (mock) | `agendas-pradosm-preview` | `716cc88e-7da8-400e-b4be-edc4be0c9c03` | Intacto; preservado para retorno, não utilizado na nova configuração |
| Cópia para validar | `agendas-pradosm-preview-copia` | `6b2c7fec-5fbf-4db7-a0c4-d51860799c29` | Criado e validado; configurado como D1 da branch `preview` |

**Atenção:** a cópia não é sincronizada automaticamente e não é um backup de recuperação operacional. Não contém credenciais utilizáveis de produção. Deve ser tratada como dado corporativo de teste e manter acesso restrito à conta Cloudflare autorizada.

## Procedimento executado

1. Consultou-se a estrutura da produção e do D1 de testes por comandos `SELECT` na API Cloudflare. O endpoint de exportação total não foi usado porque pode prejudicar consultas da produção.
2. Criou-se um terceiro banco exclusivo, sem apagar nem substituir o D1 mock existente.
3. Replicaram-se as nove tabelas relevantes a partir do esquema da **preview**, incluindo coluna `observacao` que não existia no esquema consultado da produção.
4. Transferiram-se os dados em lotes, sempre **lendo** o banco de produção, transformando os valores sensíveis antes da escrita e **gravando somente no novo banco**.
5. Copiaram-se para o novo banco as 17 entradas de metadados de migração da preview, além de 13 índices e 2 triggers, preservando a estrutura de testes. A tabela interna `_cf_KV` não foi copiada.
6. As consultas de integridade verificaram correspondência de quantidades, ligações, campos pseudonimizados e consistência de SQLite.

**Transformações de proteção:** nomes de lojas e usuários convertidos em rótulos de teste; logins substituídos; hashes de senha de produção não transferidos (credenciais propositalmente inutilizáveis); fornecedores e protocolos pseudonimizados; NF-e e números de pedidos substituídos por valores fictícios, preservando quantidade por agendamento; arquivos de origem com nome sintético; detalhes e valores antes/depois de auditoria removidos; presença de conferentes reiniciada para data antiga. Identificadores técnicos, códigos de loja, horários, datas, status, totais, vínculos e eventos de histórico foram mantidos.

**Limitação:** trata-se de **pseudonimização seletiva**, não de anonimização irreversível de todos os atributos. Identificadores e metadados operacionais continuam presentes. A cópia não deve ser tornada pública.

## Resultado verificado

| Tabela | Produção | Cópia |
| --- | ---: | ---: |
| Lojas | 10 | 10 |
| Usuários | 11 | 11 |
| Agendas | 144 | 144 |
| Agendamentos | 2.253 | 2.253 |
| Auditoria | 2.174 | 2.174 |
| Histórico de agendas | 55 | 55 |
| Histórico de status | 1.470 | 1.470 |
| Presença | 8 | 8 |
| Migrações | 16 na produção | 17 da preview |

- `PRAGMA quick_check`: **ok**.
- `PRAGMA foreign_key_check`: **0 violações**.
- 13 índices e 2 triggers criados.
- Contagens de nomes originais, credenciais originais, fornecedores originais, nomes de arquivos originais, audit logs brutos e presença original nas categorias verificadas: **0**.
- A leitura final da produção permaneceu com as mesmas quantidades, sem operações de escrita.

## Ativação da cópia na preview — 16/10/2026

- **GitHub:** `wrangler.jsonc` (`DB`) e `wrangler.preview-migrations.jsonc` (`PREVIEW_DB`) agora usam `agendas-pradosm-preview-copia` (`6b2c7fec-5fbf-4db7-a0c4-d51860799c29`). O nome do Worker, segredo da sessão e todas as outras bindings são preservados.
- **Login rápido:** contas adicionais exclusivas de testes criadas na cópia: `demo-admin`, `demo-visualizador` e `demo-conferente`. Estão ativas, possuem IDs próprios, credenciais de login normal inutilizáveis e o conferente usa uma loja ativa com agendas. As 11 contas pseudonimizadas anteriores permanecem sem senhas utilizáveis.
- **Base antiga:** `agendas-pradosm-preview` permanece intacta, disponível para restauração da configuração original (basta retornar o UUID e nome antigos nas configurações).
- **Dados reais:** o Worker **jamais deve ser vinculado** ao D1 original de produção. Todas as gravações operacionais de testes podem modificar a cópia, nunca a produção.
- **Migrações:** já há 17 registros correspondentes à preview no banco copiado. Não usar seeds destrutivos nem importar backups da produção sobre o D1 copiado.
- **Publicação:** a alteração do arquivo do GitHub não garante que o Worker já usa a nova binding. Verificar separadamente o recurso ativo na Cloudflare e testar login rápido, agendas, relatórios e autenticação dos três perfis.
- **Privacidade:** cópia pseudonimizada, não publicamente anônima. Preservar permissões de acesso, auditoria e restrições.

## Estado da publicação na Cloudflare — diagnóstico de 16/10/2026

**Configuração GitHub: concluída; conexão ativa no Worker: pendente.**

- `wrangler.jsonc` e `wrangler.preview-migrations.jsonc` da **preview** já apontam para `agendas-pradosm-preview-copia`.
- O D1 copiado tem 144 agendas, 2.253 agendamentos e as três contas exclusivas `demo-*` habilitadas para login rápido do ambiente de testes.
- O endpoint Cloudflare **GET** `/accounts/{account_id}/workers/scripts/agendas-pradosm-preview/settings` foi consultado após o commit: ainda informa a binding `DB` com UUID do antigo banco mock `716cc88e-7da8-400e-b4be-edc4be0c9c03`.
- Tentativas de `PATCH` na API Cloudflare foram rejeitadas pelo executor MCP depois do início da operação. A consulta de leitura posterior confirmou que o vínculo não foi alterado e as oito bindings originais permanecem presentes; por segurança, não repetir gravações sem diagnóstico.
- O CI GitHub Actions desse commit terminou com **falha**. Não se deve presumir implantação automática bem-sucedida.

**Para concluir a troca ativa:** publicar pelo fluxo de Workers Builds/Wrangler do projeto, **apenas** no Worker `agendas-pradosm-preview`, após corrigir o mecanismo de publicação, ou alterar a binding `DB` nas configurações do Worker via painel Cloudflare para o D1 `agendas-pradosm-preview-copia`. Não alterar nomes ou segredos das outras bindings. Em seguida, consultar novamente `/settings` e confirmar UUID `6b2c7fec-5fbf-4db7-a0c4-d51860799c29`; testar as três contas demo e os relatórios.

**Reversão segura:** configurar novamente o banco mock anterior na binding da preview; não modificar a `main` nem o D1 de produção.
