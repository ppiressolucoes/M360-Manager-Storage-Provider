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

## Estado e próximos gates

O cadastro foi executado pelo usuário e confirmado por SELECT: `storage_id=19`, alias `R2-08`, provider `cloudflare_r2`, driver `s3_compatible` e `ind_ativo=0`. Endpoint, URL pública e bucket correspondem à configuração prevista. O SQL idempotente está em `database/mysql/inventory/register_R2-08.sql`; não foi executado pelo agente. R2-08 agora integra o inventário do Core como storage inativo, mas ainda não está homologado para ativação.

Ordem de homologação:

1. validar upload isolado de um objeto novo pelo Worker (`existing=false`);
2. abrir a URL pública sem autenticação;
3. repetir o mesmo upload e exigir `existing=true`;
4. somente depois preparar ativação do ID 19 e observar seleção natural no workflow integrado;
5. validar finalização e publicação até o consumidor final.

Não criar novo provider lógico nem ramo no n8n: R2-08 compartilha `cloudflare_r2` e deve usar dinamicamente o `endpoint_url` retornado pela reserva. O `endpoint_url` de cadastro é a origem do Worker sem `/health`; a URL pública pertence ao objeto entregue e não substitui o endpoint de upload.
