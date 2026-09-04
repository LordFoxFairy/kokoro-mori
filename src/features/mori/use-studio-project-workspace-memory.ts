"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { MoriApi, MoriLyricsDraftRevision, MoriProjectWorkspaceProjection } from "@/lib/mori-api"
import {
  beginLyricsDraftSave,
  beginProjectWorkspaceOpenVersionSave,
  confirmProjectWorkspaceSave,
  failProjectWorkspaceSave,
  idleProjectWorkspaceSaveRun,
  retryProjectWorkspaceSave,
  type ProjectWorkspaceSaveRun,
} from "./project-workspace-memory"
import { useProjectWorkspaceProjection, type ProjectWorkspaceProjectionStatus } from "./use-project-workspace-projection"

type ProjectWorkspaceApi = Pick<MoriApi, "getProjectWorkspace" | "putLyricsDraft" | "putProjectWorkspaceOpenVersion">

type StudioProjectWorkspaceMemoryOptions = {
  projectRef: string
  activeVersionRef: string | null
  api?: Partial<ProjectWorkspaceApi>
}

type SaveState = {
  contextKey: string
  run: ProjectWorkspaceSaveRun
  confirmedProjection: MoriProjectWorkspaceProjection | null
}

export type StudioProjectWorkspaceMemory = {
  workspaceStatus: ProjectWorkspaceProjectionStatus
  projection: MoriProjectWorkspaceProjection | null
  lyricsDraft: MoriLyricsDraftRevision | null
  canSaveLyrics: boolean
  canSyncOpenVersion: boolean
  saveRun: ProjectWorkspaceSaveRun
  saveLyrics: (text: string) => void
  retrySave: () => void
  refresh: () => void
}

export function useStudioProjectWorkspaceMemory({ projectRef, activeVersionRef, api }: StudioProjectWorkspaceMemoryOptions): StudioProjectWorkspaceMemory {
  const normalizedProjectRef = projectRef.trim()
  const contextKey = `${normalizedProjectRef}\u0000${activeVersionRef ?? ""}`
  const getProjectWorkspace = api?.getProjectWorkspace
  const putLyricsDraft = api?.putLyricsDraft
  const putProjectWorkspaceOpenVersion = api?.putProjectWorkspaceOpenVersion
  const workspace = useProjectWorkspaceProjection(normalizedProjectRef, getProjectWorkspace)
  const acceptWorkspaceProjection = workspace.acceptProjection
  const retryWorkspaceProjection = workspace.retry
  const [saveState, setSaveState] = useState<SaveState>(() => idleSaveState(contextKey))
  const openVersionSyncKeyRef = useRef<string | null>(null)

  useEffect(() => {
    openVersionSyncKeyRef.current = null
    setSaveState((current) => current.contextKey === contextKey ? current : idleSaveState(contextKey))
  }, [contextKey])

  const saveRun = saveState.contextKey === contextKey ? saveState.run : idleProjectWorkspaceSaveRun
  const confirmedProjection = saveState.contextKey === contextKey ? saveState.confirmedProjection : null
  const projection = workspace.projection
  const openVersionMatches = activeVersionRef !== null && projection?.open_version?.version_ref === activeVersionRef
  const lyricsDraft = openVersionMatches ? projection?.latest_lyrics_draft ?? null : null
  const canSaveLyrics = workspace.status === "ready" && openVersionMatches && putLyricsDraft !== undefined

  useEffect(() => {
    if (confirmedProjection === null || saveRun.status !== "saving") return
    if (!acceptWorkspaceProjection(confirmedProjection)) {
      setSaveState((current) => {
        if (current.contextKey !== contextKey || current.confirmedProjection !== confirmedProjection) return current
        return {
          contextKey,
          run: {
            status: "failed",
            command: null,
            message: "Mori changed context before it could confirm this save. Refresh before trying again.",
            retryable: false,
          },
          confirmedProjection: null,
        }
      })
      return
    }
    setSaveState((current) => {
      if (current.contextKey !== contextKey || current.confirmedProjection !== confirmedProjection) return current
      return { contextKey, run: { status: "saved", command: null, message: null, retryable: false }, confirmedProjection: null }
    })
  }, [acceptWorkspaceProjection, confirmedProjection, contextKey, saveRun.status])

  const executeSave = useCallback(async (run: ProjectWorkspaceSaveRun, commandContextKey: string) => {
    if (run.status !== "saving" || run.command === null) return
    try {
      const response = run.command.kind === "lyrics_draft"
        ? putLyricsDraft === undefined
          ? null
          : await putLyricsDraft(run.command.versionRef, run.command.input, run.command.idempotencyKey)
        : run.command.kind === "open_version"
          ? putProjectWorkspaceOpenVersion === undefined
            ? null
            : await putProjectWorkspaceOpenVersion(run.command.projectRef, run.command.input, run.command.idempotencyKey)
          : null
      if (response === null) return
      setSaveState((current) => {
        if (!matchesPendingSave(current, commandContextKey, run)) return current
        const confirmed = confirmProjectWorkspaceSave(run, response.data)
        return {
          contextKey: commandContextKey,
          run: confirmed.status === "saved" ? run : confirmed,
          confirmedProjection: confirmed.status === "saved" ? response.data : null,
        }
      })
    } catch (error) {
      setSaveState((current) => {
        if (!matchesPendingSave(current, commandContextKey, run)) return current
        return {
          contextKey: commandContextKey,
          run: failProjectWorkspaceSave(run, error),
          confirmedProjection: null,
        }
      })
    }
  }, [putLyricsDraft, putProjectWorkspaceOpenVersion])

  const startOpenVersionSave = useCallback(() => {
    if (projection === null || activeVersionRef === null || putProjectWorkspaceOpenVersion === undefined) return
    const run = beginProjectWorkspaceOpenVersionSave(
      projection,
      activeVersionRef,
      nextProjectWorkspaceIdempotencyKey("open-version"),
    )
    setSaveState({ contextKey, run, confirmedProjection: null })
    void executeSave(run, contextKey)
  }, [activeVersionRef, contextKey, executeSave, projection, putProjectWorkspaceOpenVersion])

  useEffect(() => {
    if (
      workspace.status !== "ready"
      || projection === null
      || activeVersionRef === null
      || projection.open_version?.version_ref === activeVersionRef
      || putProjectWorkspaceOpenVersion === undefined
      || saveRun.status !== "idle"
    ) return
    const syncKey = `${contextKey}\u0000${projection.open_version?.version_ref ?? "none"}\u0000${projection.open_version?.revision ?? 0}`
    if (openVersionSyncKeyRef.current === syncKey) return
    openVersionSyncKeyRef.current = syncKey
    startOpenVersionSave()
  }, [activeVersionRef, contextKey, projection, putProjectWorkspaceOpenVersion, saveRun.status, startOpenVersionSave, workspace.status])

  const saveLyrics = useCallback((text: string) => {
    if (projection === null || activeVersionRef === null || putLyricsDraft === undefined) {
      setSaveState({
        contextKey,
        run: {
          status: "failed",
          command: null,
          message: "Mori needs the current Project workspace before it can save this draft.",
          retryable: false,
        },
        confirmedProjection: null,
      })
      return
    }
    const run = beginLyricsDraftSave(
      projection,
      activeVersionRef,
      { text },
      nextProjectWorkspaceIdempotencyKey("lyrics-draft"),
    )
    setSaveState({ contextKey, run, confirmedProjection: null })
    if (run.status === "saving") void executeSave(run, contextKey)
  }, [activeVersionRef, contextKey, executeSave, projection, putLyricsDraft])

  const retrySave = useCallback(() => {
    const retry = retryProjectWorkspaceSave(saveRun)
    if (retry === saveRun || retry.status !== "saving") return
    setSaveState({ contextKey, run: retry, confirmedProjection: null })
    void executeSave(retry, contextKey)
  }, [contextKey, executeSave, saveRun])

  const refresh = useCallback(() => {
    openVersionSyncKeyRef.current = null
    setSaveState(idleSaveState(contextKey))
    retryWorkspaceProjection()
  }, [contextKey, retryWorkspaceProjection])

  return {
    workspaceStatus: workspace.status,
    projection,
    lyricsDraft,
    canSaveLyrics,
    canSyncOpenVersion: putProjectWorkspaceOpenVersion !== undefined,
    saveRun,
    saveLyrics,
    retrySave,
    refresh,
  }
}

function idleSaveState(contextKey: string): SaveState {
  return { contextKey, run: idleProjectWorkspaceSaveRun, confirmedProjection: null }
}

function matchesPendingSave(current: SaveState, contextKey: string, attemptedRun: ProjectWorkspaceSaveRun): boolean {
  const currentCommand = current.run.command
  const attemptedCommand = attemptedRun.command
  return current.contextKey === contextKey
    && current.run.status === "saving"
    && currentCommand !== null
    && attemptedCommand !== null
    && currentCommand.kind === attemptedCommand.kind
    && currentCommand.idempotencyKey === attemptedCommand.idempotencyKey
}

function nextProjectWorkspaceIdempotencyKey(kind: "lyrics-draft" | "open-version"): string {
  return `mori-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
