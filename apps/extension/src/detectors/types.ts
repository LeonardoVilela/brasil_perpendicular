import type { VisualDecision } from "@bp/shared";

export interface LocalVisualResult {
  detector: string;
  detectorVersion: string;
  modelSha256: string;
  backend: "webgpu" | "wasm" | "mock" | "unavailable";
  rawTemporalStd?: number;
  /** Score calibrado, ou null enquanto os thresholds não passarem pelo portão de validação. */
  syntheticScore: number | null;
  decision: VisualDecision;
  confidence: number;
  sampledFrames: number;
  usableFrames: number;
  frameFingerprint?: string;
  warnings: string[];
}

export interface VisualDetector {
  readonly name: string;
  readonly version: string;
  readonly isMock: boolean;
  initialize(): Promise<void>;
  analyzeFrames(frames: string[], frameFingerprint?: string): Promise<LocalVisualResult>;
}

export type WorkerRequest =
  | { id: number; kind: "initialize"; modelUrl: string }
  | { id: number; kind: "analyze"; frames: string[]; frameFingerprint?: string };

export type WorkerResponse =
  | { id: number; ok: true; result?: LocalVisualResult }
  | { id: number; ok: false; error: string };
