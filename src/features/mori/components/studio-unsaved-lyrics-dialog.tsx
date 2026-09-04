"use client"

import { AlertCircle, ArrowRight, LoaderCircle, Save, X } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import type { ProjectWorkspaceSaveRun } from "../project-workspace-memory"
import styles from "./studio-unsaved-lyrics-dialog.module.css"

type StudioUnsavedLyricsDialogProps = {
  currentVersionTitle: string
  targetVersionTitle: string
  canSave: boolean
  canRefreshWorkspace: boolean
  saveRun: ProjectWorkspaceSaveRun
  onStay: () => void
  onDiscard: () => void
  onSave: () => void
  onRefresh: () => void
}

export function StudioUnsavedLyricsDialog({
  currentVersionTitle,
  targetVersionTitle,
  canSave,
  canRefreshWorkspace,
  saveRun,
  onStay,
  onDiscard,
  onSave,
  onRefresh,
}: StudioUnsavedLyricsDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const stayRef = useRef<HTMLButtonElement>(null)
  const onStayRef = useRef(onStay)
  const saving = saveRun.status === "saving"
  const needsRefresh = (saveRun.status === "failed" && !saveRun.retryable)
    || (saveRun.status === "idle" && !canSave && canRefreshWorkspace)
  const retryableFailure = saveRun.status === "failed" && saveRun.retryable

  useEffect(() => {
    onStayRef.current = onStay
  }, [onStay])

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    stayRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onStayRef.current()
        return
      }
      if (event.key !== "Tab") return
      const dialog = dialogRef.current
      if (dialog === null) return
      const focusable = getFocusableElements(dialog)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  if (typeof document === "undefined") return null

  return createPortal(
    <div className={styles.layer}>
      <button
        className={styles.backdrop}
        type="button"
        aria-label="Keep editing lyrics"
        onClick={onStay}
      />
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true">
            <AlertCircle size={19} />
          </span>
          <div>
            <span>Lyrics draft</span>
            <h2 id={titleId}>Save changes before opening another Version?</h2>
            <p id={descriptionId}>
              Your words for {currentVersionTitle} are not saved yet.{" "}
              {targetVersionTitle} will open without changing the Project’s
              Current Version.
            </p>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            aria-label="Keep editing lyrics"
            onClick={onStay}
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.choice} aria-label="Unsaved lyrics choice">
            <strong>Keep this draft attached to {currentVersionTitle}.</strong>
            <p>
              Saving creates a new revision for this Version. Opening{" "}
              {targetVersionTitle} is safe after Mori confirms it.
            </p>
          </section>
          {saveRun.status === "failed" ? (
            <div className={styles.error} role="alert">
              <AlertCircle size={15} />
              <p>
                {saveRun.message ?? "Mori could not confirm the lyrics draft."}
              </p>
            </div>
          ) : null}
          {!canSave && saveRun.status !== "failed" ? (
            <div className={styles.notice}>
              <p>
                {canRefreshWorkspace
                  ? "This Project workspace is not ready to save right now. Refresh it before saving these local changes."
                  : "This is a preview draft, not a saved Project workspace. You can keep editing or discard it before opening another take."}
              </p>
            </div>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button
            ref={stayRef}
            className={styles.stayButton}
            type="button"
            onClick={onStay}
          >
            Keep editing
          </button>
          <button
            className={styles.discardButton}
            type="button"
            disabled={saving}
            onClick={onDiscard}
          >
            Discard &amp; open
          </button>
          {needsRefresh ? (
            <button
              className={styles.saveButton}
              type="button"
              onClick={onRefresh}
            >
              Refresh workspace <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className={styles.saveButton}
              type="button"
              disabled={!canSave || saving}
              onClick={onSave}
            >
              {saving ? (
                <>
                  <LoaderCircle className={styles.spinner} size={14} /> Saving
                  lyrics
                </>
              ) : retryableFailure ? (
                <>
                  <Save size={14} /> Retry save
                </>
              ) : !canSave ? (
                <>
                  <Save size={14} /> Save unavailable
                </>
              ) : (
                <>
                  <Save size={14} /> Save &amp; open
                </>
              )}
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true")
}
