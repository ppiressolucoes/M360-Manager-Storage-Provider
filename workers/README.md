# Proxy B2 de homologação

Arquivo para colar no editor Cloudflare: `flow-b2-storage-proxy-hml.mjs` (Worker Module, sem dependências).

Worker: `flow-b2-storage-proxy-hml.core360.workers.dev`.
Bucket privado confirmado pelo usuário: `core360-storage-b2-hml`.
Endpoint: `https://s3.us-east-005.backblazeb2.com`; região `us-east-005`.

Secrets: `B2_KEY_ID`, `B2_APPLICATION_KEY`, `PROXY_KEY`.
Variables: `B2_BUCKET_NAME`, `B2_REGION`, `B2_S3_ENDPOINT`, `PUBLIC_BASE_URL`.
PUBLIC_BASE_URL deve ser a origem HTTPS do Worker, sem caminho.
Não usar binding MEDIA_BUCKET; o acesso B2 é S3 autenticado por Signature V4.

Rotas:
- GET /health: verifica presença de configuração; não atesta acesso/escrita no bucket.
- POST /upload: exige X-Proxy-Key e body binário, máximo 10 MiB.
- GET/HEAD /<portal>/featured/<sha256>.<extensão>: entrega pública de objeto do bucket privado.

Headers de upload: x-storage-folder, x-media-sha256, x-file-extension, x-original-filename, x-media-width, x-media-height, Content-Type.
Portais permitidos: m360, pel, trilhas; formatos: JPEG/jpg, PNG/png, WebP/webp.
Hash é recalculado pelo Worker. Dimensões são fornecidas pelo n8n e validadas como inteiros positivos, não extraídas do arquivo no Worker. Assinatura básica do formato é conferida; não substitui decodificação completa.

Deduplicação HEAD antes de PUT; chamadas simultâneas da mesma chave ainda podem criar versões adicionais no B2. Cache público de arquivos por hash: um ano, immutable. Só imagens nos caminhos permitidos são expostas; não há listagem pública do bucket.

Validação local realizada: sintaxe e simulações de autenticação inválida, rejeição de hash, upload, deduplicação sequencial e entrega pública. O agente não implantou diretamente; o usuário confirmou deployment e uploads reais nos Workers B2-01 e B2-02. Deduplicação demonstrada em ambos; leitura pública e publicação WordPress confirmadas para B2-02. Detalhes e limites no [registro atualizado](../docs/EVOLUCAO_B2_E_CONTINUIDADE_2026-10-14.md).

B2-02 utiliza o mesmo código, Worker `flow-b2-02-storage-proxy-hml.core360.workers.dev`, bucket `core360-02-storage-b2-hml` e secrets independentes. Não substituir a configuração de B2-01 ao criar nova conta.

Custos não são garantidamente zero: monitorar quotas B2 e Workers. Cache reduz acessos, mas não elimina misses nem operações de upload.
