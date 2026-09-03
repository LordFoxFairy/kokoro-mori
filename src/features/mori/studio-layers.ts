import type { MoriStudioLayerDraft, StudioChangePreserve, StudioLayerKind } from "@/lib/mori-api"
import type { StudioChangePlan, StudioTimelineSection } from "./studio-change"

export type StudioLayerMode = StudioLayerKind

export type StudioLayerPlan = Omit<StudioChangePlan, "draft"> & {
  layerKind: StudioLayerMode
  draft: MoriStudioLayerDraft
}

export type StudioLayerPlanInput = {
  instruction: string
  lyrics?: string
  voiceRef?: string
  durationSeconds: number
}

const vocalPreserve: StudioChangePreserve[] = ["melody", "tempo", "structure"]
const instrumentalPreserve: StudioChangePreserve[] = ["melody", "lyrics", "vocal_identity", "tempo", "structure"]

export function buildStudioLayerPlan(mode: StudioLayerMode, input: StudioLayerPlanInput): StudioLayerPlan {
  const preserve = mode === "vocals" ? [...vocalPreserve] : [...instrumentalPreserve]
  const selection = wholeVersionSelection(input.durationSeconds)
  const draft: MoriStudioLayerDraft = {
    operation: "add_part",
    scope: { type: "whole_version" },
    partKind: mode,
    instruction: input.instruction.trim(),
    preserve,
    outputCount: 2,
    ...(mode === "vocals" ? {
      lyrics: input.lyrics?.trim() ?? "",
      ...(input.voiceRef?.trim() ? { voiceRef: input.voiceRef.trim() } : {}),
    } : {}),
  }

  return {
    layerKind: mode,
    operation: "add_part",
    instruction: draft.instruction,
    sectionId: selection.id,
    selection,
    scopeLabel: "Whole song",
    preserve,
    outputCount: 2,
    draft,
  }
}

export function isStudioLayerPlan(plan: StudioChangePlan | null): plan is StudioLayerPlan {
  return plan !== null
    && plan.draft.operation === "add_part"
    && "partKind" in plan.draft
}

function wholeVersionSelection(durationSeconds: number): StudioTimelineSection {
  const durationMs = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? Math.round(durationSeconds * 1_000)
    : 1_000
  return {
    id: "whole-version",
    label: "Whole song",
    startMs: 0,
    endMs: durationMs,
    weight: 1,
  }
}
