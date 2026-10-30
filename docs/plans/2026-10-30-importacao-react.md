# Importação React — implementação incremental (2026-10-30)

## Escopo
- Rota `/admin/import` agora usa o React, protegida pelo perfil administrador.
- O botão Importar agenda no Recebimento leva a essa rota.
- **Parsers oficiais mantidos** (sem cópia das regras): `frontend/import/parseAgendaBatch.js`, `readCsvText.js` e `extractPdfText.js`. O PDF continua usando o WASM liteparse, carregado somente quando necessário.
- Formatos CSV (UTF-8, Windows-1252 e UTF-16) e PDF, máximo 10 MB por arquivo.
- Leitura local antes do envio, seleção e arrastar/soltar, prévia agrupada e tabela com 7 colunas.
- Erros bloqueantes e avisos da mesma estrutura do parser legado.
- `POST /api/admin/agendas/import/bulk` apenas após confirmação; não envia status do arquivo.
- Em conflito HTTP 409, **exige nova confirmação** para substituir agendas, preservando histórico, status e fornecedores manuais conforme contrato do Worker.
- Sucesso com resumo, sem permitir submissão repetida do mesmo lote.
- Dados de Recebimento invalidados após importação; nenhuma mudança no Worker, D1, perfis ou migrations.

## Controles de segurança
- Um arquivo por vez, limite de tamanho, formato e prévia validada; troca de arquivo invalida uma leitura assíncrona anterior.
- Erros da API exibidos sem presumir gravação bem-sucedida.
- A validação definitiva de dados, atomicidade, autorização e proteção contra duplicidade continuam no backend.
- A UI do visualizador não permite acessar o fluxo de importação.
- As operações só ficam habilitadas no ambiente React isolado `dist-modern/`; a `main` e a `preview` existentes seguem com a interface operacional anterior.

## Testes E2E
CSV válido, prévia sem gravação antecipada, duplicidade 409 e substituição, erros bloqueantes, encodings Windows e UTF-16LE, limites/formatos, PDF inválido, permissões e layout móvel.

## Não homologado
- PDF real end-to-end, com fixtures reais sanitizadas, e comparação visual de todas as variantes.
- Capturas e validação manual da interface React no ambiente de preview isolado.
- Observabilidade da importação equivalente ao cliente antigo (eventos diagnósticos por correlação).
