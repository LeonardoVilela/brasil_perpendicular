# Roadmap — Brasil Perpendicular

Data: 2026-07-20

O roadmap organiza a evolução técnica descrita no [escopo do MVP](product/mvp-scope.md). Datas e distribuição pública não fazem parte desta primeira entrega; cada fase só avança após validar privacidade, segurança e qualidade dos rótulos.

## Fase 1 — MVP local e explicável

Status: implementada nesta branch.

- extensão Chromium Manifest V3 com permissões mínimas;
- descoberta de vídeos estáticos e dinâmicos, dwell em viewport e fila limitada;
- adaptador genérico para contexto textual;
- regras locais, agregação por domínios e classificação com incerteza;
- overlay, painel de detalhes, popup, opções e cache local;
- API FastAPI com validação e respostas honestas de indisponibilidade;
- mock visual somente em desenvolvimento e stub ONNX;
- páginas locais de demonstração, testes e documentação de operação.

Limites: sem modelo visual real e sem prova de autenticidade.

## Fase 2 — Adaptadores de plataforma

Status: implementada na versão `0.2.0` desta branch.

- adicionar adaptadores dedicados para YouTube, TikTok, Instagram e X/Twitter;
- centralizar seletores e extrair título, descrição, autor, hashtags e rótulos nativos de IA;
- separar a origem da evidência entre rótulo da plataforma, declaração do autor e contexto genérico;
- manter o adaptador genérico como fallback;
- ignorar texto oculto e conteúdo genérico não associado ao vídeo;
- mostrar o símbolo visual grande somente em `declared_ai`;
- adicionar fixtures e testes de degradação para mudanças de DOM.

Critério de saída atingido: os adaptadores reconhecem contexto e rótulos nativos sem transformar ausência de sinal em autenticidade. O acesso HTTP/HTTPS é necessário para ativação automática; a análise V2 permanece local.

## Fase 3 — Análise visual e profunda

- integrar modelo local ONNX quantizado, com WebGPU e fallback WASM;
- extrair de 3 a 6 frames redimensionados com tratamento de CORS, canvas contaminado e DRM;
- registrar versão, confiança, avisos e limitações do detector no assessment;
- definir a estratégia de fonte única antes de implementar análise profunda real na API;
- manter envio remoto desativado por padrão, consentimento explícito e proibição de upload do vídeo integral.

Critério de saída: modelo e quantização avaliados e calibrados, desempenho aceitável em hardware sem GPU, falhas degradando para indisponibilidade e nenhuma requisição sem ação do usuário.

## Fase 4 — Evidências avançadas

- análise temporal e de áudio;
- procedência C2PA e metadados de origem;
- hash perceptual para identidade e cache;
- integração com provedores de fact-checking;
- revisão da agregação para preservar a independência entre domínios e evitar dupla contagem.

Critério de saída: cada nova fonte mantém proveniência, versão, limitações e testes próprios; risco contextual de golpe continua separado da probabilidade de mídia sintética.

## Antes de distribuição pública

Publicação na Chrome Web Store exige trabalho separado: política de privacidade pública e revisão jurídica, revisão de permissões e cadeia de suprimentos, autenticação/rate limiting se a API deixar de ser local, testes em versões suportadas do Chromium e processo de atualização dos adaptadores e do modelo.
