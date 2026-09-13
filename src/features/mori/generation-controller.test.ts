import { describe, expect, it } from "vitest"
import { createGenerationController, previewMoriApi } from "./generation-controller"
import { previewProject } from "./preview-data"
import { createGenerationRequest, createMutationHeaders, type MoriExportInput } from "@/lib/mori-api"

describe("Mori generation contract seam", () => {
  it("serializes browser input with the public snake_case contract", () => {
    const request = createGenerationRequest({
      mode: "custom",
      prompt: "  a soft sunrise  ",
      songPlanRef: "song_plan_preview_first_light",
      lyricsMode: "lyrics",
      lyrics: "  we carry the morning through  ",
      style: "dream pop",
      referenceAssetRefs: ["asset_preview_reference"],
      voiceRef: "voice_preview_natural",
      durationSeconds: 180,
    })

    expect(request).toEqual({
      mode: "custom",
      prompt: "a soft sunrise",
      song_plan_ref: "song_plan_preview_first_light",
      lyrics: "we carry the morning through",
      style: "dream pop",
      reference_asset_refs: ["asset_preview_reference"],
      voice_ref: "voice_preview_natural",
      duration_seconds: 180,
      lyrics_mode: "lyrics",
      output_count: 2,
    })
    expect("provider_name" in request).toBe(false)
    expect("provider_task_id" in request).toBe(false)
  })

  it("creates the required mutation headers without putting idempotency in the body", () => {
    const request = createGenerationRequest({ mode: "smart", prompt: "morning", lyricsMode: "instrumental" })
    expect(request).not.toHaveProperty("idempotency_key")
    expect(createMutationHeaders("idem-1")).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-1",
    })
  })

  it("returns a stable receipt through the fixture adapter", async () => {
    const controller = createGenerationController(previewMoriApi, previewProject.projectRef)
    const state = await controller.submit({ mode: "smart", prompt: "a quiet morning", lyricsMode: "lyrics" }, "idempotency-1")
    expect(state.status).toBe("queued")
    expect(state.requestId).toBe("preview-request-idempotency-1")
    expect(state.generationRef).toBe("generation_preview_first_light_next")
  })

  it("keeps request tracking in meta instead of duplicating it in resource data", async () => {
    const response = await previewMoriApi.createGeneration(
      previewProject.projectRef,
      createGenerationRequest({ mode: "smart", prompt: "a quiet morning", lyricsMode: "lyrics" }),
      "idempotency-2",
    )

    expect(response.data).toEqual({
      generation_ref: "generation_preview_first_light_next",
      status: "queued",
    })
    expect(response.meta.request_id).toBe("preview-request-idempotency-2")
  })

  it("keeps the known preview versions visible through the candidate projection", async () => {
    const response = await previewMoriApi.listCandidates(previewProject.projectRef)

    expect(response.data.candidates).toHaveLength(2)
    expect(response.data.candidates.map((candidate) => candidate.version_ref)).toEqual([
      "version_preview_first_light_a",
      "version_preview_first_light_b",
    ])
    expect(response.data.candidates[0]).toMatchObject({
      candidate_ref: "candidate_preview_first_light_a",
      generation_ref: "generation_preview_first_light",
      project_ref: previewProject.projectRef,
      audio_asset_ref: "preview:first-light:a",
    })
  })

  it("binds generation commands to the project path context", async () => {
    let capturedProjectRef: string | null = null
    const api = {
      async createGeneration(projectRef: string, input: Parameters<typeof previewMoriApi.createGeneration>[1], idempotencyKey: string) {
        capturedProjectRef = projectRef
        return previewMoriApi.createGeneration(projectRef, input, idempotencyKey)
      },
    }
    const controller = createGenerationController(api, previewProject.projectRef)
    const state = await controller.submit({ mode: "smart", prompt: "a quiet morning", lyricsMode: "lyrics" }, "idempotency-3")

    expect(capturedProjectRef).toBe(previewProject.projectRef)
    expect(state.generationRef).toBe("generation_preview_first_light_next")
  })

  it("echoes the requested Version, Mix Revision, and format through preview exports", async () => {
    const input: MoriExportInput = {
      source: { type: "mix_revision", mix_revision_ref: "mix_revision_preview_4" },
      scope: { type: "full_song" },
      format: "wav",
    }

    const receipt = await previewMoriApi.createExport("version_preview_first_light_b", input, "preview-export-4")
    const snapshot = await previewMoriApi.getExport(receipt.data.export_ref)

    expect(snapshot.data).toMatchObject({
      version_ref: "version_preview_first_light_b",
      source: input.source,
      scope: input.scope,
      format: "wav",
    })
  })
})
