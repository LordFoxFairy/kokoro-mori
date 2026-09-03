"use client"

import { ListMusic, Pause, Play, X } from "lucide-react"
import { useEffect, useRef } from "react"
import type { Candidate } from "../domain"
import styles from "../mori-workspace.module.css"

type PlaybackQueueProps = {
  candidates: Candidate[]
  currentCandidateRef: string | null
  playing: boolean
  onChoose: (candidate: Candidate) => void
  onClose: () => void
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`
}

export function PlaybackQueue({ candidates, currentCandidateRef, playing, onChoose, onClose }: PlaybackQueueProps) {
  const queueRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    queueRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose])

  return (
    <div className={styles.playbackQueueLayer}>
      <button className={styles.playbackQueueBackdrop} type="button" aria-label="Dismiss playback queue" onClick={onClose} />
      <aside ref={queueRef} className={styles.playbackQueuePanel} role="dialog" aria-labelledby="playback-queue-title" tabIndex={-1}>
        <header className={styles.playbackQueueHeader}>
          <div>
            <span><ListMusic size={14} /> Listening queue</span>
            <h2 id="playback-queue-title">Up next</h2>
          </div>
          <button className={styles.playbackQueueClose} type="button" onClick={onClose} aria-label="Close playback queue"><X /></button>
        </header>

        <div className={styles.playbackQueueList}>
          {candidates.map((candidate, index) => {
            const current = candidate.candidateRef === currentCandidateRef
            return (
              <button
                className={`${styles.playbackQueueItem} ${current ? styles.playbackQueueItemCurrent : ""}`}
                type="button"
                key={candidate.candidateRef}
                onClick={() => onChoose(candidate)}
                aria-label={`${current && playing ? "Pause" : "Play"} ${candidate.title} from queue`}
              >
                <span className={`${styles.playbackQueueArtwork} ${index % 3 === 1 ? styles.playbackQueueArtworkPeach : index % 3 === 2 ? styles.playbackQueueArtworkMint : ""}`} aria-hidden="true">
                  {current && playing ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
                </span>
                <span className={styles.playbackQueueCopy}>
                  <strong>{candidate.title}</strong>
                  <small>{candidate.subtitle}</small>
                </span>
                <span className={styles.playbackQueueState}>
                  {current ? <b>{playing ? "Playing" : "Current"}</b> : null}
                  <small>{formatDuration(candidate.durationSeconds)}</small>
                </span>
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
