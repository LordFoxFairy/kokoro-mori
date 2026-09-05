import { describe, expect, it } from "vitest"
import { applyCompositionEdit } from "./composition-editor"
import { createCompositionHistory } from "./composition-history"

const initial = { trackRef: "track_1", kind: "vocals" as const, name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10_000, offsetMs: 0 }] }

describe("composition editor", () => {
  it("applies an edit and keeps it undoable", () => {
    const next = applyCompositionEdit(createCompositionHistory(initial), { operation: "fade", clipRef: "clip_1", fadeInMs: 250, fadeOutMs: 500 })
    expect(next.present.clips[0]).toMatchObject({ fadeInMs: 250, fadeOutMs: 500 })
    expect(next.past).toHaveLength(1)
  })
})
