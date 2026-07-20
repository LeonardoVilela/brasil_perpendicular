# Integração de modelo visual — Brasil Perpendicular

Data: 2026-07-20
Documentos relacionados: [detection-pipeline.md](detection-pipeline.md), [architecture.md](architecture.md), [privacy.md](privacy.md), [threat-model.md](threat-model.md)

A primeira entrega não executa análise visual real. Ela mantém um contrato substituível, um mock restrito ao modo desenvolvedor e um stub ONNX que falha honestamente. Um modelo real entra somente na Fase 3 e não muda a regra central do produto: o resultado é evidência com incerteza, nunca prova definitiva.

## Contrato `VisualDetector`

Definido em `apps/extension/src/detectors/types.ts`:

```ts
export interface VisualDetector {
  readonly name: string;
  readonly version: string;
  readonly isMock: boolean;
  initialize(): Promise<void>;
  analyzeFrames(frames: ImageData[]): Promise<VisualDetectionResult>;
}
```

`VisualDetectionResult` informa probabilidade sintética, confiança, nome e versão do modelo, resultados por frame e avisos. Probabilidade e confiança ficam entre 0 e 1. Na integração futura, o pipeline transformará a saída válida em evidência do domínio `synthetic_media`; o detector não classificará o vídeo nem alterará thresholds.

Uma implementação real deve:

- carregar seus recursos em `initialize()` e rejeitar com erro explícito quando eles não estiverem disponíveis;
- produzir saída determinística para a mesma entrada e versão do modelo;
- validar limites e valores da saída antes de entregá-la ao pipeline;
- identificar a versão exata do modelo no assessment e invalidar cache incompatível;
- tratar falhas de frame, CORS, canvas contaminado e DRM como análise indisponível, sem fabricar um score;
- não persistir frames nem enviá-los pela rede.

Sem detector real disponível, o assessment adiciona `visual_model` a `unavailableAnalyses` e registra a limitação. A indisponibilidade não reduz os scores obtidos por outros domínios de evidência.

## Plano ONNX para a Fase 3

`apps/extension/src/detectors/onnx.ts` é apenas o ponto de substituição atual. A integração planejada usa ONNX Runtime Web com esta ordem:

1. incluir um modelo quantizado e seus metadados nos assets versionados da extensão;
2. inicializar pelo backend WebGPU quando disponível e usar WASM como fallback;
3. extrair de 3 a 6 frames redimensionados, com limites de memória e tempo;
4. aplicar exatamente o pré-processamento declarado pelo modelo;
5. agregar os resultados por frame no pipeline, preservando avisos e versão;
6. medir tamanho do bundle, latência e uso de memória em hardware sem GPU antes de habilitar por padrão.

A escolha do modelo, licença, conjunto de avaliação, calibração e thresholds precisa ser registrada antes da implementação. Quantização só é aceita após comparar a qualidade com a versão de referência; redução de tamanho não pode ser tratada como equivalência presumida.

Não adicione `onnxruntime-web` enquanto o modelo e o plano de avaliação não estiverem aprovados. O stub atual mantém a entrega honesta sem aumentar o bundle.

## Regra anti-mock

`MockVisualDetector` existe somente para testes e modo desenvolvedor:

- o construtor rejeita `devMode: false`;
- `isMock` é sempre `true`;
- nome, versão, avisos e evidências derivadas ficam marcados com `mock`/`[MOCK]`;
- o resultado não pode ser persistido como assessment genuíno;
- nenhuma tela de produção pode apresentar a saída como análise real.

Um mock nunca é fallback de produção. Se o modelo real falhar, o estado correto é análise visual indisponível.

## Verificação mínima da integração futura

Antes de habilitar um detector real:

- testes unitários cobrem inicialização, pré-processamento, limites da saída, fallback WebGPU → WASM e falhas de frame;
- fixtures conhecidas verificam estabilidade e calibração sem prometer detecção perfeita;
- o build continua carregável em Manifest V3 e o modelo não depende de código remoto;
- DevTools confirma ausência de upload automático e de requisições ocultas;
- `docs/privacy.md` e `docs/threat-model.md` são revisados;
- a UI continua exibindo evidências, limitações, versão do detector e o aviso de que o resultado não é prova definitiva.
