-- Ativacao para homologacao integrada; fornecida, nao executada pelo agente.
SET @r2_08_fuso_anterior = @@session.time_zone;
SET SESSION time_zone = '-03:00';

UPDATE Core_Storage_Provider
SET ind_ativo = 1,
    dsc_status = 'Integracao em homologacao'
WHERE storage_id = 19
  AND storage_alias = 'R2-08'
  AND provider = 'cloudflare_r2'
  AND ind_ativo = 0;

SET SESSION time_zone = @r2_08_fuso_anterior;

SELECT storage_id, storage_alias, provider, ind_ativo, dsc_status,
       endpoint_url, public_base_url, bucket_name
FROM Core_Storage_Provider
WHERE storage_id = 19 AND storage_alias = 'R2-08';
