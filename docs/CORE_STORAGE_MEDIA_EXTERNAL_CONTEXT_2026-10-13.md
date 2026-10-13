# Core Storage Media External — contexto consolidado e continuidade

> Fonte: decisões, payloads e resultados relatados na conversa técnica até 13/10/2026. Este documento é um registro do **estado comunicado**, não uma auditoria independente de infraestrutura. Evitar tratar propostas como implementações verificadas.
>
> **Segurança:** nenhum valor de `PROXY_KEY`, API key, API secret, Application Password ou outro segredo é reproduzido neste documento.

## 1. Objetivo e decisões de escopo

O **Core Storage Media External** centraliza uploads de featured images editoriais fora do WordPress, com SHA-256 para identificação/deduplicação, organização por portal e pasta, seleção de storage/conta, monitoramento, bloqueio e retorno uniforme de URL/metadados ao Core Editorial.

Portais/prefixos citados: **PEL** (`pel/featured`), **M360** (`m360/featured`) e futuro **Trilhas** (`trilhas/featured`).

Decisões:
- **Preservar a solução Cloudinary de produção**; migração incremental, sem substituir a SP/fluxo legado prematuramente.
- Cloudinary e Cloudflare R2 são providers distintos; cada conta/bucket é um **storage** distinto, não um provider.
- Seleção via SP e ramificação interna do **mesmo workflow n8n**; usuário rejeitou Execute Subworkflow para os adapters de upload do novo Core.
- **Rodízio**, não espelhamento/redundância distribuída automática nesta sprint; não implementar `MIRROR` ou `FALLBACK` entre storages agora.
- Separar `provider` (ex.: `cloudinary`, `cloudflare_r2`, futuro `backblaze_b2`) de `storage_driver` (ex.: `cloudinary_api`, `s3_compatible`). O driver S3-compatible é uma abstração alvo; **o upload R2 atualmente é via Cloudflare Worker/binding R2**, não uma conexão S3 genérica já homologada para B2.
- O WordPress registra attachment virtual e associa featured image, mas não escolhe conta, bucket, Worker nem realiza upload.

## 2. Infraestrutura homologada, identidade das contas

### Cloudinary
- Rodízio legado em `Config_API_IA`, com `Cloudinary_Usage` relacionado por `api_id`.
- Proxy em produção: `https://n8n-cloudinary-proxy.core360.workers.dev/`.
- Inventário carregado no Core: **9 contas cadastradas, 8 ativas e 1 inativa**.
- `credential_ref = config_api_ia:<id>` mantém a referência às credenciais de origem sem duplicar segredo.

| storage_id | alias | Config_API_IA.id | cloud_name | ativo |
| ---: | --- | ---: | --- | ---: |
| 1 | CLOUDINARY-01 | 71 | zdzn0kgm | 1 |
| 2 | CLOUDINARY-02 | 72 | sk9mbfyb | 1 |
| 3 | CLOUDINARY-03 | 73 | ulrj2bya | 1 |
| 4 | CLOUDINARY-04 | 74 | dn1a6v0cl | 1 |
| 5 | CLOUDINARY-05 | 75 | yezowpnj | 1 |
| 6 | CLOUDINARY-06 | 76 | gbjn0cjg | 1 |
| 7 | CLOUDINARY-07 | 82 | mtulsmgp | 0 |
| 8 | CLOUDINARY-08 | 86 | mlobcylk | 1 |
| 9 | CLOUDINARY-09 | 90 | nksstmuv | 1 |

### Cloudflare R2
Ambas as contas tiveram **upload de imagem via Worker validado**; o R2-02 foi também aceito pelo plugin WordPress após o Registry v0.1.9.

| storage_id | alias | conta | bucket | Worker para upload | URL pública de homologação |
| ---: | --- | --- | --- | --- | --- |
| 10 | R2-01 | ppiressolucoes@outlook.com | `core-media-hml` | `https://n8n-r2-storage-proxy.core360.workers.dev/` | `https://pub-4fc4737db70147a8bec050dd7fb883d7.r2.dev` |
| 11 | R2-02 | ppiressolucoes@msn.com | `core-media-hml-2` | `https://flow-r2-storage-proxy-02.core360-2.workers.dev` | `https://pub-43dc3ba28cba479abf3287dc11405d82.r2.dev` |

**Importante:** o nome do bucket #02 foi explicitamente corrigido pelo usuário para **`core-media-hml-2`** (não `core-media-hml-02`). Confirmar no painel caso haja divergência entre o cadastro final e ambiente real.

Cada Worker tem:
- binding R2 **`MEDIA_BUCKET`** apontando ao respectivo bucket;
- secret **`PROXY_KEY`** independente;
- variável **`PUBLIC_BASE_URL`** apontando à URL pública correspondente;
- `GET /health`; o health reporta configuração declarada, **não prova escrita no bucket**; a escrita foi validada via `POST /upload`.

Exemplo de resposta de upload real R2-02:
- SHA-256 `9510ae529be1e3f1352a9f5e03082bce75de5df83159794a1d9d024593a885c9`
- `object_key=pel/featured/<sha256>.jpg`
- `width=840`, `height=560`, `mime_type=image/jpeg`, `bytes=84600`, `existing=false`
- `provider=cloudflare_r2`, `secure_url` hospedada no `pub-43dc...r2.dev`.

Planejadas contas **R2-03/R2-04**, mas ainda **não cadastradas/homologadas** neste histórico.

## 3. Banco de dados e modelagem

Tabela legada `Config_API_IA` (campos conhecidos): `id`, `dsc_plataforma`, `dsc_url_servico`, `dsc_email_cad`, `dsc_api_key`, `dsc_api_secret`, `dsc_status`, `dth_acesso`, `dth_bloqueio_ate`, `num_count`, `ind_ativo` (legado FLOAT). Não modificá-la automaticamente.

Tabela criada: **`Core_Storage_Provider`**, InnoDB, com os campos:
- identidade: `storage_id` (PK auto incremento), `provider`, `storage_driver`, `storage_alias` (único), `account_email`;
- destino: `endpoint_url`, `public_base_url`, `bucket_name`, `region_name`, `credential_ref`;
- operação: `dsc_status`, `dth_acesso`, `dth_bloqueio_ate`, `num_count`, `prioridade`, `ind_ativo`;
- concorrência: `reservation_token` (CHAR(36)), `dth_reserva_ate` (DATETIME);
- auditoria: `created_at`, `updated_at`;
- índices para pool/provider/driver/reserva e unicidade `(provider,credential_ref)`.

Cadastro confirmado por SELECT:
- `cloudinary`: 9 total / 8 ativos / 1 inativo;
- `cloudflare_r2`: 2 total / 2 ativos;
- total 11 destinos, **10 ativos**. `prioridade=100` nos registros iniciais.
- Os dois R2 têm `credential_ref=NULL`; definir resolução segura por storage antes de upload dinâmico. **Não presumir que a credencial de um Worker serve para ambos.**

### Stored Procedures criadas e testadas

`SP_Core_Storage_Reserva(IN p_provider VARCHAR(45), IN p_ttl_reserva_minutos INT)`:
- `NULL` em provider seleciona pool inteiro; provider preenchido restringe;
- filtra ativo, bloqueio expirado e reserva não vigente;
- `ORDER BY prioridade ASC, dth_acesso nulo primeiro, dth_acesso ASC, num_count ASC, storage_id ASC`;
- seleção transacional `FOR UPDATE`, marca `reservation_token=UUID()`, `dth_reserva_ate`, atualiza `dth_acesso`, incrementa `num_count`;
- devolve `reserva_ok`, `storage_id`, `provider`, `storage_driver`, `credential_ref`, `endpoint_url`, `reservation_token`, outros campos operacionais;
- exemplo `CALL SP_Core_Storage_Reserva(NULL,3);`.
- **Observação:** `FOR UPDATE` serializa/bloqueia a linha, mas a eficiência/justiça em concorrência real e ausência de espera excessiva ainda precisam de avaliação; testes de concorrência simultânea não foram demonstrados.
- Tokens de reservas expiradas podem continuar visíveis; limpeza automática foi **sugerida**, não confirmada como implantada.
- Como `num_count` aumenta na **reserva**, representa tentativas/reservas, não necessariamente uploads concluídos.

`SP_Core_Storage_Finaliza(IN p_storage_id INT, IN p_reservation_token CHAR(36), IN p_sucesso TINYINT, IN p_status VARCHAR(255), IN p_bloqueio_minutos INT)`:
- valida par `storage_id` + token sob transação e `FOR UPDATE`;
- sucesso: libera reserva, limpa bloqueio e registra status;
- erro: libera reserva, aplica `dth_bloqueio_ate` e registra status;
- testes homologados: `storage_id=6` erro `storage_bloqueado` e `storage_id=9` sucesso `storage_liberado`.
- **Não confundir** `storage_id` (novo Core, 1–11) com `Config_API_IA.id` (p.ex. 75 ou 90). O teste falhou ao passar `75` no lugar de `5`.
- `reservation_token` é UUID string e requer parâmetro SQL textual/parametrizado; sem aspas no SQL interpolado ocorre erro “Unknown column”.
- Chamar `Finaliza` após upload, **tanto no sucesso quanto na falha**. Falha de validação antes do upload também requer tratamento para evitar reserva órfã; evitar bloquear a conta por erros internos de n8n que não comprovem falha do provider.
- TTL de 3 minutos é valor de piloto. Upload/retries que excedam TTL podem tornar a reserva elegível a outro processo; avaliar renovação e finalização tardia antes da produção.

### Pendências de arquitetura SQL
- Sem implementação confirmada de contabilização de quota real, health, seleção ponderada ou rodízio balanceado por provider.
- Dados operacionais Cloudinary foram **copiados inicialmente** da tabela legada; ainda não existe sincronização contínua confirmada. Definir fonte de verdade para status, bloqueio e `dth_acesso` antes de alternar tráfego de produção.
- Armazenar refs a secrets, nunca segredos em respostas operacionais, logs ou documentação.

## 4. WordPress: plugin de mídia virtual

Plugin denominado **M360 - Core Media Storage External** (nome/versões discutidos):
- versão **0.1.8**: Cloudinary legado + Cloudflare R2, inferência retrocompatível, allowlist inicial;
- versão **0.1.9**: **Storage Provider Registry** conforme entregas relatadas pelo usuário.

### v0.1.9: Storage Provider Registry
- Menu: **M360 Dashboard → Storage Providers**, com fallback em **Configurações → Storage Providers**.
- CRUD para providers customizados; `cloudinary` e `cloudflare_r2` padrão, protegidos contra exclusão.
- configuração do provider: `provider_key`, `label`, `enabled`, `allowed_hosts`, `allowed_host_patterns`, `delivery_mode`;
- `*.r2.dev` é pattern suportado; HTTPS; testar URL; proibição de código executável ou regex arbitrária.
- apenas modos `cloudinary_transform` e `passthrough`.
- provider ausente no payload => `cloudinary` (compatibilidade n8n legado).
- attachment antigo sem meta provider: inferir Cloudinary por URL legada; entrega de attachments publicados não deve ser interrompida ao desabilitar novas entradas.
- Cloudinary aplica `c_limit,w_768`; R2/passthrough conserva URL.
- SHA-256 é chave exclusiva de deduplicação. Preservadas rotas, `/assign`, GUID/metas, featured media e integrações Yoast/Open Graph/Twitter conforme relato de implementação.
- códigos de erro de validação: `unsupported_provider`, `provider_disabled`, `invalid_external_url`, `invalid_dimensions`.
- **Não confundir o Registry WordPress com contas/buckets/storages do Core.** Palavra `provider` designa tecnologia lógica e não `R2-01`.
- A aceitação do R2-02 no PEL após v0.1.9 foi confirmada por attachment **88302**, `existing=false` e `provider=cloudflare_r2`. O registro foi confirmado; testes de regressão integrais em todos os portais não foram apresentados.

### Contrato no Core Editorial
Entrada compatível ao WordPress:
```json
{
  "provider": "cloudflare_r2",
  "sha256": "<64-hex>",
  "asset_id": "<identificador>",
  "public_id": "pel/featured/<sha256>",
  "secure_url": "https://pub-...r2.dev/pel/featured/<sha256>.jpg",
  "width": 1200,
  "height": 800,
  "mime_type": "image/jpeg",
  "original_filename": "imagem.jpg"
}
```
`POST /m360/v1/external-featured-media` registra/reutiliza attachment virtual. `POST /m360/v1/external-featured-media/assign` associa ao post. Os fluxos WP passam por Workers proxy como `n8n-pel-proxy` / `n8n-m360-proxy`.

Incidentes e soluções:
- R2-01 inicialmente tinha `asset_id=SHA-256` em vez do ID Cloudinary de 32 caracteres; plugin foi evoluído para provider-aware, mantendo contratos legados. **Não truncar SHA genericamente para simular Cloudinary**.
- `invalid_external_url` no R2: faltava `provider=cloudflare_r2` no body, ou novo hostname R2-02 não estava permitido na v0.1.8. v0.1.9 resolve múltiplos hosts via Registry/pattern.
- `invalid_dimensions`: header `x-media-width` / `x-media-height` não chegava ao Worker; logo upload devolvia `width/height=null`. Metadados devem vir do binário e ser transmitidos ao Worker.
- MIME correto é `image/jpeg` (não `image/jpg`).
- HTTP **522** no `/assign`: timeout TCP Cloudflare → origem WP; problema de infraestrutura, não validação do plugin. O retorno sugeriu `retry_after=120` s; retry nativo de um node n8n foi limitado a 5000ms, então propôs-se ramo separado Wait 120s (não confirmado implementado).

## 5. n8n: estado exato na pausa atual

Novo workflow em desenvolvimento: `SUB | Storage Media External` (Core multi-provider).

**Decisão explícita:** os dois adapters devem ser ramificações **dentro deste workflow**, não chamadas a novos subworkflows.

Desenho atual:

```text
Start Storage (arquivo binary.data e ind-api-folder)
  → SP | Storage Provider Reserva
  → CODE | Normaliza Reserva
  → IF | Reserva OK?
  → CODE | SHA-256 + Metadados
  → SWITCH | Storage Driver
      ├── CDA: cloudinary_api (próxima etapa)
      └── S3: s3_compatible  (próxima etapa)
  → normalizar upload → finalizar SP → devolver contrato de mídia
```

### Nodes validados
1. `Start Storage`: uma imagem JPEG entrou em `binary.data`; exemplo original `proibicao-das-bets-pode-gerar-disputa-por-indenizacoes-e-afetar-contratos-milionarios-no-futebol.jpg`.
2. `SP | Storage Provider Reserva`: `CALL SP_Core_Storage_Reserva(NULL,3);`; retorno JSON MySQL pode ser **array dentro de `item.json`**, não objeto direto.
3. `CODE | Normaliza Reserva`: extrai a primeira linha do retorno e **recupera binary original** via `$('Start Storage').first().binary`; confirmado JSON limpo + aba Binary `data`. Sem isso MySQL perde o binário.
4. `IF | Reserva OK?`: `Number($json.reserva_ok) === 1`.
5. `CODE | SHA-256 + Metadados`: modo **Run Once for Each Item**; `require('crypto')` é **bloqueado** nessa instância do n8n, portanto SHA-256 puro JS + `this.helpers.getBinaryDataBuffer(0,'data')`. Confirmado binário e saída:
   - `sha256=c007b86304a737753ea24aa778574efc668b55a6a3679d05d28b3a13bb25b2c9`
   - `original_filename=proibicao-das-bets-pode-gerar-disputa-por-indenizacoes-e-afetar-contratos-milionarios-no-futebol.jpg`
   - `mime_type=image/jpeg`, `bytes=89428`, `width=1200`, `height=800`.
6. `SWITCH | Storage Driver`: regra `$json.storage_driver == 'cloudinary_api'` → `CDA`; `== 's3_compatible'` → `S3`. **Rota CDA confirmada em execução.**

**Próximo node exatamente onde a conversa parou:**
`MySQL | Resolver Credencial Cloudinary` na saída `CDA`, usando `credential_ref=config_api_ia:71` para buscar só a conta escolhida pela reserva. Foi proposta consulta SQL à `Config_API_IA`, mas **não há confirmação de execução até aqui**. Não fixar credencial id 71. Não expor secrets no histórico n8n. Após MySQL, reintegrar contexto JSON e `binary.data` (o node MySQL pode novamente descartá-los).

### Cuidados técnicos antes de uploads
- A normalização da reserva reconstituiu JSON da SP e binário, **mas não transportou explicitamente `ind-api-folder` do `Start Storage`** para o JSON final. O SHA validado também não mostrou `storage_folder`. Corrigir isso antes de formar `public_id/object_key` para evitar upload na pasta errada.
- O contrato de hash do node validado usa `sha256`, `original_filename`, `mime_type`, `width`, `height`; adapters anteriores usavam `media_sha256`, `media_original_filename`, `media_mime_type`, `media_width`, `media_height`, `storage_folder`. **Normalizar mapeamento** sem quebrar o Core Editorial.
- Recuperar PROXY_KEY por storage com referência segura; o Registry SQL possui `credential_ref=NULL` para R2-01/R2-02. Não selecionar R2-02 e acidentalmente usar a credencial Worker R2-01.
- Para R2 Worker upload enviar body binário `data` e headers, conforme Worker homologado: `X-Proxy-Key`, `x-storage-folder`, `x-media-sha256`, `x-file-extension`, `x-original-filename`, `x-media-width`, `x-media-height`, `Content-Type`.
- Uso de `endpoint_url` para cada R2 é dinâmico; concatenar `/upload` com tratamento de barra final. Para Cloudinary, recuperar conta Cloudinary via `credential_ref` e preservar o proxy existente.
- Distinguir erro de upload de erro interno de workflow; erro de n8n não deve bloquear indiscriminadamente um storage saudável.
- `SP_Core_Storage_Finaliza` deve receber mesmo `storage_id` e `reservation_token` da execução corrente. Evitar reexecução manual contra token expirado como se fosse confirmação de upload.
- Retornar ao fluxo pai contrato uniforme (`provider,sha256,asset_id,public_id,secure_url,url,width,height,mime_type,bytes,existing`); WordPress não deve conhecer contas/storage. Em Cloudinary preservar especificidades de response e original `asset_id`, sem fabricar identificadores.

## 6. Plano de continuidade

1. Na ramificação `CDA`, resolver dinamicamente credenciais `Config_API_IA` por `credential_ref`; preservar `binary.data` e demais metadados ao sair do MySQL.
2. Recuperar o folder de entrada e consolidar schema de metadados comum antes do upload.
3. Ligar o HTTP Cloudinary ao proxy existente usando credenciais da conta selecionada, testar upload isolado e resposta compatível.
4. Na ramificação `S3`, configurar seleção de Worker **R2-01 vs R2-02** com segredo apropriado por conta, ainda sem terceiro provider.
5. Normalização dos dois ramos, tratamento de erro, finalização SP com token e saída uniforme ao Core Editorial.
6. Validar publicação/registros WP com v0.1.9 e regressão Cloudinary sem alterar flows legados.
7. Só então promover pool multi-provider à produção. R2-03/R2-04 e B2 ficam como expansão futura; **MIRROR/FALLBACK automático estão fora do escopo atual**.

## 7. Alertas de segurança e operação

- **Não commitar secrets**, Application Passwords, PROXY_KEY, API keys/secret nem dumping integral de respostas da `Config_API_IA`.
- Para logs de banco/execuções n8n, ocultar `dsc_api_key` / `dsc_api_secret`.
- O `*.r2.dev` no WordPress é conveniência de homologação, mas aceita URLs públicas de terceiros dentro do namespace; autenticação e fonte controlada do pipeline importam. Futuramente considerar allowlist dinâmica por destinos registrados ou domínio próprio, sem forçar esse domínio nesta sprint.
- Evitar trocar URLs públicas `r2.dev` em attachments antigos sem planejamento; uma mudança de domínio requer estratégia de delivery e compatibilidade.
- Nomes e status neste documento refletem resultados relatados, não consulta ao banco/Cloudflare em tempo real.
