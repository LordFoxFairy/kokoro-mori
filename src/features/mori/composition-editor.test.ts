import { describe, expect, it } from "vitest"
import { applyCompositionEdit } from "./composition-editor"
import { createCompositionHistory } from "./composition-history"

const initial = { trackRef: "track_1", kind: "vocals" as const, name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10_000, offsetMs: 0 }] }

describe("composition editor", () => {
  it("applies an edit and keeps it undoable", () => {
    const next = applyCompositionEdit(createCompositionHistory({ tracks: [initial] }), { operation: "fade", trackRef: "track_1", clipRef: "clip_1", fadeInMs: 250, fadeOutMs: 500 })
    expect(next.present.tracks[0]?.clips[0]).toMatchObject({ fadeInMs: 250, fadeOutMs: 500 })
    expect(next.past).toHaveLength(1)
  })

  it("routes an edit to the explicit track when clip refs repeat", () => {
    const second = { ...initial, trackRef: "track_2", name: "Instrumental" }
    const next = applyCompositionEdit(createCompositionHistory({ tracks: [initial, second] }), { operation: "move", trackRef: "track_2", clipRef: "clip_1", startMs: 2_000 })
    expect(next.present.tracks[0]?.clips[0]?.startMs).toBe(0)
    expect(next.present.tracks[1]?.clips[0]?.startMs).toBe(2_000)
  })

  it("rejects commands that target a missing track", () => {
    expect(() => applyCompositionEdit(createCompositionHistory({ tracks: [initial] }), { operation: "move", trackRef: "track_missing", clipRef: "clip_1", startMs: 2_000 })).toThrow("composition_track_not_found")
  })
})
