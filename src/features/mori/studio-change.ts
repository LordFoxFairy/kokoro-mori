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
  selection: StudioTimelineSection
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

export const minimumStudioTimelineSelectionMs = 1_000

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

export function createStudioTimelineRange(startMs: number, endMs: number, durationMs: number): StudioTimelineSection {
  const safeDurationMs = Math.max(minimumStudioTimelineSelectionMs, Math.round(durationMs))
  const normalizedStartMs = Math.max(0, Math.min(safeDurationMs - minimumStudioTimelineSelectionMs, Math.round(startMs)))
  const normalizedEndMs = Math.max(
    normalizedStartMs + minimumStudioTimelineSelectionMs,
    Math.min(safeDurationMs, Math.round(endMs)),
  )
  return {
    id: "custom-range",
    label: "Custom range",
    startMs: normalizedStartMs,
    endMs: normalizedEndMs,
    weight: (normalizedEndMs - normalizedStartMs) / safeDurationMs,
  }
}

export function findStudioTimelineSection(sections: StudioTimelineSection[], positionMs: number): StudioTimelineSection | null {
  if (sections.length === 0) return null
  const normalizedPosition = Math.max(0, Math.round(positionMs))
  return sections.find((section, index) => (
    normalizedPosition >= section.startMs
    && (normalizedPosition < section.endMs || index === sections.length - 1)
  )) ?? sections[0] ?? null
}

export function buildStudioTimelineTicks(durationSeconds: number, count = 5): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || count < 2) return []
  const durationMs = Math.round(durationSeconds * 1_000)
  return Array.from({ length: count }, (_, index) => Math.round((durationMs * index) / (count - 1)))
}

export function formatStudioTimelineTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1_000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`
}

export function studioChangeScopeLabel(
  operation: StudioChangeOperation,
  selection: StudioTimelineSection,
  transformScope: StudioTransformScope,
): string {
  if (operation === "transform" && transformScope === "whole_version") return "Whole song"
  if (selection.id !== "custom-range") {
    if (operation === "add_part") return `After selected ${selection.label}`
    if (operation === "extend") return `From selected ${selection.label}`
    return `Selected section · ${selection.label}`
  }

  const range = `${formatStudioTimelineTime(selection.startMs)}–${formatStudioTimelineTime(selection.endMs)}`
  if (operation === "add_part") return `After selected range · ${range}`
  if (operation === "extend") return `From selected range · ${formatStudioTimelineTime(selection.endMs)}`
  return `Selected range · ${range}`
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
  const planContext = {
    instruction,
    sectionId: section.id,
    selection: { ...section },
    scopeLabel: studioChangeScopeLabel(operation, section, options.transformScope),
    preserve,
    outputCount: options.outputCount,
  }
  switch (operation) {
    case "add_part":
      return {
        ...planContext,
        operation,
        draft: { ...common, operation, scope: { type: "insertion_point", positionMs: section.endMs } },
      }
    case "replace_section":
      return {
        ...planContext,
        operation,
        draft: { ...common, operation, scope: { type: "time_range", startMs: section.startMs, endMs: section.endMs } },
      }
    case "extend":
      return {
        ...planContext,
        operation,
        draft: { ...common, operation, scope: { type: "from_position", positionMs: section.endMs } },
      }
    case "transform":
      if (options.transformScope === "whole_version") {
        return {
          ...planContext,
          operation,
          draft: { ...common, operation, scope: { type: "whole_version" } },
        }
      }
      return {
        ...planContext,
        operation,
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
