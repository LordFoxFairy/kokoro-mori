import { moveClip, setClipFades, splitClip, trimClip, type CompositionTrack } from "./composition"
import type { CompositionHistory } from "./composition-history"
import { commitComposition } from "./composition-history"

export type CompositionEdit =
  | { operation: "move"; clipRef: string; startMs: number }
  | { operation: "trim"; clipRef: string; durationMs: number }
  | { operation: "split"; clipRef: string; atMs: number }
  | { operation: "fade"; clipRef: string; fadeInMs: number; fadeOutMs: number }

export function applyCompositionEdit(history: CompositionHistory, edit: CompositionEdit): CompositionHistory {
  const next = edit.operation === "move" ? moveClip(history.present, edit.clipRef, edit.startMs)
    : edit.operation === "trim" ? trimClip(history.present, edit.clipRef, edit.durationMs)
      : edit.operation === "split" ? splitClip(history.present, edit.clipRef, edit.atMs)
        : setClipFades(history.present, edit.clipRef, edit.fadeInMs, edit.fadeOutMs)
  return commitComposition(history, next)
}

export function replaceCompositionTrack(history: CompositionHistory, track: CompositionTrack): CompositionHistory {
  const tracks = history.present.trackRef === track.trackRef ? track : history.present
  return commitComposition(history, tracks)
}
