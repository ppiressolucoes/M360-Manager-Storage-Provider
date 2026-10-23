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

## Evidências reais após a publicação da v0.4

Dois alertas reais e independentes foram recebidos em 23/10/2026:

- B2-01, storage ID 12, às 20:22 UTC: `b2_lookup_failed`, HTTP 502 do Worker e status upstream 403, tentativa 1/3;
- B2-02, storage ID 13, às 21:32 UTC: `b2_lookup_failed`, HTTP 502 do Worker e status upstream 403, tentativa 1/3.

Uma saída sanitizada do upload de B2-01 confirmou que a falha ocorreu no primeiro `HEAD`, antes de qualquer `PUT`. Portanto, esta ocorrência não representa escrita ambígua: o B2 recusou a consulta ao objeto. O caminho, o MIME e os metadados já tinham passado pelas validações do workflow e do Worker.

Os alertas provam que a saída de erro do upload alcançou o classificador, que a reserva foi finalizada e validada e que o e-mail foi enviado. Eles não provam, isoladamente, a execução de `Restaura Contexto Após Alerta`, a seleção de uma segunda reserva ou o sucesso/erro terminal da execução. Como os dois alertas ocorreram com tentativa 1/3 e 70 minutos de diferença, não há evidência de que B2-02 tenha sido o fallback da ocorrência de B2-01.

A captura posterior da execução completou essa evidência para uma das ocorrências: `Prepara Tentativa`, reserva, normalização, validação, geração de metadados e Switch processaram dois itens ao longo do laço. A primeira tentativa seguiu pelo ramo B2, falhou, foi classificada e finalizada, gerou o alerta e restaurou o contexto. A saída verdadeira de `IF | Pode tentar novamente?` retornou a `Prepara Tentativa`; a segunda reserva selecionou o ramo S3/R2, cujo upload e finalização terminaram com sucesso. Assim, o fallback real entre providers `backblaze_b2 → cloudflare_r2`, preservando o mesmo contexto, está homologado na v0.4. A imagem não demonstra fallback de B2-01 para B2-02.

O status upstream 403 deve prevalecer sobre o envelope HTTP 502. O candidato de `Classifica Falha Upload` foi corrigido para tratar upstream 401/403/404 como `configuracao_storage`, mantendo fallback para outro storage e aplicando cooldown de 60 minutos ao storage defeituoso. A regra passou em teste automatizado, mas ainda não representa a v0.4 publicada.

O mesmo sintoma nas duas contas aponta para um procedimento comum de configuração. Verificar em cada conta, sem copiar valores entre elas:

1. se `B2_KEY_ID` e `B2_APPLICATION_KEY` pertencem ao mesmo Application Key;
2. se a chave está autorizada para o bucket configurado;
3. se possui no mínimo as capabilities necessárias a `HEAD` e `PUT`, especialmente `listFiles`, `readFiles` e `writeFiles`, além da listagem de nomes de buckets quando exigida pela configuração S3;
4. se bucket, região e endpoint S3 pertencem à mesma conta/bucket.

`/health` com `configured=true` confirma apenas a presença das variáveis. Não valida credenciais, escopo, capabilities ou acesso ao bucket.

## Plano de correção priorizado para B2

1. Tratar B2-01 primeiro, sem alterar n8n, SP ou cadastro do storage.
2. No painel Backblaze, confirmar que a Application Key atual está restrita ao bucket correto, em modo Read and Write, sem prefixo incompatível e sem expiração; conferir também a permissão de listar nomes de buckets.
3. Como o secret de uma Application Key não pode ser conferido novamente no painel, criar um novo par quando houver dúvida de correspondência. Atualizar `B2_KEY_ID` e `B2_APPLICATION_KEY` juntos no Worker, preservando a chave anterior para rollback até a homologação.
4. Implantar a revisão candidata do Worker e chamar `GET /health/storage` com `X-Proxy-Key` apenas pelo painel/ferramenta segura. Esse endpoint faz um HEAD assinado, não grava objetos e não devolve credenciais.
5. Gate esperado: HTTP 200, `bucket_read_verified=true`, `bucket_write_verified=false` e `probe_status=404`. HTTP 503 com `probe_status=403` mantém a falha de credencial/capability/escopo.
6. Somente após o gate de leitura, validar `writeFiles` por uma chamada controlada de upload ou pela próxima chamada real. Repetir o procedimento de forma independente em B2-02.

Não revogar a chave anterior antes da confirmação de B2-01 e não copiar nenhum valor de uma conta B2 para a outra.

Em 23/10/2026, a revisão com `GET /health/storage` foi implantada em B2-01. A primeira chamada pelo modo Visualizar do painel Cloudflare retornou HTTP 401 com `unauthorized`, resultado esperado porque esse modo não enviou `X-Proxy-Key`. A resposta comprova deployment e proteção da rota, mas não executou o HEAD contra o B2. O próximo gate é repetir a chamada no modo HTTP, adicionando o header secreto sem expô-lo em evidências.

A chamada autenticada seguinte retornou HTTP 200, `probe_status=404`, `bucket_read_verified=true` e `bucket_write_verified=false`. O gate de leitura de B2-01 está aprovado: a configuração atualmente implantada assina o HEAD, alcança o bucket e distingue corretamente uma chave inexistente. Não há motivo para rotacionar a Application Key antes do gate de escrita. O 403 observado na execução anterior não foi reproduzido pelo probe; a escrita continua não comprovada porque o health é deliberadamente somente leitura.

Na sequência, o mesmo item da execução anterior foi enviado diretamente ao node `Upload S3B2 - Proxy`. B2-01 retornou sucesso para um objeto novo, com `existing=false` e `reconciled_after_put_error=false`. Isso comprova que o deployment atual executa `HEAD` de ausência e `PUT` com sucesso, sem depender do fallback ou da reconciliação. Hash, URL pública, nome e demais dados do arquivo não foram versionados. O upstream 403 anterior não foi reproduzido; sua causa histórica permanece inconclusiva, portanto não deve ser atribuída retroativamente a uma capability específica.

## Decisão técnica

O fallback deve ocorrer dentro do subworkflow, não reiniciando toda a publicação:

1. o Worker reconcilia a chave com `HEAD` após resposta não conclusiva do PUT;
2. se o objeto existir com o tamanho esperado, o upload é tratado como sucesso;
3. se não houver confirmação, o n8n classifica e sanitiza a falha;
4. a reserva atual é finalizada obrigatoriamente;
5. o storage recebe cooldown curto e deixa de ser elegível temporariamente;
6. se ainda houver tentativa disponível, o mesmo binário volta à reserva global com provider `NULL`;
7. após três tentativas totais, erro definitivo, pool vazio ou falha de finalização, o fluxo encerra explicitamente.

Existem duas contas B2, representadas por B2-01 e B2-02, com Workers próprios. Elas permanecem no mesmo ramo lógico `backblaze_b2`: a SP seleciona o storage e o node HTTP usa seu `endpoint_url`. A correção do Worker deve ser implantada separadamente nos dois deployments, mantendo secrets, bucket e URL pública específicos de cada conta.

Não basta conectar o erro diretamente ao início: isso pode deixar reserva órfã, repetir B2-01 imediatamente, perder o binário ou ultrapassar o limite aprovado.

## Artefatos preparados

- `workers/flow-b2-storage-proxy-hml.mjs`: reconciliação pós-PUT ambíguo;
- `workers/flow-b2-storage-proxy-hml.test.mjs`: simulações locais de reconciliação;
- `workflows/n8n/storage-media-external/retry-v1/`: instruções, quatro Code nodes completos, hashes e testes locais.

O export baseline do n8n foi substituído por snapshot sanitizado somente depois da montagem, reexportação e auditoria do workflow. A revisão do Worker foi implantada pelo usuário nos dois B2 e o health check foi aprovado. A versão 0.4 do workflow foi publicada e seu fallback real B2 → R2 foi homologado. Rotação coordenada dos segredos, Error Workflow global, correção operacional dos dois B2 e publicação do classificador revisado permanecem pendentes.

## Continuidade do redesenho

Em 23/10/2026, o usuário criou e validou o node `Prepara Tentativa`: primeira tentativa, limite de três, lista inicial vazia e `binary.data` preservado. Também preservou os códigos correntes de B2-01 e B2-02. Os dois códigos de Worker são idênticos e equivalem ao baseline anterior à reconciliação após normalização de finais de linha; nenhuma credencial literal foi identificada. `Normaliza` foi validado em seguida: contexto e `binary.data` permaneceram presentes, e a reserva global selecionou um storage Cloudflare R2, confirmando a independência de provider. A saída verdadeira de `IF | Reserva OK?` foi processada e a falsa recebeu encerramento explícito. `SHA-256 + Metadados` preservou contexto e binário e produziu os metadados esperados. O Switch foi atualizado com regras Cloudinary/R2/B2 e saída extra `Fallback`; uma reserva Cloudflare R2 foi encaminhada corretamente pela saída `S3`, com binário preservado. O classificador comum de falhas foi criado e as saídas de erro dos uploads foram direcionadas a ele. `Retry on Fail` foi então desabilitado nos três uploads, deixando o limite de tentativas exclusivamente sob controle do workflow. O classificador foi ligado a `Finaliza Falha`, que passou a enviar à SP a mensagem sanitizada e o cooldown calculado. `Valida Finalização Falha` foi atualizado para conferir a resposta da SP e recompor contexto/binário. O IF passou a retornar falhas recuperáveis a `Prepara Tentativa` e encerrar as demais; a topologia completa foi revisada visualmente. O alerta exibido em `Prepara Tentativa` foi confirmado como aviso de reexecução decorrente das mudanças ainda não publicadas, não como falha estrutural. Depois da implantação dos Workers, auditorias e correções v0.3/v0.4, o workflow foi publicado.

A revisão reconciliadora foi informada como implantada em B2-01 (`flow-b2-storage-proxy-hml`). Duas consultas `GET /health` realizadas pelo ambiente Codex foram recusadas pelo túnel de rede com `CONNECT 403`, antes de alcançar o domínio; por isso a saúde do Worker deve ser confirmada pelo navegador ou painel Cloudflare, sem interpretar esse bloqueio como falha da implantação.

O usuário confirmou pelo painel Cloudflare que `/health` de B2-01 respondeu com `provider=backblaze_b2`, `configured=true` e `bucket_write_verified=false`. O primeiro gate de implantação foi aprovado: o Worker está acessível e reconhece todas as configurações obrigatórias. Posteriormente, health autenticado e PUT controlado comprovaram leitura e escrita reais em B2-01; o campo estático do health continua `false` porque essa rota não mantém estado da homologação.

A mesma revisão foi implantada em B2-02 (`flow-b2-02-storage-proxy-hml`), preservando sua configuração independente. O usuário confirmou a mesma resposta saudável em `/health`. Os dois Workers estão configurados e acessíveis; escrita, reconciliação real e retry integrado ainda não foram homologados.

O primeiro export do workflow redesenhado foi auditado. Não contém `pinData`; as conexões, saídas de sucesso/erro, fallback do Switch, retorno do retry e códigos dos quatro nodes novos estão coerentes. O arquivo ainda contém três valores literais de `X-Proxy-Key` e, portanto, não pode ser versionado. Também revelou prefixo duplicado `=={{` nos parâmetros de `Finaliza Falha` e na mensagem de `Stop | Provider Não Suportado`. A correção foi aplicada pelo usuário: no editor visual em modo Expression deve ser digitado `{{...}}`, sem `=` manual; somente o export JSON válido serializa o campo como `={{...}}`. O nome do IF de retry também foi padronizado. Como segredos reais foram incluídos no anexo, a rotação coordenada deve ser tratada antes do encerramento da implantação.

O segundo export confirmou as correções e preservou a topologia. Uma cópia foi sanitizada mecanicamente e promovida ao snapshot canônico local com `active=false`, sem `pinData`, metadados/credenciais da instância ou valores literais de `X-Proxy-Key`. Os sete Code nodes foram extraídos do snapshot e indexados por hash. O arquivo bruto permanece fora do Git.

A auditoria verificou, sem registrar o valor, que os três uploads do workflow usavam a mesma `X-Proxy-Key` literal. Como o anexo bruto entrou no chat, a rotação deve abranger coordenadamente todos os proxies Cloudinary, R2 e B2 que aceitam essa chave e o n8n; rotacionar apenas os dois Workers B2 quebraria os demais caminhos.

O caminho de sucesso do rascunho foi homologado manualmente: a reserva global selecionou Cloudflare R2, o upload criou um objeto novo, `Finaliza Sucesso` confirmou a reserva e `Valida Finalização Sucesso` produziu o contrato esperado. Hash, URL pública, nome do arquivo e binário da evidência não foram registrados no repositório. O teste não exercitou retry nem os Workers B2.

Por decisão do usuário, não serão provocadas falhas para homologar o laço. O comportamento de erro será acompanhado nas próximas chamadas reais. Cada falha de upload confirmada após `Valida Finalização Falha` deve gerar um alerta por e-mail, inclusive quando houver retry; o caminho de sucesso não gera alerta. O e-mail não inclui segredo, token, stack trace, hash, URL, nome ou binário. Falhas não tratadas em outros nodes exigem um Error Workflow separado para cobertura completa.

O usuário concluiu a ramificação lateral `Prepara Alerta Falha → Send E-Mail`, mantendo `Valida Finalização Falha → IF | Pode tentar novamente?` como caminho principal. Não foi provocado um erro de teste; a mensagem e o retorno ao retry foram validados posteriormente por uma ocorrência real. O alerta atual cobre falhas de upload tratadas; não equivale a um Error Workflow global.

A versão 0.3 foi publicada e exportada, mas não passou na auditoria. O JSON mostrou `pinData` em `Start Storage`; `Prepara Alerta Falha` estava ligado à saída `true` de `IF | Pode tentar novamente?`, alertando somente erros com retry, enquanto a saída `false` encerrava sem e-mail; e a saída de erro do Gmail não tinha continuidade. O conteúdo preparado para o e-mail estava sanitizado. O export bruto v0.3, contendo referências da instância e destinatário, permanece fora do Git e não substitui o snapshot v0.2 até a correção.

A versão 0.4 corrigiu os problemas e foi publicada. O export confirmou ausência de `pinData`, `Valida Finalização Falha → Prepara Alerta Falha → Send E-Mail`, ambas as saídas do Gmail em `Restaura Contexto Após Alerta`, restauração de JSON/binário e decisão posterior no IF. A cópia canônica foi desativada e sanitizada, com chaves, destinatário, credenciais e metadados da instância removidos. Os nove Code nodes foram extraídos e indexados; testes locais de classificação, alerta, restauração e reconciliação B2 passaram.
