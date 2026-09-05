import type { CompositionTrack } from "../composition"
import styles from "./composition-lane.module.css"

type CompositionLaneProps = { tracks: CompositionTrack[]; durationMs: number; selectedClipRef?: string; onSelectClip?: (clipRef: string) => void }

export function CompositionLane({ tracks, durationMs, selectedClipRef, onSelectClip }: CompositionLaneProps) {
  return <section className={styles.lane} aria-label="Composition tracks">
    <header><span>Composition</span><strong>{tracks.length} {tracks.length === 1 ? "track" : "tracks"}</strong></header>
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
