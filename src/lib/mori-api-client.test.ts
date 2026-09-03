import { describe, expect, it } from "vitest"
import { createExportRequest, createGenerationRequest, createLyricsRevisionRequest, createMixRevisionRequest, createStemSeparationRequest, createStudioChangeRequest } from "./mori-api"
import { createMoriApiClient } from "./mori-api-client"

describe("Mori same-origin API client", () => {
  it("commits a Take as Current with exact CAS context and idempotency", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return jsonResponse({
          data: {
            project_ref: "project_1",
            current_version_ref: "version_2",
            source_candidate_ref: "candidate_2",
            previous_version_ref: "version_1",
            selected_at: "2026-09-03T19:55:00.000Z",
          },
          meta: { request_id: "request_current_version_1" },
        })
      },
    })
    const input = {
      candidate_ref: "candidate_2",
      version_ref: "version_2",
      expected_current_version_ref: "version_1",
    }

    const response = await api.putCurrentVersion("project_1", input, "idem-current-version-1")

    expect(capturedUrl).toBe("/api/v1/mori/projects/project_1/current_version")
    expect(capturedInit?.method).toBe("PUT")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-current-version-1",
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual(input)
    expect(response.data).toEqual({
      project_ref: "project_1",
      current_version_ref: "version_2",
      source_candidate_ref: "candidate_2",
      previous_version_ref: "version_1",
      selected_at: "2026-09-03T19:55:00.000Z",
    })
  })

  it("rejects malformed Current Version confirmations", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => jsonResponse({
        data: {
          project_ref: "project_1",
          current_version_ref: "version_2",
          source_candidate_ref: "candidate_2",
          previous_version_ref: 42,
          selected_at: "not-a-date",
        },
        meta: { request_id: "request_current_version_invalid" },
      }),
    })

    await expect(api.putCurrentVersion("project_1", {
      candidate_ref: "candidate_2",
      version_ref: "version_2",
      expected_current_version_ref: "version_1",
    }, "idem-current-version-invalid")).rejects.toMatchObject({ code: "invalid_api_response" })
  })

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

  it("builds a structured whole-version vocal layer command", () => {
    expect(createStudioChangeRequest({
      operation: "add_part",
      scope: { type: "whole_version" },
      partKind: "vocals",
      instruction: "  Keep the delivery close and unhurried.  ",
      lyrics: "  Meet me where the streetlights fade.  ",
      voiceRef: "  voice_preview_mira  ",
      preserve: ["melody", "tempo", "structure"],
      outputCount: 2,
    })).toEqual({
      operation: "add_part",
      scope: { type: "whole_version" },
      part_kind: "vocals",
      instruction: "Keep the delivery close and unhurried.",
      lyrics: "Meet me where the streetlights fade.",
      voice_ref: "voice_preview_mira",
      preserve: ["melody", "tempo", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })
  })

  it("builds an instrumental layer without vocal-only fields", () => {
    expect(createStudioChangeRequest({
      operation: "add_part",
      scope: { type: "whole_version" },
      partKind: "instrumental",
      instruction: "  Build warm piano and brushed drums around the vocal.  ",
      preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
      outputCount: 2,
    })).toEqual({
      operation: "add_part",
      scope: { type: "whole_version" },
      part_kind: "instrumental",
      instruction: "Build warm piano and brushed drums around the vocal.",
      lyrics: null,
      voice_ref: null,
      preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })
  })

  it("builds a typed mix-aware Remaster command", () => {
    expect(createStudioChangeRequest({
      operation: "transform",
      scope: { type: "whole_version" },
      intent: "remaster",
      source: { type: "mix_revision", mixRevisionRef: "  mix_revision_7  " },
      variationStrength: "bold",
      instruction: "  Push clarity and impact while preserving the song.  ",
      preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
      outputCount: 2,
    })).toEqual({
      operation: "transform",
      scope: { type: "whole_version" },
      intent: "remaster",
      source: { type: "mix_revision", mix_revision_ref: "mix_revision_7" },
      variation_strength: "bold",
      instruction: "Push clarity and impact while preserving the song.",
      preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })
  })

  it("builds an explicit range Restyle command with normalized anchors and references", () => {
    expect(createStudioChangeRequest({
      operation: "transform",
      intent: "restyle",
      scope: { type: "time_range", startMs: 42_000, endMs: 96_000 },
      instruction: "  Turn this passage into an intimate live-room arrangement.  ",
      preserve: ["melody", "lyrics", "melody"],
      referenceAssetRefs: ["  asset_room_1  ", "asset_room_1"],
      outputCount: 4,
    })).toEqual({
      operation: "transform",
      intent: "restyle",
      scope: { type: "time_range", start_ms: 42_000, end_ms: 96_000 },
      instruction: "Turn this passage into an intimate live-room arrangement.",
      preserve: ["melody", "lyrics"],
      reference_asset_refs: ["asset_room_1"],
      output_count: 4,
    })
  })

  it("builds a whole-song Vocal Cover with an optional reusable Voice profile", () => {
    expect(createStudioChangeRequest({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      coverMode: "vocal",
      voiceRef: "  voice_preview_mira  ",
      instruction: "  Re-perform this as a close, warm acoustic duet.  ",
      preserve: ["melody", "lyrics", "structure"],
      outputCount: 2,
    })).toEqual({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      cover_mode: "vocal",
      voice_ref: "voice_preview_mira",
      instruction: "Re-perform this as a close, warm acoustic duet.",
      preserve: ["melody", "lyrics", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })
  })

  it("builds an Instrumental Cover without vocal identity or Voice fields", () => {
    expect(createStudioChangeRequest({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      coverMode: "instrumental",
      instruction: "  Reframe the song for felt piano and chamber strings.  ",
      preserve: ["melody", "structure"],
      outputCount: 2,
    })).toEqual({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      cover_mode: "instrumental",
      voice_ref: null,
      instruction: "Reframe the song for felt piano and chamber strings.",
      preserve: ["melody", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })
  })

  it("rejects Cover commands that loosen fixed musical safeguards", () => {
    expect(() => createStudioChangeRequest({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      coverMode: "vocal",
      instruction: "Try a close vocal cover.",
      preserve: ["melody", "lyrics"],
      outputCount: 2,
    })).toThrow("studio_cover_preserve_invalid")

    expect(() => createStudioChangeRequest({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      coverMode: "instrumental",
      instruction: "Try an instrumental cover.",
      preserve: ["melody", "structure"],
      referenceAssetRefs: ["asset_duplicate_source"],
      outputCount: 4,
    })).toThrow("studio_cover_output_count_invalid")

    expect(() => createStudioChangeRequest({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      coverMode: "instrumental",
      voiceRef: "voice_preview_mira",
      instruction: "Try an instrumental cover.",
      preserve: ["melody", "structure"],
      outputCount: 2,
    })).toThrow("studio_cover_voice_invalid")

    expect(() => createStudioChangeRequest({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      coverMode: "vocal",
      instruction: "Try a vocal cover.",
      preserve: ["melody", "lyrics", "structure"],
      referenceAssetRefs: ["asset_duplicate_source"],
      outputCount: 2,
    })).toThrow("studio_cover_references_invalid")
  })

  it("requires lyrics for a whole-version vocal layer", () => {
    expect(() => createStudioChangeRequest({
      operation: "add_part",
      scope: { type: "whole_version" },
      partKind: "vocals",
      instruction: "Keep the delivery close.",
      lyrics: "   ",
    })).toThrow("studio_layer_lyrics_required")
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

  it("reads the exact Remaster source and strength from a durable generation snapshot", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          generation_ref: "generation_remaster_1",
          generation_kind: "studio_change",
          project_ref: "project_1",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_1",
          operation: "transform",
          intent: "remaster",
          source: { type: "mix_revision", mix_revision_ref: "mix_revision_7" },
          variation_strength: "bold",
          status: "generating",
          progress: 46,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_remaster_snapshot_1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    const response = await api.getGeneration("generation_remaster_1")

    expect(response.data).toMatchObject({
      generation_kind: "studio_change",
      source_version_ref: "version_1",
      operation: "transform",
      intent: "remaster",
      source: { type: "mix_revision", mix_revision_ref: "mix_revision_7" },
      variation_strength: "bold",
    })
  })

  it("reads the complete Restyle context from a durable generation snapshot", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          generation_ref: "generation_restyle_1",
          generation_kind: "studio_change",
          project_ref: "project_1",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_1",
          operation: "transform",
          intent: "restyle",
          scope: { type: "time_range", start_ms: 42_000, end_ms: 96_000 },
          instruction: "Turn this passage into an intimate live-room arrangement.",
          preserve: ["melody", "lyrics"],
          reference_asset_refs: ["asset_room_1"],
          output_count: 4,
          status: "generating",
          progress: 46,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_restyle_snapshot_1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    const response = await api.getGeneration("generation_restyle_1")

    expect(response.data).toMatchObject({
      operation: "transform",
      intent: "restyle",
      scope: { type: "time_range", start_ms: 42_000, end_ms: 96_000 },
      instruction: "Turn this passage into an intimate live-room arrangement.",
      preserve: ["melody", "lyrics"],
      reference_asset_refs: ["asset_room_1"],
      output_count: 4,
    })
  })

  it("reads the complete Cover context from a durable generation snapshot", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          generation_ref: "generation_cover_1",
          generation_kind: "studio_change",
          project_ref: "project_1",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_1",
          operation: "transform",
          intent: "cover",
          scope: { type: "whole_version" },
          cover_mode: "vocal",
          voice_ref: "voice_preview_mira",
          instruction: "Re-perform this as a close, warm acoustic duet.",
          preserve: ["melody", "lyrics", "structure"],
          reference_asset_refs: [],
          output_count: 2,
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_cover_1", "candidate_cover_2"],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_cover_snapshot_1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    const response = await api.getGeneration("generation_cover_1")

    expect(response.data).toMatchObject({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      cover_mode: "vocal",
      voice_ref: "voice_preview_mira",
      preserve: ["melody", "lyrics", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })
  })

  it("rejects partial Cover metadata instead of degrading to a generic transform", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          generation_ref: "generation_cover_invalid",
          generation_kind: "studio_change",
          project_ref: "project_1",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_1",
          operation: "transform",
          intent: "cover",
          scope: { type: "whole_version" },
          cover_mode: "vocal",
          instruction: "Try a warm acoustic cover.",
          preserve: ["melody", "lyrics", "structure"],
          reference_asset_refs: [],
          output_count: 2,
          status: "generating",
          progress: 46,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_cover_snapshot_invalid" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    await expect(api.getGeneration("generation_cover_invalid")).rejects.toMatchObject({ code: "invalid_api_response" })
  })

  it("rejects partial Remaster metadata instead of treating it as a generic transform", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          generation_ref: "generation_remaster_invalid",
          generation_kind: "studio_change",
          project_ref: "project_1",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_1",
          operation: "transform",
          intent: "remaster",
          source: { type: "version" },
          status: "generating",
          progress: 46,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_remaster_snapshot_invalid" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    await expect(api.getGeneration("generation_remaster_invalid")).rejects.toMatchObject({ code: "invalid_api_response" })
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

    const request = createStemSeparationRequest({ mode: "auto_stems", targetKinds: [], includeMidi: true })
    const response = await api.createStemSeparation("version/stems 1", request, "idem-stems-1")

    expect(capturedUrl).toBe("/api/v1/mori/versions/version%2Fstems%201/stem_separations")
    expect(capturedInit?.method).toBe("POST")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-stems-1",
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual({ mode: "auto_stems", target_kinds: [], include_midi: true })
    expect(response.data).toEqual({ stem_separation_ref: "stem_separation_1", status: "queued" })
  })

  it("builds provider-neutral isolate and custom stem requests", () => {
    expect(createStemSeparationRequest({
      mode: "isolate_part",
      targetKinds: ["vocals"],
      includeMidi: false,
    })).toEqual({
      mode: "isolate_part",
      target_kinds: ["vocals"],
      include_midi: false,
    })

    expect(createStemSeparationRequest({
      mode: "custom_stems",
      targetKinds: ["drums", "bass", "drums", "keys"],
      includeMidi: true,
    })).toEqual({
      mode: "custom_stems",
      target_kinds: ["drums", "bass", "keys"],
      include_midi: true,
    })
  })

  it("rejects mode and target combinations that do not describe one intent", () => {
    expect(() => createStemSeparationRequest({
      mode: "isolate_part",
      targetKinds: [],
      includeMidi: false,
    })).toThrow("stem_separation_target_count_invalid")

    expect(() => createStemSeparationRequest({
      mode: "auto_stems",
      targetKinds: ["vocals"],
      includeMidi: false,
    })).toThrow("stem_separation_target_count_invalid")

    expect(() => createStemSeparationRequest({
      mode: "custom_stems",
      targetKinds: ["drums", "drums"],
      includeMidi: false,
    })).toThrow("stem_separation_target_count_invalid")
  })

  it("reads a durable isolate-part snapshot with its requested target", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          stem_separation_ref: "stem_separation_1",
          version_ref: "version_1",
          status: "succeeded",
          progress: 100,
          mode: "isolate_part",
          target_kinds: ["vocals"],
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
      mode: "isolate_part",
      target_kinds: ["vocals"],
      source_audio_digest: "sha256:source-audio-1",
      midi_asset_ref: null,
    })
    expect(response.data.stems.map((stem) => stem.kind)).toEqual(["vocals", "instrumental"])
  })

  it("reads the requested targets from a custom-stems snapshot", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          stem_separation_ref: "stem_separation_custom_1",
          version_ref: "version_1",
          status: "succeeded",
          progress: 100,
          mode: "custom_stems",
          target_kinds: ["drums", "bass", "keys"],
          include_midi: false,
          source_audio_digest: "sha256:source-audio-custom-1",
          stems: [
            { stem_ref: "stem_drums_1", kind: "drums", label: "Drums", audio_asset_ref: "asset_drums_1", waveform_asset_ref: "waveform_drums_1", duration_seconds: 182 },
            { stem_ref: "stem_bass_1", kind: "bass", label: "Bass", audio_asset_ref: "asset_bass_1", waveform_asset_ref: "waveform_bass_1", duration_seconds: 182 },
            { stem_ref: "stem_keys_1", kind: "keys", label: "Keys", audio_asset_ref: "asset_keys_1", waveform_asset_ref: "waveform_keys_1", duration_seconds: 182 },
          ],
          midi_asset_ref: null,
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_stem_snapshot_custom_1" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    const response = await api.getStemSeparation("stem_separation_custom_1")

    expect(response.data.mode).toBe("custom_stems")
    expect(response.data.target_kinds).toEqual(["drums", "bass", "keys"])
  })

  it("rejects an isolate snapshot that does not return its requested part", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          stem_separation_ref: "stem_separation_wrong_target",
          version_ref: "version_1",
          status: "succeeded",
          progress: 100,
          mode: "isolate_part",
          target_kinds: ["drums"],
          include_midi: false,
          source_audio_digest: "sha256:source-audio-wrong-target",
          stems: [
            { stem_ref: "stem_vocals_1", kind: "vocals", label: "Vocals", audio_asset_ref: "asset_vocals_1", waveform_asset_ref: "waveform_vocals_1", duration_seconds: 182 },
            { stem_ref: "stem_music_1", kind: "instrumental", label: "Remaining mix", audio_asset_ref: "asset_music_1", waveform_asset_ref: "waveform_music_1", duration_seconds: 182 },
          ],
          midi_asset_ref: null,
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_stem_snapshot_wrong_target" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    await expect(api.getStemSeparation("stem_separation_wrong_target")).rejects.toMatchObject({ code: "invalid_api_response" })
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

  it("creates and reads an immutable Mix Revision through exact version-scoped fields", async () => {
    const calls: Array<{ url: string; method: string | undefined; body: unknown; headers: HeadersInit | undefined }> = []
    const revision = {
      mix_revision_ref: "mix_revision_1",
      version_ref: "version_1",
      source_stem_separation_ref: "stem_separation_1",
      name: "Close vocal mix",
      revision: 1,
      tracks: [
        { stem_ref: "stem_vocals_1", gain: 0.48, muted: false },
        { stem_ref: "stem_drums_1", gain: 1, muted: true },
      ],
      created_at: "2026-09-03T12:00:00.000Z",
    }
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
          headers: init?.headers,
        })
        return new Response(JSON.stringify({ data: revision, meta: { request_id: "request_mix_revision_1" } }), {
          status: init?.method === "POST" ? 201 : 200,
          headers: { "Content-Type": "application/json" },
        })
      },
    })
    const input = createMixRevisionRequest({
      sourceStemSeparationRef: "stem_separation_1",
      name: "  Close vocal mix  ",
      tracks: [
        { stemRef: "stem_vocals_1", gain: 0.478, muted: false },
        { stemRef: "stem_drums_1", gain: 1, muted: true },
      ],
    })

    const created = await api.createMixRevision("version_1", input, "idem-mix-revision-1")
    const restored = await api.getMixRevision(created.data.mix_revision_ref)

    expect(calls).toEqual([
      {
        url: "/api/v1/mori/versions/version_1/mix_revisions",
        method: "POST",
        body: {
          source_stem_separation_ref: "stem_separation_1",
          name: "Close vocal mix",
          tracks: [
            { stem_ref: "stem_vocals_1", gain: 0.48, muted: false },
            { stem_ref: "stem_drums_1", gain: 1, muted: true },
          ],
        },
        headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-mix-revision-1" },
      },
      { url: "/api/v1/mori/mix_revisions/mix_revision_1", method: undefined, body: null, headers: undefined },
    ])
    expect(restored.data).toEqual(revision)
  })

  it("rejects ambiguous Mix Revision tracks before write and after read", async () => {
    expect(() => createMixRevisionRequest({
      sourceStemSeparationRef: "stem_separation_1",
      name: "Mix",
      tracks: [
        { stemRef: "stem_vocals_1", gain: 1, muted: false },
        { stemRef: "stem_vocals_1", gain: 0.5, muted: true },
      ],
    })).toThrow("mix_revision_tracks_invalid")

    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          mix_revision_ref: "mix_revision_invalid",
          version_ref: "version_1",
          source_stem_separation_ref: "stem_separation_1",
          name: "Invalid mix",
          revision: 1,
          tracks: [{ stem_ref: "stem_vocals_1", gain: 1.4, muted: false }],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_mix_revision_invalid" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    await expect(api.getMixRevision("mix_revision_invalid")).rejects.toMatchObject({ code: "invalid_api_response" })
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
          target_kinds: [],
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
      intent: "restyle",
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

  it("queues and reads a mix-aware full-song export through the Mori contract", async () => {
    const calls: Array<{ url: string; method: string | undefined; body: unknown; headers: HeadersInit | undefined }> = []
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
          headers: init?.headers,
        })
        const isCreate = init?.method === "POST"
        return new Response(JSON.stringify(isCreate ? {
          data: { export_ref: "export_1", status: "queued" },
          meta: { request_id: "request_4" },
        } : {
          data: {
            export_ref: "export_1",
            project_ref: "project_preview_first_light",
            version_ref: "version_preview_first_light_a",
            source: { type: "mix_revision", mix_revision_ref: "mix_revision_7" },
            scope: { type: "full_song" },
            format: "wav",
            status: "succeeded",
            download_url: "https://download.kokoro.invalid/export_1.wav",
            created_at: "2026-09-02T12:00:00.000Z",
          },
          meta: { request_id: "request_5" },
        }), { status: isCreate ? 202 : 200, headers: { "Content-Type": "application/json" } })
      },
    })

    const input = createExportRequest({
      source: { type: "mix_revision", mixRevisionRef: "  mix_revision_7  " },
      scope: { type: "full_song" },
      format: "wav",
    })
    const receipt = await api.createExport("version_preview_first_light_a", input, "idem-export-1")
    const snapshot = await api.getExport(receipt.data.export_ref)

    expect(calls).toEqual([
      {
        url: "/api/v1/mori/versions/version_preview_first_light_a/exports",
        method: "POST",
        body: {
          source: { type: "mix_revision", mix_revision_ref: "mix_revision_7" },
          scope: { type: "full_song" },
          format: "wav",
        },
        headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-export-1" },
      },
      { url: "/api/v1/mori/exports/export_1", method: undefined, body: null, headers: undefined },
    ])
    expect(snapshot.data).toMatchObject({
      source: { type: "mix_revision", mix_revision_ref: "mix_revision_7" },
      scope: { type: "full_song" },
      format: "wav",
      download_url: "https://download.kokoro.invalid/export_1.wav",
    })
  })

  it("creates, reads, replays, and cancels a version-bound artwork generation", async () => {
    const calls: Array<{ url: string; method: string | undefined; headers: HeadersInit | undefined; body: unknown }> = []
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        const url = String(input)
        calls.push({
          url,
          method: init?.method,
          headers: init?.headers,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        })
        if (url.endsWith("/events")) {
          return new Response([
            "id: artwork_generation_1:4",
            "event: artwork_generation.generating",
            'data: {"data":{"artwork_generation_ref":"artwork_generation_1","version_ref":"version_1","status":"generating","progress":64,"artwork_candidate_refs":[]},"meta":{"request_id":"request_artwork_event_1"}}',
            "",
            "",
          ].join("\n"), { status: 200, headers: { "Content-Type": "text/event-stream" } })
        }
        if (url.endsWith("/cancel")) {
          return jsonResponse({ data: { artwork_generation_ref: "artwork_generation_1", status: "cancelled" }, meta: { request_id: "request_artwork_cancel_1" } }, 202)
        }
        if (init?.method === "POST") {
          return jsonResponse({ data: { artwork_generation_ref: "artwork_generation_1", status: "queued" }, meta: { request_id: "request_artwork_create_1" } }, 202)
        }
        return jsonResponse({
          data: {
            artwork_generation_ref: "artwork_generation_1",
            version_ref: "version_1",
            status: "succeeded",
            progress: 100,
            prompt: "Dawn reflected in rain",
            style: "illustrated",
            palette: "violet_night",
            aspect_ratio: "1:1",
            text_policy: "no_text",
            output_count: 4,
            candidates: Array.from({ length: 4 }, (_, index) => ({
              artwork_candidate_ref: `artwork_candidate_${index + 1}`,
              image_asset_ref: `asset_artwork_${index + 1}`,
              thumbnail_asset_ref: `asset_artwork_thumb_${index + 1}`,
              alt_text: `Purple dawn concept ${index + 1}`,
            })),
            created_at: "2026-09-03T12:00:00.000Z",
          },
          meta: { request_id: "request_artwork_snapshot_1" },
        })
      },
    })
    const input = {
      prompt: "Dawn reflected in rain",
      style: "illustrated" as const,
      palette: "violet_night" as const,
      aspect_ratio: "1:1" as const,
      text_policy: "no_text" as const,
      output_count: 4 as const,
    }

    const receipt = await api.createArtworkGeneration("version_1", input, "idem-artwork-1")
    const snapshot = await api.getArtworkGeneration(receipt.data.artwork_generation_ref)
    const events = await api.getArtworkGenerationEvents(receipt.data.artwork_generation_ref, "artwork_generation_1:3")
    const cancelled = await api.cancelArtworkGeneration(receipt.data.artwork_generation_ref, "idem-artwork-cancel-1")

    expect(calls).toEqual([
      {
        url: "/api/v1/mori/versions/version_1/artwork_generations",
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-artwork-1" },
        body: input,
      },
      { url: "/api/v1/mori/artwork_generations/artwork_generation_1", method: undefined, headers: undefined, body: null },
      {
        url: "/api/v1/mori/artwork_generations/artwork_generation_1/events",
        method: undefined,
        headers: { Accept: "text/event-stream", "Last-Event-ID": "artwork_generation_1:3" },
        body: null,
      },
      {
        url: "/api/v1/mori/artwork_generations/artwork_generation_1/cancel",
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-artwork-cancel-1" },
        body: null,
      },
    ])
    expect(snapshot.data.candidates[0]?.image_asset_ref).toBe("asset_artwork_1")
    expect(events[0]?.data.progress).toBe(64)
    expect(cancelled.data.status).toBe("cancelled")
  })

  it("reads and saves an optimistic release draft without publishing it", async () => {
    const calls: Array<{ url: string; method: string | undefined; headers: HeadersInit | undefined; body: unknown }> = []
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method,
          headers: init?.headers,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        })
        const revision = init?.method === "PUT" ? 3 : 2
        return jsonResponse({
          data: {
            release_draft_ref: "release_draft_1",
            version_ref: "version_1",
            revision,
            state: "draft",
            title: "First Light",
            description: "A quiet ride toward morning.",
            visibility: "public",
            allow_remix: false,
            explicit_content: false,
            artwork: { type: "artwork_candidate", artwork_candidate_ref: "artwork_candidate_2" },
            updated_at: "2026-09-03T12:00:00.000Z",
          },
          meta: { request_id: `request_release_${revision}` },
        })
      },
    })
    const input = {
      title: "First Light",
      description: "A quiet ride toward morning.",
      visibility: "public" as const,
      allow_remix: false,
      explicit_content: false,
      artwork: { type: "artwork_candidate" as const, artwork_candidate_ref: "artwork_candidate_2" },
      expected_revision: 2,
    }

    const current = await api.getReleaseDraft("version_1")
    const saved = await api.putReleaseDraft("version_1", input, "idem-release-1")

    expect(calls).toEqual([
      { url: "/api/v1/mori/versions/version_1/release_draft", method: undefined, headers: undefined, body: null },
      {
        url: "/api/v1/mori/versions/version_1/release_draft",
        method: "PUT",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-release-1" },
        body: input,
      },
    ])
    expect(current.data).toMatchObject({ revision: 2, state: "draft" })
    expect(saved.data).toMatchObject({ revision: 3, visibility: "public", allow_remix: false, state: "draft" })
  })

  it("rejects an empty Mix Revision source and contradictory export results", async () => {
    expect(() => createExportRequest({
      source: { type: "mix_revision", mixRevisionRef: "   " },
      scope: { type: "full_song" },
      format: "mp3",
    })).toThrow("export_mix_revision_required")

    const api = createMoriApiClient({
      fetchImpl: async () => new Response(JSON.stringify({
        data: {
          export_ref: "export_invalid",
          project_ref: "project_preview_first_light",
          version_ref: "version_preview_first_light_a",
          source: { type: "version" },
          scope: { type: "full_song" },
          format: "mp3",
          status: "succeeded",
          download_url: null,
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_export_invalid" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    })

    await expect(api.getExport("export_invalid")).rejects.toMatchObject({ code: "invalid_api_response" })
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

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } })
}
