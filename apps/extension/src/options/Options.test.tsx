import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SETTINGS, type MessageResponse, type RequestMessage } from "@bp/shared";
import { installChromeMock, uninstallChromeMock, type ChromeMock } from "../test-helpers/chrome-mock";
import { Options } from "./Options";

let chromeMock: ChromeMock;

/** Faz SETTINGS_GET responder `settings`; qualquer outra mensagem responde ok:true. */
function mockSettingsGet(settings = DEFAULT_SETTINGS): void {
  chromeMock.runtime.sendMessage.mockImplementation(async (message: RequestMessage) => {
    if (message.kind === "SETTINGS_GET") {
      return { ok: true, data: settings } satisfies MessageResponse<unknown>;
    }
    return { ok: true, data: undefined } satisfies MessageResponse<unknown>;
  });
}

function inputValue(label: string): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}

function isChecked(label: string): boolean {
  return (screen.getByLabelText(label) as HTMLInputElement).checked;
}

beforeEach(() => {
  chromeMock = installChromeMock();
});

afterEach(() => {
  cleanup();
  uninstallChromeMock();
  vi.restoreAllMocks();
});

describe("Options", () => {
  it("renderiza todos os campos de Settings com os valores atuais", async () => {
    const custom = {
      ...DEFAULT_SETTINGS,
      autoAnalyzeEnabled: false,
      deepAnalysisEnabled: true,
      automaticDeepVisualAnalysisEnabled: true,
      minVisibleMs: 3000,
      maxConcurrentAnalyses: 5,
      enabledPlatforms: {
        youtube: false,
        tiktok: true,
        instagram: false,
        twitter: true,
        generic: false,
      },
      showBadge: false,
      devMode: true,
      apiUrl: "https://api.exemplo.com",
    };
    mockSettingsGet(custom);

    render(<Options />);

    await waitFor(() => expect(inputValue("URL da API")).toBe("https://api.exemplo.com"));

    expect(isChecked("Análise automática local")).toBe(false);
    expect(isChecked("Análise profunda no servidor")).toBe(true);
    expect(isChecked("Análise visual automática no servidor")).toBe(true);
    expect(inputValue("Tempo mínimo de visibilidade (segundos)")).toBe("3");
    expect(inputValue("Máximo de análises simultâneas")).toBe("5");
    expect(isChecked("YouTube")).toBe(false);
    expect(isChecked("TikTok")).toBe(true);
    expect(isChecked("Instagram")).toBe(false);
    expect(isChecked("X/Twitter")).toBe(true);
    expect(isChecked("Páginas genéricas")).toBe(false);
    expect(isChecked("Mostrar selo")).toBe(false);
    expect(isChecked("Modo desenvolvedor")).toBe(true);
  });

  it("mostra um aviso de privacidade perto da análise profunda", async () => {
    mockSettingsGet();
    render(<Options />);

    await waitFor(() => expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ kind: "SETTINGS_GET" }));
    expect(screen.getByText(/envia o contexto do vídeo/i)).toBeTruthy();
    expect(screen.getByText(/até 16 frames reduzidos/i)).toBeTruthy();
    expect(screen.queryByLabelText("URL da API")).toBeNull();
    expect(screen.getByText(/API oficial é definida pelo pacote/i)).toBeTruthy();
  });

  it("Salvar envia SETTINGS_SET com o objeto Settings atualizado", async () => {
    mockSettingsGet();
    render(<Options />);

    await waitFor(() => expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ kind: "SETTINGS_GET" }));

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Modo desenvolvedor"));
    expect(inputValue("URL da API")).toBe(DEFAULT_SETTINGS.apiUrl);
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        kind: "SETTINGS_SET",
        settings: { ...DEFAULT_SETTINGS, devMode: true },
      }),
    );
    expect(await screen.findByText("Configurações salvas.")).toBeTruthy();
  });

  it("converte o tempo mínimo de visibilidade de segundos para milissegundos ao salvar", async () => {
    mockSettingsGet();
    render(<Options />);

    await waitFor(() => expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ kind: "SETTINGS_GET" }));

    const user = userEvent.setup();
    const input = screen.getByLabelText("Tempo mínimo de visibilidade (segundos)");
    await user.clear(input);
    await user.type(input, "4");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        kind: "SETTINGS_SET",
        settings: { ...DEFAULT_SETTINGS, minVisibleMs: 4000 },
      }),
    );
  });

  it("Limpar cache envia CACHE_CLEAR e mostra confirmação", async () => {
    mockSettingsGet();
    render(<Options />);

    await waitFor(() => expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ kind: "SETTINGS_GET" }));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Limpar cache" }));

    await waitFor(() =>
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({ kind: "CACHE_CLEAR" }),
    );
    expect(await screen.findByText("Cache limpo.")).toBeTruthy();
  });
});
