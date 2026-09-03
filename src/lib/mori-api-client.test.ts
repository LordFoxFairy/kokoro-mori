import { describe, expect, it } from "vitest"
import { createGenerationRequest } from "./mori-api"
import { createMoriApiClient } from "./mori-api-client"

describe("Mori same-origin API client", () => {
  it("creates a project with an idempotent public command", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response(JSON.stringify({
          data: {
            project_ref: "project_mori_1",
            title: "Window Seat",
            description: "A quiet, forward-moving sketch.",
            current_version_ref: null,
            candidate_count: 0,
            last_activity_at: "2026-09-02T12:00:00.000Z",
          },
          meta: { request_id: "request_project_create_1" },
        }), { status: 201, headers: { "Content-Type": "application/json" } })
      },
    })

    const response = await api.createProject({ title: "Window Seat", description: "A quiet, forward-moving sketch." }, "idem-project-1")

    expect(capturedUrl).toBe("/api/v1/mori/projects")
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-project-1",
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual({ title: "Window Seat", description: "A quiet, forward-moving sketch." })
    expect(response.data.project_ref).toBe("project_mori_1")
  })

  it("persists a reviewed song plan before creating directions", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response(JSON.stringify({
          data: {
            song_plan_ref: "song_plan_reviewed_1",
            project_ref: "project_preview_first_light",
            prompt: "A quiet piano song",
            mood: "Quiet",
            tempo_bpm: 82,
            structure: ["Intro", "Verse", "Chorus", "Outro"],
            instruments: ["Piano"],
            vocal_direction: "Natural lead",
            lyrics_intent: "A gentle return home",
            created_at: "2026-09-02T12:00:00.000Z",
          },
          meta: { request_id: "request_song_plan_1" },
        }), { status: 201, headers: { "Content-Type": "application/json" } })
      },
    })

    const response = await api.createSongPlan("project_preview_first_light", {
      prompt: "A quiet piano song",
      mood: "Quiet",
      tempo_bpm: 82,
      structure: ["Intro", "Verse", "Chorus", "Outro"],
      instruments: ["Piano"],
      vocal_direction: "Natural lead",
      lyrics_intent: "A gentle return home",
    }, "idem-song-plan-1")

    expect(capturedUrl).toBe("/api/v1/mori/projects/project_preview_first_light/song_plans")
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-song-plan-1",
    })
    expect(JSON.parse(String(capturedInit?.body))).toMatchObject({ prompt: "A quiet piano song", tempo_bpm: 82 })
    expect(response.data.song_plan_ref).toBe("song_plan_reviewed_1")
  })

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

  it("cancels a generation with an idempotent command", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response(JSON.stringify({
          data: { generation_ref: "generation_1", status: "cancelled" },
          meta: { request_id: "request_cancel_1" },
        }), { status: 202, headers: { "Content-Type": "application/json" } })
      },
    })

    const response = await api.cancelGeneration("generation_1", "idem-cancel-1")

    expect(capturedUrl).toBe("/api/v1/mori/generations/generation_1/cancel")
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-cancel-1",
    })
    expect(response.data.status).toBe("cancelled")
  })

  it("replays generation events with the last-event cursor", async () => {
    let capturedUrl = ""
    let capturedHeaders: HeadersInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedHeaders = init?.headers
        return new Response([
          "id: generation_1:5",
          "event: generation.generating",
          'data: {"data":{"generation_ref":"generation_1","project_ref":"project_1","status":"generating","progress":52,"candidate_refs":[]},"meta":{"request_id":"request_event_1"}}',
          "",
          "",
        ].join("\n"), { status: 200, headers: { "Content-Type": "text/event-stream" } })
      },
    })

    const events = await api.getGenerationEvents("generation_1", "generation_1:4")

    expect(capturedUrl).toBe("/api/v1/mori/generations/generation_1/events")
    expect(capturedHeaders).toEqual({
      Accept: "text/event-stream",
      "Last-Event-ID": "generation_1:4",
    })
    expect(events).toEqual([{
      id: "generation_1:5",
      event: "generation.generating",
      data: {
        generation_ref: "generation_1",
        project_ref: "project_1",
        status: "generating",
        progress: 52,
        candidate_refs: [],
      },
    }])
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

  it("reads paginated project projections through the same-origin contract", async () => {
    let capturedUrl = ""
    const api = createMoriApiClient({
      fetchImpl: async (input) => {
        capturedUrl = String(input)
        return new Response(JSON.stringify({
          data: {
            projects: [{
              project_ref: "project_1",
              title: "Morning tape",
              description: "A small room with the windows open.",
              current_version_ref: null,
              candidate_count: 0,
              last_activity_at: "2026-09-02T12:00:00.000Z",
            }],
            next_cursor: "mori_projects_1",
          },
          meta: { request_id: "request_projects_1" },
        }), { status: 200, headers: { "Content-Type": "application/json" } })
      },
    })

    const response = await api.listProjects?.({ limit: 10, cursor: "mori_projects_0" })

    expect(capturedUrl).toBe("/api/v1/mori/projects?limit=10&cursor=mori_projects_0")
    expect(response?.data.projects[0]?.project_ref).toBe("project_1")
    expect(response?.data.next_cursor).toBe("mori_projects_1")
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

  it("rejects a malformed success payload instead of trusting a type assertion", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          project_ref: "project_1",
          title: "Missing fields",
          provider_task_id: "provider-secret",
        },
        meta: { request_id: "request_invalid" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    await expect(api.getProject("project_1")).rejects.toMatchObject({
      code: "invalid_api_response",
      status: 200,
    })
  })

  it("rejects malformed generation event frames", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response([
        "id: generation_1:1",
        "event: generation.progress",
        'data: {"data":{"generation_ref":"generation_1","status":"generating"}}',
        "",
        "",
      ].join("\n"), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    })

    await expect(api.getGenerationEvents("generation_1")).rejects.toMatchObject({
      code: "invalid_api_response",
      status: 200,
    })
  })
})
