import { D3_MODEL_CARD, type D3Calibration } from "./model-manifest";
import { InferenceClient } from "./inference-client";
import type { LocalVisualResult, VisualDetector } from "./types";

export function computeD3RawScore(
  embeddings: Float32Array,
  frameCount: number,
  embeddingSize: number,
): number {
  if (frameCount < 4 || embeddingSize < 1 || embeddings.length !== frameCount * embeddingSize) {
    throw new RangeError("embeddings D3 inválidos");
  }

  const firstOrder: number[] = [];
  for (let frame = 1; frame < frameCount; frame++) {
    let squaredDistance = 0;
    const previous = (frame - 1) * embeddingSize;
    const current = frame * embeddingSize;
    for (let feature = 0; feature < embeddingSize; feature++) {
      const delta = embeddings[current + feature]! - embeddings[previous + feature]!;
      squaredDistance += delta * delta;
    }
    firstOrder.push(Math.sqrt(squaredDistance));
  }

  const secondOrder = firstOrder.slice(1).map((distance, index) => distance - firstOrder[index]!);
  const mean = secondOrder.reduce((sum, value) => sum + value, 0) / secondOrder.length;
  const variance =
    secondOrder.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    (secondOrder.length - 1);
  return Math.sqrt(variance);
}

export function decideLocalVisual(rawScore: number, calibration: D3Calibration) {
  if (calibration.status !== "validated") {
    return {
      decision: "uncertain" as const,
      syntheticScore: null,
      confidence: 0,
      warning: "thresholds_not_validated" as const,
    };
  }
  if (calibration.aiLikeMin <= calibration.realLikeMax) {
    throw new RangeError("thresholds D3 inválidos");
  }

  const syntheticScore = Math.min(
    1,
    Math.max(
      0,
      (rawScore - calibration.realLikeMax) /
        (calibration.aiLikeMin - calibration.realLikeMax),
    ),
  );
  const decision =
    rawScore <= calibration.realLikeMax
      ? ("real_like" as const)
      : rawScore >= calibration.aiLikeMin
        ? ("ai_like" as const)
        : ("uncertain" as const);
  return {
    decision,
    syntheticScore,
    confidence: Math.abs(syntheticScore - 0.5) * 2,
  };
}

function unavailable(frames: number, frameFingerprint: string | undefined, warning: string): LocalVisualResult {
  return {
    detector: "d3-mobilenetv3",
    detectorVersion: D3_MODEL_CARD.version,
    modelSha256: D3_MODEL_CARD.source.encoderSha256,
    backend: "unavailable",
    syntheticScore: null,
    decision: "unavailable",
    confidence: 0,
    sampledFrames: frames,
    usableFrames: 0,
    frameFingerprint,
    warnings: [warning],
  };
}

export class OnnxVisualDetector implements VisualDetector {
  readonly name = "d3-mobilenetv3";
  readonly version = D3_MODEL_CARD.version;
  readonly isMock = false;
  private initializationError?: string;
  private client?: InferenceClient;

  constructor(client?: InferenceClient) {
    this.client = client;
  }

  private getClient(): InferenceClient {
    this.client ??= new InferenceClient();
    return this.client;
  }

  async initialize(): Promise<void> {
    try {
      await this.getClient().initialize();
    } catch (error) {
      this.initializationError = error instanceof Error ? error.message : "model_initialization_failed";
    }
  }

  async analyzeFrames(frames: string[], frameFingerprint?: string): Promise<LocalVisualResult> {
    if (this.initializationError) return unavailable(frames.length, frameFingerprint, this.initializationError);
    try {
      await this.getClient().initialize();
      return await this.getClient().analyze(frames, frameFingerprint);
    } catch (error) {
      return unavailable(
        frames.length,
        frameFingerprint,
        error instanceof Error ? error.message : "model_inference_failed",
      );
    }
  }
}
