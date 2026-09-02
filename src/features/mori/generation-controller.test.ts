import { describe, expect, it } from "vitest"
import { createGenerationController, previewMoriApi } from "./generation-controller"
import { createGenerationRequest } from "@/lib/mori-api"

describe("Mori generation contract seam", () => {
  it("serializes browser input with the public snake_case contract", () => {
    const request = createGenerationRequest({
      mode: "custom",
      prompt: "  a soft sunrise  ",
      lyricsMode: "lyrics",
      style: "dream pop",
      referenceAssetRefs: ["asset_preview_reference"],
      voiceRef: "voice_preview_natural",
      durationSeconds: 180,
    })

    expect(request).toEqual({
      mode: "custom",
      prompt: "a soft sunrise",
      lyrics: null,
      style: "dream pop",
      reference_asset_refs: ["asset_preview_reference"],
      voice_ref: "voice_preview_natural",
      duration_seconds: 180,
      lyrics_mode: "lyrics",
    })
    expect("provider_name" in request).toBe(false)
    expect("provider_task_id" in request).toBe(false)
  })

  it("returns a stable receipt through the fixture adapter", async () => {
    const controller = createGenerationController(previewMoriApi)
    const state = await controller.submit({ mode: "smart", prompt: "a quiet morning", lyricsMode: "lyrics" }, "idempotency-1")
    expect(state.status).toBe("queued")
    expect(state.requestId).toBe("preview-request-idempotency-1")
    expect(state.generationRef).toBe("generation_preview_first_light_next")
  })
})
