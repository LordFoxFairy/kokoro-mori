"use client"

import { ListMusic, Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react"
import type { Candidate } from "../domain"
import { Waveform } from "./waveform"
import styles from "../mori-workspace.module.css"

type PersistentPlayerProps = {
  candidate: Candidate
  playing: boolean
  onToggle: () => void
  onSelectQueue?: () => void
  onPrevious?: () => void
  onNext?: () => void
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = String(seconds % 60).padStart(2, "0")
  return `${minutes}:${remaining}`
}

export function PersistentPlayer({ candidate, playing, onToggle, onSelectQueue, onPrevious, onNext }: PersistentPlayerProps) {
  return (
    <section className={styles.player} aria-label="Global player">
      <div className={styles.playerTrack}>
        <div className={styles.playerArtwork} aria-hidden="true" />
        <div className={styles.playerInfo}>
          <strong>{candidate.title}</strong>
          <span>{candidate.subtitle}</span>
        </div>
      </div>
      <div className={styles.playerWave}>
        <span className={styles.time}>0:36</span>
        <Waveform seed={candidate.waveformSeed} compact progress={0.2} />
        <span className={styles.time}>{formatDuration(candidate.durationSeconds)}</span>
      </div>
      <div className={styles.playerControls}>
        <button className={styles.playerButton} type="button" onClick={onPrevious} aria-label="Previous version"><SkipBack /></button>
        <button className={`${styles.playerButton} ${styles.playerButtonPrimary}`} type="button" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
        </button>
        <button className={styles.playerButton} type="button" onClick={onNext} aria-label="Next version"><SkipForward /></button>
        <button className={styles.playerButton} type="button" aria-label="Volume"><Volume2 /></button>
        {onSelectQueue ? <button className={styles.playerTool} type="button" onClick={onSelectQueue} aria-label="Open playback queue"><ListMusic /> <span>Queue</span></button> : null}
      </div>
    </section>
  )
}
