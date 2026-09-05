import { describe, expect, it } from "vitest"
import { compositionClipAt, compositionEditToCommand, createCompositionRevisionInput } from "./composition-command"

describe("composition revision command", () => {
  it("creates a stable snake_case revision input", () => {
    expect(createCompositionRevisionInput(3, [{ type: "set_fades", clip_ref: "clip_1", fade_in_ms: 250, fade_out_ms: 500 }])).toEqual({
      expected_revision: 3,
      commands: [{ type: "set_fades", clip_ref: "clip_1", fade_in_ms: 250, fade_out_ms: 500 }],
    })
  })
  it("rejects empty or invalid revisions", () => {
    expect(() => createCompositionRevisionInput(-1, [{ type: "move_clip", clip_ref: "clip_1", start_ms: 0 }])).toThrow("composition_revision_invalid")
    expect(() => createCompositionRevisionInput(0, [])).toThrow("composition_commands_empty")
  })
  it("keeps missing clip errors explicit", () => expect(() => compositionClipAt([], "clip_1")).toThrow("composition_clip_not_found"))
  it("serializes an editor edit without provider fields", () => expect(compositionEditToCommand({ operation: "move", clipRef: "clip_1", startMs: 1500 })).toEqual({ type: "move_clip", clip_ref: "clip_1", start_ms: 1500 }))
})
