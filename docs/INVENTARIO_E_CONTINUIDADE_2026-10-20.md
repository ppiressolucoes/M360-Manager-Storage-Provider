# Inventário e continuidade — 20/10/2026

Referência: Brasília, UTC−3. Fonte: saídas e confirmações do usuário no chat; não auditoria direta de banco/n8n/Cloudflare/WP. Complementa o registro de 14/10.

## Inventário e evidências

Três providers: cloudinary, cloudflare_r2, backblaze_b2. O baseline de 20/10 continha 17 storages (9 Cloudinary, 2 B2, 6 R2). Depois, R2-07 foi confirmado como ID 18 e R2-08 como ID 19, ambos inativos nas evidências de cadastro. Assim, há 19 registros comprovados no Core. CLOUDINARY-07 permanece inativo. Não afirmar total de ativos: execução das ativações recentes R2-05/R2-06/R2-07 ainda não foi confirmada explicitamente e R2-08 continua inativo.

| Storage | ID | Bucket | Worker base |
| --- | ---: | --- | --- |
| R2-03 | 14 | core-media-hml-3 | https://flow-r2-storage-proxy-03.core360-3.workers.dev |
| R2-04 | 15 | core360-storage-hml-4 | https://flow-r2-storage-proxy-04.core360-4.workers.dev |
| R2-05 | 16 | core360-storage-hml-5 | https://flow-r2-storage-proxy-05.core360-5.workers.dev |
| R2-06 | 17 | core360-storage-hml-6 | https://flow-r2-storage-proxy-06.core360-6.workers.dev |
| R2-07 | 18 | core360-storage-hml-7 | https://flow-r2-storage-proxy-07.core360-7.workers.dev |
| R2-08 | 19 | core360-storage-hml-8 | https://flow-r2-storage-proxy-08.core360-8.workers.dev |

| Storage | public_base_url |
| --- | --- |
| R2-03 | https://pub-2649da1456ae49a0b80d452844f9a4eb.r2.dev |
| R2-04 | https://pub-0af080727f5a476e95e690f072129957.r2.dev |
| R2-05 | https://pub-b3e02429eadd4d94bdaa5e5771117101.r2.dev |
| R2-06 | https://pub-28e4a7157d8a4d86a25b4ff5b4132517.r2.dev |
| R2-07 | https://pub-28e61f0e5f1e45068767c5bebdc26418.r2.dev |
| R2-08 | https://pub-bcab0fcb78004202b92d225c4ee2e3d4.r2.dev |

Todos com provider cloudflare_r2, driver s3_compatible, prioridade inicial 100, region_name e credential_ref NULL. Cada Worker usa binding MEDIA_BUCKET ao bucket, secret PROXY_KEY padrão e variável PUBLIC_BASE_URL. Código R2 existente aplicado pelo usuário; identificação fixa de cada proxy ajustada. Health ok é declarativo, não prova escrita. Código completo R2 não foi fornecido como artefato nesta evolução.

R2-08 foi acrescentado em 23/10 após health declarativo do Worker versão 1.0.0 e cadastrado como ID 19, inativo. A variável `PUBLIC_BASE_URL` ausente foi corrigida e o primeiro upload isolado criou um objeto no bucket correto. Deduplicação, leitura pública, ativação e publicação integrada permanecem pendentes. Detalhes em [R2-08 — inclusão no inventário](R2-08_HOMOLOGACAO_2026-10-23.md).

| Storage | Upload isolado | Deduplicação | Leitura pública | Publicação integrada |
| --- | --- | --- | --- | --- |
| R2-03 | 1200×800, 124270 bytes, m360/featured | existing=true | Confirmada | Confirmada pelo usuário, PEL |
| R2-04 | 1200×800, 172992 bytes, pel/featured | existing=true | Confirmada | Confirmada pelo usuário, PEL |
| R2-05 | 1200×675, 100605 bytes, m360/featured | existing=true | Confirmada | Pendente |
| R2-06 | 854×560, 125540 bytes, pel/featured | existing=true | Confirmada | Pendente |
| R2-08 | Objeto novo confirmado no bucket, m360/featured | Pendente | Pendente | Pendente |

Primeiras respostas existing=false; repetições preservaram URL e objeto. Publicação confirmada não equivale a inspeção independente de todos os nodes. Exemplos publicados:

- R2-03: https://pub-2649da1456ae49a0b80d452844f9a4eb.r2.dev/pel/featured/a0dff9f0555cf4fefac14431823bfe7989069f11e0f151760effd76fa93b299d.jpg
- R2-04: https://pub-0af080727f5a476e95e690f072129957.r2.dev/pel/featured/9b14227792cb8586f0d301d70e934942bc42f3d95e2cbbc2365e08b5d738528b.jpg

## Banco, n8n e WordPress

Para cada destino: INSERT ... SELECT ... WHERE NOT EXISTS por alias, ind_ativo=0, num_count=0, prioridade=100. SELECTs do usuário confirmaram cadastro e IDs. UPDATEs de ativação foram fornecidos filtrando ID/alias/provider, status Integracao em homologacao. Sessão UTC−3 durante escrita, restaurada ao final. R2-03/R2-04 chegaram à publicação; para R2-05/R2-06 ativação fornecida não é confirmação de execução.

Sem nova alteração das SPs nesta expansão. Reserva continua CALL SP_Core_Storage_Reserva(NULL, 3). Nenhuma migração histórica UTC/UTC−3 confirmada. Identificadores do inventário não são IDs da Config_API_IA.

Não criar novo ramo por conta R2. HTTP integrado usa endpoint_url sem barra final + /upload, preserva headers/metadados/binário. Cópias de teste usam URL fixa temporária; não deixar essa URL no adapter integrado. Remover dados fixados antes de testes integrais. Cadastro não deve guardar /health no endpoint.

Usuário confirmou Registry cloudflare_r2 ativo, passthrough e pattern efetivo *.r2.dev. Abrange novos hosts somente nos portais onde estiver salvo. URL r2.dev é de desenvolvimento e tem limitações; não afirmar entrega de produção sem limites nem trocar URLs antigas sem compatibilidade.

## Monitoramento de consumo

Export Cloudinary anexado foi analisado e agora arquivado sanitizado em workflows/n8n/cloudinary-gestao-contas. Ele agenda 00:15, 06:15, 12:15 e 18:15 conforme timezone do workflow; confirmar Brasília no runtime. Lista contas ativas, consulta /usage, valida, classifica e grava Cloudinary_Usage, com loop/espera.

Níveis: NORMAL <70%, ATENCAO ≥70%, RESTRITA ≥85%, CRITICA ≥90%, BLOQUEADA ≥95%. Export não contém envio de notificação nem demonstra atualização de elegibilidade no Core_Storage_Provider. Estado classificado não equivale a bloqueio do pool.

Objetivo aprovado: ampliar monitoramento para R2 e B2. Coletar por conta com vínculo a buckets, sem multiplicar franquias compartilhadas. R2: armazenamento/operações A e B; B2: armazenamento/saída/transações; Workers têm consumo separado. num_count não mede consumo.

Pendências: fontes/APIs e permissões de leitura, tabelas por unidade/janela, limites configuráveis, canal/destinatários, deduplicação de alertas por mudança de nível. Falha de leitura deve preservar última leitura válida e marcar SEM_LEITURA, nunca zero. Primeira versão proposta sem bloqueio automático. Pergunta sobre tokens Cloudflare e canal ficou sem resposta; sem implementação confirmada.

## Prioridade das falhas e outras pendências

Usuário decidiu expandir inventário e retomar retry quando ocorrer primeira falha real. Máximo três tentativas totais aprovado, mas NÃO implementado/homologado. Ramo atual termina em Stop And Error após finalização da falha. Não provocar falha em produção sem instrução.

Na retomada: sanitizar erro, classificar recuperável/definitivo/timeout ambíguo, finalizar e exigir confirmação antes de nova reserva, preservar contexto/binário e contador. Bloqueio 0 não exclui conta; erro interno não comprova storage defeituoso. Até seis chamadas SQL para três pares reserva/finalização. Validar pool vazio, fim de tentativas e falha de finalização.

R2-02 e B2-01 ainda sem confirmação integral no novo fluxo; B2-02 publicado conforme registro anterior. Persistem pendências de concorrência/TTL, datas históricas, auditoria de tentativas, retenção de secrets em execuções e rotação recomendada de secrets expostas no chat. Nenhum valor registrado aqui.

OCI foi apenas sugerido como próximo candidato, não aprovado para implantação. Valores/franquias comerciais B2/OCI discutidos não foram verificados ao vivo; não usá-los como limites contratuais. Conferir fontes vigentes e painel da conta.

## Artefatos e continuidade

Consultar docs/ARTEFATOS_DAS_SPRINTS.md. JSON existente do storage permanece baseline sanitizado; não houve novo export operacional. SQL adicionado foi reconstruído da versão fornecida no chat, sem DEFINER de ambiente e sem execução/validação no banco pelo agente.

O GitHub deve receber documentação, backlog e artefatos sanitizados ao concluir novas ações deste Core. Código completo dos nodes deve ser entregue para substituição. Mudanças relatadas e efetivamente aplicadas devem permanecer distintas.
