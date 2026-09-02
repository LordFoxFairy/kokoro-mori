import { describe, expect, it } from "vitest"
import { createGenerationRequest } from "./mori-api"
import { createMoriApiClient } from "./mori-api-client"

describe("Mori same-origin API client", () => {
  it("posts a project-bound generation request with the public envelope", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response(JSON.stringify({
          data: { generation_ref: "generation_request_1", status: "queued" },
          meta: { request_id: "request_1" },
        }), { status: 202, headers: { "Content-Type": "application/json" } })
      },
    })

    const response = await api.createGeneration(
      "project_preview_first_light",
      createGenerationRequest({ mode: "smart", prompt: "a quiet morning", lyricsMode: "instrumental" }),
      "idem-1",
    )

    expect(capturedUrl).toBe("/api/v1/mori/projects/project_preview_first_light/generations")
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-1",
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      mode: "smart",
      prompt: "a quiet morning",
      song_plan_ref: null,
      lyrics: null,
      style: null,
      reference_asset_refs: [],
      voice_ref: null,
      duration_seconds: null,
      lyrics_mode: "instrumental",
    })
    expect(response.data.generation_ref).toBe("generation_request_1")
    expect(response.meta.request_id).toBe("request_1")
  })

  it("preserves the normalized API error for UI state mapping", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        error: {
          code: "rate_limited",
          message: "Generation is temporarily busy",
          retryable: true,
          details: null,
        },
        meta: { request_id: "request_2" },
      }), { status: 429, headers: { "Content-Type": "application/json" } }),
    })

    await expect(api.createGeneration("project_preview_first_light", {
      mode: "smart",
      prompt: "morning",
      song_plan_ref: null,
      lyrics: null,
      style: null,
      reference_asset_refs: [],
      voice_ref: null,
      duration_seconds: null,
      lyrics_mode: "instrumental",
    }, "idem-2")).rejects.toMatchObject({
      code: "rate_limited",
      retryable: true,
      requestId: "request_2",
      status: 429,
    })
  })
})
