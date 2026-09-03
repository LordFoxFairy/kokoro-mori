import { describe, expect, it } from "vitest"
import { buildStudioRemasterPlan, isStudioRemasterPlan } from "./studio-remaster"

describe("Mori Studio Remaster plans", () => {
  it.each([
    ["subtle", "Refine balance, clarity, and vocal pronunciation with the smallest possible production change."],
    ["balanced", "Polish balance, clarity, depth, and loudness while keeping the song recognizably the same."],
    ["bold", "Push clarity, impact, and spatial depth further while preserving the song's identity and structure."],
  ] as const)("turns %s strength into a protected whole-song plan", (variationStrength, instruction) => {
    const plan = buildStudioRemasterPlan({
      source: { type: "version" },
      variationStrength,
      durationSeconds: 182,
    })

    expect(plan).toEqual({
      intent: "remaster",
      source: { type: "version" },
      variationStrength,
      operation: "transform",
      instruction,
      sectionId: "whole-version",
      selection: { id: "whole-version", label: "Whole song", startMs: 0, endMs: 182_000, weight: 1 },
      scopeLabel: "Whole song",
      preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
      outputCount: 2,
      draft: {
        operation: "transform",
        scope: { type: "whole_version" },
        intent: "remaster",
        source: { type: "version" },
        variationStrength,
        instruction,
        preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
        outputCount: 2,
      },
    })
    expect(isStudioRemasterPlan(plan)).toBe(true)
  })

  it("keeps a saved Mix Revision as the explicit Remaster source", () => {
    const plan = buildStudioRemasterPlan({
      source: { type: "mix_revision", mixRevisionRef: "mix_revision_7" },
      variationStrength: "balanced",
      durationSeconds: 182,
    })

    expect(plan.source).toEqual({ type: "mix_revision", mixRevisionRef: "mix_revision_7" })
    expect(plan.draft.source).toEqual({ type: "mix_revision", mixRevisionRef: "mix_revision_7" })
  })
})
