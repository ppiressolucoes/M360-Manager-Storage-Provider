
const item = $input.first();
const origem = $('Start Storage').first();

// A SP retorna os dados como array dentro do JSON.
const dados = item.json;
const reserva = Array.isArray(dados)
  ? dados[0]
  : Array.isArray(dados?.[0])
    ? dados[0][0]
    : dados;

if (!reserva || typeof reserva !== 'object') {
  throw new Error(
    'Não foi possível localizar o objeto da reserva na saída da SP.'
  );
}

const reservaOk =
  reserva.reserva_ok === 1 ||
  reserva.reserva_ok === '1' ||
  reserva.reserva_ok === true;

if (!reservaOk) {
  throw new Error(
    `Reserva não autorizada: ${reserva.motivo || 'motivo não informado'}`
  );
}

if (!origem.binary?.data) {
  throw new Error(
    'Arquivo binário original não encontrado em Start Storage.'
  );
}

return [
  {
    json: {
      ...reserva,
      'ind-api-folder': origem.json['ind-api-folder'],
      storage_folder: origem.json['ind-api-folder'],
    },
    binary: origem.binary,
  },
];
