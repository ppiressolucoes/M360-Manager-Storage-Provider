# Artefatos das sprints

## Catálogo

| Componente | Artefato | Origem / limite |
| --- | --- | --- |
| Storage n8n | workflows/n8n/storage-media-external/SUB_Storage_Media_External.json | Baseline sanitizado já versionado, não novo export do runtime |
| Code nodes storage | workflows/n8n/storage-media-external/nodes/ | Extração fiel do baseline; index.json informa modo e hash |
| Gestão Cloudinary | workflows/n8n/cloudinary-gestao-contas/CORE_Cloudinary_Gestao_de_Contas.json | Anexo 14/10 sanitizado; não reimportado/testado |
| Code nodes gestão | workflows/n8n/cloudinary-gestao-contas/nodes/ | Extração fiel do export sanitizado |
| Procedures MySQL | database/mysql/procedures/ | Reconstrução da versão completa fornecida no chat UTC−3; não dump da produção |
| Worker B2 | workers/flow-b2-storage-proxy-hml.mjs | Fonte atual inclui reconciliação candidata ainda não implantada; versão anterior teve implantação/testes reais relatados pelo usuário |
| Retry n8n v1 | workflows/n8n/storage-media-external/retry-v1/ | Candidato preparado após falha real de 23/10; não importado/homologado |
| Plugin WordPress | plugin/wordpress/m360-core-media-storage-external/ | Baseline existente e release 0.1.9, preservados |

## Registro de entregas

- 13–14/10: arquitetura, reserva/finalização, Cloudinary/R2-01 e expansão B2. B2-02 publicado; detalhes nos registros históricos.
- 15–20/10: R2-03/R2-04 publicados; R2-05/R2-06 testes isolados e cadastro. Monitoramento solicitado, sem implantação. Atualização de continuidade em 20/10 reúne os artefatos disponíveis; datas dos arquivos não provam execução.
- 21/10: R2-07 com testes isolados, cadastro inativo confirmado e ativação preparada; publicação integrada permanece pendente.
- 23/10: R2-08 incluído após health do Worker; documentação e SQL preparados; cadastro confirmado pelo usuário como ID 19 inativo, sem ativação.
- 23/10: backlog recuperado e plano de evolução consolidado em `docs/PLANO_EVOLUCAO_CORE_STORAGE_PROVIDER_2026-10-23.md`. A rodada foi documental: nenhuma ativação, importação n8n, procedure ou chamada a runtime operacional foi executada.
- 23/10: primeira falha real sanitizada do B2-01 analisada; reconciliação do Worker e pacote retry v1 preparados e testados localmente. O usuário implantou os dois Workers B2, validou seus health checks e montou o retry no rascunho n8n; o agente não alterou diretamente esses runtimes. Snapshot v0.2 sanitizado e auditado localmente, ainda sem publicação/homologação funcional.

## Regras

Guardar exports sem pinData/credenciais/IDs privados, workflow inativo e placeholders de autenticação. Reconfigurar credenciais antes de testar. Nunca enviar anexos brutos ao Git. Nodes separados devem corresponder ao JSON da mesma versão; index.json permite conferir igualdade/hash.

SQL reconstruído é referência recuperada do chat. Omitido DEFINER fixo para evitar portar a identidade de um ambiente; revisão de permissões pelo administrador é necessária. Arquivos contêm DROP/CREATE e não devem ser aplicados como atualização automática. Não incluem DDL completo das tabelas nem migração das datas históricas. Não foram executados no MySQL nesta entrega.

Ao encerrar cada sprint: registrar fonte, validações reais, pendências e versão; atualizar backlog e publicar Git. Exports novos substituem baseline somente com revisão e sanitização. Históricos permanecem como evidência, não como estado atual.

## Verificações desta consolidação

JSONs lidos com sucesso; dez Code nodes conferidos contra os respectivos exports e hashes; sintaxe JavaScript validada em contexto de função assíncrona; export Cloudinary sem referências de credenciais/pinData e sem autenticação literal original. Links relativos dos documentos atualizados e git diff --check passaram. Não foram executadas importações n8n nem procedures MySQL. Varredura global identificou link preexistente quebrado para releases/v0.1.7/INSTALLATION.md no README do plugin; não foi alterado nesta consolidação.
