import type { OverlayState } from "./overlay-state";
import { BADGE_STRINGS, STATE_STRINGS } from "./strings";
import styles from "./Badge.module.css";

export interface BadgeProps {
  state: OverlayState;
  expanded: boolean;
  certaintyImageSrc?: string;
  onToggleExpand(): void;
  onMinimize(): void;
  onClose(): void;
}

export function Badge({ state, expanded, certaintyImageSrc, onToggleExpand, onMinimize, onClose }: BadgeProps) {
  const { label, tone } = STATE_STRINGS[state];

  return (
    <div className={`${styles.badge} ${styles[tone]}`} role="status" tabIndex={0}>
      {state === "declared_ai" && certaintyImageSrc ? (
        <img
          className={styles.certaintyMark}
          src={certaintyImageSrc}
          alt={BADGE_STRINGS.certaintyImageAlt}
        />
      ) : null}
      <span className={styles.label}>{label}</span>
      <div className={styles.actions}>
        <button
          type="button"
          aria-label={expanded ? BADGE_STRINGS.collapseLabel : BADGE_STRINGS.expandLabel}
          onClick={onToggleExpand}
        >
          {expanded ? BADGE_STRINGS.collapseIcon : BADGE_STRINGS.expandIcon}
        </button>
        <button type="button" aria-label={BADGE_STRINGS.minimizeLabel} onClick={onMinimize}>
          {BADGE_STRINGS.minimizeIcon}
        </button>
        <button type="button" aria-label={BADGE_STRINGS.closeLabel} onClick={onClose}>
          {BADGE_STRINGS.closeIcon}
        </button>
      </div>
    </div>
  );
}
