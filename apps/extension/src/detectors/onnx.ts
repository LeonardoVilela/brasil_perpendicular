import type { VisualDetectionResult, VisualDetector } from "./types";

const NOT_AVAILABLE_MESSAGE = "OnnxVisualDetector: modelo local ainda não disponível";

/**
 * Stub do detector visual real (ONNX Runtime Web, Fase 3). Nunca fabrica um
 * resultado: initialize() rejeita até o modelo quantizado estar disponível
 * nos assets da extensão.
 */
export class OnnxVisualDetector implements VisualDetector {
  readonly name = "onnx-visual-detector";
  readonly version = "0.0.0";
  readonly isMock = false;

  async initialize(): Promise<void> {
    throw new Error(NOT_AVAILABLE_MESSAGE);
  }

  async analyzeFrames(): Promise<VisualDetectionResult> {
    throw new Error(NOT_AVAILABLE_MESSAGE);
  }
}
