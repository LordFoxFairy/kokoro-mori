"use client"

import { ListMusic, Music2, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react"
import type { Candidate } from "../domain"
import { isPlayableCandidate } from "../player-media"
import type { PlayerMediaStatus } from "./mori-app-provider"
import { Waveform } from "./waveform"
import styles from "../mori-workspace.module.css"

type PersistentPlayerProps = {
  candidate: Candidate | null
  playing: boolean
  muted: boolean
  positionSeconds: number
  onToggle: () => void
  onToggleMute: () => void
  onSeek: (positionSeconds: number) => void
  playerMediaStatus?: PlayerMediaStatus
  playerMediaMessage?: string | null
  onRetryPlayback?: () => void
  queueOpen?: boolean
  onSelectQueue?: () => void
  onPrevious?: () => void
  onNext?: () => void
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remaining = String(seconds % 60).padStart(2, "0")
  return `${minutes}:${remaining}`
}

export function PersistentPlayer({ candidate, playing, muted, positionSeconds, onToggle, onToggleMute, onSeek, playerMediaStatus = "ready", playerMediaMessage = null, onRetryPlayback, queueOpen = false, onSelectQueue, onPrevious, onNext }: PersistentPlayerProps) {
  const hasCandidate = candidate !== null
  const playableCandidate = candidate !== null && isPlayableCandidate(candidate) ? candidate : null
  const canPlay = playableCandidate !== null
  const playerState = candidate === null ? "empty" : canPlay ? playerMediaStatus : "unavailable"

  return (
    <section className={styles.player} aria-label="Global player" data-player-surface="global-dock" data-player-state={playerState}>
      <div className={styles.playerTrack}>
        <div className={`${styles.playerArtwork} ${hasCandidate ? "" : styles.playerArtworkEmpty}`} aria-hidden="true">{hasCandidate ? <span>01</span> : <Music2 size={18} />}</div>
        <div className={styles.playerInfo}>
          <strong>{candidate?.title ?? "Choose a version"}</strong>
          <span>{candidate?.subtitle ?? "Your next listen starts here"}</span>
          {!canPlay && hasCandidate ? <span className={styles.playerStatus}>Preview audio is unavailable</span> : null}
          {canPlay && playerMediaStatus === "loading" ? <span className={styles.playerStatus}>Loading audio…</span> : null}
          {playerMediaStatus === "error" ? <div className={styles.playerError} role="alert"><span>{playerMediaMessage ?? "Audio could not be loaded."}</span>{onRetryPlayback ? <button className={styles.playerRetry} type="button" onClick={onRetryPlayback}>Retry playback</button> : null}</div> : null}
        </div>
      </div>
      <div className={styles.playerCenter}>
        {canPlay ? <>
          <div className={styles.playerControls} role="group" aria-label="Playback controls">
            <button className={`${styles.playerButton} ${styles.playerSkipButton}`} type="button" onClick={onPrevious} aria-label="Previous version" disabled={onPrevious === undefined}><SkipBack /></button>
            <button className={`${styles.playerButton} ${styles.playerButtonPrimary}`} type="button" onClick={onToggle} aria-label={playing ? "Pause" : "Play"} aria-keyshortcuts="Space">
              {playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
            </button>
            <button className={`${styles.playerButton} ${styles.playerSkipButton}`} type="button" onClick={onNext} aria-label="Next version" disabled={onNext === undefined}><SkipForward /></button>
          </div>
          <div className={styles.playerProgress} role="group" aria-label="Playback progress">
            <span className={styles.time}>{formatDuration(positionSeconds)}</span>
            <div className={styles.playerSeek}>
              <Waveform seed={playableCandidate.waveformSeed} compact progress={playableCandidate.durationSeconds > 0 ? positionSeconds / playableCandidate.durationSeconds : 0} />
              <input
                className={styles.playerSeekInput}
                type="range"
                min={0}
                max={playableCandidate.durationSeconds}
                step={1}
                value={Math.min(positionSeconds, playableCandidate.durationSeconds)}
                onChange={(event) => onSeek(Number(event.target.value))}
                disabled={!canPlay}
                aria-label="Seek through current version"
              />
            </div>
            <span className={styles.time}>{formatDuration(playableCandidate.durationSeconds)}</span>
          </div>
        </> : <div className={styles.playerEmptyState} role="status" aria-live="polite">
          {hasCandidate ? <><strong>Preview audio is unavailable</strong><span>Choose another Version or keep shaping this one.</span></> : <><strong>Ready when you are</strong><span>Choose a Version to start listening.</span></>}
        </div>}
      </div>
      <div className={styles.playerTools} role="group" aria-label="Player tools">
        {canPlay ? <button className={`${styles.playerButton} ${styles.playerMuteButton}`} type="button" onClick={onToggleMute} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX /> : <Volume2 />}</button> : null}
        {onSelectQueue ? <button className={styles.playerTool} type="button" onClick={onSelectQueue} aria-label="Open playback queue" aria-haspopup="dialog" aria-expanded={queueOpen}><ListMusic /> <span>Up next</span></button> : null}
      </div>
    </section>
  )
}
