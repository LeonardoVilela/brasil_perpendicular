import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./Badge";
import { STATE_STRINGS } from "./strings";
import type { OverlayState } from "./overlay-state";

const ALL_STATES = Object.keys(STATE_STRINGS) as OverlayState[];

function noop() {}

describe("Badge", () => {
  it.each(ALL_STATES)("renderiza o rótulo do estado %s", (state) => {
    render(
      <Badge state={state} expanded={false} onToggleExpand={noop} onMinimize={noop} onClose={noop} />,
    );
    expect(screen.getByText(STATE_STRINGS[state].label)).toBeTruthy();
  });

  it("elemento raiz tem role=status e é focável por teclado", () => {
    render(
      <Badge state="waiting" expanded={false} onToggleExpand={noop} onMinimize={noop} onClose={noop} />,
    );
    const status = screen.getByRole("status");
    expect(status.tabIndex).toBe(0);
  });

  it("botão de minimizar chama onMinimize", async () => {
    const onMinimize = vi.fn();
    const user = userEvent.setup();
    render(
      <Badge state="waiting" expanded={false} onToggleExpand={noop} onMinimize={onMinimize} onClose={noop} />,
    );
    await user.click(screen.getByRole("button", { name: "Minimizar" }));
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });

  it("botão de fechar chama onClose", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Badge state="waiting" expanded={false} onToggleExpand={noop} onMinimize={noop} onClose={onClose} />,
    );
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("botão de expandir/recolher chama onToggleExpand e reflete o rótulo pelo estado expanded", async () => {
    const onToggleExpand = vi.fn();
    const user = userEvent.setup();
    render(
      <Badge state="waiting" expanded={false} onToggleExpand={onToggleExpand} onMinimize={noop} onClose={noop} />,
    );
    await user.click(screen.getByRole("button", { name: "Expandir detalhes" }));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it("mostra a marca visual somente quando há declaração confiável de IA", () => {
    const { rerender } = render(
      <Badge
        state="possibly_ai"
        expanded={false}
        certaintyImageSrc="data:image/webp;base64,teste"
        onToggleExpand={noop}
        onMinimize={noop}
        onClose={noop}
      />,
    );
    expect(screen.queryByRole("img", { name: "Conteúdo declarado como gerado por IA" })).toBeNull();

    rerender(
      <Badge
        state="declared_ai"
        expanded={false}
        certaintyImageSrc="data:image/webp;base64,teste"
        onToggleExpand={noop}
        onMinimize={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole("img", { name: "Conteúdo declarado como gerado por IA" })).toBeTruthy();
  });
});
