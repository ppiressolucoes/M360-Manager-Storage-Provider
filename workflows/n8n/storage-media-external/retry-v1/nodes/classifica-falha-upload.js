const item = $input.first();
const entrada = item.json ?? {};
const erro = entrada.error ?? {};

function parseJsonRecursivo(value) {
  let atual = value;

  for (let i = 0; i < 3; i++) {
    if (atual && typeof atual === 'object') return atual;
    if (typeof atual !== 'string') return null;

    const texto = atual.trim();

    try {
      atual = JSON.parse(texto);
      continue;
    } catch {}

    const aposStatus = texto.replace(/^\s*\d{3}\s*-\s*/, '');

    if (aposStatus !== texto) {
      try {
        atual = JSON.parse(aposStatus);
        continue;
      } catch {}
    }

    return null;
  }

  return atual && typeof atual === 'object' ? atual : null;
}

const corpo =
  parseJsonRecursivo(erro.response?.body) ??
  parseJsonRecursivo(erro.response?.data) ??
  parseJsonRecursivo(erro.message) ??
  {};

const statusPelaMensagem = String(erro.message ?? '').match(/^\s*(\d{3})\b/);

const httpStatus = Number(
  erro.status ??
  erro.response?.status ??
  statusPelaMensagem?.[1] ??
  0
);

const upstreamStatus = Number(corpo.upstream_status ?? 0);

const failureCode = String(
  corpo.error ??
  erro.code ??
  'upload_error_unknown'
).slice(0, 80);

const inputErrors = new Set([
  'invalid_media_metadata',
  'file_too_large',
  'empty_file',
  'invalid_image_signature',
  'sha256_mismatch',
  'existing_object_size_mismatch',
]);

const storageConfigurationErrors = new Set([
  'unauthorized',
  'missing_configuration',
  'public_base_url_not_configured',
  'route_not_found',
  'invalid_endpoint',
  'invalid_public_base',
]);

const ambiguousCodes = new Set([
  'b2_upload_failed',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNABORTED',
  'EPIPE',
]);

let failureClass = 'desconhecida';
let retryable = false;
let bloqueioMinutos = 0;

if (inputErrors.has(failureCode) || httpStatus === 413) {
  failureClass = 'entrada_invalida';
} else if (
  storageConfigurationErrors.has(failureCode) ||
  [401, 403, 404].includes(httpStatus) ||
  [401, 403, 404].includes(upstreamStatus)
) {
  failureClass = 'configuracao_storage';
  retryable = true;
  bloqueioMinutos = 60;
} else if (ambiguousCodes.has(failureCode)) {
  failureClass = 'escrita_ambigua';
  retryable = true;
  bloqueioMinutos = 5;
} else if (
  [408, 425, 429].includes(httpStatus) ||
  httpStatus >= 500 ||
  upstreamStatus >= 500 ||
  corpo.retryable === true
) {
  failureClass = 'falha_transitoria';
  retryable = true;
  bloqueioMinutos = 5;
}

const retryContext = entrada.retry_context ?? {};
const tentativa = Number(retryContext.tentativa ?? 1);
const maxTentativas = Number(retryContext.max_tentativas ?? 3);
const storageId = Number(entrada.storage_id);

const storageIdsTentados = [...new Set([
  ...(Array.isArray(retryContext.storage_ids_tentados)
    ? retryContext.storage_ids_tentados
    : []),
  storageId,
].map(Number).filter(Number.isInteger))];

const podeTentarNovamente =
  retryable &&
  Number.isInteger(tentativa) &&
  tentativa < maxTentativas;

const resumo = [
  failureCode,
  httpStatus ? `http=${httpStatus}` : null,
  upstreamStatus ? `upstream=${upstreamStatus}` : null,
  `tentativa=${tentativa}/${maxTentativas}`,
].filter(Boolean).join('; ');

const origem = item.binary?.data
  ? item
  : $('SHA-256 + Metadados').item;

if (!origem.binary?.data) {
  throw new Error('Binário original indisponível para o fallback.');
}

const {
  error,
  account_email,
  credential_ref,
  dsc_api_key,
  dsc_api_secret,
  AUTHORIZATION,
  ...seguro
} = {
  ...origem.json,
  ...entrada,
};

return [{
  json: {
    ...seguro,
    failure_code: failureCode,
    failure_class: failureClass,
    failure_http_status: httpStatus || null,
    failure_upstream_status: upstreamStatus || null,
    failure_status: `Falha upload: ${resumo}`.slice(0, 255),
    bloqueio_minutos: bloqueioMinutos,
    pode_tentar_novamente: podeTentarNovamente,
    retry_context: {
      tentativa,
      max_tentativas: maxTentativas,
      storage_ids_tentados: storageIdsTentados,
      ultima_falha: {
        code: failureCode,
        class: failureClass,
        http_status: httpStatus || null,
        upstream_status: upstreamStatus || null,
      },
    },
  },
  binary: origem.binary,
}];
