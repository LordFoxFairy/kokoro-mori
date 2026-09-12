"use client"

import { AudioWaveform, Check, Layers3, LoaderCircle, Music2, Pencil, RotateCcw, Sparkles, Square, X } from "lucide-react"
import { useEffect, useId, useRef, useState, type FormEvent } from "react"
import { createPortal } from "react-dom"
import type { MoriMixRevision, MoriStudioRemasterSource, StudioRemasterStrength } from "@/lib/mori-api"
import { buildStudioRemasterPlan, isStudioRemasterPlan, type StudioRemasterPlan } from "../studio-remaster"
import { isActiveStudioChangeStatus } from "../studio-change"
import type { StudioFinishView } from "../studio-release"
import type { StudioAiRunState } from "./studio-ai-composer"
import { StudioReleasePanel, type StudioReleasePanelProps } from "./studio-release-panel"
import styles from "./studio-finish-dialog.module.css"

type StudioFinishDialogProps = {
  versionTitle: string
  durationSeconds: number
  latestMixRevision: MoriMixRevision | null
  latestMixRevisionStatus?: "idle" | "loading" | "ready" | "unavailable"
  run: StudioAiRunState
  view?: StudioFinishView
  onViewChange?: (view: StudioFinishView) => void
  release?: StudioReleasePanelProps
  onClose: () => void
  onReset: () => void
  onSubmit: (plan: StudioRemasterPlan) => void
  onCancel: () => void
  onReviewTakes: () => void
}

const strengthOptions: readonly {
  id: StudioRemasterStrength
  label: string
  description: string
  bars: number[]
}[] = [
  { id: "subtle", label: "Subtle", description: "Closest match · cleaner balance", bars: [8, 13, 10, 15, 9] },
  { id: "balanced", label: "Balanced", description: "Polished · gentle tonal lift", bars: [9, 17, 12, 20, 11] },
  { id: "bold", label: "Bold", description: "More impact · audible variation", bars: [11, 21, 14, 24, 13] },
]

export function StudioFinishDialog({
  versionTitle,
  durationSeconds,
  latestMixRevision,
  latestMixRevisionStatus = "idle",
  run,
  view = "remaster",
  onViewChange,
  release,
  onClose,
  onReset,
  onSubmit,
  onCancel,
  onReviewTakes,
}: StudioFinishDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const remasterTabId = useId()
  const remasterPanelId = useId()
  const releaseTabId = useId()
  const releasePanelId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const sourceRef = useRef<HTMLInputElement>(null)
  const remasterTabRef = useRef<HTMLButtonElement>(null)
  const releaseTabRef = useRef<HTMLButtonElement>(null)
  const initialViewRef = useRef(view)
  const initialHasReleaseRef = useRef(release !== undefined)
  const onCloseRef = useRef(onClose)
  const runPlan = isStudioRemasterPlan(run.plan) ? run.plan : null
  const sourceSelectionTouchedRef = useRef(runPlan !== null)
  const initialSource = runPlan?.source.type ?? (latestMixRevision === null ? "version" : "mix_revision")
  const [sourceType, setSourceType] = useState<"version" | "mix_revision">(initialSource === "mix_revision" && latestMixRevision === null ? "version" : initialSource)
  const [variationStrength, setVariationStrength] = useState<StudioRemasterStrength>(runPlan?.variationStrength ?? "balanced")
  const [reviewedPlan, setReviewedPlan] = useState<StudioRemasterPlan | null>(null)
  const visiblePlan = runPlan ?? reviewedPlan
  const busy = runPlan !== null && isActiveStudioChangeStatus(run.status)
  const blockedByOtherChange = runPlan === null && isActiveStudioChangeStatus(run.status)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (latestMixRevision !== null && !sourceSelectionTouchedRef.current) setSourceType("mix_revision")
  }, [latestMixRevision])

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    if (initialHasReleaseRef.current && initialViewRef.current === "release") releaseTabRef.current?.focus()
    else sourceRef.current?.focus()

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
    if (run.status === "idle") return
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
  }, [run.status])

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blockedByOtherChange) return
    setReviewedPlan(buildStudioRemasterPlan({
      source: selectedSource(sourceType, latestMixRevision),
      variationStrength,
      durationSeconds,
    }))
  }

  function editPlan() {
    if (busy) return
    if (run.status !== "idle") onReset()
    if (visiblePlan !== null) {
      setSourceType(visiblePlan.source.type)
      setVariationStrength(visiblePlan.variationStrength)
    }
    setReviewedPlan(null)
    window.requestAnimationFrame(() => sourceRef.current?.focus())
  }

  function changeView(nextView: StudioFinishView) {
    if (release === undefined || onViewChange === undefined || nextView === view) return
    onViewChange(nextView)
  }

  function moveView(event: React.KeyboardEvent<HTMLButtonElement>, currentView: StudioFinishView) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "Home" && event.key !== "End") return
    event.preventDefault()
    const nextView = event.key === "ArrowLeft" || event.key === "Home"
      ? "remaster"
      : event.key === "ArrowRight" || event.key === "End"
        ? "release"
        : currentView
    changeView(nextView)
    window.requestAnimationFrame(() => (nextView === "release" ? releaseTabRef : remasterTabRef).current?.focus())
  }

  if (typeof document === "undefined") return null

  return createPortal(
    <div className={styles.layer}>
      <button className={styles.backdrop} type="button" aria-label="Dismiss Finish" onClick={onClose} />
      <section
        ref={dialogRef}
        className={`${styles.dialog} ${release !== undefined && view === "release" ? styles.dialogRelease : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true"><Sparkles size={18} /></span>
          <div className={styles.headerCopy}>
            <span>Studio finish</span>
            <h2 id={titleId}>Finish {versionTitle}</h2>
            <p id={descriptionId}>{release === undefined ? "Polish the sound without rewriting the song. Every result returns as a new Take." : "Finish the sound, shape its visual identity, and prepare a release draft without leaving this Version."}</p>
          </div>
          <button className={styles.closeButton} type="button" aria-label="Close Finish" onClick={onClose}><X size={18} /></button>
        </header>

        {release !== undefined ? (
          <div className={styles.finishTabs} role="tablist" aria-label="Finish workflow">
            <button
              ref={remasterTabRef}
              id={remasterTabId}
              type="button"
              role="tab"
              aria-label="Remaster"
              aria-selected={view === "remaster"}
              aria-controls={remasterPanelId}
              tabIndex={view === "remaster" ? 0 : -1}
              onClick={() => changeView("remaster")}
              onKeyDown={(event) => moveView(event, "remaster")}
            >
              <AudioWaveform size={14} />
              <span><strong>Remaster</strong><small>Finish the sound</small></span>
            </button>
            <button
              ref={releaseTabRef}
              id={releaseTabId}
              type="button"
              role="tab"
              aria-label="Release"
              aria-selected={view === "release"}
              aria-controls={releasePanelId}
              tabIndex={view === "release" ? 0 : -1}
              onClick={() => changeView("release")}
              onKeyDown={(event) => moveView(event, "release")}
            >
              <Sparkles size={14} />
              <span><strong>Release</strong><small>Artwork & details</small></span>
            </button>
          </div>
        ) : null}

        {release !== undefined && view === "release" ? (
          <div className={styles.finishPanel} id={releasePanelId} role="tabpanel" aria-labelledby={releaseTabId}>
            <StudioReleasePanel {...release} />
          </div>
        ) : (
          <div className={styles.finishPanel} id={release === undefined ? undefined : remasterPanelId} role={release === undefined ? undefined : "tabpanel"} aria-labelledby={release === undefined ? undefined : remasterTabId}>
        {blockedByOtherChange ? (
          <section className={styles.blocked} role="status">
            <span><LoaderCircle size={18} /></span>
            <div><strong>Another Studio change is active.</strong><p>Finish or cancel that change before starting a Remaster.</p></div>
          </section>
        ) : visiblePlan === null ? (
          <form onSubmit={review}>
            <div className={styles.body}>
              <fieldset className={styles.fieldset}>
                <legend>Polish source</legend>
                <p className={styles.fieldHint}>Start from this Version or include the latest mixer choices you explicitly saved.</p>
                {latestMixRevisionStatus === "loading" ? <p className={styles.fieldHint} role="status">Loading the latest saved Mix Revision…</p> : null}
                {latestMixRevisionStatus === "unavailable" ? <p className={styles.fieldHint} role="status">Saved Mix Revision is unavailable. The Open Version remains available to polish.</p> : null}
                <div className={styles.sourceList}>
                  <SourceChoice
                    inputRef={sourceType === "version" ? sourceRef : undefined}
                    active={sourceType === "version"}
                    label="Open version"
                    description={`${versionTitle} · ${formatDuration(durationSeconds)}`}
                    detail="Base audio before saved mixer changes"
                    icon={<Music2 size={16} />}
                    onSelect={() => { sourceSelectionTouchedRef.current = true; setSourceType("version") }}
                  />
                  {latestMixRevision !== null ? (
                    <SourceChoice
                      inputRef={sourceType === "mix_revision" ? sourceRef : undefined}
                      active={sourceType === "mix_revision"}
                      label={`Mix revision ${latestMixRevision.revision}`}
                      description={latestMixRevision.name}
                      detail={`${latestMixRevision.tracks.length} saved tracks`}
                      icon={<Layers3 size={16} />}
                      onSelect={() => { sourceSelectionTouchedRef.current = true; setSourceType("mix_revision") }}
                    />
                  ) : null}
                </div>
              </fieldset>

              <fieldset className={styles.fieldset}>
                <legend>Remaster strength</legend>
                <p className={styles.fieldHint}>Choose how far the production may move while the composition stays protected.</p>
                <div className={styles.strengthList}>
                  {strengthOptions.map((option) => (
                    <label className={`${styles.strengthChoice} ${variationStrength === option.id ? styles.choiceActive : ""}`} key={option.id}>
                      <input
                        className={styles.radioInput}
                        type="radio"
                        name="remaster-strength"
                        value={option.id}
                        aria-label={`${option.label} — ${option.description}`}
                        checked={variationStrength === option.id}
                        onChange={() => setVariationStrength(option.id)}
                      />
                      <span className={styles.waveBars} aria-hidden="true">
                        {option.bars.map((height, index) => <i style={{ height }} key={`${option.id}-${index}`} />)}
                      </span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.context} aria-label="Remaster context">
                <span><strong>Scope</strong>Whole song</span>
                <span><strong>Protected</strong>Composition + performance</span>
                <span><strong>Result</strong>2 Takes</span>
              </div>
            </div>
            <footer className={styles.footer}>
              <p>Nothing changes until you review a Take and choose it as Current.</p>
              <div className={styles.actions}>
                <button className={styles.secondaryButton} type="button" onClick={onClose}>Cancel</button>
                <button className={styles.primaryButton} type="submit"><AudioWaveform size={15} /> Review remaster</button>
              </div>
            </footer>
          </form>
        ) : (
          <RemasterPlan
            plan={visiblePlan}
            latestMixRevision={latestMixRevision}
            run={run}
            busy={busy}
            onClose={onClose}
            onEdit={editPlan}
            onSubmit={() => onSubmit(visiblePlan)}
            onCancel={onCancel}
            onReviewTakes={onReviewTakes}
          />
        )}

        {blockedByOtherChange ? <footer className={styles.footer}><p>The active job remains available in its Studio tool.</p><div className={styles.actions}><button className={styles.primaryButton} type="button" onClick={onClose}>Close</button></div></footer> : null}
          </div>
        )}
      </section>
    </div>,
    document.body,
  )
}

type SourceChoiceProps = {
  inputRef?: React.Ref<HTMLInputElement>
  active: boolean
  label: string
  description: string
  detail: string
  icon: React.ReactNode
  onSelect: () => void
}

function SourceChoice({ inputRef, active, label, description, detail, icon, onSelect }: SourceChoiceProps) {
  return (
    <label className={`${styles.sourceChoice} ${active ? styles.choiceActive : ""}`}>
      <input ref={inputRef} className={styles.radioInput} type="radio" name="remaster-source" aria-label={label} checked={active} onChange={onSelect} />
      <span className={styles.choiceIcon}>{icon}</span>
      <span className={styles.choiceCopy}><strong>{label}</strong><small>{description}</small><span className={styles.choiceMeta}>{detail}</span></span>
      <span className={styles.choiceCheck} aria-hidden="true"><Check size={13} /></span>
    </label>
  )
}

function formatDuration(durationSeconds: number): string {
  const safeDuration = Math.max(0, Math.round(durationSeconds))
  const minutes = Math.floor(safeDuration / 60)
  const seconds = safeDuration % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

type RemasterPlanProps = {
  plan: StudioRemasterPlan
  latestMixRevision: MoriMixRevision | null
  run: StudioAiRunState
  busy: boolean
  onClose: () => void
  onEdit: () => void
  onSubmit: () => void
  onCancel: () => void
  onReviewTakes: () => void
}

function RemasterPlan({ plan, latestMixRevision, run, busy, onClose, onEdit, onSubmit, onCancel, onReviewTakes }: RemasterPlanProps) {
  const status = remasterStatus(run)
  const succeeded = run.status === "succeeded" && run.resultCount > 0
  const retryable = run.status === "failed" || run.status === "cancelled" || run.status === "expired" || (run.status === "succeeded" && run.resultCount === 0)

  return (
    <section className={styles.plan} role="region" aria-label="Remaster plan" aria-live="polite" aria-busy={busy} tabIndex={-1}>
      <div className={styles.planBody}>
        <header className={styles.planHeader}>
          <div><span>Remaster plan</span><h3>{strengthLabel(plan.variationStrength)} polish</h3></div>
          <span className={status.className}>{status.label}</span>
        </header>
        <p className={styles.planInstruction}>{plan.instruction}</p>
        <div className={styles.planFacts}>
          <span><strong>Source</strong>{sourceLabel(plan.source, latestMixRevision)}</span>
          <span><strong>Strength</strong>{strengthLabel(plan.variationStrength)}</span>
          <span><strong>Scope</strong>Whole song</span>
          <span><strong>Keep</strong>Melody · Lyrics · Voice · Tempo · Structure</span>
          <span><strong>Result</strong>2 alternatives · Take lanes</span>
        </div>

        {busy ? (
          <div className={styles.progressRow}>
            <div role="progressbar" aria-label="Remaster progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={run.progress}>
              <span style={{ width: `${Math.max(0, Math.min(100, run.progress))}%` }} />
            </div>
            <span>{run.progress}%</span>
          </div>
        ) : null}
        {run.message !== null ? <div className={styles.errorState} role={retryable ? "alert" : "status"}><strong>{retryable ? "Remaster needs another try" : "Remaster update"}</strong><p>{run.message}</p></div> : null}
        {succeeded ? <div className={styles.readyState} role="status"><span><Check size={16} /></span><div><strong>{run.resultCount} remastered takes are ready.</strong><p>Compare them in Arrangement before changing Current.</p></div></div> : null}
      </div>

      <footer className={styles.footer}>
        <p><Check size={12} /> Current Version and saved Mix remain untouched.</p>
        <div className={styles.actions}>
          {busy ? <>
            <button className={styles.secondaryButton} type="button" onClick={onClose}>Close</button>
            <button className={styles.dangerButton} type="button" disabled={run.cancelPending === true} onClick={onCancel}><Square size={12} fill="currentColor" /> {run.cancelPending === true ? "Stopping…" : "Cancel remaster"}</button>
          </> : <>
            <button className={styles.secondaryButton} type="button" onClick={onEdit}><Pencil size={13} /> Edit plan</button>
            {succeeded ? (
              <button className={styles.primaryButton} type="button" onClick={onReviewTakes}>Review {run.resultCount} takes <AudioWaveform size={15} /></button>
            ) : retryable ? (
              <button className={styles.primaryButton} type="button" onClick={onSubmit}><RotateCcw size={14} /> Retry remaster</button>
            ) : (
              <button className={styles.primaryButton} type="button" onClick={onSubmit}><Sparkles size={14} /> Create 2 remastered takes</button>
            )}
          </>}
        </div>
      </footer>
    </section>
  )
}

function selectedSource(sourceType: "version" | "mix_revision", latestMixRevision: MoriMixRevision | null): MoriStudioRemasterSource {
  if (sourceType === "mix_revision" && latestMixRevision !== null) {
    return { type: "mix_revision", mixRevisionRef: latestMixRevision.mix_revision_ref }
  }
  return { type: "version" }
}

function sourceLabel(source: MoriStudioRemasterSource, latestMixRevision: MoriMixRevision | null): string {
  if (source.type === "version") return "Open version"
  if (latestMixRevision?.mix_revision_ref === source.mixRevisionRef) return `Mix revision ${latestMixRevision.revision} · ${latestMixRevision.name}`
  return "Saved Mix Revision"
}

function strengthLabel(strength: StudioRemasterStrength): string {
  return strength[0].toUpperCase() + strength.slice(1)
}

function remasterStatus(run: StudioAiRunState): { label: string; className: string } {
  switch (run.status) {
    case "idle": return { label: "Review before rendering", className: styles.statusDraft }
    case "preparing": return { label: "Preparing remaster", className: styles.statusRunning }
    case "queued": return { label: "Waiting to polish", className: styles.statusRunning }
    case "generating": return { label: "Polishing two takes", className: styles.statusRunning }
    case "post_processing": return { label: "Finishing two takes", className: styles.statusRunning }
    case "succeeded": return run.resultCount > 0
      ? { label: `${run.resultCount} takes ready`, className: styles.statusReady }
      : { label: "No takes returned", className: styles.statusError }
    case "failed": return { label: "Remaster failed", className: styles.statusError }
    case "cancelled": return { label: "Remaster cancelled", className: styles.statusStopped }
    case "expired": return { label: "Remaster expired", className: styles.statusStopped }
  }
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
