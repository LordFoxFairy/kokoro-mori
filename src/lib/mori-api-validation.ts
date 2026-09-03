import type {
  ApiError,
  ApiSuccess,
  GenerationCancelReceipt,
  GenerationReceipt,
  GenerationSnapshot,
  LyricsRevisionCancelReceipt,
  LyricsRevisionConstraint,
  LyricsRevisionDirection,
  LyricsRevisionReceipt,
  LyricsRevisionSnapshot,
  LyricsRevisionSnapshotScope,
  LyricsRevisionStatus,
  MoriCandidate,
  MoriExportReceipt,
  MoriExportSnapshot,
  MoriGenerationEvent,
  MoriLibraryItem,
  MoriLyricsRevisionEvent,
  MoriLyricsSuggestion,
  MoriProject,
  MoriProjectPage,
  MoriSongPlan,
  StudioChangeOperation,
} from "./mori-api"
import type { GenerationStatus } from "@/features/mori/domain"

type Parser<T> = (value: unknown) => T | null

function present<T>(value: T | null): value is T {
  return value !== null
}

const generationStatuses: readonly GenerationStatus[] = [
  "queued",
  "preparing",
  "generating",
  "post_processing",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

function nullableString(value: unknown): value is string | null {
  return value === null || nonEmptyString(value)
}

function dateString(value: unknown): value is string {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString)
}

function generationStatus(value: unknown): value is GenerationStatus {
  return typeof value === "string" && generationStatuses.includes(value as GenerationStatus)
}

function studioChangeOperation(value: unknown): value is StudioChangeOperation {
  return value === "add_part" || value === "replace_section" || value === "extend" || value === "transform"
}

function lyricsRevisionDirection(value: unknown): value is LyricsRevisionDirection {
  return value === "rewrite" || value === "continue" || value === "rhyme" || value === "restructure"
}

function lyricsRevisionStatus(value: unknown): value is LyricsRevisionStatus {
  return value === "queued" || value === "generating" || value === "succeeded" || value === "failed" || value === "cancelled" || value === "expired"
}

function lyricsRevisionConstraint(value: unknown): value is LyricsRevisionConstraint {
  return value === "meaning" || value === "cadence" || value === "rhyme_scheme" || value === "section_length"
}

function requestMeta(value: unknown): { request_id: string } | null {
  if (!isRecord(value) || !nonEmptyString(value.request_id)) return null
  return { request_id: value.request_id }
}

export function parseApiSuccess<T>(value: unknown, parser: Parser<T>): ApiSuccess<T> | null {
  if (!isRecord(value)) return null
  const meta = requestMeta(value.meta)
  const data = parser(value.data)
  return meta === null || data === null ? null : { data, meta }
}

export function parseApiError(value: unknown): ApiError | null {
  if (!isRecord(value) || !isRecord(value.error)) return null
  const meta = requestMeta(value.meta)
  const details = value.error.details
  const parsedDetails = details === null
    ? null
    : Array.isArray(details) && details.every((item) => isRecord(item) && (item.field === null || nonEmptyString(item.field)) && nonEmptyString(item.reason))
      ? details.map((item) => ({ field: item.field as string | null, reason: item.reason as string }))
      : undefined
  if (
    meta === null
    || !nonEmptyString(value.error.code)
    || !nonEmptyString(value.error.message)
    || typeof value.error.retryable !== "boolean"
    || parsedDetails === undefined
  ) return null
  return {
    error: {
      code: value.error.code,
      message: value.error.message,
      retryable: value.error.retryable,
      details: parsedDetails,
    },
    meta,
  }
}

export function parseMoriProject(value: unknown): MoriProject | null {
  if (!isRecord(value) || !nonEmptyString(value.project_ref) || !nonEmptyString(value.title) || typeof value.description !== "string" || !nullableString(value.current_version_ref) || !integer(value.candidate_count) || !dateString(value.last_activity_at)) return null
  return {
    project_ref: value.project_ref,
    title: value.title,
    description: value.description,
    current_version_ref: value.current_version_ref,
    candidate_count: value.candidate_count,
    last_activity_at: value.last_activity_at,
  }
}

export function parseMoriProjectPage(value: unknown): MoriProjectPage | null {
  if (!isRecord(value) || !Array.isArray(value.projects) || !nullableString(value.next_cursor)) return null
  const projects = value.projects.map(parseMoriProject)
  return projects.every(present) ? { projects, next_cursor: value.next_cursor } : null
}

export function parseMoriSongPlan(value: unknown): MoriSongPlan | null {
  if (!isRecord(value) || !nonEmptyString(value.song_plan_ref) || !nonEmptyString(value.project_ref) || !nonEmptyString(value.prompt) || !nonEmptyString(value.mood) || !integer(value.tempo_bpm, 40, 240) || !stringArray(value.structure) || value.structure.length === 0 || !stringArray(value.instruments) || !nonEmptyString(value.vocal_direction) || !nonEmptyString(value.lyrics_intent) || !dateString(value.created_at)) return null
  return {
    song_plan_ref: value.song_plan_ref,
    project_ref: value.project_ref,
    prompt: value.prompt,
    mood: value.mood,
    tempo_bpm: value.tempo_bpm,
    structure: value.structure,
    instruments: value.instruments,
    vocal_direction: value.vocal_direction,
    lyrics_intent: value.lyrics_intent,
    created_at: value.created_at,
  }
}

export function parseGenerationReceipt(value: unknown): GenerationReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.generation_ref) || !["queued", "preparing", "generating"].includes(value.status as string)) return null
  return { generation_ref: value.generation_ref, status: value.status as GenerationReceipt["status"] }
}

export function parseGenerationCancelReceipt(value: unknown): GenerationCancelReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.generation_ref) || !generationStatus(value.status)) return null
  return { generation_ref: value.generation_ref, status: value.status }
}

export function parseLyricsRevisionReceipt(value: unknown): LyricsRevisionReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.lyrics_revision_ref) || (value.status !== "queued" && value.status !== "generating")) return null
  return { lyrics_revision_ref: value.lyrics_revision_ref, status: value.status }
}

export function parseLyricsRevisionCancelReceipt(value: unknown): LyricsRevisionCancelReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.lyrics_revision_ref) || !lyricsRevisionStatus(value.status)) return null
  return { lyrics_revision_ref: value.lyrics_revision_ref, status: value.status }
}

export function parseGenerationSnapshot(value: unknown): GenerationSnapshot | null {
  if (!isRecord(value) || !nonEmptyString(value.generation_ref) || !nonEmptyString(value.project_ref) || !generationStatus(value.status) || !integer(value.progress, 0, 100) || !stringArray(value.candidate_refs) || !dateString(value.created_at)) return null
  const common = {
    generation_ref: value.generation_ref,
    project_ref: value.project_ref,
    status: value.status,
    progress: value.progress,
    candidate_refs: value.candidate_refs,
    created_at: value.created_at,
  }
  if (value.generation_kind === "new_song") {
    if (!nullableString(value.song_plan_ref) || (value.mode !== "smart" && value.mode !== "custom") || value.source_version_ref !== null || value.operation !== null) return null
    return {
      ...common,
      generation_kind: "new_song",
      song_plan_ref: value.song_plan_ref,
      mode: value.mode,
      source_version_ref: null,
      operation: null,
    }
  }
  if (value.generation_kind === "studio_change") {
    if (value.song_plan_ref !== null || value.mode !== null || !nonEmptyString(value.source_version_ref) || !studioChangeOperation(value.operation)) return null
    return {
      ...common,
      generation_kind: "studio_change",
      song_plan_ref: null,
      mode: null,
      source_version_ref: value.source_version_ref,
      operation: value.operation,
    }
  }
  return null
}

export function parseGenerationEventData(value: unknown): MoriGenerationEvent["data"] | null {
  if (!isRecord(value) || !nonEmptyString(value.generation_ref) || !nonEmptyString(value.project_ref) || !generationStatus(value.status) || !integer(value.progress, 0, 100) || !stringArray(value.candidate_refs)) return null
  return {
    generation_ref: value.generation_ref,
    project_ref: value.project_ref,
    status: value.status,
    progress: value.progress,
    candidate_refs: value.candidate_refs,
  }
}

export function parseMoriGenerationEvent(value: unknown): MoriGenerationEvent | null {
  if (!isRecord(value) || !nonEmptyString(value.id) || !nonEmptyString(value.event) || !value.event.startsWith("generation.") || !isRecord(value.data)) return null
  const data = parseGenerationEventData(value.data)
  return data === null ? null : { id: value.id, event: value.event, data }
}

function parseLyricsRevisionSnapshotScope(value: unknown): LyricsRevisionSnapshotScope | null {
  if (!isRecord(value)) return null
  if (value.type === "whole_lyrics") return { type: "whole_lyrics" }
  if (value.type === "section" && nonEmptyString(value.section_ref)) {
    return { type: "section", section_ref: value.section_ref }
  }
  return null
}

export function parseMoriLyricsSuggestion(value: unknown): MoriLyricsSuggestion | null {
  if (!isRecord(value) || !nonEmptyString(value.suggestion_ref) || !nonEmptyString(value.text)) return null
  return { suggestion_ref: value.suggestion_ref, text: value.text }
}

export function parseLyricsRevisionSnapshot(value: unknown): LyricsRevisionSnapshot | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.lyrics_revision_ref)
    || !nonEmptyString(value.version_ref)
    || !lyricsRevisionStatus(value.status)
    || !integer(value.progress, 0, 100)
    || !lyricsRevisionDirection(value.direction)
    || !nonEmptyString(value.instruction)
    || !Array.isArray(value.constraints)
    || !value.constraints.every(lyricsRevisionConstraint)
    || !integer(value.output_count, 1, 4)
    || !nonEmptyString(value.source_digest)
    || !Array.isArray(value.suggestions)
    || !dateString(value.created_at)
  ) return null
  const scope = parseLyricsRevisionSnapshotScope(value.scope)
  const suggestions = value.suggestions.map(parseMoriLyricsSuggestion)
  if (scope === null || !suggestions.every(present)) return null
  return {
    lyrics_revision_ref: value.lyrics_revision_ref,
    version_ref: value.version_ref,
    status: value.status,
    progress: value.progress,
    direction: value.direction,
    scope,
    instruction: value.instruction,
    constraints: value.constraints,
    output_count: value.output_count,
    source_digest: value.source_digest,
    suggestions,
    created_at: value.created_at,
  }
}

export function parseLyricsRevisionEventData(value: unknown): MoriLyricsRevisionEvent["data"] | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.lyrics_revision_ref)
    || !nonEmptyString(value.version_ref)
    || !lyricsRevisionStatus(value.status)
    || !integer(value.progress, 0, 100)
    || !stringArray(value.suggestion_refs)
  ) return null
  return {
    lyrics_revision_ref: value.lyrics_revision_ref,
    version_ref: value.version_ref,
    status: value.status,
    progress: value.progress,
    suggestion_refs: value.suggestion_refs,
  }
}

export function parseMoriCandidate(value: unknown): MoriCandidate | null {
  if (!isRecord(value) || !nonEmptyString(value.candidate_ref) || !nonEmptyString(value.generation_ref) || !nonEmptyString(value.version_ref) || !nonEmptyString(value.project_ref) || !nonEmptyString(value.title) || !integer(value.duration_seconds, 1) || !nonEmptyString(value.audio_asset_ref) || !nonEmptyString(value.waveform_asset_ref) || !stringArray(value.style_tags) || !dateString(value.created_at)) return null
  return {
    candidate_ref: value.candidate_ref,
    generation_ref: value.generation_ref,
    version_ref: value.version_ref,
    project_ref: value.project_ref,
    title: value.title,
    duration_seconds: value.duration_seconds,
    audio_asset_ref: value.audio_asset_ref,
    waveform_asset_ref: value.waveform_asset_ref,
    style_tags: value.style_tags,
    created_at: value.created_at,
  }
}

export function parseMoriCandidatePage(value: unknown): { candidates: MoriCandidate[]; next_cursor: string | null } | null {
  if (!isRecord(value) || !Array.isArray(value.candidates) || !nullableString(value.next_cursor)) return null
  const candidates = value.candidates.map(parseMoriCandidate)
  return candidates.every(present) ? { candidates, next_cursor: value.next_cursor } : null
}

export function parseMoriLibraryItem(value: unknown): MoriLibraryItem | null {
  if (!isRecord(value) || !nonEmptyString(value.library_item_ref) || value.kind !== "version" || !nonEmptyString(value.project_ref) || !nonEmptyString(value.project_title) || !nonEmptyString(value.version_ref) || !nonEmptyString(value.title) || !integer(value.duration_seconds, 1) || !nonEmptyString(value.audio_asset_ref) || !nonEmptyString(value.waveform_asset_ref) || !dateString(value.created_at)) return null
  return {
    library_item_ref: value.library_item_ref,
    kind: "version",
    project_ref: value.project_ref,
    project_title: value.project_title,
    version_ref: value.version_ref,
    title: value.title,
    duration_seconds: value.duration_seconds,
    audio_asset_ref: value.audio_asset_ref,
    waveform_asset_ref: value.waveform_asset_ref,
    created_at: value.created_at,
  }
}

export function parseMoriLibraryPage(value: unknown): { items: MoriLibraryItem[]; next_cursor: string | null } | null {
  if (!isRecord(value) || !Array.isArray(value.items) || !nullableString(value.next_cursor)) return null
  const items = value.items.map(parseMoriLibraryItem)
  return items.every(present) ? { items, next_cursor: value.next_cursor } : null
}

export function parseMoriExportReceipt(value: unknown): MoriExportReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.export_ref) || (value.status !== "queued" && value.status !== "processing")) return null
  return { export_ref: value.export_ref, status: value.status }
}

export function parseMoriExportSnapshot(value: unknown): MoriExportSnapshot | null {
  if (!isRecord(value) || !nonEmptyString(value.export_ref) || !nonEmptyString(value.project_ref) || !nonEmptyString(value.version_ref) || (value.format !== "mp3" && value.format !== "wav") || (value.status !== "queued" && value.status !== "processing" && value.status !== "succeeded" && value.status !== "failed") || !nullableString(value.download_url) || !dateString(value.created_at)) return null
  return {
    export_ref: value.export_ref,
    project_ref: value.project_ref,
    version_ref: value.version_ref,
    format: value.format,
    status: value.status,
    download_url: value.download_url,
    created_at: value.created_at,
  }
}
