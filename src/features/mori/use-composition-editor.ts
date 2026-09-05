"use client"

import { useCallback, useState } from "react"
import type { CompositionTrack } from "./composition"
import { applyCompositionEdit, type CompositionEdit } from "./composition-editor"
import { createCompositionHistory, redoComposition, undoComposition, type CompositionHistory } from "./composition-history"
import { createCompositionRevisionInput, compositionEditToCommand } from "./composition-command"
import type { CompositionRevisionInput } from "./composition-command"

export function useCompositionEditor(initial: CompositionTrack, save?: (input: CompositionRevisionInput) => Promise<void>) {
  const [history, setHistory] = useState<CompositionHistory>(() => createCompositionHistory(initial))
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "failed">("saved")
  const [pendingCommands, setPendingCommands] = useState<CompositionRevisionInput["commands"]>([])
  const edit = useCallback((change: CompositionEdit) => setHistory((current) => applyCompositionEdit(current, change)), [])
  const editAndQueue = useCallback((change: CompositionEdit) => { edit(change); setPendingCommands((current) => [...current, compositionEditToCommand(change)]); setSaveState("unsaved") }, [edit])
  const persist = useCallback(async () => {
    if (save === undefined || pendingCommands.length === 0) return
    setSaveState("saving")
    try { await save(createCompositionRevisionInput(0, pendingCommands)); setPendingCommands([]); setSaveState("saved") } catch { setSaveState("failed") }
  }, [pendingCommands, save])
  const undo = useCallback(() => setHistory((current) => undoComposition(current)), [])
  const redo = useCallback(() => setHistory((current) => redoComposition(current)), [])
  return { composition: history.present, canUndo: history.past.length > 0, canRedo: history.future.length > 0, edit, editAndQueue, undo, redo, saveState, persist }
}
