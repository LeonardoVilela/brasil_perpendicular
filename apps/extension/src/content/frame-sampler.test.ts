import { describe, expect, it, vi } from "vitest";
import { sampleVideoFrames, type CapturedFrame } from "./frame-sampler";

interface FrameCallbackMetadata {
  mediaTime: number;
}

function controllableVideo(src = "https://cdn.example.com/a.mp4") {
  const video = document.createElement("video");
  video.src = src;
  document.body.append(video);
  let callback: ((now: number, metadata: FrameCallbackMetadata) => void) | undefined;
  let id = 0;
  Object.defineProperty(video, "requestVideoFrameCallback", {
    value: vi.fn((next: typeof callback) => {
      callback = next;
      return ++id;
    }),
  });
  Object.defineProperty(video, "cancelVideoFrameCallback", { value: vi.fn() });
  return {
    video,
    emit(mediaTime: number) {
      const next = callback;
      callback = undefined;
      next?.(performance.now(), { mediaTime });
    },
  };
}

function captured(index: number): CapturedFrame {
  return {
    jpegDataUrl: `data:image/jpeg;base64,${index}`,
    fingerprintPixels: new Uint8Array(72).fill(index),
  };
}

describe("sampleVideoFrames", () => {
  it("coleta 16 frames por mediaTime sem alterar currentTime", async () => {
    const controlled = controllableVideo();
    const initialTime = controlled.video.currentTime;
    const capture = vi.fn((_video, index: number) => captured(index));
    const resultPromise = sampleVideoFrames(controlled.video, { capture, timeoutMs: 1_000 });

    for (let i = 0; i < 16; i++) controlled.emit(i / 8);
    const result = await resultPromise;

    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.frames).toHaveLength(16);
      expect(result.mediaTimes.at(-1)).toBeCloseTo(15 / 8);
    }
    expect(controlled.video.currentTime).toBe(initialTime);
  });

  it("ignora callbacks antes do próximo intervalo de 1/8 s", async () => {
    const controlled = controllableVideo();
    const capture = vi.fn((_video, index: number) => captured(index));
    const resultPromise = sampleVideoFrames(controlled.video, { capture, frameCount: 2, timeoutMs: 1_000 });

    controlled.emit(0);
    controlled.emit(0.05);
    controlled.emit(0.125);
    const result = await resultPromise;

    expect(result.status).toBe("ok");
    expect(capture).toHaveBeenCalledTimes(2);
  });

  it("cancela se o src muda durante a coleta", async () => {
    const controlled = controllableVideo();
    const resultPromise = sampleVideoFrames(controlled.video, {
      capture: (_video, index) => captured(index),
      timeoutMs: 1_000,
    });

    controlled.emit(0);
    controlled.video.src = "https://cdn.example.com/b.mp4";
    controlled.emit(0.125);

    await expect(resultPromise).resolves.toEqual({ status: "unavailable", reason: "source_changed" });
  });

  it("retorna indisponível em canvas contaminado sem expor pixels no erro", async () => {
    const controlled = controllableVideo();
    const resultPromise = sampleVideoFrames(controlled.video, {
      capture: () => {
        throw new DOMException("canvas blocked", "SecurityError");
      },
      timeoutMs: 1_000,
    });
    controlled.emit(0);
    await expect(resultPromise).resolves.toEqual({ status: "unavailable", reason: "capture_blocked" });
  });

  it("respeita AbortSignal e cancela o callback pendente", async () => {
    const controlled = controllableVideo();
    const controller = new AbortController();
    const resultPromise = sampleVideoFrames(controlled.video, {
      capture: (_video, index) => captured(index),
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    controller.abort();

    await expect(resultPromise).resolves.toEqual({ status: "unavailable", reason: "cancelled" });
    expect(controlled.video.cancelVideoFrameCallback).toHaveBeenCalled();
  });
});
