# Baseline candidata v0.1.9

Base real de partida: `v0.1.8` em produção.

Esta versão adiciona o Storage Provider Registry ao M360 Dashboard. A configuração de providers, hosts e modo de entrega deixa de depender de condicionais espalhadas no runtime. Attachments existentes continuam válidos sem migração e a transformação Cloudinary histórica permanece protegida.

O pacote WordPress deve conter a pasta `m360-external-featured-media/` e o arquivo principal `m360-external-featured-media.php`. Não embuta credenciais, assets, conteúdo ou configuração de um portal no repositório ou no pacote.

Para o Portal Energia Limpa, instale primeiro em staging e valide: endpoints autenticados, idempotência por SHA-256, nenhuma escrita de imagem em `uploads`, renderização no frontend, reuso do mesmo `attachment_id` na tradução e metatags sociais da Featured Image externa.
