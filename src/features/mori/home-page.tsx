"use client"

import { ArrowRight, Clock3, Play, Sparkles } from "lucide-react"
import Link from "next/link"
import { useMoriApp } from "./components/mori-app-provider"
import { previewCandidates, previewProject } from "./preview-data"
import { Waveform } from "./components/waveform"
import styles from "./mori-workspace.module.css"

export function HomePageContent() {
  const { playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()

  function playCandidate(candidate: (typeof previewCandidates)[number]) {
    if (playerCandidate?.candidateRef === candidate.candidateRef) {
      setPlaying(!playing)
      return
    }
    selectPlayerCandidate(candidate)
    setPlaying(true)
  }

  return (
    <div className={`${styles.catalogContent} ${styles.homeContent}`}>
      <header className={styles.homeWelcome}>
        <div>
          <div className={styles.eyebrow}><span className={styles.eyebrowDot} />Home</div>
          <h1 className={styles.catalogTitle}>Make something<br /><em>you can feel.</em></h1>
          <p className={styles.catalogDescription}>Keep the spark moving. Start a new direction or return to the song already taking shape.</p>
        </div>
        <Link className={styles.generateButton} href="/create"><Sparkles size={15} /> New creation</Link>
      </header>

      <section className={styles.homeFeature} aria-labelledby="continue-heading">
        <div className={styles.homeFeatureArtwork}><span>01</span><div className={styles.homeFeatureOrb} /></div>
        <div className={styles.homeFeatureCopy}>
          <span className={styles.featureKicker}>Continue where you left off</span>
          <h2 id="continue-heading">{previewProject.title}</h2>
          <p>{previewProject.description}</p>
          <div className={styles.homeFeatureMeta}><span><Clock3 size={13} /> {previewProject.lastActivity}</span><span>{previewProject.candidateCount} directions</span></div>
          <Link className={styles.projectContinue} href={`/projects/${previewProject.projectRef}`}>Open project <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section className={styles.homeSection} aria-labelledby="directions-heading">
        <div className={styles.homeSectionHeader}><div><span className={styles.featureKicker}>Listen back</span><h2 id="directions-heading">Your latest directions</h2></div><Link href="/library">View library <ArrowRight size={13} /></Link></div>
        <div className={styles.homeTrackList}>
          {previewCandidates.map((candidate, index) => (
            <article className={styles.homeTrack} key={candidate.candidateRef}>
              <button className={`${styles.homeTrackArtwork} ${index === 1 ? styles.homeTrackArtworkAlt : ""}`} type="button" onClick={() => playCandidate(candidate)} aria-label={`${playerCandidate?.candidateRef === candidate.candidateRef && playing ? "Pause" : "Play"} ${candidate.title}`}><Play size={14} fill={playerCandidate?.candidateRef === candidate.candidateRef && playing ? "currentColor" : "none"} /></button>
              <div className={styles.homeTrackCopy}><strong>{candidate.title}</strong><span>{candidate.subtitle}</span></div>
              <div className={styles.homeTrackWave}><Waveform seed={candidate.waveformSeed} compact progress={index === 0 ? 0.62 : 0.28} /></div>
              <span className={styles.homeTrackDuration}>{Math.floor(candidate.durationSeconds / 60)}:{String(candidate.durationSeconds % 60).padStart(2, "0")}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
