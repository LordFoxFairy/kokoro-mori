import { Check, LoaderCircle, RotateCcw } from "lucide-react"
import type { ProjectWorkspaceSaveRun } from "../project-workspace-memory"
import styles from "./studio-workspace-save-status.module.css"

type StudioWorkspaceSaveStatusProps = {
  run: ProjectWorkspaceSaveRun
  hasCurrentDraftChanges?: boolean
  onRetry: () => void
  onRefresh: () => void
}

export function StudioWorkspaceSaveStatus({ run, hasCurrentDraftChanges = false, onRetry, onRefresh }: StudioWorkspaceSaveStatusProps) {
  if (run.status === "idle") return null
  if (run.status === "saved" && hasCurrentDraftChanges) return null
  if (run.status === "saving") {
    return <span className={`${styles.status} ${styles.saving}`} aria-label="Saving Project workspace" role="status"><LoaderCircle size={13} /><span className={styles.label}>Saving</span></span>
  }
  if (run.status === "saved") {
    return <span className={`${styles.status} ${styles.saved}`} aria-label="Project workspace saved" role="status"><Check size={13} /><span className={styles.label}>Saved</span></span>
  }
  if (run.retryable) {
    return <button className={styles.retry} type="button" aria-label="Retry Project workspace save" onClick={onRetry}><RotateCcw size={13} /><span className={styles.label}>Retry save</span></button>
  }
  return <button className={styles.retry} type="button" aria-label="Refresh Project workspace" onClick={onRefresh}><RotateCcw size={13} /><span className={styles.label}>Refresh</span></button>
}
