import { describe, expect, it, vi } from "vitest"
import { createGenerationQueueState, emptyGenerationQueueState, serializeGenerationQueueState } from "./generation-queue"
import {
  generationQueueStorageKey,
  GenerationQueuePersistenceError,
  readGenerationQueueState,
  subscribeGenerationQueueState,
  updateStoredGenerationQueueState,
  writeGenerationQueueState,
} from "./generation-queue-storage"

function queueItem(generationRef: string, createdAt: string) {
  return {
    generation_ref: generationRef,
    project_ref: "project_storage",
    source_version_ref: null,
    kind: "create" as const,
    label: generationRef,
    created_at: createdAt,
    status: "queued" as const,
    progress: 0,
    candidate_refs: [],
    last_event_id: null,
  }
}

describe("generation queue storage boundary", () => {
  it("round-trips the browser queue through its versioned key", () => {
    const state = {
      ...emptyGenerationQueueState(),
      active_generation_ref: "generation_storage",
      items: [{
        generation_ref: "generation_storage",
        project_ref: "project_storage",
        source_version_ref: null,
        kind: "create" as const,
        label: "Stored direction",
        created_at: "2026-09-04T12:00:00.000Z",
        status: "queued" as const,
        progress: 0,
        candidate_refs: [],
        last_event_id: null,
      }],
    }

    writeGenerationQueueState(state)

    expect(localStorage.getItem(generationQueueStorageKey)).toContain("generation_storage")
    expect(readGenerationQueueState()).toEqual(state)
  })

  it("returns an empty state for corrupted storage", () => {
    localStorage.setItem(generationQueueStorageKey, "{not-json")

    expect(readGenerationQueueState()).toEqual(emptyGenerationQueueState())
  })

  it("applies a mutation to the latest stored queue instead of a stale component copy", async () => {
    writeGenerationQueueState(createGenerationQueueState({
      items: [queueItem("generation-external", "2026-09-04T12:00:00.000Z")],
    }))

    const next = await updateStoredGenerationQueueState((current) => createGenerationQueueState({
      items: [...current.items, queueItem("generation-local", "2026-09-04T12:01:00.000Z")],
      active_generation_ref: "generation-local",
    }))

    expect(next.items.map((item) => item.generation_ref)).toEqual(["generation-local", "generation-external"])
    expect(readGenerationQueueState()).toEqual(next)
  })

  it("reports required persistence failures without losing the next in-memory state", async () => {
    localStorage.clear()
    const nextState = createGenerationQueueState({ items: [queueItem("generation_persistence_failure", "2026-09-04T12:00:00.000Z")] })
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is full")
    })

    try {
      await expect(updateStoredGenerationQueueState(() => nextState, { requirePersistence: true }))
        .rejects.toBeInstanceOf(GenerationQueuePersistenceError)
      await expect(updateStoredGenerationQueueState(() => nextState, { requirePersistence: true }))
        .rejects.toMatchObject({ state: nextState })
    } finally {
      setItem.mockRestore()
    }
  })

  it("reconciles the overwritten and incoming values from a cross-tab storage race", async () => {
    const overwritten = createGenerationQueueState({
      items: [queueItem("generation-tab-a", "2026-09-04T12:00:00.000Z")],
      active_generation_ref: "generation-tab-a",
    })
    const incoming = createGenerationQueueState({
      items: [queueItem("generation-tab-b", "2026-09-04T12:01:00.000Z")],
      active_generation_ref: "generation-tab-b",
    })
    localStorage.setItem(generationQueueStorageKey, serializeGenerationQueueState(incoming))
    const listener = vi.fn()
    const unsubscribe = subscribeGenerationQueueState(listener)

    window.dispatchEvent(new StorageEvent("storage", {
      key: generationQueueStorageKey,
      oldValue: serializeGenerationQueueState(overwritten),
      newValue: serializeGenerationQueueState(incoming),
      storageArea: localStorage,
    }))

    await vi.waitFor(() => expect(listener).toHaveBeenCalled())
    expect(readGenerationQueueState().items.map((item) => item.generation_ref)).toEqual([
      "generation-tab-b",
      "generation-tab-a",
    ])
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ active_generation_ref: "generation-tab-b" }))
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it("preserves the latest stored active task while repairing a stale cross-tab event", async () => {
    const tabA = createGenerationQueueState({
      items: [queueItem("generation-tab-a", "2026-09-04T12:00:00.000Z")],
      active_generation_ref: "generation-tab-a",
    })
    const tabB = createGenerationQueueState({
      items: [queueItem("generation-tab-b", "2026-09-04T12:01:00.000Z")],
      active_generation_ref: "generation-tab-b",
    })
    const current = createGenerationQueueState({
      items: [...tabB.items, ...tabA.items],
      active_generation_ref: "generation-tab-b",
    })
    localStorage.setItem(generationQueueStorageKey, serializeGenerationQueueState(current))
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    const listener = vi.fn()
    const unsubscribe = subscribeGenerationQueueState(listener)

    window.dispatchEvent(new StorageEvent("storage", {
      key: generationQueueStorageKey,
      oldValue: serializeGenerationQueueState(tabB),
      newValue: serializeGenerationQueueState(tabA),
      storageArea: localStorage,
    }))

    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
    expect(readGenerationQueueState()).toEqual(current)
    expect(setItem).not.toHaveBeenCalled()
    unsubscribe()
    setItem.mockRestore()
  })
})
