// Contrato da Camada 2 (docs/detection-pipeline.md §7). Qualquer detector
// visual real (ONNX, remoto, etc.) implementa esta interface; o pipeline
// nunca depende de um detector concreto.
export interface VisualDetector {
  readonly name: string;
  readonly version: string;
  readonly isMock: boolean;
  initialize(): Promise<void>;
  analyzeFrames(frames: ImageData[]): Promise<VisualDetectionResult>;
}

export interface VisualDetectionResult {
  syntheticProbability: number; // 0..1
  confidence: number; // 0..1
  modelName: string;
  modelVersion: string;
  frameResults: Array<{ timestamp: number; syntheticProbability: number }>;
  warnings: string[];
}
