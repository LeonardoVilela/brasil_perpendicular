import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ASSESSMENT_VERSION, RULESET_VERSION } from "@bp/detection-core";
import type { DetectionAssessment } from "@bp/shared";
import { installChromeMock, uninstallChromeMock } from "../test-helpers/chrome-mock";
import { cacheClear, cacheGet, cachePut } from "./assessment-cache";

function makeAssessment(overrides: Partial<DetectionAssessment> = {}): DetectionAssessment {
  return {
    classification: "possibly_ai",
    score: 0.5,
    confidence: "medium",
    scamRisk: "none",
    evidence: [],
    executedAnalyses: [],
    unavailableAnalyses: [],
    limitations: [],
    analyzedAt: "2026-01-01T00:00:00.000Z",
    assessmentVersion: ASSESSMENT_VERSION,
    rulesetVersion: RULESET_VERSION,
    detectorVersions: {},
    ...overrides,
  };
}

beforeEach(() => {
  installChromeMock();
});

afterEach(() => {
  uninstallChromeMock();
  vi.useRealTimers();
});

describe("assessment-cache", () => {
  it("retorna undefined quando a chave não existe (miss)", async () => {
    expect(await cacheGet("missing")).toBeUndefined();
  });

  it("cachePut seguido de cacheGet devolve o assessment salvo (hit)", async () => {
    const assessment = makeAssessment();
    await cachePut("k1", assessment);
    expect(await cacheGet("k1")).toEqual(assessment);
  });

  it("expira depois de 7 dias (TTL)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await cachePut("k1", makeAssessment());

    vi.setSystemTime(new Date("2026-01-08T00:00:00.001Z")); // 7 dias + 1ms
    expect(await cacheGet("k1")).toBeUndefined();
  });

  it("não expira um instante antes do TTL de 7 dias", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await cachePut("k1", makeAssessment());

    vi.setSystemTime(new Date("2026-01-07T23:59:59.999Z"));
    expect(await cacheGet("k1")).toBeDefined();
  });

  it("trata assessmentVersion diferente da atual como miss", async () => {
    await cachePut("k1", makeAssessment({ assessmentVersion: "0.0.1" }));
    expect(await cacheGet("k1")).toBeUndefined();
  });

  it("trata rulesetVersion diferente da atual como miss", async () => {
    await cachePut("k1", makeAssessment({ rulesetVersion: "0.0.1" }));
    expect(await cacheGet("k1")).toBeUndefined();
  });

  it("acima de 500 entradas, remove a de lastUsedAt mais antigo (LRU)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    for (let i = 0; i < 500; i++) {
      await cachePut(`k${i}`, makeAssessment());
      vi.advanceTimersByTime(1);
    }

    await cachePut("k500", makeAssessment());

    expect(await cacheGet("k0")).toBeUndefined(); // era o menos recentemente usado
    expect(await cacheGet("k250")).toBeDefined();
    expect(await cacheGet("k500")).toBeDefined();
  });

  it("cacheClear remove todas as entradas", async () => {
    await cachePut("k1", makeAssessment());
    await cachePut("k2", makeAssessment());
    await cacheClear();
    expect(await cacheGet("k1")).toBeUndefined();
    expect(await cacheGet("k2")).toBeUndefined();
  });
});
