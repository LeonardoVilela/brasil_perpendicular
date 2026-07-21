import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DetectionAssessment } from "@bp/shared";
import { DetailsPanel } from "./DetailsPanel";
import { CONFIDENCE_STRINGS, DISCLAIMER, ORIGIN_STRINGS, PANEL_STRINGS, STATE_STRINGS } from "./strings";

function makeAssessment(overrides: Partial<DetectionAssessment> = {}): DetectionAssessment {
  return {
    classification: "possibly_ai",
    score: 0.5,
    confidence: "medium",
    scamRisk: "none",
    evidence: [
      {
        id: "ev-1",
        domain: "platform_disclosure",
        type: "platform_label",
        label: "Rótulo da plataforma",
        description: "A plataforma declarou este vídeo como gerado por IA.",
        weight: 0.8,
        confidence: 0.9,
        correlationGroup: "platform",
        origin: "platform_disclosure",
      },
    ],
    executedAnalyses: ["Verificação de rótulo da plataforma"],
    unavailableAnalyses: ["Análise visual (CORS bloqueado)"],
    limitations: ["Sem acesso a metadados de proveniência"],
    analyzedAt: "2026-07-16T00:00:00.000Z",
    assessmentVersion: "1.0.0",
    rulesetVersion: "1.0.0",
    detectorVersions: {},
    ...overrides,
  };
}

function noop() {}

describe("DetailsPanel", () => {
  it("mostra classificação, confiança e limitações do assessment", () => {
    render(
      <DetailsPanel assessment={makeAssessment()} deepAnalysisEnabled={true} onDeepAnalyze={noop} onFeedback={noop} />,
    );
    expect(screen.getByText(STATE_STRINGS.possibly_ai.label)).toBeTruthy();
    expect(screen.getByText(CONFIDENCE_STRINGS.medium)).toBeTruthy();
    expect(screen.getByText("Sem acesso a metadados de proveniência")).toBeTruthy();
  });

  it("lista os rótulos das evidências encontradas", () => {
    render(
      <DetailsPanel assessment={makeAssessment()} deepAnalysisEnabled={true} onDeepAnalyze={noop} onFeedback={noop} />,
    );
    expect(screen.getByText(PANEL_STRINGS.evidenceSection)).toBeTruthy();
    expect(screen.getByText("Rótulo da plataforma")).toBeTruthy();
    expect(
      screen.getByText(`Origem: ${ORIGIN_STRINGS.platform_disclosure}`),
    ).toBeTruthy();
  });

  it("mostra análises executadas e indisponíveis", () => {
    render(
      <DetailsPanel assessment={makeAssessment()} deepAnalysisEnabled={true} onDeepAnalyze={noop} onFeedback={noop} />,
    );
    expect(screen.getByText("Verificação de rótulo da plataforma")).toBeTruthy();
    expect(screen.getByText("Análise visual (CORS bloqueado)")).toBeTruthy();
  });

  it("exibe sempre o aviso de limitação", () => {
    render(
      <DetailsPanel assessment={makeAssessment()} deepAnalysisEnabled={true} onDeepAnalyze={noop} onFeedback={noop} />,
    );
    expect(screen.getByText(DISCLAIMER)).toBeTruthy();
  });

  it('exibe "Contexto de risco" quando scamRisk !== "none"', () => {
    render(
      <DetailsPanel
        assessment={makeAssessment({ scamRisk: "high" })}
        deepAnalysisEnabled={true}
        onDeepAnalyze={noop}
        onFeedback={noop}
      />,
    );
    expect(screen.getByText(PANEL_STRINGS.riskSection)).toBeTruthy();
  });

  it('não exibe "Contexto de risco" quando scamRisk é "none"', () => {
    render(
      <DetailsPanel
        assessment={makeAssessment({ scamRisk: "none" })}
        deepAnalysisEnabled={true}
        onDeepAnalyze={noop}
        onFeedback={noop}
      />,
    );
    expect(screen.queryByText(PANEL_STRINGS.riskSection)).toBeNull();
  });

  it("desabilita o botão de análise profunda com título explicativo quando deepAnalysisEnabled é false", () => {
    render(
      <DetailsPanel assessment={makeAssessment()} deepAnalysisEnabled={false} onDeepAnalyze={noop} onFeedback={noop} />,
    );
    const button = screen.getByRole("button", { name: PANEL_STRINGS.deepAnalyzeButton });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("title")).toBe(PANEL_STRINGS.deepAnalyzeDisabledTitle);
  });

  it("botões de feedback disparam onFeedback com o tipo correto", async () => {
    const onFeedback = vi.fn();
    const user = userEvent.setup();
    render(
      <DetailsPanel
        assessment={makeAssessment()}
        deepAnalysisEnabled={true}
        onDeepAnalyze={noop}
        onFeedback={onFeedback}
      />,
    );
    await user.click(screen.getByRole("button", { name: PANEL_STRINGS.falsePositiveButton }));
    expect(onFeedback).toHaveBeenCalledWith("false_positive");
    await user.click(screen.getByRole("button", { name: PANEL_STRINGS.falseNegativeButton }));
    expect(onFeedback).toHaveBeenCalledWith("false_negative");
  });

  describe("consentimento antes de análise profunda", () => {
    it("clicar em analisar mostra confirmação e NÃO chama onDeepAnalyze ainda", async () => {
      const onDeepAnalyze = vi.fn();
      const user = userEvent.setup();
      render(
        <DetailsPanel
          assessment={makeAssessment()}
          deepAnalysisEnabled={true}
          onDeepAnalyze={onDeepAnalyze}
          onFeedback={noop}
        />,
      );
      await user.click(screen.getByRole("button", { name: PANEL_STRINGS.deepAnalyzeButton }));
      expect(screen.getByText(PANEL_STRINGS.consentTitle)).toBeTruthy();
      expect(screen.getByText(PANEL_STRINGS.consentItemText)).toBeTruthy();
      expect(screen.getByText(PANEL_STRINGS.consentItemUrl)).toBeTruthy();
      expect(screen.getByText(PANEL_STRINGS.consentItemPlatform)).toBeTruthy();
      expect(onDeepAnalyze).not.toHaveBeenCalled();
    });

    it("cancelar a confirmação não chama onDeepAnalyze", async () => {
      const onDeepAnalyze = vi.fn();
      const user = userEvent.setup();
      render(
        <DetailsPanel
          assessment={makeAssessment()}
          deepAnalysisEnabled={true}
          onDeepAnalyze={onDeepAnalyze}
          onFeedback={noop}
        />,
      );
      await user.click(screen.getByRole("button", { name: PANEL_STRINGS.deepAnalyzeButton }));
      await user.click(screen.getByRole("button", { name: PANEL_STRINGS.consentCancelButton }));
      expect(onDeepAnalyze).not.toHaveBeenCalled();
      expect(screen.queryByText(PANEL_STRINGS.consentTitle)).toBeNull();
    });

    it("confirmar o envio chama onDeepAnalyze", async () => {
      const onDeepAnalyze = vi.fn();
      const user = userEvent.setup();
      render(
        <DetailsPanel
          assessment={makeAssessment()}
          deepAnalysisEnabled={true}
          onDeepAnalyze={onDeepAnalyze}
          onFeedback={noop}
        />,
      );
      await user.click(screen.getByRole("button", { name: PANEL_STRINGS.deepAnalyzeButton }));
      await user.click(screen.getByRole("button", { name: PANEL_STRINGS.consentSendButton }));
      expect(onDeepAnalyze).toHaveBeenCalledTimes(1);
    });
  });
});
