import { Check, Clock3, MoreHorizontal, Play, Sparkles, X } from "lucide-react"
import type { Candidate, Generation, SongPlan } from "../domain"
import { Waveform } from "./waveform"
import styles from "../mori-workspace.module.css"

type InspectorPanelProps = {
  generation: Generation
  candidates: Candidate[]
  songPlan: SongPlan
  selectedCandidateRef: string
  playing: boolean
  onSelect: (candidate: Candidate) => void
  onPromote: (candidate: Candidate) => void
  onPlay: (candidate: Candidate) => void
  onClose?: () => void
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = String(seconds % 60).padStart(2, "0")
  return `${minutes}:${remaining}`
}

export function InspectorPanel({ generation, candidates, songPlan, selectedCandidateRef, playing, onSelect, onPromote, onPlay, onClose }: InspectorPanelProps) {
  return (
    <aside className={styles.inspector} aria-label="Generation queue" role="region" tabIndex={-1}>
      <header className={styles.inspectorHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Generation queue</h2>
          <p className={styles.sectionCaption}>Your newest directions, in one place.</p>
        </div>
        <div className={styles.inspectorActions}>
          <button className={styles.iconButton} type="button" aria-label="More queue options"><MoreHorizontal /></button>
          {onClose ? <button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close generation queue"><X /></button> : null}
        </div>
      </header>

      <div className={styles.inspectorBody}>
        <section className={styles.queueCard} aria-label="Generation status">
          <div className={styles.queueTop}>
            <div className={styles.queueLabel}><Sparkles /> {generation.label}</div>
            <span className={styles.queueTime}>{generation.createdAt}</span>
          </div>
          <div className={styles.progressTrack} aria-label={`${generation.progress}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={generation.progress}>
            <div className={styles.progressValue} style={{ width: `${generation.progress}%` }} />
          </div>
          <p className={styles.queueText}>Ready to compare. Pick a direction and make it yours.</p>
        </section>

        <section className={styles.candidateList} aria-labelledby="candidate-heading">
          <div className={styles.candidatesHeader}>
            <h3 id="candidate-heading">Candidates</h3>
            <span>{candidates.length} directions</span>
          </div>
          {candidates.map((candidate, index) => {
            const isCurrent = candidate.isCurrent
            const isSelected = selectedCandidateRef === candidate.candidateRef
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
                  {isCurrent ? (
                    <span className={styles.promotedLabel}><Check /> Current version</span>
                  ) : (
                    <button className={styles.promoteButton} type="button" onClick={(event) => { event.stopPropagation(); onPromote(candidate) }}>Set as current</button>
                  )}
                </div>
              </article>
            )
          })}
        </section>

        <div className={styles.inspectorDivider} />

        <section className={styles.planDetail} aria-labelledby="plan-heading">
          <div className={styles.planDetailHeader}>
            <h3 id="plan-heading">Song plan</h3>
            <button type="button">Edit plan</button>
          </div>
          <div className={styles.planStats}>
            <div className={styles.planStat}><span>Mood</span><strong>{songPlan.mood}</strong></div>
            <div className={styles.planStat}><span>Tempo</span><strong>{songPlan.tempo}</strong></div>
          </div>
          <div className={styles.tagRow} aria-label="Song plan structure">
            {songPlan.structure.map((item) => <span className={`${styles.tag} ${styles.tagSelected}`} key={item}>{item}</span>)}
          </div>
          <div className={styles.planMetaLine}><Clock3 size={13} /> <span>{songPlan.vocalDirection}</span></div>
        </section>
      </div>
    </aside>
  )
}
