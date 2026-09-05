import type { CompositionTrack } from "./composition"

export type CompositionHistory = { past: CompositionTrack[]; present: CompositionTrack; future: CompositionTrack[] }

export function createCompositionHistory(initial: CompositionTrack): CompositionHistory {
  return { past: [], present: initial, future: [] }
}

export function commitComposition(history: CompositionHistory, next: CompositionTrack): CompositionHistory {
  if (next === history.present) return history
  return { past: [...history.past, history.present], present: next, future: [] }
}

export function undoComposition(history: CompositionHistory): CompositionHistory {
  const previous = history.past.at(-1)
  return previous === undefined
    ? history
    : { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] }
}

export function redoComposition(history: CompositionHistory): CompositionHistory {
  const next = history.future[0]
  return next === undefined
    ? history
    : { past: [...history.past, history.present], present: next, future: history.future.slice(1) }
}
