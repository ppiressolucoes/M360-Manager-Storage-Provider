const apiKey = String($json.dsc_api_key ?? '').trim();
const apiSecret = String($json.dsc_api_secret ?? '').trim();
const folder = String($json.storage_folder ?? '')
  .trim()
  .replace(/^\/+|\/+$/g, '');

const baseUrl = String($json.public_base_url ?? '').trim();
const cloudMatch = baseUrl.match(
  /^https:\/\/res\.cloudinary\.com\/([^/?#]+)(?:\/|$)/
);

if (!apiKey || !apiSecret) {
  throw new Error('Credenciais Cloudinary ausentes.');
}

if (!cloudMatch) {
  throw new Error('Cloud name não identificado em public_base_url.');
}

if (!folder || !/^[a-f0-9]{64}$/i.test(String($json.sha256 ?? ''))) {
  throw new Error('Pasta ou SHA-256 inválido.');
}

if (!$binary?.data) {
  throw new Error('Binário data ausente.');
}

return {
  json: {
    ...$json,
    storage_folder: folder,
    cloudinary_cloud: cloudMatch[1],
    cloudinary_public_id: `${folder}/${$json.sha256}`,
    AUTHORIZATION:
      `Basic ${Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64')}`,
  },
  binary: $binary,
};
