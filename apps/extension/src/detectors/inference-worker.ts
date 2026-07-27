import * as ort from "onnxruntime-web/webgpu";
import { computeD3RawScore, decideLocalVisual } from "./onnx";
import { D3_MODEL_CARD, type D3Calibration } from "./model-manifest";
import type { LocalVisualResult, WorkerRequest, WorkerResponse } from "./types";

type SessionInfo = {
  session: ort.InferenceSession;
  backend: "webgpu" | "wasm";
  warnings: string[];
};

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

let sessionPromise: Promise<SessionInfo> | undefined;

async function createSession(modelUrl: string): Promise<SessionInfo> {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = new URL(".", location.href).href;
  if ("gpu" in navigator) {
    try {
      return {
        session: await ort.InferenceSession.create(modelUrl, {
          executionProviders: ["webgpu"],
          graphOptimizationLevel: "all",
        }),
        backend: "webgpu",
        warnings: [],
      };
    } catch {
      // WASM é o fallback explícito e continua fora da thread principal.
    }
  }
  return {
    session: await ort.InferenceSession.create(modelUrl, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    }),
    backend: "wasm",
    warnings: ["webgpu_unavailable"],
  };
}

async function framesToTensor(frames: string[]): Promise<ort.Tensor> {
  const size = D3_MODEL_CARD.input.crop;
  const plane = size * size;
  const values = new Float32Array(frames.length * 3 * plane);

  for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
    const frame = frames[frameIndex]!;
    if (!frame.startsWith("data:image/jpeg;base64,")) throw new Error("invalid_frame_mime");
    const bitmap = await createImageBitmap(await (await fetch(frame)).blob());
    try {
      const canvas = new OffscreenCanvas(size, size);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("offscreen_canvas_unavailable");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      const cropSide = Math.min(bitmap.width, bitmap.height) * (size / D3_MODEL_CARD.input.resizeShortSide);
      const sourceX = (bitmap.width - cropSide) / 2;
      const sourceY = (bitmap.height - cropSide) / 2;
      context.drawImage(bitmap, sourceX, sourceY, cropSide, cropSide, 0, 0, size, size);
      const rgba = context.getImageData(0, 0, size, size).data;
      for (let pixel = 0; pixel < plane; pixel++) {
        const source = pixel * 4;
        for (let channel = 0; channel < 3; channel++) {
          const destination = frameIndex * 3 * plane + channel * plane + pixel;
          values[destination] =
            (rgba[source + channel]! / 255 - D3_MODEL_CARD.input.mean[channel]!) /
            D3_MODEL_CARD.input.std[channel]!;
        }
      }
    } finally {
      bitmap.close();
    }
  }

  return new ort.Tensor("float32", values, [frames.length, 3, size, size]);
}

async function analyze(
  info: SessionInfo,
  frames: string[],
  frameFingerprint?: string,
): Promise<LocalVisualResult> {
  const input = await framesToTensor(frames);
  let output: ort.Tensor | undefined;
  try {
    const results = await info.session.run({ input }, [D3_MODEL_CARD.output.name]);
    output = results[D3_MODEL_CARD.output.name];
    if (!output || !(output.data instanceof Float32Array)) throw new Error("embedding_missing");
    const rawTemporalStd = computeD3RawScore(
      output.data,
      frames.length,
      D3_MODEL_CARD.output.dimensions,
    );
    const calibrated = decideLocalVisual(
      rawTemporalStd,
      D3_MODEL_CARD.calibration as D3Calibration,
    );
    return {
      detector: "d3-mobilenetv3",
      detectorVersion: D3_MODEL_CARD.version,
      modelSha256: D3_MODEL_CARD.source.encoderSha256,
      backend: info.backend,
      rawTemporalStd,
      syntheticScore: calibrated.syntheticScore,
      decision: calibrated.decision,
      confidence: calibrated.confidence,
      sampledFrames: frames.length,
      usableFrames: frames.length,
      frameFingerprint,
      warnings: [
        ...info.warnings,
        ...(calibrated.warning ? [calibrated.warning] : []),
      ],
    };
  } finally {
    output?.dispose();
    input.dispose();
  }
}

async function handle(message: WorkerRequest): Promise<void> {
  try {
    if (message.kind === "initialize") {
      sessionPromise ??= createSession(message.modelUrl);
      await sessionPromise;
      scope.postMessage({ id: message.id, ok: true });
      return;
    }
    if (!sessionPromise) throw new Error("model_not_initialized");
    const result = await analyze(await sessionPromise, message.frames, message.frameFingerprint);
    scope.postMessage({ id: message.id, ok: true, result });
  } catch (error) {
    scope.postMessage({
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : "inference_failed",
    });
  }
}

let queue = Promise.resolve();
scope.onmessage = (event) => {
  queue = queue.then(() => handle(event.data));
};
