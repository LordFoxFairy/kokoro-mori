"use client"

import { Pause, Play, Plus } from "lucide-react"
import { useState } from "react"
import type { CompositionClip, CompositionTrack, CompositionTrackMix } from "../composition"
import { CompositionTrackMixPanel } from "./composition-track-mix-panel"
import styles from "./composition-lane.module.css"

export type CompositionInsertSource = { sourceRef: string; label: string; description: string; durationMs: number }

type CompositionLaneProps = {
  tracks: CompositionTrack[]
  durationMs: number
  disabled?: boolean
  selectedClipRef?: string
  selectedTrackRef?: string
  onSelectTrack?: (trackRef: string) => void
  onSelectClip?: (clipRef: string, trackRef: string) => void
  onEditClip?: (operation: "move" | "trim" | "split" | "crop" | "fade", clipRef: string, trackRef: string) => void
  onMoveClip?: (clipRef: string, sourceTrackRef: string, startMs: number, targetTrackRef?: string) => void
  onDeleteClip?: (clipRef: string, trackRef: string) => void
  onDuplicateClip?: (clipRef: string, trackRef: string) => void
  onEditTrackMix?: (trackRef: string, mix: CompositionTrackMix) => void
  onPreviewClip?: (clipRef: string, trackRef: string) => void
  previewingClip?: boolean
  isClipPreviewable?: (clip: CompositionClip, track: CompositionTrack) => boolean
  insertSources?: readonly CompositionInsertSource[]
  onInsertClip?: (sourceRef: string, trackRef: string) => void
  dropSources?: readonly CompositionInsertSource[]
  onDropSource?: (sourceRef: string, trackRef: string, startMs: number) => void
  resolveClipLabel?: (clip: CompositionClip, track: CompositionTrack) => string
}

export function CompositionLane({ tracks, durationMs, disabled = false, selectedClipRef, selectedTrackRef, onSelectTrack, onSelectClip, onEditClip, onMoveClip, onDeleteClip, onDuplicateClip, onEditTrackMix, onPreviewClip, previewingClip = false, isClipPreviewable, onInsertClip, insertSources = [], dropSources = [], onDropSource, resolveClipLabel }: CompositionLaneProps) {
  const [insertOpen, setInsertOpen] = useState(false)
  const [dropTrackRef, setDropTrackRef] = useState<string | null>(null)
  const [dropKind, setDropKind] = useState<"clip" | "source" | null>(null)
  const selectedTrack = selectedTrackRef === undefined ? undefined : tracks.find((track) => track.trackRef === selectedTrackRef)
  const activeTrack = selectedTrack?.clips.some((clip) => clip.clipRef === selectedClipRef) ? selectedTrack : undefined
  const activeClip = activeTrack === undefined || selectedClipRef === undefined ? undefined : activeTrack.clips.find((clip) => clip.clipRef === selectedClipRef)
  const clipPreviewable = activeClip !== undefined && activeTrack !== undefined && (isClipPreviewable?.(activeClip, activeTrack) ?? true)
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
    {selectedClipRef !== undefined && activeTrack !== undefined && (onEditClip !== undefined || onDeleteClip !== undefined || onDuplicateClip !== undefined || onPreviewClip !== undefined) ? <nav className={styles.actions} aria-label={`Clip editing actions for ${activeTrack.name}`}>
      {onPreviewClip !== undefined ? <button disabled={disabled || !clipPreviewable} type="button" aria-pressed={previewingClip} aria-label={previewingClip ? "Pause clip preview" : "Preview selected clip"} onClick={() => onPreviewClip(selectedClipRef, activeTrack.trackRef)}>{previewingClip ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />} {previewingClip ? "Pause clip" : "Preview clip"}</button> : null}
      {onEditClip !== undefined ? (["move", "trim", "split", "crop", "fade"] as const).map((operation) => <button disabled={disabled} key={operation} type="button" onClick={() => onEditClip(operation, selectedClipRef, activeTrack.trackRef)}>{operation[0]?.toUpperCase()}{operation.slice(1)}</button>) : null}
      {onDeleteClip !== undefined ? <button disabled={disabled} type="button" onClick={() => onDeleteClip(selectedClipRef, activeTrack.trackRef)} title="Remove clip (Delete)">Remove</button> : null}
      {onDuplicateClip !== undefined ? <button disabled={disabled} type="button" onClick={() => onDuplicateClip(selectedClipRef, activeTrack.trackRef)}>Duplicate</button> : null}
    </nav> : null}
    <div className={styles.tracks}>
      {tracks.map((track) => <div className={styles.track} data-active={selectedTrack?.trackRef === track.trackRef ? "true" : "false"} key={track.trackRef}>
        <button className={styles.trackName} type="button" aria-pressed={selectedTrackRef === track.trackRef} aria-label={`Select ${track.name} track`} disabled={disabled} onClick={() => onSelectTrack?.(track.trackRef)}>{track.name}</button>
        <div
          className={styles.clipRail}
          data-drop-target={dropTrackRef === track.trackRef ? "true" : "false"}
          data-drop-kind={dropTrackRef === track.trackRef ? dropKind ?? undefined : undefined}
          aria-label={`Move clips or drop audio into ${track.name} timeline`}
          onDragOver={(event) => {
            if (disabled) return
            const payload = readClipDragPayload(event.dataTransfer)
            const sourceTrack = payload === null ? undefined : tracks.find((item) => item.trackRef === payload.trackRef)
            if (payload !== null && sourceTrack?.clips.some((clip) => clip.clipRef === payload.clipRef) === true && onMoveClip !== undefined) {
              event.preventDefault()
              event.dataTransfer.dropEffect = "move"
              setDropTrackRef(track.trackRef)
              setDropKind("clip")
              return
            }
            const sourcePayload = readSourceDragPayload(event.dataTransfer)
            if (sourcePayload === null || onDropSource === undefined || dropSources.some((source) => source.sourceRef === sourcePayload.sourceRef) !== true) return
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
            setDropTrackRef(track.trackRef)
            setDropKind("source")
          }}
          onDrop={(event) => {
            if (disabled) return
            const payload = readClipDragPayload(event.dataTransfer)
            const sourceTrack = payload === null ? undefined : tracks.find((item) => item.trackRef === payload.trackRef)
            const clip = sourceTrack?.clips.find((item) => item.clipRef === payload?.clipRef)
            const width = event.currentTarget.getBoundingClientRect().width
            if (width <= 0) return
            const rawStartMs = ((event.clientX - event.currentTarget.getBoundingClientRect().left) / width) * durationMs
            if (sourceTrack !== undefined && clip !== undefined && onMoveClip !== undefined) {
              event.preventDefault()
              const maxStartMs = Math.max(0, durationMs - clip.durationMs)
              const startMs = snapDropStart(rawStartMs, maxStartMs)
              if (track.trackRef === sourceTrack.trackRef) onMoveClip(clip.clipRef, sourceTrack.trackRef, startMs)
              else onMoveClip(clip.clipRef, sourceTrack.trackRef, startMs, track.trackRef)
              setDropTrackRef(null)
              setDropKind(null)
              return
            }
            const sourcePayload = readSourceDragPayload(event.dataTransfer)
            const source = sourcePayload === null ? undefined : dropSources.find((item) => item.sourceRef === sourcePayload.sourceRef)
            if (source === undefined || onDropSource === undefined) return
            event.preventDefault()
            const maxStartMs = Math.max(0, durationMs - Math.max(1_000, source.durationMs))
            onDropSource(source.sourceRef, track.trackRef, snapDropStart(rawStartMs, maxStartMs))
            setDropTrackRef(null)
            setDropKind(null)
          }}
          onDragLeave={() => { setDropTrackRef(null); setDropKind(null) }}
        >
          {track.clips.map((clip) => {
            const label = resolveClipLabel?.(clip, track).trim() || defaultClipLabel(clip)
            const durationLabel = formatClipDuration(clip.durationMs)
            return <button
              className={styles.clip}
              data-selected={selectedTrackRef === track.trackRef && selectedClipRef === clip.clipRef ? "true" : "false"}
              key={clip.clipRef}
              type="button"
              draggable={onMoveClip !== undefined && !disabled}
              aria-label={`${track.name} clip ${label} · ${durationLabel}`}
              title={`${label} · ${durationLabel}`}
              disabled={disabled}
              onClick={() => onSelectClip?.(clip.clipRef, track.trackRef)}
              onDragStart={(event) => {
                if (onMoveClip === undefined || disabled) return
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData(clipDragMimeType, JSON.stringify({ clipRef: clip.clipRef, trackRef: track.trackRef }))
              }}
              onDragEnd={() => { setDropTrackRef(null); setDropKind(null) }}
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
    {selectedTrack !== undefined && onEditTrackMix !== undefined ? <CompositionTrackMixPanel key={`${selectedTrack.trackRef}:${selectedTrack.gain ?? "default"}:${selectedTrack.pan ?? "default"}:${selectedTrack.muted ?? "default"}`} track={selectedTrack} disabled={disabled} onApply={(mix) => onEditTrackMix(selectedTrack.trackRef, mix)} /> : null}
  </section>
}

const clipDragMimeType = "application/x-mori-composition-clip"
export const compositionSourceDragMimeType = "application/x-mori-composition-source"

function readSourceDragPayload(dataTransfer: DataTransfer): { sourceRef: string } | null {
  try {
    const raw = dataTransfer.getData(compositionSourceDragMimeType)
    if (raw === "") return null
    const value = JSON.parse(raw) as { sourceRef?: unknown }
    return typeof value.sourceRef === "string" && value.sourceRef.trim() !== "" ? { sourceRef: value.sourceRef } : null
  } catch {
    return null
  }
}

function snapDropStart(rawStartMs: number, maxStartMs: number): number {
  return Math.min(maxStartMs, Math.max(0, Math.round(rawStartMs / 100) * 100))
}

function readClipDragPayload(dataTransfer: DataTransfer): { clipRef: string; trackRef: string } | null {
  try {
    const raw = dataTransfer.getData(clipDragMimeType)
    if (raw === "") return null
    const value = JSON.parse(raw) as { clipRef?: unknown; trackRef?: unknown }
    return typeof value.clipRef === "string" && value.clipRef.trim() !== "" && typeof value.trackRef === "string" && value.trackRef.trim() !== ""
      ? { clipRef: value.clipRef, trackRef: value.trackRef }
      : null
  } catch {
    return null
  }
}

function formatClipDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`
}

function defaultClipLabel(clip: CompositionClip): string {
  const suffix = /:([ab])$/u.exec(clip.clipRef)?.[1]
  return suffix === undefined ? "Audio clip" : `Audio clip ${suffix.toUpperCase()}`
}
