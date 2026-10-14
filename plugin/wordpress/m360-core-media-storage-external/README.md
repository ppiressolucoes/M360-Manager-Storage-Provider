# M360 - Core Media Storage External

Plugin WordPress independente para Featured Images externas. Ele não grava o binário da imagem no `uploads`: cria um attachment técnico com a URL escolhida pelo Core Media Store e expõe endpoints REST para o workflow n8n.

Versão `0.1.9`: mantém o contrato multi-provider da `0.1.8` e adiciona o Storage Provider Registry ao Dashboard. O Registry armazena apenas provider lógico, nome, status, hosts autorizados, patterns seguros e modo de entrega.

## Perfil único de exibição do MVP

Cloudinary continua sendo entregue com largura máxima de **768 px** (`c_limit,w_768`), preservando a proporção original. Pedidos do tema ou de componentes por `thumbnail`, `medium`, `large`, `full` ou dimensões customizadas são deliberadamente normalizados para esse perfil único. Cloudflare R2 entrega a URL original, sem sintaxe de transformação Cloudinary.

O asset original e seus metadados técnicos continuam registrados no attachment virtual, mas não há geração de thumbnails nem gravação de binários no `uploads` do WordPress. A regra vale tanto para a resolução de imagem (`image_downsize`) quanto para a URL direta do attachment.

## Compartilhamento social

O Yoast SEO normalmente procura uma variação local da imagem destacada. Como este plugin usa attachments virtuais sem arquivo em `uploads`, a versão `0.1.7` registra explicitamente a mídia no filtro `wpseo_add_opengraph_images`, com URL e dimensões entregues pelo Cloudinary. A integração só atua em páginas singulares cuja imagem destacada tenha o marcador M360; imagens nativas e páginas sem mídia externa continuam sob responsabilidade do WordPress/Yoast.

Depois da atualização em produção, limpe o cache de página/CDN e solicite nova leitura da URL no Facebook Sharing Debugger. Publicações já criadas podem conservar a prévia antiga; crie uma nova publicação depois da nova coleta.

## Instalação e atualização

1. Instalar o ZIP `m360-external-featured-media-wordpress-v0.1.9.zip` pelo painel do WordPress. Confirmar sua substituição no mesmo diretório canônico.
2. Confirmar uma única entrada **M360 - Core Media Storage External**, autor **M360**, versão **0.1.9**.
3. Usar um usuário WordPress dedicado com Application Password e as capacidades `upload_files` e `edit_posts` no n8n.
4. Limpar o cache de página/CDN e validar as metatags sociais antes de solicitar uma nova leitura do link na rede social.

A atualização não cria outro asset Cloudinary nem exige novo upload das imagens. Consulte [as instruções de atualização do Portal Energia Limpa](releases/v0.1.7/INSTALLATION.md) para a validação de uma notícia com capa externa.

## Endpoints

### Registrar ou reutilizar mídia

`POST /wp-json/m360/v1/external-featured-media`

Body JSON:

```json
{
  "provider": "cloudflare_r2",
  "sha256": "<64-hex>",
  "asset_id": "<cloudinary-asset-id>",
  "public_id": "m360/featured/<hash>",
  "secure_url": "https://pub-4fc4737db70147a8bec050dd7fb883d7.r2.dev/...",
  "width": 1200,
  "height": 675,
  "mime_type": "image/jpeg",
  "original_filename": "imagem.jpg"
}
```

Retorna `attachment_id` e `existing`. Uma repetição com o mesmo hash devolve o attachment já criado. O campo `provider` é opcional apenas para compatibilidade: quando ausente, o endpoint mantém o comportamento Cloudinary legado.

### Associar ao post PT-BR

`POST /wp-json/m360/v1/external-featured-media/assign`

Body JSON:

```json
{
  "post_id": 123,
  "attachment_id": 456,
  "alt": "...",
  "title": "...",
  "description": "...",
  "caption": "..."
}
```

O endpoint atualiza `_thumbnail_id` e guarda os quatro campos editoriais no post. O attachment é compartilhável para futura tradução EN-US, sem duplicar o arquivo.

## Storage Provider Registry

O Registry é inicializado automaticamente com `cloudinary` e `cloudflare_r2`. Quando o M360 Dashboard estiver disponível, a gestão aparece em **Storage Providers**; caso contrário, aparece em **Configurações**.

Cada registro aceita somente `provider_key`, `label`, `enabled`, `allowed_hosts`, `allowed_host_patterns` e `delivery_mode`. Patterns são limitados ao formato seguro `*.example.com`; não são aceitos regex, callbacks, PHP ou JavaScript.
