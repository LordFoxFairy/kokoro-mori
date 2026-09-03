import type { CreationMode, GenerationStatus, LyricsMode, MoriRef } from "@/features/mori/domain"

export type ApiMeta = {
  request_id: string
}

export type ApiSuccess<T> = {
  data: T
  meta: ApiMeta
}

export type ApiErrorDetail = {
  field: string | null
  reason: string
}

export type ApiError = {
  error: {
    code: string
    message: string
    retryable: boolean
    details: ApiErrorDetail[] | null
  }
  meta: ApiMeta
}

export type GenerationCreateInput = {
  mode: CreationMode
  prompt: string
  song_plan_ref: MoriRef | null
  lyrics: string | null
  style: string | null
  reference_asset_refs: string[]
  voice_ref: string | null
  duration_seconds: number | null
  lyrics_mode: LyricsMode
}

export type StudioChangeOperation = "add_part" | "replace_section" | "extend" | "transform"

export type StudioChangePreserve = "melody" | "lyrics" | "vocal_identity" | "tempo" | "structure"

export type StudioChangeInsertionScope = {
  type: "insertion_point"
  position_ms: number
}

export type StudioChangeRangeScope = {
  type: "time_range"
  start_ms: number
  end_ms: number
}

export type StudioChangeFromScope = {
  type: "from_position"
  position_ms: number
}

export type StudioChangeWholeVersionScope = {
  type: "whole_version"
}

type StudioChangeGenerationCommonInput = {
  instruction: string
  preserve: StudioChangePreserve[]
  reference_asset_refs: MoriRef[]
  output_count: number
}

export type StudioChangeGenerationInput = StudioChangeGenerationCommonInput & (
  | { operation: "add_part"; scope: StudioChangeInsertionScope }
  | { operation: "replace_section"; scope: StudioChangeRangeScope }
  | { operation: "extend"; scope: StudioChangeFromScope }
  | { operation: "transform"; scope: StudioChangeRangeScope | StudioChangeWholeVersionScope }
)

export type LyricsRevisionDirection = "rewrite" | "continue" | "rhyme" | "restructure"

export type LyricsRevisionConstraint = "meaning" | "cadence" | "rhyme_scheme" | "section_length"

export type LyricsRevisionInputScope =
  | { type: "section"; section_ref: MoriRef; source_text: string }
  | { type: "whole_lyrics"; source_text: string }

export type LyricsRevisionInput = {
  direction: LyricsRevisionDirection
  scope: LyricsRevisionInputScope
  instruction: string
  lyrics_context: string
  constraints: LyricsRevisionConstraint[]
  output_count: number
}

export type LyricsRevisionStatus = "queued" | "generating" | "succeeded" | "failed" | "cancelled" | "expired"

export type LyricsRevisionReceipt = {
  lyrics_revision_ref: MoriRef
  status: Extract<LyricsRevisionStatus, "queued" | "generating">
}

export type LyricsRevisionCancelReceipt = {
  lyrics_revision_ref: MoriRef
  status: LyricsRevisionStatus
}

export type LyricsRevisionSnapshotScope =
  | { type: "section"; section_ref: MoriRef }
  | { type: "whole_lyrics" }

export type MoriLyricsSuggestion = {
  suggestion_ref: MoriRef
  text: string
}

export type LyricsRevisionSnapshot = {
  lyrics_revision_ref: MoriRef
  version_ref: MoriRef
  status: LyricsRevisionStatus
  progress: number
  direction: LyricsRevisionDirection
  scope: LyricsRevisionSnapshotScope
  instruction: string
  constraints: LyricsRevisionConstraint[]
  output_count: number
  source_digest: string
  suggestions: MoriLyricsSuggestion[]
  created_at: string
}

export type MoriLyricsRevisionEvent = {
  id: string
  event: string
  data: {
    lyrics_revision_ref: MoriRef
    version_ref: MoriRef
    status: LyricsRevisionStatus
    progress: number
    suggestion_refs: MoriRef[]
  }
}

export type SongPlanCreateInput = {
  prompt: string
  mood: string
  tempo_bpm: number
  structure: string[]
  instruments: string[]
  vocal_direction: string
  lyrics_intent: string
}

export type MoriMutationHeaders = {
  "Content-Type": "application/json"
  "Idempotency-Key": string
}

export type GenerationReceipt = {
  generation_ref: MoriRef
  status: Extract<GenerationStatus, "queued" | "preparing" | "generating">
}

export type GenerationCancelReceipt = {
  generation_ref: MoriRef
  status: GenerationStatus
}

export type MoriProject = {
  project_ref: MoriRef
  title: string
  description: string
  current_version_ref: MoriRef | null
  candidate_count: number
  last_activity_at: string
}

export type MoriProjectCreateInput = {
  title: string
  description: string
}

export type MoriSongPlan = SongPlanCreateInput & {
  song_plan_ref: MoriRef
  project_ref: MoriRef
  created_at: string
}

export type MoriProjectListOptions = {
  cursor?: string | null
  limit?: number
}

export type MoriProjectPage = {
  projects: MoriProject[]
  next_cursor: string | null
}

type GenerationSnapshotBase = {
  generation_ref: MoriRef
  project_ref: MoriRef
  status: GenerationStatus
  progress: number
  candidate_refs: MoriRef[]
  created_at: string
}

export type NewSongGenerationSnapshot = GenerationSnapshotBase & {
  generation_kind: "new_song"
  song_plan_ref: MoriRef | null
  mode: CreationMode
  source_version_ref: null
  operation: null
}

export type StudioChangeGenerationSnapshot = GenerationSnapshotBase & {
  generation_kind: "studio_change"
  song_plan_ref: null
  mode: null
  source_version_ref: MoriRef
  operation: StudioChangeOperation
}

export type GenerationSnapshot = NewSongGenerationSnapshot | StudioChangeGenerationSnapshot

export type MoriGenerationEvent = {
  id: string
  event: string
  data: Pick<GenerationSnapshot, "generation_ref" | "project_ref" | "status" | "progress" | "candidate_refs">
}

export type MoriCandidate = {
  candidate_ref: MoriRef
  generation_ref: MoriRef
  version_ref: MoriRef
  project_ref: MoriRef
  title: string
  duration_seconds: number
  audio_asset_ref: string
  waveform_asset_ref: string
  style_tags: string[]
  created_at: string
}

export type MoriLibraryItem = {
  library_item_ref: MoriRef
  kind: "version"
  project_ref: MoriRef
  project_title: string
  version_ref: MoriRef
  title: string
  duration_seconds: number
  audio_asset_ref: string
  waveform_asset_ref: string
  created_at: string
}

export type MoriExportStatus = "queued" | "processing" | "succeeded" | "failed"

export type MoriExportReceipt = {
  export_ref: MoriRef
  status: Extract<MoriExportStatus, "queued" | "processing">
}

export type MoriExportSnapshot = {
  export_ref: MoriRef
  project_ref: MoriRef
  version_ref: MoriRef
  format: "mp3" | "wav"
  status: MoriExportStatus
  download_url: string | null
  created_at: string
}

export type MoriApi = {
  listProjects: (options?: MoriProjectListOptions) => Promise<ApiSuccess<MoriProjectPage>>
  createProject: (input: MoriProjectCreateInput, idempotencyKey: string) => Promise<ApiSuccess<MoriProject>>
  getProject: (projectRef: MoriRef) => Promise<ApiSuccess<MoriProject>>
  createSongPlan: (projectRef: MoriRef, input: SongPlanCreateInput, idempotencyKey: string) => Promise<ApiSuccess<MoriSongPlan>>
  createGeneration: (projectRef: MoriRef, input: GenerationCreateInput, idempotencyKey: string) => Promise<ApiSuccess<GenerationReceipt>>
  createStudioChange: (versionRef: MoriRef, input: StudioChangeGenerationInput, idempotencyKey: string) => Promise<ApiSuccess<GenerationReceipt>>
  createLyricsRevision: (versionRef: MoriRef, input: LyricsRevisionInput, idempotencyKey: string) => Promise<ApiSuccess<LyricsRevisionReceipt>>
  getLyricsRevision: (lyricsRevisionRef: MoriRef) => Promise<ApiSuccess<LyricsRevisionSnapshot>>
  getLyricsRevisionEvents: (lyricsRevisionRef: MoriRef, lastEventId?: string | null) => Promise<MoriLyricsRevisionEvent[]>
  cancelLyricsRevision: (lyricsRevisionRef: MoriRef, idempotencyKey: string) => Promise<ApiSuccess<LyricsRevisionCancelReceipt>>
  getGeneration: (generationRef: MoriRef) => Promise<ApiSuccess<GenerationSnapshot>>
  getGenerationEvents: (generationRef: MoriRef, lastEventId?: string | null) => Promise<MoriGenerationEvent[]>
  listCandidates: (projectRef: MoriRef) => Promise<ApiSuccess<{ candidates: MoriCandidate[]; next_cursor: string | null }>>
  cancelGeneration: (generationRef: MoriRef, idempotencyKey: string) => Promise<ApiSuccess<GenerationCancelReceipt>>
  listLibrary: (kind?: "all" | "version") => Promise<ApiSuccess<{ items: MoriLibraryItem[]; next_cursor: string | null }>>
  createExport: (versionRef: MoriRef, format: "mp3" | "wav", idempotencyKey: string) => Promise<ApiSuccess<MoriExportReceipt>>
  getExport: (exportRef: MoriRef) => Promise<ApiSuccess<MoriExportSnapshot>>
}

export type MoriGenerationDraft = {
  mode: CreationMode
  prompt: string
  songPlanRef?: MoriRef
  lyricsMode: LyricsMode
  lyrics?: string
  style?: string
  referenceAssetRefs?: string[]
  voiceRef?: string
  durationSeconds?: number
}

type MoriStudioChangeCommonDraft = {
  instruction: string
  preserve?: StudioChangePreserve[]
  referenceAssetRefs?: MoriRef[]
  outputCount?: number
}

export type MoriStudioChangeDraft = MoriStudioChangeCommonDraft & (
  | { operation: "add_part"; scope: { type: "insertion_point"; positionMs: number } }
  | { operation: "replace_section"; scope: { type: "time_range"; startMs: number; endMs: number } }
  | { operation: "extend"; scope: { type: "from_position"; positionMs: number } }
  | { operation: "transform"; scope: { type: "time_range"; startMs: number; endMs: number } | { type: "whole_version" } }
)

export type MoriLyricsRevisionDraft = {
  direction: LyricsRevisionDirection
  scope:
    | { type: "section"; sectionRef: MoriRef; sourceText: string }
    | { type: "whole_lyrics"; sourceText: string }
  instruction: string
  lyricsContext: string
  constraints?: LyricsRevisionConstraint[]
  outputCount?: number
}

export function createGenerationRequest(draft: MoriGenerationDraft): GenerationCreateInput {
  return {
    mode: draft.mode,
    prompt: draft.prompt.trim(),
    song_plan_ref: draft.songPlanRef?.trim() || null,
    lyrics: draft.lyricsMode === "lyrics" ? draft.lyrics?.trim() || null : null,
    style: draft.style?.trim() || null,
    reference_asset_refs: draft.referenceAssetRefs ?? [],
    voice_ref: draft.voiceRef?.trim() || null,
    duration_seconds: draft.durationSeconds ?? null,
    lyrics_mode: draft.lyricsMode,
  }
}

export function createStudioChangeRequest(draft: MoriStudioChangeDraft): StudioChangeGenerationInput {
  const instruction = draft.instruction.trim()
  if (instruction === "") throw new Error("studio_change_instruction_required")
  if (instruction.length > 2_000) throw new Error("studio_change_instruction_too_long")

  const outputCount = draft.outputCount ?? 2
  if (!Number.isSafeInteger(outputCount) || outputCount < 1 || outputCount > 4) {
    throw new Error("studio_change_output_count_invalid")
  }

  const referenceAssetRefs = uniqueNonEmpty(draft.referenceAssetRefs ?? [])
  if (referenceAssetRefs.length > 8) throw new Error("studio_change_reference_limit_exceeded")

  const common = {
    instruction,
    preserve: uniqueValues(draft.preserve ?? []),
    reference_asset_refs: referenceAssetRefs,
    output_count: outputCount,
  }

  switch (draft.operation) {
    case "add_part":
      assertPosition(draft.scope.positionMs)
      return {
        ...common,
        operation: "add_part",
        scope: { type: "insertion_point", position_ms: draft.scope.positionMs },
      }
    case "replace_section":
      assertRange(draft.scope.startMs, draft.scope.endMs)
      return {
        ...common,
        operation: "replace_section",
        scope: { type: "time_range", start_ms: draft.scope.startMs, end_ms: draft.scope.endMs },
      }
    case "extend":
      assertPosition(draft.scope.positionMs)
      return {
        ...common,
        operation: "extend",
        scope: { type: "from_position", position_ms: draft.scope.positionMs },
      }
    case "transform":
      if (draft.scope.type === "whole_version") {
        return { ...common, operation: "transform", scope: { type: "whole_version" } }
      }
      assertRange(draft.scope.startMs, draft.scope.endMs)
      return {
        ...common,
        operation: "transform",
        scope: { type: "time_range", start_ms: draft.scope.startMs, end_ms: draft.scope.endMs },
      }
  }
}

export function createLyricsRevisionRequest(draft: MoriLyricsRevisionDraft): LyricsRevisionInput {
  const instruction = draft.instruction.trim()
  if (instruction === "") throw new Error("lyrics_revision_instruction_required")
  if (instruction.length > 2_000) throw new Error("lyrics_revision_instruction_too_long")

  const lyricsContext = draft.lyricsContext.trim()
  if (lyricsContext === "") throw new Error("lyrics_revision_context_required")
  if (lyricsContext.length > 20_000) throw new Error("lyrics_revision_context_too_long")

  const sourceText = draft.scope.sourceText.trim()
  if (sourceText === "") throw new Error("lyrics_revision_source_text_required")
  if (sourceText.length > 10_000) throw new Error("lyrics_revision_source_text_too_long")
  if (!lyricsContext.includes(sourceText)) throw new Error("lyrics_revision_source_outside_context")

  const constraints = uniqueValues(draft.constraints ?? ["meaning", "cadence"])
  if (constraints.length > lyricsRevisionConstraints.length || constraints.some((value) => !lyricsRevisionConstraints.includes(value))) {
    throw new Error("lyrics_revision_constraints_invalid")
  }

  const outputCount = draft.outputCount ?? 2
  if (!Number.isSafeInteger(outputCount) || outputCount < 1 || outputCount > 4) {
    throw new Error("lyrics_revision_output_count_invalid")
  }

  const common = {
    direction: draft.direction,
    instruction,
    lyrics_context: lyricsContext,
    constraints,
    output_count: outputCount,
  }
  if (draft.scope.type === "whole_lyrics") {
    return { ...common, scope: { type: "whole_lyrics", source_text: sourceText } }
  }

  const sectionRef = draft.scope.sectionRef.trim()
  if (sectionRef === "") throw new Error("lyrics_revision_section_ref_required")
  return { ...common, scope: { type: "section", section_ref: sectionRef, source_text: sourceText } }
}

export function createMutationHeaders(idempotencyKey: string): MoriMutationHeaders {
  const normalizedKey = idempotencyKey.trim()
  if (!normalizedKey) {
    throw new Error("idempotency_key_required")
  }

  return {
    "Content-Type": "application/json",
    "Idempotency-Key": normalizedKey,
  }
}

function assertPosition(positionMs: number): void {
  if (!Number.isSafeInteger(positionMs) || positionMs < 0) throw new Error("studio_change_position_invalid")
}

function assertRange(startMs: number, endMs: number): void {
  if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) || startMs < 0 || endMs <= startMs) {
    throw new Error("studio_change_range_invalid")
  }
}

function uniqueNonEmpty(values: string[]): string[] {
  const normalized = values.map((value) => value.trim()).filter((value) => value !== "")
  return normalized.filter((value, index) => normalized.indexOf(value) === index)
}

function uniqueValues<T extends string>(values: T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index)
}

const lyricsRevisionConstraints: readonly LyricsRevisionConstraint[] = ["meaning", "cadence", "rhyme_scheme", "section_length"]
