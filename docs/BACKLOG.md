# Backlog compartilhado — Core Manager Storage Provider

Atualizado em 23/10/2026, Brasília. Referências: [inventário atual](INVENTARIO_E_CONTINUIDADE_2026-10-20.md) e [plano de evolução](PLANO_EVOLUCAO_CORE_STORAGE_PROVIDER_2026-10-23.md).

| Prioridade | Iniciativa | Estado | Próxima ação / gate |
| --- | --- | --- | --- |
| Preservar | Cloudinary | Sucesso homologado | Preservar legado; CLOUDINARY-07 inativo |
| Operar | R2-01 | Publicação confirmada | Monitorar |
| P0 | R2-02 | Novo fluxo integral não confirmado | Obter evidência sanitizada de release integral |
| P0 | B2-01 (12) | Upload/deduplicação e reserva demonstrados | Confirmar execução completa após correções |
| Operar | B2-02 (13) | Publicação confirmada | Monitorar |
| Operar | R2-03 (14) | Publicação confirmada | Monitorar |
| Operar | R2-04 (15) | Publicação confirmada | Monitorar |
| P0 | R2-05 (16) | Testes isolados e cadastro inativo confirmados | Consultar estado real; confirmar ativação e publicação integrada |
| P0 | R2-06 (17) | Testes isolados e cadastro inativo confirmados | Consultar estado real; confirmar ativação e publicação integrada |
| P0 | R2-07 (18) | Testes isolados e cadastro inativo confirmados em 21/10 | Revisar/efetivar ativação preparada e confirmar publicação integrada |
| P1 | Baseline operacional | Artefatos públicos não equivalem integralmente ao runtime | Recuperar export atual, Code nodes, Worker R2 e `SHOW CREATE PROCEDURE` |
| P2 | Retry de até três tentativas | Falha real sanitizada; candidato local preparado; `Prepara Tentativa` criado, ainda sem evidência de saída | Validar contexto/binário do node; depois substituir `Normaliza` e implantar reconciliação nos dois Workers |
| P3 | Monitoramento R2/B2 | Objetivo aprovado, não implantado | Fechar APIs, acesso de leitura, modelo, limites e canal de alerta |
| P4 | Entrega R2 de produção | URLs `r2.dev` usadas em homologação | Planejar domínio/CDN, compatibilidade e rollback |
| Aguardar | OCI | Apenas sugestão | Reavaliar somente se priorizado |

## Ordem de evolução consolidada em 23/10

1. **P0 — evidência:** fechar R2-05, R2-06, R2-07, R2-02 e B2-01 sem forçar o rodízio.
2. **P1 — baseline:** recuperar e sanitizar os artefatos efetivamente operacionais antes de editar o fluxo.
3. **P2 — resiliência:** homologar retry de até três tentativas a partir da primeira falha real.
4. **P3 — observabilidade:** implementar monitoramento R2/B2 inicialmente sem bloqueio automático.
5. **P4 — produção:** definir entrega R2, compatibilidade de URLs, SLOs e rollback.

Critérios de aceite, dependências e limites estão no [plano de evolução de 23/10](PLANO_EVOLUCAO_CORE_STORAGE_PROVIDER_2026-10-23.md). Esta consolidação não executou ativações, imports, procedures ou testes contra runtimes operacionais.

## Próxima retomada de falha

O gatilho ocorreu em B2-01 em 23/10: `b2_upload_failed`, HTTP 502 e upstream 520. A evidência e o candidato estão em [Falha B2-01 e preparação do retry](FALHA_B2_01_E_RETRY_2026-10-23.md). Classificar erro sanitizado; finalizar e validar reserva antes de nova; preservar binário/contexto e limitar tentativas. Cooldown temporário impede repetição imediata da conta. Timeout ou resposta ambígua pode ter escrito objeto e deve ser reconciliado. Falha de finalização e tentativas esgotadas encerram com erro. Os artefatos locais não provam implantação do laço.

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
