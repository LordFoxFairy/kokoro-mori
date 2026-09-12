"use client"

import { useId } from "react"
import type { Candidate } from "../domain"
import {
  buildStudioTimelineTicks,
  createStudioTimelineRange,
  findStudioTimelineSection,
  formatStudioTimelineTime,
  minimumStudioTimelineSelectionMs,
  type StudioTimelineSection,
} from "../studio-change"
import { Waveform } from "./waveform"
import { CompositionLane, type CompositionInsertSource } from "./composition-lane"
import type { CompositionTrack } from "../composition"
import styles from "./studio-timeline.module.css"

type StudioTimelineProps = {
  candidate: Candidate
  sections: StudioTimelineSection[]
  selection: StudioTimelineSection
  positionSeconds: number
  playing: boolean
  disabled: boolean
  onSeek: (positionSeconds: number) => void
  onSelect: (selection: StudioTimelineSection) => void
  compositionTracks?: CompositionTrack[]
  selectedClipRef?: string
  selectedTrackRef?: string
  onSelectTrack?: (trackRef: string) => void
  onSelectClip?: (clipRef: string, trackRef: string) => void
  onEditClip?: (operation: "move" | "trim" | "split" | "crop" | "fade", clipRef: string, trackRef: string) => void
  onDuplicateClip?: (clipRef: string, trackRef: string) => void
  insertSources?: readonly CompositionInsertSource[]
  onInsertClip?: (sourceRef: string, trackRef: string) => void
}

export function StudioTimeline({ candidate, sections, selection, positionSeconds, playing, disabled, onSeek, onSelect, compositionTracks = [], selectedClipRef, selectedTrackRef, onSelectTrack, onSelectClip, onEditClip, onDuplicateClip, insertSources, onInsertClip }: StudioTimelineProps) {
  const sectionHintId = useId()
  const durationMs = Math.max(minimumStudioTimelineSelectionMs, Math.round(candidate.durationSeconds * 1_000))
  const positionMs = Math.max(0, Math.min(durationMs, Math.round(positionSeconds * 1_000)))
  const activeSection = findStudioTimelineSection(sections, positionMs)
  const ticks = buildStudioTimelineTicks(candidate.durationSeconds)
  const selectionLeft = (selection.startMs / durationMs) * 100
  const selectionWidth = ((selection.endMs - selection.startMs) / durationMs) * 100
  const playheadLeft = (positionMs / durationMs) * 100
  const selectionStartSeconds = Math.round(selection.startMs / 1_000)
  const selectionEndSeconds = Math.round(selection.endMs / 1_000)
  const minimumSelectionSeconds = minimumStudioTimelineSelectionMs / 1_000

  const selectCustomRange = (startSeconds: number, endSeconds: number) => {
    onSelect(createStudioTimelineRange(startSeconds * 1_000, endSeconds * 1_000, durationMs))
  }

  return (
    <section className={styles.timeline} aria-label="Version timeline" data-playing={playing ? "true" : "false"}>
      <header className={styles.header}>
        <div className={styles.title}>
          <span>Version timeline</span>
          <h3>Arrangement</h3>
        </div>
        <div className={styles.playbackContext} aria-live="polite">
          <strong>Playhead · {activeSection?.label ?? "Track"}</strong>
          <span>{formatStudioTimelineTime(positionMs)} / {formatStudioTimelineTime(durationMs)}</span>
        </div>
      </header>

      <div className={styles.ruler} aria-hidden="true">
        {ticks.map((tick) => <span key={tick}>{formatStudioTimelineTime(tick)}</span>)}
      </div>

      <div className={styles.waveformStage}>
        <div className={styles.waveform}><Waveform seed={candidate.waveformSeed} stretch progress={positionMs / durationMs} /></div>
        <span
          className={styles.selectionOverlay}
          style={{ left: `${selectionLeft}%`, width: `${selectionWidth}%` }}
          aria-hidden="true"
        />
        <span className={styles.playhead} style={{ left: `${playheadLeft}%` }} aria-hidden="true"><i /></span>
        <input
          className={styles.playheadInput}
          type="range"
          min={0}
          max={candidate.durationSeconds}
          step={1}
          value={Math.round(positionMs / 1_000)}
          aria-label="Timeline playhead"
          aria-valuetext={`${formatStudioTimelineTime(positionMs)} in ${activeSection?.label ?? "track"}`}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
      </div>

      {compositionTracks.length > 0 ? <CompositionLane tracks={compositionTracks} durationMs={durationMs} disabled={disabled} selectedClipRef={selectedClipRef} selectedTrackRef={selectedTrackRef} onSelectTrack={onSelectTrack} onSelectClip={onSelectClip} onEditClip={onEditClip} onDuplicateClip={onDuplicateClip} insertSources={insertSources} onInsertClip={onInsertClip} /> : null}

      <div className={styles.segmentRail}>
        <div
          className={styles.segmentScroller}
          role="region"
          aria-label="Arrangement sections"
          aria-describedby={sectionHintId}
          tabIndex={0}
        >
          <div className={styles.segments}>
            {sections.map((section) => {
              const selected = selection.id === section.id
              const underPlayhead = activeSection?.id === section.id
              return (
                <button
                  className={styles.segment}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`Select ${section.label} section`}
                  data-playhead={underPlayhead ? "true" : "false"}
                  disabled={disabled}
                  key={section.id}
                  onClick={() => onSelect(section)}
                  style={{ flexGrow: section.weight }}
                >
                  <span>{section.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <p className={styles.segmentScrollHint} id={sectionHintId}>
          <span className={styles.segmentScrollHintIcon} aria-hidden="true">↔</span>
          <span>Swipe horizontally to see all sections</span>
        </p>
      </div>

      <footer className={styles.rangeEditor}>
        <div className={styles.rangeSummary}>
          <span>AI edit range</span>
          <strong>{selection.label}</strong>
        </div>
        <span className={styles.rangeTime}>
          {formatStudioTimelineTime(selection.startMs)}–{formatStudioTimelineTime(selection.endMs)}
        </span>
        <div className={styles.rangeControls}>
          <label>
            <span>Start</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, selectionEndSeconds - minimumSelectionSeconds)}
              step={1}
              value={selectionStartSeconds}
              aria-label="Selection start"
              disabled={disabled}
              onChange={(event) => selectCustomRange(Number(event.target.value), selectionEndSeconds)}
            />
          </label>
          <label>
            <span>End</span>
            <input
              type="range"
              min={Math.min(candidate.durationSeconds, selectionStartSeconds + minimumSelectionSeconds)}
              max={candidate.durationSeconds}
              step={1}
              value={selectionEndSeconds}
              aria-label="Selection end"
              disabled={disabled}
              onChange={(event) => selectCustomRange(selectionStartSeconds, Number(event.target.value))}
            />
          </label>
        </div>
      </footer>
    </section>
  )
}
