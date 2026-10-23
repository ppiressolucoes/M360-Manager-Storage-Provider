const dados = $input.first().json;

const resultado = Array.isArray(dados)
  ? Array.isArray(dados[0])
    ? dados[0][0]
    : dados[0]
  : dados;

if (Number(resultado?.finalizacao_ok) !== 1) {
  throw new Error(
    `Finalização não confirmada: ${
      resultado?.motivo || 'retorno inválido da SP'
    }`
  );
}

const contexto = $('Classifica Falha Upload').item;

if (Number(resultado.storage_id) !== Number(contexto.json.storage_id)) {
  throw new Error('Finalização não corresponde ao storage da tentativa.');
}

const {
  reservation_token,
  dsc_api_key,
  dsc_api_secret,
  AUTHORIZATION,
  ...seguro
} = contexto.json;

return [{
  json: {
    ...seguro,
    finalizacao_falha_ok: true,
    finalizacao_falha_motivo: resultado.motivo,
  },
  binary: contexto.binary,
}];
