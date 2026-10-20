# Isolamento do motor de PDF — 20/10/2026

## Causa
O `@llamaindex/liteparse-wasm` é a dependência mais frágil do projeto: terceira, com WASM e mantenedora própria. Todo o código específico dela — inicialização, chamada do parser e normalização do Markdown — vivia em `frontend/import/extractPdfText.js`, o que tornaria uma futura troca de biblioteca uma alteração dispersa pelo módulo central de extração.

## Mudança
- `frontend/import/pdf-engine-liteparse.js` (novo): motor LiteParse isolado. Concentra `initLiteParse`, `LiteParse`, a normalização do Markdown (`normalizeLiteParseText`) e exporta `extractPdfTextFromBytes(bytes)`.
- `frontend/import/extractPdfText.js`: reduzido a fachada estável. Mantém a API pública (`extractPdfText`, `PdfExtractionError`), converte o arquivo em bytes e delega ao motor, que agora é carregado sob demanda. O WASM só é baixado quando um PDF é importado de fato; a importação CSV, o carregamento da página e os testes de contrato não tocam a dependência.
- A fachada aceita motor injetado (`extractPdfText(file, engine)`), permitindo testar o contrato de erro sem o WASM.
- `scripts/check-worker.mjs`: novo módulo incluído na lista de contratos.
- `scripts/check-build.mjs`: novo módulo incluído nos artefatos obrigatórios; o contrato do WASM passou a verificar o motor e a proibir que a fachada referencie `@llamaindex` diretamente.
- `tests/unit/pdf-text-contract.test.js`: novo teste de contrato — delegação de bytes, mapeamento de falha para `PDF_INVALIDO` e isolamento da dependência.

## Segurança e validação
Sem alteração do Worker, APIs, sessão, D1, migrações ou regras de recebimento. O comportamento de extração é idêntico: mesmas opções do LiteParse, mesma normalização, mesmo erro `PDF_INVALIDO`. Como efeito do isolamento, `tests/unit/import-agenda.test.js` passou a carregar em Node sem a dependência instalada. Rollback: reverter o PR restaura o módulo original sem qualquer dado envolvido.
