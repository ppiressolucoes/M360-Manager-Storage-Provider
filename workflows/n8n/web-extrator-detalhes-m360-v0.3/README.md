# SUB | WEB Extrator Detalhes M360 v0.3 — retry do registro WP

Artefatos candidatos para tratar falhas transitórias de `Registrar Provider Mídia Virtual WP` sem repetir o Manager Storage Provider.

## Primeiro node

Criar `Prepara Tentativa Registro WP` em modo **Run Once for All Items**, entre `CALL | Manager Storage Provider` e `Registrar Provider Mídia Virtual WP`, usando integralmente `nodes/prepara-tentativa-registro-wp.js`.

O node inicia `wp_retry_context.tentativa=1`, limita o registro a três tentativas totais, preserva o contrato de mídia e remove campos transitórios antes de uma nova chamada. A saída de erro do HTTP Request ainda não deve retornar diretamente a `Wait 120s`; classificação, IF e restauração de contexto serão acrescentados nos próximos gates.

O workflow completo e sua publicação não estão versionados nem confirmados. Recuperar um export sanitizado ao final da montagem para auditoria de conexões, configurações e ausência de dados sensíveis.
