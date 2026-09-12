import { describe, expect, it } from "vitest"
import { createCompositionSaveRequest } from "./composition-api"

describe("composition api seam", () => {
  it("keeps version and idempotency outside the provider-neutral body", () => {
    expect(createCompositionSaveRequest(" version_1 ", 2, [{ type: "move_clip", track_ref: "track_1", clip_ref: "clip_1", start_ms: 1000 }], " key_1 ")).toEqual({ versionRef: "version_1", input: { expected_revision: 2, commands: [{ type: "move_clip", track_ref: "track_1", clip_ref: "clip_1", start_ms: 1000 }] }, idempotencyKey: "key_1" })
  })
  it("rejects missing request identity", () => {
    expect(() => createCompositionSaveRequest("", 0, [{ type: "move_clip", track_ref: "track_1", clip_ref: "clip_1", start_ms: 0 }], "key")).toThrow("composition_version_required")
  })
})
