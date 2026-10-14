# Core Manager Storage Provider — evolução e continuidade

Consolidação de 14/10/2026, referência de horário Brasília (`America/Sao_Paulo`, UTC−3).

Complementa o [registro de homologação inicial](HOMOLOGACAO_STORAGE_PROVIDER_2026-10-13.md). Fonte: configurações, saídas e confirmações do usuário nesta conversa. Não equivale a auditoria direta de banco, Cloudflare, n8n ou WordPress. Não inclui credenciais, tokens de reserva ou cabeçalhos de autorização.

## Estado na pausa

- Três providers: `cloudinary`, `cloudflare_r2`, `backblaze_b2`.
- B2 tem duas contas/buckets, representados pelos storages B2-01 e B2-02.
- Cloudinary e R2-01 tiveram caminho de publicação concluído anteriormente.
- B2-02 teve reserva, upload, finalização, retorno e publicação do artigo pelo fluxo de e-mail release confirmados pelo usuário.
- B2-01 teve upload/deduplicação e cadastro ativo confirmados. Sua primeira execução integrada terminou com problema de retorno após finalização; não foi apresentada nova execução integral B2-01 até publicação.
- Próxima tarefa acordada: validar retry de falha com nova reserva, máximo três tentativas. Ainda não implementado/homologado; ramo de erro atual termina em Stop And Error.

## Correção da integração editorial WordPress

No fluxo `SUB | WEB Extrator Detalhes M360 v0.3 | Core Editorial`, o registro em mengao360.com retornou HTTP 400, `m360_invalid_external_media`, reason `invalid_external_url`.

Causa confirmada pelo usuário: faltava `provider` no body do registro. Com `provider={{ $json.provider }}`, registro e vínculo foram concluídos. Não era falha do upload nem indisponibilidade do proxy.

Todos os fluxos editoriais devem transmitir provider e sha256 explicitamente. Não inferir provider pela pasta nem extrair sha256 de public_id como contrato principal.

## Infraestrutura B2

Bucket privado foi escolhido porque a conta apresentou cobrança de habilitação de bucket público. Entrega é pública via Worker autenticando acesso ao bucket privado. Isso evita essa habilitação, mas não garante custo zero: monitorar armazenamento, operações, tráfego e Workers.

| Storage | ID | Bucket privado | Worker e public_base_url |
| --- | ---: | --- | --- |
| B2-01 | 12 | core360-storage-b2-hml | https://flow-b2-storage-proxy-hml.core360.workers.dev |
| B2-02 | 13 | core360-02-storage-b2-hml | https://flow-b2-02-storage-proxy-hml.core360.workers.dev |

Ambos: região `us-east-005`, endpoint S3 `https://s3.us-east-005.backblazeb2.com`, criptografia habilitada e Object Lock desativado na configuração orientada. B2-02 foi criado em conta independente.

Nomes das Application Keys: `core360-storage-b2-worker-hml` e `core360-02-storage-b2-worker-hml`; restritas ao respectivo bucket, acesso Read and Write, sem prefixo e sem expiração configurada. Nenhum valor de chave é registrado aqui.

Cada Worker usa o [mesmo módulo](../workers/flow-b2-storage-proxy-hml.mjs), com configuração independente:

- Secrets: B2_KEY_ID, B2_APPLICATION_KEY, PROXY_KEY.
- Variáveis: B2_BUCKET_NAME, B2_REGION, B2_S3_ENDPOINT, PUBLIC_BASE_URL.
- PUBLIC_BASE_URL inclui `https://` e corresponde à origem do próprio Worker.
- Não usa binding R2 MEDIA_BUCKET; assina chamadas S3 com Signature V4.
- Preservar o Worker B2-01: substituir suas variáveis pela conta B2-02 quebraria o destino das URLs antigas.
- PROXY_KEY padrão do projeto foi adotada na configuração orientada; upload de ambos foi demonstrado.

Rotas: GET /health, POST /upload com X-Proxy-Key e corpo binário, GET/HEAD público de imagens por portal/featured/hash.extensão. Health confirmou configured=true nos dois Workers, mas não verifica escrita.

Erro inicial de deployment: trecho interno de upload foi colado isoladamente, causando Illegal return statement. Resolvido ao aplicar módulo completo, começando por `const encoder = new TextEncoder()` e incluindo export default.

## Inventário SQL

- B2-01: storage_id=12; B2-02: storage_id=13.
- provider=`backblaze_b2`, storage_driver=`s3_compatible`, prioridade=100.
- endpoint_url e public_base_url correspondem ao Worker de cada conta.
- credential_ref=NULL e campos Cloudinary de credenciais NULL são esperados: segredos ficam no Worker.
- Inserções orientadas idempotentes por alias: INSERT ... SELECT ... WHERE NOT EXISTS. Não sobrescrevem cadastro pré-existente.
- Cadastros inicialmente ind_ativo=0; posteriormente ativação orientada e reservas bem-sucedidas confirmam elegibilidade nas execuções mostradas.
- Escritas de cadastro/ativação orientadas com sessão '-03:00', restaurando o fuso anterior.
- CLOUDINARY-07 continua definitivamente desativado.
- Definições finais completas das SPs instaladas e dump da tabela não foram exportados nesta etapa. Contratos e alterações anteriores permanecem no registro de 13/10.

## Rodízio e reservas

Chamada operacional permanece `CALL SP_Core_Storage_Reserva(NULL, 3)`.

Elegibilidade: ativo, sem bloqueio vigente, sem reserva vigente. Ordem: prioridade ASC; acesso NULL primeiro; dth_acesso ASC; num_count ASC; storage_id ASC. Consulta de inventário com dth_acesso DESC não representa a fila da SP. Não há alternância obrigatória de tecnologias.

Storage usado continua elegível depois da finalização; não é removido do pool. Datas históricas UTC misturadas com novas UTC−3 ainda podem distorcer ordem/bloqueios. Migração histórica não confirmada.

Reserva grava token/prazo; finalização limpa esses campos. Ausência após sucesso é esperada. A tabela guarda estado atual, não histórico de cada execução.

Durante teste B2-01, finalização posterior retornou reserva_nao_encontrada_ou_token_invalido. Consulta mostrou status Sucesso e token/prazo limpos, consistente com finalização anterior e reutilização do mesmo token. Não contornar validação nem restaurar token manualmente. Expiração sozinha não rejeita token nesta SP se ele não foi substituído.

## Workflow atual de três adapters

```text
Start Storage → Reserva → Normaliza → IF Reserva OK
 → SHA-256 + Metadados → SWITCH | Storage Provider
    ├─ cloudinary    → Prepara Cloudinary → Upload Cloudinary - Proxy
    ├─ cloudflare_r2 → Upload S3R2 - Proxy
    └─ backblaze_b2  → Upload S3B2 - Proxy

Todos Success → Finaliza Sucesso → Valida Finalização Sucesso → fluxo pai
Todos Error   → Finaliza Falha → Valida Finalização Falha → Stop And Error
```

Switch agora compara `$json.provider`, não storage_driver: R2 e B2 compartilham s3_compatible. Os adapters permanecem dentro do mesmo workflow, sem novos Execute Subworkflow para uploads.

HTTP B2 integrado usa `endpoint_url` da reserva, removendo barra final e acrescentando /upload; o mesmo node atende B2-01 e B2-02. Testes isolados usaram URL fixa temporária e não devem deixar esse valor no node integrado.

Headers: X-Proxy-Key, x-storage-folder, x-media-sha256, x-file-extension, x-original-filename, Content-Type, x-media-width, x-media-height. Body n8n Binary File, campo data. On Error: Continue (using error output).

Normaliza preserva binário e pasta (`ind-api-folder` e `storage_folder`); metadados e reserva acompanham a execução. Finalizações recuperam ID/token do node comum SHA-256 + Metadados, nunca de um ramo específico.

## Correções do node de fronteira

`Valida Finalização Sucesso` combina validação da SP e retorno da mídia, em Run Once for All Items, pois MySQL fornece linha e objeto técnico separados.

- Extrai primeira linha e exige finalizacao_ok=1.
- Recupera contexto e resposta via itemMatching(0), verificando storage_id.
- Mapeia provider para os nomes exatos dos três HTTPs acima; nome antigo `Upload S3 | B2` foi corrigido para `Upload S3B2 - Proxy`.
- Aceita resposta direta/body e faz JSON.parse quando body for texto.
- Verifica correspondência provider/hash quando fornecidos pelo upload.
- Exige URL HTTPS sem credenciais, dimensões e bytes inteiros positivos.
- **n8n 2.36.9 self-hosted: classe URL indisponível no sandbox.** Diagnóstico mostrou URL_disponivel=false, enquanto URL HTTPS, width, height e bytes eram válidos. Removido uso de new URL e substituído por validação de formato/hostname/porta sem módulos externos. Registry WP mantém validação de hosts permitidos.
- IDs reais preservados; fallback de public_id e object_key aplicável a R2/B2, não fabrica ID Cloudinary.
- MIME suportado JPEG, PNG e WebP; original_filename com trim.
- Retorno somente: provider, sha256, asset_id, public_id, secure_url, url, width, height, mime_type, original_filename, bytes, existing. Não transporta credenciais, autorização ou token.
- Correção do sandbox teve regressão Cloudinary bem-sucedida (840×560, 44110 bytes, CLOUDINARY-02).
- Preferência do usuário: qualquer ajuste futuro de código de node deve ser entregue completo para substituição, não como fragmento.

## Registry WordPress B2

Um único provider `backblaze_b2`, ativo, delivery_mode=passthrough. Hosts exatos, um por linha:

```text
flow-b2-storage-proxy-hml.core360.workers.dev
flow-b2-02-storage-proxy-hml.core360.workers.dev
```

Não criar provider lógico separado por conta. Linha duplicada em Nova entrada foi removida na configuração mostrada. Patterns B2 devem ficar vazios; `*.r2.dev` cinza pode ser apenas placeholder.

CRUD apresentou “Sorry, you are not allowed to access this page” após salvar, mas usuário confirmou persistência e apresentou cadastro. Possível problema de redirecionamento/permissão de destino; causa não auditada nem corrigida. Registrar como pendência separada, não recriar provider.

Cadastro deve existir em cada portal que receber mídia B2. Publicação PEL posterior confirma aceitação nesse caminho; não extrapolar testes a todos os portais.

## Evidências B2

- B2-01 isolado: JPEG 768×432, 31751 bytes, pasta m360/featured; primeira resposta existing=false, repetição existing=true. Leitura pública B2-01 não teve confirmação explícita separada no chat.
- B2-01 integrado: reserva 12 e resposta pel/featured, JPEG 840×560, 44110 bytes, existing=true. Retorno interrompido por finalização já consumida e correções do node; publicação B2-01 não confirmada.
- B2-02 isolado: JPEG 768×432, 51947 bytes; existing=false e depois true; usuário confirmou carregamento público.
- B2-02 integrado: reserva 13 às 02:16:46 de 14/10/2026, TTL até 02:19:46 em Brasília; retorno validado JPEG 840×560, 104461 bytes, existing=false, pasta pel/featured.
- Usuário confirmou artigo publicado pelo fluxo de e-mail release usando B2-02. Imagem:
  https://flow-b2-02-storage-proxy-hml.core360.workers.dev/pel/featured/4b91aad18e37555db6b343564dd9c2ee6f99e4d290053a3c6e44d151f366d187.jpg

Homologação confirmada do caminho de sucesso B2-02; não equivale a teste de falhas, concorrência, quotas ou garantia de custo zero.

## Retomada: retry/fallback de falha

Pausa solicitada após publicação B2-02. Retomar pelo erro de upload, sem retornar ao trigger Start e sem substituir fluxos legados.

1. Obter erro sanitizado real e classificar falhas recuperáveis, definitivas e ambíguas (timeout após possível escrita).
2. Finalizar reserva atual e exigir finalizacao_ok=1 antes de reservar novamente.
3. Aplicar bloqueio quando a falha comprovar problema do storage; bloqueio 0 não impede selecionar a mesma conta.
4. Preservar binário, pasta, metadados e contador de tentativa. Não recuperar sempre o contexto da primeira execução.
5. Até três tentativas totais; máximo seis chamadas SQL para reserva/finalização. Ao esgotar, informar falha ao pai e não publicar sem mídia válida.
6. Testar tentativas esgotadas, pool vazio, falha de finalização e duplicação possível após timeout.

Node Contexto da Tentativa foi apenas proposto; sua inclusão e o laço não foram confirmados. Retry continua pendente, não rotulá-lo como homologado.

## Pendências adicionais

- R2-02 e B2-01: publicação integrada no novo workflow não confirmada.
- Migração histórica dos DATETIME e concorrência/TTL.
- Registro/auditoria de tentativas separado do estado operacional, se necessário.
- Persistência de secrets nas execuções n8n e rotação de secrets Cloudinary expostas no chat: recomendadas, sem confirmação de execução. Nenhum valor reproduzido no repositório.
- Capturar exports sanitizados n8n e definições finais SQL para versionar artefatos executáveis. Não existe acesso direto às aplicações pelo agente nesta consolidação.
