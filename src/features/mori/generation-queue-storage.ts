import {
  createGenerationQueueState,
  deserializeGenerationQueueState,
  emptyGenerationQueueState,
  serializeGenerationQueueState,
  type GenerationQueueState,
} from "./generation-queue"

export const generationQueueStorageKey = "mori-generation-queue-v1"
export const generationQueueStorageEvent = "mori-generation-queue-updated"

/** Read the browser-owned task summary; SSR and storage failures stay neutral. */
export function readGenerationQueueState(): GenerationQueueState {
  if (typeof window === "undefined") return emptyGenerationQueueState()

  try {
    const serialized = window.localStorage.getItem(generationQueueStorageKey)
    const parsed = serialized === null ? null : deserializeGenerationQueueState(serialized)
    return parsed === null ? emptyGenerationQueueState() : createGenerationQueueState(parsed)
  } catch {
    return emptyGenerationQueueState()
  }
}

/** Persist only the queue domain's explicit allow-list. */
export function writeGenerationQueueState(state: GenerationQueueState): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(generationQueueStorageKey, serializeGenerationQueueState(state))
    window.dispatchEvent(new Event(generationQueueStorageEvent))
  } catch {
    // A blocked or full local store must not interrupt a generation.
  }
}
