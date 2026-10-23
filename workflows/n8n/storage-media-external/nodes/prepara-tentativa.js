const item = $input.first();
const entrada = item.json ?? {};

if (!item.binary?.data) {
  throw new Error('Binário original ausente ao preparar tentativa.');
}

const anterior = entrada.retry_context ?? {};
const tentativaAnterior = Number(anterior.tentativa ?? 0);
const maxTentativas = 3;

if (!Number.isInteger(tentativaAnterior) || tentativaAnterior < 0) {
  throw new Error('Contador de tentativas inválido.');
}

const tentativa = tentativaAnterior + 1;
if (tentativa > maxTentativas) {
  throw new Error('Limite de três tentativas excedido.');
}

const storageIdsTentados = [...new Set(
  (Array.isArray(anterior.storage_ids_tentados)
    ? anterior.storage_ids_tentados
    : [])
    .map(Number)
    .filter(Number.isInteger)
)];

// Remove dados da reserva anterior; a próxima SP deve fornecer um contexto novo.
const {
  storage_id,
  provider,
  storage_driver,
  storage_alias,
  account_email,
  endpoint_url,
  public_base_url,
  bucket_name,
  region_name,
  credential_ref,
  prioridade,
  ind_ativo,
  dsc_status,
  dth_acesso,
  dth_bloqueio_ate,
  reservation_token,
  dth_reserva_ate,
  num_count,
  credential_id,
  dsc_api_key,
  dsc_api_secret,
  AUTHORIZATION,
  cloudinary_cloud,
  cloudinary_public_id,
  error,
  failure_code,
  failure_class,
  failure_http_status,
  failure_upstream_status,
  failure_status,
  bloqueio_minutos,
  pode_tentar_novamente,
  ...base
} = entrada;

return [{
  json: {
    ...base,
    retry_context: {
      tentativa,
      max_tentativas: maxTentativas,
      storage_ids_tentados: storageIdsTentados,
      ultima_falha: anterior.ultima_falha ?? null,
    },
  },
  binary: item.binary,
}];
