import { createCompositionRevisionInput, type CompositionRevisionInput } from "./composition-command"

export type CompositionRevisionResponse = { version_ref: string; revision: number; tracks: unknown[] }
export type CompositionRevisionClient = (versionRef: string, input: CompositionRevisionInput, idempotencyKey: string) => Promise<CompositionRevisionResponse>

export function createCompositionSaveRequest(versionRef: string, revision: number, commands: CompositionRevisionInput["commands"], idempotencyKey: string) {
  if (!versionRef.trim()) throw new Error("composition_version_required")
  if (!idempotencyKey.trim()) throw new Error("idempotency_key_required")
  return { versionRef: versionRef.trim(), input: createCompositionRevisionInput(revision, commands), idempotencyKey: idempotencyKey.trim() }
}
