import type { CompositionTrack } from "../composition"
import styles from "./composition-lane.module.css"

type CompositionLaneProps = { tracks: CompositionTrack[]; durationMs: number; selectedClipRef?: string; onSelectClip?: (clipRef: string) => void; onEditClip?: (operation: "move" | "trim" | "split" | "crop" | "fade", clipRef: string) => void; onDuplicateClip?: (clipRef: string) => void }

export function CompositionLane({ tracks, durationMs, selectedClipRef, onSelectClip, onEditClip, onDuplicateClip }: CompositionLaneProps) {
  return <section className={styles.lane} aria-label="Composition tracks">
    <header><span>Composition</span><strong>{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</strong></header>
    {selectedClipRef !== undefined && onEditClip !== undefined ? <nav className={styles.actions} aria-label="Clip editing actions">
      {(["move", "trim", "split", "crop", "fade"] as const).map((operation) => <button key={operation} type="button" onClick={() => onEditClip(operation, selectedClipRef)}>{operation[0]?.toUpperCase()}{operation.slice(1)}</button>)}
      {onDuplicateClip !== undefined ? <button type="button" onClick={() => onDuplicateClip(selectedClipRef)}>Duplicate</button> : null}
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
            onClick={() => onSelectClip?.(clip.clipRef)}
            style={{ left: `${(clip.startMs / durationMs) * 100}%`, width: `${(clip.durationMs / durationMs) * 100}%` }}
          ><span>{clip.clipRef}</span></button>)}
        </div>
      </div>)}
    </div>
  </section>
}
