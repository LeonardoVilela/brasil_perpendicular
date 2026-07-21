import type { OverlayState } from "./overlay-state";

/**
 * Único ponto de texto voltado ao usuário. Nunca usar strings literais
 * fora deste arquivo em Badge.tsx / DetailsPanel.tsx.
 */

export type Tone = "neutral" | "warn" | "alert" | "muted";

export const STATE_STRINGS: Record<OverlayState, { label: string; tone: Tone }> = {
  waiting: { label: "Aguardando análise", tone: "neutral" },
  analyzing: { label: "Analisando…", tone: "neutral" },
  declared_ai: { label: "Declarado como IA", tone: "alert" },
  likely_ai: { label: "Provavelmente gerado por IA", tone: "alert" },
  possibly_ai: { label: "Possivelmente gerado ou manipulado por IA", tone: "warn" },
  insufficient_evidence: { label: "Sem evidências suficientes", tone: "neutral" },
  inconclusive: { label: "Análise inconclusiva", tone: "neutral" },
  error: { label: "Não foi possível analisar", tone: "muted" },
};

export const DISCLAIMER = "Este resultado indica evidências, não constitui prova definitiva.";

export const CONFIDENCE_STRINGS = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const ANALYSIS_STRINGS: Record<string, string> = {
  context_rules: "Regras de contexto",
  platform_adapter: "Metadados do post na plataforma",
  visual_model: "Modelo visual",
  provenance: "Procedência",
};

export const ORIGIN_STRINGS = {
  signed_provenance: "proveniência assinada",
  platform_disclosure: "rótulo da plataforma",
  author_statement: "declaração do autor",
  page_context: "contexto da página",
  technical_signal: "análise técnica",
} as const;

export const BADGE_STRINGS = {
  certaintyImageAlt: "Conteúdo declarado como gerado por IA",
  expandLabel: "Expandir detalhes",
  collapseLabel: "Recolher detalhes",
  minimizeLabel: "Minimizar",
  closeLabel: "Fechar",
  expandIcon: "▼",
  collapseIcon: "▲",
  minimizeIcon: "−",
  closeIcon: "×",
};

export const PANEL_STRINGS = {
  title: "Detalhes da análise",
  resultSection: "Resultado",
  classificationLabel: "Classificação:",
  confidenceLabel: "Confiança:",
  evidenceSection: "Evidências encontradas",
  evidenceOriginLabel: "Origem:",
  executedSection: "Análises executadas",
  unavailableSection: "Análises indisponíveis",
  limitationsSection: "Limitações",
  riskSection: "Contexto de risco",
  riskExplanation:
    "Este contexto indica risco de golpe associado à publicação — não é prova de conteúdo gerado por IA.",
  deepAnalyzeButton: "Analisar com mais profundidade",
  deepAnalyzeDisabledTitle: "Análise profunda desativada nas configurações.",
  falsePositiveButton: "Informar falso positivo",
  falseNegativeButton: "Informar falso negativo",
  consentTitle: "O que será enviado para análise",
  consentItemText: "Título, descrição e hashtags (truncados)",
  consentItemUrl: "URL da página, sem parâmetros de rastreamento",
  consentItemPlatform: "Plataforma",
  consentSendButton: "Enviar para análise",
  consentCancelButton: "Cancelar",
};
