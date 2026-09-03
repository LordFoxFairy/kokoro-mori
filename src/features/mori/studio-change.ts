import type { GenerationStatus } from "./domain"
import type { MoriStudioChangeDraft, StudioChangeOperation, StudioChangePreserve } from "@/lib/mori-api"

export type StudioTimelineSection = {
  id: string
  label: string
  startMs: number
  endMs: number
  weight: number
}

export type StudioChangePlan = {
  operation: StudioChangeOperation
  instruction: string
  sectionId: string
  scopeLabel: string
  preserve: StudioChangePreserve[]
  outputCount: StudioChangeOutputCount
  draft: MoriStudioChangeDraft
}

export const defaultStudioChangePreserve: StudioChangePreserve[] = ["melody", "lyrics", "vocal_identity"]
export const studioChangeOutputCounts = [1, 2, 4] as const

export type StudioChangeOutputCount = typeof studioChangeOutputCounts[number]
export type StudioTransformScope = "selected_section" | "whole_version"

export type StudioChangePlanOptions = {
  preserve: StudioChangePreserve[]
  outputCount: StudioChangeOutputCount
  transformScope: StudioTransformScope
}

export function buildStudioTimelineSections(structure: string[], durationSeconds: number): StudioTimelineSection[] {
  if (structure.length === 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return []
  const weights = structure.map((label, index) => sectionWeight(label, index, structure.length))
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const durationMs = Math.round(durationSeconds * 1_000)
  let elapsedWeight = 0

  return structure.map((label, index) => {
    const weight = weights[index] ?? 1
    const startMs = Math.round((elapsedWeight / totalWeight) * durationMs)
    elapsedWeight += weight
    const endMs = index === structure.length - 1
      ? durationMs
      : Math.round((elapsedWeight / totalWeight) * durationMs)
    return {
      id: `${slug(label)}-${index + 1}`,
      label,
      startMs,
      endMs,
      weight,
    }
  })
}

export function buildStudioChangePlan(
  operation: StudioChangeOperation,
  section: StudioTimelineSection,
  instruction: string,
  options: StudioChangePlanOptions = {
    preserve: defaultStudioChangePreserve,
    outputCount: 2,
    transformScope: "selected_section",
  },
): StudioChangePlan {
  const preserve = [...options.preserve]
  const common = { instruction, preserve, outputCount: options.outputCount }
  switch (operation) {
    case "add_part":
      return {
        operation,
        instruction,
        sectionId: section.id,
        scopeLabel: `After selected ${section.label}`,
        preserve,
        outputCount: options.outputCount,
        draft: { ...common, operation, scope: { type: "insertion_point", positionMs: section.endMs } },
      }
    case "replace_section":
      return {
        operation,
        instruction,
        sectionId: section.id,
        scopeLabel: `Selected section · ${section.label}`,
        preserve,
        outputCount: options.outputCount,
        draft: { ...common, operation, scope: { type: "time_range", startMs: section.startMs, endMs: section.endMs } },
      }
    case "extend":
      return {
        operation,
        instruction,
        sectionId: section.id,
        scopeLabel: `From selected ${section.label}`,
        preserve,
        outputCount: options.outputCount,
        draft: { ...common, operation, scope: { type: "from_position", positionMs: section.endMs } },
      }
    case "transform":
      if (options.transformScope === "whole_version") {
        return {
          operation,
          instruction,
          sectionId: section.id,
          scopeLabel: "Whole song",
          preserve,
          outputCount: options.outputCount,
          draft: { ...common, operation, scope: { type: "whole_version" } },
        }
      }
      return {
        operation,
        instruction,
        sectionId: section.id,
        scopeLabel: `Selected section · ${section.label}`,
        preserve,
        outputCount: options.outputCount,
        draft: { ...common, operation, scope: { type: "time_range", startMs: section.startMs, endMs: section.endMs } },
      }
  }
}

export function isActiveStudioChangeStatus(status: "idle" | GenerationStatus): boolean {
  return status === "preparing" || status === "queued" || status === "generating" || status === "post_processing"
}

function sectionWeight(label: string, index: number, sectionCount: number): number {
  if (index === 0 || index === sectionCount - 1) return 0.75
  if (label.trim().toLowerCase() === "chorus") return 1.3
  return 1
}

function slug(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "")
  return normalized === "" ? "section" : normalized
}
