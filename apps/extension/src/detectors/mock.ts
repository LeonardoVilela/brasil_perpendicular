import type { VisualDetectionResult, VisualDetector } from "./types";

const MOCK_PROBABILITY = 0.5;
const MOCK_CONFIDENCE = 0.5;
const MOCK_WARNING = "[MOCK] resultado fixo de desenvolvimento";

/**
 * Detector visual falso, só para desenvolvimento e testes. Saída fixa e
 * determinística, nunca representa uma análise real — por isso só pode ser
 * instanciado com devMode ativo, e todo resultado carrega isMock: true e o
 * aviso "[MOCK]" (docs/detection-pipeline.md §7).
 */
export class MockVisualDetector implements VisualDetector {
  readonly name = "mock-visual-detector";
  readonly version = "0.0.0-mock";
  readonly isMock = true;

  constructor(options: { devMode: boolean }) {
    if (!options.devMode) {
      throw new Error("MockVisualDetector só pode ser instanciado com devMode ativo.");
    }
  }

  async initialize(): Promise<void> {
    // Nada para carregar — não há modelo real.
  }

  async analyzeFrames(frames: ImageData[]): Promise<VisualDetectionResult> {
    return {
      syntheticProbability: MOCK_PROBABILITY,
      confidence: MOCK_CONFIDENCE,
      modelName: "mock-fixed",
      modelVersion: this.version,
      frameResults: frames.map((_, index) => ({
        timestamp: index,
        syntheticProbability: MOCK_PROBABILITY,
      })),
      warnings: [MOCK_WARNING],
    };
  }
}
