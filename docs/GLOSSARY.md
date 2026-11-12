# Glossário

Uma definição por termo. Vocabulário de domínio, sem detalhe de implementação.

- **Aviso**: mensagem exibida no sino de avisos, publicada por um admin ou gerada por um evento do sistema. Tipos: `aviso` (publicado por admin) e `evento` (gerado automaticamente).
- **Notificação**: o aviso no momento em que aparece na interface (sino, badge, painel). A entidade persistida é sempre um aviso.
- **Lido**: estado por usuário — um aviso só fica lido quando o próprio usuário o marca; não existe leitura implícita.
- **Urgente**: aviso marcado pelo publicador como prioritário; destaca o card e faz o badge do sino pulsar em vermelho enquanto houver urgente não lido.
- **Público**: quem vê o aviso — todas as lojas (padrão) ou apenas as lojas escolhidas na publicação. Avisos nunca são excluídos: a lista é o histórico permanente.
