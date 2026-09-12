"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import type { CompositionClip, CompositionTrack } from "../composition"
import styles from "./composition-lane.module.css"

export type CompositionInsertSource = { sourceRef: string; label: string; description: string; durationMs: number }

type CompositionLaneProps = { tracks: CompositionTrack[]; durationMs: number; disabled?: boolean; selectedClipRef?: string; selectedTrackRef?: string; onSelectTrack?: (trackRef: string) => void; onSelectClip?: (clipRef: string, trackRef: string) => void; onEditClip?: (operation: "move" | "trim" | "split" | "crop" | "fade", clipRef: string, trackRef: string) => void; onDeleteClip?: (clipRef: string, trackRef: string) => void; onDuplicateClip?: (clipRef: string, trackRef: string) => void; insertSources?: readonly CompositionInsertSource[]; onInsertClip?: (sourceRef: string, trackRef: string) => void; resolveClipLabel?: (clip: CompositionClip, track: CompositionTrack) => string }

export function CompositionLane({ tracks, durationMs, disabled = false, selectedClipRef, selectedTrackRef, onSelectTrack, onSelectClip, onEditClip, onDeleteClip, onDuplicateClip, insertSources = [], onInsertClip, resolveClipLabel }: CompositionLaneProps) {
  const [insertOpen, setInsertOpen] = useState(false)
  const selectedTrack = selectedTrackRef === undefined ? undefined : tracks.find((track) => track.trackRef === selectedTrackRef)
  const activeTrack = selectedTrack?.clips.some((clip) => clip.clipRef === selectedClipRef) ? selectedTrack : undefined
  const insertTrack = selectedTrack
  const canInsert = onInsertClip !== undefined && insertSources.length > 0 && insertTrack !== undefined

  return <section className={styles.lane} aria-label="Composition tracks">
    <header>
      <div className={styles.headerCopy}><span>Composition</span><strong>{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</strong></div>
      {canInsert ? <div className={styles.insertControl}>
        <button className={styles.insertToggle} type="button" aria-expanded={insertOpen} disabled={disabled} onClick={() => setInsertOpen((open) => !open)}><Plus size={12} /> Add clip</button>
        {insertOpen ? <div className={styles.insertPanel} role="group" aria-label="Insert a clip">
          <span>Insert into selected range</span>
          <div className={styles.insertOptions}>
            {insertSources.map((source) => <button className={styles.insertOption} type="button" key={source.sourceRef} aria-label={`Insert ${source.label} into selected range`} onClick={() => { if (insertTrack !== undefined) onInsertClip?.(source.sourceRef, insertTrack.trackRef); setInsertOpen(false) }}>
              <span><strong>{source.label}</strong><small>{source.description}</small></span>
              <span>{formatClipDuration(source.durationMs)}</span>
            </button>)}
          </div>
        </div> : null}
      </div> : null}
    </header>
    {selectedClipRef !== undefined && activeTrack !== undefined && (onEditClip !== undefined || onDeleteClip !== undefined) ? <nav className={styles.actions} aria-label={`Clip editing actions for ${activeTrack.name}`}>
      {onEditClip !== undefined ? (["move", "trim", "split", "crop", "fade"] as const).map((operation) => <button disabled={disabled} key={operation} type="button" onClick={() => onEditClip(operation, selectedClipRef, activeTrack.trackRef)}>{operation[0]?.toUpperCase()}{operation.slice(1)}</button>) : null}
      {onDeleteClip !== undefined ? <button disabled={disabled} type="button" onClick={() => onDeleteClip(selectedClipRef, activeTrack.trackRef)} title="Remove clip (Delete)">Remove</button> : null}
      {onDuplicateClip !== undefined ? <button disabled={disabled} type="button" onClick={() => onDuplicateClip(selectedClipRef, activeTrack.trackRef)}>Duplicate</button> : null}
    </nav> : null}
    <div className={styles.tracks}>
      {tracks.map((track) => <div className={styles.track} data-active={selectedTrack?.trackRef === track.trackRef ? "true" : "false"} key={track.trackRef}>
        <button className={styles.trackName} type="button" aria-pressed={selectedTrackRef === track.trackRef} aria-label={`Select ${track.name} track`} disabled={disabled} onClick={() => onSelectTrack?.(track.trackRef)}>{track.name}</button>
        <div className={styles.clipRail}>
          {track.clips.map((clip) => {
            const label = resolveClipLabel?.(clip, track).trim() || defaultClipLabel(clip)
            const durationLabel = formatClipDuration(clip.durationMs)
            return <button
              className={styles.clip}
              data-selected={selectedTrackRef === track.trackRef && selectedClipRef === clip.clipRef ? "true" : "false"}
              key={clip.clipRef}
              type="button"
              aria-label={`${track.name} clip ${label} · ${durationLabel}`}
              title={`${label} · ${durationLabel}`}
              disabled={disabled}
              onClick={() => onSelectClip?.(clip.clipRef, track.trackRef)}
              onKeyDown={(event) => {
                if ((event.key === "Delete" || event.key === "Backspace") && onDeleteClip !== undefined && !disabled) {
                  event.preventDefault()
                  onDeleteClip(clip.clipRef, track.trackRef)
                }
              }}
              style={{ left: `${(clip.startMs / durationMs) * 100}%`, width: `${(clip.durationMs / durationMs) * 100}%` }}
            ><span>{label}</span><small>{durationLabel}</small></button>
          })}
        </div>
      </div>)}
    </div>
  </section>
}

function formatClipDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`
}

function defaultClipLabel(clip: CompositionClip): string {
  const suffix = /:([ab])$/u.exec(clip.clipRef)?.[1]
  return suffix === undefined ? "Audio clip" : `Audio clip ${suffix.toUpperCase()}`
}
