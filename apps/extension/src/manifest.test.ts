import { describe, expect, it } from "vitest";
import manifest from "../public/manifest.json";

describe("manifest", () => {
  it("expõe a versão V2", () => {
    expect(manifest.version).toBe("0.2.0");
  });

  it("injeta o content script automaticamente em páginas HTTP e HTTPS", () => {
    expect(manifest.content_scripts[0]?.matches).toEqual(["http://*/*", "https://*/*"]);
    expect(manifest.permissions).toEqual(["storage", "activeTab", "scripting"]);
  });
});
