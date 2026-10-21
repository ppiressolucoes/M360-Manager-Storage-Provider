# R2-07 — inclusão em preparação

Atualizado em 21/10/2026, Brasília. Fonte: configuração e respostas fornecidas pelo usuário; sem auditoria direta do runtime pelo agente.

- Alias previsto: R2-07; provider cloudflare_r2; driver s3_compatible.
- Bucket: core360-storage-hml-7.
- Worker base: https://flow-r2-storage-proxy-07.core360-7.workers.dev
- public_base_url: https://pub-28e61f0e5f1e45068767c5bebdc26418.r2.dev
- Usuário informou conta de cadastro; e-mail não reproduzido na documentação pública por não ser necessário à homologação. Pode ser cadastrado no inventário operacional.

Health retornou status ok, proxy flow-r2-storage-proxy-07, versão 1.0.0, provider cloudflare_r2, bucket_binding MEDIA_BUCKET. Health sozinho não comprova escrita.

Primeiro upload demonstrado: success=true, existing=false, JPEG 840×560, 137380 bytes, pasta pel/featured; secure_url do host previsto. Nenhuma credencial ou token de reserva incluído neste registro.

Pendentes: leitura pública sem autenticação; repetição do mesmo arquivo com existing=true; cadastro SQL inicialmente inativo e identificação do storage_id; ativação e release integrado até registro/vínculo WP/publicação. Não presumir ID 18 nem afirmar inclusão efetiva no banco.

Manter pattern *.r2.dev no Registry onde efetivamente salvo, endpoint dinâmico no HTTP R2 e reserva global com provider NULL. Não criar outro provider lógico/adapter por conta.
