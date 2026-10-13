# Core Storage Provider — implementação e homologação

Registro consolidado em 13/10/2026, referente à continuidade do [contexto anterior](CORE_STORAGE_MEDIA_EXTERNAL_CONTEXT_2026-10-13.md).

Fonte: definições SQL, configurações de nodes, saídas de execução e confirmações fornecidas pelo usuário nesta conversa. Não houve acesso direto ao banco, à instância n8n ou ao WordPress para auditoria. O repositório registra o estado relatado; não contém export atualizado do workflow nem dump das procedures instaladas.

## Decisões mantidas

- Workflow `SUB | Storage Media External`, com adapters Cloudinary e R2 dentro do mesmo workflow.
- Provider representa tecnologia; storage representa conta/bucket.
- Reserva operacional: `CALL SP_Core_Storage_Reserva(NULL, 3);`. O pool é global; não restringir provider para favorecer um adapter.
- Seleção conserva prioridade, menor data de acesso, contador e ID como desempate, excluindo inativos, bloqueados e reservas vigentes.
- `num_count` contabiliza reservas/tentativas, não uploads concluídos nem quota por hora.
- A cota relatada de 500 acessos/hora ao MySQL motiva duas chamadas por tentativa: reserva e finalização. Não há controle dessa janela implementado nas SPs.
- `CLOUDINARY-07` permanece definitivamente desativado.
- Não implementar espelhamento ou fallback distribuído geral. Foi posteriormente aprovado retry limitado de upload com nova reserva; ainda não homologado.

## Banco de dados: alterações confirmadas pelo usuário

### SP_Core_Storage_Reserva

Assinatura mantida: `(p_provider VARCHAR(45), p_ttl_reserva_minutos INT)`.

- TTL entre 1 e 30 minutos; padrão 3.
- Seleção transacional com `FOR UPDATE`.
- Para Cloudinary, resolve `credential_ref=config_api_ia:<id>` na `Config_API_IA` na mesma chamada. Não fixa ID de conta.
- Valida referência e presença de `dsc_api_key`/`dsc_api_secret` antes de efetivar a reserva. Em referência inválida ou credencial incompleta, faz rollback e devolve `reserva_ok=0`; não tenta automaticamente outra conta nessa chamada.
- Para R2, credenciais do bucket não são retornadas. `credential_ref=NULL` é esperado no cadastro atual.
- Gera token UUID, grava prazo e acesso e incrementa contador. O TTL começa após seleção/resolução das credenciais.
- Retorna dados capturados na transação, sem reler a linha após commit, incluindo `credential_id` e os campos de credenciais somente quando aplicáveis.
- Handler de erro SQL faz rollback e propaga o erro.

### SP_Core_Storage_Finaliza

Assinatura mantida: `(p_storage_id INT, p_reservation_token CHAR(36), p_sucesso TINYINT, p_status VARCHAR(255), p_bloqueio_minutos INT)`.

- Confere ID + token sob transação e `FOR UPDATE`.
- Sucesso: registra status, limpa bloqueio, token e prazo de reserva.
- Falha: registra status e libera a reserva. Bloqueio `0` não penaliza a conta; de 1 a 1440 aplica bloqueio em minutos. Valor inválido ou nulo mantém padrão 60.
- Retornos: `storage_liberado`, `storage_liberado_com_erro`, `storage_bloqueado`; ID/token não encontrados retornam `finalizacao_ok=0`.
- Handler SQL faz rollback; retorno usa valores capturados antes do commit.
- Token expirado ainda é aceito se continuar associado à conta. Se uma nova reserva substituiu o token, a finalização antiga é rejeitada.

### Fuso Brasília: UTC−3

Diagnóstico fornecido: `NOW()` igual a `UTC_TIMESTAMP()`, sessão e global `SYSTEM`, sistema `UTC`.

Versões completas das duas SPs foram fornecidas para operar por chamada em UTC−3: capturam `@@session.time_zone`, executam `SET SESSION time_zone='-03:00'`, usam `NOW()` e restauram o fuso original após commit/rollback e no handler SQL. Retorno técnico com `time_zone=SYSTEM` é compatível com essa restauração.

Execução R2 posterior apresentou `dth_acesso=16:43:44` e `updated_at=16:43:46`, consistente com o horário operacional relatado em Brasília. Não foi recebido dump final das SPs para confronto independente.

Campos `dth_acesso`, `dth_bloqueio_ate`, `dth_reserva_ate`, `created_at` e `updated_at` são `DATETIME`. Auditoria usa defaults `CURRENT_TIMESTAMP`, com atualização automática de `updated_at`. Alterações feitas pelas SPs usam a sessão em Brasília; escritas externas continuam dependentes do fuso de suas conexões.

**Não foi executada/conﬁrmada migração histórica de datas.** Existem valores anteriores em UTC e dados operacionais copiados do legado de origem a confirmar. Não converter indiscriminadamente nem aplicar novamente subtração de três horas. `created_at` histórico permanece preservado.

## Workflow n8n implementado

```text
Start Storage
 → SP - Storage Provider Reserva
 → Normaliza
 → IF | Reserva OK?
 → SHA-256 + Metadados
 → SWITCH | Storage Driver
    ├─ CDA → Prepara Cloudinary → Upload Cloudinary
    └─ S3  → Upload S3/R2

Uploads Success → Finaliza Sucesso → Valida Finalização Sucesso
Uploads Error   → Finaliza Falha → Valida Finalização Falha → Stop And Error
```

- Normalização extrai a linha do retorno MySQL aninhado, preserva `binary.data` do Start e transporta `ind-api-folder` também como `storage_folder`.
- SHA-256 puro JavaScript e leitura por helper n8n permanecem; `require('crypto')` não disponível na instância conforme histórico anterior.
- Metadados comuns: `sha256`, `original_filename`, `mime_type`, `bytes`, `width`, `height`; reserva e binário preservados.
- Consulta adicional `MySQL | Resolver Credencial Cloudinary` eliminada: credenciais já vêm da reserva.
- Finalizações usam parâmetros SQL `$1…$5`, com ID/token recuperados de `SHA-256 + Metadados`, node comum aos dois ramos. Não referenciar `Prepara Cloudinary` na finalização comum.
- Sucesso usa `[storage_id, token, 1, 'Sucesso', 0]`; falha inicial usa `[storage_id, token, 0, 'Falha no upload; verificar erro HTTP', 0]`.
- HTTPs configurados para `Continue (using error output)`. Não salvar erro HTTP completo no banco por risco de dados sensíveis.
- Validadores extraem a linha da SP e exigem `finalizacao_ok=1`. O objeto técnico MySQL não deve ser tratado como segunda finalização.
- Workflow pai mostrado com timezone padrão `America/Sao_Paulo`; manter igual no filho.

### Cloudinary

- `Prepara Cloudinary` monta Basic Auth de `dsc_api_key:dsc_api_secret`, preservando contexto/binário.
- Cloud name extraído de `public_base_url=https://res.cloudinary.com/<cloud_name>`.
- POST: `endpoint_url` sem barra final + `/image/upload`.
- Headers: `Authorization`, `X-Cloudinary-Cloud`, `X-Proxy-Key` do proxy existente.
- Multipart: `file` binário `data`; `public_id=storage_folder/sha256`; `asset_folder=storage_folder`; `overwrite`, `use_filename` e `unique_filename` em `false`.
- Não configurar Content-Type multipart manualmente.

### Cloudflare R2

- Um único HTTP para as duas contas, URL dinâmica `endpoint_url` sem barra final + `/upload`.
- Usuário confirmou `X-Proxy-Key` padrão aceita pelos dois Workers. Isso substitui a premissa anterior de chaves independentes para a configuração atual.
- Worker acessa o bucket via binding `MEDIA_BUCKET`; n8n não precisa de credenciais S3/bucket.
- Body: `n8n Binary File`, campo `data`.
- Headers mapeados dos campos atuais: `x-storage-folder`, `x-media-sha256`, `x-original-filename`, `Content-Type`, `x-media-width`, `x-media-height`.
- `x-file-extension` mapeia JPEG→jpg, PNG→png, WebP→webp; outros formatos ainda precisam de validação/tratamento.
- R2-01: Worker `n8n-r2-storage-proxy.core360.workers.dev`, bucket `core-media-hml`.
- R2-02: Worker `flow-r2-storage-proxy-02.core360-2.workers.dev`, bucket `core-media-hml-2`.

## Fronteira de retorno ao fluxo pai

`Valida Finalização Sucesso` também recupera a resposta do HTTP do ramo executado e devolve somente:

```text
provider, sha256, asset_id, public_id, secure_url, url,
width, height, mime_type, original_filename, bytes, existing
```

- Recupera resposta direta ou `body`, exige HTTPS, dimensões positivas e identificadores.
- Cloudinary preserva `asset_id` real. R2 usa `asset_id` fornecido pelo Worker; fallback proposto para `object_key` precisa ser validado em cenários onde o Worker não fornecer ID.
- `url` de saída uniformizado com URL HTTPS.
- Não devolve credenciais, autorização nem dados operacionais da conta.
- Orientação posterior: aplicar `.trim()` ao nome original, pois uma resposta R2 apresentou espaço ao final.
- Se MySQL emitir múltiplos itens, usar modo `Run Once for All Items`, primeira linha e retorno único; não processar `affectedRows` como mídia.
- Chamada do filho deve aguardar conclusão. No WP, mapear `sha256` diretamente, sem extraí-lo de `public_id`, e enviar `provider` explicitamente.

## Evidências de homologação

### Cloudinary: caminho de sucesso concluído

- Reserva selecionou CLOUDINARY-03, storage 3, referência `config_api_ia:73`.
- Upload retornou `asset_id=8f73d7f01aea6fd29d7bbdff53240bc0`, pasta `m360/featured`, JPEG 1200×800, 89428 bytes, `existing=false`.
- Finalização retornou `finalizacao_ok=1`, `storage_liberado`; token, prazo e bloqueio limpos.
- Contrato uniforme foi devolvido; usuário confirmou conclusão do fluxo pai com registro/associação WordPress.
- Em uma captura do pai havia dados fixados nos nodes de chamada/registro e item na saída Error do Gmail. Orientado remover dados fixados para novo teste integral; exclusão de e-mail é questão separada do storage.
- Teste manual antigo excedeu TTL de três minutos e ainda finalizou porque o token não havia sido substituído. Avaliar TTL/retries antes de produção.

### R2-01: caminho de sucesso concluído

- Não foi necessário isolar o pool: rodízio selecionou R2-01 naturalmente.
- Storage 10; URL pública no host `pub-4fc4737db70147a8bec050dd7fb883d7.r2.dev`.
- Pasta `pel/featured`, JPEG 1200×800, 119761 bytes, `existing=false`; SHA-256 retornado como `asset_id` pelo Worker.
- Finalização confirmada, reserva e bloqueio limpos; contador 2.
- Usuário confirmou conclusão da publicação e post público no WordPress.
- Linha R2-02 enviada inicialmente pertencia a outra reserva; não é evidência de execução R2-02 neste novo workflow.

## Retry aprovado, ainda pendente

Decisão: falha recuperável finaliza a reserva e tenta outro storage, máximo de **três tentativas totais**, mantendo provider `NULL`. Não retornar ao trigger Start.

Desenho aprovado:

```text
Erro HTTP → Classificar erro → Finaliza Falha → Validar finalização
 → Pode tentar novamente?
    ├─ Sim → Recuperar contexto/binário → Próxima tentativa → Reserva
    └─ Não → Stop And Error
```

- Quota/indisponibilidade podem justificar bloqueio temporário e retry; erro interno, pasta inválida ou binário ausente não se resolvem trocando storage.
- Falha com bloqueio 0 deixa a conta elegível; evitar repetir o mesmo destino exige classificação/bloqueio ou mecanismo explícito de exclusão ainda não implementado.
- Não reservar novamente se a finalização falhar.
- Timeout pode ocorrer após upload efetivo, gerando cópia adicional em outra conta; tratar essa ambiguidade.
- Até três tentativas podem consumir seis chamadas MySQL.
- Foi proposto `CODE | Contexto da Tentativa` entre Start e Reserva, transportando `upload_attempt`, pasta e binário; Normaliza deve recuperar contexto dessa tentativa, não sempre do Start.
- Não houve confirmação de implantação desses ajustes nem amostra de erro sanitizada para terminar a classificação.
- O ramo atual confirmado ainda termina em Stop And Error. Não considerar retry homologado.

## Pendências para produção

1. Validar R2-02 no novo fluxo, até registro/associação WP.
2. Implementar e testar classificação de erros, bloqueios e retry limitado; testar falha de finalização e nenhum storage disponível.
3. Tratar falhas anteriores ao HTTP, driver desconhecido e ramo IF falso. Normaliza originalmente lança erro com `reserva_ok=0`, tornando esse ramo falso inacessível; revisar de forma consistente.
4. Validar concorrência, expiração, TTL durante upload/retries e efeitos de upload com resposta inválida após finalização de sucesso.
5. Alinhar datas históricas UTC/UTC−3, confirmando origem dos dados legados antes de conversão.
6. Revisar persistência de execuções n8n: credenciais da SP e Basic Auth podem estar no histórico, apesar de ausentes no retorno ao pai.
7. Credencial Cloudinary foi exposta no chat; recomendada rotação e atualização da referência de origem. Rotação não confirmada. Nenhum valor reproduzido neste registro.
8. Receber exports sanitizados do workflow e definições finais do banco caso se deseje versionar os artefatos executáveis. Este documento não substitui backup do banco.

## Script de isolamento

Foi fornecido script opcional com backup em tabela temporária da mesma sessão, desativação de não-R2 e restauração dos estados preservando CLOUDINARY-07 inativo. **Não foi utilizado**, segundo o usuário. Não há alteração de pool a restaurar atribuível a esse script.
