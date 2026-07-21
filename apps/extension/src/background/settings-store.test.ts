import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@bp/shared";
import { installChromeMock, uninstallChromeMock } from "../test-helpers/chrome-mock";
import { getSettings, setSettings } from "./settings-store";

beforeEach(() => {
  installChromeMock();
});

afterEach(() => {
  uninstallChromeMock();
});

describe("settings-store", () => {
  it("retorna DEFAULT_SETTINGS quando não há nada salvo", async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("setSettings grava e getSettings devolve o valor salvo", async () => {
    const custom = { ...DEFAULT_SETTINGS, devMode: true, apiUrl: "https://example.com" };
    await setSettings(custom);
    expect(await getSettings()).toEqual(custom);
  });

  it("mescla settings parciais salvos sobre DEFAULT_SETTINGS (dado legado incompleto)", async () => {
    await chrome.storage.local.set({ bpSettings: { devMode: true } });
    const settings = await getSettings();
    expect(settings.devMode).toBe(true);
    expect(settings.autoAnalyzeEnabled).toBe(DEFAULT_SETTINGS.autoAnalyzeEnabled);
    expect(settings.enabledPlatforms).toEqual(DEFAULT_SETTINGS.enabledPlatforms);
  });

  it("mescla enabledPlatforms num nível só, preservando as demais plataformas padrão", async () => {
    await chrome.storage.local.set({ bpSettings: { enabledPlatforms: { youtube: false } } });
    const settings = await getSettings();
    expect(settings.enabledPlatforms.youtube).toBe(false);
    expect(settings.enabledPlatforms.tiktok).toBe(true);
    expect(settings.enabledPlatforms.instagram).toBe(true);
  });
});
