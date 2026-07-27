import { describe, expect, it } from "vitest";
import { computeD3RawScore, decideLocalVisual } from "./onnx";

describe("computeD3RawScore", () => {
  it("reproduz o desvio padrão amostral das diferenças de segunda ordem do D3", () => {
    const embeddings = new Float32Array([0, 1, 3, 4]);
    expect(computeD3RawScore(embeddings, 4, 1)).toBeCloseTo(Math.sqrt(2));
  });

  it("rejeita menos de quatro frames e dimensões inconsistentes", () => {
    expect(() => computeD3RawScore(new Float32Array([0, 1, 2]), 3, 1)).toThrow(RangeError);
    expect(() => computeD3RawScore(new Float32Array([0, 1]), 4, 1)).toThrow(RangeError);
  });
});

describe("decideLocalVisual", () => {
  it("permanece incerto enquanto a calibração não foi validada", () => {
    expect(decideLocalVisual(0.8, { status: "pending" })).toEqual({
      decision: "uncertain",
      syntheticScore: null,
      confidence: 0,
      warning: "thresholds_not_validated",
    });
  });

  it("aplica thresholds validados sem chamar score de probabilidade", () => {
    const calibration = { status: "validated" as const, realLikeMax: 1, aiLikeMin: 3 };
    expect(decideLocalVisual(0.5, calibration).decision).toBe("real_like");
    expect(decideLocalVisual(2, calibration)).toMatchObject({
      decision: "uncertain",
      syntheticScore: 0.5,
    });
    expect(decideLocalVisual(4, calibration).decision).toBe("ai_like");
  });
});
