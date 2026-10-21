# R2-07 — inclusão em preparação

Atualizado em 21/10/2026, Brasília. Fonte: configuração e respostas fornecidas pelo usuário; sem auditoria direta do runtime pelo agente.

- Alias previsto: R2-07; provider cloudflare_r2; driver s3_compatible.
- Bucket: core360-storage-hml-7.
- Worker base: https://flow-r2-storage-proxy-07.core360-7.workers.dev
- public_base_url: https://pub-28e61f0e5f1e45068767c5bebdc26418.r2.dev
- Usuário informou conta de cadastro; e-mail não reproduzido na documentação pública por não ser necessário à homologação. Pode ser cadastrado no inventário operacional.

Health retornou status ok, proxy flow-r2-storage-proxy-07, versão 1.0.0, provider cloudflare_r2, bucket_binding MEDIA_BUCKET. Health sozinho não comprova escrita.

Primeiro upload demonstrado: success=true, existing=false, JPEG 840×560, 137380 bytes, pasta pel/featured; secure_url do host previsto. Nenhuma credencial ou token de reserva incluído neste registro.

Leitura pública confirmada pelo usuário. Repetição retornou existing=true, mantendo hash, URL, dimensões e tamanho. Testes isolados de upload, leitura e deduplicação concluídos.

Cadastro confirmado pelo SELECT do usuário: storage_id=18, alias R2-07, ind_ativo=0; endpoint, URL pública e bucket correspondem à configuração prevista. SQL em database/mysql/inventory/register_R2-07.sql. E-mail da conta pode ser preenchido somente no banco operacional; não é necessário ao adapter.

Ativação para homologação preparada em database/mysql/inventory/activate_R2-07.sql, não executada pelo agente. Pendentes: confirmação da ativação e release integrado até registro/vínculo WP/publicação.

Manter pattern *.r2.dev no Registry onde efetivamente salvo, endpoint dinâmico no HTTP R2 e reserva global com provider NULL. Não criar outro provider lógico/adapter por conta.
