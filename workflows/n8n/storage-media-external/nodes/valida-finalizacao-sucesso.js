// Valida a primeira linha retornada pela SP.
const dados = $input.first().json;

const finalizacao = Array.isArray(dados)
  ? Array.isArray(dados[0])
    ? dados[0][0]
    : dados[0]
  : dados;

if (Number(finalizacao?.finalizacao_ok) !== 1) {
  throw new Error(
    `Finalização não confirmada: ${
      finalizacao?.motivo || 'retorno inválido da SP'
    }`
  );
}

// Recupera o contexto da execução corrente.
const contexto = $('SHA-256 + Metadados').itemMatching(0).json;

// R2 e B2 compartilham driver; a seleção é por provider.
const nodesUpload = {
  cloudinary: 'Upload Cloudinary - Proxy',
  cloudflare_r2: 'Upload S3R2 - Proxy',
  backblaze_b2: 'Upload S3B2 - Proxy',
};

const nomeUpload = nodesUpload[contexto.provider];

if (!nomeUpload) {
  throw new Error(
    `Provider não suportado: ${contexto.provider}`
  );
}

if (
  Number(finalizacao.storage_id) !==
  Number(contexto.storage_id)
) {
  throw new Error(
    'Finalização não corresponde ao storage da execução.'
  );
}

// Recupera a resposta do upload.
const resposta = $(nomeUpload).itemMatching(0).json;
let upload = resposta.body ?? resposta;

// Algumas configurações HTTP retornam o body como texto.
if (typeof upload === 'string') {
  try {
    upload = JSON.parse(upload);
  } catch {
    throw new Error('Resposta do upload não contém JSON válido.');
  }
}

if (
  !upload ||
  typeof upload !== 'object' ||
  Array.isArray(upload)
) {
  throw new Error('Resposta do upload não contém um objeto de mídia.');
}

if (
  upload.provider &&
  upload.provider !== contexto.provider
) {
  throw new Error('Provider do upload não corresponde à reserva.');
}

if (
  upload.sha256 &&
  upload.sha256 !== contexto.sha256
) {
  throw new Error(
    'SHA-256 do upload não corresponde ao arquivo enviado.'
  );
}

// Valida os metadados.
const secureUrl = upload.secure_url;
const width = Number(upload.width);
const height = Number(upload.height);
const bytes = Number(upload.bytes ?? contexto.bytes);

// Não utiliza a classe URL, indisponível no sandbox desta instância.
let urlValida = false;

if (typeof secureUrl === 'string') {
  const match = secureUrl.match(
    /^https:\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?(\/[^\s\\]*)?$/i
  );

  if (match) {
    const host = match[1];
    const porta = match[2];

    const hostValido =
      host.length <= 253 &&
      host.includes('.') &&
      host.split('.').every(
        parte =>
          parte.length >= 1 &&
          parte.length <= 63 &&
          /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(parte)
      );

    urlValida =
      hostValido &&
      (
        !porta ||
        (Number(porta) >= 1 && Number(porta) <= 65535)
      );
  }
}

const widthValido = Number.isInteger(width) && width > 0;
const heightValido = Number.isInteger(height) && height > 0;
const bytesValidos = Number.isInteger(bytes) && bytes > 0;

if (
  !urlValida ||
  !widthValido ||
  !heightValido ||
  !bytesValidos
) {
  throw new Error(
    'Resposta de upload inválida: ' +
    JSON.stringify({
      provider: contexto.provider,
      storage_id: contexto.storage_id,
      nodeUpload: nomeUpload,
      urlValida,
      widthValido,
      heightValido,
      bytesValidos,
    })
  );
}

if (!/^[a-f0-9]{64}$/i.test(String(contexto.sha256 ?? ''))) {
  throw new Error('SHA-256 do contexto ausente ou inválido.');
}

// Preserva IDs reais; permite fallback para providers de objetos.
const providerObjeto = [
  'cloudflare_r2',
  'backblaze_b2',
].includes(contexto.provider);

const publicId = upload.public_id ??
  (
    providerObjeto && contexto.storage_folder
      ? `${contexto.storage_folder}/${contexto.sha256}`
      : null
  );

const assetId = upload.asset_id ??
  (providerObjeto ? upload.object_key : null);

if (!publicId || !assetId) {
  throw new Error(
    'Resposta de upload sem identificadores da mídia.'
  );
}

const mimeType = upload.mime_type ?? contexto.mime_type;

if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
  throw new Error('MIME da mídia ausente ou não suportado.');
}

// Retorna somente os insumos de mídia para o fluxo pai.
// Não transporta credenciais, autorização ou token da reserva.
return [
  {
    json: {
      provider: contexto.provider,
      sha256: contexto.sha256,
      asset_id: assetId,
      public_id: publicId,
      secure_url: secureUrl,
      url: secureUrl,
      width,
      height,
      mime_type: mimeType,
      original_filename: String(
        contexto.original_filename ?? ''
      ).trim(),
      bytes,
      existing: upload.existing === true,
    },
  },
];
