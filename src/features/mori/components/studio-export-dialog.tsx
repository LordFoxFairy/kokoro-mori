"use client"

import { AudioWaveform, Check, Download, FileAudio, Layers3, LoaderCircle, Music2, X } from "lucide-react"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import { createExportRequest, type MoriExportFormat, type MoriExportInput, type MoriExportSnapshot, type MoriExportStatus, type MoriMixRevision } from "@/lib/mori-api"
import { useMoriModalLayer } from "./mori-modal-isolation"
import styles from "./studio-export-dialog.module.css"

type StudioExportDialogProps = {
  versionTitle: string
  durationSeconds: number
  latestMixRevision: MoriMixRevision | null
  latestMixRevisionStatus?: "idle" | "loading" | "ready" | "unavailable"
  status: "idle" | MoriExportStatus
  activeInput: MoriExportInput | null
  selectedRange?: StudioExportRange
  snapshot: MoriExportSnapshot | null
  message: string | null
  onClose: () => void
  onReset: () => void
  onSubmit: (input: MoriExportInput) => void
}

export type StudioExportRange = {
  label: string
  startMs: number
  endMs: number
}

type ExportScopeType = "full_song" | "time_range"

export function StudioExportDialog({
  versionTitle,
  durationSeconds,
  latestMixRevision,
  latestMixRevisionStatus = "idle",
  status,
  activeInput,
  selectedRange,
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
  const sourceSelectionTouchedRef = useRef(activeInput?.source !== undefined)
  const [sourceType, setSourceType] = useState<"version" | "mix_revision">(initialSource === "mix_revision" && latestMixRevision === null ? "version" : initialSource)
  const [format, setFormat] = useState<MoriExportFormat>(activeInput?.format ?? "mp3")
  const initialScope = activeInput?.scope.type ?? "full_song"
  const [scopeType, setScopeType] = useState<ExportScopeType>(initialScope)
  const busy = status === "queued" || status === "processing"
  const readySnapshot = status === "succeeded" && snapshot?.download_url !== null && snapshot?.download_url !== undefined ? snapshot : null
  const ready = readySnapshot !== null
  const inputRange = activeInput?.scope.type === "time_range"
    ? { label: "Selected range", startMs: activeInput.scope.start_ms, endMs: activeInput.scope.end_ms }
    : undefined
  const activeRange = inputRange === undefined
    ? selectedRange
    : selectedRange?.startMs === inputRange.startMs && selectedRange.endMs === inputRange.endMs
      ? selectedRange
      : inputRange
  const canSelectRange = activeRange !== undefined && activeRange.endMs > activeRange.startMs
  useMoriModalLayer()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (latestMixRevision !== null && !sourceSelectionTouchedRef.current && activeInput?.source === undefined) setSourceType("mix_revision")
  }, [activeInput?.source, latestMixRevision])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
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
    const selectedScope = scopeType === "time_range" && activeRange !== undefined
      ? { type: "time_range" as const, start_ms: activeRange.startMs, end_ms: activeRange.endMs }
      : { type: "full_song" as const }
    const input = createExportRequest({
      source: sourceType === "mix_revision" && latestMixRevision !== null
        ? { type: "mix_revision", mixRevisionRef: latestMixRevision.mix_revision_ref }
        : { type: "version" },
      scope: selectedScope,
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
              {latestMixRevisionStatus === "loading" ? <p className={styles.fieldHint} role="status">Loading the latest saved Mix Revision…</p> : null}
              {latestMixRevisionStatus === "unavailable" ? <p className={styles.fieldHint} role="status">Saved Mix Revision is unavailable. The Open Version remains available to export.</p> : null}
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
                    onChange={() => { sourceSelectionTouchedRef.current = true; setSourceType("version") }}
                  />
                  <span className={styles.choiceIcon}><Music2 size={16} /></span>
                  <span className={styles.choiceCopy}>
                    <strong>Open version</strong>
                    <small>{versionTitle} · {formatDuration(durationSeconds)}</small>
                    <span className={styles.choiceMeta}>Base audio before saved mixer changes</span>
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
                      onChange={() => { sourceSelectionTouchedRef.current = true; setSourceType("mix_revision") }}
                    />
                    <span className={styles.choiceIcon}><Layers3 size={16} /></span>
                    <span className={styles.choiceCopy}>
                      <strong>Mix revision {latestMixRevision.revision}</strong>
                      <small>{latestMixRevision.name}</small>
                      <span className={styles.choiceMeta}>{latestMixRevision.tracks.length} saved tracks</span>
                    </span>
                    <span className={styles.choiceCheck} aria-hidden="true"><Check size={13} /></span>
                  </label>
                ) : null}
              </div>
            </fieldset>

            <div className={styles.optionsRow}>
              <fieldset className={`${styles.fieldset} ${styles.scopeFieldset}`} disabled={busy || ready}>
                <legend>Render scope</legend>
                <div className={styles.scopeOptions}>
                  <label className={`${styles.scopeChoice} ${scopeType === "full_song" ? styles.choiceActive : ""}`}>
                    <input
                      className={styles.radioInput}
                      type="radio"
                      name="export-scope"
                      value="full_song"
                      aria-label="Full song"
                      checked={scopeType === "full_song"}
                      onChange={() => setScopeType("full_song")}
                    />
                    <span className={styles.choiceIcon}><Music2 size={16} /></span>
                    <span className={styles.choiceCopy}>
                      <strong>Full song</strong>
                      <small>{versionTitle} · {formatDuration(durationSeconds)}</small>
                      <span className={styles.choiceMeta}>Render the complete timeline.</span>
                    </span>
                    <span className={styles.choiceCheck} aria-hidden="true"><Check size={13} /></span>
                  </label>

                  <label className={`${styles.scopeChoice} ${scopeType === "time_range" ? styles.choiceActive : ""} ${!canSelectRange ? styles.scopeChoiceDisabled : ""}`}>
                    <input
                      className={styles.radioInput}
                      type="radio"
                      name="export-scope"
                      value="time_range"
                      aria-label={activeRange === undefined ? "Selected range" : `Selected range · ${activeRange.label}`}
                      checked={scopeType === "time_range"}
                      disabled={!canSelectRange}
                      onChange={() => setScopeType("time_range")}
                    />
                    <span className={styles.choiceIcon}><AudioWaveform size={16} /></span>
                    <span className={styles.choiceCopy}>
                      <strong>Selected range</strong>
                      <small>{activeRange === undefined ? "Select a range in Arrangement first" : `${activeRange.label} · ${formatRangeTime(activeRange.startMs)}–${formatRangeTime(activeRange.endMs)}`}</small>
                      <span className={styles.choiceMeta}>Render only the selected timeline window.</span>
                    </span>
                    <span className={styles.choiceCheck} aria-hidden="true"><Check size={13} /></span>
                  </label>
                </div>
              </fieldset>

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
              <div><strong>{readySnapshot.scope.type === "full_song" ? "Your full song" : "Your selected range"} is ready.</strong><p>{exportSourceLabel(readySnapshot.source)} · {readySnapshot.format.toUpperCase()}</p></div>
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

function formatDuration(durationSeconds: number): string {
  const safeDuration = Math.max(0, Math.round(durationSeconds))
  const minutes = Math.floor(safeDuration / 60)
  const seconds = safeDuration % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function formatRangeTime(milliseconds: number): string {
  return formatDuration(milliseconds / 1_000)
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
