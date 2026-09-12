"use client"

import { useCallback, useRef, useState } from "react"
import type { Composition } from "./composition"
import { applyCompositionEdit, compositionTrackRefForEdit, type CompositionEdit } from "./composition-editor"
import { commitComposition, createCompositionHistory, redoComposition, undoComposition, type CompositionHistory } from "./composition-history"
import { createCompositionRevisionInput, compositionEditToCommand, replayCompositionCommands } from "./composition-command"
import type { CompositionRevisionInput } from "./composition-command"

type CompositionSaveResult = { revision: number; composition?: Composition }
type CompositionSave = (input: CompositionRevisionInput, idempotencyKey: string) => Promise<CompositionSaveResult | void>

export function useCompositionEditor(initial: Composition, save?: CompositionSave, expectedRevision = 0) {
  const [history, setHistory] = useState<CompositionHistory>(() => createCompositionHistory(initial))
  const historyRef = useRef(history)
  const savedCompositionRef = useRef(initial)
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "conflict" | "failed">("saved")
  const pendingCommandsRef = useRef<CompositionRevisionInput["commands"]>([])
  const redoCommandsRef = useRef<CompositionRevisionInput["commands"]>([])
  const queuedHistoryDepthRef = useRef(0)
  const saveInFlightRef = useRef(false)
  const idempotencyKeyRef = useRef<string | null>(null)
  const revisionRef = useRef(expectedRevision)
  const commitHistory = useCallback((next: CompositionHistory) => { historyRef.current = next; setHistory(next) }, [])
  const edit = useCallback((change: CompositionEdit) => commitHistory(applyCompositionEdit(historyRef.current, change)), [commitHistory])
  const editAndQueue = useCallback((change: CompositionEdit) => {
    if (saveInFlightRef.current) throw new Error("composition_save_in_progress")
    const trackRef = compositionTrackRefForEdit(historyRef.current.present, change)
    const nextChange = change.trackRef === undefined ? { ...change, trackRef } : change
    const command = compositionEditToCommand(nextChange, historyRef.current.present)
    commitHistory(applyCompositionEdit(historyRef.current, nextChange))
    pendingCommandsRef.current = [...pendingCommandsRef.current, command]
    redoCommandsRef.current = []
    queuedHistoryDepthRef.current += 1
    if (idempotencyKeyRef.current === null) idempotencyKeyRef.current = createCompositionIdempotencyKey()
    setSaveState("unsaved")
  }, [commitHistory])
  const persist = useCallback(async () => {
    if (save === undefined || pendingCommandsRef.current.length === 0 || saveInFlightRef.current) return
    const batch = [...pendingCommandsRef.current]
    const idempotencyKey = idempotencyKeyRef.current ?? createCompositionIdempotencyKey()
    idempotencyKeyRef.current = idempotencyKey
    saveInFlightRef.current = true
    setSaveState("saving")
    try {
      const response = await save(createCompositionRevisionInput(revisionRef.current, batch), idempotencyKey)
      revisionRef.current = response?.revision ?? revisionRef.current + 1
      const current = pendingCommandsRef.current
      const batchStillPending = current.length >= batch.length && batch.every((command, index) => current[index] === command)
      if (batchStillPending) {
        const remaining = current.slice(batch.length)
        pendingCommandsRef.current = remaining
        queuedHistoryDepthRef.current = remaining.length
        if (response?.composition !== undefined) {
          const projected = remaining.length === 0 ? response.composition : replayCompositionCommands(response.composition, remaining)
          if (remaining.length === 0) savedCompositionRef.current = response.composition
          const next = createCompositionHistory(projected)
          historyRef.current = next
          setHistory(next)
        } else if (remaining.length === 0) {
          savedCompositionRef.current = historyRef.current.present
          const next = createCompositionHistory(historyRef.current.present)
          historyRef.current = next
          setHistory(next)
        }
        if (remaining.length === 0) {
          redoCommandsRef.current = []
          idempotencyKeyRef.current = null
          setSaveState("saved")
        } else {
          setSaveState("unsaved")
        }
      } else {
        setSaveState(current.length === 0 ? "saved" : "unsaved")
      }
    } catch (error) {
      if (error instanceof Error && error.message === "composition_conflict") idempotencyKeyRef.current = null
      setSaveState(error instanceof Error && error.message === "composition_conflict" ? "conflict" : "failed")
    } finally {
      saveInFlightRef.current = false
    }
  }, [save])
  const rebase = useCallback((latest: Composition, nextRevision: number) => {
    revisionRef.current = nextRevision
    savedCompositionRef.current = latest
    const next = createCompositionHistory(replayCompositionCommands(latest, pendingCommandsRef.current))
    historyRef.current = next
    setHistory(next)
    redoCommandsRef.current = []
    idempotencyKeyRef.current = pendingCommandsRef.current.length === 0 ? null : createCompositionIdempotencyKey()
    setSaveState(pendingCommandsRef.current.length === 0 ? "saved" : "unsaved")
  }, [])
  const replaceFromOwner = useCallback((latest: Composition, nextRevision: number): boolean => {
    if (saveInFlightRef.current || pendingCommandsRef.current.length > 0) return false
    revisionRef.current = nextRevision
    savedCompositionRef.current = latest
    const next = createCompositionHistory(latest)
    historyRef.current = next
    setHistory(next)
    pendingCommandsRef.current = []
    redoCommandsRef.current = []
    queuedHistoryDepthRef.current = 0
    idempotencyKeyRef.current = null
    setSaveState("saved")
    return true
  }, [])
  const discard = useCallback(() => {
    if (saveInFlightRef.current) return
    const next = createCompositionHistory(savedCompositionRef.current)
    historyRef.current = next
    setHistory(next)
    pendingCommandsRef.current = []
    redoCommandsRef.current = []
    queuedHistoryDepthRef.current = 0
    idempotencyKeyRef.current = null
    setSaveState("saved")
  }, [])
  const undo = useCallback(() => {
    const next = undoComposition(historyRef.current)
    if (next === historyRef.current) return
    if (queuedHistoryDepthRef.current > 0 && pendingCommandsRef.current.length > 0) {
      const undone = pendingCommandsRef.current.at(-1)
      if (undone !== undefined) {
        pendingCommandsRef.current = pendingCommandsRef.current.slice(0, -1)
        redoCommandsRef.current = [...redoCommandsRef.current, undone]
        queuedHistoryDepthRef.current -= 1
        if (pendingCommandsRef.current.length === 0) idempotencyKeyRef.current = null
        setSaveState(pendingCommandsRef.current.length === 0 ? "saved" : "unsaved")
      }
    }
    commitHistory(next)
  }, [commitHistory])
  const redo = useCallback(() => {
    const command = redoCommandsRef.current.pop()
    if (command !== undefined) {
      const nextComposition = replayCompositionCommands(historyRef.current.present, [command])
      commitHistory(commitComposition(historyRef.current, nextComposition))
      pendingCommandsRef.current = [...pendingCommandsRef.current, command]
      queuedHistoryDepthRef.current += 1
      if (idempotencyKeyRef.current === null) idempotencyKeyRef.current = createCompositionIdempotencyKey()
      setSaveState("unsaved")
      return
    }
    commitHistory(redoComposition(historyRef.current))
  }, [commitHistory])
  return { composition: history.present.tracks, canUndo: history.past.length > 0, canRedo: history.future.length > 0, edit, editAndQueue, undo, redo, saveState, persist, discard, rebase, replaceFromOwner }
}

function createCompositionIdempotencyKey(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.()
  return `mori-composition-${randomUuid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}
