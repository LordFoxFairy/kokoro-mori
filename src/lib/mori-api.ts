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

export type MoriApi = {
  createGeneration: (projectRef: MoriRef, input: GenerationCreateInput, idempotencyKey: string) => Promise<ApiSuccess<GenerationReceipt>>
}

export type MoriGenerationDraft = {
  mode: CreationMode
  prompt: string
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
