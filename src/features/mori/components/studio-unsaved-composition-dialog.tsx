"use client"

import { AlertCircle, ArrowRight, LoaderCircle, Save, X } from "lucide-react"
import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import type { CompositionSaveState } from "../composition-save-state"
import { useMoriModalLayer } from "./mori-modal-isolation"
import styles from "./studio-unsaved-lyrics-dialog.module.css"

type StudioUnsavedCompositionDialogProps = {
  currentVersionTitle: string
  destinationLabel: string
  saveState: CompositionSaveState
  onStay: () => void
  onDiscard: () => void
  onSave: () => void
  onRefresh: () => void
}

export function StudioUnsavedCompositionDialog({ currentVersionTitle, destinationLabel, saveState, onStay, onDiscard, onSave, onRefresh }: StudioUnsavedCompositionDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const stayRef = useRef<HTMLButtonElement>(null)
  const onStayRef = useRef(onStay)
  const saving = saveState === "saving"
  const needsRefresh = saveState === "conflict"

  useMoriModalLayer()

  useEffect(() => { onStayRef.current = onStay }, [onStay])
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
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
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  if (typeof document === "undefined") return null

  return createPortal(
    <div className={styles.layer}>
      <button className={styles.backdrop} type="button" aria-label="Keep editing arrangement" onClick={onStay} />
      <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
        <header className={styles.header}>
          <span className={styles.icon} aria-hidden="true"><AlertCircle size={19} /></span>
          <div>
            <span>Arrangement draft</span>
            <h2 id={titleId}>Save changes before {destinationLabel}?</h2>
            <p id={descriptionId}>Your timeline edits for {currentVersionTitle} are not saved yet. Mori will keep the global player independent while you decide.</p>
          </div>
          <button className={styles.closeButton} type="button" aria-label="Keep editing arrangement" onClick={onStay}><X size={18} /></button>
        </header>
        <div className={styles.body}>
          <section className={styles.choice} aria-label="Unsaved arrangement choice">
            <strong>Keep this arrangement attached to {currentVersionTitle}.</strong>
            <p>Save creates a new Composition revision. Discard returns to the last owner-confirmed arrangement.</p>
          </section>
          {saveState === "failed" ? <div className={styles.error} role="alert"><AlertCircle size={15} /><p>The arrangement could not be confirmed. Your edits are still here for retry.</p></div> : null}
          {needsRefresh ? <div className={styles.notice}><p>The owner projection changed. Refresh the arrangement before saving these edits again.</p></div> : null}
        </div>
        <footer className={styles.footer}>
          <button ref={stayRef} className={styles.stayButton} type="button" onClick={onStay}>Keep editing</button>
          <button className={styles.discardButton} type="button" disabled={saving} onClick={onDiscard}>Discard &amp; continue</button>
          {needsRefresh ? <button className={styles.saveButton} type="button" onClick={onRefresh}>Refresh arrangement <ArrowRight size={14} /></button> : <button className={styles.saveButton} type="button" disabled={saving} onClick={onSave}>{saving ? <><LoaderCircle className={styles.spinner} size={14} /> Saving arrangement</> : <><Save size={14} /> {saveState === "failed" ? "Retry save" : "Save & continue"}</>}</button>}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(","))).filter((element) => element.getAttribute("aria-hidden") !== "true")
}
