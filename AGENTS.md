# Continuidade do Core Manager Storage Provider

- Leia README, backlog e consolidação mais recente antes de continuar.
- Registre decisões, alterações e resultados de banco, n8n, Workers e WordPress ao concluir ações. O usuário solicita manter o GitHub oficial sincronizado; faça commit/push quando autorizado pelo contexto, preservando mudanças remotas. Informe bloqueios e trabalho somente local.
- Mantenha JSON sanitizados, Code nodes por fluxo e SQL das SPs organizados. Diferencie export, reconstrução do chat, código fornecido e versão realmente aplicada. Não sobrescreva baseline sem identificar origem/validação.
- Nunca versione credenciais, Authorization/X-Proxy-Key, tokens de reserva ou dados fixados de execução. Sanitize anexos antes da inclusão.
- Entregue sempre código completo de node para substituição; trabalhe passo a passo no n8n.
- Rodízio global por SP com provider NULL. CLOUDINARY-07 definitivamente inativo. Não force reservas repetidas para testar um destino.
- Retry de três tentativas aprovado, mas pendente; decisão posterior: retomar quando ocorrer a primeira falha real.
- Use checkout isolado existente; não criar worktrees sem solicitação explícita.
