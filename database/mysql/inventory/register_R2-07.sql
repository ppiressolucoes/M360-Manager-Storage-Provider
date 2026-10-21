-- Cadastro inativo; executar manualmente apos revisao. Nao executado pelo agente.
-- Idempotencia por alias: cadastro existente nao e sobrescrito.
SET @r2_07_fuso_anterior = @@session.time_zone;
SET SESSION time_zone = '-03:00';

INSERT INTO Core_Storage_Provider (
    provider, storage_driver, storage_alias,
    endpoint_url, public_base_url, bucket_name,
    region_name, credential_ref, dsc_status,
    num_count, prioridade, ind_ativo
)
SELECT
    'cloudflare_r2',
    's3_compatible',
    'R2-07',
    'https://flow-r2-storage-proxy-07.core360-7.workers.dev',
    'https://pub-28e61f0e5f1e45068767c5bebdc26418.r2.dev',
    'core360-storage-hml-7',
    NULL,
    NULL,
    'Upload, leitura publica e deduplicacao homologados',
    0,
    100,
    0
WHERE NOT EXISTS (
    SELECT 1 FROM Core_Storage_Provider WHERE storage_alias = 'R2-07'
);

SET SESSION time_zone = @r2_07_fuso_anterior;

SELECT storage_id, provider, storage_driver, storage_alias,
       endpoint_url, public_base_url, bucket_name, ind_ativo
FROM Core_Storage_Provider
WHERE storage_alias = 'R2-07';
