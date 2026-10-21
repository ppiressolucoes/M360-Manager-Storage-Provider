const r = $json;

const apiId = Number(r.api_id);

if (!apiId) {
  throw new Error('api_id inválido na falha de Usage Cloudinary');
}

const httpStatus = Number(
  r.http_status_usage ??
  r.body?.origin_status ??
  r.statusCode ??
  0
);

return [{
  json: {
    api_id: apiId,
    cloud_name: r.cloud_name ?? null,
    account_email: r.account_email ?? null,

    http_status: httpStatus || 0,

    erro_consulta_usage:
      r.erro_consulta_usage ??
      `FALHA_USAGE_HTTP_${httpStatus || 'DESCONHECIDO'}`
  }
}];
