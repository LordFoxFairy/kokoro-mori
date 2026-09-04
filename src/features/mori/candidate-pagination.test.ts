import { describe, expect, it, vi } from "vitest"
import type { MoriApi } from "@/lib/mori-api"
import { listAllMoriCandidates } from "./candidate-pagination"

const candidate = (ref: string) => ({
  candidate_ref: ref,
  generation_ref: "generation_1",
  version_ref: `version_${ref}`,
  project_ref: "project_1",
  title: ref,
  duration_seconds: 180,
  audio_asset_ref: `asset_${ref}`,
  waveform_asset_ref: `waveform_${ref}`,
  style_tags: ["warm"],
  created_at: "2026-09-04T12:00:00.000Z",
})

function response(candidates: ReturnType<typeof candidate>[], next_cursor: string | null) {
  return { data: { candidates, next_cursor }, meta: { request_id: "request_candidates" } }
}

describe("listAllMoriCandidates", () => {
  it("follows opaque cursors and de-duplicates candidates in server order", async () => {
    const listCandidates = vi.fn<MoriApi["listCandidates"]>()
      .mockResolvedValueOnce(response([candidate("a"), candidate("b")], "cursor_2"))
      .mockResolvedValueOnce(response([candidate("b"), candidate("c")], null))

    await expect(listAllMoriCandidates({ listCandidates }, "project_1")).resolves.toEqual([
      candidate("a"),
      candidate("b"),
      candidate("c"),
    ])
    expect(listCandidates).toHaveBeenNthCalledWith(1, "project_1")
    expect(listCandidates).toHaveBeenNthCalledWith(2, "project_1", { cursor: "cursor_2" })
  })

  it("rejects a repeated cursor instead of looping forever", async () => {
    const listCandidates = vi.fn<MoriApi["listCandidates"]>()
      .mockResolvedValue(response([candidate("a")], "same_cursor"))

    await expect(listAllMoriCandidates({ listCandidates }, "project_1")).rejects.toThrow("candidate_cursor_invalid")
    expect(listCandidates).toHaveBeenCalledTimes(2)
  })
})
