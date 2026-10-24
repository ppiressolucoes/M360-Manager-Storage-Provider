# Retry v1 — candidato para homologação

Este pacote foi preparado após a primeira falha real sanitizada de upload em B2-01, em 23/10/2026. A versão 0.4 foi publicada no n8n e o export `../SUB_Storage_Media_External.json` contém seu snapshot sanitizado auditado. O caminho de sucesso, o alerta de falha e o fallback real de B2 para Cloudflare R2 foram observados e concluídos com sucesso.

## Comportamento

- no máximo três tentativas totais por arquivo;
- cada falha é classificada antes da finalização;
- a reserva corrente precisa ser finalizada com sucesso antes de nova reserva;
- uma execução já finalizada não pode ser retomada a partir do upload para validar sucesso, pois reutilizaria um token consumido; iniciar novamente em `Start Storage`;
- falha transitória ou escrita ambígua aplica cooldown de 5 minutos ao storage;
- falha de configuração do storage aplica cooldown de 60 minutos;
- erro do arquivo/entrada não tenta outro storage;
- a nova reserva continua global: `CALL SP_Core_Storage_Reserva(NULL, 3)`;
- binário, hash e metadados são preservados; credenciais e token da reserva anterior não seguem para a próxima tentativa.

B2-01 e B2-02 usam o mesmo provider lógico `backblaze_b2`, mas possuem storages, buckets e Workers independentes. O workflow mantém um único ramo **Upload S3B2 - Proxy** e usa dinamicamente `endpoint_url` da reserva; não criar um ramo por conta. O cooldown é aplicado ao `storage_id` que falhou, permitindo que a nova reserva selecione a outra conta B2 ou qualquer outro storage/provider elegível.

O cooldown usa o comportamento já existente de `SP_Core_Storage_Finaliza` e `SP_Core_Storage_Reserva`: enquanto `dth_bloqueio_ate` estiver no futuro, o storage falho não é elegível. Assim, o fallback pode selecionar outro repositório ou provider sem mudar a assinatura das SPs.

## Alterações no workflow

Aplicar passo a passo em uma cópia inativa do workflow:

1. Adicionar **Prepara Tentativa** imediatamente antes de **SP - Storage Provider Reserva** e colar `nodes/prepara-tentativa.js`, modo `Run Once for All Items`.
2. Substituir o código de **Normaliza** por `nodes/normaliza-reserva-retry.js`. A saída falsa de **IF | Reserva OK?** deve terminar com erro `Nenhum storage disponível para a tentativa`.
3. Manter sucesso dos três uploads ligado a **Finaliza Sucesso**.
4. Desabilitar `Retry on Fail` nos três nodes HTTP. O limite passa a ser controlado pelo workflow, não por repetições ocultas no mesmo storage.
5. Ligar a saída de erro dos três uploads a um novo Code node **Classifica Falha Upload**, com `nodes/classifica-falha-upload.js`.
6. Ligar **Classifica Falha Upload** a **Finaliza Falha** e usar:

```text
CALL SP_Core_Storage_Finaliza($1, $2, $3, $4, $5);
```

No editor visual do n8n, colocar o campo em modo **Expression** e inserir sem `=` manual:

```javascript
{{ [
  $json.storage_id,
  $json.reservation_token,
  0,
  $json.failure_status,
  $json.bloqueio_minutos
] }}
```

O export JSON serializa essa expressão com um único prefixo `={{`. Digitar `=` no editor visual gera `=={{` no export e erro de avaliação.

7. Substituir **Valida Finalização Falha** por `nodes/valida-finalizacao-falha-retry.js`.
8. Adicionar um IF após essa validação: `{{ $json.pode_tentar_novamente === true }}`.
9. Ligar `true` de volta a **Prepara Tentativa** e `false` a **Stop and Error**. A mensagem final pode usar `{{ 'Upload externo encerrado: ' + $json.failure_status }}`.

Fluxo esperado:

```text
Start -> Prepara Tentativa -> Reserva -> Normaliza -> SHA/Metadados -> Switch -> Upload
                                                                         | erro
                                                                         v
Classifica Falha -> Finaliza Falha -> Valida Finalização -> IF retry -- true --> Prepara Tentativa
                                                            |
                                                            false
                                                            v
                                                       Stop and Error
```

## Ordem de implantação

1. Publicar e validar primeiro a mesma revisão do Worker, com reconciliação `HEAD` pós-PUT ambíguo, em B2-01 (`flow-b2-storage-proxy-hml`) e B2-02 (`flow-b2-02-storage-proxy-hml`), sem compartilhar secrets ou variáveis entre contas.
2. Montar o retry em uma cópia inativa do workflow.
3. Testar os casos do plano de evolução, começando por mocks/controlados; não provocar falha em produção.
4. Exportar, sanitizar e comparar o workflow resultante.
5. Somente após homologação substituir o baseline versionado e ativar a versão operacional.

## Limite da evidência atual

A falha inicial retornou HTTP 502 do Worker, código `b2_upload_failed` e status upstream 520. Isso comprova uma resposta ambígua do PUT, não a causa raiz no B2 nem a ausência do objeto. A revisão reconciliadora foi implantada pelo usuário nos dois Workers e seus endpoints `/health` foram validados.

Depois da publicação da v0.4, B2-01 e B2-02 emitiram alertas reais independentes com `b2_lookup_failed`, HTTP 502 e upstream 403 na tentativa 1/3. A saída sanitizada de B2-01 confirma que a recusa aconteceu no `HEAD` anterior ao PUT. O classificador da v0.4 considerou apenas o HTTP externo e marcou a falha como transitória; este candidato passa a dar precedência ao upstream 401/403/404, classificando-o como `configuracao_storage` com cooldown de 60 minutos. Os testes locais foram atualizados e aprovados. O snapshot canônico permanece na v0.4 até o código ser aplicado, publicado e reexportado como v0.5.

Os e-mails isoladamente confirmam classificação, finalização validada e envio do alerta. Uma captura posterior da execução confirmou também `Restaura Contexto Após Alerta`, saída verdadeira do IF, segunda passagem por preparação/reserva/normalização/Switch, seleção de Cloudflare R2 e `Valida Finalização Sucesso`. O retry entre providers está homologado. Os dois Workers B2 foram recuperados e homologados. Rotação da chave de proxy compartilhada, Error Workflow global e publicação do classificador revisado permanecem pendentes.

Um teste isolado posterior de R2-08 retornou HTTP 500 com `public_base_url_not_configured`. O candidato também reconhece esse código como `configuracao_storage`, mantendo fallback e aplicando cooldown de 60 minutos. A correção operacional é configurar `PUBLIC_BASE_URL` no runtime do Worker; o valor existente no cadastro do Core não é injetado no Cloudflare. O item de teste originou-se de uma reserva R2-02, mas o endpoint foi sobrescrito para R2-08; portanto, a ocorrência não deve ser atribuída ao R2-02.

## Progresso informado

- 23/10/2026: node **Prepara Tentativa** criado e validado pelo usuário no n8n, com `tentativa=1`, `max_tentativas=3`, lista vazia de storages tentados e `binary.data` presente;
- 23/10/2026: **Normaliza** validado com contexto da tentativa e `binary.data` preservados; a seleção global retornou um storage Cloudflare R2, confirmando que o fluxo não está fixado em B2;
- 23/10/2026: saída verdadeira de **IF | Reserva OK?** processada pelo usuário;
- 23/10/2026: saída falsa conectada a **Stop | Sem Storage Disponível**;
- 23/10/2026: JSON de **SHA-256 + Metadados** validado com hash, MIME, bytes, dimensões e contexto da tentativa preservados;
- 23/10/2026: `binary.data` confirmado na saída de **SHA-256 + Metadados**;
- 23/10/2026: desenho atualizado com as três regras e saída extra `Fallback` no **SWITCH | Storage Provider**;
- 23/10/2026: Switch executado com reserva Cloudflare R2 e item encaminhado corretamente pela saída `S3`;
- 23/10/2026: `binary.data` confirmado na saída `S3` do Switch;
- 23/10/2026: Code node comum **Classifica Falha Upload** criado e as saídas de erro dos uploads direcionadas a ele;
- 23/10/2026: `Retry on Fail` desabilitado nos três uploads; o limite de tentativas passa a ser controlado pelo workflow;
- 23/10/2026: **Classifica Falha Upload** ligado a **Finaliza Falha**, que passou a enviar status classificado e cooldown à SP;
- 23/10/2026: código de **Valida Finalização Falha** atualizado e IF de decisão do retry posicionado;
- 23/10/2026: IF configurado, com `true` retornando a **Prepara Tentativa**, `false` encerrando, e topologia completa revisada visualmente;
- 23/10/2026: aviso visual em **Prepara Tentativa** confirmado como alerta de reexecução após múltiplas mudanças ainda não publicadas, sem erro estrutural;
- 23/10/2026: revisão reconciliadora informada como implantada em B2-01 (`flow-b2-storage-proxy-hml`); a consulta externa de `/health` pelo ambiente Codex foi bloqueada pelo proxy antes de alcançar o Worker;
- 23/10/2026: `/health` de B2-01 validado pelo painel Cloudflare, com HTTP saudável, `provider=backblaze_b2`, `configured=true` e sem teste de escrita;
- 23/10/2026: mesma revisão implantada em B2-02 (`flow-b2-02-storage-proxy-hml`) e `/health` validado com `provider=backblaze_b2`, `configured=true` e sem teste de escrita;
- 23/10/2026: export atualizado auditado; topologia e códigos estão coerentes, sem `pinData`, mas foram encontrados três headers `X-Proxy-Key` literais e dois campos com prefixo inválido `=={{` (`Finaliza Falha` e `Stop | Provider Não Suportado`);
- 23/10/2026: usuário corrigiu as expressões e padronizou o IF; confirmado que a UI Expression recebe `{{...}}` sem `=` manual, enquanto o export válido serializa `={{...}}`;
- 23/10/2026: export v0.2 auditado, sanitizado e promovido ao snapshot canônico local; `active=false`, sem `pinData`, credenciais da instância ou headers secretos, com sete Code nodes extraídos e indexados;
- 23/10/2026: auditoria confirmou, sem registrar o valor, que Cloudinary, R2 e B2 usam a mesma `X-Proxy-Key`; a rotação precisa abranger todos os proxies consumidores e o n8n;
- 23/10/2026: caminho de sucesso homologado manualmente no rascunho com reserva global, seleção Cloudflare R2, objeto novo (`existing=false`), finalização confirmada e saída validada; hash, URL, nome e binário não foram versionados;
- 23/10/2026: decisão operacional revisada: não provocar falhas; observar chamadas reais e enviar alerta por e-mail para cada falha de upload finalizada, inclusive quando houver retry, sem alertar o caminho de sucesso;
- 23/10/2026: ramificação lateral **Prepara Alerta Falha → Send E-Mail** configurada pelo usuário após **Valida Finalização Falha**, preservando o caminho principal para o IF de retry;
- decisão de validação: não enviar e-mail de teste nem provocar falha; analisar a primeira ocorrência real;
- 23/10/2026: versão 0.3 publicada e exportada, mas a auditoria encontrou `pinData` em **Start Storage**, alerta ligado apenas à saída `true` do IF, falha terminal sem alerta e saída de erro do Gmail sem continuidade; v0.3 não foi promovido ao snapshot canônico;
- 23/10/2026: versão 0.4 corrigida e publicada; sem `pinData`, alerta antes do IF, saídas de sucesso/erro do Gmail convergindo em **Restaura Contexto Após Alerta**, contexto/binário preservados e export final sanitizado;
- 23/10/2026: snapshot v0.4 validado com 23 nodes, nove Code nodes indexados, seis artefatos do retry e testes automatizados aprovados;
- 23/10/2026: dois alertas reais independentes confirmaram `b2_lookup_failed` no HEAD inicial de B2-01 e B2-02, ambos com upstream 403 e tentativa 1/3;
- 23/10/2026: captura integral de uma execução confirmou alerta, restauração do contexto, retorno do IF, segunda reserva global, mudança de `backblaze_b2` para `cloudflare_r2`, upload e finalização com sucesso;
- 23/10/2026: regra candidata corrigida para priorizar upstream 401/403/404 como `configuracao_storage`, cooldown de 60 minutos e fallback ainda permitido; teste de regressão aprovado, ainda não implantado no n8n;
- 23/10/2026: B2-01 e B2-02 recuperados e homologados em leitura, escrita, deduplicação e entrega pública; B2-02 exigiu nova Application Key;
- 23/10/2026: erro `public_base_url_not_configured` do teste isolado R2-08 acrescentado às falhas de configuração com teste de regressão; variável, PUT, URL pública e deduplicação validados;
- próximo passo operacional: ativar R2-08 de forma controlada, observar integração e aplicar/publicar/auditar o classificador v0.5; rotacionar a chave de proxy compartilhada e criar Error Workflow para falhas não tratadas;
- códigos implantados de B2-01 e B2-02 preservados e comparados; ambos correspondem ao baseline pré-reconciliação.
