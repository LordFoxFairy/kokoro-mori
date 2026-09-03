import { stemTargetKinds, type MoriStemSeparationDraft, type StemSeparationMode, type StemSeparationSnapshot, type StemSeparationStatus, type StemTargetKind } from "@/lib/mori-api"

export type StudioStemSeparationMode = StemSeparationMode

export type StudioStemSeparationSelection = {
  mode: StudioStemSeparationMode
  targetKinds: StemTargetKind[]
}

export type StudioStemSeparationPlan = {
  mode: StudioStemSeparationMode
  targetKinds: StemTargetKind[]
  includeMidi: boolean
  output: { kind: "isolate"; count: 2 } | { kind: "maximum"; count: 12 } | { kind: "requested"; count: number }
}

export const studioStemTargets = [
  { kind: "vocals", label: "Vocals" },
  { kind: "backing_vocals", label: "Backing vocals" },
  { kind: "drums", label: "Drums" },
  { kind: "bass", label: "Bass" },
  { kind: "guitar", label: "Guitar" },
  { kind: "keys", label: "Keys" },
  { kind: "strings", label: "Strings" },
  { kind: "wind", label: "Winds & brass" },
  { kind: "synth", label: "Synths" },
  { kind: "percussion", label: "Percussion" },
] satisfies readonly { kind: StemTargetKind; label: string }[]

export function buildStudioStemSeparationPlan(selection: StudioStemSeparationSelection, includeMidi: boolean): StudioStemSeparationPlan {
  const targetKinds = normalizeTargetKinds(selection.targetKinds)
  validateTargetCount(selection.mode, targetKinds.length)
  return {
    mode: selection.mode,
    targetKinds,
    includeMidi,
    output: selection.mode === "isolate_part"
      ? { kind: "isolate", count: 2 }
      : selection.mode === "auto_stems"
        ? { kind: "maximum", count: 12 }
        : { kind: "requested", count: targetKinds.length },
  }
}

export function createStudioStemSeparationDraft(plan: StudioStemSeparationPlan): MoriStemSeparationDraft {
  return {
    mode: plan.mode,
    targetKinds: [...plan.targetKinds],
    includeMidi: plan.includeMidi,
  }
}

export function isActiveStemSeparationStatus(status: "idle" | "preparing" | StemSeparationStatus): boolean {
  return status === "preparing" || status === "queued" || status === "separating"
}

export function stemSeparationSnapshotMatchesPlan(snapshot: StemSeparationSnapshot, plan: StudioStemSeparationPlan): boolean {
  return snapshot.mode === plan.mode
    && snapshot.include_midi === plan.includeMidi
    && snapshot.target_kinds.length === plan.targetKinds.length
    && plan.targetKinds.every((targetKind) => snapshot.target_kinds.includes(targetKind))
}

export function studioStemSeparationModeLabel(mode: StudioStemSeparationMode): string {
  switch (mode) {
    case "isolate_part": return "Isolate a part"
    case "auto_stems": return "Auto split"
    case "custom_stems": return "Custom stems"
  }
}

export function studioStemSeparationOutputLabel(plan: StudioStemSeparationPlan): string {
  if (plan.output.kind === "isolate") return `${studioStemTargetLabel(plan.targetKinds[0])} + remaining mix`
  if (plan.output.kind === "maximum") return `Up to ${plan.output.count} detected stems`
  return `Up to ${plan.output.count} selected stems`
}

export function studioStemSeparationActionLabel(plan: StudioStemSeparationPlan): string {
  if (plan.output.kind === "isolate") return `Isolate ${studioStemTargetLabel(plan.targetKinds[0]).toLocaleLowerCase()}`
  if (plan.output.kind === "maximum") return "Separate detected stems"
  return `Separate ${plan.output.count} selected stems`
}

export function studioStemTargetLabel(kind: StemTargetKind | undefined): string {
  return studioStemTargets.find((target) => target.kind === kind)?.label ?? "Selected part"
}

function normalizeTargetKinds(values: StemTargetKind[]): StemTargetKind[] {
  const normalized: StemTargetKind[] = []
  for (const value of values) {
    if (!stemTargetKinds.includes(value)) throw new Error("stem_separation_target_invalid")
    if (!normalized.includes(value)) normalized.push(value)
  }
  return normalized
}

function validateTargetCount(mode: StudioStemSeparationMode, count: number): void {
  const valid = mode === "isolate_part"
    ? count === 1
    : mode === "auto_stems"
      ? count === 0
      : count >= 2 && count <= 10
  if (!valid) throw new Error("stem_separation_target_count_invalid")
}
