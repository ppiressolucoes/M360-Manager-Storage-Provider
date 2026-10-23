const item = $input.first();
const contexto = $('Prepara Tentativa').item;
const dados = item.json;

const reserva = Array.isArray(dados)
  ? Array.isArray(dados[0])
    ? dados[0][0]
    : dados[0]
  : dados;

if (!reserva || typeof reserva !== 'object') {
  throw new Error(
    'Não foi possível localizar o objeto da reserva na saída da SP.'
  );
}

if (!contexto.binary?.data) {
  throw new Error(
    'Binário original não encontrado em Prepara Tentativa.'
  );
}

const reservaOk =
  reserva.reserva_ok === 1 ||
  reserva.reserva_ok === '1' ||
  reserva.reserva_ok === true;

return [{
  json: {
    ...contexto.json,
    ...reserva,
    reserva_ok: reservaOk ? 1 : 0,
    storage_folder:
      contexto.json.storage_folder ??
      contexto.json['ind-api-folder'],
  },
  binary: contexto.binary,
}];
