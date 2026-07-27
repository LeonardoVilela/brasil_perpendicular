import { describe, expect, it } from "vitest";
import { createFrameFingerprint } from "./frame-fingerprint";

function gradient(offset = 0): Uint8Array {
  const pixels = new Uint8Array(9 * 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) pixels[y * 9 + x] = x * 20 + y + offset;
  }
  return pixels;
}

describe("createFrameFingerprint", () => {
  it("retorna um SHA-256 hexadecimal estável", async () => {
    const first = await createFrameFingerprint([gradient(), gradient(5)]);
    const second = await createFrameFingerprint([gradient(), gradient(5)]);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });

  it("tolera uma mudança uniforme de luminosidade", async () => {
    expect(await createFrameFingerprint([gradient()])).toBe(
      await createFrameFingerprint([gradient(10)]),
    );
  });

  it("leva a ordem temporal em conta", async () => {
    const reverse = Uint8Array.from(gradient()).reverse();
    expect(await createFrameFingerprint([gradient(), reverse])).not.toBe(
      await createFrameFingerprint([reverse, gradient()]),
    );
  });

  it("rejeita uma sequência vazia ou amostra fora de 9x8", async () => {
    await expect(createFrameFingerprint([])).rejects.toThrow(RangeError);
    await expect(createFrameFingerprint([new Uint8Array(4)])).rejects.toThrow(RangeError);
  });
});
