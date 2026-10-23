import assert from 'node:assert/strict';
import worker from './flow-b2-storage-proxy-hml.mjs';

const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(value => value.toString(16).padStart(2, '0'))
  .join('');

const env = {
  B2_KEY_ID: 'test-id',
  B2_APPLICATION_KEY: 'test-secret',
  PROXY_KEY: 'test-proxy',
  B2_BUCKET_NAME: 'test-bucket',
  B2_REGION: 'us-east-005',
  B2_S3_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
  PUBLIC_BASE_URL: 'https://worker.example.test',
};

function uploadRequest() {
  return new Request('https://worker.example.test/upload', {
    method: 'POST',
    headers: {
      'x-proxy-key': env.PROXY_KEY,
      'x-storage-folder': 'pel/featured',
      'x-media-sha256': sha,
      'x-file-extension': 'jpg',
      'x-original-filename': 'imagem.jpg',
      'x-media-width': '1200',
      'x-media-height': '800',
      'content-type': 'image/jpeg',
      'content-length': String(bytes.length),
    },
    body: bytes,
    duplex: 'half',
  });
}

function storageHealthRequest(proxyKey = env.PROXY_KEY) {
  return new Request('https://worker.example.test/health/storage', {
    headers: { 'x-proxy-key': proxyKey },
  });
}

async function withFetch(responses, test) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const next = responses.shift();
    if (!next) throw new Error('Resposta mock ausente.');
    return next;
  };
  try {
    await test(calls);
    assert.equal(responses.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await withFetch([
  new Response(null, { status: 404 }),
  new Response(null, { status: 520 }),
  new Response(null, { status: 200, headers: { 'content-length': String(bytes.length) } }),
], async calls => {
  const response = await worker.fetch(uploadRequest(), env, {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.existing, true);
  assert.equal(body.reconciled_after_put_error, true);
  assert.equal(body.sha256, sha);
  assert.deepEqual(calls.map(call => call.options.method), ['HEAD', 'PUT', 'HEAD']);
});

await withFetch([
  new Response(null, { status: 404 }),
  new Response(null, { status: 520 }),
  new Response(null, { status: 404 }),
], async calls => {
  const response = await worker.fetch(uploadRequest(), env, {});
  const body = await response.json();
  assert.equal(response.status, 502);
  assert.deepEqual(body, {
    error: 'b2_upload_failed',
    upstream_status: 520,
    reconciliation_status: 404,
    retryable: true,
    write_state: 'not_found',
  });
  assert.deepEqual(calls.map(call => call.options.method), ['HEAD', 'PUT', 'HEAD']);
});

await withFetch([
  new Response(null, { status: 200, headers: { 'content-length': String(bytes.length) } }),
], async calls => {
  const response = await worker.fetch(uploadRequest(), env, {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.existing, true);
  assert.equal(body.reconciled_after_put_error, false);
  assert.deepEqual(calls.map(call => call.options.method), ['HEAD']);
});

await withFetch([
  new Response(null, { status: 404 }),
  new Response(null, { status: 404 }),
  new Response(null, { status: 404 }),
], async calls => {
  const response = await worker.fetch(storageHealthRequest(), env, {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    provider: 'backblaze_b2',
    configured: true,
    bucket_read_verified: true,
    bucket_write_verified: false,
    probe_status: 404,
    probe_statuses: { m360: 404, pel: 404, trilhas: 404 },
  });
  assert.deepEqual(calls.map(call => call.options.method), ['HEAD', 'HEAD', 'HEAD']);
});

await withFetch([
  new Response(null, { status: 404 }),
  new Response(null, { status: 403 }),
  new Response(null, { status: 404 }),
], async calls => {
  const response = await worker.fetch(storageHealthRequest(), env, {});
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.bucket_read_verified, false);
  assert.equal(body.probe_status, 404);
  assert.deepEqual(body.probe_statuses, { m360: 404, pel: 403, trilhas: 404 });
  assert.deepEqual(calls.map(call => call.options.method), ['HEAD', 'HEAD', 'HEAD']);
});

await withFetch([], async calls => {
  const response = await worker.fetch(storageHealthRequest('invalid-proxy-key'), env, {});
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'unauthorized' });
  assert.deepEqual(calls, []);
});

console.log('Worker B2: reconciliação de PUT ambíguo e health de storage validados.');
