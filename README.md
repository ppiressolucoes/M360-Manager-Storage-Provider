# M360 Manager — Storage Provider

Repositório dedicado à gestão de storage externo de mídia: contrato WordPress, workflow n8n, Workers de entrega/upload e documentação operacional.

## Componentes

- [Plugin WordPress — M360 - Core Media Storage External](plugin/wordpress/m360-core-media-storage-external/README.md)
- [Workflow n8n — Storage Media External](workflows/n8n/storage-media-external/README.md)
- [Workers](workers/README.md)
- [Pacote instalável WordPress v0.1.9](releases/wordpress/v0.1.9/)

## Documentação

- [Contexto inicial e decisões de arquitetura](docs/CORE_STORAGE_MEDIA_EXTERNAL_CONTEXT_2026-10-13.md)
- [Implementação, banco de dados e homologação dos fluxos](docs/HOMOLOGACAO_STORAGE_PROVIDER_2026-10-13.md)
- [Esteira de implantação e backlog](docs/BACKLOG.md)
- [Estado atual: B2, correções n8n e retomada do retry — 14/10/2026](docs/EVOLUCAO_B2_E_CONTINUIDADE_2026-10-14.md)

## Segurança

Não versionar credenciais, application passwords, chaves de API/Worker, tokens, dados de execução do n8n ou dumps de banco com segredos. Use referências lógicas e exemplos sanitizados.
