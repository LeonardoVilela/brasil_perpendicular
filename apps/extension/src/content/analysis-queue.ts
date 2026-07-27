/**
 * Fila de jobs assíncronos com limite de concorrência. Um job que rejeita
 * não trava a fila: a rejeição é engolida e o próximo job inicia normalmente.
 */
export class AnalysisQueue {
  private readonly maxConcurrent: number;
  private running = 0;
  private readonly highPriorityQueue: Array<() => Promise<void>> = [];
  private readonly queue: Array<() => Promise<void>> = [];

  constructor(maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new RangeError("maxConcurrent deve ser um inteiro maior ou igual a 1");
    }
    this.maxConcurrent = maxConcurrent;
  }

  get pending(): number {
    return this.highPriorityQueue.length + this.queue.length;
  }

  enqueue(job: () => Promise<void>, priority: "high" | "normal" = "normal"): void {
    (priority === "high" ? this.highPriorityQueue : this.queue).push(job);
    this.runNext();
  }

  private runNext(): void {
    if (this.running >= this.maxConcurrent) return;
    const job = this.highPriorityQueue.shift() ?? this.queue.shift();
    if (!job) return;

    this.running++;
    job()
      .catch(() => {})
      .finally(() => {
        this.running--;
        this.runNext();
      });
  }
}
