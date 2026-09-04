import { AlertCircle, ArrowUpRight, Check, Clock3, LoaderCircle, Play, RotateCcw, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef } from "react"
import type { Candidate, Generation, SongPlan } from "../domain"
import { idleCurrentVersionCommitRun, type CurrentVersionCommitRun } from "../current-version"
import { Waveform } from "./waveform"
import styles from "../mori-workspace.module.css"

type InspectorPanelProps = {
  projectRef: string | null
  generation: Generation | null
  candidates: Candidate[]
  songPlan: SongPlan | null
  selectedCandidateRef: string
  playing: boolean
  currentVersionCommitRun?: CurrentVersionCommitRun
  onSelect: (candidate: Candidate) => void
  onPromote: (candidate: Candidate) => void
  onRetryCurrentVersion?: () => void
  onDismissCurrentVersion?: () => void
  onPlay: (candidate: Candidate) => void
  onCancel?: () => void
  onRetry?: () => void
  onClose?: () => void
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = String(seconds % 60).padStart(2, "0")
  return `${minutes}:${remaining}`
}

export function InspectorPanel({ projectRef, generation, candidates, songPlan, selectedCandidateRef, playing, currentVersionCommitRun = idleCurrentVersionCommitRun, onSelect, onPromote, onRetryCurrentVersion, onDismissCurrentVersion, onPlay, onCancel, onRetry, onClose }: InspectorPanelProps) {
  const generationActive = generation !== null && ["queued", "preparing", "generating", "post_processing"].includes(generation.status)
  const generationFailed = generation !== null && (generation.status === "failed" || generation.status === "expired")
  const generationEmpty = generation?.status === "succeeded" && candidates.length === 0
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return

      const panel = panelRef.current
      if (panel === null) return
      const focusable = getFocusableElements(panel)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (first === undefined || last === undefined) return
      if (document.activeElement === panel) {
        event.preventDefault()
        const destination = event.shiftKey ? last : first
        destination.focus()
      } else if (event.shiftKey && document.activeElement === first) {
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

  return (
    <aside ref={panelRef} className={styles.inspector} role="dialog" aria-modal="true" aria-labelledby="generation-queue-title" tabIndex={-1}>
      <header className={styles.inspectorHeader}>
        <div>
          <h2 className={styles.sectionTitle} id="generation-queue-title">Generation queue</h2>
          <p className={styles.sectionCaption}>Your newest directions, in one place.</p>
        </div>
        <div className={styles.inspectorActions}>
          {onClose ? <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close generation queue"><X /></button> : null}
        </div>
      </header>

      <div className={styles.inspectorBody}>
        {generation === null ? <section className={styles.generationQueueEmpty} role="status">
          <div className={styles.candidateEmptyIcon}><Sparkles size={16} /></div>
          <strong>No generations yet</strong>
          <span>Describe the song you want to make. Its progress and directions will stay here.</span>
        </section> : <>
          <section className={styles.queueCard} aria-label="Generation status">
          <div className={styles.queueTop}>
            <div className={styles.queueLabel}><Sparkles /> {generation.label}</div>
            <span className={styles.queueTime}>{generation.createdAt}</span>
          </div>
          <div className={styles.progressTrack} aria-label={`${generation.progress}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={generation.progress}>
            <div className={styles.progressValue} style={{ width: `${generation.progress}%` }} />
          </div>
          <p className={styles.queueText}>{generationActive ? "Mori is shaping the next direction. You can keep working while it runs." : generationFailed ? "Your idea is still here. Nothing was added to the library." : generationEmpty ? "Mori finished this run without a playable direction. Try again or adjust the idea." : "Ready to compare. Pick a direction and make it yours."}</p>
          {onCancel && generationActive ? <div className={styles.queueActions}><span>Need to change the idea?</span><button className={styles.cancelButton} type="button" onClick={onCancel}>Cancel generation</button></div> : null}
          {onRetry && (generationFailed || generationEmpty) ? <div className={styles.queueActions}><span>Keep the same idea?</span><button className={styles.retryButton} type="button" onClick={onRetry}>Try again</button></div> : null}
          </section>

          <section className={styles.candidateList} aria-labelledby="candidate-heading">
          <div className={styles.candidatesHeader}>
            <h3 id="candidate-heading">Candidates</h3>
            <span>{candidates.length} directions</span>
          </div>
          {currentVersionCommitRun.status === "failed" ? <div className={`${styles.queueCommitNotice} ${styles.queueCommitNoticeError}`} role="alert">
            <AlertCircle aria-hidden="true" size={15} />
            <div><strong>Current wasn&apos;t changed</strong><span>{currentVersionCommitRun.message}</span></div>
            <div className={styles.queueCommitActions}>
              {currentVersionCommitRun.retryable && onRetryCurrentVersion ? <button type="button" onClick={onRetryCurrentVersion}><RotateCcw size={12} /> Retry Set as current</button> : null}
              {onDismissCurrentVersion ? <button type="button" onClick={onDismissCurrentVersion}><X size={12} /> Dismiss</button> : null}
            </div>
          </div> : null}
          {currentVersionCommitRun.status === "succeeded" ? <div className={`${styles.queueCommitNotice} ${styles.queueCommitNoticeSuccess}`} role="status">
            <Check aria-hidden="true" size={15} />
            <div><strong>Current Version updated</strong><span>{currentVersionCommitRun.message}</span></div>
            {onDismissCurrentVersion ? <button className={styles.queueCommitDismiss} type="button" aria-label="Dismiss Current Version confirmation" onClick={onDismissCurrentVersion}><X size={12} /></button> : null}
          </div> : null}
          {candidates.length === 0 ? <div className={styles.candidateEmpty} role="status">
            <div className={styles.candidateEmptyIcon}><Sparkles size={16} /></div>
            <strong>No playable directions yet</strong>
            <span>When a take is ready, it will appear here for comparison.</span>
          </div> : candidates.map((candidate, index) => {
            const isCurrent = candidate.isCurrent
            const isSelected = selectedCandidateRef === candidate.candidateRef
            const isCommitting = currentVersionCommitRun.status === "saving"
            const isCommitTarget = isCommitting && currentVersionCommitRun.targetVersionRef === candidate.versionRef
            return (
              <article className={`${styles.candidateCard} ${isCurrent ? styles.candidateCardCurrent : ""}`} key={candidate.candidateRef} onClick={() => onSelect(candidate)}>
                <div className={styles.candidateTop}>
                  <div className={`${styles.candidateArtwork} ${index === 1 ? styles.candidateArtworkAlt : ""}`} aria-hidden="true"><Play size={14} fill="currentColor" /></div>
                  <div className={styles.candidateMeta}>
                    <div className={styles.candidateTitle}>{candidate.title}</div>
                    <div className={styles.candidateSubtitle}>{candidate.subtitle}</div>
                  </div>
                  <span className={styles.candidateDuration}>{formatDuration(candidate.durationSeconds)}</span>
                </div>
                <Waveform seed={candidate.waveformSeed} progress={isSelected ? 0.62 : 0.32} />
                <div className={styles.candidateActions}>
                  <button className={styles.candidatePlay} type="button" onClick={(event) => { event.stopPropagation(); onPlay(candidate) }} aria-label={`${playing && isSelected ? "Pause" : "Play"} ${candidate.title}`}>
                    <Play size={12} fill={playing && isSelected ? "currentColor" : "none"} /> {playing && isSelected ? "Playing" : "Preview"}
                  </button>
                  {projectRef === null ? null : <Link
                      className={styles.candidateStudioLink}
                      href={`/projects/${encodeURIComponent(projectRef)}/studio/${encodeURIComponent(candidate.versionRef)}`}
                      aria-label={`Open Studio for ${candidate.title}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      Studio <ArrowUpRight size={12} />
                    </Link>}
                  {isCurrent ? (
                    <span className={styles.promotedLabel}><Check /> Current version</span>
                  ) : (
                    <button
                      className={styles.promoteButton}
                      type="button"
                      disabled={isCommitting}
                      aria-label={isCommitTarget ? `Setting ${candidate.title} as current` : undefined}
                      onClick={(event) => { event.stopPropagation(); onPromote(candidate) }}
                    >
                      {isCommitTarget ? <><LoaderCircle aria-hidden="true" size={12} /> Saving…</> : "Set as current"}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
          </section>

          {songPlan === null ? null : <>
            <div className={styles.inspectorDivider} />

            <section className={styles.planDetail} aria-labelledby="plan-heading">
              <div className={styles.planDetailHeader}>
                <h3 id="plan-heading">Song plan</h3>
              </div>
              <div className={styles.planStats}>
                <div className={styles.planStat}><span>Mood</span><strong>{songPlan.mood}</strong></div>
                <div className={styles.planStat}><span>Tempo</span><strong>{songPlan.tempoBpm} BPM</strong></div>
              </div>
              <div className={styles.tagRow} aria-label="Song plan structure">
                {songPlan.structure.map((item) => <span className={`${styles.tag} ${styles.tagSelected}`} key={item}>{item}</span>)}
              </div>
              <div className={styles.planMetaLine}><Clock3 size={13} /> <span>{songPlan.vocalDirection}</span></div>
            </section>
          </>}
        </>}
      </div>
    </aside>
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
  ].join(",")))
}
