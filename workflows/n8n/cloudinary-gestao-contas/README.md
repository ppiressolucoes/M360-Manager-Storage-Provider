# CORE | Cloudinary Gestão de Contas

Export do anexo de 14/10/2026, sanitizado para colaboração. Referências de credenciais, metadados de instância e dados fixados removidos; autorização literal substituída por RECONFIGURE_IN_N8N_SECRET; workflow inativo.

Reconfigurar MySQL e secret de proxy na instância de destino. Não importado/executado pelo agente após sanitização. A consulta SQL legada é preservada como artefato, não recomendação de interpolação; parametrização e fuso devem ser revisados antes de nova implantação.

Agendamento quatro vezes ao dia; coleta/validação/classificação/persistência Cloudinary. Não contém envio de alertas nem prova de bloqueio automático no Core. Extensão R2/B2 está no backlog, não implementada.

Pasta nodes contém código completo extraído do JSON. index.json associa nomes, modo e SHA-256. Nunca colocar secrets literais no código.
