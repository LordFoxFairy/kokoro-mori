import { describe, expect, it } from "vitest"
import type { MoriCurrentSongPlanRevision, MoriLyricsDraftRevision, MoriProjectWorkspaceProjection } from "./mori-api"
import { createMoriApiClient } from "./mori-api-client"

describe("Mori Project Workspace same-origin API client", () => {
  it("reads one coherent recovery projection from the Project workspace route", async () => {
    let capturedUrl = ""
    const api = createMoriApiClient({
      fetchImpl: async (input) => {
        capturedUrl = String(input)
        return jsonResponse(workspaceProjection())
      },
    })

    const response = await api.getProjectWorkspace("project_first_light")

    expect(capturedUrl).toBe("/api/v1/mori/projects/project_first_light/workspace")
    expect(response.data.project.project_ref).toBe("project_first_light")
    expect(response.data.current_song_plan?.revision).toBe(3)
    expect(response.data.open_version?.version_ref).toBe("version_first_light_b")
    expect(response.data.latest_lyrics_draft?.revision).toBe(4)
    expect(response.data.latest_mix_revision?.track_count).toBe(5)
  })

  it("saves a Song Plan with a revision condition and reconciles through the workspace projection", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        capturedUrl = String(input)
        capturedInit = init
        return jsonResponse(workspaceProjection({
          current_song_plan: {
            ...currentSongPlan(),
            revision: 4,
            mood: "Open · patient",
          },
        }))
      },
    })
    const input = {
      prompt: "A warm, late-night track for the drive home, slowly opening into sunrise.",
      mood: "Open · patient",
      tempo_bpm: 102,
      structure: ["Intro", "Verse", "Lift", "Chorus", "Outro"],
      instruments: ["Soft synth", "Muted guitar", "Brush drums"],
      vocal_direction: "Intimate lead vocal with a gentle lift in the chorus",
      lyrics_intent: "Small moments becoming a reason to keep going",
      expected_revision: 3,
    }

    const response = await api.putCurrentSongPlan("project_first_light", input, "idem-song-plan-4")

    expect(capturedUrl).toBe("/api/v1/mori/projects/project_first_light/song_plan")
    expect(capturedInit?.method).toBe("PUT")
    expect(capturedInit?.headers).toEqual({
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-song-plan-4",
    })
    expect(JSON.parse(String(capturedInit?.body))).toEqual(input)
    expect(response.data.current_song_plan).toMatchObject({ project_ref: "project_first_light", revision: 4, mood: "Open · patient" })
  })

  it("keeps Lyrics Draft and Open Version writes on their distinct resources", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = []
    const api = createMoriApiClient({
      fetchImpl: async (input, init) => {
        requests.push({ url: String(input), init })
        return jsonResponse(workspaceProjection())
      },
    })

    await api.putLyricsDraft("version_first_light_b", { text: "A new chorus", expected_revision: 4 }, "idem-lyrics-5")
    await api.putProjectWorkspaceOpenVersion("project_first_light", { version_ref: "version_first_light_b", expected_revision: 2 }, "idem-open-b")

    expect(requests).toEqual([
      {
        url: "/api/v1/mori/versions/version_first_light_b/lyrics_draft",
        init: expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-lyrics-5" },
          body: JSON.stringify({ text: "A new chorus", expected_revision: 4 }),
        }),
      },
      {
        url: "/api/v1/mori/projects/project_first_light/workspace/open_version",
        init: expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json", "Idempotency-Key": "idem-open-b" },
          body: JSON.stringify({ version_ref: "version_first_light_b", expected_revision: 2 }),
        }),
      },
    ])
  })

  it("rejects a workspace response that attaches a Lyrics Draft to another Project", async () => {
    const api = createMoriApiClient({
      fetchImpl: async () => jsonResponse(workspaceProjection({
        latest_lyrics_draft: {
          ...lyricsDraft(),
          project_ref: "project_other",
        },
      })),
    })

    await expect(api.getProjectWorkspace("project_first_light")).rejects.toMatchObject({ code: "invalid_api_response" })
  })
})

function workspaceProjection(overrides: Partial<MoriProjectWorkspaceProjection> = {}): { data: MoriProjectWorkspaceProjection; meta: { request_id: string } } {
  return {
    data: {
      project: {
        project_ref: "project_first_light",
        title: "First Light",
        description: "A bright, patient song about finding your way home.",
        current_version_ref: "version_first_light_a",
        candidate_count: 2,
        last_activity_at: "2026-09-04T18:00:00.000Z",
      },
      current_song_plan: currentSongPlan(),
      open_version: {
        project_ref: "project_first_light",
        version_ref: "version_first_light_b",
        revision: 2,
        updated_at: "2026-09-04T17:45:00.000Z",
      },
      latest_lyrics_draft: lyricsDraft(),
      latest_mix_revision: {
        mix_revision_ref: "mix_revision_first_light_b",
        version_ref: "version_first_light_b",
        revision: 2,
        name: "First Light · open mix",
        track_count: 5,
        created_at: "2026-09-04T17:47:00.000Z",
      },
      active_tasks: [
        {
          task_ref: "task_generation_first_light_c",
          kind: "generation",
          project_ref: "project_first_light",
          version_ref: "version_first_light_b",
          status: "running",
          progress: 48,
          updated_at: "2026-09-04T17:48:00.000Z",
        },
      ],
      revision_cursor: "workspace_cursor_first_light_9",
      observed_at: "2026-09-04T17:49:00.000Z",
      ...overrides,
    },
    meta: { request_id: "request_workspace_first_light" },
  }
}

function currentSongPlan(): MoriCurrentSongPlanRevision {
  return {
    song_plan_ref: "song_plan_first_light",
    project_ref: "project_first_light",
    revision: 3,
    prompt: "A warm, late-night track for the drive home, slowly opening into sunrise.",
    mood: "Warm · hopeful",
    tempo_bpm: 102,
    structure: ["Intro", "Verse", "Lift", "Chorus", "Outro"],
    instruments: ["Soft synth", "Muted guitar", "Brush drums"],
    vocal_direction: "Intimate lead vocal with a gentle lift in the chorus",
    lyrics_intent: "Small moments becoming a reason to keep going",
    created_at: "2026-09-04T17:20:00.000Z",
  }
}

function lyricsDraft(): MoriLyricsDraftRevision {
  return {
    lyrics_draft_ref: "lyrics_draft_first_light_b",
    project_ref: "project_first_light",
    version_ref: "version_first_light_b",
    revision: 4,
    text: "Meet me where the streetlights fade\nWe can carry daylight home",
    source_digest: "lyrics-digest-first-light-b-4",
    updated_at: "2026-09-04T17:46:00.000Z",
  }
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } })
}
