# Procedures do Core

- [Reserva](procedures/SP_Core_Storage_Reserva.sql)
- [Finalização](procedures/SP_Core_Storage_Finaliza.sql)

Referências completas reconstruídas da última versão SQL entregue no chat: sessão UTC−3, restauração de fuso, rollback/RESIGNAL, resolução Cloudinary e retorno capturado. Não são export do banco e não foram executadas nesta entrega.

Sem DEFINER fixo; revisar proprietário/permissões no ambiente. DROP/CREATE substitui procedure: comparar SHOW CREATE PROCEDURE e guardar backup antes de qualquer aplicação. Requer tabelas Core_Storage_Provider e Config_API_IA existentes. Não aplicar dentro de transação de aplicação nem interpretar como migração de datas históricas.

Reserva operacional com provider NULL; num_count mede reservas, não quota. R2/B2 não recebem credenciais do bucket. Finalização aceita falha sem bloqueio com zero; token expirado pode ser aceito se ainda for o token corrente.
