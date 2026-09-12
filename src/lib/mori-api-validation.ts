import {
  artworkPalettes,
  artworkStyles,
  moriCreativeSourceKinds,
  moriCreativeSourceUploadStatuses,
  releaseVisibilities,
  stemSeparationModes,
  stemTargetKinds,
  studioChangeOutputCounts,
  studioInstrumentalCoverProtectedAnchors,
  studioRemasterStrengths,
  studioVocalCoverProtectedAnchors,
} from "./mori-api"
import type {
  ApiError,
  ApiSuccess,
  ArtworkGenerationCancelReceipt,
  ArtworkGenerationReceipt,
  ArtworkGenerationSnapshot,
  ArtworkGenerationStatus,
  ArtworkPalette,
  ArtworkStyle,
  GenerationCancelReceipt,
  GenerationReceipt,
  GenerationSnapshot,
  MoriCurrentSongPlanRevision,
  LyricsRevisionCancelReceipt,
  MoriLyricsDraftRevision,
  LyricsRevisionConstraint,
  LyricsRevisionDirection,
  LyricsRevisionReceipt,
  LyricsRevisionSnapshot,
  LyricsRevisionSnapshotScope,
  LyricsRevisionStatus,
  MoriCandidate,
  MoriArtworkCandidate,
  MoriArtworkGenerationEvent,
  MoriCurrentVersionSelection,
  MoriExportReceipt,
  MoriExportScope,
  MoriExportSnapshot,
  MoriExportSource,
  MoriGenerationEvent,
  MoriLibraryItem,
  MoriLibraryVersionItem,
  MoriCreativeSource,
  MoriCreativeSourceKind,
  MoriCreativeSourceUpload,
  MoriCreativeSourceUploadReceipt,
  MoriCreativeSourceUploadStatus,
  MoriLyricsRevisionEvent,
  MoriLyricsSuggestion,
  MoriMixRevision,
  MoriMixTrack,
  MoriProject,
  MoriProjectWorkspaceActiveTask,
  MoriProjectWorkspaceMixRevision,
  MoriProjectWorkspaceOpenVersion,
  MoriProjectWorkspaceProjection,
  MoriProjectPage,
  MoriReleaseDraft,
  MoriRelease,
  MoriShare,
  PublishReleaseReceipt,
  MoriSongPlan,
  MoriStem,
  MoriStemSeparationEvent,
  ReleaseArtwork,
  ReleaseVisibility,
  StemKind,
  StemSeparationCancelReceipt,
  StemSeparationMode,
  StemSeparationReceipt,
  StemSeparationSnapshot,
  StemSeparationStatus,
  StemTargetKind,
  StudioChangePreserve,
  StudioChangeRangeScope,
  StudioChangeOperation,
  StudioChangeOutputCount,
  StudioChangeWholeVersionScope,
  StudioCoverMode,
  StudioRemasterSource,
  StudioRemasterStrength,
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

function studioChangeOutputCount(value: unknown): value is StudioChangeOutputCount {
  return typeof value === "number" && studioChangeOutputCounts.includes(value as StudioChangeOutputCount)
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString)
}

function generationStatus(value: unknown): value is GenerationStatus {
  return typeof value === "string" && generationStatuses.includes(value as GenerationStatus)
}

function creativeSourceUploadStatus(value: unknown): value is MoriCreativeSourceUploadStatus {
  return typeof value === "string" && moriCreativeSourceUploadStatuses.includes(value as MoriCreativeSourceUploadStatus)
}

function parseApiErrorValue(value: unknown): ApiError["error"] | null | undefined {
  if (value === null) return null
  if (!isRecord(value) || !nonEmptyString(value.code) || !nonEmptyString(value.message) || typeof value.retryable !== "boolean") return undefined
  const details = value.details
  if (details === null) return { code: value.code, message: value.message, retryable: value.retryable, details: null }
  if (!Array.isArray(details) || !details.every((item) => isRecord(item) && (item.field === null || nonEmptyString(item.field)) && nonEmptyString(item.reason))) return undefined
  return {
    code: value.code,
    message: value.message,
    retryable: value.retryable,
    details: details.map((item) => ({ field: item.field as string | null, reason: item.reason as string })),
  }
}

function studioChangeOperation(value: unknown): value is StudioChangeOperation {
  return value === "add_part" || value === "replace_section" || value === "extend" || value === "transform"
}

function studioRemasterStrength(value: unknown): value is StudioRemasterStrength {
  return typeof value === "string" && studioRemasterStrengths.some((strength) => strength === value)
}

function studioRemasterSource(value: unknown): StudioRemasterSource | null {
  if (!isRecord(value)) return null
  if (value.type === "version") return { type: "version" }
  if (value.type === "mix_revision" && nonEmptyString(value.mix_revision_ref)) {
    return { type: "mix_revision", mix_revision_ref: value.mix_revision_ref }
  }
  return null
}

function studioTransformScope(value: unknown): StudioChangeRangeScope | StudioChangeWholeVersionScope | null {
  if (!isRecord(value)) return null
  if (value.type === "whole_version") return { type: "whole_version" }
  if (
    value.type === "time_range"
    && integer(value.start_ms)
    && integer(value.end_ms, 1)
    && value.end_ms > value.start_ms
  ) {
    return { type: "time_range", start_ms: value.start_ms, end_ms: value.end_ms }
  }
  return null
}

function studioChangePreserve(value: unknown): value is StudioChangePreserve {
  return value === "melody"
    || value === "lyrics"
    || value === "vocal_identity"
    || value === "tempo"
    || value === "structure"
}

function studioChangePreserveList(value: unknown): StudioChangePreserve[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every(studioChangePreserve)) return null
  return new Set(value).size === value.length ? value : null
}

function studioReferenceAssetRefs(value: unknown): string[] | null {
  if (!stringArray(value) || value.length > 8 || new Set(value).size !== value.length) return null
  return value
}

function studioCoverMode(value: unknown): value is StudioCoverMode {
  return value === "vocal" || value === "instrumental"
}

function sameOrderedValues(left: string[], right: readonly string[]): boolean {
  return left.length === right.length && right.every((value, index) => left[index] === value)
}

function artworkStyle(value: unknown): value is ArtworkStyle {
  return typeof value === "string" && artworkStyles.some((style) => style === value)
}

function artworkPalette(value: unknown): value is ArtworkPalette {
  return typeof value === "string" && artworkPalettes.some((palette) => palette === value)
}

function artworkGenerationStatus(value: unknown): value is ArtworkGenerationStatus {
  return value === "queued"
    || value === "generating"
    || value === "post_processing"
    || value === "succeeded"
    || value === "failed"
    || value === "cancelled"
    || value === "expired"
}

function releaseVisibility(value: unknown): value is ReleaseVisibility {
  return typeof value === "string" && releaseVisibilities.some((visibility) => visibility === value)
}

function parseReleaseArtwork(value: unknown): ReleaseArtwork | null {
  if (!isRecord(value)) return null
  if (value.type === "current" && Object.keys(value).length === 1) return { type: "current" }
  if (value.type === "artwork_candidate" && nonEmptyString(value.artwork_candidate_ref) && Object.keys(value).length === 2) {
    return { type: "artwork_candidate", artwork_candidate_ref: value.artwork_candidate_ref }
  }
  return null
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

function stemSeparationMode(value: unknown): value is StemSeparationMode {
  return typeof value === "string" && stemSeparationModes.some((mode) => mode === value)
}

function stemTargetKind(value: unknown): value is StemTargetKind {
  return typeof value === "string" && stemTargetKinds.some((kind) => kind === value)
}

function stemTargetKindArray(value: unknown): value is StemTargetKind[] {
  return Array.isArray(value)
    && value.length <= 10
    && value.every(stemTargetKind)
    && new Set(value).size === value.length
}

function moriCreativeSourceKind(value: unknown): value is MoriCreativeSourceKind {
  return typeof value === "string" && moriCreativeSourceKinds.some((kind) => kind === value)
}

function stemSeparationStatus(value: unknown): value is StemSeparationStatus {
  return value === "queued" || value === "separating" || value === "succeeded" || value === "failed" || value === "cancelled" || value === "expired"
}

function stemKind(value: unknown): value is StemKind {
  return value === "vocals"
    || value === "backing_vocals"
    || value === "instrumental"
    || value === "drums"
    || value === "bass"
    || value === "guitar"
    || value === "keys"
    || value === "strings"
    || value === "wind"
    || value === "synth"
    || value === "percussion"
    || value === "other"
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

export function parseMoriCurrentVersionSelection(value: unknown): MoriCurrentVersionSelection | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.project_ref)
    || !nonEmptyString(value.current_version_ref)
    || !nonEmptyString(value.source_candidate_ref)
    || !nullableString(value.previous_version_ref)
    || !dateString(value.selected_at)
  ) return null
  return {
    project_ref: value.project_ref,
    current_version_ref: value.current_version_ref,
    source_candidate_ref: value.source_candidate_ref,
    previous_version_ref: value.previous_version_ref,
    selected_at: value.selected_at,
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

export function parseMoriCurrentSongPlanRevision(value: unknown): MoriCurrentSongPlanRevision | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.song_plan_ref)
    || !nonEmptyString(value.project_ref)
    || !integer(value.revision, 1)
    || !nonEmptyString(value.prompt)
    || !nonEmptyString(value.mood)
    || !integer(value.tempo_bpm, 40, 240)
    || !stringArray(value.structure)
    || value.structure.length === 0
    || !stringArray(value.instruments)
    || !nonEmptyString(value.vocal_direction)
    || !nonEmptyString(value.lyrics_intent)
    || !dateString(value.created_at)
  ) return null
  return {
    song_plan_ref: value.song_plan_ref,
    project_ref: value.project_ref,
    revision: value.revision,
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

export function parseMoriLyricsDraftRevision(value: unknown): MoriLyricsDraftRevision | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.lyrics_draft_ref)
    || !nonEmptyString(value.project_ref)
    || !nonEmptyString(value.version_ref)
    || !integer(value.revision, 1)
    || typeof value.text !== "string"
    || value.text.length > 20_000
    || !nonEmptyString(value.source_digest)
    || !dateString(value.updated_at)
  ) return null
  return {
    lyrics_draft_ref: value.lyrics_draft_ref,
    project_ref: value.project_ref,
    version_ref: value.version_ref,
    revision: value.revision,
    text: value.text,
    source_digest: value.source_digest,
    updated_at: value.updated_at,
  }
}

export function parseMoriProjectWorkspaceOpenVersion(value: unknown): MoriProjectWorkspaceOpenVersion | null {
  if (!isRecord(value) || !nonEmptyString(value.project_ref) || !nonEmptyString(value.version_ref) || !integer(value.revision, 1) || !dateString(value.updated_at)) return null
  return {
    project_ref: value.project_ref,
    version_ref: value.version_ref,
    revision: value.revision,
    updated_at: value.updated_at,
  }
}

export function parseMoriProjectWorkspaceMixRevision(value: unknown): MoriProjectWorkspaceMixRevision | null {
  if (!isRecord(value) || !nonEmptyString(value.mix_revision_ref) || !nonEmptyString(value.version_ref) || !integer(value.revision, 1) || !nonEmptyString(value.name) || value.name.length > 120 || !integer(value.track_count, 1, 12) || !dateString(value.created_at)) return null
  return {
    mix_revision_ref: value.mix_revision_ref,
    version_ref: value.version_ref,
    revision: value.revision,
    name: value.name,
    track_count: value.track_count,
    created_at: value.created_at,
  }
}

function projectWorkspaceActiveTaskKind(value: unknown): MoriProjectWorkspaceActiveTask["kind"] | null {
  if (value === "generation" || value === "lyrics_revision" || value === "stem_separation" || value === "artwork_generation" || value === "export") return value
  return null
}

export function parseMoriProjectWorkspaceActiveTask(value: unknown): MoriProjectWorkspaceActiveTask | null {
  if (!isRecord(value) || !nonEmptyString(value.task_ref) || !nonEmptyString(value.project_ref) || !nullableString(value.version_ref) || (value.status !== "queued" && value.status !== "running") || !integer(value.progress, 0, 100) || !dateString(value.updated_at)) return null
  const kind = projectWorkspaceActiveTaskKind(value.kind)
  if (kind === null) return null
  return {
    task_ref: value.task_ref,
    kind,
    project_ref: value.project_ref,
    version_ref: value.version_ref,
    status: value.status,
    progress: value.progress,
    updated_at: value.updated_at,
  }
}

export function parseMoriProjectWorkspaceProjection(value: unknown): MoriProjectWorkspaceProjection | null {
  if (!isRecord(value) || !Array.isArray(value.active_tasks) || !nonEmptyString(value.revision_cursor) || !dateString(value.observed_at)) return null
  const project = parseMoriProject(value.project)
  const currentSongPlan = value.current_song_plan === null ? null : parseMoriCurrentSongPlanRevision(value.current_song_plan)
  const openVersion = value.open_version === null ? null : parseMoriProjectWorkspaceOpenVersion(value.open_version)
  const latestLyricsDraft = value.latest_lyrics_draft === null ? null : parseMoriLyricsDraftRevision(value.latest_lyrics_draft)
  const latestMixRevision = value.latest_mix_revision === null ? null : parseMoriProjectWorkspaceMixRevision(value.latest_mix_revision)
  const activeTasks = value.active_tasks.map(parseMoriProjectWorkspaceActiveTask)
  if (
    project === null
    || currentSongPlan === null && value.current_song_plan !== null
    || openVersion === null && value.open_version !== null
    || latestLyricsDraft === null && value.latest_lyrics_draft !== null
    || latestMixRevision === null && value.latest_mix_revision !== null
    || !activeTasks.every(present)
    || new Set(activeTasks.map((task) => task.task_ref)).size !== activeTasks.length
  ) return null
  if (currentSongPlan?.project_ref !== undefined && currentSongPlan.project_ref !== project.project_ref) return null
  if (openVersion?.project_ref !== undefined && openVersion.project_ref !== project.project_ref) return null
  if (latestLyricsDraft !== null && (openVersion === null || latestLyricsDraft.project_ref !== project.project_ref || latestLyricsDraft.version_ref !== openVersion.version_ref)) return null
  if (latestMixRevision !== null && (openVersion === null || latestMixRevision.version_ref !== openVersion.version_ref)) return null
  if (activeTasks.some((task) => task.project_ref !== project.project_ref)) return null
  return {
    project,
    current_song_plan: currentSongPlan,
    open_version: openVersion,
    latest_lyrics_draft: latestLyricsDraft,
    latest_mix_revision: latestMixRevision,
    active_tasks: activeTasks,
    revision_cursor: value.revision_cursor,
    observed_at: value.observed_at,
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

export function parseStemSeparationReceipt(value: unknown): StemSeparationReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.stem_separation_ref) || (value.status !== "queued" && value.status !== "separating")) return null
  return { stem_separation_ref: value.stem_separation_ref, status: value.status }
}

export function parseStemSeparationCancelReceipt(value: unknown): StemSeparationCancelReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.stem_separation_ref) || !stemSeparationStatus(value.status)) return null
  return { stem_separation_ref: value.stem_separation_ref, status: value.status }
}

export function parseArtworkGenerationReceipt(value: unknown): ArtworkGenerationReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.artwork_generation_ref) || (value.status !== "queued" && value.status !== "generating")) return null
  return { artwork_generation_ref: value.artwork_generation_ref, status: value.status }
}

export function parseArtworkGenerationCancelReceipt(value: unknown): ArtworkGenerationCancelReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.artwork_generation_ref) || !artworkGenerationStatus(value.status)) return null
  return { artwork_generation_ref: value.artwork_generation_ref, status: value.status }
}

export function parseMoriArtworkCandidate(value: unknown): MoriArtworkCandidate | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.artwork_candidate_ref)
    || !nonEmptyString(value.image_asset_ref)
    || !nonEmptyString(value.thumbnail_asset_ref)
    || !nonEmptyString(value.alt_text)
  ) return null
  return {
    artwork_candidate_ref: value.artwork_candidate_ref,
    image_asset_ref: value.image_asset_ref,
    thumbnail_asset_ref: value.thumbnail_asset_ref,
    alt_text: value.alt_text,
  }
}

export function parseArtworkGenerationSnapshot(value: unknown): ArtworkGenerationSnapshot | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.artwork_generation_ref)
    || !nonEmptyString(value.version_ref)
    || !artworkGenerationStatus(value.status)
    || !integer(value.progress, 0, 100)
    || !nonEmptyString(value.prompt)
    || value.prompt.length > 400
    || !artworkStyle(value.style)
    || !artworkPalette(value.palette)
    || value.aspect_ratio !== "1:1"
    || value.text_policy !== "no_text"
    || value.output_count !== 4
    || !Array.isArray(value.candidates)
    || !dateString(value.created_at)
  ) return null
  const candidates = value.candidates.map(parseMoriArtworkCandidate)
  if (!candidates.every(present) || !validArtworkCandidates(value.status, candidates)) return null
  return {
    artwork_generation_ref: value.artwork_generation_ref,
    version_ref: value.version_ref,
    status: value.status,
    progress: value.progress,
    prompt: value.prompt,
    style: value.style,
    palette: value.palette,
    aspect_ratio: "1:1",
    text_policy: "no_text",
    output_count: 4,
    candidates,
    created_at: value.created_at,
  }
}

export function parseArtworkGenerationEventData(value: unknown): MoriArtworkGenerationEvent["data"] | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.artwork_generation_ref)
    || !nonEmptyString(value.version_ref)
    || !artworkGenerationStatus(value.status)
    || !integer(value.progress, 0, 100)
    || !stringArray(value.artwork_candidate_refs)
    || value.artwork_candidate_refs.length > 4
  ) return null
  return {
    artwork_generation_ref: value.artwork_generation_ref,
    version_ref: value.version_ref,
    status: value.status,
    progress: value.progress,
    artwork_candidate_refs: value.artwork_candidate_refs,
  }
}

export function parseMoriReleaseDraft(value: unknown): MoriReleaseDraft | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.release_draft_ref)
    || !nonEmptyString(value.version_ref)
    || !integer(value.revision, 1)
    || value.state !== "draft"
    || !nonEmptyString(value.title)
    || value.title.length > 120
    || typeof value.description !== "string"
    || value.description.length > 500
    || !releaseVisibility(value.visibility)
    || typeof value.allow_remix !== "boolean"
    || typeof value.explicit_content !== "boolean"
    || !dateString(value.updated_at)
  ) return null
  const artwork = parseReleaseArtwork(value.artwork)
  if (artwork === null) return null
  return {
    release_draft_ref: value.release_draft_ref,
    version_ref: value.version_ref,
    revision: value.revision,
    state: "draft",
    title: value.title,
    description: value.description,
    visibility: value.visibility,
    allow_remix: value.allow_remix,
    explicit_content: value.explicit_content,
    artwork,
    updated_at: value.updated_at,
  }
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
    if (!nullableString(value.song_plan_ref) || (value.mode !== "smart" && value.mode !== "custom") || value.source_version_ref !== null || value.operation !== null || value.output_count !== 2) return null
    return {
      ...common,
      generation_kind: "new_song",
      song_plan_ref: value.song_plan_ref,
      mode: value.mode,
      source_version_ref: null,
      operation: null,
      output_count: 2,
    }
  }
  if (value.generation_kind === "studio_change") {
    if (value.song_plan_ref !== null || value.mode !== null || !nonEmptyString(value.source_version_ref) || !studioChangeOperation(value.operation)) return null
    if (value.operation !== "transform") {
      if ("intent" in value) return null
      return {
        ...common,
        generation_kind: "studio_change",
        song_plan_ref: null,
        mode: null,
        source_version_ref: value.source_version_ref,
        operation: value.operation,
      }
    }

    if (value.intent === "remaster") {
      const source = studioRemasterSource(value.source)
      if (
        source === null
        || !studioRemasterStrength(value.variation_strength)
      ) return null
      return {
        ...common,
        generation_kind: "studio_change",
        song_plan_ref: null,
        mode: null,
        source_version_ref: value.source_version_ref,
        operation: "transform",
        intent: "remaster",
        source,
        variation_strength: value.variation_strength,
      }
    }

    const scope = studioTransformScope(value.scope)
    const preserve = studioChangePreserveList(value.preserve)
    const referenceAssetRefs = studioReferenceAssetRefs(value.reference_asset_refs)
    if (
      scope === null
      || !nonEmptyString(value.instruction)
      || value.instruction.length > 2_000
      || preserve === null
      || referenceAssetRefs === null
      || !studioChangeOutputCount(value.output_count)
    ) return null

    if (value.intent === "restyle") {
      return {
        ...common,
        generation_kind: "studio_change",
        song_plan_ref: null,
        mode: null,
        source_version_ref: value.source_version_ref,
        operation: "transform",
        intent: "restyle",
        scope,
        instruction: value.instruction,
        preserve,
        reference_asset_refs: referenceAssetRefs,
        output_count: value.output_count,
      }
    }

    if (value.intent === "cover") {
      if (
        scope.type !== "whole_version"
        || !studioCoverMode(value.cover_mode)
        || !nullableString(value.voice_ref)
        || value.output_count !== 2
        || referenceAssetRefs.length !== 0
      ) return null
      const expectedAnchors = value.cover_mode === "vocal"
        ? studioVocalCoverProtectedAnchors
        : studioInstrumentalCoverProtectedAnchors
      if (!sameOrderedValues(preserve, expectedAnchors)) return null
      if (value.cover_mode === "instrumental" && value.voice_ref !== null) return null
      return {
        ...common,
        generation_kind: "studio_change",
        song_plan_ref: null,
        mode: null,
        source_version_ref: value.source_version_ref,
        operation: "transform",
        intent: "cover",
        scope: { type: "whole_version" },
        cover_mode: value.cover_mode,
        voice_ref: value.voice_ref,
        instruction: value.instruction,
        preserve,
        reference_asset_refs: [],
        output_count: 2,
      }
    }

    return null
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
  if (
    value.type === "section"
    && nonEmptyString(value.section_label)
    && integer(value.start_line)
    && integer(value.end_line, 1)
    && value.end_line > value.start_line
  ) {
    return {
      type: "section",
      section_label: value.section_label,
      start_line: value.start_line,
      end_line: value.end_line,
    }
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

export function parseMoriStem(value: unknown): MoriStem | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.stem_ref)
    || !stemKind(value.kind)
    || !nonEmptyString(value.label)
    || !nonEmptyString(value.audio_asset_ref)
    || !nonEmptyString(value.waveform_asset_ref)
    || !integer(value.duration_seconds, 1)
  ) return null
  return {
    stem_ref: value.stem_ref,
    kind: value.kind,
    label: value.label,
    audio_asset_ref: value.audio_asset_ref,
    waveform_asset_ref: value.waveform_asset_ref,
    duration_seconds: value.duration_seconds,
  }
}

export function parseMoriMixTrack(value: unknown): MoriMixTrack | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.stem_ref)
    || typeof value.gain !== "number"
    || !Number.isFinite(value.gain)
    || value.gain < 0
    || value.gain > 1
    || typeof value.muted !== "boolean"
    || value.pan !== undefined && (typeof value.pan !== "number" || !Number.isFinite(value.pan) || value.pan < -1 || value.pan > 1)
  ) return null
  return {
    stem_ref: value.stem_ref,
    gain: value.gain,
    muted: value.muted,
    pan: value.pan === undefined ? 0 : value.pan,
  }
}

export function parseMoriMixRevision(value: unknown): MoriMixRevision | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.mix_revision_ref)
    || !nonEmptyString(value.version_ref)
    || !nonEmptyString(value.source_stem_separation_ref)
    || !nonEmptyString(value.name)
    || value.name.length > 120
    || !integer(value.revision, 1)
    || !Array.isArray(value.tracks)
    || value.tracks.length < 1
    || value.tracks.length > 12
    || !dateString(value.created_at)
  ) return null

  const tracks = value.tracks.map(parseMoriMixTrack)
  if (!tracks.every(present)) return null
  const stemRefs = tracks.map((track) => track.stem_ref)
  if (new Set(stemRefs).size !== stemRefs.length) return null

  return {
    mix_revision_ref: value.mix_revision_ref,
    version_ref: value.version_ref,
    source_stem_separation_ref: value.source_stem_separation_ref,
    name: value.name,
    revision: value.revision,
    tracks,
    created_at: value.created_at,
  }
}

export function parseStemSeparationSnapshot(value: unknown): StemSeparationSnapshot | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.stem_separation_ref)
    || !nonEmptyString(value.version_ref)
    || !stemSeparationStatus(value.status)
    || !integer(value.progress, 0, 100)
    || !stemSeparationMode(value.mode)
    || !stemTargetKindArray(value.target_kinds)
    || !validStemTargetCount(value.mode, value.target_kinds.length)
    || typeof value.include_midi !== "boolean"
    || !nonEmptyString(value.source_audio_digest)
    || !Array.isArray(value.stems)
    || !nullableString(value.midi_asset_ref)
    || !dateString(value.created_at)
  ) return null
  const stems = value.stems.map(parseMoriStem)
  if (!stems.every(present)) return null
  if (!validStemSeparationAssets(value.status, value.mode, value.target_kinds, value.include_midi, stems, value.midi_asset_ref)) return null
  return {
    stem_separation_ref: value.stem_separation_ref,
    version_ref: value.version_ref,
    status: value.status,
    progress: value.progress,
    mode: value.mode,
    target_kinds: value.target_kinds,
    include_midi: value.include_midi,
    source_audio_digest: value.source_audio_digest,
    stems,
    midi_asset_ref: value.midi_asset_ref,
    created_at: value.created_at,
  }
}

function validArtworkCandidates(status: ArtworkGenerationStatus, candidates: MoriArtworkCandidate[]): boolean {
  if (status !== "succeeded") return candidates.length === 0
  if (candidates.length !== 4) return false
  const candidateRefs = candidates.map((candidate) => candidate.artwork_candidate_ref)
  const imageRefs = candidates.map((candidate) => candidate.image_asset_ref)
  return new Set(candidateRefs).size === candidateRefs.length && new Set(imageRefs).size === imageRefs.length
}

export function parseStemSeparationEventData(value: unknown): MoriStemSeparationEvent["data"] | null {
  if (
    !isRecord(value)
    || !nonEmptyString(value.stem_separation_ref)
    || !nonEmptyString(value.version_ref)
    || !stemSeparationStatus(value.status)
    || !integer(value.progress, 0, 100)
    || !stringArray(value.stem_refs)
    || value.stem_refs.length > 12
  ) return null
  return {
    stem_separation_ref: value.stem_separation_ref,
    version_ref: value.version_ref,
    status: value.status,
    progress: value.progress,
    stem_refs: value.stem_refs,
  }
}

function validStemSeparationAssets(
  status: StemSeparationStatus,
  mode: StemSeparationMode,
  targetKinds: StemTargetKind[],
  includeMidi: boolean,
  stems: MoriStem[],
  midiAssetRef: string | null,
): boolean {
  if (!includeMidi && midiAssetRef !== null) return false
  if (status !== "succeeded") return stems.length === 0 && midiAssetRef === null
  if (stems.length === 0 || stems.length > 12) return false
  if (mode !== "isolate_part") return true
  const targetKind = targetKinds[0]
  return targetKind !== undefined
    && stems.length === 2
    && stems.some((stem) => stem.kind === targetKind)
}

function validStemTargetCount(mode: StemSeparationMode, count: number): boolean {
  if (mode === "isolate_part") return count === 1
  if (mode === "auto_stems") return count === 0
  return count >= 2 && count <= 10
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
  if (!isRecord(value) || !nonEmptyString(value.library_item_ref) || !dateString(value.created_at)) return null
  if (
    value.kind === "version"
    && nonEmptyString(value.project_ref)
    && nonEmptyString(value.project_title)
    && nonEmptyString(value.version_ref)
    && nonEmptyString(value.title)
    && integer(value.duration_seconds, 1)
    && nonEmptyString(value.audio_asset_ref)
    && nonEmptyString(value.waveform_asset_ref)
  ) {
    const releaseStatus = value.release_status === undefined ? undefined : ["publishing", "published", "failed", "unpublished"].includes(value.release_status as string) ? value.release_status as MoriLibraryVersionItem["release_status"] : null
    if (releaseStatus === null || (value.release_ref !== undefined && !nullableString(value.release_ref)) || (value.public_url !== undefined && !nullableString(value.public_url))) return null
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
      ...(releaseStatus === undefined ? {} : { release_status: releaseStatus }),
      ...(value.release_ref === undefined ? {} : { release_ref: value.release_ref }),
      ...(value.public_url === undefined ? {} : { public_url: value.public_url }),
    }
  }
  return null
}

export function parseMoriLibraryPage(value: unknown): { items: MoriLibraryItem[]; next_cursor: string | null } | null {
  if (!isRecord(value) || !Array.isArray(value.items) || !nullableString(value.next_cursor)) return null
  const items = value.items.map(parseMoriLibraryItem)
  return items.every(present) ? { items, next_cursor: value.next_cursor } : null
}

export function parseMoriCreativeSource(value: unknown): MoriCreativeSource | null {
  if (!isRecord(value) || !moriCreativeSourceKind(value.source_kind) || !nonEmptyString(value.source_ref) || !nonEmptyString(value.name) || !nonEmptyString(value.description) || !dateString(value.created_at)) return null
  if (value.source_kind === "audio" && nonEmptyString(value.asset_ref) && integer(value.duration_seconds, 1)) {
    return {
      source_kind: "audio",
      source_ref: value.source_ref,
      asset_ref: value.asset_ref,
      name: value.name,
      description: value.description,
      duration_seconds: value.duration_seconds,
      created_at: value.created_at,
    }
  }
  if (value.source_kind === "voice") {
    return {
      source_kind: "voice",
      source_ref: value.source_ref,
      name: value.name,
      description: value.description,
      created_at: value.created_at,
    }
  }
  if (value.source_kind === "inspiration" && nonEmptyString(value.style)) {
    return {
      source_kind: "inspiration",
      source_ref: value.source_ref,
      name: value.name,
      description: value.description,
      style: value.style,
      created_at: value.created_at,
    }
  }
  return null
}

export function parseMoriCreativeSourcePage(value: unknown): { sources: MoriCreativeSource[]; next_cursor: string | null } | null {
  if (!isRecord(value) || !Array.isArray(value.sources) || !nullableString(value.next_cursor)) return null
  const sources = value.sources.map(parseMoriCreativeSource)
  return sources.every(present) ? { sources, next_cursor: value.next_cursor } : null
}

export function parseMoriCreativeSourceUploadReceipt(value: unknown): MoriCreativeSourceUploadReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.upload_ref) || !creativeSourceUploadStatus(value.status) || !dateString(value.expires_at)) return null
  return { upload_ref: value.upload_ref, status: value.status, expires_at: value.expires_at }
}

export function parseMoriCreativeSourceUpload(value: unknown): MoriCreativeSourceUpload | null {
  if (!isRecord(value) || !nonEmptyString(value.upload_ref) || value.source_kind !== "audio" || !creativeSourceUploadStatus(value.status) || !integer(value.bytes_received, 0) || !integer(value.byte_size, 1) || value.bytes_received > value.byte_size || !nullableString(value.asset_ref) || !nullableString(value.source_ref) || !dateString(value.created_at) || !dateString(value.updated_at) || !dateString(value.expires_at)) return null
  const error = parseApiErrorValue(value.error)
  if (error === undefined || (value.status === "ready" && (value.asset_ref === null || value.source_ref === null)) || (value.status !== "ready" && (value.asset_ref !== null || value.source_ref !== null))) return null
  return {
    upload_ref: value.upload_ref,
    source_kind: "audio",
    status: value.status,
    bytes_received: value.bytes_received,
    byte_size: value.byte_size,
    asset_ref: value.asset_ref,
    source_ref: value.source_ref,
    error,
    created_at: value.created_at,
    updated_at: value.updated_at,
    expires_at: value.expires_at,
  }
}

export function parsePublishReleaseReceipt(value: unknown): PublishReleaseReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.release_ref) || !nonEmptyString(value.version_ref) || !nonEmptyString(value.status) || !["publishing", "published", "failed", "unpublished"].includes(value.status) || !nullableString(value.public_url) || !dateString(value.created_at)) return null
  return { release_ref: value.release_ref, version_ref: value.version_ref, status: value.status as PublishReleaseReceipt["status"], public_url: value.public_url, created_at: value.created_at }
}

export function parseMoriRelease(value: unknown): MoriRelease | null {
  const receipt = parsePublishReleaseReceipt(value)
  if (receipt === null || !nonEmptyString((value as Record<string, unknown>).release_draft_ref) || !dateString((value as Record<string, unknown>).updated_at)) return null
  return { ...receipt, release_draft_ref: (value as Record<string, string>).release_draft_ref, updated_at: (value as Record<string, string>).updated_at }
}

export function parseMoriShare(value: unknown): MoriShare | null {
  if (!isRecord(value) || !nonEmptyString(value.share_ref) || !nonEmptyString(value.version_ref) || !nonEmptyString(value.release_draft_ref) || !nonEmptyString(value.status) || !["creating", "active", "failed", "revoked"].includes(value.status) || !nullableString(value.share_url) || !dateString(value.created_at) || !dateString(value.updated_at)) return null
  if ((value.status === "active") !== (value.share_url !== null)) return null
  return {
    share_ref: value.share_ref,
    version_ref: value.version_ref,
    release_draft_ref: value.release_draft_ref,
    status: value.status as MoriShare["status"],
    share_url: value.share_url,
    created_at: value.created_at,
    updated_at: value.updated_at,
  }
}

export function parseMoriExportReceipt(value: unknown): MoriExportReceipt | null {
  if (!isRecord(value) || !nonEmptyString(value.export_ref) || (value.status !== "queued" && value.status !== "processing")) return null
  return { export_ref: value.export_ref, status: value.status }
}

export function parseMoriExportSnapshot(value: unknown): MoriExportSnapshot | null {
  if (!isRecord(value) || !nonEmptyString(value.export_ref) || !nonEmptyString(value.project_ref) || !nonEmptyString(value.version_ref) || (value.format !== "mp3" && value.format !== "wav") || (value.status !== "queued" && value.status !== "processing" && value.status !== "succeeded" && value.status !== "failed") || !nullableString(value.download_url) || !dateString(value.created_at)) return null
  const source = parseMoriExportSource(value.source)
  const scope = parseMoriExportScope(value.scope)
  if (source === null || scope === null) return null
  if ((value.status === "succeeded") !== (value.download_url !== null)) return null
  return {
    export_ref: value.export_ref,
    project_ref: value.project_ref,
    version_ref: value.version_ref,
    source,
    scope,
    format: value.format,
    status: value.status,
    download_url: value.download_url,
    created_at: value.created_at,
  }
}

function parseMoriExportSource(value: unknown): MoriExportSource | null {
  if (!isRecord(value)) return null
  if (value.type === "version") return Object.keys(value).length === 1 ? { type: "version" } : null
  if (value.type !== "mix_revision" || !nonEmptyString(value.mix_revision_ref) || Object.keys(value).length !== 2) return null
  return { type: "mix_revision", mix_revision_ref: value.mix_revision_ref }
}

function parseMoriExportScope(value: unknown): MoriExportScope | null {
  if (!isRecord(value)) return null
  if (value.type === "full_song") return Object.keys(value).length === 1 ? { type: "full_song" } : null
  if (
    value.type !== "time_range"
    || Object.keys(value).length !== 3
    || !integer(value.start_ms)
    || !integer(value.end_ms, 1)
    || value.end_ms <= value.start_ms
  ) return null
  return { type: "time_range", start_ms: value.start_ms, end_ms: value.end_ms }
}
