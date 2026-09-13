import { compositionSaveLabel, type CompositionSaveState } from "../composition-save-state"
import styles from "./composition-save-indicator.module.css"

export function CompositionSaveIndicator({ state, label }: { state: CompositionSaveState; label?: string }) {
  return <span className={styles.indicator} data-state={state} role="status" aria-live="polite">
    <i aria-hidden="true" />{label ?? compositionSaveLabel(state)}
  </span>
}
