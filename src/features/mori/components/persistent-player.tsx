"use client"

import { ListMusic, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import type { Candidate } from "../domain"
import { Waveform } from "./waveform"
import styles from "../mori-workspace.module.css"

type PersistentPlayerProps = {
  candidate: Candidate
  playing: boolean
  muted: boolean
  positionSeconds: number
  onToggle: () => void
  onToggleMute: () => void
  onSeek: (positionSeconds: number) => void
  onSelectQueue?: () => void
  onPrevious?: () => void
  onNext?: () => void
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = String(seconds % 60).padStart(2, "0")
  return `${minutes}:${remaining}`
}

export function PersistentPlayer({ candidate, playing, muted, positionSeconds, onToggle, onToggleMute, onSeek, onSelectQueue, onPrevious, onNext }: PersistentPlayerProps) {
  return (
    <section className={styles.player} aria-label="Global player" data-player-surface="global-dock">
      <div className={styles.playerTrack}>
        <div className={styles.playerArtwork} aria-hidden="true" />
        <div className={styles.playerInfo}>
          <strong>{candidate.title}</strong>
          <span>{candidate.subtitle}</span>
        </div>
      </div>
      <div className={styles.playerCenter}>
        <div className={styles.playerControls} role="group" aria-label="Playback controls">
          <button className={`${styles.playerButton} ${styles.playerSkipButton}`} type="button" onClick={onPrevious} aria-label="Previous version"><SkipBack /></button>
          <button className={`${styles.playerButton} ${styles.playerButtonPrimary}`} type="button" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
          </button>
          <button className={`${styles.playerButton} ${styles.playerSkipButton}`} type="button" onClick={onNext} aria-label="Next version"><SkipForward /></button>
        </div>
        <div className={styles.playerProgress} role="group" aria-label="Playback progress">
          <span className={styles.time}>{formatDuration(positionSeconds)}</span>
          <div className={styles.playerSeek}>
            <Waveform seed={candidate.waveformSeed} compact progress={candidate.durationSeconds > 0 ? positionSeconds / candidate.durationSeconds : 0} />
            <input
              className={styles.playerSeekInput}
              type="range"
              min={0}
              max={candidate.durationSeconds}
              step={1}
              value={Math.min(positionSeconds, candidate.durationSeconds)}
              onChange={(event) => onSeek(Number(event.target.value))}
              aria-label="Seek through current version"
            />
          </div>
          <span className={styles.time}>{formatDuration(candidate.durationSeconds)}</span>
        </div>
      </div>
      <div className={styles.playerTools} role="group" aria-label="Player tools">
        <button className={`${styles.playerButton} ${styles.playerMuteButton}`} type="button" onClick={onToggleMute} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX /> : <Volume2 />}</button>
        {onSelectQueue ? <button className={styles.playerTool} type="button" onClick={onSelectQueue} aria-label="Open playback queue"><ListMusic /> <span>Queue</span></button> : null}
      </div>
    </section>
  )
}
