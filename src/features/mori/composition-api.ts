import { createCompositionRevisionInput, type CompositionRevisionInput } from "./composition-command"
import type { MoriCompositionClip, MoriCompositionRevision, MoriCompositionTrack } from "@/lib/mori-api"

export type CompositionRevisionResponse = MoriCompositionRevision
export type CompositionRevisionClient = (versionRef: string, input: CompositionRevisionInput, idempotencyKey: string) => Promise<CompositionRevisionResponse>

export function createCompositionRevisionClient(options: { apiBasePath?: string; fetchImpl?: typeof fetch } = {}): CompositionRevisionClient {
  const base = (options.apiBasePath ?? "/api/v1/mori").replace(/\/$/u, "")
  const fetchImpl = options.fetchImpl ?? fetch
  return async (versionRef, input, idempotencyKey) => {
    const response = await fetchImpl(`${base}/versions/${encodeURIComponent(versionRef)}/composition`, { method: "PUT", headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }, body: JSON.stringify(input) })
    const payload = await response.json() as { data?: CompositionRevisionResponse; error?: unknown }
    if (!response.ok || payload.data === undefined) throw new Error(response.status === 409 ? "composition_conflict" : "composition_save_failed")
    return parseCompositionRevisionResponse(payload.data)
  }
}

export function parseCompositionRevisionResponse(value: unknown): CompositionRevisionResponse {
  if (typeof value !== "object" || value === null) throw new Error("composition_response_invalid")
  const candidate = value as Partial<CompositionRevisionResponse>
  const revision = candidate.revision
  if (typeof candidate.version_ref !== "string" || candidate.version_ref.trim() === "" || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1 || !Array.isArray(candidate.tracks)) throw new Error("composition_response_invalid")
  const tracks = candidate.tracks.map(parseCompositionTrack)
  if (new Set(tracks.map((track) => track.track_ref)).size !== tracks.length) throw new Error("composition_response_invalid")
  return { version_ref: candidate.version_ref, revision, tracks }
}

function parseCompositionTrack(value: unknown): MoriCompositionTrack {
  if (typeof value !== "object" || value === null) throw new Error("composition_response_invalid")
  const candidate = value as Partial<MoriCompositionTrack>
  if (typeof candidate.track_ref !== "string" || candidate.track_ref.trim() === "" || (candidate.kind !== "vocals" && candidate.kind !== "instrumental" && candidate.kind !== "other") || typeof candidate.name !== "string" || candidate.name.trim() === "" || !Array.isArray(candidate.clips)) throw new Error("composition_response_invalid")
  const hasGain = candidate.gain !== undefined
  const hasPan = candidate.pan !== undefined
  const hasMuted = candidate.muted !== undefined
  if ((hasGain || hasPan || hasMuted) && (typeof candidate.gain !== "number" || !Number.isFinite(candidate.gain) || candidate.gain < 0 || candidate.gain > 1 || typeof candidate.pan !== "number" || !Number.isFinite(candidate.pan) || candidate.pan < -1 || candidate.pan > 1 || typeof candidate.muted !== "boolean")) throw new Error("composition_response_invalid")
  const clips = candidate.clips.map((clip) => {
    if (typeof clip !== "object" || clip === null) throw new Error("composition_response_invalid")
    const parsed = clip as Partial<MoriCompositionClip>
    const { clip_ref: clipRef, source_ref: sourceRef, start_ms: startMs, duration_ms: durationMs, offset_ms: offsetMs, fade_in_ms: fadeInMs, fade_out_ms: fadeOutMs } = parsed
    if (typeof clipRef !== "string" || clipRef.trim() === "" || typeof sourceRef !== "string" || sourceRef.trim() === "" || ![startMs, durationMs, offsetMs].every((number) => typeof number === "number" && Number.isSafeInteger(number)) || typeof startMs !== "number" || typeof durationMs !== "number" || typeof offsetMs !== "number" || startMs < 0 || durationMs < 1 || offsetMs < 0 || (fadeInMs !== undefined && (typeof fadeInMs !== "number" || !Number.isSafeInteger(fadeInMs) || fadeInMs < 0)) || (fadeOutMs !== undefined && (typeof fadeOutMs !== "number" || !Number.isSafeInteger(fadeOutMs) || fadeOutMs < 0))) throw new Error("composition_response_invalid")
    return { clip_ref: clipRef, source_ref: sourceRef, start_ms: startMs, duration_ms: durationMs, offset_ms: offsetMs, ...(fadeInMs === undefined ? {} : { fade_in_ms: fadeInMs }), ...(fadeOutMs === undefined ? {} : { fade_out_ms: fadeOutMs }) }
  })
  if (new Set(clips.map((clip) => clip.clip_ref)).size !== clips.length) throw new Error("composition_response_invalid")
  return { track_ref: candidate.track_ref, kind: candidate.kind, name: candidate.name, clips, ...(hasGain ? { gain: candidate.gain } : {}), ...(hasPan ? { pan: candidate.pan } : {}), ...(hasMuted ? { muted: candidate.muted } : {}) }
}

export function createCompositionSaveRequest(versionRef: string, revision: number, commands: CompositionRevisionInput["commands"], idempotencyKey: string) {
  if (!versionRef.trim()) throw new Error("composition_version_required")
  if (!idempotencyKey.trim()) throw new Error("idempotency_key_required")
  return { versionRef: versionRef.trim(), input: createCompositionRevisionInput(revision, commands), idempotencyKey: idempotencyKey.trim() }
}
