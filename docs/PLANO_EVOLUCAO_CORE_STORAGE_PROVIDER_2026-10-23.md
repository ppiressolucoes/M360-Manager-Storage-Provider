# Plano de evolução — Core Manager Storage Provider

Atualizado em 23/10/2026, Brasília. Este plano consolida o backlog e as evidências versionadas até o commit `053d2ce`. É planejamento; não registra execução nova em MySQL, n8n, WordPress, Cloudflare ou Backblaze.

## Objetivo e limites

Evoluir o Core sem perder rastreabilidade entre o que foi preparado, aplicado e efetivamente homologado. A ordem proposta reduz mudanças simultâneas no pool antes de alterar retry, monitoramento ou entrega pública.

Alinhamentos preservados:

- reserva global por `SP_Core_Storage_Reserva(NULL, 3)`, sem criar adapter por conta;
- `CLOUDINARY-07` permanece inativo e o legado Cloudinary deve ser preservado;
- não provocar falhas em produção nem repetir reservas para forçar um destino;
- retry limitado a três tentativas totais continua aprovado, porém só deve avançar a partir da primeira falha real sanitizada;
- monitoramento R2/B2 começa observacional, sem bloquear automaticamente o pool;
- credenciais, tokens de reserva, dados de execução e valores de autenticação não entram no Git.

## Ordem proposta

### P0 — Fechar a homologação do inventário existente

Objetivo: converter estados pendentes em evidência conclusiva antes de ampliar comportamento do Core.

1. Consultar o estado real e sanitizado de R2-05 (16), R2-06 (17) e R2-07 (18): ativo, status, endpoint, URL pública e bucket.
2. Para cada destino ainda inativo, revisar o SQL correspondente e ativar um por vez no ambiente de homologação. R2-07 já possui script preparado; não interpretar o arquivo versionado como prova de execução.
3. Aguardar seleção natural pelo rodízio global. Não alterar a SP, prioridade ou contador apenas para direcionar o teste.
4. Confirmar o percurso completo: reserva, upload, finalização, registro/vínculo no WordPress, leitura pública e publicação.
5. Obter a evidência integral ainda ausente de R2-02 e B2-01 após as correções já registradas.

Critério de saída: cada storage pendente fica classificado como `publicação integrada confirmada` ou `bloqueado`, com data, origem da evidência, etapa de falha e próximo responsável. Teste isolado, `health` e cadastro não contam como publicação integrada.

### P1 — Recuperar o baseline operacional reproduzível

Objetivo: eliminar a distância entre os artefatos públicos e o runtime antes de editar o fluxo.

- exportar o workflow operacional atual sem dados de execução, sanitizá-lo e comparar nós/conexões com o baseline versionado;
- extrair os Code nodes completos e atualizar seus hashes somente quando corresponderem ao mesmo export;
- recuperar a fonte completa do Worker R2 realmente implantado, identificando versão e diferenças por conta sem incluir secrets;
- confrontar `SHOW CREATE PROCEDURE` das duas SPs com os SQLs reconstruídos, guardando backup administrativo antes de qualquer futura alteração;
- confirmar timezone do workflow Cloudinary e revisar retenção de execuções/credenciais;
- reproduzir e diagnosticar o problema de permissão/redirecionamento pós-save do Registry sem alterar o cadastro persistido.

Critério de saída: existe um pacote sanitizado coerente de export, Code nodes, Worker e SQL, com origem e validação declaradas. Diferenças não resolvidas permanecem documentadas; não são sobrescritas por uma reconstrução.

### P2 — Projetar e homologar retry de até três tentativas

Gatilho: primeira falha real do fluxo, preservada de forma sanitizada. Até esse evento, pode-se preparar a máquina de estados e os casos de teste, mas não afirmar que o retry está implantado.

Contrato mínimo:

1. Classificar a falha como recuperável, definitiva ou timeout ambíguo.
2. Finalizar a tentativa corrente e exigir confirmação da SP antes de reservar novamente.
3. Preservar binário, metadados editoriais e contexto; renovar apenas storage e token de reserva.
4. Limitar a três pares reserva/finalização. Falha de finalização, pool vazio, driver desconhecido ou fim das tentativas termina com erro explícito.
5. Não presumir que `bloqueio = 0` retira a conta do pool. Timeout pode ter gravado o objeto e exige tratamento idempotente/deduplicação.
6. Retornar o mesmo contrato de mídia do fluxo atual, sem transportar credenciais, autorização ou token ao fluxo pai.

Casos obrigatórios de homologação: sucesso na primeira tentativa; falha recuperável seguida de sucesso; falha definitiva sem retry; três falhas; pool vazio; falha de finalização; timeout com objeto possivelmente criado; resposta de provider/arquivo incompatível. Usar homologação controlada, nunca induzir falha em produção.

Critério de saída: export sanitizado e Code nodes completos versionados, casos acima evidenciados, contador de tentativas observável e nenhuma reserva órfã conhecida.

### P3 — Monitoramento unificado R2/B2

Objetivo inicial: leitura e alerta; nenhuma mudança automática de elegibilidade.

Decisões necessárias antes da implementação:

- fonte e escopo das APIs Cloudflare R2, Backblaze B2 e Workers;
- credenciais somente de leitura e vínculo conta → buckets, evitando multiplicar uma franquia compartilhada;
- métricas e janelas por unidade: armazenamento, operações/classes, saída e consumo de Workers;
- limites configuráveis por provider/plano, sem reutilizar percentuais Cloudinary como se fossem equivalentes;
- canal, destinatários e política de alerta/recuperação;
- retenção, timezone e chave de deduplicação das leituras.

Comportamento mínimo: falha de coleta mantém a última leitura válida e grava `SEM_LEITURA`; mudança de nível gera no máximo um alerta e recuperação também é notificada; `num_count` nunca é tratado como consumo; nenhuma primeira leitura bloqueia o pool.

Critério de saída: contrato de dados aprovado, coleta por conta sem dupla contagem, testes com resposta válida/limite/falha e alertas deduplicados. Automação de bloqueio, se desejada, será uma fase separada.

### P4 — Preparar entrega de produção

- definir domínio/CDN adequado para R2 e limites operacionais; `r2.dev` continua tratado como desenvolvimento;
- preservar compatibilidade das URLs já publicadas e planejar migração sem quebrar attachments virtuais;
- definir SLOs, observabilidade de upload/entrega e procedimento de rollback;
- reavaliar OCI apenas após priorização explícita e verificação comercial/técnica atual.

Critério de saída: arquitetura de entrega, compatibilidade, rollback e limites documentados antes de mudar URLs existentes.

## Pacote mínimo de evidência

Cada avanço operacional deve registrar, sem secrets:

- data/hora e timezone;
- componente, ambiente e versão identificável;
- ação executada e origem do artefato;
- entrada e saída sanitizadas;
- resultado por etapa e conclusão limitada ao que a evidência comprova;
- pendência, responsável e próximo passo quando houver bloqueio.

`Health`, cadastro, upload isolado, leitura pública e publicação integrada são evidências diferentes e não devem ser usadas como sinônimos.

## Próxima sessão recomendada

Começar por P0 com uma consulta sanitizada dos IDs 16, 17 e 18. Se R2-07 continuar inativo, revisar e executar conscientemente `database/mysql/inventory/activate_R2-07.sql`; depois observar a seleção natural e registrar o percurso integral. Não iniciar retry ou monitoramento em paralelo com uma homologação cujo estado real ainda seja desconhecido.

Ao concluir cada ação, atualizar `docs/BACKLOG.md`, o documento de continuidade aplicável e `docs/ARTEFATOS_DAS_SPRINTS.md`, distinguindo preparação, execução e homologação, e então sincronizar o repositório remoto.
