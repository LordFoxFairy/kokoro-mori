import { cropClip, insertClip, moveClip, setClipFades, splitClip, trimClip, type Composition, type CompositionTrack } from "./composition"
import type { CompositionHistory } from "./composition-history"
import { commitComposition } from "./composition-history"

export type CompositionEdit =
  | { operation: "move"; trackRef?: string; clipRef: string; startMs: number }
  | { operation: "trim"; trackRef?: string; clipRef: string; durationMs: number }
  | { operation: "crop"; trackRef?: string; clipRef: string; startOffsetMs: number; endOffsetMs: number }
  | { operation: "insert"; trackRef?: string; clip: CompositionTrack["clips"][number] }
  | { operation: "split"; trackRef?: string; clipRef: string; atMs: number }
  | { operation: "fade"; trackRef?: string; clipRef: string; fadeInMs: number; fadeOutMs: number }

export function applyCompositionEdit(history: CompositionHistory, edit: CompositionEdit): CompositionHistory {
  const trackRef = compositionTrackRefForEdit(history.present, edit)
  if (edit.operation === "insert" && history.present.tracks.some((track) => track.clips.some((clip) => clip.clipRef === edit.clip.clipRef))) throw new Error("composition_clip_exists")
  const tracks = history.present.tracks.map((track) => {
    if (track.trackRef !== trackRef) return track
    return edit.operation === "move" ? moveClip(track, edit.clipRef, edit.startMs)
      : edit.operation === "trim" ? trimClip(track, edit.clipRef, edit.durationMs)
        : edit.operation === "split" ? splitClip(track, edit.clipRef, edit.atMs)
          : edit.operation === "crop" ? cropClip(track, edit.clipRef, edit.startOffsetMs, edit.endOffsetMs)
            : edit.operation === "insert" ? insertClip(track, edit.clip)
              : setClipFades(track, edit.clipRef, edit.fadeInMs, edit.fadeOutMs)
  })
  return commitComposition(history, { tracks })
}

export function replaceCompositionTrack(history: CompositionHistory, track: CompositionTrack): CompositionHistory {
  const tracks = history.present.tracks.map((current) => current.trackRef === track.trackRef ? track : current)
  return commitComposition(history, { tracks })
}

export function compositionTrackRefForEdit(composition: Composition, edit: CompositionEdit): string {
  if (edit.trackRef !== undefined) {
    if (!composition.tracks.some((track) => track.trackRef === edit.trackRef)) throw new Error("composition_track_not_found")
    return edit.trackRef
  }
  if (edit.operation === "insert") {
    if (composition.tracks.length !== 1) throw new Error("composition_track_required")
    return composition.tracks[0]?.trackRef ?? ""
  }
  const matches = composition.tracks.filter((track) => track.clips.some((clip) => clip.clipRef === edit.clipRef))
  if (matches.length !== 1) throw new Error(matches.length === 0 ? "composition_clip_not_found" : "composition_clip_ambiguous")
  return matches[0]?.trackRef ?? ""
}
