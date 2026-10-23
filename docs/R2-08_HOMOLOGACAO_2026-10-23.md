# R2-08 — inclusão no inventário

Atualizado em 23/10/2026, Brasília. Fonte: configuração e resposta de health fornecidas pelo usuário; sem auditoria direta do runtime Cloudflare, banco, n8n ou WordPress pelo agente.

## Configuração declarada

- Alias previsto: `R2-08`;
- provider: `cloudflare_r2`;
- driver: `s3_compatible`;
- bucket: `core360-storage-hml-8`;
- Worker base: `https://flow-r2-storage-proxy-08.core360-8.workers.dev`;
- public base URL: `https://pub-bcab0fcb78004202b92d225c4ee2e3d4.r2.dev`;
- binding informado: `MEDIA_BUCKET`;
- conta operacional informada pelo usuário e omitida do Git por não ser necessária ao adapter.

O endpoint `/health` retornou `status=ok`, proxy `flow-r2-storage-proxy-08`, versão `1.0.0`, provider `cloudflare_r2` e binding `MEDIA_BUCKET`. Isso comprova que o Worker responde e reconhece sua configuração declarativa; não comprova vínculo efetivo com o bucket, autenticação do upload, escrita, deduplicação, leitura pública nem integração com o Core.

O primeiro upload isolado revelou `public_base_url_not_configured`. A variável `PUBLIC_BASE_URL`, que não é herdada do cadastro do Core, foi então configurada no Worker R2-08. A repetição retornou sucesso com `existing=false`, e o painel confirmou o objeto no bucket `core360-storage-hml-8`, sob `m360/featured`. A URL pública foi aberta sem autenticação e o mesmo upload foi repetido com `existing=true`. PUT, binding, entrega pública e deduplicação estão aprovados.

O item usado como massa veio de uma execução R2-02, mas o endpoint do teste foi direcionado manualmente ao Worker R2-08. Por isso seus campos de reserva não são evidência do storage testado e nenhuma finalização deve ser executada com esse token. O destino R2-08 foi confirmado pelo host retornado e pelo bucket no painel.

## Estado e próximos gates

O cadastro foi executado pelo usuário e inicialmente confirmado como `storage_id=19`, alias `R2-08`, provider `cloudflare_r2`, driver `s3_compatible` e `ind_ativo=0`. Após os testes isolados, a ativação foi executada pelo usuário e confirmada por SELECT: `ind_ativo=1`, status `Integracao em homologacao`, com endpoint, URL pública e bucket ainda correspondentes à configuração prevista. Os SQLs versionados estão em `database/mysql/inventory/register_R2-08.sql` e `database/mysql/inventory/activate_R2-08.sql`; nenhum deles foi executado pelo agente.

Ordem de homologação:

1. observar seleção natural pela SP, sem fixar endpoint ou provider;
2. validar upload e `Finaliza Sucesso` com reserva válida;
3. confirmar retorno ao fluxo pai e publicação até o consumidor final;
4. promover o status operacional somente após a evidência integrada.

Não criar novo provider lógico nem ramo no n8n: R2-08 compartilha `cloudflare_r2` e deve usar dinamicamente o `endpoint_url` retornado pela reserva. O `endpoint_url` de cadastro é a origem do Worker sem `/health`; a URL pública pertence ao objeto entregue e não substitui o endpoint de upload.
