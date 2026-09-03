import type { MoriStemSeparationDraft, StemSeparationMode, StemSeparationStatus } from "@/lib/mori-api"

export type StudioStemSeparationMode = StemSeparationMode

export type StudioStemSeparationPlan = {
  mode: StudioStemSeparationMode
  includeMidi: boolean
  output: { kind: "exact"; count: 2 } | { kind: "maximum"; count: 12 }
}

export function buildStudioStemSeparationPlan(mode: StudioStemSeparationMode, includeMidi: boolean): StudioStemSeparationPlan {
  return {
    mode,
    includeMidi,
    output: mode === "vocals_instrumental"
      ? { kind: "exact", count: 2 }
      : { kind: "maximum", count: 12 },
  }
}

export function createStudioStemSeparationDraft(plan: StudioStemSeparationPlan): MoriStemSeparationDraft {
  return {
    mode: plan.mode,
    includeMidi: plan.includeMidi,
  }
}

export function isActiveStemSeparationStatus(status: "idle" | "preparing" | StemSeparationStatus): boolean {
  return status === "preparing" || status === "queued" || status === "separating"
}

export function studioStemSeparationModeLabel(mode: StudioStemSeparationMode): string {
  return mode === "vocals_instrumental" ? "Vocals + instrumental" : "Auto stems"
}

export function studioStemSeparationOutputLabel(plan: StudioStemSeparationPlan): string {
  return plan.output.kind === "exact" ? `${plan.output.count} stems` : `Up to ${plan.output.count} stems`
}

export function studioStemSeparationActionLabel(plan: StudioStemSeparationPlan): string {
  return plan.output.kind === "exact" ? `Separate ${plan.output.count} stems` : "Separate detected stems"
}
