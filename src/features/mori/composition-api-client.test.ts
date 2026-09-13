import { describe, expect, it, vi } from "vitest"
import { createCompositionRevisionClient, parseCompositionRevisionResponse } from "./composition-api"

describe("composition revision client", () => {
  it("sends the revision and idempotency boundary to the same-origin API", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { version_ref: "version_1", revision: 3, tracks: [] } }), { status: 200 }))
    await createCompositionRevisionClient({ fetchImpl })("version_1", { expected_revision: 2, commands: [{ type: "move_clip", track_ref: "track_1", clip_ref: "clip_1", start_ms: 1_000 }] }, "key_1")
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/mori/versions/version_1/composition", expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "Idempotency-Key": "key_1" }) }))
  })
  it("exposes conflict as a stable error", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: {} }), { status: 409 }))
    await expect(createCompositionRevisionClient({ fetchImpl })("version_1", { expected_revision: 2, commands: [{ type: "move_clip", track_ref: "track_1", clip_ref: "clip_1", start_ms: 1_000 }] }, "key_1")).rejects.toThrow("composition_conflict")
  })
  it("rejects an incomplete owner projection", () => expect(() => parseCompositionRevisionResponse({ version_ref: "version_1", revision: 0, tracks: [] })).toThrow("composition_response_invalid"))
  it("rejects an owner projection with incomplete track data", () => expect(() => parseCompositionRevisionResponse({ version_ref: "version_1", revision: 1, tracks: [{ track_ref: "track_1", kind: "vocals", name: "Lead", clips: [{ clip_ref: "clip_1" }] }] })).toThrow("composition_response_invalid"))
  it("rejects duplicate track identities", () => expect(() => parseCompositionRevisionResponse({ version_ref: "version_1", revision: 1, tracks: [{ track_ref: "track_1", kind: "vocals", name: "Lead", clips: [] }, { track_ref: "track_1", kind: "instrumental", name: "Keys", clips: [] }] })).toThrow("composition_response_invalid"))
  it("keeps optional track mix projection fields and rejects partial mix data", () => {
    expect(parseCompositionRevisionResponse({ version_ref: "version_1", revision: 1, tracks: [{ track_ref: "track_1", kind: "vocals", name: "Lead", gain: 0.8, pan: 0.2, muted: false, clips: [] }] }).tracks[0]).toMatchObject({ gain: 0.8, pan: 0.2, muted: false })
    expect(() => parseCompositionRevisionResponse({ version_ref: "version_1", revision: 1, tracks: [{ track_ref: "track_1", kind: "vocals", name: "Lead", gain: 0.8, clips: [] }] })).toThrow("composition_response_invalid")
    expect(() => parseCompositionRevisionResponse({ version_ref: "version_1", revision: 1, tracks: [{ track_ref: "track_1", kind: "vocals", name: "Lead", gain: 1.2, pan: 0, muted: false, clips: [] }] })).toThrow("composition_response_invalid")
  })
})
