# Falha B2-01 e preparação do retry

Atualizado em 23/10/2026, Brasília. Fonte: execução e captura fornecidas pelo usuário; sem acesso direto do agente ao runtime n8n, B2 ou banco.

## Evidência sanitizada

- storage: B2-01, ID 12, provider `backblaze_b2`;
- etapa: `Upload S3B2 - Proxy`;
- resposta n8n: HTTP 502;
- resposta sanitizada do Worker: `b2_upload_failed`, status upstream 520;
- a captura indica passagem por `Finaliza Falha`, `Valida Finalização Falha` e encerramento em `Stop and Error`;
- e-mail, nome de arquivo, hash, token de reserva, stack completa e demais dados de execução não foram reproduzidos neste repositório.

O retorno confirma que o Worker chegou ao PUT do B2 e não recebeu resposta de sucesso. Não comprova a causa raiz do status 520 nem que o objeto deixou de ser persistido. Por isso a falha é classificada como escrita ambígua e recuperável.

## Decisão técnica

O fallback deve ocorrer dentro do subworkflow, não reiniciando toda a publicação:

1. o Worker reconcilia a chave com `HEAD` após resposta não conclusiva do PUT;
2. se o objeto existir com o tamanho esperado, o upload é tratado como sucesso;
3. se não houver confirmação, o n8n classifica e sanitiza a falha;
4. a reserva atual é finalizada obrigatoriamente;
5. o storage recebe cooldown curto e deixa de ser elegível temporariamente;
6. se ainda houver tentativa disponível, o mesmo binário volta à reserva global com provider `NULL`;
7. após três tentativas totais, erro definitivo, pool vazio ou falha de finalização, o fluxo encerra explicitamente.

Não basta conectar o erro diretamente ao início: isso pode deixar reserva órfã, repetir B2-01 imediatamente, perder o binário ou ultrapassar o limite aprovado.

## Artefatos preparados

- `workers/flow-b2-storage-proxy-hml.mjs`: reconciliação pós-PUT ambíguo;
- `workers/flow-b2-storage-proxy-hml.test.mjs`: simulações locais de reconciliação;
- `workflows/n8n/storage-media-external/retry-v1/`: instruções, quatro Code nodes completos, hashes e testes locais.

O export baseline do n8n não foi modificado. A implantação do Worker, a montagem no n8n e a homologação operacional permanecem pendentes. Depois da homologação, obter novo export sanitizado para substituir o baseline e registrar o resultado real.
