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

export type MoriMutationHeaders = {
  "Content-Type": "application/json"
  "Idempotency-Key": string
}

export type GenerationReceipt = {
  generation_ref: MoriRef
  status: Extract<GenerationStatus, "queued" | "preparing" | "generating">
}

export type GenerationSnapshot = {
  generation_ref: MoriRef
  project_ref: MoriRef
  song_plan_ref: MoriRef | null
  mode: CreationMode
  status: GenerationStatus
  progress: number
  candidate_refs: MoriRef[]
  created_at: string
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
  createGeneration: (projectRef: MoriRef, input: GenerationCreateInput, idempotencyKey: string) => Promise<ApiSuccess<GenerationReceipt>>
  getGeneration?: (generationRef: MoriRef) => Promise<ApiSuccess<GenerationSnapshot>>
  listCandidates?: (projectRef: MoriRef) => Promise<ApiSuccess<{ candidates: MoriCandidate[]; next_cursor: string | null }>>
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
