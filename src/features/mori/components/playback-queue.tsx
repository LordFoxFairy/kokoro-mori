"use client"

import { ListMusic, Pause, Play, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const mobileViewportRef = useRef(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    const updateViewport = () => {
      const nextIsMobileViewport = window.innerWidth <= 700
      mobileViewportRef.current = nextIsMobileViewport
      setIsMobileViewport(nextIsMobileViewport)
    }
    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    queueRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab" || !mobileViewportRef.current) return

      const focusableElements = Array.from(queueRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [])
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (first === undefined || last === undefined) return

      const activeElement = document.activeElement
      if (!queueRef.current?.contains(activeElement)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      } else if (event.shiftKey && (activeElement === first || activeElement === queueRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (activeElement === last || activeElement === queueRef.current)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    if (isMobileViewport) document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileViewport])

  return (
    <div className={styles.playbackQueueLayer}>
      <button className={styles.playbackQueueBackdrop} type="button" aria-label="Dismiss playback queue" onClick={onClose} />
      <aside ref={queueRef} className={styles.playbackQueuePanel} role="dialog" aria-modal={isMobileViewport ? "true" : undefined} aria-labelledby="playback-queue-title" tabIndex={-1}>
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
