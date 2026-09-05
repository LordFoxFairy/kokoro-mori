import { compositionSaveLabel, type CompositionSaveState } from "../composition-save-state"
import styles from "./composition-save-indicator.module.css"

export function CompositionSaveIndicator({ state }: { state: CompositionSaveState }) {
  return <span className={styles.indicator} data-state={state} role="status" aria-live="polite">
    <i aria-hidden="true" />{compositionSaveLabel(state)}
  </span>
}
