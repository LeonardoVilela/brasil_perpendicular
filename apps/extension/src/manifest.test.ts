import { describe, expect, it } from "vitest";
import manifest from "../public/manifest.json";

describe("manifest", () => {
  it("expõe a versão V3", () => {
    expect(manifest.version).toBe("0.3.0");
  });

  it("injeta o content script automaticamente em páginas HTTP e HTTPS", () => {
    expect(manifest.content_scripts[0]?.matches).toEqual(["http://*/*", "https://*/*"]);
    expect(manifest.permissions).toEqual(["storage", "activeTab", "scripting"]);
  });

  it("empacota ícones da extensão e limita a API de desenvolvimento ao localhost", () => {
    expect(manifest.icons["128"]).toBe("icons/icon-128.png");
    expect(manifest.action.default_icon["32"]).toBe("icons/icon-32.png");
    expect(manifest.host_permissions).toEqual(["http://localhost:8000/*"]);
  });
});
