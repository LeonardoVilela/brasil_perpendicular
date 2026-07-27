import { D3_MODEL_PATH } from "./model-manifest";
import type { LocalVisualResult, WorkerRequest, WorkerResponse } from "./types";

type WorkerCommand = WorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, "id">
    : never
  : never;

export class InferenceClient {
  private readonly worker: Worker;
  private readonly pending = new Map<
    number,
    { resolve: (response: WorkerResponse) => void; reject: (error: Error) => void }
  >();
  private nextId = 1;
  private initialization?: Promise<void>;

  constructor(worker?: Worker) {
    this.worker = worker ?? new Worker(chrome.runtime.getURL("inference-worker.js"));
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const request = this.pending.get(event.data.id);
      if (!request) return;
      this.pending.delete(event.data.id);
      request.resolve(event.data);
    };
    this.worker.onerror = () => {
      for (const request of this.pending.values()) request.reject(new Error("inference_worker_failed"));
      this.pending.clear();
    };
  }

  initialize(): Promise<void> {
    this.initialization ??= this.request({
      kind: "initialize",
      modelUrl: chrome.runtime.getURL(D3_MODEL_PATH),
    }).then(() => undefined);
    return this.initialization;
  }

  async analyze(frames: string[], frameFingerprint?: string): Promise<LocalVisualResult> {
    if (frames.length < 4 || frames.length > 16) throw new RangeError("frame_count_invalid");
    await this.initialize();
    const response = await this.request({ kind: "analyze", frames, frameFingerprint });
    if (!response.result) throw new Error("inference_result_missing");
    return response.result;
  }

  terminate(): void {
    this.worker.terminate();
    for (const request of this.pending.values()) request.reject(new Error("inference_worker_terminated"));
    this.pending.clear();
  }

  private request(message: WorkerCommand): Promise<Extract<WorkerResponse, { ok: true }>> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve: (response) => {
          if (response.ok) resolve(response);
          else reject(new Error(response.error));
        },
        reject,
      });
      this.worker.postMessage({ ...message, id } satisfies WorkerRequest);
    });
  }
}
