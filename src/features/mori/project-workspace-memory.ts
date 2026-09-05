import type {
  CurrentSongPlanInput,
  LyricsDraftInput,
  MoriProjectWorkspaceProjection,
  ProjectWorkspaceOpenVersionInput,
} from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"

export type ProjectWorkspaceSongPlanDraft = Omit<CurrentSongPlanInput, "expected_revision">
export type ProjectWorkspaceLyricsDraft = Omit<LyricsDraftInput, "expected_revision">

type PendingSongPlanSave = {
  kind: "song_plan"
  projectRef: string
  input: CurrentSongPlanInput
  idempotencyKey: string
}

type PendingLyricsDraftSave = {
  kind: "lyrics_draft"
  projectRef: string
  versionRef: string
  input: LyricsDraftInput
  idempotencyKey: string
}

type PendingOpenVersionSave = {
  kind: "open_version"
  projectRef: string
  input: ProjectWorkspaceOpenVersionInput
  idempotencyKey: string
}

export type PendingProjectWorkspaceSave = PendingSongPlanSave | PendingLyricsDraftSave | PendingOpenVersionSave

export type ProjectWorkspaceSaveRun = {
  status: "idle" | "saving" | "saved" | "failed"
  command: PendingProjectWorkspaceSave | null
  message: string | null
  retryable: boolean
}

export const idleProjectWorkspaceSaveRun: ProjectWorkspaceSaveRun = {
  status: "idle",
  command: null,
  message: null,
  retryable: false,
}

export function beginCurrentSongPlanSave(
  projection: MoriProjectWorkspaceProjection,
  draft: ProjectWorkspaceSongPlanDraft,
  idempotencyKey: string,
): ProjectWorkspaceSaveRun {
  return saving({
    kind: "song_plan",
    projectRef: projection.project.project_ref,
    input: {
      ...draft,
      expected_revision: projection.current_song_plan?.revision ?? null,
    },
    idempotencyKey,
  })
}

export function beginLyricsDraftSave(
  projection: MoriProjectWorkspaceProjection,
  versionRef: string,
  draft: ProjectWorkspaceLyricsDraft,
  idempotencyKey: string,
): ProjectWorkspaceSaveRun {
  const openVersion = projection.open_version
  if (openVersion === null || openVersion.version_ref !== versionRef) {
    return failed(null, "This Version is no longer open. Reopen it before saving lyrics.", false)
  }
  const existingDraft = projection.latest_lyrics_draft
  return saving({
    kind: "lyrics_draft",
    projectRef: projection.project.project_ref,
    versionRef,
    input: {
      ...draft,
      expected_revision: existingDraft?.revision ?? null,
    },
    idempotencyKey,
  })
}

export function beginProjectWorkspaceOpenVersionSave(
  projection: MoriProjectWorkspaceProjection,
  versionRef: string,
  idempotencyKey: string,
): ProjectWorkspaceSaveRun {
  return saving({
    kind: "open_version",
    projectRef: projection.project.project_ref,
    input: {
      version_ref: versionRef,
      expected_revision: projection.open_version?.revision ?? null,
    },
    idempotencyKey,
  })
}

export function confirmProjectWorkspaceSave(
  run: ProjectWorkspaceSaveRun,
  projection: MoriProjectWorkspaceProjection,
): ProjectWorkspaceSaveRun {
  if (run.status !== "saving" || run.command === null) return run
  if (!projectWorkspaceProjectionConfirmsSave(run.command, projection)) {
    return failed(null, "Mori returned a workspace that did not confirm this save. Refresh before trying again.", false)
  }
  return { status: "saved", command: null, message: null, retryable: false }
}

export function failProjectWorkspaceSave(run: ProjectWorkspaceSaveRun, error: unknown): ProjectWorkspaceSaveRun {
  if (run.status !== "saving" || run.command === null) return run
  if (error instanceof MoriApiRequestError && error.status === 409) {
    return failed(null, "This project changed elsewhere. Refresh before saving again.", false)
  }
  if (error instanceof MoriApiRequestError && error.retryable) {
    return failed(run.command, "Mori could not confirm this save. Retry when ready.", true)
  }
  return failed(null, "Mori could not save this change. Refresh before trying again.", false)
}

export function retryProjectWorkspaceSave(run: ProjectWorkspaceSaveRun): ProjectWorkspaceSaveRun {
  if (run.status !== "failed" || !run.retryable || run.command === null) return run
  return saving(run.command)
}

function saving(command: PendingProjectWorkspaceSave): ProjectWorkspaceSaveRun {
  return { status: "saving", command, message: null, retryable: false }
}

function failed(command: PendingProjectWorkspaceSave | null, message: string, retryable: boolean): ProjectWorkspaceSaveRun {
  return { status: "failed", command, message, retryable }
}

function projectWorkspaceProjectionConfirmsSave(
  command: PendingProjectWorkspaceSave,
  projection: MoriProjectWorkspaceProjection,
): boolean {
  if (projection.project.project_ref !== command.projectRef) return false
  switch (command.kind) {
    case "song_plan":
      return songPlanRevisionMatchesInput(projection, command.input)
    case "lyrics_draft":
      return lyricsDraftRevisionMatchesInput(projection, command.versionRef, command.input)
    case "open_version":
      return openVersionMatchesInput(projection, command.input)
  }
}

function songPlanRevisionMatchesInput(
  projection: MoriProjectWorkspaceProjection,
  input: CurrentSongPlanInput,
): boolean {
  const revision = projection.current_song_plan
  return revision !== null
    && revision.project_ref === projection.project.project_ref
    && revision.revision === nextRevision(input.expected_revision)
    && revision.prompt === input.prompt
    && revision.mood === input.mood
    && revision.tempo_bpm === input.tempo_bpm
    && sameValues(revision.structure, input.structure)
    && sameValues(revision.instruments, input.instruments)
    && revision.vocal_direction === input.vocal_direction
    && revision.lyrics_intent === input.lyrics_intent
}

function lyricsDraftRevisionMatchesInput(
  projection: MoriProjectWorkspaceProjection,
  versionRef: string,
  input: LyricsDraftInput,
): boolean {
  const revision = projection.latest_lyrics_draft
  return projection.open_version?.version_ref === versionRef
    && revision !== null
    && revision.project_ref === projection.project.project_ref
    && revision.version_ref === versionRef
    && revision.revision === nextRevision(input.expected_revision)
    && revision.text === input.text
}

function openVersionMatchesInput(
  projection: MoriProjectWorkspaceProjection,
  input: ProjectWorkspaceOpenVersionInput,
): boolean {
  const openVersion = projection.open_version
  return openVersion !== null
    && openVersion.project_ref === projection.project.project_ref
    && openVersion.version_ref === input.version_ref
    && openVersion.revision === nextRevision(input.expected_revision)
}

function nextRevision(expectedRevision: number | null): number {
  return (expectedRevision ?? 0) + 1
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}
