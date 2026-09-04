import type {
  MoriStudioRemasterSource,
  StudioChangeGenerationSnapshot,
  StudioChangePreserve,
} from "@/lib/mori-api"
import {
  buildStudioChangePlan,
  createStudioTimelineRange,
  defaultStudioChangePreserve,
  type StudioChangePlan,
  type StudioTimelineSection,
} from "./studio-change"
import { buildStudioRemasterPlan } from "./studio-remaster"

/**
 * Rebuild the in-memory Studio plan after a route refresh. The queue only
 * stores safe display metadata; the generation snapshot is the source for
 * the reviewed request when the server exposes it.
 */
export function studioChangePlanFromSnapshot(
  snapshot: StudioChangeGenerationSnapshot,
  durationSeconds: number,
): StudioChangePlan {
  if (snapshot.operation !== "transform") {
    return buildStudioChangePlan(
      snapshot.operation,
      wholeVersionSelection(durationSeconds),
      "Continue the reviewed Studio change from this Version.",
      {
        preserve: [...defaultStudioChangePreserve],
        outputCount: 2,
        transformScope: "whole_version",
        transformIntent: "restyle",
        coverMode: "vocal",
        coverVoiceRef: null,
      },
    )
  }

  if (snapshot.intent === "remaster") {
    const source: MoriStudioRemasterSource = snapshot.source.type === "version"
      ? { type: "version" }
      : { type: "mix_revision", mixRevisionRef: snapshot.source.mix_revision_ref }
    return buildStudioRemasterPlan({
      source,
      variationStrength: snapshot.variation_strength,
      durationSeconds,
    })
  }

  const selection = snapshot.scope.type === "whole_version"
    ? wholeVersionSelection(durationSeconds)
    : createStudioTimelineRange(snapshot.scope.start_ms, snapshot.scope.end_ms, Math.max(1_000, durationSeconds * 1_000))
  const preserve: StudioChangePreserve[] = [...snapshot.preserve]

  if (snapshot.intent === "cover") {
    const voiceRef = snapshot.voice_ref
    return buildStudioChangePlan("transform", selection, snapshot.instruction, {
      preserve,
      outputCount: 2,
      transformScope: "whole_version",
      transformIntent: "cover",
      coverMode: snapshot.cover_mode,
      coverVoiceRef: voiceRef,
    })
  }

  return buildStudioChangePlan("transform", selection, snapshot.instruction, {
    preserve,
    outputCount: normalizeOutputCount(snapshot.output_count),
    transformScope: snapshot.scope.type === "whole_version" ? "whole_version" : "selected_section",
    transformIntent: "restyle",
    coverMode: "vocal",
    coverVoiceRef: null,
    referenceAssetRefs: [...snapshot.reference_asset_refs],
  })
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

function normalizeOutputCount(value: number): 1 | 2 | 4 {
  if (value === 1 || value === 4) return value
  return 2
}
