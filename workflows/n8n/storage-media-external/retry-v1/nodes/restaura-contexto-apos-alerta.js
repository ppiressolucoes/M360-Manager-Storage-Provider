const contexto =
  $('Valida Finalização Falha').item;

if (!contexto?.json) {
  throw new Error(
    'Contexto da falha indisponível após o alerta.'
  );
}

if (!contexto.binary?.data) {
  throw new Error(
    'Binário indisponível após o alerta de falha.'
  );
}

return [{
  json: contexto.json,
  binary: contexto.binary,
}];
