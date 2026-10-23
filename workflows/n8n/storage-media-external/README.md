# n8n — SUB | Storage Media External

Este diretório é o local canônico para os exports sanitizados e os artefatos de desenvolvimento do workflow multi-provider de storage externo.

## Fonte e status

A instância n8n é o runtime operacional. O arquivo [`SUB_Storage_Media_External.json`](SUB_Storage_Media_External.json) é o snapshot sanitizado da versão 0.4 publicada em 23/10/2026. O artefato foi auditado e testado localmente com `active=false`; o caminho de sucesso foi homologado no runtime, enquanto retry e e-mail aguardam a primeira falha real, sem provocação deliberada.

Na cópia pública, foram removidas referências de credenciais e metadados específicos da instância, o workflow foi desativado e os três valores literais de `X-Proxy-Key` foram substituídos por `RECONFIGURE_IN_N8N_SECRET`. Antes de executar/importar, vincule as credenciais MySQL e configure as chaves de cada proxy na instância n8n. O export bruto recebido no chat não faz parte do Git.

As notas de continuidade mantidas no repositório descrevem decisões e resultados relatados, não substituem o workflow executável:

- [Contexto consolidado e arquitetura](../../../docs/CORE_STORAGE_MEDIA_EXTERNAL_CONTEXT_2026-10-13.md)
- [Homologação inicial](../../../docs/HOMOLOGACAO_STORAGE_PROVIDER_2026-10-13.md)
- [Estado de 14/10/2026: três adapters e retomada do retry](../../../docs/EVOLUCAO_B2_E_CONTINUIDADE_2026-10-14.md)
- [Backlog](../../../docs/BACKLOG.md)

O desenho registrado usa um único workflow e ramificações internas por provider (`cloudinary`, `cloudflare_r2`, `backblaze_b2`), com reserva/finalização no banco e retorno uniforme ao fluxo editorial. O retry e o alerta por falha tratada estão publicados; sua validação operacional ocorrerá na primeira falha real.

## Snapshot versionado

Códigos completos dos nove Code nodes estão em `nodes/`, extraídos do mesmo snapshot; `nodes/index.json` informa nomes, modos e hashes. Expansão R2 e pendências de confirmação integrada estão no [estado atual](../../../docs/INVENTARIO_E_CONTINUIDADE_2026-10-20.md). Os destinos continuam dinâmicos por `endpoint_url`.

## Retry v1 preparado após falha real

Em 23/10/2026, B2-01 retornou uma falha sanitizada `b2_upload_failed`, HTTP 502 e status upstream 520. Esse evento satisfaz o gatilho para projetar o retry, mas não prova causa raiz nem implantação.

O pacote de apoio está em [`retry-v1/`](retry-v1/). A mesma lógica está publicada no n8n e incorporada ao snapshot sanitizado: finaliza a reserva antes do fallback, envia alerta sanitizado, restaura contexto/binário, usa cooldown para evitar o mesmo storage e limita o fluxo a três tentativas totais. Falta observar o comportamento numa falha real e implantar um Error Workflow global para erros não tratados.

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
