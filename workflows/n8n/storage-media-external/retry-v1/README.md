# Retry v1 — candidato para homologação

Este pacote foi preparado após a primeira falha real sanitizada de upload em B2-01, em 23/10/2026. Não foi importado nem executado no n8n. O export `../SUB_Storage_Media_External.json` continua sendo o baseline sanitizado anterior e não deve ser apresentado como se já contivesse retry.

## Comportamento

- no máximo três tentativas totais por arquivo;
- cada falha é classificada antes da finalização;
- a reserva corrente precisa ser finalizada com sucesso antes de nova reserva;
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

```javascript
={{ [
  $json.storage_id,
  $json.reservation_token,
  0,
  $json.failure_status,
  $json.bloqueio_minutos
] }}
```

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

A falha observada retornou HTTP 502 do Worker, código `b2_upload_failed` e status upstream 520. Isso comprova uma resposta ambígua do PUT, não a causa raiz no B2 nem a ausência do objeto. O código deste pacote foi validado localmente, mas implantação e homologação permanecem pendentes.
