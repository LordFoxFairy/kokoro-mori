import {
  createGenerationQueueState,
  deserializeGenerationQueueState,
  emptyGenerationQueueState,
  mergeGenerationQueueStates,
  serializeGenerationQueueState,
  type GenerationQueueState,
} from "./generation-queue"

export const generationQueueStorageKey = "mori-generation-queue-v1"
export const generationQueueStorageEvent = "mori-generation-queue-updated"
const generationQueueMutationLock = "mori-generation-queue-mutation-v1"
let fallbackMutationTail: Promise<void> = Promise.resolve()

export type GenerationQueueMutationOptions = {
  requirePersistence?: boolean
}

export class GenerationQueuePersistenceError extends Error {
  readonly state: GenerationQueueState

  constructor(state: GenerationQueueState) {
    super("generation_queue_persistence_failed")
    this.name = "GenerationQueuePersistenceError"
    this.state = state
  }
}

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
export function writeGenerationQueueState(state: GenerationQueueState): boolean {
  if (typeof window === "undefined") return false

  try {
    const serialized = serializeGenerationQueueState(state)
    if (window.localStorage.getItem(generationQueueStorageKey) === serialized) return true
    window.localStorage.setItem(generationQueueStorageKey, serialized)
    window.dispatchEvent(new Event(generationQueueStorageEvent))
    return true
  } catch {
    // A blocked or full local store must not interrupt a generation.
    return false
  }
}

/** Check whether the current browser store contains this exact queue state. */
export function isGenerationQueueStatePersisted(state: GenerationQueueState): boolean {
  if (typeof window === "undefined") return false

  try {
    return window.localStorage.getItem(generationQueueStorageKey) === serializeGenerationQueueState(state)
  } catch {
    return false
  }
}

/** Read the latest value immediately before applying one browser-owned mutation. */
export function updateStoredGenerationQueueState(
  transform: (current: GenerationQueueState) => GenerationQueueState,
  options: GenerationQueueMutationOptions = {},
): Promise<GenerationQueueState> {
  const mutate = () => {
    const next = transform(readGenerationQueueState())
    const persisted = writeGenerationQueueState(next)
    if (options.requirePersistence && !persisted) throw new GenerationQueuePersistenceError(next)
    return next
  }
  if (typeof navigator !== "undefined" && navigator.locks !== undefined) {
    return navigator.locks.request(generationQueueMutationLock, mutate)
  }

  const mutation = fallbackMutationTail.then(mutate, mutate)
  fallbackMutationTail = mutation.then(() => undefined, () => undefined)
  return mutation
}

/**
 * Keep mounted Mori surfaces aligned with same-document writes and other tabs.
 * A storage event carries the overwritten value, so reconciling old + new heals
 * the narrow read/write race where two tabs append different tasks together.
 */
export function subscribeGenerationQueueState(
  listener: (state: GenerationQueueState) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined

  let lastDeliveredState: string | null = null
  const deliver = (state: GenerationQueueState) => {
    const serialized = serializeGenerationQueueState(state)
    if (serialized === lastDeliveredState) return
    lastDeliveredState = serialized
    listener(state)
  }
  const handleLocalUpdate = () => deliver(readGenerationQueueState())
  const handleStorageUpdate = (event: StorageEvent) => {
    if (event.key !== generationQueueStorageKey) return
    const incoming = deserializeGenerationQueueState(event.newValue)
    if (incoming === null) {
      deliver(readGenerationQueueState())
      return
    }

    const overwritten = deserializeGenerationQueueState(event.oldValue)
    const reconciled = overwritten === null ? incoming : mergeGenerationQueueStates(overwritten, incoming)
    void updateStoredGenerationQueueState((current) => {
      const repaired = mergeGenerationQueueStates(current, reconciled)
      return { ...repaired, active_generation_ref: current.active_generation_ref }
    })
      .then(deliver)
      .catch(() => deliver(readGenerationQueueState()))
  }

  window.addEventListener(generationQueueStorageEvent, handleLocalUpdate)
  window.addEventListener("storage", handleStorageUpdate)
  return () => {
    window.removeEventListener(generationQueueStorageEvent, handleLocalUpdate)
    window.removeEventListener("storage", handleStorageUpdate)
  }
}
