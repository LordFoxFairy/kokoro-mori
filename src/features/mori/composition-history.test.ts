import { describe, expect, it } from "vitest"
import { commitComposition, createCompositionHistory, redoComposition, undoComposition } from "./composition-history"
import type { CompositionTrack } from "./composition"

const first: CompositionTrack = { trackRef: "track_1", kind: "vocals", name: "Lead", clips: [] }
const second: CompositionTrack = { ...first, name: "Lead vocal" }

describe("composition history", () => {
  it("undoes and redoes a committed edit", () => {
    const history = commitComposition(createCompositionHistory(first), second)
    expect(undoComposition(history).present.name).toBe("Lead")
    expect(redoComposition(undoComposition(history)).present.name).toBe("Lead vocal")
  })
  it("clears redo after a new branch", () => {
    const history = commitComposition(createCompositionHistory(first), second)
    const branched = commitComposition(undoComposition(history), { ...first, name: "Vocal" })
    expect(branched.future).toEqual([])
  })
})
