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

  it("analyzeFrames retorna score fixo de 0.5 e aviso prefixado [MOCK]", async () => {
    const detector = new MockVisualDetector({ devMode: true });
    await detector.initialize();
    const result = await detector.analyzeFrames([]);

    expect(result.syntheticScore).toBe(0.5);
    expect(result.detector).toBe("mock-fixed");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/^\[MOCK\]/);
  });

  it("é determinístico entre chamadas, independente dos frames recebidos", async () => {
    const detector = new MockVisualDetector({ devMode: true });
    const fakeFrame = "data:image/jpeg;base64,QQ==";
    const first = await detector.analyzeFrames([fakeFrame, fakeFrame]);
    const second = await detector.analyzeFrames([fakeFrame]);

    expect(first.syntheticScore).toBe(second.syntheticScore);
    expect(first.detector).toBe(second.detector);
    expect(first.warnings).toEqual(second.warnings);
  });
});
