import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("remove parâmetros de tracking", () => {
    expect(normalizeUrl("https://ex.com/v?utm_source=x&utm_medium=y&id=7"))
      .toBe("https://ex.com/v?id=7");
    expect(normalizeUrl("https://ex.com/v?fbclid=abc")).toBe("https://ex.com/v");
  });
  it("preserva parâmetros significativos", () => {
    expect(normalizeUrl("https://youtube.com/watch?v=abc&si=track"))
      .toBe("https://youtube.com/watch?v=abc");
  });
  it("descarta fragmento e normaliza host", () => {
    expect(normalizeUrl("https://EX.com/p#frag")).toBe("https://ex.com/p");
  });
  it("retorna entrada inalterada quando não é URL válida", () => {
    expect(normalizeUrl("não é url")).toBe("não é url");
  });
});
