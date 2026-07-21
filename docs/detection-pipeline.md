# Pipeline de detecção — Brasil Perpendicular

Data: 2026-07-21
Documentos relacionados: [architecture.md](architecture.md), [mvp-scope.md](product/mvp-scope.md)

Este documento define o modelo de evidências, o motor de regras, a estratégia de agregação e as faixas de classificação. Os números aqui são a **fonte de verdade** para `packages/detection-core` e seus testes.

## 1. Camadas

| Camada | O quê | Onde roda | Status na 1ª entrega |
|---|---|---|---|
| 1 | Contexto, adaptadores e regras locais (texto, rótulos, URLs) | Content script | **V2 implementada** |
| 2 | Análise visual leve (frames) | Content script (ONNX Web) | Interface + mock (dev) + stub |
| 3 | Análise profunda | API FastAPI | Endpoints honestos (`unavailable`) |
| 4 | Áudio, temporal, C2PA, hash perceptual, fact-check | — | Apenas interfaces |

## 2. Domínios de evidência

Cada evidência pertence a exatamente um domínio. Domínios **nunca** se misturam na agregação:

1. `synthetic_media` — sinais de que o conteúdo é gerado/manipulado (texto declarando IA, nome de ferramenta, marca d'água, futuro modelo visual);
2. `provenance` — procedência (C2PA, metadados de origem — futuro);
3. `platform_disclosure` — rótulo nativo da plataforma visível no DOM;
4. `scam_context` — padrões de golpe brasileiro (contexto de risco, **não** prova de IA);
5. `fact_check` — correspondência com conteúdo já checado (futuro; provider mock);
6. `technical_availability` — quais análises puderam ou não rodar (alimenta `limitations` e confiança, não o score).

## 3. Modelo de evidência

```ts
interface Evidence {
  id: string;
  domain: EvidenceDomain;            // seção 2
  type: "platform_label" | "description" | "hashtag" | "watermark"
      | "metadata" | "visual_model" | "source" | "other";
  label: string;                     // pt-BR, responsável, curto
  description: string;               // pt-BR, explica o que foi encontrado
  weight: number;                    // 0..1 — força intrínseca do sinal
  confidence: number;                // 0..1 — certeza de que o sinal foi bem extraído
  correlationGroup: string;          // evidências correlacionadas compartilham o grupo
  origin: "signed_provenance" | "platform_disclosure" | "author_statement"
        | "page_context" | "technical_signal";
  source?: string;                   // ex.: "description", "hashtags", "aria-label"
}
```

`origin` registra quem sustenta a evidência. Texto de contexto, declaração atribuída ao autor e rótulo da plataforma podem conter as mesmas palavras, mas não recebem a mesma confiança.

Score efetivo de uma evidência: `effective = weight × confidence`.

Faixas de força (para regras e testes):
- **forte**: `effective ≥ 0.8` (ex.: rótulo nativo da plataforma; declaração explícita do autor);
- **média**: `0.5 ≤ effective < 0.8` (ex.: nome de ferramenta de IA na descrição; hashtag #aigenerated);
- **fraca**: `effective < 0.5` (ex.: hashtag genérica #ai; menção ambígua).

## 4. Motor de regras (Camada 1)

Regras declarativas versionadas em `detection-core/src/rules/`:

```ts
interface TextRule {
  id: string;
  domain: EvidenceDomain;
  patterns: RegExp[];                // aplicados a campos do VideoContext
  fields: ContextField[];            // inclui authorStatements e platformLabels
  weight: number;
  confidence: number;
  correlationGroup: string;
  origin: Evidence["origin"];
  evidenceType: Evidence["type"];
  label: string;                     // pt-BR
  descriptionTemplate: string;       // pt-BR, pode citar o trecho encontrado (truncado)
}
```

### Conjuntos de regras iniciais

- **Ferramentas de IA** (`synthetic_media`, grupo `ai-tool-mention`, weight 0.6, confidence 0.9): Sora, Veo, Runway, Kling, Midjourney, Pika, Luma, Synthesia, HeyGen, Stable Diffusion, DALL·E e variações com fronteira de palavra (evitar falsos positivos como "pikachu" → usar `\b` e listas de exclusão testadas).
- **Declarações explícitas do autor** (`synthetic_media`, origem `author_statement`, grupo `explicit-declaration`, weight 0.85, confidence 0.9): "gerado por IA", "criado com IA", "conteúdo sintético", "AI generated", "synthetic media", "made with AI", "vídeo de IA".
- **Menção genérica equivalente** (`synthetic_media`, origem `page_context`, mesmo grupo, weight 0.65, confidence 0.85): é evidência contextual, mas nunca vira declaração confiável sozinha.
- **Hashtags** (`synthetic_media`, grupo `ai-hashtag`, weight 0.45, confidence 0.85): `#ia`, `#ai`, `#aigenerated`, `#geradoporia`, `#aivideo`, `#sora` etc.
- **Rótulo da plataforma** (`platform_disclosure`, origem `platform_disclosure`, grupo `platform-label`, weight 1, confidence 0.98): produzido pelos adaptadores quando o DOM visível expõe o selo nativo no post do vídeo.
- **Golpes brasileiros** (`scam_context`, grupos por categoria, weights 0.4–0.7): indenização, benefício governamental, "saque liberado", investimento garantido, pedido de Pix, empréstimo imediato, imitação de telejornal, celebridade + medicamento, "últimas vagas", "consulte seu CPF", "valor liberado", urgência financeira. Lista configurável em módulo próprio (`rules/brazilian-scam-patterns.ts`).

Todos os conjuntos têm `rulesetVersion` (semver) incluída no assessment.

## 5. Agregação — evitando dupla contagem

A agregação roda **por domínio**, em três passos:

1. **Agrupar** evidências por `correlationGroup`.
2. **Score do grupo** = `max(effective)` das evidências do grupo (evidências correlacionadas não se somam; a mais forte representa o grupo).
3. **Combinação entre grupos** (noisy-OR): `S = 1 − Π(1 − g_i)` sobre os scores de grupo `g_i` do domínio, com **tetos por composição**:
   - se todos os grupos são fracos (`g < 0.5`): `S = min(S, 0.49)` — muitas evidências fracas nunca atingem "provavelmente";
   - se não há grupo forte e há menos de dois grupos médios: `S = min(S, 0.74)`.

Propriedades garantidas por teste:
- 10 hashtags fracas correlacionadas ⇒ um grupo ⇒ `S < 0.5`;
- resultado visual inconclusivo **não reduz** score de procedência/divulgação (domínios independentes; indisponibilidade vai para `limitations`);
- `scam_context` produz `scamRisk` separado (mesma agregação), **nunca** entra em `S` de `synthetic_media`.

## 6. Classificação

```ts
interface DetectionAssessment {
  classification: "declared_ai" | "likely_ai" | "possibly_ai"
                | "insufficient_evidence" | "inconclusive" | "error";
  score: number;                     // S do domínio synthetic_media (0..1)
  confidence: "low" | "medium" | "high";
  scamRisk: "none" | "low" | "medium" | "high";   // domínio scam_context, separado
  evidence: Evidence[];              // todas, de todos os domínios
  executedAnalyses: string[];        // ex.: ["context_rules"]
  unavailableAnalyses: string[];     // ex.: ["visual_model", "provenance"]
  limitations: string[];             // pt-BR
  analyzedAt: string;                // ISO-8601
  assessmentVersion: string;         // semver do algoritmo
  rulesetVersion: string;
  detectorVersions: Record<string, string>;
}
```

### Regras de decisão (nesta ordem)

1. `error` — falha inesperada durante a análise.
2. `inconclusive` — nenhuma análise pôde ser executada (ex.: contexto vazio E visual indisponível).
3. `declared_ai` — exige grupo `platform-label` com origem `platform_disclosure` e `g ≥ 0.9`, ou grupo `explicit-declaration` com origem `author_statement` e `g ≥ 0.75`. Texto solto com origem `page_context` não aciona este estado.
4. `likely_ai` — `S ≥ 0.75`, pelo menos duas origens independentes e ao menos uma origem de alta confiança. Na V2 sem modelo visual real, esse estado deve ser raro.
5. `possibly_ai` — `0.45 ≤ S < 0.75`.
6. `insufficient_evidence` — `S < 0.45` com pelo menos uma análise executada.

### Confiança

- `high` — `declared_ai`, ou grupo forte + ≥2 análises executadas;
- `medium` — ≥1 grupo médio e contexto razoavelmente completo (título + descrição presentes);
- `low` — caso contrário (padrão; contexto pobre ⇒ sempre `low`).

### Faixas de scamRisk

`high ≥ 0.7`, `medium ≥ 0.45`, `low ≥ 0.25`, senão `none`. Exibido no painel como "Contexto de risco" com texto explicativo — nunca como prova de IA.

## 7. Camada 2 — contrato do detector visual

```ts
interface VisualDetector {
  readonly name: string;
  readonly version: string;
  readonly isMock: boolean;
  initialize(): Promise<void>;
  analyzeFrames(frames: ImageData[]): Promise<VisualDetectionResult>;
}

interface VisualDetectionResult {
  syntheticProbability: number;      // 0..1
  confidence: number;                // 0..1
  modelName: string;
  modelVersion: string;
  frameResults: Array<{ timestamp: number; syntheticProbability: number }>;
  warnings: string[];
}
```

Regras:
- `MockVisualDetector` só é instanciável com `devMode = true`; toda saída carrega `isMock: true`, gera evidência com label prefixado "[MOCK]" e nunca é gravada no cache como avaliação genuína.
- Sem detector real disponível ⇒ `unavailableAnalyses += ["visual_model"]` e limitação correspondente; o score **não** é penalizado.
- `OnnxVisualDetector` (stub na 1ª entrega): preparado para ONNX Runtime Web com WebGPU e fallback WASM, modelo quantizado carregado dos assets da extensão (Fase 3). Extração de frames (3–6, redimensionados, com tratamento de CORS/canvas contaminado/DRM) também é Fase 3.

## 8. Camada 3 — API

Contratos em [architecture.md](architecture.md) §D7 e implementação em `apps/api`. Limites (validados por teste):
- `POST /api/v1/analyze/context`: campos de texto ≤ 20 000 caracteres no total;
- `POST /api/v1/analyze/frames` e `/deep`: máx. 6 frames JPEG base64, ≤ 1 MB cada, payload total ≤ 5 MB;
- respostas de análise na 1ª entrega: `{"status": "unavailable", "detail": "..."}` — nunca resultado fabricado;
- `POST /api/v1/feedback`: `{classification, score, assessment_version, ruleset_version, expected, comment?}` sanitizado (sem frames, sem URL não normalizada), gravado em JSONL local.

## 9. Interfaces futuras (declaradas, não implementadas)

```ts
interface FactCheckProvider {
  search(input: FactCheckSearchInput): Promise<FactCheckMatch[]>;
}
interface PerceptualHashProvider {
  hash(frames: ImageData[]): Promise<string>;
}
```

`MockFactCheckProvider` local com dados estáticos claramente fictícios, usado apenas em testes e dev mode.

## 10. Versionamento

- `assessmentVersion` e `rulesetVersion` estão em `0.2.0`; qualquer mudança em thresholds/agregação incrementa a versão e exige atualização deste documento e dos testes.
- Assessments em cache carregam suas versões; cache é invalidado quando `assessmentVersion` ou `rulesetVersion` do runtime difere.
