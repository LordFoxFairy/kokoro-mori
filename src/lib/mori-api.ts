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

export type StudioLayerKind = "vocals" | "instrumental"

export type StudioChangePreserve = "melody" | "lyrics" | "vocal_identity" | "tempo" | "structure"

export type StudioTransformIntent = "restyle" | "cover"

export type StudioCoverMode = "vocal" | "instrumental"

export const studioVocalCoverProtectedAnchors: readonly StudioChangePreserve[] = ["melody", "lyrics", "structure"]

export const studioInstrumentalCoverProtectedAnchors: readonly StudioChangePreserve[] = ["melody", "structure"]

export const studioRemasterStrengths = ["subtle", "balanced", "bold"] as const

export type StudioRemasterStrength = typeof studioRemasterStrengths[number]

export const studioRemasterProtectedAnchors: readonly StudioChangePreserve[] = [
  "melody",
  "lyrics",
  "vocal_identity",
  "tempo",
  "structure",
]

export type StudioRemasterSource =
  | { type: "version" }
  | { type: "mix_revision"; mix_revision_ref: MoriRef }

export const artworkStyles = ["abstract", "editorial", "illustrated", "photographic"] as const

export type ArtworkStyle = typeof artworkStyles[number]

export const artworkPalettes = ["warm_dawn", "violet_night", "mint_haze", "monochrome"] as const

export type ArtworkPalette = typeof artworkPalettes[number]

export type ArtworkGenerationStatus = "queued" | "generating" | "post_processing" | "succeeded" | "failed" | "cancelled" | "expired"

export type ArtworkGenerationInput = {
  prompt: string
  style: ArtworkStyle
  palette: ArtworkPalette
  aspect_ratio: "1:1"
  text_policy: "no_text"
  output_count: 4
}

export type ArtworkGenerationReceipt = {
  artwork_generation_ref: MoriRef
  status: Extract<ArtworkGenerationStatus, "queued" | "generating">
}

export type ArtworkGenerationCancelReceipt = {
  artwork_generation_ref: MoriRef
  status: ArtworkGenerationStatus
}

export type MoriArtworkCandidate = {
  artwork_candidate_ref: MoriRef
  image_asset_ref: MoriRef
  thumbnail_asset_ref: MoriRef
  alt_text: string
}

export type ArtworkGenerationSnapshot = ArtworkGenerationInput & {
  artwork_generation_ref: MoriRef
  version_ref: MoriRef
  status: ArtworkGenerationStatus
  progress: number
  candidates: MoriArtworkCandidate[]
  created_at: string
}

export type MoriArtworkGenerationEvent = {
  id: string
  event: string
  data: {
    artwork_generation_ref: MoriRef
    version_ref: MoriRef
    status: ArtworkGenerationStatus
    progress: number
    artwork_candidate_refs: MoriRef[]
  }
}

export const releaseVisibilities = ["private", "link_only", "public"] as const

export type ReleaseVisibility = typeof releaseVisibilities[number]

export type ReleaseArtwork =
  | { type: "current" }
  | { type: "artwork_candidate"; artwork_candidate_ref: MoriRef }

export type ReleaseDraftInput = {
  title: string
  description: string
  visibility: ReleaseVisibility
  allow_remix: boolean
  explicit_content: boolean
  artwork: ReleaseArtwork
  expected_revision: number | null
}

export type MoriReleaseDraft = Omit<ReleaseDraftInput, "expected_revision"> & {
  release_draft_ref: MoriRef
  version_ref: MoriRef
  revision: number
  state: "draft"
  updated_at: string
}

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

export type StudioRemasterGenerationInput = StudioChangeGenerationCommonInput & {
  operation: "transform"
  scope: StudioChangeWholeVersionScope
  intent: "remaster"
  source: StudioRemasterSource
  variation_strength: StudioRemasterStrength
}

export type StudioRestyleGenerationInput = StudioChangeGenerationCommonInput & {
  operation: "transform"
  intent: "restyle"
  scope: StudioChangeRangeScope | StudioChangeWholeVersionScope
}

export type StudioCoverGenerationInput = StudioChangeGenerationCommonInput & {
  operation: "transform"
  intent: "cover"
  scope: StudioChangeWholeVersionScope
  cover_mode: StudioCoverMode
  voice_ref: MoriRef | null
}

type StandardStudioChangeGenerationInput = StudioChangeGenerationCommonInput & (
  | { operation: "add_part"; scope: StudioChangeInsertionScope }
  | {
      operation: "add_part"
      scope: StudioChangeWholeVersionScope
      part_kind: StudioLayerKind
      lyrics: string | null
      voice_ref: MoriRef | null
    }
  | { operation: "replace_section"; scope: StudioChangeRangeScope }
  | { operation: "extend"; scope: StudioChangeFromScope }
)

export type StudioChangeGenerationInput =
  | StandardStudioChangeGenerationInput
  | StudioRestyleGenerationInput
  | StudioCoverGenerationInput
  | StudioRemasterGenerationInput

export type LyricsRevisionDirection = "rewrite" | "continue" | "rhyme" | "restructure"

export type LyricsRevisionConstraint = "meaning" | "cadence" | "rhyme_scheme" | "section_length"

export type LyricsRevisionInputScope =
  | { type: "section"; section_label: string; start_line: number; end_line: number; source_text: string }
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
  | { type: "section"; section_label: string; start_line: number; end_line: number }
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

export const stemSeparationModes = ["isolate_part", "auto_stems", "custom_stems"] as const

export type StemSeparationMode = typeof stemSeparationModes[number]

export const stemTargetKinds = [
  "vocals",
  "backing_vocals",
  "drums",
  "bass",
  "guitar",
  "keys",
  "strings",
  "wind",
  "synth",
  "percussion",
] as const

export type StemTargetKind = typeof stemTargetKinds[number]

export type StemKind = "vocals" | "backing_vocals" | "instrumental" | "drums" | "bass" | "guitar" | "keys" | "strings" | "wind" | "synth" | "percussion" | "other"

export type StemSeparationStatus = "queued" | "separating" | "succeeded" | "failed" | "cancelled" | "expired"

export type StemSeparationInput = {
  mode: StemSeparationMode
  target_kinds: StemTargetKind[]
  include_midi: boolean
}

export type StemSeparationReceipt = {
  stem_separation_ref: MoriRef
  status: Extract<StemSeparationStatus, "queued" | "separating">
}

export type StemSeparationCancelReceipt = {
  stem_separation_ref: MoriRef
  status: StemSeparationStatus
}

export type MoriStem = {
  stem_ref: MoriRef
  kind: StemKind
  label: string
  audio_asset_ref: MoriRef
  waveform_asset_ref: MoriRef
  duration_seconds: number
}

export type StemSeparationSnapshot = {
  stem_separation_ref: MoriRef
  version_ref: MoriRef
  status: StemSeparationStatus
  progress: number
  mode: StemSeparationMode
  target_kinds: StemTargetKind[]
  include_midi: boolean
  source_audio_digest: string
  stems: MoriStem[]
  midi_asset_ref: MoriRef | null
  created_at: string
}

export type MoriMixTrack = {
  stem_ref: MoriRef
  gain: number
  muted: boolean
}

export type MixRevisionInput = {
  source_stem_separation_ref: MoriRef
  name: string
  tracks: MoriMixTrack[]
}

export type MoriMixRevision = MixRevisionInput & {
  mix_revision_ref: MoriRef
  version_ref: MoriRef
  revision: number
  created_at: string
}

export type MoriStemSeparationEvent = {
  id: string
  event: string
  data: {
    stem_separation_ref: MoriRef
    version_ref: MoriRef
    status: StemSeparationStatus
    progress: number
    stem_refs: MoriRef[]
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

export type CurrentVersionInput = {
  candidate_ref: MoriRef
  version_ref: MoriRef
  expected_current_version_ref: MoriRef | null
}

export type MoriCurrentVersionSelection = {
  project_ref: MoriRef
  current_version_ref: MoriRef
  source_candidate_ref: MoriRef
  previous_version_ref: MoriRef | null
  selected_at: string
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

export type StandardStudioChangeGenerationSnapshot = GenerationSnapshotBase & {
  generation_kind: "studio_change"
  song_plan_ref: null
  mode: null
  source_version_ref: MoriRef
  operation: Exclude<StudioChangeOperation, "transform">
  intent?: never
  source?: never
  variation_strength?: never
}

export type StudioRestyleGenerationSnapshot = GenerationSnapshotBase & {
  generation_kind: "studio_change"
  song_plan_ref: null
  mode: null
  source_version_ref: MoriRef
  operation: "transform"
  intent: "restyle"
  scope: StudioChangeRangeScope | StudioChangeWholeVersionScope
  instruction: string
  preserve: StudioChangePreserve[]
  reference_asset_refs: MoriRef[]
  output_count: number
}

export type StudioCoverGenerationSnapshot = GenerationSnapshotBase & {
  generation_kind: "studio_change"
  song_plan_ref: null
  mode: null
  source_version_ref: MoriRef
  operation: "transform"
  intent: "cover"
  scope: StudioChangeWholeVersionScope
  cover_mode: StudioCoverMode
  voice_ref: MoriRef | null
  instruction: string
  preserve: StudioChangePreserve[]
  reference_asset_refs: MoriRef[]
  output_count: 2
}

export type StudioRemasterGenerationSnapshot = GenerationSnapshotBase & {
  generation_kind: "studio_change"
  song_plan_ref: null
  mode: null
  source_version_ref: MoriRef
  operation: "transform"
  intent: "remaster"
  source: StudioRemasterSource
  variation_strength: StudioRemasterStrength
}

export type StudioChangeGenerationSnapshot =
  | StandardStudioChangeGenerationSnapshot
  | StudioRestyleGenerationSnapshot
  | StudioCoverGenerationSnapshot
  | StudioRemasterGenerationSnapshot

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

export type MoriExportFormat = "mp3" | "wav"

export type MoriExportSource =
  | { type: "version" }
  | { type: "mix_revision"; mix_revision_ref: MoriRef }

export type MoriExportScope = { type: "full_song" }

export type MoriExportInput = {
  source: MoriExportSource
  scope: MoriExportScope
  format: MoriExportFormat
}

export type MoriExportReceipt = {
  export_ref: MoriRef
  status: Extract<MoriExportStatus, "queued" | "processing">
}

export type MoriExportSnapshot = {
  export_ref: MoriRef
  project_ref: MoriRef
  version_ref: MoriRef
  source: MoriExportSource
  scope: MoriExportScope
  format: MoriExportFormat
  status: MoriExportStatus
  download_url: string | null
  created_at: string
}

export type MoriApi = {
  listProjects: (options?: MoriProjectListOptions) => Promise<ApiSuccess<MoriProjectPage>>
  createProject: (input: MoriProjectCreateInput, idempotencyKey: string) => Promise<ApiSuccess<MoriProject>>
  getProject: (projectRef: MoriRef) => Promise<ApiSuccess<MoriProject>>
  putCurrentVersion: (projectRef: MoriRef, input: CurrentVersionInput, idempotencyKey: string) => Promise<ApiSuccess<MoriCurrentVersionSelection>>
  createSongPlan: (projectRef: MoriRef, input: SongPlanCreateInput, idempotencyKey: string) => Promise<ApiSuccess<MoriSongPlan>>
  createGeneration: (projectRef: MoriRef, input: GenerationCreateInput, idempotencyKey: string) => Promise<ApiSuccess<GenerationReceipt>>
  createStudioChange: (versionRef: MoriRef, input: StudioChangeGenerationInput, idempotencyKey: string) => Promise<ApiSuccess<GenerationReceipt>>
  createLyricsRevision: (versionRef: MoriRef, input: LyricsRevisionInput, idempotencyKey: string) => Promise<ApiSuccess<LyricsRevisionReceipt>>
  getLyricsRevision: (lyricsRevisionRef: MoriRef) => Promise<ApiSuccess<LyricsRevisionSnapshot>>
  getLyricsRevisionEvents: (lyricsRevisionRef: MoriRef, lastEventId?: string | null) => Promise<MoriLyricsRevisionEvent[]>
  cancelLyricsRevision: (lyricsRevisionRef: MoriRef, idempotencyKey: string) => Promise<ApiSuccess<LyricsRevisionCancelReceipt>>
  createStemSeparation: (versionRef: MoriRef, input: StemSeparationInput, idempotencyKey: string) => Promise<ApiSuccess<StemSeparationReceipt>>
  getStemSeparation: (stemSeparationRef: MoriRef) => Promise<ApiSuccess<StemSeparationSnapshot>>
  getStemSeparationEvents: (stemSeparationRef: MoriRef, lastEventId?: string | null, signal?: AbortSignal) => Promise<MoriStemSeparationEvent[]>
  cancelStemSeparation: (stemSeparationRef: MoriRef, idempotencyKey: string) => Promise<ApiSuccess<StemSeparationCancelReceipt>>
  createArtworkGeneration: (versionRef: MoriRef, input: ArtworkGenerationInput, idempotencyKey: string) => Promise<ApiSuccess<ArtworkGenerationReceipt>>
  getArtworkGeneration: (artworkGenerationRef: MoriRef) => Promise<ApiSuccess<ArtworkGenerationSnapshot>>
  getArtworkGenerationEvents: (artworkGenerationRef: MoriRef, lastEventId?: string | null, signal?: AbortSignal) => Promise<MoriArtworkGenerationEvent[]>
  cancelArtworkGeneration: (artworkGenerationRef: MoriRef, idempotencyKey: string) => Promise<ApiSuccess<ArtworkGenerationCancelReceipt>>
  getReleaseDraft: (versionRef: MoriRef) => Promise<ApiSuccess<MoriReleaseDraft>>
  putReleaseDraft: (versionRef: MoriRef, input: ReleaseDraftInput, idempotencyKey: string) => Promise<ApiSuccess<MoriReleaseDraft>>
  createMixRevision: (versionRef: MoriRef, input: MixRevisionInput, idempotencyKey: string) => Promise<ApiSuccess<MoriMixRevision>>
  getMixRevision: (mixRevisionRef: MoriRef) => Promise<ApiSuccess<MoriMixRevision>>
  getGeneration: (generationRef: MoriRef) => Promise<ApiSuccess<GenerationSnapshot>>
  getGenerationEvents: (generationRef: MoriRef, lastEventId?: string | null) => Promise<MoriGenerationEvent[]>
  listCandidates: (projectRef: MoriRef) => Promise<ApiSuccess<{ candidates: MoriCandidate[]; next_cursor: string | null }>>
  cancelGeneration: (generationRef: MoriRef, idempotencyKey: string) => Promise<ApiSuccess<GenerationCancelReceipt>>
  listLibrary: (kind?: "all" | "version") => Promise<ApiSuccess<{ items: MoriLibraryItem[]; next_cursor: string | null }>>
  createExport: (versionRef: MoriRef, input: MoriExportInput, idempotencyKey: string) => Promise<ApiSuccess<MoriExportReceipt>>
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

export type MoriStudioRemasterSource =
  | { type: "version" }
  | { type: "mix_revision"; mixRevisionRef: MoriRef }

export type MoriStudioRemasterDraft = MoriStudioChangeCommonDraft & {
  operation: "transform"
  scope: { type: "whole_version" }
  intent: "remaster"
  source: MoriStudioRemasterSource
  variationStrength: StudioRemasterStrength
}

export type MoriStudioRestyleDraft = MoriStudioChangeCommonDraft & {
  operation: "transform"
  intent: "restyle"
  scope: { type: "time_range"; startMs: number; endMs: number } | { type: "whole_version" }
}

export type MoriStudioCoverDraft = MoriStudioChangeCommonDraft & {
  operation: "transform"
  intent: "cover"
  scope: { type: "whole_version" }
  coverMode: StudioCoverMode
  voiceRef?: MoriRef
}

export type MoriStudioLayerDraft = MoriStudioChangeCommonDraft & {
  operation: "add_part"
  scope: { type: "whole_version" }
  partKind: StudioLayerKind
  lyrics?: string
  voiceRef?: MoriRef
}

export type MoriStudioChangeDraft = MoriStudioChangeCommonDraft & (
  | { operation: "add_part"; scope: { type: "insertion_point"; positionMs: number } }
  | MoriStudioLayerDraft
  | { operation: "replace_section"; scope: { type: "time_range"; startMs: number; endMs: number } }
  | { operation: "extend"; scope: { type: "from_position"; positionMs: number } }
  | MoriStudioRestyleDraft
  | MoriStudioCoverDraft
  | MoriStudioRemasterDraft
)

export type MoriLyricsRevisionDraft = {
  direction: LyricsRevisionDirection
  scope:
    | { type: "section"; sectionLabel: string; startLine: number; endLine: number; sourceText: string }
    | { type: "whole_lyrics"; sourceText: string }
  instruction: string
  lyricsContext: string
  constraints?: LyricsRevisionConstraint[]
  outputCount?: number
}

export type MoriStemSeparationDraft = {
  mode: StemSeparationMode
  targetKinds: StemTargetKind[]
  includeMidi: boolean
}

export type MoriMixRevisionDraft = {
  sourceStemSeparationRef: MoriRef
  name: string
  tracks: Array<{
    stemRef: MoriRef
    gain: number
    muted: boolean
  }>
}

export type MoriExportDraft = {
  source:
    | { type: "version" }
    | { type: "mix_revision"; mixRevisionRef: MoriRef }
  scope: MoriExportScope
  format: MoriExportFormat
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
      if ("partKind" in draft) {
        const lyrics = draft.partKind === "vocals" ? draft.lyrics?.trim() || "" : ""
        if (draft.partKind === "vocals" && lyrics === "") throw new Error("studio_layer_lyrics_required")
        if (lyrics.length > 20_000) throw new Error("studio_layer_lyrics_too_long")
        return {
          ...common,
          operation: "add_part",
          scope: { type: "whole_version" },
          part_kind: draft.partKind,
          lyrics: draft.partKind === "vocals" ? lyrics : null,
          voice_ref: draft.partKind === "vocals" ? draft.voiceRef?.trim() || null : null,
        }
      }
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
      if (draft.intent === "remaster") {
        if (draft.scope.type !== "whole_version") throw new Error("studio_remaster_scope_invalid")
        if (!studioRemasterStrengths.includes(draft.variationStrength)) throw new Error("studio_remaster_strength_invalid")
        if (outputCount !== 2) throw new Error("studio_remaster_output_count_invalid")
        if (!sameValues(common.preserve, studioRemasterProtectedAnchors)) throw new Error("studio_remaster_preserve_invalid")
        const source: StudioRemasterSource = draft.source.type === "version"
          ? { type: "version" }
          : { type: "mix_revision", mix_revision_ref: requiredRef(draft.source.mixRevisionRef, "studio_remaster_mix_revision_required") }
        return {
          ...common,
          operation: "transform",
          scope: { type: "whole_version" },
          intent: "remaster",
          source,
          variation_strength: draft.variationStrength,
        }
      }

      if (draft.intent === "cover") {
        if (draft.scope.type !== "whole_version") throw new Error("studio_cover_scope_invalid")
        if (draft.coverMode !== "vocal" && draft.coverMode !== "instrumental") throw new Error("studio_cover_mode_invalid")
        if (outputCount !== 2) throw new Error("studio_cover_output_count_invalid")
        if (referenceAssetRefs.length !== 0) throw new Error("studio_cover_references_invalid")
        const coverAnchors = draft.coverMode === "vocal"
          ? studioVocalCoverProtectedAnchors
          : studioInstrumentalCoverProtectedAnchors
        if (!sameValues(common.preserve, coverAnchors)) throw new Error("studio_cover_preserve_invalid")
        const voiceRef = draft.voiceRef?.trim() || null
        if (draft.coverMode === "instrumental" && voiceRef !== null) throw new Error("studio_cover_voice_invalid")
        return {
          ...common,
          operation: "transform",
          intent: "cover",
          scope: { type: "whole_version" },
          cover_mode: draft.coverMode,
          voice_ref: draft.coverMode === "vocal" ? voiceRef : null,
          preserve: [...coverAnchors],
          reference_asset_refs: [],
          output_count: 2,
        }
      }

      if (draft.intent !== "restyle") throw new Error("studio_transform_intent_invalid")
      if (draft.scope.type === "whole_version") return {
        ...common,
        operation: "transform",
        intent: "restyle",
        scope: { type: "whole_version" },
      }
      assertRange(draft.scope.startMs, draft.scope.endMs)
      return {
        ...common,
        operation: "transform",
        intent: "restyle",
        scope: { type: "time_range", start_ms: draft.scope.startMs, end_ms: draft.scope.endMs },
      }
  }
}

function requiredRef(value: string, errorCode: string): string {
  const ref = value.trim()
  if (ref === "") throw new Error(errorCode)
  return ref
}

function sameValues<T>(left: T[], right: readonly T[]): boolean {
  return left.length === right.length && right.every((value) => left.includes(value))
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
    if (sourceText !== lyricsContext) throw new Error("lyrics_revision_source_outside_context")
    return { ...common, scope: { type: "whole_lyrics", source_text: sourceText } }
  }

  const sectionLabel = draft.scope.sectionLabel.trim()
  if (sectionLabel === "") throw new Error("lyrics_revision_section_label_required")
  const { startLine, endLine } = draft.scope
  const contextLines = lyricsContext.split("\n")
  if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 0 || endLine <= startLine || endLine > contextLines.length) {
    throw new Error("lyrics_revision_line_range_invalid")
  }
  if (contextLines.slice(startLine, endLine).join("\n").trim() !== sourceText) {
    throw new Error("lyrics_revision_source_outside_context")
  }
  return {
    ...common,
    scope: {
      type: "section",
      section_label: sectionLabel,
      start_line: startLine,
      end_line: endLine,
      source_text: sourceText,
    },
  }
}

export function createStemSeparationRequest(draft: MoriStemSeparationDraft): StemSeparationInput {
  if (!stemSeparationModes.includes(draft.mode)) throw new Error("stem_separation_mode_invalid")
  if (typeof draft.includeMidi !== "boolean") throw new Error("stem_separation_include_midi_invalid")
  if (!Array.isArray(draft.targetKinds)) throw new Error("stem_separation_targets_invalid")
  const targetKinds: StemTargetKind[] = []
  for (const targetKind of draft.targetKinds) {
    if (!stemTargetKinds.includes(targetKind)) throw new Error("stem_separation_target_invalid")
    if (!targetKinds.includes(targetKind)) targetKinds.push(targetKind)
  }
  if (
    (draft.mode === "isolate_part" && targetKinds.length !== 1)
    || (draft.mode === "auto_stems" && targetKinds.length !== 0)
    || (draft.mode === "custom_stems" && (targetKinds.length < 2 || targetKinds.length > 10))
  ) throw new Error("stem_separation_target_count_invalid")
  return {
    mode: draft.mode,
    target_kinds: targetKinds,
    include_midi: draft.includeMidi,
  }
}

export function createMixRevisionRequest(draft: MoriMixRevisionDraft): MixRevisionInput {
  const sourceStemSeparationRef = draft.sourceStemSeparationRef.trim()
  if (sourceStemSeparationRef === "") throw new Error("mix_revision_source_required")

  const name = draft.name.trim()
  if (name === "") throw new Error("mix_revision_name_required")
  if (name.length > 120) throw new Error("mix_revision_name_too_long")

  if (!Array.isArray(draft.tracks) || draft.tracks.length < 1 || draft.tracks.length > 12) {
    throw new Error("mix_revision_tracks_invalid")
  }

  const seenStemRefs = new Set<string>()
  const tracks: MoriMixTrack[] = draft.tracks.map((track) => {
    const stemRef = track.stemRef.trim()
    if (
      stemRef === ""
      || seenStemRefs.has(stemRef)
      || !Number.isFinite(track.gain)
      || track.gain < 0
      || track.gain > 1
      || typeof track.muted !== "boolean"
    ) throw new Error("mix_revision_tracks_invalid")

    seenStemRefs.add(stemRef)
    return {
      stem_ref: stemRef,
      gain: Math.round(track.gain * 100) / 100,
      muted: track.muted,
    }
  })

  return {
    source_stem_separation_ref: sourceStemSeparationRef,
    name,
    tracks,
  }
}

export function createExportRequest(draft: MoriExportDraft): MoriExportInput {
  if (draft.scope.type !== "full_song") throw new Error("export_scope_invalid")
  if (draft.format !== "mp3" && draft.format !== "wav") throw new Error("export_format_invalid")

  const source: MoriExportSource = draft.source.type === "version"
    ? { type: "version" }
    : {
        type: "mix_revision",
        mix_revision_ref: requiredExportMixRevisionRef(draft.source.mixRevisionRef),
      }

  return {
    source,
    scope: { type: "full_song" },
    format: draft.format,
  }
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

function requiredExportMixRevisionRef(value: string): string {
  const normalized = value.trim()
  if (normalized === "") throw new Error("export_mix_revision_required")
  return normalized
}

const lyricsRevisionConstraints: readonly LyricsRevisionConstraint[] = ["meaning", "cadence", "rhyme_scheme", "section_length"]
