import { useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { DetectionAssessment, MessageResponse, RequestMessage, VideoContext } from "@bp/shared";
import { Badge, DetailsPanel, type OverlayState } from "@bp/ui";
import badgeCss from "@bp/ui/src/Badge.module.css?inline";
import detailsPanelCss from "@bp/ui/src/DetailsPanel.module.css?inline";
import type { TrackedVideo } from "./video-registry";
import baseCss from "./styles.css?inline";

const HOST_Z_INDEX = "2147483647";

// Concatenação, não @import: @import de um .module.css a partir de um .css
// comum não passa pela transformação de CSS Modules (perderíamos os nomes de
// classe com hash que Badge.tsx/DetailsPanel.tsx realmente usam em tempo de
// execução). Importando ?inline os próprios .module.css preservamos o hash.
const overlayCss = `${baseCss}\n${badgeCss}\n${detailsPanelCss}`;

export interface OverlayManagerDeps {
  deepAnalysisEnabled: boolean;
  sendMessage: (message: RequestMessage) => Promise<MessageResponse<unknown>>;
  getContext: (video: HTMLVideoElement) => VideoContext;
}

// Interface estrutural consumida pelo pipeline — permite dublês de teste sem
// depender da classe concreta (que tem campos privados).
export interface OverlayLike {
  show(tracked: TrackedVideo): void;
  setState(tracked: TrackedVideo, state: OverlayState, assessment?: DetectionAssessment): void;
  remove(tracked: TrackedVideo): void;
}

interface OverlayInstance {
  root: Root;
  assessment?: DetectionAssessment;
  update?: (state: OverlayState, assessment?: DetectionAssessment) => void;
}

interface OverlayRootProps {
  video: HTMLVideoElement;
  initialState: OverlayState;
  deps: OverlayManagerDeps;
  instance: OverlayInstance;
  onClose: () => void;
}

// Wrapper local: estado de UI (expandido/minimizado) e o estado de análise
// (waiting/analyzing/classificação) vivem aqui. O OverlayManager só expõe
// show/setState/remove — o resto é detalhe de renderização.
function OverlayRoot({ video, initialState, deps, instance, onClose }: OverlayRootProps) {
  const [state, setState] = useState<OverlayState>(initialState);
  const [assessment, setAssessment] = useState<DetectionAssessment | undefined>(instance.assessment);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // Reatribuído a cada render (barato) para que OverlayManager.setState sempre
  // chame a versão mais recente dos setters, sem depender de useEffect.
  instance.update = (nextState, nextAssessment) => {
    setState(nextState);
    if (nextAssessment) setAssessment(nextAssessment);
  };

  if (minimized) return null;

  function handleDeepAnalyze(): void {
    void deps.sendMessage({ kind: "DEEP_ANALYZE_REQUEST", context: deps.getContext(video) });
  }

  function handleFeedback(expected: "false_positive" | "false_negative"): void {
    if (!assessment) return;
    void deps.sendMessage({
      kind: "FEEDBACK_SUBMIT",
      feedback: {
        classification: assessment.classification,
        score: assessment.score,
        assessmentVersion: assessment.assessmentVersion,
        rulesetVersion: assessment.rulesetVersion,
        expected,
      },
    });
  }

  return (
    <>
      <Badge
        state={state}
        expanded={expanded}
        onToggleExpand={() => setExpanded((value) => !value)}
        onMinimize={() => setMinimized(true)}
        onClose={onClose}
      />
      {expanded && assessment ? (
        <DetailsPanel
          assessment={assessment}
          deepAnalysisEnabled={deps.deepAnalysisEnabled}
          onDeepAnalyze={handleDeepAnalyze}
          onFeedback={handleFeedback}
        />
      ) : null}
    </>
  );
}

function positionHost(host: HTMLElement, video: HTMLVideoElement): void {
  host.style.position = "absolute";
  host.style.top = `${video.offsetTop}px`;
  host.style.left = `${video.offsetLeft}px`;
  host.style.zIndex = HOST_Z_INDEX;
  host.style.pointerEvents = "none";
}

/**
 * Cria e atualiza o overlay (Badge + DetailsPanel) de cada vídeo dentro de um
 * Shadow DOM próprio, isolado do CSS da página hospedeira.
 */
export class OverlayManager implements OverlayLike {
  private readonly instances = new Map<HTMLElement, OverlayInstance>();

  constructor(private readonly deps: OverlayManagerDeps) {}

  /** Cria host + shadow root + React root uma única vez por vídeo. */
  show(tracked: TrackedVideo): void {
    if (tracked.overlayHost?.isConnected) return;

    const host = document.createElement("div");
    host.dataset.bpOverlay = "true";
    positionHost(host, tracked.video);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = overlayCss;
    shadow.appendChild(style);

    const container = document.createElement("div");
    container.style.pointerEvents = "auto";
    shadow.appendChild(container);

    const parent = tracked.video.offsetParent ?? document.body;
    parent.appendChild(host);

    const root = createRoot(container);
    const instance: OverlayInstance = { root };
    this.instances.set(host, instance);

    flushSync(() => {
      root.render(
        <OverlayRoot
          video={tracked.video}
          initialState={tracked.state}
          deps={this.deps}
          instance={instance}
          onClose={() => this.remove(tracked)}
        />,
      );
    });

    tracked.overlayHost = host;
  }

  /** Atualiza o estado renderizado (waiting/analyzing/classificação). */
  setState(tracked: TrackedVideo, state: OverlayState, assessment?: DetectionAssessment): void {
    tracked.state = state;
    const host = tracked.overlayHost;
    if (!host) return;

    const instance = this.instances.get(host);
    if (!instance?.update) return;

    if (assessment) instance.assessment = assessment;
    flushSync(() => instance.update?.(state, assessment));
  }

  /** Desmonta o React root e remove o host do DOM. */
  remove(tracked: TrackedVideo): void {
    const host = tracked.overlayHost;
    if (!host) return;

    const instance = this.instances.get(host);
    instance?.root.unmount();
    this.instances.delete(host);
    host.remove();
    tracked.overlayHost = undefined;
  }
}
