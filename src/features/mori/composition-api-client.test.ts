import { describe, expect, it, vi } from "vitest"
import { createCompositionRevisionClient } from "./composition-api"

describe("composition revision client", () => {
  it("sends the revision and idempotency boundary to the same-origin API", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { version_ref: "version_1", revision: 3, tracks: [] } }), { status: 200 }))
    await createCompositionRevisionClient({ fetchImpl })("version_1", { expected_revision: 2, commands: [{ type: "move_clip", clip_ref: "clip_1", start_ms: 1_000 }] }, "key_1")
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/mori/versions/version_1/composition", expect.objectContaining({ method: "PUT", headers: expect.objectContaining({ "Idempotency-Key": "key_1" }) }))
  })
  it("exposes conflict as a stable error", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: {} }), { status: 409 }))
    await expect(createCompositionRevisionClient({ fetchImpl })("version_1", { expected_revision: 2, commands: [{ type: "move_clip", clip_ref: "clip_1", start_ms: 1_000 }] }, "key_1")).rejects.toThrow("composition_conflict")
  })
})
