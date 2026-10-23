# R2-02 — falha de configuração da URL pública

Atualizado em 23/10/2026, Brasília. Fonte: saída de execução fornecida pelo usuário; sem acesso direto do agente ao runtime n8n, Cloudflare ou banco.

## Evidência sanitizada

- storage: R2-02, ID 11;
- provider: `cloudflare_r2`;
- etapa: `Upload S3R2 - Proxy`;
- resposta HTTP do Worker: 500;
- código estruturado: `public_base_url_not_configured`;
- tentativa observada: 1/3.

Token de reserva, e-mail, hash, nome, URL do arquivo e stack não foram reproduzidos no repositório.

## Diagnóstico

O cadastro do Core contém `public_base_url`, mas esse campo não é injetado automaticamente no runtime Cloudflare. O Worker R2 exige sua própria variável `PUBLIC_BASE_URL`. A resposta comprova que o node alcançou o proxy e que o proxy identificou ausência da configuração; não indica falha do binário, do Switch ou da SP.

Sem o código-fonte completo do Worker R2 versionado, não é possível afirmar se o PUT ocorreu antes ou depois da validação da URL pública. Portanto, a falha deve ser tratada como configuração do storage, e a mesma chave content-addressed deve ser reexecutada após a correção para reconciliar o estado.

## Correção operacional

1. No ambiente de produção do Worker R2-02, criar ou corrigir a variável não secreta `PUBLIC_BASE_URL` com a origem pública R2 já registrada no inventário, sem barra final, caminho, query ou fragmento.
2. Não alterar `MEDIA_BUCKET`, `PROXY_KEY`, endpoint do cadastro ou URL de outro storage.
3. Implantar o Worker e confirmar que a nova revisão está ativa.
4. Reexecutar somente o node de upload com o mesmo item/binário; `existing=false` indica novo PUT e `existing=true` indica que a escrita anterior já havia ocorrido.
5. Validar a URL pública retornada e, depois, executar um fluxo normal com reserva/finalização válidas.

O health atual do Worker R2 informa proxy, versão, provider e binding, mas não comprova `PUBLIC_BASE_URL`. Uma futura revisão do código R2 deve incluir esse indicador sem expor o valor da variável.

## Ajuste do retry

O classificador candidato passou a reconhecer `public_base_url_not_configured` como `configuracao_storage`, com cooldown de 60 minutos e fallback permitido para outro storage. A v0.4 publicada ainda não contém essa regra; ela deve integrar a futura v0.5 junto com a precedência dos status upstream 401/403/404.
