import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriApi, MoriProjectWorkspaceProjection } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"
import { useStudioProjectWorkspaceMemory } from "./use-studio-project-workspace-memory"

type WorkspaceApi = Partial<Pick<MoriApi, "getProjectWorkspace" | "putLyricsDraft" | "putProjectWorkspaceOpenVersion">>

describe("useStudioProjectWorkspaceMemory", () => {
  it("retries the exact Version-bound Lyrics Draft command and accepts only its confirmed projection", async () => {
    const idempotencyKeys: string[] = []
    const putLyricsDraft = vi.fn<MoriApi["putLyricsDraft"]>(async (_versionRef, _input, idempotencyKey) => {
      idempotencyKeys.push(idempotencyKey)
      if (idempotencyKeys.length === 1) {
        throw new MoriApiRequestError({
          code: "mori_network_error",
          message: "Mori could not be reached",
          retryable: true,
          details: null,
        }, null, 0)
      }
      return { data: workspaceProjection({ latest_lyrics_draft: lyricsDraft(5, "A new chorus") }), meta: { request_id: "request_lyrics_5" } }
    })
    render(<WorkspaceMemoryHarness api={{
      getProjectWorkspace: async () => ({ data: workspaceProjection(), meta: { request_id: "request_workspace" } }),
      putLyricsDraft,
    }} />)

    await waitFor(() => expect(screen.getByLabelText("workspace run")).toHaveTextContent("idle"))
    fireEvent.click(screen.getByRole("button", { name: "Save lyrics" }))
    await waitFor(() => expect(screen.getByLabelText("workspace run")).toHaveTextContent("failed"))
    expect(putLyricsDraft).toHaveBeenCalledWith("version_first_light_b", { text: "A new chorus", expected_revision: 4 }, expect.any(String))

    fireEvent.click(screen.getByRole("button", { name: "Retry workspace save" }))
    await waitFor(() => expect(screen.getByLabelText("workspace run")).toHaveTextContent("saved"))
    expect(idempotencyKeys).toHaveLength(2)
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0])
    await waitFor(() => expect(screen.getByLabelText("workspace lyrics")).toHaveTextContent("A new chorus"))
  })

  it("persists the explicit Studio Version as Open before it permits its Lyrics Draft to save", async () => {
    const putProjectWorkspaceOpenVersion = vi.fn<MoriApi["putProjectWorkspaceOpenVersion"]>(async (_projectRef, input) => ({
      data: workspaceProjection({
        open_version: {
          project_ref: "project_first_light",
          version_ref: input.version_ref,
          revision: 8,
          updated_at: "2026-09-04T18:10:00.000Z",
        },
        latest_lyrics_draft: lyricsDraft(1, "The explicit route wins."),
      }),
      meta: { request_id: "request_open_b" },
    }))
    render(<WorkspaceMemoryHarness api={{
      getProjectWorkspace: async () => ({
        data: workspaceProjection({
          open_version: {
            project_ref: "project_first_light",
            version_ref: "version_first_light_a",
            revision: 7,
            updated_at: "2026-09-04T18:09:00.000Z",
          },
          latest_lyrics_draft: null,
          latest_mix_revision: null,
        }),
        meta: { request_id: "request_workspace_open_a" },
      }),
      putProjectWorkspaceOpenVersion,
    }} />)

    await waitFor(() => expect(putProjectWorkspaceOpenVersion).toHaveBeenCalledWith(
      "project_first_light",
      { version_ref: "version_first_light_b", expected_revision: 7 },
      expect.any(String),
    ))
    await waitFor(() => expect(screen.getByLabelText("workspace run")).toHaveTextContent("saved"))
    expect(screen.getByLabelText("workspace lyrics")).toHaveTextContent("The explicit route wins.")
  })

  it("does not accept a completed save from a Version that is no longer open", async () => {
    let resolveSave: ((value: Awaited<ReturnType<MoriApi["putLyricsDraft"]>>) => void) | undefined
    const saveRequest = new Promise<Awaited<ReturnType<MoriApi["putLyricsDraft"]>>>((resolve) => {
      resolveSave = resolve
    })
    const putLyricsDraft = vi.fn<MoriApi["putLyricsDraft"]>(() => saveRequest)
    const api = {
      getProjectWorkspace: async () => ({
        data: workspaceProjection({ revision_cursor: "workspace_cursor_before_switch" }),
        meta: { request_id: "request_workspace_before_switch" },
      }),
      putLyricsDraft,
    }
    const view = render(<WorkspaceMemoryHarness api={api} />)

    await waitFor(() => expect(screen.getByLabelText("workspace run")).toHaveTextContent("idle"))
    fireEvent.click(screen.getByRole("button", { name: "Save lyrics" }))
    await waitFor(() => expect(putLyricsDraft).toHaveBeenCalledOnce())

    view.rerender(<WorkspaceMemoryHarness api={api} activeVersionRef="version_first_light_c" />)
    resolveSave?.({
      data: workspaceProjection({
        latest_lyrics_draft: lyricsDraft(5, "A late save for Version B"),
        revision_cursor: "workspace_cursor_late_save",
      }),
      meta: { request_id: "request_late_save" },
    })

    await waitFor(() => expect(screen.getByLabelText("workspace run")).toHaveTextContent("idle"))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.getByLabelText("workspace cursor")).toHaveTextContent("workspace_cursor_before_switch")
    expect(screen.getByLabelText("workspace lyrics")).toHaveTextContent("no lyrics")
  })
})

function WorkspaceMemoryHarness({ api, activeVersionRef = "version_first_light_b" }: { api: WorkspaceApi; activeVersionRef?: string }) {
  const memory = useStudioProjectWorkspaceMemory({
    projectRef: "project_first_light",
    activeVersionRef,
    api,
  })
  return <>
    <output aria-label="workspace run">{memory.saveRun.status}</output>
    <output aria-label="workspace lyrics">{memory.lyricsDraft?.text ?? "no lyrics"}</output>
    <output aria-label="workspace cursor">{memory.projection?.revision_cursor ?? "no workspace"}</output>
    <button type="button" onClick={() => memory.saveLyrics("A new chorus")}>Save lyrics</button>
    <button type="button" onClick={memory.retrySave}>Retry workspace save</button>
  </>
}

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
    current_song_plan: null,
    open_version: {
      project_ref: "project_first_light",
      version_ref: "version_first_light_b",
      revision: 2,
      updated_at: "2026-09-04T17:45:00.000Z",
    },
    latest_lyrics_draft: lyricsDraft(4, "Meet me where the streetlights fade"),
    latest_mix_revision: null,
    active_tasks: [],
    revision_cursor: "workspace_cursor_first_light_9",
    observed_at: "2026-09-04T17:49:00.000Z",
    ...overrides,
  }
}

function lyricsDraft(revision: number, text: string) {
  return {
    lyrics_draft_ref: "lyrics_draft_first_light_b",
    project_ref: "project_first_light",
    version_ref: "version_first_light_b",
    revision,
    text,
    source_digest: `lyrics-digest-first-light-b-${revision}`,
    updated_at: "2026-09-04T17:46:00.000Z",
  }
}
