# Plano de promoção — nova tela de Agendas para produção

**Status:** planejamento, não autorizado a publicar. **Fonte oficial:** GitHub `joaoldsxyzbr/Agendas-pradosm`.

Este plano cobre somente **Importação única + Agendas administrativas por fornecedor**, incluindo marcações independentes, visualização de NF-e e pedidos e melhorias visuais. Não introduzir funcionalidades históricas de Tags ou Cross Docking.

## Estado verificado em 04/11/2026

- `main`: commit `101f71111d1295374cb26b4ec3817cafdaa11673`. Inclui a correção de realtime do conferente no PR #176, **ainda ausente em `preview`** na inspeção inicial.
- `preview`: commit `79b4ba579d62bc4d271dd4d00b79b676da6681b5` antes deste polimento. Divergência `main...preview`: 36 commits à frente e 1 atrás. Refazer a comparação imediatamente antes de preparar o PR de release.
- O D1 de **produção** possui migrations de `0001` a `0019`, sem a coluna `agendamentos.csv_campos` e sem a tabela `agenda_digitacao_fornecedor`.
- O D1 de **preview** já possui `0020_agenda_digitado_para_conferente.sql` e `0021_agendas_csv_fornecedor_preview.sql`. Seu histórico antigo é divergente e contém migrações extras que **não** devem ser transportadas para produção.
- A produção já utiliza React; a documentação de referência deve continuar refletindo o estado real da `main`, sem restaurar descrições antigas de frontend legado.
- Configuração `wrangler.jsonc` da produção: D1 `0a7d7d8b-e033-4644-90d4-fbc9ddc64532`, `REALTIME_MODE=on` e Worker `agendas-pradosm`. A `preview` usa D1 e Worker próprios.

## Etapas obrigatórias ANTES de qualquer merge na main

1. **Congelar escopo e atualizar a base.** Criar branch de release a partir da `main` atual, conservar a correção do conferente (#176), integrar somente os arquivos necessários das funcionalidades de Agendas e Importação, migrações aditivas 0020/0021, testes e contratos. Revisar diff do PR para impedir inclusão de funcionalidades experimentais e alterações em bindings de produção.
2. **Verificação de compatibilidade.** Confrontar `worker/routes/admin-agendas.ts`, `worker/repositories/agendas.ts`, `shared/import` e a UI React com o código corrente da `main`; preservar autorização `admin`, visibilidade, status, auditoria, realtime, conferência e relatórios. Confirmar que `csv_campos` não é exposto ao conferente nem ao visualizador.
3. **Homologação completa.** Executar `npm run verify:production`, Playwright, testes de permissão, importação/substituição CSV, pedidos e NF-e, checks individuais, concorrência, e CI `verify`/CodeQL do PR de release. Validar manualmente o fluxo do conferente, visualizador e administrador na `preview`.
4. **Conferir produção sem escrita.** Comparar `d1_migrations` e `PRAGMA table_info` novamente. Certificar-se de que `0020_agenda_digitado_para_conferente.sql` e `0021_agendas_csv_fornecedor_preview.sql` serão executadas somente uma vez, sem conflito de nomes ou colunas. Revisar também o limite de tamanho de payload CSV e o comportamento de arquivos anteriores (campos brutos não armazenados no passado não são recuperáveis).
5. **Proteção dos dados / janela.** Obter autorização explícita do usuário para publicar na `main`. Registrar um bookmark de Time Travel e confirmar o procedimento de backup/export do D1 de produção, credenciais, janela de menor movimento, responsável pela decisão e plano de volta.
6. **Publicar via caminho oficial.** Somente após aprovação e CI verde, mesclar o PR na `main`. O Workers Builds existente roda `npm run verify:production`, depois `npm run deploy:cloudflare` que aplica migrations e publica o Worker. Não rodar deploy manual paralelo, não trocar `wrangler.jsonc` pela configuração de homologação, nem atualizar `REALTIME_MODE` ou segredos.
7. **Smoke e observação.** Confirmar log de migrations `0020`/`0021`, deploy, health check e telas; importar um CSV controlado com autorização, testar NF-e/Pedidos, marcação/desmarcação e acesso por perfil. Confirmar conferência, realtime e relatórios. Observar logs e erros durante janela acordada.

## Reversão

- **Antes de iniciar:** se a migration ou o PR divergir do esperado, cancelar a release sem tocar no banco de produção.
- **Após migration aditiva / falha de publicação:** não apagar nem reverter as colunas/tabelas automaticamente; republicar o Worker anterior e investigar. As migrations adicionam estruturas opcionais e não precisam ser destruídas para rollback de código.
- **Qualquer restauração de dados, edição manual do D1 ou mudança de segredo:** exige autorização operacional específica e execução do procedimento de recuperação documentado.

## Critério de liberação

**Nenhuma promoção automática.** A `main` só recebe o recurso depois que o PR de release, o CI, o plano de dados e a validação manual forem aprovados e o usuário der autorização explícita.
