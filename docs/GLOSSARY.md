# Glossário

Uma definição por termo. Vocabulário de domínio, sem detalhe de implementação.

- **Aviso**: mensagem exibida no sino de avisos, publicada por um admin ou gerada por um evento do sistema. Tipos: `aviso` (publicado por admin) e `evento` (gerado automaticamente).
- **Notificação**: o aviso no momento em que aparece na interface (sino, badge, painel). A entidade persistida é sempre um aviso.
- **Lido**: estado por usuário — um aviso só fica lido quando o próprio usuário o marca; não existe leitura implícita.
