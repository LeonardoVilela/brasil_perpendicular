import { useState } from "react";
import type { DetectionAssessment } from "@bp/shared";
import { DISCLAIMER, PANEL_STRINGS } from "./strings";
import styles from "./DetailsPanel.module.css";

export interface DetailsPanelProps {
  assessment: DetectionAssessment;
  deepAnalysisEnabled: boolean;
  onDeepAnalyze(): void;
  onFeedback(expected: "false_positive" | "false_negative"): void;
}

export function DetailsPanel({
  assessment,
  deepAnalysisEnabled,
  onDeepAnalyze,
  onFeedback,
}: DetailsPanelProps) {
  const [confirmingDeepAnalysis, setConfirmingDeepAnalysis] = useState(false);

  function handleConfirm() {
    setConfirmingDeepAnalysis(false);
    onDeepAnalyze();
  }

  return (
    <section className={styles.panel}>
      <h2>{PANEL_STRINGS.title}</h2>

      <section>
        <h3>{PANEL_STRINGS.evidenceSection}</h3>
        <ul>
          {assessment.evidence.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong>: {item.description}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>{PANEL_STRINGS.executedSection}</h3>
        <ul>
          {assessment.executedAnalyses.map((analysis) => (
            <li key={analysis}>{analysis}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>{PANEL_STRINGS.unavailableSection}</h3>
        <ul>
          {assessment.unavailableAnalyses.map((analysis) => (
            <li key={analysis}>{analysis}</li>
          ))}
        </ul>
      </section>

      {assessment.scamRisk !== "none" && (
        <section className={styles.risk}>
          <h3>{PANEL_STRINGS.riskSection}</h3>
          <p>{PANEL_STRINGS.riskExplanation}</p>
        </section>
      )}

      <p className={styles.disclaimer}>{DISCLAIMER}</p>

      {confirmingDeepAnalysis ? (
        <div className={styles.consent}>
          <p>{PANEL_STRINGS.consentTitle}</p>
          <ul>
            <li>{PANEL_STRINGS.consentItemText}</li>
            <li>{PANEL_STRINGS.consentItemUrl}</li>
            <li>{PANEL_STRINGS.consentItemPlatform}</li>
          </ul>
          <div>
            <button type="button" onClick={handleConfirm}>
              {PANEL_STRINGS.consentSendButton}
            </button>
            <button type="button" onClick={() => setConfirmingDeepAnalysis(false)}>
              {PANEL_STRINGS.consentCancelButton}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={!deepAnalysisEnabled}
          title={deepAnalysisEnabled ? undefined : PANEL_STRINGS.deepAnalyzeDisabledTitle}
          onClick={() => setConfirmingDeepAnalysis(true)}
        >
          {PANEL_STRINGS.deepAnalyzeButton}
        </button>
      )}

      <div className={styles.feedback}>
        <button type="button" onClick={() => onFeedback("false_positive")}>
          {PANEL_STRINGS.falsePositiveButton}
        </button>
        <button type="button" onClick={() => onFeedback("false_negative")}>
          {PANEL_STRINGS.falseNegativeButton}
        </button>
      </div>
    </section>
  );
}
