
const item = $input.item;
const j = item.json;

if (!item.binary?.data) {
  throw new Error('Arquivo binário ausente em binary.data.');
}

const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');

if (!buffer || buffer.length === 0) {
  throw new Error('O arquivo binário está vazio.');
}

// SHA-256 em JavaScript puro, sem require('crypto').
function sha256(asBytes) {
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];

  const rotr = (x,n) => (x >>> n) | (x << (32-n));
  const bytes = Array.from(asBytes);
  const bitLen = bytes.length * 8;

  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);

  const high = Math.floor(bitLen / 0x100000000);
  const low = bitLen >>> 0;

  for (let i=3; i>=0; i--) bytes.push((high >>> (i*8)) & 255);
  for (let i=3; i>=0; i--) bytes.push((low >>> (i*8)) & 255);

  let H = [
    0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
    0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
  ];

  for (let offset=0; offset<bytes.length; offset+=64) {
    const w = new Array(64);

    for (let i=0; i<16; i++) {
      const p=offset+i*4;
      w[i]=((bytes[p]<<24)|(bytes[p+1]<<16)|(bytes[p+2]<<8)|bytes[p+3])>>>0;
    }

    for (let i=16; i<64; i++) {
      const x=w[i-15], y=w[i-2];
      const s0=rotr(x,7)^rotr(x,18)^(x>>>3);
      const s1=rotr(y,17)^rotr(y,19)^(y>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }

    let [a,b,c,d,e,f,g,h]=H;

    for (let i=0; i<64; i++) {
      const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);
      const ch=(e&f)^(~e&g);
      const t1=(h+S1+ch+K[i]+w[i])>>>0;
      const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);
      const maj=(a&b)^(a&c)^(b&c);
      const t2=(S0+maj)>>>0;

      h=g; g=f; f=e; e=(d+t1)>>>0;
      d=c; c=b; b=a; a=(t1+t2)>>>0;
    }

    H=[
      (H[0]+a)>>>0,(H[1]+b)>>>0,(H[2]+c)>>>0,(H[3]+d)>>>0,
      (H[4]+e)>>>0,(H[5]+f)>>>0,(H[6]+g)>>>0,(H[7]+h)>>>0
    ];
  }

  return H.map(v=>v.toString(16).padStart(8,'0')).join('');
}

const sha = sha256(buffer);

const fileName =
  item.binary.data.fileName ||
  j.original_filename ||
  'featured-image';

const mimeType =
  item.binary.data.mimeType ||
  j.mime_type ||
  'application/octet-stream';

let width = null;
let height = null;

// Dimensões JPEG
if (mimeType === 'image/jpeg' || /\.jpe?g$/i.test(fileName)) {
  let p = 2;

  while (p < buffer.length) {
    if (buffer[p] !== 0xFF) {
      p++;
      continue;
    }

    const marker = buffer[p + 1];
    if (marker === 0xD8 || marker === 0xD9) {
      p += 2;
      continue;
    }

    if (p + 3 >= buffer.length) break;

    const len = buffer.readUInt16BE(p + 2);
    if (len < 2 || p + 2 + len > buffer.length) break;

    if ([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)) {
      height = buffer.readUInt16BE(p + 5);
      width = buffer.readUInt16BE(p + 7);
      break;
    }

    p += 2 + len;
  }
}

// Dimensões PNG
if (
  mimeType === 'image/png' ||
  /\.png$/i.test(fileName)
) {
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer.toString('ascii',1,4) === 'PNG'
  ) {
    width = buffer.readUInt32BE(16);
    height = buffer.readUInt32BE(20);
  }
}

return {
  json: {
    ...j,
    sha256: sha,
    original_filename: fileName,
    mime_type: mimeType,
    bytes: buffer.length,
    width,
    height,
  },
  binary: item.binary,
};
