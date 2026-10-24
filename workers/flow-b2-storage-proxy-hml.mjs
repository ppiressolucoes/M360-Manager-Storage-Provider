const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const digest = async value => hex(await crypto.subtle.digest('SHA-256', value));
const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const validKey = key => /^(m360|pel|trilhas)\/featured\/[a-f0-9]{64}\.(jpg|png|webp)$/.test(key);

async function hmac(key, value) {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, encoder.encode(value)));
}

// Path-style S3 requests signed with AWS Signature V4, using Web Crypto.
async function s3(env, method, key, body, extraHeaders = {}) {
  const endpoint = new URL(env.B2_S3_ENDPOINT);
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== `s3.${env.B2_REGION}.backblazeb2.com`
      || endpoint.pathname !== '/' || endpoint.search || endpoint.username || endpoint.password || endpoint.port) {
    throw new Error('invalid_endpoint');
  }
  const path = '/' + [env.B2_BUCKET_NAME, ...key.split('/')].map(encode).join('/');
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = date.slice(0, 8);
  const payloadHash = await digest(body ?? new Uint8Array());
  const headers = {
    ...extraHeaders,
    host: endpoint.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': date,
  };
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');
  const canonicalHeaders = names.map(name => `${name}:${String(headers[name]).trim().replace(/\s+/g, ' ')}\n`).join('');
  const canonical = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${day}/${env.B2_REGION}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${date}\n${scope}\n${await digest(encoder.encode(canonical))}`;
  let signingKey = encoder.encode(`AWS4${env.B2_APPLICATION_KEY}`);
  for (const part of [day, env.B2_REGION, 's3', 'aws4_request']) signingKey = await hmac(signingKey, part);
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${env.B2_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${hex(await hmac(signingKey, stringToSign))}`;
  delete headers.host;
  return fetch(`${endpoint.origin}${path}`, {
    method, headers, ...(body ? { body } : {}), redirect: 'manual',
  });
}

async function authorized(request, env) {
  const supplied = request.headers.get('x-proxy-key') ?? '';
  if (!supplied || !env.PROXY_KEY) return false;
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(supplied)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(env.PROXY_KEY)));
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function verifyStorageRead(request, env) {
  if (!await authorized(request, env)) return json({ error: 'unauthorized' }, 401);

  // As chaves-sentinela não correspondem a arquivos reais. Com autenticação,
  // bucket, capabilities e prefixos corretos, o B2 deve responder 404 aos HEADs.
  const probeStatuses = {};
  for (const portal of ['m360', 'pel', 'trilhas']) {
    const probeKey = `${portal}/featured/${'0'.repeat(64)}.jpg`;
    const probe = await s3(env, 'HEAD', probeKey);
    probeStatuses[portal] = probe.status;
    await probe.body?.cancel();
  }
  const bucketReadVerified = Object.values(probeStatuses)
    .every(status => status === 200 || status === 404);

  return json({
    provider: 'backblaze_b2',
    configured: true,
    bucket_read_verified: bucketReadVerified,
    bucket_write_verified: false,
    probe_status: probeStatuses.m360,
    probe_statuses: probeStatuses,
  }, bucketReadVerified ? 200 : 503);
}

function mediaSignature(bytes, extension) {
  if (extension === 'jpg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (extension === 'png') return [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
}

async function upload(request, env) {
  if (!await authorized(request, env)) return json({ error: 'unauthorized' }, 401);
  const folder = request.headers.get('x-storage-folder') ?? '';
  const sha = (request.headers.get('x-media-sha256') ?? '').toLowerCase();
  const extension = (request.headers.get('x-file-extension') ?? '').toLowerCase();
  const key = `${folder}/${sha}.${extension}`;
  const mime = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const mimes = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const width = Number(request.headers.get('x-media-width'));
  const height = Number(request.headers.get('x-media-height'));
  if (!validKey(key) || mime !== mimes[extension] || !Number.isInteger(width) || width < 1
      || !Number.isInteger(height) || height < 1 || width > 30000 || height > 30000) {
    return json({ error: 'invalid_media_metadata' }, 400);
  }
  const limit = 10 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > limit) return json({ error: 'file_too_large' }, 413);
  if (!request.body) return json({ error: 'empty_file' }, 400);
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      return json({ error: 'file_too_large' }, 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (!size || !mediaSignature(bytes, extension)) return json({ error: 'invalid_image_signature' }, 400);
  if (await digest(bytes) !== sha) return json({ error: 'sha256_mismatch' }, 400);

  const previous = await s3(env, 'HEAD', key);
  const lookupStatus = previous.status;
  let existing = previous.status === 200;
  // Algumas chaves permitem PUT, mas não distinguem uma chave ausente no HEAD.
  // O conteúdo validado pelo SHA torna segura a tentativa idempotente de escrita.
  const lookupBypassed = previous.status === 403;
  if (!existing && previous.status !== 404 && !lookupBypassed) {
    await previous.body?.cancel();
    return json({ error: 'b2_lookup_failed', upstream_status: previous.status }, 502);
  }
  if (existing && Number(previous.headers.get('content-length')) !== size) {
    await previous.body?.cancel();
    return json({ error: 'existing_object_size_mismatch' }, 409);
  }
  await previous.body?.cancel();

  let reconciledAfterPutError = false;
  if (!existing) {
    const saved = await s3(env, 'PUT', key, bytes, {
      'content-type': mime,
      'cache-control': 'public, max-age=31536000, immutable',
    });
    const putStatus = saved.status;
    await saved.body?.cancel();

    if (!saved.ok) {
      // A falha da resposta do PUT não prova que o B2 deixou de persistir o objeto.
      // Reconcilia a chave content-addressed antes de autorizar fallback no n8n.
      const verification = await s3(env, 'HEAD', key);
      const verificationStatus = verification.status;
      const verificationSize = Number(verification.headers.get('content-length'));
      await verification.body?.cancel();

      if (verificationStatus === 200 && verificationSize === size) {
        existing = true;
        reconciledAfterPutError = true;
      } else if (verificationStatus === 200) {
        return json({
          error: 'existing_object_size_mismatch',
          upstream_status: putStatus,
          reconciliation_status: verificationStatus,
          retryable: false,
          write_state: 'size_mismatch',
        }, 409);
      } else {
        return json({
          error: 'b2_upload_failed',
          upstream_status: putStatus,
          reconciliation_status: verificationStatus,
          retryable: true,
          write_state: verificationStatus === 404 ? 'not_found' : 'unknown',
        }, 502);
      }
    }
  }
  const base = new URL(env.PUBLIC_BASE_URL);
  if (base.protocol !== 'https:' || base.pathname !== '/' || base.search || base.hash) throw new Error('invalid_public_base');
  const url = `${base.origin}/${key}`;
  return json({
    provider: 'backblaze_b2', sha256: sha, asset_id: sha,
    public_id: `${folder}/${sha}`, object_key: key,
    secure_url: url, url, width, height, mime_type: mime, bytes: size, existing,
    original_filename: (request.headers.get('x-original-filename') ?? '').trim(),
    lookup_status: lookupStatus,
    lookup_bypassed: lookupBypassed,
    reconciled_after_put_error: reconciledAfterPutError,
  });
}

async function deliver(request, env, ctx, key) {
  const cache = caches.default;
  const cacheRequest = new Request(new URL(request.url).origin + '/' + key, { method: 'GET' });
  const cached = await cache.match(cacheRequest);
  if (cached) return request.method === 'HEAD'
    ? new Response(null, { headers: cached.headers }) : cached;
  const upstream = await s3(env, request.method, key);
  if (upstream.status === 404) return json({ error: 'not_found' }, 404);
  if (!upstream.ok) return json({ error: 'b2_delivery_failed', upstream_status: upstream.status }, 502);
  const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[key.split('.').pop()];
  const headers = new Headers({
    'Content-Type': mime, 'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  });
  for (const name of ['content-length', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  const response = new Response(request.method === 'HEAD' ? null : upstream.body, { headers });
  if (request.method === 'GET') ctx.waitUntil(cache.put(cacheRequest, response.clone()));
  return response;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const path = new URL(request.url).pathname;
      const required = ['B2_KEY_ID', 'B2_APPLICATION_KEY', 'PROXY_KEY', 'B2_BUCKET_NAME', 'B2_REGION', 'B2_S3_ENDPOINT', 'PUBLIC_BASE_URL'];
      const configured = required.every(name => Boolean(env[name]));
      if (path === '/health' && request.method === 'GET') {
        return json({ provider: 'backblaze_b2', configured, bucket_write_verified: false }, configured ? 200 : 503);
      }
      if (!configured) return json({ error: 'missing_configuration' }, 503);
      if (path === '/health/storage' && request.method === 'GET') return await verifyStorageRead(request, env);
      if (path === '/upload' && request.method === 'POST') return await upload(request, env);
      const key = path.slice(1);
      if (['GET', 'HEAD'].includes(request.method) && validKey(key)) return await deliver(request, env, ctx, key);
      return json({ error: 'route_not_found' }, 404);
    } catch {
      // Never expose provider credentials, signed requests or upstream error bodies.
      return json({ error: 'proxy_internal_error' }, 500);
    }
  },
};
