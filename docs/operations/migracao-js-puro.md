# Migração de tecnologia para JavaScript puro

Início: 18/10/2026  
Branch de trabalho: `migracao-js-puro`  
Origem: `main` no commit `7981580e102d507680b6f956d3f6059bd3a97d0d`

## Missão única e limite de escopo

**Converter 100% da implementação de produção para JavaScript puro (ES Modules), HTML e CSS, sem React, TypeScript ou Vite.** Não é um projeto de redesenho, evolução funcional, refatoração desnecessária, criação de recursos, alteração de negócio ou migração de banco.

A `main` é a especificação funcional e visual de referência. A `preview` pode ser usada para estudar trechos de código nativo reaproveitáveis, **mas não deve ser copiada indiscriminadamente**, pois os comportamentos e o layout não são idênticos aos da produção.

### Não alterar nesta missão

- Layout, identidade visual, cores, ordem das colunas, fluxos de usuário e textos exibidos na `main`.
- Contratos/API, credenciais, cookies/sessões, autorização por perfil, regras de negócio, auditoria e histórico.
- Estrutura, esquema, migrations e conteúdo do D1 da produção; manter `0017_appointment_observation.sql` restrita à `preview`, a menos que haja autorização futura específica.
- Regras de fechamento diário, cron do Worker, presença, WebSocket, Durable Object e atualizações de dados sem piscar.
- `main` e `preview` durante o desenvolvimento. Nunca vincular esta branch ao Worker de produção.

### Converter de forma fiel

| Área de origem na `main` | Destino esperado em JavaScript puro |
| --- | --- |
| `src/App.tsx`, autenticação, layouts e rotas | JS ES Modules com roteamento nativo e URLs/navegação compatíveis |
| `src/admin/`, `src/agenda/` | Telas, modais, componentes e estados nativos com paridade visual e operacional |
| `src/realtime/`, `src/presence/` | Atualização incremental e presença preservadas, com WebSocket real e fallback |
| `src/import/`, exportação PDF | Parser e geração dos mesmos documentos, preservando contratos |
| `worker/**/*.ts` e `shared/**/*.ts` | JavaScript ES Modules, mantendo validações Zod, Hono e comportamentos |
| Testes/configurações `.ts`/`.tsx`, Vite e TypeScript | Testes JS e configuração Wrangler/Workers sem Vite ou TypeScript |
| `package.json` e lockfile | Dependências e scripts coerentes sem React, React DOM, React Router, TypeScript ou Vite |

### Critérios de aceite

1. O projeto mantém exatamente as funcionalidades, os dados de saída e o comportamento da `main`, inclusive em casos de erro e acesso negado.
2. Não restam arquivos de código-fonte/testes em TypeScript/TSX, imports de React ou builds Vite; a interface utiliza HTML/CSS/JS ES Modules.
3. Login/logout, permissões, usuários, lojas, agenda, fornecedores sem agenda, importação CSV/PDF, exportação PDF, relatórios, histórico, auditoria, reabertura, status, trocas, presença e atualização em tempo real estão equivalentes à produção.
4. Testes unitários, de integração, de paridade, E2E por perfil, acessibilidade e CI totalmente aprovados.
5. Alterações testadas no banco mockado/isolado e validadas visual e funcionalmente pelo usuário.
6. **Nenhuma promoção à `main` sem autorização explícita.**

### Fluxo autorizado

`migracao-js-puro` (desenvolvimento) → `preview` (homologação isolada) → validação do usuário → `main` (apenas com autorização explícita).

### Estado

- [x] Branch exclusiva criada a partir da `main`.
- [x] Missão tecnológica delimitada sem alterações visuais/funcionais.
- [ ] Inventário e comparação de comportamento completos.
- [ ] Conversão fiel de todo o código da aplicação.
- [ ] Remoção controlada de React/TypeScript/Vite.
- [ ] CI/E2E aprovados com ambiente D1 isolado.
- [ ] Homologação na `preview` e autorização do usuário.

**Esta etapa registra somente o escopo. A conversão do código ainda não foi concluída.**
