import { describe, expect, it } from "vitest"
import type { StemSeparationSnapshot } from "@/lib/mori-api"
import * as studioStems from "./studio-stems"

const { buildStudioStemSeparationPlan, createStudioStemSeparationDraft, stemSeparationSnapshotMatchesPlan } = studioStems

describe("Studio stem separation plans", () => {
  it("models isolating one requested part plus the remaining mix", () => {
    const plan = buildStudioStemSeparationPlan({
      mode: "isolate_part",
      targetKinds: ["vocals"],
    }, false)

    expect(plan).toEqual({
      mode: "isolate_part",
      targetKinds: ["vocals"],
      includeMidi: false,
      output: { kind: "isolate", count: 2 },
    })
    expect(createStudioStemSeparationDraft(plan)).toEqual({
      mode: "isolate_part",
      targetKinds: ["vocals"],
      includeMidi: false,
    })
  })

  it("keeps auto split free of manual targets", () => {
    const plan = buildStudioStemSeparationPlan({ mode: "auto_stems", targetKinds: [] }, true)

    expect(plan).toEqual({
      mode: "auto_stems",
      targetKinds: [],
      includeMidi: true,
      output: { kind: "maximum", count: 12 },
    })
  })

  it("normalizes a two-to-ten target custom split", () => {
    const plan = buildStudioStemSeparationPlan({
      mode: "custom_stems",
      targetKinds: ["drums", "bass", "drums", "keys"],
    }, false)

    expect(plan.targetKinds).toEqual(["drums", "bass", "keys"])
    expect(plan.output).toEqual({ kind: "requested", count: 3 })
  })

  it("rejects custom split after duplicate targets leave fewer than two parts", () => {
    expect(() => buildStudioStemSeparationPlan({
      mode: "custom_stems",
      targetKinds: ["drums", "drums"],
    }, false)).toThrow("stem_separation_target_count_invalid")
  })

  it("does not match a recovered snapshot with different requested targets", () => {
    const plan = buildStudioStemSeparationPlan({
      mode: "isolate_part",
      targetKinds: ["vocals"],
    }, false)
    const snapshot: StemSeparationSnapshot = {
      stem_separation_ref: "stem_separation_1",
      version_ref: "version_1",
      status: "separating",
      progress: 42,
      mode: "isolate_part",
      target_kinds: ["drums"],
      include_midi: false,
      source_audio_digest: "sha256:source-1",
      stems: [],
      midi_asset_ref: null,
      created_at: "2026-09-03T12:00:00.000Z",
    }
    expect(stemSeparationSnapshotMatchesPlan(snapshot, plan)).toBe(false)
  })
})
