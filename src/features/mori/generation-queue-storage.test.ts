import { describe, expect, it } from "vitest"
import { emptyGenerationQueueState } from "./generation-queue"
import { generationQueueStorageKey, readGenerationQueueState, writeGenerationQueueState } from "./generation-queue-storage"

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
})
