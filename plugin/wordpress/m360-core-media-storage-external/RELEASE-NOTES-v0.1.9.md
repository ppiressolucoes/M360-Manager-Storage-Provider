# M360 - Core Media Storage External v0.1.9

## Escopo

Adiciona um Storage Provider Registry configurável ao M360 Dashboard, sem incorporar upload, credenciais, contas, buckets, Workers, quotas ou rodízio.

## Registry

Cada provider contém apenas:

- `provider_key`;
- `label`;
- `enabled`;
- `allowed_hosts`;
- `allowed_host_patterns`;
- `delivery_mode` (`cloudinary_transform` ou `passthrough`).

O Registry aceita somente hosts exatos e patterns com wildcard inicial, como `*.r2.dev`. Não aceita código executável nem regex arbitrário.

- Cloudinary e Cloudflare R2 são protegidos contra exclusão acidental.
- A tela inclui a ação **Testar URL**, usando a mesma validação do endpoint REST.

## Compatibilidade

- Payload sem `provider` continua assumindo `cloudinary`.
- Attachment sem meta de provider continua usando inferência pela URL.
- `res.cloudinary.com` e `cloudinary_transform` são invariantes protegidos.
- SHA-256, rotas REST, `/assign`, metadados editoriais, GUIDs e filtros WordPress/Yoast não foram alterados.
- Desabilitar um provider bloqueia novos registros, mas não interrompe a entrega de attachments já publicados.
- Provider desabilitado retorna `reason: provider_disabled`; chave desconhecida retorna `reason: unsupported_provider`.
- Não há migração destrutiva; rollback para v0.1.8 permanece possível.

## Validação recomendada

1. Atualizar o plugin e confirmar a criação automática dos providers default.
2. Validar um Cloudinary antigo e um novo, ambos com `c_limit,w_768`.
3. Validar um attachment R2 existente e um novo em modo `passthrough`.
4. Adicionar um novo host R2 compatível com `*.r2.dev` sem alterar o plugin.
5. Desabilitar um provider em homologação: novo registro deve falhar e mídia já publicada deve continuar sendo entregue.
