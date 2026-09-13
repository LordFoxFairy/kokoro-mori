import { AlertCircle, ArrowUpRight, AudioWaveform, Check, LoaderCircle, Play, RotateCcw, Sparkles, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import type { Candidate } from "./domain"
import type { CurrentVersionCommitRun } from "./current-version"
import { Waveform } from "./components/waveform"
import { emptyStudioTakeReview, StudioTakeReview, type StudioTakeReviewState } from "./components/studio-take-review"
import { formatMusicTime } from "./format-music-time"
import styles from "./mori-workspace.module.css"

export type CandidateProjectionStatus = "loading" | "ready" | "unavailable"

type ProjectOverviewDirectionsProps = {
  projectRef: string
  candidateCount: number
  candidates: Candidate[]
  generationRef?: string | null
  candidateStatus: CandidateProjectionStatus
  currentVersionRef: string | null
  currentVersionCommitRun: CurrentVersionCommitRun
  playerCandidate: Candidate | null
  playing: boolean
  onPlayCandidate: (candidate: Candidate) => void
  onCommitCurrentVersion: (candidate: Candidate) => void
  onRetryCurrentVersion: () => void
  onDismissCurrentVersion: () => void
  onRetryCandidates: () => void
}

export function ProjectOverviewDirections({
  projectRef,
  candidateCount,
  candidates,
  generationRef = null,
  candidateStatus,
  currentVersionRef,
  currentVersionCommitRun,
  playerCandidate,
  playing,
  onPlayCandidate,
  onCommitCurrentVersion,
  onRetryCurrentVersion,
  onDismissCurrentVersion,
  onRetryCandidates,
}: ProjectOverviewDirectionsProps) {
  const [reviewByKey, setReviewByKey] = useState<Record<string, StudioTakeReviewState>>({})
  const showCurrentVersionCommitNotice = currentVersionCommitRun.status === "failed" || currentVersionCommitRun.status === "succeeded"
  const isGenerationScoped = generationRef !== null

  function updateCandidateReview(candidate: Candidate, review: StudioTakeReviewState) {
    setReviewByKey((current) => ({ ...current, [candidateReviewKey(projectRef, generationRef, candidate)]: review }))
  }

  return <section className={`${styles.overviewSection} ${styles.overviewDirections}`} aria-labelledby="directions-heading">
    <div className={styles.overviewSectionHeader}>
      <div><h2 id="directions-heading">{isGenerationScoped ? "Review this generation" : "Latest directions"}</h2><p>{isGenerationScoped ? "Compare this run before choosing what to change next." : "Listen and compare before choosing what to change next."}</p></div>
      <span>{candidateStatus === "loading"
        ? "Loading"
        : candidateStatus === "unavailable"
          ? isGenerationScoped ? "Retry available" : `${candidateCount} saved`
          : `${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"}`}</span>
    </div>
    {showCurrentVersionCommitNotice ? <div className={`${styles.overviewCandidateCommitNotice} ${currentVersionCommitRun.status === "failed" ? styles.overviewCandidateCommitNoticeError : styles.overviewCandidateCommitNoticeSuccess}`} role={currentVersionCommitRun.status === "failed" ? "alert" : "status"}>
      {currentVersionCommitRun.status === "failed" ? <AlertCircle aria-hidden="true" size={15} /> : <Check aria-hidden="true" size={15} />}
      <div><strong>{currentVersionCommitRun.status === "failed" ? "Current wasn&apos;t changed" : "Current Version updated"}</strong><span>{currentVersionCommitRun.message}</span></div>
      <div className={styles.overviewCandidateCommitActions}>
        {currentVersionCommitRun.retryable ? <button type="button" onClick={onRetryCurrentVersion}><RotateCcw size={12} /> Retry Set as current</button> : null}
        <button type="button" aria-label="Dismiss Current Version confirmation" onClick={onDismissCurrentVersion}><X size={12} /> Dismiss</button>
      </div>
    </div> : null}
    {candidateStatus === "loading" ? <div className={styles.overviewProjectionState} role="status">
      <span className={styles.overviewProjectionStateIcon} aria-hidden="true"><AudioWaveform size={17} /></span>
      <div><strong>Loading directions</strong><p>Bringing this Project&apos;s latest Versions into view.</p></div>
    </div> : candidateStatus === "unavailable" ? <div className={styles.overviewProjectionState} role="status">
      <span className={styles.overviewProjectionStateIcon} aria-hidden="true"><AudioWaveform size={17} /></span>
      <div><strong>Directions temporarily unavailable</strong><p>Your saved directions are still part of this Project. Retry to compare them here.</p></div>
      <button type="button" onClick={onRetryCandidates} aria-label="Retry directions"><RotateCcw size={13} /> Retry</button>
    </div> : candidates.length > 0 ? <div className={styles.overviewCandidateList}>
        {candidates.map((candidate, index) => {
          const isCurrent = candidate.versionRef === currentVersionRef
          const isCommitting = currentVersionCommitRun.status === "saving"
          const isCommitTarget = isCommitting && currentVersionCommitRun.targetVersionRef === candidate.versionRef
          const reviewKey = candidateReviewKey(projectRef, generationRef, candidate)
          return <article
            aria-current={isCurrent ? "true" : undefined}
            aria-label={`${candidate.title}${isCurrent ? ", current version" : ""}`}
            className={`${styles.overviewCandidate} ${isCurrent ? styles.overviewCandidateCurrent : ""}`}
            key={candidate.candidateRef}
          >
          <button className={`${styles.candidateArtwork} ${styles.overviewCandidateArtwork} ${index === 1 ? styles.candidateArtworkAlt : ""}`} type="button" onClick={() => onPlayCandidate(candidate)} aria-label={`${playerCandidate?.versionRef === candidate.versionRef && playing ? "Pause" : "Play"} ${candidate.title}`}>
            <Play size={14} fill={playerCandidate?.versionRef === candidate.versionRef && playing ? "currentColor" : "none"} />
          </button>
          <div className={styles.overviewCandidateInfo}>
            <div className={styles.overviewCandidateTitle}><strong>{candidate.title}</strong>{isCurrent ? <span className={styles.overviewCurrentBadge}>Current</span> : null}</div>
            <span>{candidate.subtitle}</span>
          </div>
          <div className={styles.overviewCandidateWave}><Waveform seed={candidate.waveformSeed} compact progress={index === 0 ? 0.8 : 0.48} /></div>
          <span className={styles.candidateDuration}>{formatMusicTime(candidate.durationSeconds)}</span>
          <div className={styles.overviewCandidateActions}>
            {isCurrent ? null : <button className={styles.overviewPromoteButton} type="button" disabled={isCommitting} aria-label={isCommitTarget ? `Setting ${candidate.title} as current` : `Set ${candidate.title} as current`} onClick={() => { onCommitCurrentVersion(candidate) }}>
              {isCommitTarget ? <><LoaderCircle aria-hidden="true" size={12} /> Saving…</> : "Set as current"}
            </button>}
            <Link className={styles.overviewOpenLink} href={`/projects/${encodeURIComponent(projectRef)}/studio/${encodeURIComponent(candidate.versionRef)}`} aria-label={`Open Studio for ${candidate.title}`}><ArrowUpRight size={15} /></Link>
          </div>
          <StudioTakeReview
            takeTitle={candidate.title}
            review={reviewByKey[reviewKey] ?? emptyStudioTakeReview}
            onChange={(review) => updateCandidateReview(candidate, review)}
          />
        </article>
        })}
    </div> : <div className={styles.libraryEmpty}>
      <div className={styles.libraryEmptyIcon}><Sparkles size={18} /></div>
      <strong>{isGenerationScoped ? "No directions from this run" : "No directions yet"}</strong>
      <p>{isGenerationScoped ? "This run has no playable direction yet. Return to Create and try another idea." : "Shape the first direction for this project, then compare versions here."}</p>
      <Link className={styles.ghostButton} href={`/create?project_ref=${encodeURIComponent(projectRef)}`}>{isGenerationScoped ? "Try another direction" : "Create a direction"}</Link>
    </div>}
  </section>
}

function candidateReviewKey(projectRef: string, generationRef: string | null, candidate: Candidate): string {
  return `${projectRef}:${generationRef ?? candidate.generationRef}:${candidate.candidateRef}`
}
