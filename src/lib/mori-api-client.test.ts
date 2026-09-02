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

  it("reads the provider-neutral Mori library projection", async () => {
    let capturedUrl = ""
    const api = createMoriApiClient({
      fetchImpl: async (input) => {
        capturedUrl = String(input)
        return new Response(JSON.stringify({
          data: { items: [], next_cursor: null },
          meta: { request_id: "request_3" },
        }), { status: 200, headers: { "Content-Type": "application/json" } })
      },
    })

    const response = await api.listLibrary?.("version")

    expect(capturedUrl).toBe("/api/v1/mori/library?kind=version")
    expect(response?.data.items).toEqual([])
  })

  it("queues and reads a version export through the Mori contract", async () => {
    const calls: Array<{ url: string; method: string | undefined }> = []
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), method: init?.method })
        const isCreate = init?.method === "POST"
        return new Response(JSON.stringify(isCreate ? {
          data: { export_ref: "export_1", status: "queued" },
          meta: { request_id: "request_4" },
        } : {
          data: {
            export_ref: "export_1",
            project_ref: "project_preview_first_light",
            version_ref: "version_preview_first_light_a",
            format: "mp3",
            status: "succeeded",
            download_url: "https://download.kokoro.invalid/export_1.mp3",
            created_at: "2026-09-02T12:00:00.000Z",
          },
          meta: { request_id: "request_5" },
        }), { status: isCreate ? 202 : 200, headers: { "Content-Type": "application/json" } })
      },
    })

    const receipt = await api.createExport("version_preview_first_light_a", "mp3", "idem-export-1")
    const snapshot = await api.getExport(receipt.data.export_ref)

    expect(calls).toEqual([
      { url: "/api/v1/mori/versions/version_preview_first_light_a/exports", method: "POST" },
      { url: "/api/v1/mori/exports/export_1", method: undefined },
    ])
    expect(snapshot.data.download_url).toContain("export_1.mp3")
  })
})
