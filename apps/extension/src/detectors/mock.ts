import type { LocalVisualResult, VisualDetector } from "./types";

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

  async analyzeFrames(frames: string[], frameFingerprint?: string): Promise<LocalVisualResult> {
    return {
      syntheticScore: MOCK_PROBABILITY,
      confidence: MOCK_CONFIDENCE,
      detector: "mock-fixed",
      detectorVersion: this.version,
      modelSha256: "mock",
      backend: "mock",
      decision: "uncertain",
      sampledFrames: frames.length,
      usableFrames: frames.length,
      frameFingerprint,
      warnings: [MOCK_WARNING],
    };
  }
}
