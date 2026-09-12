import { describe, expect, it } from "vitest"
import { buildStudioLayerPlan } from "./studio-layers"

describe("Mori Studio layer plans", () => {
  it("builds a vocal layer over the whole current version", () => {
    const plan = buildStudioLayerPlan("vocals", {
      instruction: "  Keep the delivery close and unhurried.  ",
      lyrics: "  Meet me where the streetlights fade.  ",
      voiceRef: "voice_preview_mira",
      durationSeconds: 182,
      outputCount: 2,
    })

    expect(plan).toMatchObject({
      layerKind: "vocals",
      operation: "add_part",
      scopeLabel: "Whole song",
      preserve: ["melody", "tempo", "structure"],
      outputCount: 2,
      draft: {
        operation: "add_part",
        scope: { type: "whole_version" },
        partKind: "vocals",
        instruction: "Keep the delivery close and unhurried.",
        lyrics: "Meet me where the streetlights fade.",
        voiceRef: "voice_preview_mira",
        preserve: ["melody", "tempo", "structure"],
        outputCount: 2,
      },
    })
    expect(plan.selection).toEqual({ id: "whole-version", label: "Whole song", startMs: 0, endMs: 182_000, weight: 1 })
  })

  it("builds an instrumental layer while protecting the existing vocal", () => {
    const plan = buildStudioLayerPlan("instrumental", {
      instruction: "  Warm piano and brushed drums, leaving space for the lead.  ",
      lyrics: "This is ignored for an instrumental layer.",
      voiceRef: "voice_preview_mira",
      durationSeconds: 182,
      outputCount: 2,
    })

    expect(plan).toMatchObject({
      layerKind: "instrumental",
      scopeLabel: "Whole song",
      preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
      draft: {
        scope: { type: "whole_version" },
        partKind: "instrumental",
        instruction: "Warm piano and brushed drums, leaving space for the lead.",
        preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
        outputCount: 2,
      },
    })
    expect(plan.draft).not.toHaveProperty("lyrics")
    expect(plan.draft).not.toHaveProperty("voiceRef")
  })
})
