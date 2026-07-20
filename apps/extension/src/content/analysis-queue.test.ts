import { describe, expect, it } from "vitest";
import { AnalysisQueue } from "./analysis-queue";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("AnalysisQueue", () => {
  it("rejeita limite de concorrência menor que 1", () => {
    expect(() => new AnalysisQueue(0)).toThrow(RangeError);
  });

  it("roda no máximo maxConcurrent jobs simultaneamente (2 de 5)", () => {
    const queue = new AnalysisQueue(2);
    const started = [false, false, false, false, false];
    const defs = [deferred(), deferred(), deferred(), deferred(), deferred()];

    defs.forEach((d, i) => {
      queue.enqueue(() => {
        started[i] = true;
        return d.promise;
      });
    });

    expect(started).toEqual([true, true, false, false, false]);
    expect(queue.pending).toBe(3);
  });

  it("ao resolver um job em execução, o próximo da fila inicia", async () => {
    const queue = new AnalysisQueue(2);
    const started = [false, false, false];
    const defs = [deferred(), deferred(), deferred()];

    defs.forEach((d, i) => {
      queue.enqueue(() => {
        started[i] = true;
        return d.promise;
      });
    });

    expect(started).toEqual([true, true, false]);

    defs[0]!.resolve();
    await flushMicrotasks();

    expect(started).toEqual([true, true, true]);
    expect(queue.pending).toBe(0);
  });

  it("job que rejeita não trava a fila: o seguinte roda mesmo assim", async () => {
    const queue = new AnalysisQueue(1);
    const started = [false, false];
    const defs = [deferred(), deferred()];

    queue.enqueue(() => {
      started[0] = true;
      return defs[0]!.promise;
    });
    queue.enqueue(() => {
      started[1] = true;
      return defs[1]!.promise;
    });

    expect(started).toEqual([true, false]);

    defs[0]!.reject(new Error("boom"));
    await flushMicrotasks();

    expect(started).toEqual([true, true]);
  });

  it("pending reflete apenas jobs aguardando, não os em execução", () => {
    const queue = new AnalysisQueue(1);
    const defs = [deferred(), deferred(), deferred()];
    defs.forEach((d) => queue.enqueue(() => d.promise));

    expect(queue.pending).toBe(2);
  });

  it("não produz unhandled rejection quando um job rejeita", async () => {
    const onUnhandled = () => {
      throw new Error("unhandled rejection detectada");
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const queue = new AnalysisQueue(1);
      const d = deferred();
      queue.enqueue(() => d.promise);
      d.reject(new Error("boom"));
      await flushMicrotasks();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
