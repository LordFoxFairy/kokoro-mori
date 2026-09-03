import {
  studioRemasterProtectedAnchors,
  type MoriStudioRemasterDraft,
  type MoriStudioRemasterSource,
  type StudioRemasterGenerationSnapshot,
  type StudioRemasterStrength,
} from "@/lib/mori-api"
import type { StudioChangePlan, StudioTimelineSection } from "./studio-change"

export type StudioRemasterPlan = Omit<StudioChangePlan, "draft"> & {
  intent: "remaster"
  source: MoriStudioRemasterSource
  variationStrength: StudioRemasterStrength
  draft: MoriStudioRemasterDraft
}

export type StudioRemasterPlanInput = {
  source: MoriStudioRemasterSource
  variationStrength: StudioRemasterStrength
  durationSeconds: number
}

const remasterInstructions: Record<StudioRemasterStrength, string> = {
  subtle: "Refine balance, clarity, and vocal pronunciation with the smallest possible production change.",
  balanced: "Polish balance, clarity, depth, and loudness while keeping the song recognizably the same.",
  bold: "Push clarity, impact, and spatial depth further while preserving the song's identity and structure.",
}

export function buildStudioRemasterPlan(input: StudioRemasterPlanInput): StudioRemasterPlan {
  const source = input.source.type === "version"
    ? { type: "version" as const }
    : { type: "mix_revision" as const, mixRevisionRef: input.source.mixRevisionRef.trim() }
  const instruction = remasterInstructions[input.variationStrength]
  const preserve = [...studioRemasterProtectedAnchors]
  const selection = wholeVersionSelection(input.durationSeconds)
  const draft: MoriStudioRemasterDraft = {
    operation: "transform",
    scope: { type: "whole_version" },
    intent: "remaster",
    source,
    variationStrength: input.variationStrength,
    instruction,
    preserve,
    outputCount: 2,
  }

  return {
    intent: "remaster",
    source,
    variationStrength: input.variationStrength,
    operation: "transform",
    instruction,
    sectionId: selection.id,
    selection,
    scopeLabel: "Whole song",
    preserve,
    outputCount: 2,
    draft,
  }
}

export function isStudioRemasterPlan(plan: StudioChangePlan | null): plan is StudioRemasterPlan {
  return plan !== null
    && plan.draft.operation === "transform"
    && plan.draft.intent === "remaster"
}

export function isStudioRemasterSnapshot(snapshot: { intent?: unknown }): snapshot is StudioRemasterGenerationSnapshot {
  return snapshot.intent === "remaster"
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
