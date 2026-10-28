const item = $input.first();
const entrada = item.json ?? {};
const anterior = entrada.wp_retry_context ?? {};
const tentativaAnterior = Number(anterior.tentativa ?? 0);
const maxTentativas = 3;

if (
  !Number.isInteger(tentativaAnterior) ||
  tentativaAnterior < 0
) {
  throw new Error(
    'Contador de tentativas do registro WP inválido.'
  );
}

const tentativa = tentativaAnterior + 1;

if (tentativa > maxTentativas) {
  throw new Error(
    'Limite de três tentativas do registro WP excedido.'
  );
}

// Remove somente dados transitórios da falha anterior.
// O contrato de mídia retornado pelo Manager Storage Provider é preservado.
const {
  error,
  wp_failure_code,
  wp_failure_class,
  wp_failure_http_status,
  wp_failure_retryable,
  wp_retry_after_seconds,
  pode_repetir_registro_wp,
  ...contexto
} = entrada;

const saida = {
  json: {
    ...contexto,
    wp_retry_context: {
      tentativa,
      max_tentativas: maxTentativas,
      ultima_falha: anterior.ultima_falha ?? null,
    },
  },
};

if (item.binary) {
  saida.binary = item.binary;
}

return [saida];
