# Pipeline de detecção — Brasil Perpendicular V3

Data: 2026-07-25
Documentos relacionados: [architecture.md](architecture.md), [model-integration.md](model-integration.md), [privacy.md](privacy.md)

## Camadas

| Camada | Execução | Papel |
|---|---|---|
| Regras de contexto | Navegador | Rótulos da plataforma, declarações do autor, hashtags e risco de golpe |
| Roteamento político | Navegador | Aumenta prioridade e aciona STALL quando autorizado; nunca vira evidência |
| D3 local | Worker ONNX, WebGPU/WASM | Calcula uma anomalia temporal leve a partir de até 16 frames |
| STALL | API FastAPI, PyTorch/DINOv3 | Analisa anomalias espaciais e temporais contra a calibração VATEX |
| Fusão | Navegador | Deduplica sinais visuais, classifica e registra limitações |

## Fluxo da cascata

1. A extensão espera o vídeo ficar visível e extrai o contexto associado ao post.
2. Rótulo nativo ou declaração explícita do autor pode encerrar cedo como `declared_ai`.
3. O navegador captura até 16 JPEGs reduzidos, a 8 fps por 2 segundos, e cria um fingerprint SHA-256 a partir de dHashes.
4. D3 roda localmente em um worker dedicado. WebGPU é preferido; WASM é o fallback.
5. STALL é solicitado quando:
   - há contexto político e o envio automático foi autorizado;
   - D3 é positivo, incerto ou indisponível;
   - há conflito entre sinais;
   - o usuário confirma uma análise manual.
6. Se o primeiro trecho político ficar `uncertain`, uma segunda janela de 16 frames é analisada. O limite por vídeo nessa passagem é 32 frames.
7. Quando STALL responde, seu resultado substitui o D3 no grupo `visual-model`; os dois nunca são somados como evidências independentes.
8. Frames e miniaturas de fingerprint são limpos da memória. O cache guarda somente assessment, fingerprint e versões.

## Regras de decisão visual

O score retornado ao produto sempre significa “mais provável sintético”.

- STALL `syntheticScore >= 0.95`: `ai_like`;
- STALL `syntheticScore <= 0.20`: `real_like`;
- faixa intermediária: `uncertain`;
- erro, saturação ou artefato ausente: `unavailable`.

STALL upstream usa direção oposta — percentil alto significa real. A integração converte cada ramo com `1 - realScore`.

O D3 local calcula de fato a variação temporal de segunda ordem sobre embeddings MobileNetV3. Seus thresholds estão marcados como `pending`; portanto, até uma calibração independente ser aprovada, ele retorna `uncertain`, não produz evidência e encaminha ao STALL quando permitido.

## Contexto político

O dicionário inicial cobre nomes e termos básicos das eleições de 2026, incluindo Lula, Bolsonaro, TSE, eleição, presidente, governador, senador e nomes completos de partidos. Siglas ambíguas como `PT` e `PL` só contam com uma âncora política próxima ou como hashtag exata.

Esses termos:

- alteram prioridade da fila;
- justificam a análise aprofundada;
- podem acionar a segunda janela;
- nunca aumentam o score de mídia sintética.

O vocabulário pode ser ampliado em `packages/detection-core/src/routing/political-context.ts`.

## Evidências e classificação

Cada evidência possui domínio, origem, peso, confiança e grupo de correlação. Dentro do mesmo grupo vale apenas o maior `weight × confidence`; grupos diferentes usam noisy-OR com tetos para impedir que muitas pistas fracas virem uma acusação forte.

Estados exibidos:

- `declared_ai`: divulgação explícita e atribuída à plataforma ou ao autor;
- `likely_ai`: evidência visual STALL muito forte ou combinação forte de origens;
- `possibly_ai`: indícios relevantes, mas insuficientes para alta certeza;
- `insufficient_evidence`: a análise rodou sem evidência bastante;
- `inconclusive`: nenhuma análise útil terminou;
- `error`: falha inesperada.

Não existe estado “autêntico”. Ausência de evidência nunca comprova que o vídeo é real.

## Contrato remoto

`POST /api/v1/analyze/frames` aceita:

- 4 a 16 data URLs JPEG;
- máximo de 250.000 caracteres por frame e 5 MB no corpo;
- fingerprint SHA-256;
- amostragem fixa de 8 fps por 2 segundos;
- motivo de escalonamento e, opcionalmente, resumo técnico do detector local.

A extensão não inclui URL, título, legenda, autor, plataforma ou os termos políticos no payload visual.

## Cache e concorrência

- A fila local é limitada e prioriza contexto político.
- O worker ONNX mantém uma sessão serial de inferência.
- A API usa semáforo configurável, padrão de uma inferência STALL por processo.
- O cache da API é indexado por fingerprint, versão do detector e versão da calibração.
- Resultados `unavailable` não são persistidos.

## Versionamento

`assessmentVersion`, `rulesetVersion`, versões dos detectores, hashes dos modelos e calibração fazem parte do resultado ou da chave de cache. Alterar modelo, pré-processamento, threshold ou estratégia de fusão exige invalidar a versão correspondente e atualizar os testes.
