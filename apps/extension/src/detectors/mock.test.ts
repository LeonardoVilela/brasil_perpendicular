import { describe, expect, it } from "vitest";
import { MockVisualDetector } from "./mock";

describe("MockVisualDetector", () => {
  it("lança erro se devMode for false", () => {
    expect(() => new MockVisualDetector({ devMode: false })).toThrow();
  });

  it("instancia normalmente com devMode true", () => {
    expect(() => new MockVisualDetector({ devMode: true })).not.toThrow();
  });

  it("isMock é sempre true", () => {
    const detector = new MockVisualDetector({ devMode: true });
    expect(detector.isMock).toBe(true);
  });

  it("name contém 'mock'", () => {
    const detector = new MockVisualDetector({ devMode: true });
    expect(detector.name.toLowerCase()).toContain("mock");
  });

  it("analyzeFrames retorna probabilidade fixa de 0.5, modelName 'mock-fixed' e aviso prefixado [MOCK]", async () => {
    const detector = new MockVisualDetector({ devMode: true });
    await detector.initialize();
    const result = await detector.analyzeFrames([]);

    expect(result.syntheticProbability).toBe(0.5);
    expect(result.modelName).toBe("mock-fixed");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/^\[MOCK\]/);
  });

  it("é determinístico entre chamadas, independente dos frames recebidos", async () => {
    const detector = new MockVisualDetector({ devMode: true });
    const fakeFrame = {} as ImageData;
    const first = await detector.analyzeFrames([fakeFrame, fakeFrame]);
    const second = await detector.analyzeFrames([fakeFrame]);

    expect(first.syntheticProbability).toBe(second.syntheticProbability);
    expect(first.modelName).toBe(second.modelName);
    expect(first.warnings).toEqual(second.warnings);
  });
});
