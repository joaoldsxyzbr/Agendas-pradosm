# Adaptação visual da preview para a main

Este diretório contém somente a candidata visual para a arquitetura da `main`.

- Não alterar APIs, rotas, permissões, autenticação ou D1.
- A `preview` continua servindo sua própria interface e seu D1 isolado.
- Os cinco arquivos sob `visual-promotion/` são aplicados **sobre a main** somente durante a CI de validação ou na promoção final.
- Nunca mesclar a `preview` inteira na `main`.
- Verificação: workflow `visual-promotion-verify.yml` — testes, build, dry-run e E2E mockados.
- Publicação: copiar somente esses cinco arquivos para as mesmas rotas da `main`, após homologação e autorização.
