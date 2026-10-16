# Cópia isolada do D1 para testes — 16/10/2026

## Objetivo

Reproduzir **volume, datas, status, relacionamentos e índices** do D1 da produção com valores operacionais pseudonimizados, sem expor credenciais ou documentos reais e sem interferir na produção.

## Bancos

| Papel | D1 | UUID | Estado |
| --- | --- | --- | --- |
| Produção (somente leitura) | `agendas-pradosm` | `0a7d7d8b-e033-4644-90d4-fbc9ddc64532` | Intacto |
| Preview existente (mock) | `agendas-pradosm-preview` | `716cc88e-7da8-400e-b4be-edc4be0c9c03` | Intacto e ainda vinculado ao Worker |
| Cópia para validar | `agendas-pradosm-preview-copia` | `6b2c7fec-5fbf-4db7-a0c4-d51860799c29` | Criado e validado; **não vinculado ao Worker** |

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

## Antes de usar a cópia na aplicação

O Worker `preview` **continua apontando para o D1 mock original**. Não apontar para a produção. Antes de mudar qualquer configuração:

1. Preparar contas e hashes de senha **exclusivos para teste** no D1 copiado; os usuários pseudonimizados não conseguem autenticar usando senhas reais. Garantir o login rápido dos três perfis apenas no ambiente de testes.
2. Confirmar compatibilidade de Worker/API e da migração 17, sem rodar seed destrutivo no banco copiado.
3. Testar importação, recebimento, relatórios, auditoria e permissões com dados da cópia e verificar se nenhum comando escreve no D1 da produção.
4. Revisar `wrangler.jsonc` apenas na branch `preview`, com autorização para troca de binding. A branch `main` e sua conexão de produção permanecem intocadas.
5. Manter o banco mock disponível para testes independentes e não versionar dados corporativos, dump SQL, segredos nem credenciais no GitHub.

Para atualização futura da cópia, escolher processo controlado de novo snapshot e pseudonimização; **não** executar `wrangler d1 export` na produção sem avaliar impacto operacional.
