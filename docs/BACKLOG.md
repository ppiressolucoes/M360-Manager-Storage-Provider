# Esteira do Core Manager Provider

## B2 — terceiro provider de imagens

Status em 14/10/2026: B2-01 e B2-02 cadastrados (IDs 12 e 13); Workers implantados pelo usuário. Upload e deduplicação demonstrados em ambos; entrega pública e publicação integrada confirmadas para B2-02. Ver [estado atual e continuidade](EVOLUCAO_B2_E_CONTINUIDADE_2026-10-14.md).

Objetivo: incluir `backblaze_b2` como terceiro provider, com primeiro storage `B2-01`, mantendo o rodízio global, a reserva/finalização e o contrato de mídia usado pelo WordPress.

### Decisão de integração

Seguir com proxy de upload B2 com contrato equivalente ao adapter R2. As credenciais B2 ficam no proxy, não no retorno da SP nem no fluxo pai. B2 não possui o binding R2 `MEDIA_BUCKET`: o proxy precisa implementar acesso autenticado ao B2, por exemplo pela API S3-compatible com assinatura apropriada.

Compatibilidade de contrato foi demonstrada com proxy próprio B2; n8n utiliza ramo por provider. O driver `s3_compatible` representa proxy HTTP, não cliente S3 genérico do n8n. Worker R2 não atende B2 por binding.

### Etapas

1. Confirmar conta B2, criar/identificar bucket de homologação, região e endpoint S3; definir URL HTTPS de entrega acessível pelo WordPress.
2. Preparar Application Key com acesso restrito ao bucket e operações necessárias. Guardar valores como secrets do proxy; não registrar valores no Git ou chat.
3. Preparar proxy B2: autenticação n8n→proxy, GET /health e POST /upload binário. Aceitar pasta, SHA-256, extensão, nome, MIME e dimensões conforme contrato R2. Não pressupor reutilização da chave padrão: confirmar sua configuração no novo proxy.
4. Implementar object key determinística, deduplicação e retorno uniforme: provider, sha256, asset_id, public_id, secure_url, url, width, height, mime_type, original_filename, bytes, existing. Não fabricar ID Cloudinary nem truncar hash.
5. Cadastrar B2-01 inativo em Core_Storage_Provider: provider backblaze_b2, driver s3_compatible somente se o contrato do proxy for compatível, endpoint_url do proxy, bucket_name, region_name e public_base_url. credential_ref pode ser NULL se as credenciais forem resolvidas exclusivamente no proxy.
6. Revisar o ramo S3/R2 e o node de fronteira para suportar B2 explicitamente, incluindo identificadores e autenticação. Manter adapters no mesmo workflow.
7. Cadastrar backblaze_b2 no Registry WordPress, delivery_mode passthrough e hosts HTTPS efetivos de entrega.
8. Homologar upload e repetição do mesmo arquivo, finalização e registro/associação WP. Validar erro, URL pública e isolamento das credenciais.
9. Ativar B2-01 no pool após preparação; manter CALL SP_Core_Storage_Reserva(NULL, 3) e CLOUDINARY-07 inativo. Validar seleção pelo rodízio e regressão dos providers existentes.

### Critérios de conclusão

- Upload e deduplicação B2 observados, não apenas health.
- Conta selecionada corresponde ao endpoint/bucket utilizados.
- Finalização aceita o token corrente e libera a reserva.
- Retorno ao pai contém somente dados de mídia válidos.
- WordPress registra, associa e entrega imagem pública HTTPS.
- Erros não deixam reserva órfã; retry limitado segue a implementação efetivamente validada.

## Pendências transversais

- Retry de até três tentativas aprovado, ainda sem implantação/homologação confirmada.
- Próxima tarefa após a pausa: classificar falhas, finalizar reserva e tentar novo storage com contexto preservado.
- B2-01 pendente de confirmação de publicação integrada; B2-02 concluído no caminho de sucesso.
- R2-02 pendente no novo workflow.
- Datas históricas UTC/UTC−3 pendentes de alinhamento.
- Concorrência, TTL e persistência de secrets em execuções n8n pendentes de revisão.

Referência: [implementação e homologação](HOMOLOGACAO_STORAGE_PROVIDER_2026-10-13.md).
