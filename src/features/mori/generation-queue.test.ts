import { describe, expect, it } from "vitest"
import {
  createGenerationQueueState,
  deserializeGenerationQueueState,
  emptyGenerationQueueState,
  filterGenerationQueueByContext,
  generationQueueClientPhaseForStatus,
  mergeGenerationQueueItems,
  mergeGenerationQueueStates,
  reconcileGenerationQueueItemFromSnapshot,
  removeGenerationQueueItem,
  serializeGenerationQueueState,
  updateGenerationQueueItem,
  upsertGenerationQueueItem,
  type GenerationQueueItem,
} from "./generation-queue"

const baseItem: GenerationQueueItem = {
  generation_ref: "generation-a",
  project_ref: "project-a",
  source_version_ref: "version-a",
  kind: "create",
  label: "A first direction",
  created_at: "2026-09-04T12:00:00.000Z",
  status: "queued",
  progress: 0,
  candidate_refs: [],
  last_event_id: null,
}

function item(overrides: Partial<GenerationQueueItem> = {}): GenerationQueueItem {
  return { ...baseItem, ...overrides }
}

describe("generation queue domain", () => {
  it("keeps server status separate from the browser client phase", () => {
    expect(generationQueueClientPhaseForStatus("queued")).toBe("queued")
    expect(generationQueueClientPhaseForStatus("preparing")).toBe("queued")
    expect(generationQueueClientPhaseForStatus("generating")).toBe("streaming")
    expect(generationQueueClientPhaseForStatus("post_processing")).toBe("streaming")
    expect(generationQueueClientPhaseForStatus("succeeded")).toBe("completed")
    expect(generationQueueClientPhaseForStatus("cancelled")).toBe("completed")
    expect(generationQueueClientPhaseForStatus("failed")).toBe("failed")
    expect(generationQueueClientPhaseForStatus("expired")).toBe("failed")
  })

  it("deduplicates by generation_ref, merges candidate refs, and sorts newest first", () => {
    const initialState = createGenerationQueueState({
      items: [
        item({
          generation_ref: "generation-b",
          created_at: "2026-09-04T13:00:00.000Z",
          candidate_refs: ["candidate-b"],
        }),
        item({ generation_ref: "generation-c", created_at: "2026-09-04T12:00:00.000Z" }),
      ],
      active_generation_ref: "generation-b",
    })
    const state = upsertGenerationQueueItem(initialState, item({
      generation_ref: "generation-b",
      label: "A finished direction",
      status: "succeeded",
      progress: 100,
      candidate_refs: ["candidate-b", "candidate-a"],
      last_event_id: "event-4",
    }))

    expect(state.items).toHaveLength(2)
    expect(state.items.map((queueItem) => queueItem.generation_ref)).toEqual([
      "generation-b",
      "generation-c",
    ])
    expect(state.items[0]).toMatchObject({
      generation_ref: "generation-b",
      label: "A finished direction",
      status: "succeeded",
      progress: 100,
      candidate_refs: ["candidate-a", "candidate-b"],
      last_event_id: "event-4",
    })
    expect(state.active_generation_ref).toBe("generation-b")
  })

  it("uses generation_ref updates without changing identity and keeps candidate refs unique", () => {
    const state = createGenerationQueueState({ items: [baseItem] })
    const updated = updateGenerationQueueItem(state, "generation-a", {
      status: "generating",
      progress: 48.5,
      candidate_refs: ["candidate-a", "candidate-a", "candidate-b"],
      last_event_id: "event-2",
    })

    expect(updated.items).toEqual([{
      ...baseItem,
      status: "generating",
      progress: 48.5,
      candidate_refs: ["candidate-a", "candidate-b"],
      last_event_id: "event-2",
    }])
    expect(updateGenerationQueueItem(state, "missing-generation", { progress: 20 })).toBe(state)
  })

  it("replaces conflicting local context with an owner snapshot for the same generation ref", () => {
    const state = createGenerationQueueState({
      items: [item({
        generation_ref: "generation-conflict",
        project_ref: "project-stale",
        source_version_ref: null,
        kind: "create",
        status: "generating",
        progress: 70,
      })],
      active_generation_ref: "generation-conflict",
    })
    const reconciled = reconcileGenerationQueueItemFromSnapshot(state, item({
      generation_ref: "generation-conflict",
      project_ref: "project-owner",
      source_version_ref: "version-owner",
      kind: "studio_change",
      status: "generating",
      progress: 42,
    }))

    expect(reconciled.items).toContainEqual(expect.objectContaining({
      generation_ref: "generation-conflict",
      project_ref: "project-owner",
      source_version_ref: "version-owner",
      kind: "studio_change",
      progress: 42,
    }))
    expect(reconciled.active_generation_ref).toBe("generation-conflict")
  })

  it("removes one task and clears an active ref only when that task is removed", () => {
    const state = createGenerationQueueState({
      items: [baseItem, item({ generation_ref: "generation-b" })],
      active_generation_ref: "generation-a",
    })

    const removed = removeGenerationQueueItem(state, "generation-a")
    expect(removed.items.map((queueItem) => queueItem.generation_ref)).toEqual(["generation-b"])
    expect(removed.active_generation_ref).toBeNull()
    expect(removeGenerationQueueItem(removed, "generation-missing")).toEqual(removed)
  })

  it("filters by project and optional source version while preserving the state invariant", () => {
    const state = createGenerationQueueState({
      items: [
        item({ generation_ref: "generation-a", project_ref: "project-a", source_version_ref: "version-a" }),
        item({ generation_ref: "generation-b", project_ref: "project-a", source_version_ref: null }),
        item({ generation_ref: "generation-c", project_ref: "project-b", source_version_ref: "version-b" }),
      ],
      active_generation_ref: "generation-a",
    })

    expect(filterGenerationQueueByContext(state, { project_ref: "project-a" }).items.map((queueItem) => queueItem.generation_ref)).toEqual([
      "generation-a",
      "generation-b",
    ])
    expect(filterGenerationQueueByContext(state, {
      project_ref: "project-a",
      source_version_ref: null,
    })).toMatchObject({
      active_generation_ref: null,
      items: [expect.objectContaining({ generation_ref: "generation-b" })],
    })
    expect(filterGenerationQueueByContext(state, {
      project_ref: "project-a",
      source_version_ref: "version-a",
    }).items.map((queueItem) => queueItem.generation_ref)).toEqual(["generation-a"])
  })

  it("merges two queue states without losing either task or the current active task", () => {
    const current = createGenerationQueueState({
      items: [item({ generation_ref: "generation-a", candidate_refs: ["candidate-a"] })],
      active_generation_ref: "generation-a",
    })
    const incoming = createGenerationQueueState({
      items: [
        item({ generation_ref: "generation-a", status: "succeeded", progress: 100, candidate_refs: ["candidate-b"] }),
        item({ generation_ref: "generation-b", created_at: "2026-09-04T14:00:00.000Z" }),
      ],
      active_generation_ref: "generation-b",
    })

    const merged = mergeGenerationQueueStates(current, incoming)
    expect(merged.active_generation_ref).toBe("generation-b")
    expect(merged.items.map((queueItem) => queueItem.generation_ref)).toEqual([
      "generation-b",
      "generation-a",
    ])
    expect(merged.items[1]?.candidate_refs).toEqual(["candidate-a", "candidate-b"])
    const currentItem = current.items.find((queueItem) => queueItem.generation_ref === "generation-a")
    const incomingItem = incoming.items.find((queueItem) => queueItem.generation_ref === "generation-a")
    expect(currentItem).toBeDefined()
    expect(incomingItem).toBeDefined()
    if (currentItem === undefined || incomingItem === undefined) throw new Error("test fixture is incomplete")
    expect(mergeGenerationQueueItems(currentItem, incomingItem)).toMatchObject({
      status: "succeeded",
      candidate_refs: ["candidate-a", "candidate-b"],
    })
    expect(mergeGenerationQueueStates(current, createGenerationQueueState({
      items: [item({ generation_ref: "generation-a" })],
      active_generation_ref: null,
    })).active_generation_ref).toBeNull()
  })

  it("does not let a stale active snapshot regress a completed queue item", () => {
    const completed = item({
      status: "succeeded",
      progress: 100,
      candidate_refs: ["candidate-finished"],
      last_event_id: "event-finished",
    })
    const stale = item({
      project_ref: "project-stale",
      kind: "studio_change",
      status: "generating",
      progress: 48,
      candidate_refs: [],
      last_event_id: null,
    })

    expect(mergeGenerationQueueItems(completed, stale)).toMatchObject({
      project_ref: "project-a",
      kind: "create",
      status: "succeeded",
      progress: 100,
      candidate_refs: ["candidate-finished"],
      last_event_id: "event-finished",
    })
  })

  it("keeps active lifecycle progress monotonic while queue surfaces reconcile", () => {
    const current = item({ status: "post_processing", progress: 84 })
    const stale = item({ status: "preparing", progress: 20 })

    expect(mergeGenerationQueueItems(current, stale)).toMatchObject({
      status: "post_processing",
      progress: 84,
    })
  })

  it("converges conflicting terminal observations without losing known progress", () => {
    const failed = item({
      status: "failed",
      progress: 10,
      candidate_refs: ["candidate-b", "candidate-a"],
      last_event_id: "event-failed",
    })
    const cancelled = item({
      status: "cancelled",
      progress: 90,
      candidate_refs: ["candidate-a", "candidate-c"],
      last_event_id: "event-cancelled",
    })

    expect(mergeGenerationQueueItems(failed, cancelled)).toEqual(mergeGenerationQueueItems(cancelled, failed))
    expect(mergeGenerationQueueItems(failed, cancelled)).toMatchObject({
      status: "cancelled",
      progress: 90,
      candidate_refs: ["candidate-a", "candidate-b", "candidate-c"],
      last_event_id: null,
    })
    expect(mergeGenerationQueueItems(item({ status: "generating", progress: 90 }), failed)).toMatchObject({
      status: "failed",
      progress: 90,
    })
  })

  it("serializes only the non-sensitive allow-list and round-trips in stable order", () => {
    const state = createGenerationQueueState({
      items: [item({ candidate_refs: ["candidate-a"], last_event_id: "event-1" })],
      active_generation_ref: "generation-a",
    })
    const serialized = serializeGenerationQueueState(state)

    expect(serialized).not.toContain("prompt")
    expect(serialized).not.toContain("lyrics")
    expect(JSON.parse(serialized)).toEqual({
      version: 1,
      active_generation_ref: "generation-a",
      items: [{
        generation_ref: "generation-a",
        project_ref: "project-a",
        source_version_ref: "version-a",
        kind: "create",
        label: "A first direction",
        created_at: "2026-09-04T12:00:00.000Z",
        status: "queued",
        progress: 0,
        candidate_refs: ["candidate-a"],
        last_event_id: "event-1",
      }],
    })
    expect(deserializeGenerationQueueState(serialized)).toEqual(state)
    expect(deserializeGenerationQueueState(null)).toBeNull()
  })

  it("rejects malformed, unknown, extra-field, and invariant-breaking storage data", () => {
    const validItem = item({ candidate_refs: ["candidate-a"] })
    const validStorage = {
      version: 1,
      active_generation_ref: "generation-a",
      items: [validItem],
    }

    const invalidPayloads: unknown[] = [
      "not-json",
      { ...validStorage, version: 2 },
      { ...validStorage, items: [{ ...validItem, status: "unknown" }] },
      { ...validStorage, items: [{ ...validItem, progress: 101 }] },
      { ...validStorage, items: [{ ...validItem, candidate_refs: ["candidate-a", "candidate-a"] }] },
      { ...validStorage, items: [{ ...validItem, prompt: "the full prompt must not be stored" }] },
      { ...validStorage, active_generation_ref: "generation-missing" },
      { ...validStorage, items: [{ ...validItem, generation_ref: "generation-a" }, validItem] },
      { ...validStorage, items: [{ ...validItem, source_version_ref: 42 }] },
    ]

    for (const payload of invalidPayloads) {
      const serialized = typeof payload === "string" ? payload : JSON.stringify(payload)
      expect(deserializeGenerationQueueState(serialized)).toBeNull()
    }
  })

  it("rejects invalid typed state inputs instead of creating a broken invariant", () => {
    expect(() => createGenerationQueueState({
      items: [item({ progress: 101 })],
    })).toThrow("invalid generation queue item")
    expect(() => createGenerationQueueState({
      items: [baseItem],
      active_generation_ref: "generation-missing",
    })).toThrow("active_generation_ref")
    expect(emptyGenerationQueueState()).toEqual({
      version: 1,
      items: [],
      active_generation_ref: null,
    })
  })
})
