const entrada = $input.first().json ?? {};
const retry = entrada.retry_context ?? {};

const limpar = (valor, limite = 120) =>
  String(valor ?? 'não informado')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite);

const tentativa = Number(retry.tentativa ?? 1);
const maxTentativas = Number(retry.max_tentativas ?? 3);

const provider = limpar(entrada.provider, 80);
const storageAlias = limpar(entrada.storage_alias, 80);

const storageId = Number.isInteger(Number(entrada.storage_id))
  ? Number(entrada.storage_id)
  : null;

const failureCode = limpar(
  entrada.failure_code ?? 'upload_error_unknown',
  80
);

const failureClass = limpar(
  entrada.failure_class ?? 'falha_desconhecida',
  80
);

const httpStatus = Number(
  entrada.failure_http_status ?? 0
) || null;

const upstreamStatus = Number(
  entrada.failure_upstream_status ?? 0
) || null;

const bloqueioMinutos = Number(
  entrada.bloqueio_minutos ?? 0
);

const podeTentarNovamente =
  entrada.pode_tentar_novamente === true;

const status = limpar(
  entrada.failure_status ??
  'Falha de upload sem detalhe',
  255
);

const alertSubject =
  `[Core360][HML] Falha de upload - tentativa ` +
  `${tentativa}/${maxTentativas}`;

const alertText = [
  'Falha detectada no fluxo de storage externo.',
  'A reserva correspondente foi finalizada antes deste alerta.',
  '',
  `Data UTC: ${new Date().toISOString()}`,
  `Provider: ${provider}`,
  `Storage ID: ${storageId ?? 'não informado'}`,
  `Storage alias: ${storageAlias}`,
  `Classe: ${failureClass}`,
  `Código: ${failureCode}`,
  `HTTP: ${httpStatus ?? 'não informado'}`,
  `Upstream: ${upstreamStatus ?? 'não informado'}`,
  `Tentativa: ${tentativa}/${maxTentativas}`,
  `Nova tentativa prevista: ${
    podeTentarNovamente ? 'sim' : 'não'
  }`,
  `Cooldown: ${bloqueioMinutos} minuto(s)`,
  `Status: ${status}`,
  '',
  'Ação: consultar a execução correspondente no n8n.',
].join('\n');

return [{
  json: {
    alert_subject: alertSubject,
    alert_text: alertText,
    provider,
    storage_id: storageId,
    storage_alias: storageAlias,
    failure_class: failureClass,
    failure_code: failureCode,
    failure_http_status: httpStatus,
    failure_upstream_status: upstreamStatus,
    tentativa,
    max_tentativas: maxTentativas,
    pode_tentar_novamente: podeTentarNovamente,
    bloqueio_minutos: bloqueioMinutos,
  },
}];
