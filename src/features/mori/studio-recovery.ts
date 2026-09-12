import type {
  MoriStudioRemasterSource,
  StudioChangeGenerationSnapshot,
  StudioChangePreserve,
  StandardStudioChangeGenerationSnapshot,
} from "@/lib/mori-api"
import {
  buildStudioChangePlan,
  createStudioTimelineRange,
  type StudioChangePlan,
  type StudioTimelineSection,
} from "./studio-change"
import { buildStudioLayerPlan } from "./studio-layers"
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
    if ("part_kind" in snapshot) {
      return buildStudioLayerPlan(snapshot.part_kind, {
        instruction: snapshot.instruction,
        lyrics: snapshot.lyrics ?? undefined,
        voiceRef: snapshot.voice_ref ?? undefined,
        durationSeconds,
        outputCount: snapshot.output_count,
      })
    }

    const selection = standardSelection(snapshot)
    return buildStudioChangePlan(
      snapshot.operation,
      selection,
      snapshot.instruction,
      {
        preserve: [...snapshot.preserve],
        outputCount: snapshot.output_count,
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
    outputCount: snapshot.output_count,
    transformScope: snapshot.scope.type === "whole_version" ? "whole_version" : "selected_section",
    transformIntent: "restyle",
    coverMode: "vocal",
    coverVoiceRef: null,
    referenceAssetRefs: [...snapshot.reference_asset_refs],
  })
}

function standardSelection(snapshot: StandardStudioChangeGenerationSnapshot): StudioTimelineSection {
  if (snapshot.scope.type === "time_range") {
    return {
      id: "recovered-range",
      label: "Recovered range",
      startMs: snapshot.scope.start_ms,
      endMs: snapshot.scope.end_ms,
      weight: 1,
    }
  }
  const positionMs = snapshot.scope.position_ms
  return {
    id: snapshot.scope.type === "insertion_point" ? "recovered-insertion-point" : "recovered-from-position",
    label: snapshot.scope.type === "insertion_point" ? "Recovered insertion point" : "Recovered start point",
    startMs: Math.max(0, positionMs - 1_000),
    endMs: positionMs,
    weight: 1,
  }
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
