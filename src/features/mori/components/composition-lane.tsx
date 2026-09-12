"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import type { CompositionTrack } from "../composition"
import styles from "./composition-lane.module.css"

export type CompositionInsertSource = { sourceRef: string; label: string; description: string; durationMs: number }

type CompositionLaneProps = { tracks: CompositionTrack[]; durationMs: number; disabled?: boolean; selectedClipRef?: string; selectedTrackRef?: string; onSelectClip?: (clipRef: string, trackRef: string) => void; onEditClip?: (operation: "move" | "trim" | "split" | "crop" | "fade", clipRef: string, trackRef: string) => void; onDuplicateClip?: (clipRef: string, trackRef: string) => void; insertSources?: readonly CompositionInsertSource[]; onInsertClip?: (sourceRef: string, trackRef: string) => void }

export function CompositionLane({ tracks, durationMs, disabled = false, selectedClipRef, selectedTrackRef, onSelectClip, onEditClip, onDuplicateClip, insertSources = [], onInsertClip }: CompositionLaneProps) {
  const [insertOpen, setInsertOpen] = useState(false)
  const canInsert = onInsertClip !== undefined && insertSources.length > 0

  return <section className={styles.lane} aria-label="Composition tracks">
    <header>
      <div className={styles.headerCopy}><span>Composition</span><strong>{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</strong></div>
      {canInsert ? <div className={styles.insertControl}>
        <button className={styles.insertToggle} type="button" aria-expanded={insertOpen} disabled={disabled} onClick={() => setInsertOpen((open) => !open)}><Plus size={12} /> Add clip</button>
        {insertOpen ? <div className={styles.insertPanel} role="group" aria-label="Insert a clip">
          <span>Insert into selected range</span>
          <div className={styles.insertOptions}>
            {insertSources.map((source) => <button className={styles.insertOption} type="button" key={source.sourceRef} aria-label={`Insert ${source.label} into selected range`} onClick={() => { const trackRef = selectedTrackRef ?? tracks[0]?.trackRef; if (trackRef !== undefined) onInsertClip?.(source.sourceRef, trackRef); setInsertOpen(false) }}>
              <span><strong>{source.label}</strong><small>{source.description}</small></span>
              <span>{formatClipDuration(source.durationMs)}</span>
            </button>)}
          </div>
        </div> : null}
      </div> : null}
    </header>
    {selectedClipRef !== undefined && onEditClip !== undefined ? <nav className={styles.actions} aria-label="Clip editing actions">
      {(["move", "trim", "split", "crop", "fade"] as const).map((operation) => <button disabled={disabled} key={operation} type="button" onClick={() => { const track = tracks.find((item) => item.trackRef === selectedTrackRef && item.clips.some((clip) => clip.clipRef === selectedClipRef)) ?? tracks.find((item) => item.clips.some((clip) => clip.clipRef === selectedClipRef)); if (track !== undefined) onEditClip(operation, selectedClipRef, track.trackRef) }}>{operation[0]?.toUpperCase()}{operation.slice(1)}</button>)}
      {onDuplicateClip !== undefined ? <button disabled={disabled} type="button" onClick={() => { const track = tracks.find((item) => item.trackRef === selectedTrackRef && item.clips.some((clip) => clip.clipRef === selectedClipRef)) ?? tracks.find((item) => item.clips.some((clip) => clip.clipRef === selectedClipRef)); if (track !== undefined) onDuplicateClip(selectedClipRef, track.trackRef) }}>Duplicate</button> : null}
    </nav> : null}
    <div className={styles.tracks}>
      {tracks.map((track) => <div className={styles.track} key={track.trackRef}>
        <span className={styles.trackName}>{track.name}</span>
        <div className={styles.clipRail}>
          {track.clips.map((clip) => <button
            className={styles.clip}
            data-selected={selectedClipRef === clip.clipRef ? "true" : "false"}
            key={clip.clipRef}
            type="button"
            aria-label={`${track.name} clip ${clip.clipRef}`}
            disabled={disabled}
            onClick={() => onSelectClip?.(clip.clipRef, track.trackRef)}
            style={{ left: `${(clip.startMs / durationMs) * 100}%`, width: `${(clip.durationMs / durationMs) * 100}%` }}
          ><span>{clip.clipRef}</span></button>)}
        </div>
      </div>)}
    </div>
  </section>
}

function formatClipDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`
}
