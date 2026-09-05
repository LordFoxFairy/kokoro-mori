import { describe, expect, it } from "vitest"
import { compositionSaveLabel, nextCompositionSaveState } from "./composition-save-state"

describe("composition save state", () => {
  it("prioritizes conflict and failure over transient states", () => {
    expect(nextCompositionSaveState({ dirty: true, saving: true, conflict: true })).toBe("conflict")
    expect(nextCompositionSaveState({ dirty: true, saving: true, failed: true })).toBe("failed")
  })
  it("distinguishes unsaved, saving and saved", () => {
    expect(nextCompositionSaveState({ dirty: true, saving: false })).toBe("unsaved")
    expect(nextCompositionSaveState({ dirty: true, saving: true })).toBe("saving")
    expect(compositionSaveLabel(nextCompositionSaveState({ dirty: false, saving: false }))).toBe("Saved")
  })
})
