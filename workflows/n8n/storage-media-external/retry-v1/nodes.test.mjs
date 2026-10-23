import assert from 'node:assert/strict';
import fs from 'node:fs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const binary = { data: { id: 'mock-binary' } };

async function run(file, inputItems, nodeItems = {}) {
  const source = fs.readFileSync(
    new URL(`./nodes/${file}`, import.meta.url),
    'utf8',
  );
  const execute = new AsyncFunction('$input', '$', source);
  const $input = { first: () => inputItems[0] };
  const $ = name => ({ item: nodeItems[name] });
  return execute($input, $);
}

const prepared = await run('prepara-tentativa.js', [{
  json: { 'ind-api-folder': 'pel/featured' },
  binary,
}]);
assert.equal(prepared[0].json.retry_context.tentativa, 1);
assert.equal(prepared[0].json.retry_context.max_tentativas, 3);

const normalized = await run(
  'normaliza-reserva-retry.js',
  [{ json: [[{ reserva_ok: 1, storage_id: 12, provider: 'backblaze_b2' }]] }],
  { 'Prepara Tentativa': prepared[0] },
);
assert.equal(normalized[0].json.reserva_ok, 1);
assert.equal(normalized[0].json.storage_folder, 'pel/featured');
assert.equal(normalized[0].json.retry_context.tentativa, 1);

const failed = await run('classifica-falha-upload.js', [{
  json: {
    ...normalized[0].json,
    reservation_token: 'token-apenas-de-teste',
    error: {
      message: '502 - "{\\"error\\":\\"b2_upload_failed\\",\\"upstream_status\\":520}"',
      code: 'ERR_BAD_RESPONSE',
      status: 502,
    },
  },
  binary,
}]);
assert.equal(failed[0].json.failure_code, 'b2_upload_failed');
assert.equal(failed[0].json.failure_class, 'escrita_ambigua');
assert.equal(failed[0].json.failure_upstream_status, 520);
assert.equal(failed[0].json.bloqueio_minutos, 5);
assert.equal(failed[0].json.pode_tentar_novamente, true);
assert.deepEqual(failed[0].json.retry_context.storage_ids_tentados, [12]);
assert.equal('error' in failed[0].json, false);

const forbiddenLookup = await run('classifica-falha-upload.js', [{
  json: {
    ...normalized[0].json,
    error: {
      message: '502 - "{\\"error\\":\\"b2_lookup_failed\\",\\"upstream_status\\":403}"',
      code: 'ERR_BAD_RESPONSE',
      status: 502,
    },
  },
  binary,
}]);
assert.equal(forbiddenLookup[0].json.failure_code, 'b2_lookup_failed');
assert.equal(forbiddenLookup[0].json.failure_class, 'configuracao_storage');
assert.equal(forbiddenLookup[0].json.failure_http_status, 502);
assert.equal(forbiddenLookup[0].json.failure_upstream_status, 403);
assert.equal(forbiddenLookup[0].json.bloqueio_minutos, 60);
assert.equal(forbiddenLookup[0].json.pode_tentar_novamente, true);

const missingR2PublicBase = await run('classifica-falha-upload.js', [{
  json: {
    ...normalized[0].json,
    provider: 'cloudflare_r2',
    storage_id: 11,
    error: {
      message: '500 - "{\\"success\\":false,\\"provider\\":\\"cloudflare_r2\\",\\"error\\":\\"public_base_url_not_configured\\"}"',
      code: 'ERR_BAD_RESPONSE',
      status: 500,
    },
  },
  binary,
}]);
assert.equal(missingR2PublicBase[0].json.failure_code, 'public_base_url_not_configured');
assert.equal(missingR2PublicBase[0].json.failure_class, 'configuracao_storage');
assert.equal(missingR2PublicBase[0].json.failure_http_status, 500);
assert.equal(missingR2PublicBase[0].json.bloqueio_minutos, 60);
assert.equal(missingR2PublicBase[0].json.pode_tentar_novamente, true);

const finalized = await run(
  'valida-finalizacao-falha-retry.js',
  [{ json: [[{ finalizacao_ok: 1, motivo: 'storage_bloqueado', storage_id: 12 }]] }],
  { 'Classifica Falha Upload': failed[0] },
);
assert.equal(finalized[0].json.finalizacao_falha_ok, true);
assert.equal('reservation_token' in finalized[0].json, false);
assert.equal(finalized[0].binary, binary);

const alertPrepared = await run('prepara-alerta-falha.js', [{
  json: {
    ...finalized[0].json,
    reservation_token: 'nao-pode-vazar',
    original_filename: 'nao-pode-vazar.jpg',
    secure_url: 'https://nao-pode-vazar.example/media.jpg',
  },
  binary,
}]);
assert.match(alertPrepared[0].json.alert_subject, /Falha de upload/);
assert.equal(alertPrepared[0].json.pode_tentar_novamente, true);
assert.equal('reservation_token' in alertPrepared[0].json, false);
assert.equal('original_filename' in alertPrepared[0].json, false);
assert.equal('secure_url' in alertPrepared[0].json, false);
assert.equal('binary' in alertPrepared[0], false);

const restoredAfterAlert = await run(
  'restaura-contexto-apos-alerta.js',
  [{ json: { gmail_message_id: 'mock-message' } }],
  { 'Valida Finalização Falha': finalized[0] },
);
assert.deepEqual(restoredAfterAlert[0].json, finalized[0].json);
assert.equal(restoredAfterAlert[0].binary, binary);

const secondAttempt = await run('prepara-tentativa.js', finalized);
assert.equal(secondAttempt[0].json.retry_context.tentativa, 2);
assert.deepEqual(secondAttempt[0].json.retry_context.storage_ids_tentados, [12]);

const thirdAttemptFailure = await run('classifica-falha-upload.js', [{
  json: {
    ...normalized[0].json,
    retry_context: { tentativa: 3, max_tentativas: 3, storage_ids_tentados: [12, 13] },
    storage_id: 14,
    error: { message: '503 - "{\\"error\\":\\"b2_lookup_failed\\"}"', status: 503 },
  },
  binary,
}]);
assert.equal(thirdAttemptFailure[0].json.pode_tentar_novamente, false);
assert.deepEqual(thirdAttemptFailure[0].json.retry_context.storage_ids_tentados, [12, 13, 14]);

const invalidInputFailure = await run('classifica-falha-upload.js', [{
  json: {
    ...normalized[0].json,
    error: { message: '400 - "{\\"error\\":\\"sha256_mismatch\\"}"', status: 400 },
  },
  binary,
}]);
assert.equal(invalidInputFailure[0].json.failure_class, 'entrada_invalida');
assert.equal(invalidInputFailure[0].json.pode_tentar_novamente, false);
assert.equal(invalidInputFailure[0].json.bloqueio_minutos, 0);

console.log('Retry n8n: preparação, classificação, alerta e finalização validados.');
