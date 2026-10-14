# M360 - Core Media Storage External v0.1.8

## Escopo

Suporte inicial a múltiplos providers de mídia externa: `cloudinary` e `cloudflare_r2`.

## Compatibilidade obrigatória

- O endpoint existente continua aceitando payloads Cloudinary sem `provider`.
- Attachments Cloudinary antigos continuam lendo `_m360_external_cloudinary_*`.
- Para esses attachments, o provider é inferido pela URL `res.cloudinary.com` e a transformação `c_limit,w_768` permanece idêntica à v0.1.7.
- Não há migração em massa, reescrita de GUID, alteração de SHA-256 ou mudança na rota `/assign`.

## Novo contrato

O endpoint `POST /m360/v1/external-featured-media` aceita `provider` opcional: `cloudinary` ou `cloudflare_r2`. Para R2, a URL precisa ser HTTPS e pertencer à allowlist do provider; a resposta inclui os campos aditivos `provider` e `url` sem remover os campos legados.

## Validação de deploy

1. Validar um attachment Cloudinary antigo no frontend, `image_downsize`, caption, alt, Yoast Open Graph e Twitter/X.
2. Registrar um novo payload Cloudinary com `provider` omitido e confirmar `c_limit,w_768`.
3. Registrar um payload R2 com `provider: cloudflare_r2` e confirmar que a URL retorna exatamente o objeto R2, sem `/image/upload/`.
4. Reenviar o mesmo SHA-256 e confirmar `existing: true`.
5. Confirmar HTTP 400 para host R2 não autorizado e provider inexistente.
