# Agenda Prado V1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Entregar a primeira versão do Agenda Prado: login por perfil, isolamento por loja, importação diária do PDF padrão com prévia, agenda de hoje, histórico e atualização auditável de status.

**Architecture:** Um único projeto React + TypeScript + Vite será publicado no Cloudflare Workers com o plugin oficial do Cloudflare. A SPA usa a API no mesmo domínio; o Worker usa Hono e Cloudflare D1. A leitura do PDF acontece no navegador com pdfjs-dist, o texto é transformado por um parser determinístico e a API revalida todos os dados antes de persistir. Autenticação usa cookie HTTP-only assinado; em cada requisição protegida o usuário atual é carregado do D1 para aplicar perfil, loja e ativo.

**Tech Stack:** React, TypeScript, Vite, @cloudflare/vite-plugin, Cloudflare Workers, Cloudflare D1, Hono, Zod, pdfjs-dist, React Router, Vitest 4.1+, @cloudflare/vitest-plugin, Testing Library.

**Spec:** docs/superpowers/specs/2026-09-24-agenda-prado-design.md

## Global Constraints

- A primeira versão usa o formato do arquivo de referência QUINTA LOJA 03.pdf.
- Um PDF pertence a uma loja e a uma data.
- A combinação loja + data é única.
- Status inicial: aguardando.
- Status selecionáveis pela loja: recebido, nao_chegou e recusado.
- A tela inicial da loja exibe somente a agenda de hoje.
- Histórico exibe somente dados da loja autenticada.
- O administrador pode gerenciar lojas, usuários e importar agendas.
- A autorização deve ser aplicada no backend, nunca apenas escondida no frontend.
- Datas e horários de negócio usam America/Sao_Paulo.
- O PDF real, o texto extraído e dados comerciais reais não entram no repositório público.
- Testes do parser usam fixtures sintéticas.
- O primeiro administrador é criado por processo de bootstrap explícito, sem credencial padrão no código.
- Execução: uma tarefa por vez. Ao terminar cada tarefa, executar a verificação indicada, marcar [x] neste plano e registrar o checkpoint antes de seguir.
- Falha: diagnosticar a causa antes de uma nova tentativa; não repetir a mesma tentativa sem mudança relevante.

## Review Focus

1. **Isolamento entre lojas:** um usuário da loja A nunca pode obter agenda, detalhe ou histórico da loja B, mesmo chamando a API manualmente. Coberto nas Tasks 7 e 8.
2. **Reimportação:** reenviar a mesma loja/data não pode duplicar registros; substituição explícita preserva status e histórico pelo protocolo. Coberto na Task 6.
3. **PDF parcialmente interpretável:** qualquer erro estrutural inseguro bloqueia confirmação; a aplicação não salva agenda parcial. Coberto nas Tasks 5 e 6.
4. **Mudança de estado concorrente:** a UI só confirma novo status após a API responder, e a API grava status + histórico na mesma operação lógica. Coberto na Task 7.
5. **Sessão adulterada/inativa:** cookie inválido, expirado ou usuário desativado deve resultar em 401; perfil loja não pode acessar rotas administrativas. Coberto na Task 3.

## Planned File Structure

~~~
.
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── wrangler.jsonc
├── worker-configuration.d.ts
├── migrations/
│   └── 0001_init.sql
├── scripts/
│   └── bootstrap-admin.mjs
├── shared/
│   ├── agenda.ts
│   ├── auth.ts
│   └── api.ts
├── worker/
│   ├── index.ts
│   ├── app.ts
│   ├── env.ts
│   ├── lib/
│   │   ├── password.ts
│   │   ├── session.ts
│   │   ├── time.ts
│   │   └── http.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── repositories/
│   │   ├── users.ts
│   │   ├── stores.ts
│   │   └── agendas.ts
│   └── routes/
│       ├── auth.ts
│       ├── admin-stores.ts
│       ├── admin-users.ts
│       ├── admin-agendas.ts
│       └── store-agendas.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles.css
│   ├── lib/
│   │   └── api.ts
│   ├── auth/
│   │   ├── AuthProvider.tsx
│   │   ├── LoginPage.tsx
│   │   └── ProtectedRoute.tsx
│   ├── admin/
│   │   ├── AdminLayout.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── AdminAgendaHistoryPage.tsx
│   │   ├── StoresPage.tsx
│   │   ├── UsersPage.tsx
│   │   └── ImportAgendaPage.tsx
│   ├── agenda/
│   │   ├── TodayPage.tsx
│   │   ├── HistoryPage.tsx
│   │   ├── AgendaList.tsx
│   │   ├── AgendaDetails.tsx
│   │   └── StatusControl.tsx
│   └── import/
│       ├── extractPdfText.ts
│       └── parseAgendaText.ts
└── tests/
    ├── setup/
    │   └── migrations.ts
    ├── fixtures/
    │   └── agenda-sintetica.txt
    ├── worker/
    │   ├── health.test.ts
    │   ├── database.test.ts
    │   ├── auth.test.ts
    │   ├── admin.test.ts
    │   ├── import.test.ts
    │   └── store-agendas.test.ts
    ├── tsconfig.json
    └── ui/
        ├── parser.test.ts
        ├── extract-pdf.test.ts
        ├── login.test.tsx
        ├── import.test.tsx
        ├── admin-history.test.tsx
        └── agenda.test.tsx
~~~

---

### Task 1: Scaffold full-stack React + Worker e verificação básica

**Files:**
- Create: package.json
- Create: vite.config.ts
- Create: vitest.config.ts
- Create: wrangler.jsonc
- Create: worker-configuration.d.ts
- Create: tests/tsconfig.json
- Create: worker/env.ts
- Create: worker/app.ts
- Create: worker/index.ts
- Create: src/main.tsx
- Create: src/App.tsx
- Create: src/styles.css
- Create: tests/worker/health.test.ts

**Interfaces:**
- Produces: Worker Hono com GET /api/health.
- Produces: React SPA carregável.
- Produces: scripts npm para dev, test, typecheck, build e deploy.

- [x] **Step 1: Criar package.json e instalar dependências**

Run:

~~~bash
npm install react react-dom react-router-dom hono zod pdfjs-dist
npm install -D typescript vite @vitejs/plugin-react @cloudflare/vite-plugin wrangler vitest@^4.1.0 @cloudflare/vitest-plugin @testing-library/react @testing-library/jest-dom jsdom @types/react @types/react-dom
~~~

Definir package.json com "type": "module" e scripts:

~~~json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit",
    "build": "vite build",
    "deploy": "npm run build && wrangler deploy"
  }
}
~~~

- [x] **Step 2: Escrever o teste de saúde antes da implementação**

tests/worker/health.test.ts:

~~~ts
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("health", () => {
  it("retorna ok", async () => {
    const response = await exports.default.fetch("https://example.com/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
~~~

Run: npm test -- tests/worker/health.test.ts  
Expected: FAIL porque o Worker ainda não existe.

- [x] **Step 3: Criar o Worker mínimo**

worker/app.ts:

~~~ts
import { Hono } from "hono";

export const app = new Hono();
app.get("/api/health", (c) => c.json({ ok: true }));
~~~

worker/index.ts:

~~~ts
import { app } from "./app";
export default app;
~~~

- [x] **Step 4: Configurar Vite, Cloudflare e Vitest**

vite.config.ts deve usar react() e cloudflare().  
wrangler.jsonc deve usar compatibility_date 2026-09-24, main ./worker/index.ts e assets.not_found_handling = "single-page-application".  
vitest.config.ts deve usar cloudflareTest com wrangler.configPath apontando para ./wrangler.jsonc.  
tests/tsconfig.json deve incluir os tipos de @cloudflare/vitest-plugin.

Gerar tipos do runtime:

~~~bash
npx wrangler types
~~~

Expected: worker-configuration.d.ts criado sem erro.

- [x] **Step 5: Criar SPA mínima e rodar verificações**

Run:

~~~bash
npm test -- tests/worker/health.test.ts
npm run typecheck
npm run build
~~~

Expected: todos com exit code 0.

- [x] **Step 6: Commit do checkpoint**

~~~bash
git add package.json package-lock.json vite.config.ts vitest.config.ts wrangler.jsonc worker-configuration.d.ts worker src tests/tsconfig.json tests/worker/health.test.ts
git commit -m "chore: scaffold Agenda Prado app"
~~~


**Checkpoint Task 1 — concluído em 24/09/2026**
- RED: `health.test.ts` falhou com `Cannot find module worker/index.ts`.
- GREEN: 1/1 teste passou; typecheck e build passaram.
- Segurança: `pdfjs-dist` vulnerável foi atualizado para `6.3.289`; auditoria de produção retornou 0 vulnerabilidades.
- Ruling: o arquivo de tipos Wrangler permanece mínimo nesta etapa e será regenerado após adicionar o binding D1 na Task 2, quando os tipos de `Env.DB` passam a existir.

---

### Task 2: Criar D1, schema e infraestrutura de testes com migrations

**Files:**
- Create: migrations/0001_init.sql
- Modify: wrangler.jsonc
- Modify: vitest.config.ts
- Create: tests/setup/migrations.ts
- Create: tests/worker/database.test.ts
- Modify: worker/env.ts
- Modify: worker-configuration.d.ts

**Interfaces:**
- Produces: binding Env.DB: D1Database.
- Produces: tabelas lojas, usuarios, agendas, agendamentos e historico_status.
- Produces: migrations aplicadas automaticamente no ambiente de teste.

- [x] **Step 1: Criar o banco Cloudflare D1**

Run:

~~~bash
npx wrangler d1 create agendas-prado
~~~

Expected: Wrangler retorna o database_id. Registrar exatamente esse ID no binding DB do wrangler.jsonc e executar npx wrangler types novamente para atualizar Env.DB.

- [x] **Step 2: Escrever migration inicial**

migrations/0001_init.sql deve criar:

~~~sql
PRAGMA foreign_keys = ON;

CREATE TABLE lojas (
  id TEXT PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  loja_id TEXT REFERENCES lojas(id),
  nome TEXT NOT NULL,
  login TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'loja')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  CHECK ((perfil = 'admin') OR (perfil = 'loja' AND loja_id IS NOT NULL))
);

CREATE TABLE agendas (
  id TEXT PRIMARY KEY,
  loja_id TEXT NOT NULL REFERENCES lojas(id),
  data_agenda TEXT NOT NULL,
  arquivo_original TEXT NOT NULL,
  criado_por TEXT NOT NULL REFERENCES usuarios(id),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  UNIQUE (loja_id, data_agenda)
);

CREATE TABLE agendamentos (
  id TEXT PRIMARY KEY,
  agenda_id TEXT NOT NULL REFERENCES agendas(id),
  protocolo TEXT NOT NULL,
  horario_inicio TEXT NOT NULL,
  horario_fim TEXT NOT NULL,
  fornecedor TEXT NOT NULL,
  itens INTEGER,
  volumes INTEGER,
  paletes INTEGER,
  carga_batida TEXT,
  tipo TEXT,
  nfe TEXT NOT NULL DEFAULT '[]',
  pedidos TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'aguardando'
    CHECK (status IN ('aguardando','recebido','nao_chegou','recusado')),
  ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  UNIQUE (agenda_id, protocolo)
);

CREATE TABLE historico_status (
  id TEXT PRIMARY KEY,
  agendamento_id TEXT NOT NULL REFERENCES agendamentos(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  status_anterior TEXT NOT NULL,
  status_novo TEXT NOT NULL,
  alterado_em TEXT NOT NULL
);

CREATE INDEX idx_agendas_loja_data ON agendas(loja_id, data_agenda);
CREATE INDEX idx_agendamentos_agenda_horario ON agendamentos(agenda_id, horario_inicio);
CREATE INDEX idx_historico_agendamento ON historico_status(agendamento_id, alterado_em);
~~~

- [x] **Step 3: Configurar migrations nos testes**

vitest.config.ts deve carregar migrations com readD1Migrations.  
tests/setup/migrations.ts deve executar applyD1Migrations(env.DB, env.TEST_MIGRATIONS).

- [x] **Step 4: Escrever teste do schema**

O teste deve inserir uma loja, tentar inserir outra com o mesmo codigo e esperar falha; deve também rejeitar status fora do enum.

- [x] **Step 5: Rodar migration local e testes**

~~~bash
npx wrangler d1 migrations apply agendas-prado --local
npm test -- tests/worker/database.test.ts
~~~

Expected: migration aplicada e testes PASS.

- [x] **Step 6: Commit do checkpoint**

~~~bash
git add migrations wrangler.jsonc vitest.config.ts worker/env.ts tests/setup tests/worker/database.test.ts
git commit -m "feat: add D1 schema"
~~~


**Checkpoint Task 2 — concluído em 24/09/2026**
- RED: os 2 testes do schema falharam porque `env.DB` ainda não existia.
- GREEN: migration aplicada pelo runtime D1 de testes; 2 testes de banco + 1 health test passaram.
- Verificação: typecheck, build e auditoria de produção passaram com 0 vulnerabilidades.
- Ruling: foi usado o D1 já definido pelo projeto (`0a7d7d8b-e033-4644-90d4-fbc9ddc64532`) em vez de criar um novo banco.
- Ruling: o comando `wrangler d1 migrations apply --local` ficou preso em prompt no CI mesmo com confirmação enviada; a migration foi validada diretamente por `applyD1Migrations` no runtime D1, que executou o schema e comprovou suas constraints. A aplicação remota permanece para a etapa de deploy.

---

### Task 3: Autenticação, senha, sessão e bootstrap do primeiro admin

**Files:**
- Create: shared/auth.ts
- Create: worker/lib/password.ts
- Create: worker/lib/session.ts
- Create: worker/middleware/auth.ts
- Create: worker/repositories/users.ts
- Create: worker/routes/auth.ts
- Create: scripts/bootstrap-admin.mjs
- Create: tests/worker/auth.test.ts
- Modify: worker/app.ts
- Modify: worker/env.ts

**Interfaces:**
- Produces: hashPassword(password): Promise<string>.
- Produces: verifyPassword(password, encoded): Promise<boolean>.
- Produces: requireAuth e requireAdmin.
- Produces: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me.
- Sessão: cookie HTTP-only, Secure em produção, SameSite=Strict, expiração de 8 horas, HMAC-SHA256 com SESSION_SECRET.

- [x] **Step 1: Escrever testes de senha e sessão**

Cobrir:
- senha correta valida;
- senha errada falha;
- cookie adulterado falha;
- cookie expirado falha;
- usuário inativo recebe 401;
- loja chamando rota admin recebe 403;
- SESSION_SECRET de teste é fornecido somente pela configuração do Vitest/Miniflare.

Run: npm test -- tests/worker/auth.test.ts  
Expected: FAIL.

- [x] **Step 2: Implementar senha com Web Crypto**

Formato persistido:

~~~txt
pbkdf2_sha256$600000$BASE64_SALT$BASE64_HASH
~~~

Usar PBKDF2-HMAC-SHA256 com salt aleatório de 16 bytes e 600000 iterações. Comparar hashes em tempo constante.

- [x] **Step 3: Implementar sessão assinada**

Payload mínimo:

~~~ts
type SessionPayload = {
  userId: string;
  exp: number;
};
~~~

Assinar bytes do payload com HMAC-SHA256 e SESSION_SECRET. Em rotas protegidas, após validar assinatura e expiração, buscar o usuário no D1 e derivar perfil/loja do registro atual, não do cookie.

- [x] **Step 4: Implementar rotas de auth**

Login recebe:

~~~ts
const LoginInput = z.object({
  login: z.string().min(1).max(100),
  senha: z.string().min(8).max(200)
});
~~~

Resposta /api/auth/me:

~~~ts
type AuthUser = {
  id: string;
  nome: string;
  perfil: "admin" | "loja";
  lojaId: string | null;
};
~~~

- [x] **Step 5: Criar bootstrap explícito do primeiro admin**

scripts/bootstrap-admin.mjs deve:
1. exigir ADMIN_NAME, ADMIN_LOGIN e ADMIN_PASSWORD no ambiente;
2. gerar hash PBKDF2 localmente;
3. criar SQL temporário em diretório ignorado pelo git;
4. executar npx wrangler d1 execute agendas-prado --remote --file=.tmp/bootstrap-admin.sql;
5. apagar o arquivo temporário em finally;
6. abortar se já houver login igual.

Nunca imprimir a senha no terminal.

- [x] **Step 6: Rodar testes**

~~~bash
npm test -- tests/worker/auth.test.ts
npm run typecheck
~~~

Expected: PASS e exit code 0.

- [x] **Step 7: Commit do checkpoint**

~~~bash
git add shared/auth.ts worker scripts tests/worker/auth.test.ts .gitignore
git commit -m "feat: add authentication"
~~~


**Checkpoint Task 3 — concluído em 24/09/2026**
- RED: 7 testes de autenticação falharam inicialmente porque as rotas e a sessão ainda não existiam.
- GREEN: 10/10 testes do Worker passaram no GitHub Actions, incluindo 7 testes de autenticação.
- Verificação final: GitHub Actions #78 passou com testes, typecheck, build e auditoria de produção.
- Correção durante GREEN: a primeira execução funcional passou nos testes, mas o typecheck detectou uma tipagem inválida no helper de credenciais; a causa foi corrigida sem alterar o comportamento.
- Bootstrap do primeiro administrador permanece explícito via variáveis de ambiente, sem credencial padrão no código.

---

### Task 4: CRUD administrativo de lojas e usuários

**Files:**
- Create: shared/api.ts
- Create: worker/repositories/stores.ts
- Modify: worker/repositories/users.ts
- Create: worker/routes/admin-stores.ts
- Create: worker/routes/admin-users.ts
- Create: tests/worker/admin.test.ts
- Modify: worker/app.ts

**Interfaces:**
- Produces:
  - GET/POST/PATCH /api/admin/stores
  - GET/POST/PATCH /api/admin/users
- Consome: requireAdmin, hashPassword, Env.DB.

- [x] **Step 1: Escrever testes da API administrativa**

Cobrir:
- admin cria loja;
- codigo duplicado retorna 409;
- admin cria usuário loja vinculado;
- usuário loja sem lojaId retorna 400;
- login duplicado retorna 409;
- usuário de loja recebe 403;
- desativação impede novo login.

- [x] **Step 2: Definir schemas Zod compartilhados**

~~~ts
export const CreateStoreInput = z.object({
  codigo: z.string().trim().min(1).max(20),
  nome: z.string().trim().min(1).max(120)
});

export const CreateStoreUserInput = z.object({
  nome: z.string().trim().min(1).max(120),
  login: z.string().trim().min(3).max(100),
  senha: z.string().min(8).max(200),
  lojaId: z.string().uuid()
});
~~~

- [x] **Step 3: Implementar repositories com prepared statements**

Toda consulta usa bind; nenhuma concatenação de entrada do usuário em SQL.

- [x] **Step 4: Implementar rotas e conflitos 409**

Erros de UNIQUE devem virar mensagens estáveis:
- CODIGO_LOJA_EM_USO
- LOGIN_EM_USO

- [x] **Step 5: Rodar testes**

~~~bash
npm test -- tests/worker/admin.test.ts
npm run typecheck
~~~

Expected: PASS.

- [x] **Step 6: Commit do checkpoint**

~~~bash
git add shared worker tests/worker/admin.test.ts
git commit -m "feat: add admin store and user management"
~~~


**Checkpoint Task 4 — concluído em 24/09/2026**
- CRUD administrativo de lojas e usuários implementado com validação Zod e prepared statements.
- Proteção administrativa aplicada com autenticação + perfil admin.
- Conflitos de código de loja e login retornam 409 com códigos estáveis.
- Desativação de usuário impede novo login.
- Verificação final: GitHub Actions #93 passou; 17/17 testes, typecheck e build verdes.

---

### Task 5: Parser determinístico do PDF e pré-visualização local

**Files:**
- Create: shared/agenda.ts
- Create: src/import/extractPdfText.ts
- Create: src/import/parseAgendaText.ts
- Create: tests/fixtures/agenda-sintetica.txt
- Create: tests/ui/parser.test.ts
- Create: tests/ui/extract-pdf.test.ts

**Interfaces:**
- Produces: extractPdfText(file: File): Promise<string>.
- Produces: parseAgendaText(text: string): ParseAgendaResult.
- ParseAgendaResult contém storeCode, storeName, date, appointments, warnings e blockingErrors.

- [x] **Step 1: Criar fixture sintética**

A fixture deve representar:
- filial F99 - LOJA TESTE;
- pelo menos 6 protocolos;
- fornecedor em múltiplas linhas;
- Nota fiscal com múltiplas NF-e;
- Pedido com múltiplos pedidos;
- CNPJ;
- Agenda fixa;
- hífen para valores ausentes.

Não copiar nomes, NF-e, pedidos ou protocolos reais.

- [x] **Step 2: Escrever testes do parser**

Exemplo de contrato:

~~~ts
const result = parseAgendaText(fixture);

expect(result.storeCode).toBe("F99");
expect(result.date).toBe("2026-09-24");
expect(result.blockingErrors).toEqual([]);
expect(result.appointments).toHaveLength(6);
expect(result.appointments[0]).toMatchObject({
  status: "aguardando",
  protocol: expect.any(String),
  supplier: expect.any(String)
});
~~~

Adicionar testes para:
- múltiplas linhas;
- listas de NF-e e pedidos;
- tipos conhecidos;
- PDF/texto sem filial;
- sem data;
- sem registros válidos;
- texto parcialmente interpretável gerando blockingErrors.

- [x] **Step 3: Implementar parseAgendaText**

Regras:
- normalizar espaços, quebras e acentos apenas onde necessário para detectar rótulos;
- reconhecer protocolo como início de registro;
- converter DD/MM/AAAA em YYYY-MM-DD;
- separar faixa HH:MM às HH:MM;
- converter "-" em null;
- nunca criar valor ausente;
- status não vem do PDF: sempre aguardando para novos registros.

- [x] **Step 4: Implementar extractPdfText com pdfjs-dist**

Extrair todas as páginas em ordem, unir text items respeitando linhas e retornar texto normalizado para o parser. Falha de leitura gera erro PDF_INVALIDO.

- [x] **Step 5: Rodar testes**

~~~bash
npm test -- tests/ui/parser.test.ts tests/ui/extract-pdf.test.ts
npm run typecheck
~~~

Expected: PASS.

- [x] **Step 6: Validar manualmente com QUINTA LOJA 03.pdf sem commitá-lo**

Critérios:
- filial detectada como F03;
- data 24/09/2026;
- total interpretado coerente com o PDF;
- registros mantêm protocolo, faixa de horário e fornecedor;
- nenhuma informação comercial do arquivo é copiada para fixture ou commit.

Registrar apenas o resultado da validação no checkpoint, nunca o conteúdo do PDF.

- [x] **Step 7: Commit do checkpoint**

~~~bash
git add shared/agenda.ts src/import tests/fixtures tests/ui
git commit -m "feat: add agenda PDF parser"
~~~


**Checkpoint Task 5 — concluído em 24/09/2026**
- Parser determinístico e extração com pdfjs-dist implementados.
- Fixtures automatizadas usam somente dados sintéticos.
- Validação manual do PDF de referência confirmou filial F03, data 24/09/2026 e 24 registros coerentes, sem commit do arquivo ou de seus dados comerciais.
- Verificação final: GitHub Actions #113 passou com 26/26 testes, typecheck, build e auditoria de produção.

---

### Task 6: Importação da agenda, duplicidade e substituição segura

**Files:**
- Create: worker/repositories/agendas.ts
- Create: worker/routes/admin-agendas.ts
- Create: tests/worker/import.test.ts
- Modify: worker/app.ts
- Modify: shared/agenda.ts

**Interfaces:**
- Produces:
  - POST /api/admin/agendas/import
  - GET /api/admin/agendas/today
  - GET /api/admin/agendas?date=YYYY-MM-DD&storeCode=F03
  - GET /api/admin/agendas/:id
  - GET /api/admin/appointments/:id/history
- Import input contém storeCode, date, originalFileName e appointments validados.
- replace=false por padrão; agenda existente retorna 409.
- replace=true executa substituição explícita.

- [x] **Step 1: Escrever testes de importação**

Cobrir:
- loja inexistente retorna 422;
- payload sem agendamentos retorna 400;
- primeira importação cria agenda e status aguardando;
- mesma loja/data sem replace retorna 409;
- replace preserva status de protocolo existente;
- replace adiciona protocolo novo como aguardando;
- replace marca protocolo removido como ativo=0;
- histórico existente continua intacto;
- falha durante batch não deixa agenda parcialmente substituída;
- admin consegue consultar agenda histórica de qualquer loja;
- admin consegue consultar o histórico de status de um agendamento.

- [x] **Step 2: Implementar validação da API**

Zod deve exigir:
- data ISO;
- código da loja;
- nome do arquivo sem caminho;
- protocolo;
- horário início/fim;
- fornecedor;
- arrays de NF-e e pedidos;
- inteiros não negativos ou null.

O backend ignora qualquer status enviado pelo frontend em novos protocolos.

- [x] **Step 3: Implementar importação inicial**

Gerar UUIDs no Worker. Salvar nfe e pedidos como JSON serializado. Usar D1 prepared statements.

- [x] **Step 4: Implementar substituição**

Algoritmo:
1. buscar agenda existente;
2. indexar agendamentos existentes por protocolo;
3. para protocolos presentes, atualizar campos importados sem alterar status;
4. para protocolos novos, inserir aguardando;
5. para protocolos ausentes, definir ativo=0;
6. reativar protocolo que volte a aparecer;
7. atualizar arquivo_original e atualizado_em;
8. executar as escritas via DB.batch para rollback em falha.

- [x] **Step 5: Rodar testes**

~~~bash
npm test -- tests/worker/import.test.ts
npm run typecheck
~~~

Expected: PASS.

- [x] **Step 6: Commit do checkpoint**

~~~bash
git add worker/repositories/agendas.ts worker/routes/admin-agendas.ts worker/app.ts shared/agenda.ts tests/worker/import.test.ts
git commit -m "feat: import and replace agendas"
~~~


**Checkpoint Task 6 — concluído em 24/09/2026**
- Importação inicial, duplicidade e substituição explícita implementadas.
- Replace preserva status e histórico por protocolo, adiciona novos como aguardando e desativa removidos.
- Escritas de importação/substituição usam D1.batch() para atomicidade.
- Consultas administrativas de agenda e histórico de status implementadas.
- Verificação final: GitHub Actions #117 passou.

---

### Task 7: API da loja, agenda de hoje, histórico e status auditável

**Files:**
- Create: worker/routes/store-agendas.ts
- Modify: worker/repositories/agendas.ts
- Create: worker/lib/time.ts
- Create: tests/worker/store-agendas.test.ts
- Modify: worker/app.ts

**Interfaces:**
- Produces:
  - GET /api/store/today
  - GET /api/store/history
  - GET /api/store/history/:date
  - GET /api/store/appointments/:id
  - PATCH /api/store/appointments/:id/status
- Todas as consultas usam loja_id derivado do usuário autenticado.

- [x] **Step 1: Escrever testes de isolamento e consulta**

Cobrir:
- loja A vê agenda A;
- loja A não obtém detalhe da loja B;
- loja A não muda status da loja B;
- today usa America/Sao_Paulo;
- histórico lista apenas dias da loja;
- agendamentos vêm ordenados por horario_inicio.

- [x] **Step 2: Escrever testes de status**

Payload permitido:

~~~ts
const ChangeStatusInput = z.object({
  status: z.enum(["recebido", "nao_chegou", "recusado", "aguardando"])
});
~~~

Cobrir:
- mudança grava novo status;
- cria uma linha em historico_status;
- status anterior e novo são corretos;
- status inválido retorna 400;
- frontend pode corrigir um status posteriormente.

- [x] **Step 3: Implementar utilitário de data de negócio**

businessDate(now) deve produzir YYYY-MM-DD em America/Sao_Paulo. Testar transição perto de meia-noite UTC para evitar usar a data UTC errada.

- [x] **Step 4: Implementar rotas com filtro de loja obrigatório**

Nenhuma rota de loja recebe lojaId do cliente. O lojaId vem do usuário da sessão.

- [x] **Step 5: Implementar mudança de status**

Executar UPDATE do agendamento e INSERT do histórico no mesmo DB.batch; se uma das operações falhar, o batch inteiro deve ser revertido.

- [x] **Step 6: Rodar testes**

~~~bash
npm test -- tests/worker/store-agendas.test.ts
npm run typecheck
~~~

Expected: PASS.

- [x] **Step 7: Commit do checkpoint**

~~~bash
git add worker/routes/store-agendas.ts worker/repositories/agendas.ts worker/lib/time.ts worker/app.ts tests/worker/store-agendas.test.ts
git commit -m "feat: add store agenda workflow"
~~~


**Checkpoint Task 7 — concluído em 24/09/2026**
- Rotas da loja implementadas com isolamento por loja_id derivado da sessão.
- Agenda de hoje usa America/Sao_Paulo e histórico retorna somente dados da própria loja.
- Mudança de status e historico_status são gravados no mesmo D1.batch().
- Testes cobrem isolamento entre lojas, ordenação, correção de status e rollback.
- Verificação final: GitHub Actions #123 passou.

---

### Task 8: Shell de autenticação e navegação da SPA

**Files:**
- Create: src/lib/api.ts
- Create: src/auth/AuthProvider.tsx
- Create: src/auth/LoginPage.tsx
- Create: src/auth/ProtectedRoute.tsx
- Modify: src/App.tsx
- Create: tests/ui/login.test.tsx

**Interfaces:**
- Produces: apiFetch<T>() com credentials=include e erro tipado.
- Produces: AuthProvider com user, loading, login, logout e refresh.
- Produces: rotas separadas /admin/* e /app/*.

- [x] **Step 1: Escrever testes da tela de login**

Cobrir:
- mostra login/senha;
- erro de credencial mostra mensagem neutra;
- admin é enviado para /admin;
- loja é enviada para /app;
- rota de perfil errado redireciona sem renderizar conteúdo protegido.

- [x] **Step 2: Implementar apiFetch**

~~~ts
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include" });
  if (!response.ok) throw await ApiError.fromResponse(response);
  return response.json() as Promise<T>;
}
~~~

- [x] **Step 3: Implementar AuthProvider e rotas protegidas**

Ao iniciar, chamar GET /api/auth/me. Nunca guardar senha ou cookie em localStorage.

- [x] **Step 4: Implementar layout base responsivo**

Navegação:
- Admin: Dashboard, Histórico, Importar, Lojas, Usuários.
- Loja: Hoje, Histórico.
- Ambos: Sair.

- [x] **Step 5: Rodar testes**

~~~bash
npm test -- tests/ui/login.test.tsx
npm run typecheck
~~~

Expected: PASS.

- [x] **Step 6: Commit do checkpoint**

~~~bash
git add src/lib src/auth src/App.tsx tests/ui/login.test.tsx
git commit -m "feat: add authenticated app shell"
~~~


**Checkpoint Task 8 — concluído em 24/09/2026**
- SPA autenticada com restauração de sessão via /api/auth/me e cookies enviados por credentials=include.
- Rotas /admin/* e /app/* protegidas por perfil, com redirecionamento seguro.
- Login, logout e navegação responsiva implementados sem armazenar senha ou sessão no localStorage.
- Testes React isolados em jsdom, separados da suíte Worker/D1.
- Verificação final: GitHub Actions #129 passou.

---

### Task 9: Painel administrativo e fluxo de importação com prévia

**Files:**
- Create: src/admin/AdminLayout.tsx
- Create: src/admin/DashboardPage.tsx
- Create: src/admin/AdminAgendaHistoryPage.tsx
- Create: src/admin/StoresPage.tsx
- Create: src/admin/UsersPage.tsx
- Create: src/admin/ImportAgendaPage.tsx
- Create: tests/ui/import.test.tsx
- Create: tests/ui/admin-history.test.tsx
- Modify: src/App.tsx
- Modify: src/styles.css

**Interfaces:**
- Consome: parser, extractPdfText e APIs administrativas.
- Produces: CRUD visual de lojas/usuários, dashboard, consulta de agendas históricas e importação com prévia.

- [ ] **Step 1: Escrever testes do fluxo de importação**

Cobrir:
- selecionar PDF exibe carregando;
- parser válido exibe loja, data, total e tabela;
- blockingErrors desabilitam Confirmar;
- agenda existente exibe opção Substituir;
- confirmação normal não envia replace;
- substituição só envia replace=true após confirmação explícita.

- [ ] **Step 2: Implementar Dashboard e histórico administrativo**

Exibir cards/resumo por loja com total e contagem por status. Loja sem agenda do dia deve ser identificável.

AdminAgendaHistoryPage deve permitir filtrar por loja e data, abrir os agendamentos da agenda selecionada e consultar o histórico de alterações de status. Nenhuma mutação de status é feita nesta tela administrativa.

Escrever tests/ui/admin-history.test.tsx cobrindo filtro por loja/data, abertura dos detalhes e exibição do histórico de status.

- [ ] **Step 3: Implementar Lojas e Usuários**

Formulários simples, validação de campos, feedback de sucesso/erro e ativar/desativar.

- [ ] **Step 4: Implementar ImportAgendaPage**

Fluxo:
1. escolher arquivo .pdf;
2. extractPdfText;
3. parseAgendaText;
4. mostrar prévia;
5. bloquear se houver blockingErrors;
6. POST de confirmação;
7. tratar 409 com diálogo de substituição;
8. repetir POST com replace=true apenas após ação explícita.

- [ ] **Step 5: Aplicar layout responsivo e acessível**

Botões e status devem ter texto/ícone, não depender somente de cor. Inputs devem possuir label. Tabelas devem ter cabeçalhos.

- [ ] **Step 6: Rodar testes**

~~~bash
npm test -- tests/ui/import.test.tsx tests/ui/admin-history.test.tsx
npm run typecheck
npm run build
~~~

Expected: PASS e build exit 0.

- [ ] **Step 7: Commit do checkpoint**

~~~bash
git add src/admin src/App.tsx src/styles.css tests/ui/import.test.tsx tests/ui/admin-history.test.tsx
git commit -m "feat: add admin dashboard and import flow"
~~~

---

### Task 10: Tela da loja — Hoje, detalhes, status e histórico

**Files:**
- Create: src/agenda/TodayPage.tsx
- Create: src/agenda/HistoryPage.tsx
- Create: src/agenda/AgendaList.tsx
- Create: src/agenda/AgendaDetails.tsx
- Create: src/agenda/StatusControl.tsx
- Create: tests/ui/agenda.test.tsx
- Modify: src/App.tsx
- Modify: src/styles.css

**Interfaces:**
- Consome: APIs /api/store/*.
- Produces: lista desktop, cards mobile, detalhes, status e histórico.

- [ ] **Step 1: Escrever testes da agenda de hoje**

Cobrir:
- resumo total/aguardando/recebido/não chegou/recusado;
- ordenação por horário;
- estado sem agenda de hoje;
- desktop mostra colunas essenciais;
- componente mobile mantém horário, fornecedor, protocolo e status.

- [ ] **Step 2: Escrever testes da atualização de status**

Cobrir:
- padrão aguardando;
- clicar Recebido chama API;
- UI só muda após resposta 2xx;
- falha mantém status anterior e mostra erro;
- Não chegou e Recusado funcionam;
- correção posterior também funciona.

- [ ] **Step 3: Implementar detalhes**

Mostrar todos os campos importados, NF-e, pedidos, tipo, status e histórico de alterações.

- [ ] **Step 4: Implementar Histórico**

Lista datas disponíveis; selecionar data busca somente aquela agenda. Não misturar dias anteriores na tela Hoje.

- [ ] **Step 5: Implementar responsividade**

CSS:
- desktop: tabela;
- telas estreitas: cards;
- status com texto e indicador visual;
- alvo de toque confortável para ações.

- [ ] **Step 6: Rodar testes**

~~~bash
npm test -- tests/ui/agenda.test.tsx
npm run typecheck
npm run build
~~~

Expected: PASS.

- [ ] **Step 7: Commit do checkpoint**

~~~bash
git add src/agenda src/App.tsx src/styles.css tests/ui/agenda.test.tsx
git commit -m "feat: add store agenda screens"
~~~

---

### Task 11: Hardening, documentação, implantação e aceite final

**Files:**
- Modify: worker/app.ts
- Create: worker/lib/http.ts
- Create: README.md
- Create: .github/workflows/ci.yml
- Modify: docs/superpowers/specs/2026-09-24-agenda-prado-design.md
- Modify: docs/superpowers/plans/2026-09-24-agenda-prado-implementation.md

**Interfaces:**
- Produces: app preparada para deploy, CI, documentação de operação e checklist final fechado.

- [ ] **Step 1: Adicionar proteções HTTP**

Aplicar:
- Content-Type correto;
- Cache-Control: no-store em auth e dados de agenda;
- validação de Origin nas mutações autenticadas;
- limite de tamanho razoável do JSON de importação;
- respostas de erro sem stack trace em produção.

- [ ] **Step 2: Rodar suíte completa**

~~~bash
npm test
npm run typecheck
npm run build
~~~

Expected:
- 0 testes falhando;
- typecheck exit 0;
- build exit 0.

- [ ] **Step 3: Aplicar migration remota**

~~~bash
npx wrangler d1 migrations apply agendas-prado --remote
~~~

Expected: migrations aplicadas sem erro.

- [ ] **Step 4: Configurar segredo de sessão**

~~~bash
npx wrangler secret put SESSION_SECRET
~~~

Usar um valor aleatório forte gerado fora do repositório.

- [ ] **Step 5: Criar primeiro administrador**

Executar bootstrap-admin com ADMIN_NAME, ADMIN_LOGIN e ADMIN_PASSWORD definidos somente no ambiente local do operador. Depois validar login pelo app.

- [ ] **Step 6: Fazer deploy**

~~~bash
npm run deploy
~~~

Expected: Wrangler retorna URL do Worker/deploy concluído.

- [ ] **Step 7: Rodar aceite manual com o PDF real**

Sem commit do arquivo:
1. login como admin;
2. cadastrar loja correspondente;
3. importar QUINTA LOJA 03.pdf;
4. validar prévia;
5. confirmar;
6. entrar como usuário da loja;
7. conferir agenda de hoje;
8. alterar um item para recebido;
9. validar histórico do status;
10. voltar ao admin e validar consulta da agenda histórica e do histórico do status;
11. confirmar isolamento com outro usuário de loja;
12. reenviar o mesmo PDF e validar que não duplica;
13. testar substituição explícita.

- [ ] **Step 8: Criar README operacional**

Documentar:
- pré-requisitos;
- npm install;
- dev/test/build;
- criação e migrations D1;
- bootstrap admin;
- deploy;
- fluxo diário do admin;
- fluxo do conferente;
- política de não commitar PDFs reais.

- [ ] **Step 9: Criar CI**

.github/workflows/ci.yml roda em pull_request e push:
- npm ci
- npm test
- npm run typecheck
- npm run build

- [ ] **Step 10: Atualizar spec e plano**

Marcar Status da spec como Implementado somente após aceite completo. Marcar todas as tasks deste plano [x] conforme evidência real de cada checkpoint.

- [ ] **Step 11: Commit final de documentação e CI**

~~~bash
git add README.md .github worker docs
git commit -m "chore: finalize Agenda Prado v1"
~~~

---

## Execution Order

1. Task 1 — scaffold
2. Task 2 — D1/schema
3. Task 3 — auth
4. Task 4 — lojas/usuários
5. Task 5 — parser PDF
6. Task 6 — importação/substituição
7. Task 7 — API da loja/status
8. Task 8 — shell/login
9. Task 9 — admin UI/importação
10. Task 10 — loja UI/histórico
11. Task 11 — hardening/deploy/aceite

Nenhuma task deve começar antes de a anterior ter sua verificação executada e o checkpoint registrado.
