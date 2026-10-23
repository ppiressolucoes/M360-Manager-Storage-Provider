# Proxy B2 de homologação

Arquivo para colar no editor Cloudflare: `flow-b2-storage-proxy-hml.mjs` (Worker Module, sem dependências).

Em 23/10/2026, após uma resposta real `b2_upload_failed` com status upstream 520, o arquivo passou a reconciliar PUT ambíguo com um novo HEAD. Se o objeto existir com o tamanho esperado, retorna sucesso com `reconciled_after_put_error=true`; caso contrário, retorna estado estruturado para o fallback. O usuário implantou a revisão nos Workers B2-01 e B2-02 e validou `/health` com `configured=true`. Depois, B2-01 aprovou health autenticado e upload controlado de objeto novo; B2-02 ainda precisa repetir esses gates na revisão atual.

Worker: `flow-b2-storage-proxy-hml.core360.workers.dev`.
Bucket privado confirmado pelo usuário: `core360-storage-b2-hml`.
Endpoint: `https://s3.us-east-005.backblazeb2.com`; região `us-east-005`.

Secrets: `B2_KEY_ID`, `B2_APPLICATION_KEY`, `PROXY_KEY`.
Variables: `B2_BUCKET_NAME`, `B2_REGION`, `B2_S3_ENDPOINT`, `PUBLIC_BASE_URL`.
PUBLIC_BASE_URL deve ser a origem HTTPS do Worker, sem caminho.
Não usar binding MEDIA_BUCKET; o acesso B2 é S3 autenticado por Signature V4.

Rotas:
- GET /health: verifica presença de configuração; não atesta acesso/escrita no bucket.
- GET /health/storage: exige X-Proxy-Key e executa somente um HEAD assinado sobre uma chave-sentinela; `probe_status=404` e `bucket_read_verified=true` confirmam autenticação, endpoint, bucket e leitura/listagem suficientes para a deduplicação. Não grava objetos nem atesta `writeFiles`.
- POST /upload: exige X-Proxy-Key e body binário, máximo 10 MiB.
- GET/HEAD /<portal>/featured/<sha256>.<extensão>: entrega pública de objeto do bucket privado.

Headers de upload: x-storage-folder, x-media-sha256, x-file-extension, x-original-filename, x-media-width, x-media-height, Content-Type.
Portais permitidos: m360, pel, trilhas; formatos: JPEG/jpg, PNG/png, WebP/webp.
Hash é recalculado pelo Worker. Dimensões são fornecidas pelo n8n e validadas como inteiros positivos, não extraídas do arquivo no Worker. Assinatura básica do formato é conferida; não substitui decodificação completa.

Deduplicação HEAD antes de PUT; chamadas simultâneas da mesma chave ainda podem criar versões adicionais no B2. Cache público de arquivos por hash: um ano, immutable. Só imagens nos caminhos permitidos são expostas; não há listagem pública do bucket.

Validação local realizada: sintaxe e simulações de autenticação inválida, rejeição de hash, upload, deduplicação sequencial, entrega pública, reconciliação de PUT ambíguo e health autenticado do storage com respostas upstream 404/403. O agente não implantou diretamente; o usuário confirmou deployment da versão anterior e uploads reais nos Workers B2-01 e B2-02. Deduplicação demonstrada em ambos; leitura pública e publicação WordPress confirmadas para B2-02. Detalhes e limites no [registro atualizado](../docs/EVOLUCAO_B2_E_CONTINUIDADE_2026-10-14.md) e no [registro da falha de 23/10](../docs/FALHA_B2_01_E_RETRY_2026-10-23.md).

B2-02 utiliza o mesmo código, Worker `flow-b2-02-storage-proxy-hml.core360.workers.dev`, bucket `core360-02-storage-b2-hml` e secrets independentes. Não substituir a configuração de B2-01 ao criar nova conta.

Para o retry v1, publicar exatamente a mesma revisão reconciliadora em `flow-b2-storage-proxy-hml` (B2-01) e `flow-b2-02-storage-proxy-hml` (B2-02). Cada deployment conserva suas próprias variáveis `B2_BUCKET_NAME`, `B2_REGION`, `B2_S3_ENDPOINT`, `PUBLIC_BASE_URL` e seus próprios secrets `B2_KEY_ID`, `B2_APPLICATION_KEY`, `PROXY_KEY`. Não copiar valores entre contas e não versioná-los.

Em 23/10/2026, B2-01 respondeu ao health autenticado de storage com `probe_status=404` e `bucket_read_verified=true`. Em seguida, um upload controlado criou objeto novo com `existing=false` e `reconciled_after_put_error=false`, aprovando o PUT do deployment atual. A repetição do mesmo upload retornou `existing=true`, comprovando HEAD de objeto existente e deduplicação sem novo PUT; a entrega pela URL pública também foi validada. `bucket_write_verified=false` permanece na resposta do health por desenho: a rota é somente leitura e não persiste estado de homologação.

B2-02 recebeu a mesma revisão, mas seu primeiro health autenticado retornou `probe_status=403` e `bucket_read_verified=false`. Após criar um novo Application Key e atualizar juntos os dois secrets da segunda conta, o probe passou a `probe_status=404` e `bucket_read_verified=true`. O contraste confirma a configuração anterior como causa do 403, não o módulo comum ou o proxy do n8n. A chave anterior deve permanecer para rollback até PUT, deduplicação e entrega pública serem aprovados.

Em 23/10/2026, o usuário preservou e forneceu os códigos então implantados nos dois Workers. Os arquivos são idênticos entre si e correspondem à versão do repositório anterior à reconciliação, após normalizar CRLF/LF; a verificação local não encontrou credenciais literais. Assim, o diff candidato está limitado à reconciliação pós-PUT e ao campo de resposta associado. Os anexos não foram duplicados no Git porque o baseline já é recuperável pelo histórico.

Custos não são garantidamente zero: monitorar quotas B2 e Workers. Cache reduz acessos, mas não elimina misses nem operações de upload.
