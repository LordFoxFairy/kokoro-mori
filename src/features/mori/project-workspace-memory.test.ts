import { describe, expect, it } from "vitest"
import type { MoriCurrentSongPlanRevision, MoriLyricsDraftRevision, MoriProjectWorkspaceMixRevision, MoriProjectWorkspaceProjection } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"
import {
  beginCurrentSongPlanSave,
  beginLyricsDraftSave,
  beginProjectWorkspaceOpenVersionSave,
  confirmProjectWorkspaceSave,
  failProjectWorkspaceSave,
  retryProjectWorkspaceSave,
} from "./project-workspace-memory"

describe("Project Workspace durable memory state", () => {
  it("saves the next Song Plan revision only after the returned workspace confirms the exact edit", () => {
    const original = workspaceProjection()
    const run = beginCurrentSongPlanSave(original, {
      prompt: "A warm, late-night track for the drive home, opening into sunrise.",
      mood: "Open · patient",
      tempo_bpm: 102,
      structure: ["Intro", "Verse", "Lift", "Chorus", "Outro"],
      instruments: ["Soft synth", "Muted guitar", "Brush drums"],
      vocal_direction: "Intimate lead vocal with a gentle lift in the chorus",
      lyrics_intent: "Small moments becoming a reason to keep going",
    }, "idem-plan-4")

    expect(run).toMatchObject({
      status: "saving",
      command: {
        kind: "song_plan",
        idempotencyKey: "idem-plan-4",
        input: { expected_revision: 3, mood: "Open · patient" },
      },
    })

    const confirmed = confirmProjectWorkspaceSave(run, workspaceProjection({
      current_song_plan: {
        ...currentSongPlan(),
        revision: 4,
        prompt: "A warm, late-night track for the drive home, opening into sunrise.",
        mood: "Open · patient",
      },
      revision_cursor: "workspace_cursor_10",
    }))

    expect(confirmed).toEqual({ status: "saved", command: null, message: null, retryable: false })
    expect(confirmProjectWorkspaceSave(run, workspaceProjection({
      current_song_plan: {
        ...currentSongPlan(),
        revision: 4,
        mood: "A stale remote edit",
      },
    }))).toMatchObject({ status: "failed", retryable: false })
    expect(confirmProjectWorkspaceSave(run, workspaceProjection({
      current_song_plan: {
        ...currentSongPlan(),
        revision: 4,
        project_ref: "project_other",
        mood: "Open · patient",
      },
    }))).toMatchObject({ status: "failed", retryable: false })
  })

  it("keeps a retryable write on the exact same idempotency identity", () => {
    const run = beginCurrentSongPlanSave(workspaceProjection(), {
      prompt: "A warm, late-night track for the drive home, slowly opening into sunrise.",
      mood: "Warm · hopeful",
      tempo_bpm: 102,
      structure: ["Intro", "Verse", "Lift", "Chorus", "Outro"],
      instruments: ["Soft synth", "Muted guitar", "Brush drums"],
      vocal_direction: "Intimate lead vocal with a gentle lift in the chorus",
      lyrics_intent: "Small moments becoming a reason to keep going",
    }, "idem-plan-retry")
    const failed = failProjectWorkspaceSave(run, new MoriApiRequestError({
      code: "mori_network_error",
      message: "Mori could not be reached",
      retryable: true,
      details: null,
    }, null, 0))

    expect(failed).toMatchObject({ status: "failed", retryable: true, command: { idempotencyKey: "idem-plan-retry" } })
    expect(retryProjectWorkspaceSave(failed)).toMatchObject({ status: "saving", command: { idempotencyKey: "idem-plan-retry" } })
  })

  it("binds a durable Lyrics Draft to the user’s Open Version rather than Project Current", () => {
    const original = workspaceProjection()
    const run = beginLyricsDraftSave(original, "version_first_light_b", { text: "Meet me where the streetlights fade\nWe can carry daylight home" }, "idem-lyrics-5")

    expect(run).toMatchObject({
      status: "saving",
      command: {
        kind: "lyrics_draft",
        versionRef: "version_first_light_b",
        input: { expected_revision: 4 },
      },
    })

    expect(confirmProjectWorkspaceSave(run, workspaceProjection({
      latest_lyrics_draft: {
        ...latestLyricsDraft(),
        revision: 5,
      },
    }))).toMatchObject({ status: "saved" })
    expect(beginLyricsDraftSave(original, "version_first_light_a", { text: "Wrong take" }, "idem-wrong-take")).toMatchObject({
      status: "failed",
      retryable: false,
    })
  })

  it("persists Open Version with its own revision and never treats it as Project Current", () => {
    const original = workspaceProjection()
    const run = beginProjectWorkspaceOpenVersionSave(original, "version_first_light_a", "idem-open-a")
    const next = workspaceProjection({
      open_version: {
        project_ref: "project_first_light",
        version_ref: "version_first_light_a",
        revision: 3,
        updated_at: "2026-09-04T18:11:00.000Z",
      },
      latest_lyrics_draft: {
        ...latestLyricsDraft(),
        version_ref: "version_first_light_a",
      },
      latest_mix_revision: {
        ...latestMixRevision(),
        version_ref: "version_first_light_a",
      },
    })

    expect(run).toMatchObject({ status: "saving", command: { kind: "open_version", input: { expected_revision: 2, version_ref: "version_first_light_a" } } })
    expect(next.project.current_version_ref).toBe("version_first_light_a")
    expect(confirmProjectWorkspaceSave(run, next)).toMatchObject({ status: "saved" })
  })
})

function workspaceProjection(overrides: Partial<MoriProjectWorkspaceProjection> = {}): MoriProjectWorkspaceProjection {
  return {
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
    latest_lyrics_draft: latestLyricsDraft(),
    latest_mix_revision: latestMixRevision(),
    active_tasks: [],
    revision_cursor: "workspace_cursor_9",
    observed_at: "2026-09-04T17:49:00.000Z",
    ...overrides,
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

function latestLyricsDraft(): MoriLyricsDraftRevision {
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

function latestMixRevision(): MoriProjectWorkspaceMixRevision {
  return {
    mix_revision_ref: "mix_revision_first_light_b",
    version_ref: "version_first_light_b",
    revision: 2,
    name: "First Light · open mix",
    track_count: 5,
    created_at: "2026-09-04T17:47:00.000Z",
  }
}
