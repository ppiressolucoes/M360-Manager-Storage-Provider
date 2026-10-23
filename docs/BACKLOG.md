# Backlog compartilhado — Core Manager Storage Provider

Atualizado em 23/10/2026, Brasília. Referências: [inventário atual](INVENTARIO_E_CONTINUIDADE_2026-10-20.md) e [plano de evolução](PLANO_EVOLUCAO_CORE_STORAGE_PROVIDER_2026-10-23.md).

| Prioridade | Iniciativa | Estado | Próxima ação / gate |
| --- | --- | --- | --- |
| Preservar | Cloudinary | Sucesso homologado | Preservar legado; CLOUDINARY-07 inativo |
| Operar | R2-01 | Publicação confirmada | Monitorar |
| P0 | R2-02 | Novo fluxo integral não confirmado | Obter evidência sanitizada de release integral |
| P0 | B2-01 (12) | Alerta real: `b2_lookup_failed`, upstream 403 no HEAD inicial | Implantar health autenticado; corrigir chave/capabilities/escopo até o probe retornar 404 |
| P0 | B2-02 (13) | Alerta real: `b2_lookup_failed`, upstream 403 no HEAD inicial | Repetir correção independente após homologar B2-01 |
| Operar | R2-03 (14) | Publicação confirmada | Monitorar |
| Operar | R2-04 (15) | Publicação confirmada | Monitorar |
| P0 | R2-05 (16) | Testes isolados e cadastro inativo confirmados | Consultar estado real; confirmar ativação e publicação integrada |
| P0 | R2-06 (17) | Testes isolados e cadastro inativo confirmados | Consultar estado real; confirmar ativação e publicação integrada |
| P0 | R2-07 (18) | Testes isolados e cadastro inativo confirmados em 21/10 | Revisar/efetivar ativação preparada e confirmar publicação integrada |
| P1 | Baseline operacional | Export v0.4 e nove Code nodes recuperados/sanitizados; Worker R2 e DDLs ainda incompletos | Recuperar Worker R2 e `SHOW CREATE PROCEDURE` |
| P2 | Retry de até três tentativas | v0.4 homologada em falha real: B2 falhou, retry reservou R2 e concluiu com sucesso | Aplicar classificador candidato e publicar/auditar v0.5 |
| P3 | Monitoramento R2/B2 | Objetivo aprovado, não implantado | Fechar APIs, acesso de leitura, modelo, limites e canal de alerta |
| P4 | Entrega R2 de produção | URLs `r2.dev` usadas em homologação | Planejar domínio/CDN, compatibilidade e rollback |
| Aguardar | OCI | Apenas sugestão | Reavaliar somente se priorizado |

## Ordem de evolução consolidada em 23/10

1. **P0 — B2:** recuperar B2-01 e B2-02, começando pelo probe autenticado somente leitura de B2-01.
2. **P1 — classificação:** fallback real B2 → R2 homologado; publicar v0.5 com precedência do upstream 403.
3. **P2 — baseline/evidências restantes:** recuperar artefatos operacionais e fechar R2-02, R2-05, R2-06 e R2-07.
4. **P3 — observabilidade:** implementar monitoramento R2/B2 inicialmente sem bloqueio automático.
5. **P4 — produção:** definir entrega R2, compatibilidade de URLs, SLOs e rollback.

Critérios de aceite, dependências e limites estão no [plano de evolução de 23/10](PLANO_EVOLUCAO_CORE_STORAGE_PROVIDER_2026-10-23.md). Esta consolidação não executou ativações, imports, procedures ou testes contra runtimes operacionais.

## Próxima retomada de falha

O gatilho ocorreu em B2-01 em 23/10: `b2_upload_failed`, HTTP 502 e upstream 520. A evidência e o candidato estão em [Falha B2-01 e preparação do retry](FALHA_B2_01_E_RETRY_2026-10-23.md). Classificar erro sanitizado; finalizar e validar reserva antes de nova; preservar binário/contexto e limitar tentativas. Cooldown temporário impede repetição imediata da conta. Timeout ou resposta ambígua pode ter escrito objeto e deve ser reconciliado. Falha de finalização e tentativas esgotadas encerram com erro. Os artefatos locais não provam implantação do laço.

Após a publicação da v0.4, B2-01 e B2-02 produziram alertas reais independentes de `b2_lookup_failed`, com HTTP 502 do Worker e upstream 403 no `HEAD` inicial. Não houve tentativa de PUT nessas ocorrências. O alerta/finalização de falha está comprovado, mas os e-mails não demonstram a passagem pelo retorno do retry nem o resultado terminal. O candidato agora dá precedência ao status upstream 401/403/404, classifica como `configuracao_storage` e aplica cooldown de 60 minutos. A causa operacional deve ser tratada nas credenciais, capabilities e escopo de bucket de cada conta B2.

Uma captura completa de execução fornecida em seguida comprovou o restante do laço para uma ocorrência: após falhar no ramo B2, finalizar a reserva, alertar e restaurar o contexto, o IF retornou à preparação; a segunda reserva selecionou Cloudflare R2 e terminou em `Valida Finalização Sucesso`. Portanto, o retry entre providers está homologado em runtime. Continua pendente corrigir os dois acessos B2 e promover o classificador revisado para a v0.5.

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
