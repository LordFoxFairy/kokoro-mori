"use client"

import { Check, Download, FileAudio, Layers3, LoaderCircle, Music2, X } from "lucide-react"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { createExportRequest, type MoriExportFormat, type MoriExportInput, type MoriExportSnapshot, type MoriExportStatus, type MoriMixRevision } from "@/lib/mori-api"
import styles from "./studio-export-dialog.module.css"

type StudioExportDialogProps = {
  versionRef: string
  versionTitle: string
  latestMixRevision: MoriMixRevision | null
  status: "idle" | MoriExportStatus
  activeInput: MoriExportInput | null
  snapshot: MoriExportSnapshot | null
  message: string | null
  onClose: () => void
  onReset: () => void
  onSubmit: (input: MoriExportInput) => void
}

export function StudioExportDialog({
  versionRef,
  versionTitle,
  latestMixRevision,
  status,
  activeInput,
  snapshot,
  message,
  onClose,
  onReset,
  onSubmit,
}: StudioExportDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const initialSource = activeInput?.source.type ?? (latestMixRevision === null ? "version" : "mix_revision")
  const sourceRef = useRef<HTMLInputElement>(null)
  const [sourceType, setSourceType] = useState<"version" | "mix_revision">(initialSource)
  const [format, setFormat] = useState<MoriExportFormat>(activeInput?.format ?? "mp3")
  const busy = status === "queued" || status === "processing"
  const readySnapshot = status === "succeeded" && snapshot?.download_url !== null && snapshot?.download_url !== undefined ? snapshot : null
  const ready = readySnapshot !== null

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    sourceRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCloseRef.current()
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

  useEffect(() => {
    if (status === "idle") return
    const dialog = dialogRef.current
    const activeElement = document.activeElement
    if (
      dialog !== null
      && (
        !(activeElement instanceof HTMLElement)
        || !dialog.contains(activeElement)
        || activeElement.matches(":disabled")
      )
    ) dialog.focus()
  }, [status])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || ready) return
    const input = createExportRequest({
      source: sourceType === "mix_revision" && latestMixRevision !== null
        ? { type: "mix_revision", mixRevisionRef: latestMixRevision.mix_revision_ref }
        : { type: "version" },
      scope: { type: "full_song" },
      format,
    })
    onSubmit(input)
  }

  const activeFormat = activeInput?.format ?? format
  if (typeof document === "undefined") return null

  return createPortal(
    <div className={styles.layer}>
      <button className={styles.backdrop} type="button" aria-label="Dismiss export" onClick={onClose} />
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
          <div className={styles.headerIcon} aria-hidden="true"><FileAudio size={19} /></div>
          <div className={styles.headerCopy}>
            <span>Studio export</span>
            <h2 id={titleId}>Export {versionTitle}</h2>
            <p id={descriptionId}>Choose what Mori should render. Your Version and saved Mix stay unchanged.</p>
          </div>
          <button className={styles.closeButton} type="button" aria-label="Close export" onClick={onClose}><X size={18} /></button>
        </header>

        <form onSubmit={submit}>
          <div className={styles.body}>
            <fieldset className={styles.fieldset} disabled={busy || ready}>
              <legend>Render source</legend>
              <p className={styles.fieldHint}>Start from the Version itself or include your latest saved mixer choices.</p>
              <div className={styles.sourceList}>
                <label className={`${styles.sourceChoice} ${sourceType === "version" ? styles.choiceActive : ""}`}>
                  <input
                    ref={sourceType === "version" ? sourceRef : undefined}
                    className={styles.radioInput}
                    type="radio"
                    name="export-source"
                    value="version"
                    aria-label="Open version"
                    checked={sourceType === "version"}
                    onChange={() => setSourceType("version")}
                  />
                  <span className={styles.choiceIcon}><Music2 size={16} /></span>
                  <span className={styles.choiceCopy}>
                    <strong>Open version</strong>
                    <small>Audio from the Version open in Studio · no saved mixer changes</small>
                    <code>{versionRef}</code>
                  </span>
                  <span className={styles.choiceCheck} aria-hidden="true"><Check size={13} /></span>
                </label>

                {latestMixRevision !== null ? (
                  <label className={`${styles.sourceChoice} ${sourceType === "mix_revision" ? styles.choiceActive : ""}`}>
                    <input
                      ref={sourceType === "mix_revision" ? sourceRef : undefined}
                      className={styles.radioInput}
                      type="radio"
                      name="export-source"
                      value="mix_revision"
                      aria-label={`Mix revision ${latestMixRevision.revision} — ${latestMixRevision.name}`}
                      checked={sourceType === "mix_revision"}
                      onChange={() => setSourceType("mix_revision")}
                    />
                    <span className={styles.choiceIcon}><Layers3 size={16} /></span>
                    <span className={styles.choiceCopy}>
                      <strong>Mix revision {latestMixRevision.revision}</strong>
                      <small>{latestMixRevision.name}</small>
                      <code>{latestMixRevision.tracks.length} saved tracks</code>
                    </span>
                    <span className={styles.choiceCheck} aria-hidden="true"><Check size={13} /></span>
                  </label>
                ) : null}
              </div>
            </fieldset>

            <div className={styles.optionsRow}>
              <section className={styles.scopeCard} aria-label="Export scope">
                <span className={styles.optionLabel}>Scope</span>
                <div><Music2 size={15} /><strong>Full song</strong></div>
                <p>Render the complete timeline as one mastered file.</p>
              </section>

              <fieldset className={`${styles.fieldset} ${styles.formatFieldset}`} disabled={busy || ready}>
                <legend>Format</legend>
                <div className={styles.formatOptions}>
                  {(["mp3", "wav"] as const).map((value) => (
                    <label className={`${styles.formatChoice} ${format === value ? styles.formatChoiceActive : ""}`} key={value}>
                      <input className={styles.radioInput} type="radio" name="export-format" value={value} aria-label={value.toUpperCase()} checked={format === value} onChange={() => setFormat(value)} />
                      <strong>{value.toUpperCase()}</strong>
                      <small>{value === "mp3" ? "Compact · easy to share" : "Lossless · best for editing"}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          {status === "queued" || status === "processing" ? (
            <div className={styles.runState} role="status" aria-live="polite">
              <span className={styles.spinner}><LoaderCircle size={17} /></span>
              <div>
                <strong>{status === "queued" ? `Waiting to render ${activeFormat.toUpperCase()}` : `Rendering ${activeFormat.toUpperCase()}`}</strong>
                <p>{message ?? "You can close this window. Mori will keep the render moving."}</p>
              </div>
            </div>
          ) : null}

          {status === "failed" && message !== null ? <div className={styles.errorState} role="alert"><strong>Export needs another try</strong><p>{message}</p></div> : null}

          {readySnapshot !== null ? (
            <div className={styles.readyState} role="status">
              <span className={styles.readyIcon}><Check size={17} /></span>
              <div><strong>Your full song is ready.</strong><p>{exportSourceLabel(readySnapshot.source)} · {readySnapshot.format.toUpperCase()}</p></div>
            </div>
          ) : null}

          <footer className={styles.footer}>
            <p>Every export is a new render. Your source Version and Mix Revision remain editable.</p>
            <div className={styles.actions}>
              <button className={styles.secondaryButton} type="button" onClick={ready ? onReset : onClose}>{ready ? "New export" : busy ? "Close" : "Cancel"}</button>
              {readySnapshot !== null ? (
                <a className={styles.primaryButton} href={readySnapshot.download_url ?? undefined} download aria-label={`Download ${readySnapshot.format.toUpperCase()}`}><Download size={15} /> Download {readySnapshot.format.toUpperCase()}</a>
              ) : (
                <button className={styles.primaryButton} type="submit" disabled={busy}>
                  {busy ? <><LoaderCircle className={styles.buttonSpinner} size={15} /> Exporting…</> : status === "failed" ? <><FileAudio size={15} /> Retry export</> : <><FileAudio size={15} /> Start export</>}
                </button>
              )}
            </div>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  )
}

function exportSourceLabel(source: MoriExportInput["source"]): string {
  return source.type === "version" ? "Open version" : "Saved Mix Revision"
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(","))).filter((element) => !element.hidden)
}
