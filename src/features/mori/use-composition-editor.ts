"use client"

import { useCallback, useRef, useState } from "react"
import type { Composition } from "./composition"
import { applyCompositionEdit, compositionTrackRefForEdit, type CompositionEdit } from "./composition-editor"
import { createCompositionHistory, redoComposition, undoComposition, type CompositionHistory } from "./composition-history"
import { createCompositionRevisionInput, compositionEditToCommand, replayCompositionCommands } from "./composition-command"
import type { CompositionRevisionInput } from "./composition-command"

export function useCompositionEditor(initial: Composition, save?: (input: CompositionRevisionInput) => Promise<{ revision: number } | void>, expectedRevision = 0) {
  const [history, setHistory] = useState<CompositionHistory>(() => createCompositionHistory(initial))
  const historyRef = useRef(history)
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "conflict" | "failed">("saved")
  const [pendingCommands, setPendingCommands] = useState<CompositionRevisionInput["commands"]>([])
  const revisionRef = useRef(expectedRevision)
  const commitHistory = useCallback((next: CompositionHistory) => { historyRef.current = next; setHistory(next) }, [])
  const edit = useCallback((change: CompositionEdit) => commitHistory(applyCompositionEdit(historyRef.current, change)), [commitHistory])
  const editAndQueue = useCallback((change: CompositionEdit) => {
    const trackRef = compositionTrackRefForEdit(historyRef.current.present, change)
    const nextChange = change.trackRef === undefined ? { ...change, trackRef } : change
    commitHistory(applyCompositionEdit(historyRef.current, nextChange))
    setPendingCommands((current) => [...current, compositionEditToCommand(nextChange, historyRef.current.present)])
    setSaveState("unsaved")
  }, [commitHistory])
  const persist = useCallback(async () => {
    if (save === undefined || pendingCommands.length === 0) return
    setSaveState("saving")
    try {
      const response = await save(createCompositionRevisionInput(revisionRef.current, pendingCommands))
      revisionRef.current = response?.revision ?? revisionRef.current + 1
      setPendingCommands([])
      setSaveState("saved")
    } catch (error) {
      setSaveState(error instanceof Error && error.message === "composition_conflict" ? "conflict" : "failed")
    }
  }, [pendingCommands, save])
  const rebase = useCallback((latest: Composition, nextRevision: number) => {
    revisionRef.current = nextRevision
    const next = createCompositionHistory(replayCompositionCommands(latest, pendingCommands))
    historyRef.current = next
    setHistory(next)
    setPendingCommands([])
    setSaveState("unsaved")
  }, [pendingCommands])
  const undo = useCallback(() => commitHistory(undoComposition(historyRef.current)), [commitHistory])
  const redo = useCallback(() => commitHistory(redoComposition(historyRef.current)), [commitHistory])
  return { composition: history.present.tracks, canUndo: history.past.length > 0, canRedo: history.future.length > 0, edit, editAndQueue, undo, redo, saveState, persist, rebase }
}
