import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_SETTINGS, type MessageResponse, type RequestMessage } from "@bp/shared";
import { installChromeMock, uninstallChromeMock, type ChromeMock } from "../test-helpers/chrome-mock";
import { Popup } from "./Popup";

let chromeMock: ChromeMock;

function mockSettingsGet(settings = DEFAULT_SETTINGS): void {
  chromeMock.runtime.sendMessage.mockImplementation(async (message: RequestMessage) => {
    if (message.kind === "SETTINGS_GET") {
      return { ok: true, data: settings } satisfies MessageResponse<unknown>;
    }
    return { ok: true, data: undefined } satisfies MessageResponse<unknown>;
  });
}

beforeEach(() => {
  chromeMock = installChromeMock();
  mockSettingsGet();
});

afterEach(() => {
  cleanup();
  uninstallChromeMock();
  vi.restoreAllMocks();
});

describe("Popup", () => {
  it("mostra o nome do produto e o estado do selo ativo", async () => {
    render(<Popup />);

    expect(screen.getByRole("heading", { name: "Brasil Perpendicular" })).toBeTruthy();
    expect(await screen.findByText("Selo ativo")).toBeTruthy();
  });

  it("mostra 'Selo oculto' quando settings.showBadge é falso", async () => {
    mockSettingsGet({ ...DEFAULT_SETTINGS, showBadge: false });

    render(<Popup />);

    expect(await screen.findByText("Selo oculto")).toBeTruthy();
  });

  it("botão de análise consulta a aba ativa e envia INJECT_CONTENT_SCRIPT com o tab id", async () => {
    chromeMock.tabs.query.mockResolvedValueOnce([{ id: 7 }]);
    render(<Popup />);
    await screen.findByText("Selo ativo");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Analisar vídeos desta página" }));

    expect(chromeMock.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    await waitFor(() =>
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        kind: "INJECT_CONTENT_SCRIPT",
        tabId: 7,
      }),
    );
    expect(await screen.findByText("Análise iniciada.")).toBeTruthy();
  });

  it("botão Configurações abre a página de opções", async () => {
    render(<Popup />);
    await screen.findByText("Selo ativo");

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Configurações" }));

    expect(chromeMock.runtime.openOptionsPage).toHaveBeenCalledTimes(1);
  });
});
