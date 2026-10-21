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

return [{
  json: resultado,
}];
