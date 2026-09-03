import { describe, expect, it } from "vitest"
import { buildStudioChangePlan, type StudioTimelineSection } from "./studio-change"

const verse: StudioTimelineSection = {
  id: "verse-2",
  label: "Verse",
  startMs: 42_000,
  endMs: 96_000,
  weight: 1,
}

describe("Studio change plans", () => {
  it("keeps the reviewed range, anchors, and alternatives in a Restyle plan", () => {
    const plan = buildStudioChangePlan("transform", verse, "Open the harmony into a live-room performance.", {
      transformIntent: "restyle",
      transformScope: "selected_section",
      preserve: ["melody", "lyrics"],
      outputCount: 4,
      coverMode: "vocal",
      coverVoiceRef: null,
    })

    expect(plan.scopeLabel).toBe("Selected section · Verse")
    expect(plan.preserve).toEqual(["melody", "lyrics"])
    expect(plan.outputCount).toBe(4)
    expect(plan.draft).toEqual({
      operation: "transform",
      intent: "restyle",
      scope: { type: "time_range", startMs: 42_000, endMs: 96_000 },
      instruction: "Open the harmony into a live-room performance.",
      preserve: ["melody", "lyrics"],
      outputCount: 4,
    })
  })

  it("turns a Vocal Cover into a protected whole-song two-Take plan", () => {
    const plan = buildStudioChangePlan("transform", verse, "Re-perform this as a close acoustic duet.", {
      transformIntent: "cover",
      transformScope: "selected_section",
      preserve: ["tempo"],
      outputCount: 4,
      coverMode: "vocal",
      coverVoiceRef: "voice_preview_mira",
    })

    expect(plan.scopeLabel).toBe("Whole song · open Version")
    expect(plan.preserve).toEqual(["melody", "lyrics", "structure"])
    expect(plan.outputCount).toBe(2)
    expect(plan.draft).toEqual({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      coverMode: "vocal",
      voiceRef: "voice_preview_mira",
      instruction: "Re-perform this as a close acoustic duet.",
      preserve: ["melody", "lyrics", "structure"],
      referenceAssetRefs: [],
      outputCount: 2,
    })
  })

  it("removes Voice and Lyrics anchors from an Instrumental Cover plan", () => {
    const plan = buildStudioChangePlan("transform", verse, "Reframe the song for felt piano and strings.", {
      transformIntent: "cover",
      transformScope: "whole_version",
      preserve: ["melody", "lyrics", "vocal_identity", "structure"],
      outputCount: 1,
      coverMode: "instrumental",
      coverVoiceRef: "voice_preview_rowan",
    })

    expect(plan.preserve).toEqual(["melody", "structure"])
    expect(plan.draft).toEqual({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      coverMode: "instrumental",
      instruction: "Reframe the song for felt piano and strings.",
      preserve: ["melody", "structure"],
      referenceAssetRefs: [],
      outputCount: 2,
    })
  })
})
