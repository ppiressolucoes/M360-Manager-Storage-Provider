# Backlog compartilhado — Core Manager Storage Provider

Atualizado em 20/10/2026, Brasília. Referência: [inventário atual](INVENTARIO_E_CONTINUIDADE_2026-10-20.md).

| Iniciativa | Estado | Próxima ação |
| --- | --- | --- |
| Cloudinary | Sucesso homologado | Preservar legado; CLOUDINARY-07 inativo |
| R2-01 | Publicação confirmada | Monitorar |
| R2-02 | Novo fluxo integral não confirmado | Obter evidência de release |
| B2-01 (12) | Upload/deduplicação e reserva demonstrados | Confirmar execução completa após correções |
| B2-02 (13) | Publicação confirmada | Monitorar |
| R2-03 (14) | Publicação confirmada | Monitorar |
| R2-04 (15) | Publicação confirmada | Monitorar |
| R2-05 (16) | Testes isolados e cadastro inativo confirmados | Confirmar ativação e publicação integrada |
| R2-06 (17) | Testes isolados e cadastro inativo confirmados | Confirmar ativação e publicação integrada |
| R2-07 (ID pendente) | Health, upload, leitura pública e deduplicação confirmados em 21/10 | Executar cadastro inativo preparado, confirmar ID e homologar integração |
| Retry de até três tentativas | Aprovado, não implantado/homologado | Retomar na primeira falha real, conforme decisão vigente |
| Monitoramento R2/B2 | Objetivo aprovado, não implantado | Definir APIs, acesso de leitura, modelo e canal de alerta |
| OCI | Apenas sugestão | Reavaliar somente se priorizado |

## Próxima retomada de falha

Classificar erro sanitizado; finalizar e validar reserva antes de nova; preservar binário/contexto e limitar tentativas. Bloqueio 0 não impede repetição da conta; timeout pode ter escrito objeto. Falha de finalização e tentativas esgotadas encerram com erro. Não afirmar que laço ou Contexto da Tentativa já existem.

## Monitoramento

Coletar por conta/bucket sem duplicar franquias; tratar última leitura válida e SEM_LEITURA; limites por unidade/período configuráveis; definir canal, mudança de nível e recuperação. Não bloquear automaticamente pool na primeira versão proposta. Export Cloudinary arquivado não contém node de notificação.

## Pendências transversais e artefatos

- Confrontar SQL reconstruído com SHOW CREATE PROCEDURE do runtime; sem aplicar automaticamente.
- Obter export operacional sanitizado atual do storage e código completo R2; baseline existente não foi reimportado após sanitização.
- Validar concorrência, TTL e datas históricas UTC/UTC−3 antes de migração.
- Revisar erros anteriores ao HTTP, pool vazio e driver desconhecido para evitar reserva órfã.
- Avaliar histórico separado de reservas; tabela atual mantém estado operacional.
- Revisar retenção de execuções e rotação recomendada de secrets expostas; não confirmada.
- Investigar permissão/redirecionamento pós-save no Registry; cadastro persistiu, causa não confirmada.
- Planejar entrega R2 adequada ao tráfego de produção e compatibilidade das URLs antigas.
- Manter JSON/Code nodes/SQL por fluxo e sprint conforme [catálogo](ARTEFATOS_DAS_SPRINTS.md); sincronizar GitHub ao concluir ações, sem secrets.
