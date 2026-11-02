# Tags React — catálogo e Conferência (30/10/2026)

## Escopo

- Rota React `/app/tags` agora possui catálogo real por loja, com criação (nome até 32 caracteres, seis cores), pesquisa, visualização e arquivamento confirmado. Limite de 100 tags por loja.
- A rota `/app` apresenta tags existentes em cada agendamento e o botão **+ Tag** enquanto o dia estiver aberto, permitindo associar até cinco etiquetas.
- Tags atribuídas permanecem em consulta histórica, inclusive se arquivadas. Arquivadas não são oferecidas para novas associações.
- Contratos do Worker existentes: `GET/POST /api/store/tags`, `DELETE /api/store/tags/:id`, `GET /api/store/tags/agenda/:date`, `PUT /api/store/tags/appointments/:id`.
- A lista e o vínculo são autorizados no servidor pelo `lojaId` da sessão. Sem alterações em Worker, D1, migration, permissões ou contratos.
- Mutations aguardam confirmação da API; erros 400/403/409 aparecem sem otimização de estado que possa criar falsos dados.
- A agenda concluída mostra chips, sem oferecer opção de edição; a página de catálogo continua independente.
- Testes E2E sintéticos de criação, duplicidade, arquivamento, permissão de edição, limite, histórico e mobile.

## Limites e homologação

- Ainda falta verificar operações autenticadas na Cloudflare Preview hospedada, inclusive usuários conferentes reais e operação de tags no D1 Preview.
- A interface React paralela continua em `/modern/index.html#/app` e `#/app/tags`; a interface JS operacional em `/login` não é substituída.
- Outras operações do Conferente (fornecedores manuais, PDF, edição avançada de observações e realtime) permanecem pendentes na modernização.
- **Nunca** publicar na `main` ou migrar D1 de produção por esta mudança.
