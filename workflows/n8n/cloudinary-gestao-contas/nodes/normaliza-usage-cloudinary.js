const r = $json;

const body =
  r.body && typeof r.body === 'object'
    ? r.body
    : {};

const credits = body.credits ?? {};
const transformations = body.transformations ?? {};
const bandwidth = body.bandwidth ?? {};
const storage = body.storage ?? {};

return [{
  json: {
    api_id: Number(r.api_id),

    cloud_name:
      r.cloud_name ?? null,

    account_email:
      r.account_email ?? null,

    plan:
      body.plan ?? null,

    last_updated:
      body.last_updated ?? null,

    date_requested:
      body.date_requested ?? null,

    credit_used:
      Number(credits.usage ?? 0),

    credit_limit:
      Number(credits.limit ?? 0),

    credit_percent:
      Number(credits.used_percent ?? 0),

    transformation_usage:
      Number(transformations.usage ?? 0),

    transformation_credits:
      Number(transformations.credits_usage ?? 0),

    bandwidth_bytes:
      Number(bandwidth.usage ?? 0),

    bandwidth_credits:
      Number(bandwidth.credits_usage ?? 0),

    storage_bytes:
      Number(storage.usage ?? 0),

    storage_credits:
      Number(storage.credits_usage ?? 0),

    resources:
      Number(body.resources ?? 0),

    derived_resources:
      Number(body.derived_resources ?? 0),

    objects:
      Number(body.objects?.usage ?? 0),

    requests:
      Number(body.requests ?? 0),

    impressions:
      Number(body.impressions?.usage ?? 0),

    admin_rate_limit:
      Number(
        r.headers?.['x-featureratelimit-limit'] ?? 0
      ),

    admin_rate_remaining:
      Number(
        r.headers?.['x-featureratelimit-remaining'] ?? 0
      ),

    http_status:
      Number(r.statusCode ?? 0),

    raw_usage:
      body
  }
}];
