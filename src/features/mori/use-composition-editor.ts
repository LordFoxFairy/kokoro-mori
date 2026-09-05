"use client"

import { useCallback, useState } from "react"
import type { CompositionTrack } from "./composition"
import { applyCompositionEdit, type CompositionEdit } from "./composition-editor"
import { createCompositionHistory, redoComposition, undoComposition, type CompositionHistory } from "./composition-history"

export function useCompositionEditor(initial: CompositionTrack) {
  const [history, setHistory] = useState<CompositionHistory>(() => createCompositionHistory(initial))
  const edit = useCallback((change: CompositionEdit) => setHistory((current) => applyCompositionEdit(current, change)), [])
  const undo = useCallback(() => setHistory((current) => undoComposition(current)), [])
  const redo = useCallback(() => setHistory((current) => redoComposition(current)), [])
  return { composition: history.present, canUndo: history.past.length > 0, canRedo: history.future.length > 0, edit, undo, redo }
}
