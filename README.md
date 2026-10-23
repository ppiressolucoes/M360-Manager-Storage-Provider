# M360 Manager — Storage Provider

Repositório dedicado à gestão de storage externo de mídia: contrato WordPress, workflow n8n, Workers de entrega/upload e documentação operacional.

## Componentes

- [Plugin WordPress — M360 - Core Media Storage External](plugin/wordpress/m360-core-media-storage-external/README.md)
- [Workflow n8n — Storage Media External](workflows/n8n/storage-media-external/README.md)
- [Workers](workers/README.md)
- [Pacote instalável WordPress v0.1.9](releases/wordpress/v0.1.9/)

## Documentação

- **[Plano de evolução do Core — 23/10/2026](docs/PLANO_EVOLUCAO_CORE_STORAGE_PROVIDER_2026-10-23.md)**
- **[Falha B2-01 e preparação do retry — 23/10/2026](docs/FALHA_B2_01_E_RETRY_2026-10-23.md)**
- [R2-07 — preparação e homologação, 21/10/2026](docs/R2-07_HOMOLOGACAO_2026-10-21.md)
- **[Estado atual e inventário — 20/10/2026](docs/INVENTARIO_E_CONTINUIDADE_2026-10-20.md)**
- **[Artefatos das sprints: JSON, Code nodes e SQL](docs/ARTEFATOS_DAS_SPRINTS.md)**
- [Contexto inicial e decisões de arquitetura](docs/CORE_STORAGE_MEDIA_EXTERNAL_CONTEXT_2026-10-13.md)
- [Implementação, banco de dados e homologação dos fluxos](docs/HOMOLOGACAO_STORAGE_PROVIDER_2026-10-13.md)
- [Esteira de implantação e backlog](docs/BACKLOG.md)
- [Estado atual: B2, correções n8n e retomada do retry — 14/10/2026](docs/EVOLUCAO_B2_E_CONTINUIDADE_2026-10-14.md)

## Segurança

Não versionar credenciais, application passwords, chaves de API/Worker, tokens, dados de execução do n8n ou dumps de banco com segredos. Use referências lógicas e exemplos sanitizados.

## Colaboração

Consultar backlog e estado atual antes de retomar. Atualizar decisões, evidências e artefatos sanitizados ao concluir ações e sincronizar o GitHub oficial. Regras em [AGENTS.md](AGENTS.md). SQL reconstruído não substitui export da produção; testes relatados não equivalem a auditoria independente.
