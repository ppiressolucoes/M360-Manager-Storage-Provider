-- Ativacao para homologacao integrada; fornecida, nao executada pelo agente.
SET @r2_07_fuso_anterior = @@session.time_zone;
SET SESSION time_zone = '-03:00';

UPDATE Core_Storage_Provider
SET ind_ativo = 1,
    dsc_status = 'Integracao em homologacao'
WHERE storage_id = 18
  AND storage_alias = 'R2-07'
  AND provider = 'cloudflare_r2';

SET SESSION time_zone = @r2_07_fuso_anterior;

SELECT storage_id, storage_alias, provider, ind_ativo, dsc_status
FROM Core_Storage_Provider
WHERE storage_id = 18 AND storage_alias = 'R2-07';
