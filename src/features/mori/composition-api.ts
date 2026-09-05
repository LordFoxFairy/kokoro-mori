import { createCompositionRevisionInput, type CompositionRevisionInput } from "./composition-command"

export type CompositionRevisionResponse = { version_ref: string; revision: number; tracks: unknown[] }
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
  if (typeof candidate.version_ref !== "string" || typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1 || !Array.isArray(candidate.tracks)) throw new Error("composition_response_invalid")
  return { version_ref: candidate.version_ref, revision, tracks: candidate.tracks }
}

export function createCompositionSaveRequest(versionRef: string, revision: number, commands: CompositionRevisionInput["commands"], idempotencyKey: string) {
  if (!versionRef.trim()) throw new Error("composition_version_required")
  if (!idempotencyKey.trim()) throw new Error("idempotency_key_required")
  return { versionRef: versionRef.trim(), input: createCompositionRevisionInput(revision, commands), idempotencyKey: idempotencyKey.trim() }
}
