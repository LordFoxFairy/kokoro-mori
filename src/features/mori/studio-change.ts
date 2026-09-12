import type { GenerationStatus } from "./domain"
import {
  createStudioChangeRequest,
  studioInstrumentalCoverProtectedAnchors,
  studioVocalCoverProtectedAnchors,
  studioChangeOutputCounts,
  type MoriStudioChangeDraft,
  type StudioChangeGenerationInput,
  type StudioChangeOperation,
  type StudioChangeOutputCount,
  type StudioChangePreserve,
  type StudioCoverMode,
  type StudioTransformIntent,
} from "@/lib/mori-api"

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
export { studioChangeOutputCounts }
export type { StudioChangeOutputCount }
export type StudioTransformScope = "selected_section" | "whole_version"

export type StudioChangePlanOptions = {
  preserve: StudioChangePreserve[]
  outputCount: StudioChangeOutputCount
  transformScope: StudioTransformScope
  transformIntent: StudioTransformIntent
  coverMode: StudioCoverMode
  coverVoiceRef: string | null
  referenceAssetRefs?: string[]
}

export type PendingStudioChangeCommand = {
  versionRef: string
  input: StudioChangeGenerationInput
  idempotencyKey: string
}

/**
 * Keep one logical Studio request on the same idempotency key until its
 * receipt has been durably placed in the browser queue. A retry after a
 * confirmed receipt creates a new command instead of replaying a terminal
 * generation.
 */
export function studioChangeCommand(
  versionRef: string,
  draft: MoriStudioChangeDraft,
  previousCommand: PendingStudioChangeCommand | null,
): PendingStudioChangeCommand {
  const input = createStudioChangeRequest(draft)
  if (
    previousCommand !== null
    && previousCommand.versionRef === versionRef
    && studioChangeInputsMatch(previousCommand.input, input)
  ) return previousCommand

  return {
    versionRef,
    input,
    idempotencyKey: `mori-studio-change-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
}

export function studioChangeInputsMatch(left: StudioChangeGenerationInput, right: StudioChangeGenerationInput): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export const minimumStudioTimelineSelectionMs = 1_000

export function buildStudioTimelineSections(structure: readonly string[], durationSeconds: number): StudioTimelineSection[] {
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
  transformIntent: StudioTransformIntent = "restyle",
): string {
  if (operation === "transform" && transformIntent === "cover") return "Whole song · open Version"
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
    transformIntent: "restyle",
    coverMode: "vocal",
    coverVoiceRef: null,
  },
): StudioChangePlan {
  const preserve = [...options.preserve]
  const common = { instruction, preserve, outputCount: options.outputCount }
  const planContext = {
    instruction,
    sectionId: section.id,
    selection: { ...section },
    scopeLabel: studioChangeScopeLabel(operation, section, options.transformScope, options.transformIntent),
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
      if (options.transformIntent === "cover") {
        const coverPreserve = options.coverMode === "vocal"
          ? [...studioVocalCoverProtectedAnchors]
          : [...studioInstrumentalCoverProtectedAnchors]
        const voice = options.coverMode === "vocal" && options.coverVoiceRef !== null
          ? { voiceRef: options.coverVoiceRef }
          : {}
        return {
          ...planContext,
          operation,
          scopeLabel: "Whole song · open Version",
          preserve: coverPreserve,
          outputCount: 2,
          draft: {
            operation,
            intent: "cover",
            scope: { type: "whole_version" },
            coverMode: options.coverMode,
            ...voice,
            instruction,
            preserve: coverPreserve,
            referenceAssetRefs: [],
            outputCount: 2,
          },
        }
      }
      if (options.transformScope === "whole_version") {
        return {
          ...planContext,
          operation,
          draft: {
            ...common,
            ...(options.referenceAssetRefs !== undefined && options.referenceAssetRefs.length > 0
              ? { referenceAssetRefs: [...options.referenceAssetRefs] }
              : {}),
            operation,
            intent: "restyle",
            scope: { type: "whole_version" },
          },
        }
      }
      return {
        ...planContext,
        operation,
        draft: {
          ...common,
          ...(options.referenceAssetRefs !== undefined && options.referenceAssetRefs.length > 0
            ? { referenceAssetRefs: [...options.referenceAssetRefs] }
            : {}),
          operation,
          intent: "restyle",
          scope: { type: "time_range", startMs: section.startMs, endMs: section.endMs },
        },
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
