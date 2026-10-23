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

R2-08 é candidato externo e ainda não deve ser contado como storage cadastrado ou ativo no Core. O SQL idempotente em `database/mysql/inventory/register_R2-08.sql` prepara cadastro inativo e não foi executado pelo agente.

Ordem de homologação:

1. validar upload isolado de um objeto novo pelo Worker (`existing=false`);
2. abrir a URL pública sem autenticação;
3. repetir o mesmo upload e exigir `existing=true`;
4. revisar e executar conscientemente o cadastro inativo;
5. apresentar SELECT sanitizado para confirmar o `storage_id` atribuído e `ind_ativo=0`;
6. somente depois preparar ativação e observar seleção natural no workflow integrado;
7. validar finalização e publicação até o consumidor final.

Não criar novo provider lógico nem ramo no n8n: R2-08 compartilha `cloudflare_r2` e deve usar dinamicamente o `endpoint_url` retornado pela reserva. O `endpoint_url` de cadastro é a origem do Worker sem `/health`; a URL pública pertence ao objeto entregue e não substitui o endpoint de upload.
