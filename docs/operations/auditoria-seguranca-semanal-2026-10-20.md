# Auditoria semanal automática de dependências — 20/10/2026

## Por que existe

A [auditoria #102](https://github.com/joaoldsxyzbr/Agendas-pradosm/issues/102) identificou que **Dependabot Alerts estão desativados** no repositório. O CI já executa `npm audit --omit=dev` quando há alterações, mas novas vulnerabilidades podem ser divulgadas mesmo sem commits.

O workflow [`.github/workflows/auditoria-seguranca.yml`](../../.github/workflows/auditoria-seguranca.yml) faz uma verificação semanal independente, **somente na branch padrão `main`**, usando `npm audit` da ferramenta oficial npm/Node.js. É também executável manualmente em *Actions → Auditoria semanal de seguranca → Run workflow*.

## Escopo e limites

- **Agenda:** segunda-feira, 12:17 UTC (09:17 de Brasília). Execuções agendadas no GitHub Actions podem atrasar.
- **Dependências de produção:** `npm audit --omit=dev --audit-level=moderate`; bloqueia vulnerabilidades moderadas, altas ou críticas.
- **Dependências de desenvolvimento:** `npm audit --audit-level=high`; considera todas as dependências, incluindo CI/build, e bloqueia vulnerabilidades altas ou críticas.
- **Não instala pacotes, não executa scripts da aplicação, não altera lockfile, não cria PR, não corrige automaticamente, não acessa D1, não faz deploy** e não usa secrets.
- O npm consulta o registro de advisories, enviando metadados de dependências e versões do lockfile, não dados de usuários do Agendas.
- Resultado `success` significa apenas que não foram encontradas vulnerabilidades acima dos limiares **conhecidas pelo registro npm no momento**; não é certificação de ausência de falhas e não substitui Dependabot Alerts.

## Como responder a uma falha

1. Abrir [GitHub Actions do repositório](https://github.com/joaoldsxyzbr/Agendas-pradosm/actions) e identificar pacotes e severidades mostrados em `Auditoria semanal de seguranca`.
2. Comparar avisos com dependências diretas/transitivas e código efetivamente usado. Não aplicar `npm audit fix --force` ou upgrades automáticos em produção.
3. Corrigir em PR isolado com dependência de origem verificada, lockfile coerente, testes, CodeQL e Cloudflare Preview verdes; testar homologação antes do merge.
4. Confirmar deploy de produção e reexecutar o workflow para provar que a vulnerabilidade não é mais reportada.

**Ação manual ainda necessária:** habilitar Dependabot Alerts no GitHub em *Settings → Security → Code security and analysis*. A rotina semanal é uma proteção complementar e não habilita esse serviço.
