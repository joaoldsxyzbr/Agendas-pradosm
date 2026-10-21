# Incidente de importação CSV — 21/10/2026

## Sintoma e escopo
Na `main`, o usuário relatou que, ao escolher um arquivo CSV no modal, a interface piscava sem apresentar a prévia. Não foi enviado um arquivo real contendo dados empresariais; somente fixtures sintéticas/sanitizadas foram utilizadas.

## Diagnóstico reproduzido
- A importação de CSV UTF-8 com colunas válidas já passava no Chromium.
- A mesma agenda reencodificada como Windows-1252 **falhava** em abrir a prévia antes da correção (run `39672562836`).
- A antiga leitura usava `File.text()` (assume UTF-8). Caracteres não UTF-8, incluindo `às` e caracteres de cabeçalho, impediam a interpretação.
- Não houve evidência de requisições POST ao endpoint de importação no intervalo consultado na telemetria de produção. Isso não prova que nenhuma tentativa tenha ocorrido.
- A hipótese explica o caso reproduzido e é compatível com o relato, mas o encoding do arquivo real do usuário **não foi confirmado**.

## Correção
PR [#118](https://github.com/joaoldsxyzbr/Agendas-pradosm/pull/118), merge `d59007322b6ab2ed24d94d0f85e4b59599c87680`:
- Nova leitura local com APIs nativas `TextDecoder` para UTF-8, Windows-1252 e UTF-16 com BOM.
- Feedback de erro/acessibilidade e seleção repetida do mesmo arquivo após correção.
- Sem dependências novas, mudança de endpoint, migration ou edição de dados reais.

## Evidência
- Testes de regressão Playwright: prévia de CSV válido, arquivo inválido, confirmação explícita de substituição `409`, Windows-1252, UTF-16.
- Testes unitários: UTF-8, Windows-1252, UTF-16LE/BE, BOM, docas, bloqueio de payload inválido.
- PR #118: `verify`, CodeQL, Chromium e Preview verdes.
- GitHub Actions na `main`: execução `39673779844` aprovada.
- Cloudflare Workers Builds: build `1ec6f694-d446-4954-affe-b26d24f7fbb2`, commit `d590073`, resultado sucesso, deploy criado em 21/10/2026 20:51:09 UTC.

## Testes adicionais de integração (PR #117)
- Migrações e dados de teste carregados **somente no D1 local** via `wrangler.local.jsonc`.
- Worker real: autenticação de administrador/visualizador/conferente, dia concluído, importação em lote, conflito, substituição preservando status e histórico, rejeição de loja inexistente sem gravação parcial.
- A PR #117 deve ser integrada somente após `verify`/CodeQL/Preview verdes. A conclusão destes testes depende da execução final da CI.

## Próximas confirmações
1. Validar uma importação real com o arquivo original do usuário pelo navegador autenticado.
2. Caso ainda falhe, capturar texto exato da mensagem e console de navegador sem copiar dados sensíveis, verificar separador, colunas e protocolo do CSV.
3. Não afirmar que todos os arquivos CSV são aceitos: formato sem colunas exigidas deve apresentar erro e impedir gravação.
4. Manter suite regressiva obrigatória na CI. Não tocar no D1 de produção para testes.
