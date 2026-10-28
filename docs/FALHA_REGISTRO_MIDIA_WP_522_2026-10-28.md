# Falha 522 no registro de mídia virtual WordPress — 28/10/2026

## Evidência sanitizada

O node `Registrar Provider Mídia Virtual WP`, executado depois do retorno bem-sucedido do Manager Storage Provider, recebeu HTTP 522 do Worker `n8n-m360-proxy` ao chamar o endpoint `POST /m360/v1/external-featured-media` do portal M360. A resposta estruturada informou `origin_error`, `connection_timeout`, `retryable=true` e `retry_after=120` segundos. Hash, nome do arquivo, URL do objeto e credenciais não são registrados neste documento.

O erro ocorreu em 28/10/2026 às 11:02:38, horário de Brasília. A Cloudflare recebeu a requisição, mas não conseguiu concluir o handshake TCP com o servidor de origem. As causas compatíveis são indisponibilidade ou sobrecarga da origem, firewall recusando os endereços da Cloudflare ou falha de rede entre Cloudflare e hosting. A ocorrência não indica rejeição dos dados pelo plugin WordPress e não invalida o upload já concluído no storage externo.

## Recuperação segura

1. Aguardar pelo menos 120 segundos, conforme o retorno do proxy.
2. Reexecutar somente `Registrar Provider Mídia Virtual WP` e os nodes posteriores.
3. Não voltar ao Manager Storage Provider, não criar nova reserva e não repetir a finalização do storage.
4. Se a chamada retornar sucesso, continuar com o `attachment_id` recebido.
5. Se o 522 persistir, interromper o fluxo com erro explícito e verificar disponibilidade do portal, carga do servidor, portas 80/443, firewall e allowlist das faixas IP da Cloudflare.

O endpoint de registro é idempotente por SHA-256: antes de inserir, o plugin procura attachment com o mesmo hash e retorna o registro existente. Portanto, a repetição é segura mesmo no cenário em que a primeira chamada tenha alcançado o WordPress e apenas a resposta tenha sido perdida.

## Evolução recomendada do workflow

O retry de registro WordPress deve ser independente do retry de storage:

```text
Registrar Provider Mídia Virtual WP
  ├─ sucesso → continuar publicação
  └─ erro → Classifica Falha Registro WP
       ├─ 522/520/521/523/524 e tentativa disponível
       │    → Wait conforme retry_after, mínimo 120 s
       │    → Registrar Provider Mídia Virtual WP
       └─ erro definitivo ou limite atingido
            → alerta sanitizado → Stop and Error
```

Usar no máximo três tentativas totais. Respostas 400, 401, 403 e 404 devem ser tratadas como entrada, autenticação, autorização ou configuração e não repetidas automaticamente. Outros 5xx podem ser classificados como transitórios somente quando não houver indicação contrária. O contexto de mídia deve ser preservado; não transportar credenciais nos nodes de classificação ou alerta.

Esta topologia ainda é recomendação, não implantação confirmada. Para implementá-la com segurança, recuperar primeiro o export sanitizado do workflow que contém `Registrar Provider Mídia Virtual WP`.

## Auditoria visual do desenho v0.3

O desenho apresentado em 28/10/2026 ligou a saída de erro de `Registrar Provider Mídia Virtual WP` a `Wait 120s` e retornou diretamente ao mesmo HTTP Request. O acerto principal é não retornar a `CALL | Manager Storage Provider`: upload, reserva e finalização do storage não são repetidos.

O laço ainda não deve ser considerado concluído ou pronto para publicação. A saída de erro precisa passar antes por classificação e limite de tentativas. Sem esses gates, erros definitivos como 400, 401 e 403 também aguardam e repetem indefinidamente. Além disso, deve ser confirmado se a saída de erro do HTTP Request conserva o contrato de mídia; se ela produzir somente o objeto de erro, o retorno direto ao node perderá os campos usados no body.

Topologia mínima para fechar a revisão:

```text
Prepara Tentativa Registro WP
  → Registrar Provider Mídia Virtual WP
      ├─ sucesso → fluxo existente
      └─ erro → Classifica Falha Registro WP
                   → IF | Pode repetir registro?
                       ├─ true → Wait 120s → Restaura Contexto Registro WP
                       │          → Prepara Tentativa Registro WP
                       └─ false → Alerta sanitizado → Stop and Error
```

`Prepara Tentativa` deve limitar a três tentativas totais. `Classifica Falha` deve manter separadamente o contexto original e os dados sanitizados da falha. `Restaura Contexto` deve devolver o contrato original ao HTTP Request. A revisão visual não comprova esses três requisitos nem a publicação do workflow.

O node `Prepara Tentativa Registro WP` foi criado no editor em 28/10/2026. Seu código candidato, com limite de três tentativas e preservação do contrato, foi versionado em `workflows/n8n/web-extrator-detalhes-m360-v0.3/`. Aplicação e execução no n8n ainda aguardam confirmação.
