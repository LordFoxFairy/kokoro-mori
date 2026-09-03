import { describe, expect, it } from "vitest"
import { createGenerationRequest, createLyricsRevisionRequest, createStemSeparationRequest, createStudioChangeRequest } from "./mori-api"
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

  it("posts a version-bound studio change through the shared generation lifecycle", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response(JSON.stringify({
          data: { generation_ref: "generation_change_1", status: "queued" },
          meta: { request_id: "request_change_1" },
        }), { status: 202, headers: { "Content-Type": "application/json" } })
      },
    })

    const request = createStudioChangeRequest({
      operation: "replace_section",
      scope: { type: "time_range", startMs: 68_000, endMs: 96_000 },
      instruction: "  Make the chorus wider without changing its melody.  ",
      preserve: ["melody", "lyrics"],
      referenceAssetRefs: ["asset_reference_1", "asset_reference_1", "  "],
      outputCount: 2,
    })
    const response = await api.createStudioChange("version/change 1", request, "idem-change-1")

    expect(capturedUrl).toBe("/api/v1/mori/versions/version%2Fchange%201/generations")
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-change-1",
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      operation: "replace_section",
      scope: { type: "time_range", start_ms: 68_000, end_ms: 96_000 },
      instruction: "Make the chorus wider without changing its melody.",
      preserve: ["melody", "lyrics"],
      reference_asset_refs: ["asset_reference_1"],
      output_count: 2,
    })
    expect(response.data).toEqual({ generation_ref: "generation_change_1", status: "queued" })
  })

  it("reads the source and operation from a Studio generation snapshot", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          generation_ref: "generation_change_1",
          generation_kind: "studio_change",
          project_ref: "project_1",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_1",
          operation: "replace_section",
          status: "generating",
          progress: 46,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_change_snapshot_1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    const response = await api.getGeneration("generation_change_1")

    expect(response.data).toMatchObject({
      generation_kind: "studio_change",
      source_version_ref: "version_1",
      operation: "replace_section",
      mode: null,
      song_plan_ref: null,
    })
  })

  it("posts a reviewed section-aware lyrics revision", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response(JSON.stringify({
          data: { lyrics_revision_ref: "lyrics_revision_1", status: "queued" },
          meta: { request_id: "request_lyrics_revision_1" },
        }), { status: 202, headers: { "Content-Type": "application/json" } })
      },
    })

    const request = createLyricsRevisionRequest({
      direction: "rewrite",
      scope: {
        type: "section",
        sectionLabel: "Chorus",
        startLine: 1,
        endLine: 3,
        sourceText: "  and every road became a reason\nto carry the morning through  ",
      },
      instruction: "  Make the image more vivid while keeping the cadence.  ",
      lyricsContext: "  We were headlights in the quiet\nand every road became a reason\nto carry the morning through  ",
      constraints: ["meaning", "cadence", "meaning"],
      outputCount: 2,
    })
    const response = await api.createLyricsRevision("version/lyrics 1", request, "idem-lyrics-1")

    expect(capturedUrl).toBe("/api/v1/mori/versions/version%2Flyrics%201/lyrics_revisions")
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-lyrics-1",
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual({
      direction: "rewrite",
      scope: {
        type: "section",
        section_label: "Chorus",
        start_line: 1,
        end_line: 3,
        source_text: "and every road became a reason\nto carry the morning through",
      },
      instruction: "Make the image more vivid while keeping the cadence.",
      lyrics_context: "We were headlights in the quiet\nand every road became a reason\nto carry the morning through",
      constraints: ["meaning", "cadence"],
      output_count: 2,
    })
    expect(response.data).toEqual({ lyrics_revision_ref: "lyrics_revision_1", status: "queued" })
  })

  it("reads a refresh-safe lyrics revision snapshot", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          lyrics_revision_ref: "lyrics_revision_1",
          version_ref: "version_1",
          status: "succeeded",
          progress: 100,
          direction: "rewrite",
          scope: { type: "section", section_label: "Chorus", start_line: 1, end_line: 3 },
          instruction: "Make the image more vivid while keeping the cadence.",
          constraints: ["meaning", "cadence"],
          output_count: 2,
          source_digest: "sha256:lyrics-source-1",
          suggestions: [
            { suggestion_ref: "lyrics_suggestion_1", text: "Every road becomes a rhythm." },
            { suggestion_ref: "lyrics_suggestion_2", text: "Every mile opens into morning." },
          ],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_lyrics_snapshot_1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    const response = await api.getLyricsRevision("lyrics_revision_1")

    expect(response.data).toMatchObject({
      status: "succeeded",
      direction: "rewrite",
      instruction: "Make the image more vivid while keeping the cadence.",
      constraints: ["meaning", "cadence"],
      output_count: 2,
      source_digest: "sha256:lyrics-source-1",
      suggestions: [
        { suggestion_ref: "lyrics_suggestion_1", text: "Every road becomes a rhythm." },
        { suggestion_ref: "lyrics_suggestion_2", text: "Every mile opens into morning." },
      ],
    })
  })

  it("replays and cancels a lyrics revision through stable resource paths", async () => {
    const calls: Array<{ url: string; method: string | undefined; headers: HeadersInit | undefined }> = []
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        const url = String(input)
        calls.push({ url, method: init?.method, headers: init?.headers })
        if (url.endsWith("/events")) {
          return new Response([
            "id: lyrics_revision_1:3",
            "event: lyrics_revision.generating",
            'data: {"data":{"lyrics_revision_ref":"lyrics_revision_1","version_ref":"version_1","status":"generating","progress":64,"suggestion_refs":[]},"meta":{"request_id":"request_lyrics_event_1"}}',
            "",
            "",
          ].join("\n"), { status: 200, headers: { "Content-Type": "text/event-stream" } })
        }
        return new Response(JSON.stringify({
          data: { lyrics_revision_ref: "lyrics_revision_1", status: "cancelled" },
          meta: { request_id: "request_lyrics_cancel_1" },
        }), { status: 202, headers: { "Content-Type": "application/json" } })
      },
    })

    const events = await api.getLyricsRevisionEvents("lyrics_revision_1", "lyrics_revision_1:2")
    const cancelled = await api.cancelLyricsRevision("lyrics_revision_1", "idem-lyrics-cancel-1")

    expect(calls).toEqual([
      {
        url: "/api/v1/mori/lyrics_revisions/lyrics_revision_1/events",
        method: undefined,
        headers: { Accept: "text/event-stream", "Last-Event-ID": "lyrics_revision_1:2" },
      },
      {
        url: "/api/v1/mori/lyrics_revisions/lyrics_revision_1/cancel",
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-lyrics-cancel-1" },
      },
    ])
    expect(events[0]?.data).toMatchObject({ status: "generating", progress: 64 })
    expect(cancelled.data.status).toBe("cancelled")
  })

  it("rejects malformed lyrics revision drafts before sending them", () => {
    expect(() => createLyricsRevisionRequest({
      direction: "rewrite",
      scope: { type: "section", sectionLabel: "", startLine: 0, endLine: 1, sourceText: "A line" },
      instruction: "Rewrite this line",
      lyricsContext: "A line",
    })).toThrow("lyrics_revision_section_label_required")

    expect(() => createLyricsRevisionRequest({
      direction: "continue",
      scope: { type: "whole_lyrics", sourceText: "A line" },
      instruction: "   ",
      lyricsContext: "A line",
    })).toThrow("lyrics_revision_instruction_required")
  })

  it("posts a reviewed version-scoped stem separation", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return new Response(JSON.stringify({
          data: { stem_separation_ref: "stem_separation_1", status: "queued" },
          meta: { request_id: "request_stem_separation_1" },
        }), { status: 202, headers: { "Content-Type": "application/json" } })
      },
    })

    const request = createStemSeparationRequest({ mode: "auto_stems", includeMidi: true })
    const response = await api.createStemSeparation("version/stems 1", request, "idem-stems-1")

    expect(capturedUrl).toBe("/api/v1/mori/versions/version%2Fstems%201/stem_separations")
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-stems-1",
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual({ mode: "auto_stems", include_midi: true })
    expect(response.data).toEqual({ stem_separation_ref: "stem_separation_1", status: "queued" })
  })

  it("reads durable separated stem assets", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          stem_separation_ref: "stem_separation_1",
          version_ref: "version_1",
          status: "succeeded",
          progress: 100,
          mode: "vocals_instrumental",
          include_midi: false,
          source_audio_digest: "sha256:source-audio-1",
          stems: [
            { stem_ref: "stem_vocals_1", kind: "vocals", label: "Vocals", audio_asset_ref: "asset_vocals_1", waveform_asset_ref: "waveform_vocals_1", duration_seconds: 182 },
            { stem_ref: "stem_instrumental_1", kind: "instrumental", label: "Instrumental", audio_asset_ref: "asset_instrumental_1", waveform_asset_ref: "waveform_instrumental_1", duration_seconds: 182 },
          ],
          midi_asset_ref: null,
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_stem_snapshot_1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    const response = await api.getStemSeparation("stem_separation_1")

    expect(response.data).toMatchObject({
      status: "succeeded",
      mode: "vocals_instrumental",
      source_audio_digest: "sha256:source-audio-1",
      midi_asset_ref: null,
    })
    expect(response.data.stems.map((stem) => stem.kind)).toEqual(["vocals", "instrumental"])
  })

  it("replays and cancels a stem separation through stable resource paths", async () => {
    const calls: Array<{ url: string; method: string | undefined; headers: HeadersInit | undefined }> = []
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        const url = String(input)
        calls.push({ url, method: init?.method, headers: init?.headers })
        if (url.endsWith("/events")) {
          return new Response([
            "id: stem_separation_1:3",
            "event: stem_separation.separating",
            'data: {"data":{"stem_separation_ref":"stem_separation_1","version_ref":"version_1","status":"separating","progress":58,"stem_refs":[]},"meta":{"request_id":"request_stem_event_1"}}',
            "",
            "",
          ].join("\n"), { status: 200, headers: { "Content-Type": "text/event-stream" } })
        }
        return new Response(JSON.stringify({
          data: { stem_separation_ref: "stem_separation_1", status: "cancelled" },
          meta: { request_id: "request_stem_cancel_1" },
        }), { status: 202, headers: { "Content-Type": "application/json" } })
      },
    })

    const events = await api.getStemSeparationEvents("stem_separation_1", "stem_separation_1:2")
    const cancelled = await api.cancelStemSeparation("stem_separation_1", "idem-stem-cancel-1")

    expect(calls).toEqual([
      {
        url: "/api/v1/mori/stem_separations/stem_separation_1/events",
        method: undefined,
        headers: { Accept: "text/event-stream", "Last-Event-ID": "stem_separation_1:2" },
      },
      {
        url: "/api/v1/mori/stem_separations/stem_separation_1/cancel",
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-stem-cancel-1" },
      },
    ])
    expect(events[0]?.data).toMatchObject({ status: "separating", progress: 58 })
    expect(cancelled.data.status).toBe("cancelled")
  })

  it("returns the first complete stem event without waiting for the SSE connection to close", async () => {
    let streamCancelled = false
    const eventBytes = new TextEncoder().encode([
      "id: stem_separation_1:4",
      "event: stem_separation.separating",
      'data: {"data":{"stem_separation_ref":"stem_separation_1","version_ref":"version_1","status":"separating","progress":68,"stem_refs":[]},"meta":{"request_id":"request_stem_event_stream_1"}}',
      "",
      "",
    ].join("\n"))
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(eventBytes)
        },
        cancel() {
          streamCancelled = true
        },
      }), { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    })

    const result = await Promise.race([
      api.getStemSeparationEvents("stem_separation_1").then((events) => ({ kind: "events" as const, events })),
      new Promise<{ kind: "timeout" }>((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 80)),
    ])

    expect(result.kind).toBe("events")
    if (result.kind === "events") expect(result.events[0]?.data.progress).toBe(68)
    expect(streamCancelled).toBe(true)
  })

  it("rejects stem snapshots that violate mode and asset-count invariants", async () => {
    const buildStem = (index: number) => ({
      stem_ref: `stem_${index}`,
      kind: index === 0 ? "vocals" : "other",
      label: `Stem ${index}`,
      audio_asset_ref: `asset_${index}`,
      waveform_asset_ref: `waveform_${index}`,
      duration_seconds: 182,
    })
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          stem_separation_ref: "stem_separation_invalid",
          version_ref: "version_1",
          status: "succeeded",
          progress: 100,
          mode: "auto_stems",
          include_midi: false,
          source_audio_digest: "sha256:source-audio-invalid",
          stems: Array.from({ length: 13 }, (_, index) => buildStem(index)),
          midi_asset_ref: null,
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_stem_snapshot_invalid" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    await expect(api.getStemSeparation("stem_separation_invalid")).rejects.toMatchObject({ code: "invalid_api_response" })
  })

  it("rejects an invalid studio change before it reaches the API", () => {
    expect(() => createStudioChangeRequest({
      operation: "replace_section",
      scope: { type: "time_range", startMs: 96_000, endMs: 68_000 },
      instruction: "Try another chorus.",
    })).toThrow("studio_change_range_invalid")

    expect(() => createStudioChangeRequest({
      operation: "transform",
      scope: { type: "whole_version" },
      instruction: "   ",
    })).toThrow("studio_change_instruction_required")
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
