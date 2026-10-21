const x = $json;

if (!x.api_id || !x.cloud_name || !x.api_key || !x.api_secret) {
  throw new Error(
    `Conta Cloudinary incompleta. api_id=${x.api_id}, cloud_name=${x.cloud_name}`
  );
}

const auth = Buffer
  .from(`${x.api_key}:${x.api_secret}`)
  .toString('base64');

return [{
  json: {
    ...x,
    authorization: `Basic ${auth}`
  }
}];
