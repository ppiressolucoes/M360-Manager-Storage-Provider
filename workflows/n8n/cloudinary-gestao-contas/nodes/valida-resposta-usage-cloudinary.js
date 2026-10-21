const itens = $input.all();

return itens.map(item => {
  const r = item.json;

  const body =
    r.body && typeof r.body === 'object'
      ? r.body
      : {};

  // Compatível com chamada direta e futura chamada via Worker
  const httpStatus = Number(
    body.origin_status ??
    r.statusCode ??
    0
  );

  const credits = body.credits;

  const apiId = Number(r.api_id);
  const cloudName = r.cloud_name ?? null;

  // --------------------------------------------------
  // Valida estrutura mínima necessária
  // --------------------------------------------------

  const temCredits =
    credits &&
    typeof credits === 'object';

  const temUsage =
    temCredits &&
    Number.isFinite(Number(credits.usage));

  const temLimit =
    temCredits &&
    Number.isFinite(Number(credits.limit));

  const temPercent =
    temCredits &&
    Number.isFinite(Number(credits.used_percent));

  const httpOk =
    httpStatus === 200;

  const usageValido =
    httpOk &&
    temUsage &&
    temLimit &&
    temPercent;

  // --------------------------------------------------
  // Motivo da falha, se houver
  // --------------------------------------------------

  let motivoErro = null;

  if (!httpOk) {
    motivoErro =
      `HTTP_${httpStatus || 'DESCONHECIDO'}`;
  } else if (!temCredits) {
    motivoErro =
      'CREDITS_NAO_ENCONTRADO';
  } else if (!temUsage) {
    motivoErro =
      'CREDIT_USAGE_INVALIDO';
  } else if (!temLimit) {
    motivoErro =
      'CREDIT_LIMIT_INVALIDO';
  } else if (!temPercent) {
    motivoErro =
      'CREDIT_PERCENT_INVALIDO';
  }

  return {
    json: {
      ...r,

      api_id: apiId,
      cloud_name: cloudName,

      http_status_usage:
        httpStatus,

      usage_valido:
        usageValido,

      erro_consulta_usage:
        motivoErro
    }
  };
});
