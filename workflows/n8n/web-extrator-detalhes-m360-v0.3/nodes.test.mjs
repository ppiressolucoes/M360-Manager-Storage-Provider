import assert from 'node:assert/strict';
import fs from 'node:fs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function run(input) {
  const source = fs.readFileSync(
    new URL('./nodes/prepara-tentativa-registro-wp.js', import.meta.url),
    'utf8',
  );
  const execute = new AsyncFunction('$input', source);
  return execute({ first: () => input });
}

const binary = { data: { id: 'mock-binary' } };
const first = await run({
  json: {
    provider: 'cloudflare_r2',
    sha256: 'a'.repeat(64),
    secure_url: 'https://media.example/image.jpg',
  },
  binary,
});

assert.equal(first[0].json.wp_retry_context.tentativa, 1);
assert.equal(first[0].json.wp_retry_context.max_tentativas, 3);
assert.equal(first[0].json.provider, 'cloudflare_r2');
assert.equal(first[0].binary, binary);

const second = await run({
  json: {
    ...first[0].json,
    error: { message: '522 - origin_error' },
    wp_failure_code: 'connection_timeout',
    pode_repetir_registro_wp: true,
  },
});

assert.equal(second[0].json.wp_retry_context.tentativa, 2);
assert.equal('error' in second[0].json, false);
assert.equal('wp_failure_code' in second[0].json, false);
assert.equal('pode_repetir_registro_wp' in second[0].json, false);

await assert.rejects(
  run({
    json: {
      wp_retry_context: {
        tentativa: 3,
        max_tentativas: 3,
      },
    },
  }),
  /Limite de três tentativas/,
);

console.log('Registro WP: preparação e limite de tentativas validados.');
