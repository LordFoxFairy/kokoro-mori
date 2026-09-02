"use client"

import { ArrowLeft, ArrowUpRight, Clock3, Play, Sparkles } from "lucide-react"
import Link from "next/link"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewProject, previewSongPlan } from "./preview-data"
import { Waveform } from "./components/waveform"
import styles from "./mori-workspace.module.css"

export function ProjectOverviewPageContent() {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()

  function playCandidate(candidate: (typeof previewCandidates)[number]) {
    if (playerCandidate.candidateRef === candidate.candidateRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(candidate)
    setPlaying(true)
  }

  return (
    <div className={styles.catalogContent}>
      <Link className={styles.backLink} href="/projects"><ArrowLeft size={14} /> All projects</Link>
      <div className={styles.projectOverviewHeader}>
        <div className={styles.projectOverviewArtwork}><span>01</span></div>
        <div className={styles.projectOverviewCopy}>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Active project</div>
          <h1 className={styles.catalogTitle}>{previewProject.title}</h1>
          <p>{previewProject.description}</p>
          <div className={styles.projectOverviewActions}>
            <Link className={styles.generateButton} href={`/projects/${previewProject.projectRef}/studio/${previewCandidates[0].versionRef}`}><Play size={14} fill="currentColor" /> Open Studio</Link>
            <Link className={styles.ghostButton} href="/create"><Sparkles size={14} /> New direction</Link>
          </div>
        </div>
      </div>

      <div className={styles.overviewStats}>
        <div><span>Current version</span><strong>First Light</strong></div>
        <div><span>Directions</span><strong>{previewCandidates.length}</strong></div>
        <div><span>Last activity</span><strong>{previewProject.lastActivity}</strong></div>
        <div><span>Plan mood</span><strong>{previewSongPlan.mood}</strong></div>
      </div>

      <section className={styles.overviewSection} aria-labelledby="directions-heading">
        <div className={styles.overviewSectionHeader}><div><h2 id="directions-heading">Latest directions</h2><p>Compare the shape of the song before you commit to a version.</p></div><span>2 candidates</span></div>
        <div className={styles.overviewCandidateList}>
          {previewCandidates.map((candidate, index) => (
            <article className={styles.overviewCandidate} key={candidate.candidateRef}>
              <button className={`${styles.candidateArtwork} ${styles.overviewCandidateArtwork} ${index === 1 ? styles.candidateArtworkAlt : ""}`} type="button" onClick={() => playCandidate(candidate)} aria-label={`${playerCandidate.candidateRef === candidate.candidateRef && playing ? "Pause" : "Play"} ${candidate.title}`}>
                <Play size={14} fill={playerCandidate.candidateRef === candidate.candidateRef && playing ? "currentColor" : "none"} />
              </button>
              <div className={styles.overviewCandidateInfo}><strong>{candidate.title}</strong><span>{candidate.subtitle}</span></div>
              <div className={styles.overviewCandidateWave}><Waveform seed={candidate.waveformSeed} compact progress={index === 0 ? 0.8 : 0.48} /></div>
              <span className={styles.candidateDuration}>{Math.floor(candidate.durationSeconds / 60)}:{String(candidate.durationSeconds % 60).padStart(2, "0")}</span>
              <Link className={styles.overviewOpenLink} href={`/projects/${previewProject.projectRef}/studio/${candidate.versionRef}`} aria-label={`Open Studio for ${candidate.title}`}><ArrowUpRight size={15} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.overviewSection} aria-labelledby="plan-overview-heading">
        <div className={styles.overviewSectionHeader}><div><h2 id="plan-overview-heading">Song plan</h2><p>The intention behind this project, kept visible as you refine it.</p></div></div>
        <div className={styles.overviewPlanCard}>
          <div className={styles.overviewPlanStats}><span><b>Mood</b>{previewSongPlan.mood}</span><span><b>Tempo</b>{previewSongPlan.tempo}</span><span><b>Voice</b>Intimate lead</span></div>
          <div className={styles.tagRow}>{previewSongPlan.structure.map((item) => <span className={`${styles.tag} ${styles.tagSelected}`} key={item}>{item}</span>)}</div>
          <p><Clock3 size={14} /> {previewSongPlan.vocalDirection}</p>
        </div>
      </section>
    </div>
  )
}
