export interface CapturedFrame {
  jpegDataUrl: string;
  /** Miniatura 9x8 em escala de cinza, usada apenas para o fingerprint. */
  fingerprintPixels: Uint8Array;
}

export type FrameSampleResult =
  | {
      status: "ok";
      frames: string[];
      fingerprintSamples: Uint8Array[];
      mediaTimes: number[];
    }
  | {
      status: "unavailable";
      reason:
        | "unsupported"
        | "cancelled"
        | "source_changed"
        | "removed"
        | "timeout"
        | "capture_blocked";
    };

interface SampleOptions {
  frameCount?: number;
  sampleRateFps?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  capture?: (video: HTMLVideoElement, index: number) => CapturedFrame;
}

const MAX_SIDE = 384;
const MAX_FRAME_CHARS = 250_000;

function captureReducedFrame(video: HTMLVideoElement): CapturedFrame {
  if (video.videoWidth < 1 || video.videoHeight < 1) throw new Error("frame indisponível");

  const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("canvas indisponível");
  context.drawImage(video, 0, 0, width, height);

  let jpegDataUrl = canvas.toDataURL("image/jpeg", 0.72);
  if (jpegDataUrl.length > MAX_FRAME_CHARS) jpegDataUrl = canvas.toDataURL("image/jpeg", 0.5);
  if (jpegDataUrl.length > MAX_FRAME_CHARS) throw new Error("frame excede o limite");

  const fingerprintCanvas = document.createElement("canvas");
  fingerprintCanvas.width = 9;
  fingerprintCanvas.height = 8;
  const fingerprintContext = fingerprintCanvas.getContext("2d", { alpha: false });
  if (!fingerprintContext) throw new Error("canvas indisponível");
  fingerprintContext.drawImage(video, 0, 0, 9, 8);
  const rgba = fingerprintContext.getImageData(0, 0, 9, 8).data;
  const fingerprintPixels = new Uint8Array(72);
  for (let i = 0; i < fingerprintPixels.length; i++) {
    const offset = i * 4;
    fingerprintPixels[i] = Math.round(
      rgba[offset]! * 0.299 + rgba[offset + 1]! * 0.587 + rgba[offset + 2]! * 0.114,
    );
  }

  return { jpegDataUrl, fingerprintPixels };
}

/** Coleta frames enquanto o vídeo toca; nunca busca nem altera currentTime. */
export function sampleVideoFrames(
  video: HTMLVideoElement,
  options: SampleOptions = {},
): Promise<FrameSampleResult> {
  const frameCount = options.frameCount ?? 16;
  const sampleRateFps = options.sampleRateFps ?? 8;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const capture = options.capture ?? captureReducedFrame;
  const requestFrame = video.requestVideoFrameCallback?.bind(video);
  const cancelFrame = video.cancelVideoFrameCallback?.bind(video);

  if (!requestFrame) return Promise.resolve({ status: "unavailable", reason: "unsupported" });

  return new Promise((resolve) => {
    const source = video.currentSrc || video.src;
    const frames: string[] = [];
    const fingerprintSamples: Uint8Array[] = [];
    const mediaTimes: number[] = [];
    let callbackId: number | undefined;
    let firstMediaTime: number | undefined;
    let settled = false;

    const finish = (result: FrameSampleResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      if (callbackId !== undefined) cancelFrame?.(callbackId);
      resolve(result);
    };
    const abort = () => finish({ status: "unavailable", reason: "cancelled" });
    const timeout = setTimeout(
      () => finish({ status: "unavailable", reason: "timeout" }),
      timeoutMs,
    );

    const onFrame: VideoFrameRequestCallback = (_now, metadata) => {
      callbackId = undefined;
      if (options.signal?.aborted) return abort();
      if (!video.isConnected) return finish({ status: "unavailable", reason: "removed" });
      if ((video.currentSrc || video.src) !== source) {
        return finish({ status: "unavailable", reason: "source_changed" });
      }

      firstMediaTime ??= metadata.mediaTime;
      const nextMediaTime = firstMediaTime + frames.length / sampleRateFps;
      if (metadata.mediaTime + Number.EPSILON >= nextMediaTime) {
        try {
          const frame = capture(video, frames.length);
          frames.push(frame.jpegDataUrl);
          fingerprintSamples.push(frame.fingerprintPixels);
          mediaTimes.push(metadata.mediaTime);
        } catch {
          return finish({ status: "unavailable", reason: "capture_blocked" });
        }
      }

      if (frames.length >= frameCount) {
        return finish({ status: "ok", frames, fingerprintSamples, mediaTimes });
      }
      callbackId = requestFrame(onFrame);
    };

    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) return abort();
    callbackId = requestFrame(onFrame);
  });
}
