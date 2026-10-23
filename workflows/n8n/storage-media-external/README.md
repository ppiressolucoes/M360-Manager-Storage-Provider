# n8n — SUB | Storage Media External

Este diretório é o local canônico para os exports sanitizados e os artefatos de desenvolvimento do workflow multi-provider de storage externo.

## Fonte e status

A instância n8n é o runtime operacional. O arquivo [`SUB_Storage_Media_External.json`](SUB_Storage_Media_External.json) é o snapshot sanitizado fornecido para versionamento. Ele foi validado como JSON, mas ainda **não foi reimportado nem testado após a sanitização**; trate-o como baseline de desenvolvimento, não como pacote pronto para ativação.

Na cópia pública, removi referências de credenciais e metadados específicos da instância, desativei o workflow e substituí os três valores literais de `X-Proxy-Key` por `RECONFIGURE_IN_N8N_SECRET`. Antes de executar/importar, vincule as credenciais MySQL e configure as chaves de cada proxy na instância n8n. O export original no OneDrive foi preservado.

As notas de continuidade mantidas no repositório descrevem decisões e resultados relatados, não substituem o workflow executável:

- [Contexto consolidado e arquitetura](../../../docs/CORE_STORAGE_MEDIA_EXTERNAL_CONTEXT_2026-10-13.md)
- [Homologação inicial](../../../docs/HOMOLOGACAO_STORAGE_PROVIDER_2026-10-13.md)
- [Estado de 14/10/2026: três adapters e retomada do retry](../../../docs/EVOLUCAO_B2_E_CONTINUIDADE_2026-10-14.md)
- [Backlog](../../../docs/BACKLOG.md)

O desenho registrado usa um único workflow e ramificações internas por provider (`cloudinary`, `cloudflare_r2`, `backblaze_b2`), com reserva/finalização no banco e retorno uniforme ao fluxo editorial. O caminho de sucesso B2-02 foi relatado como homologado; retry de falhas permanece pendente de implementação e teste.

## Snapshot versionado

Códigos completos dos Code nodes estão em `nodes/`, extraídos do mesmo baseline; `nodes/index.json` informa nomes, modos e hashes. Expansão posterior R2-03/R2-04 publicada e R2-05/R2-06 pendente de confirmação integrada está no [estado atual](../../../docs/INVENTARIO_E_CONTINUIDADE_2026-10-20.md). Nenhum novo export operacional foi recebido para esses cadastros, que usam endpoint dinâmico. Retry aguarda primeira falha real conforme decisão vigente.

## Retry v1 preparado após falha real

Em 23/10/2026, B2-01 retornou uma falha sanitizada `b2_upload_failed`, HTTP 502 e status upstream 520. Esse evento satisfaz o gatilho para projetar o retry, mas não prova causa raiz nem implantação.

O candidato completo, ainda não importado/homologado, está em [`retry-v1/`](retry-v1/). Ele finaliza a reserva antes do fallback, usa cooldown para evitar o mesmo storage, preserva o binário e limita o fluxo a três tentativas totais. O export baseline desta pasta permanece inalterado até existir um novo export operacional sanitizado.

Manter aqui o snapshot público com nome estável:

```text
SUB_Storage_Media_External.json
```

Ao revisar ou importar:

1. Exportar o workflow sem dados de execução.
2. Remover valores secretos, dados pessoais desnecessários e detalhes privados de ambiente; credenciais devem ser reconfiguradas na instância de destino.
3. Remover ou anonimizar referências de credenciais específicas da instância, preservando a identificação lógica necessária para reconfiguração.
4. Remover URLs temporárias de teste, cabeçalhos de autorização e dados de execuções; conferir também parâmetros fixos de nós HTTP e SQL.
5. Validar JSON, nós/conexões e contrato de saída antes de registrar. Documentar no commit quais mudanças funcionais foram feitas.
6. Não promover o snapshot para produção só por estar versionado: a homologação e a ativação continuam controladas na instância n8n.

Nunca versionar Application Passwords do WordPress, chaves `PROXY_KEY`, credenciais de Cloudinary/B2, tokens de reserva, dados binários/imagens de execução ou dumps com credenciais.
