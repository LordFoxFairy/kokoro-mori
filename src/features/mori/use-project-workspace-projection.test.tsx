import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriApi, MoriProjectWorkspaceProjection } from "@/lib/mori-api"
import { useProjectWorkspaceProjection } from "./use-project-workspace-projection"

type GetProjectWorkspace = Pick<MoriApi, "getProjectWorkspace">["getProjectWorkspace"]

describe("useProjectWorkspaceProjection", () => {
  it("does not let a late workspace response from a previous Project overwrite the active one", async () => {
    const pending = new Map<string, (value: Awaited<ReturnType<GetProjectWorkspace>>) => void>()
    const getProjectWorkspace = vi.fn<GetProjectWorkspace>((projectRef) => new Promise((resolve) => {
      pending.set(projectRef, resolve)
    }))
    const view = render(<WorkspaceHarness projectRef="project_a" getProjectWorkspace={getProjectWorkspace} />)

    expect(screen.getByLabelText("workspace status")).toHaveTextContent("loading:project_a")
    view.rerender(<WorkspaceHarness projectRef="project_b" getProjectWorkspace={getProjectWorkspace} />)
    expect(screen.getByLabelText("workspace status")).toHaveTextContent("loading:project_b")

    await act(async () => {
      pending.get("project_a")?.({ data: projection("project_a"), meta: { request_id: "request_a" } })
    })
    expect(screen.getByLabelText("workspace status")).toHaveTextContent("loading:project_b")

    await act(async () => {
      pending.get("project_b")?.({ data: projection("project_b"), meta: { request_id: "request_b" } })
    })
    await waitFor(() => expect(screen.getByLabelText("workspace status")).toHaveTextContent("ready:project_b"))
  })

  it("reports unavailable without starting a request when no same-origin projection is configured", () => {
    render(<WorkspaceHarness projectRef="project_a" />)
    expect(screen.getByLabelText("workspace status")).toHaveTextContent("unavailable:project_a")
  })
})

function WorkspaceHarness({ projectRef, getProjectWorkspace }: {
  projectRef: string
  getProjectWorkspace?: GetProjectWorkspace
}) {
  const state = useProjectWorkspaceProjection(projectRef, getProjectWorkspace)
  return <output aria-label="workspace status">{`${state.status}:${state.projectRef}`}</output>
}

function projection(projectRef: string): MoriProjectWorkspaceProjection {
  return {
    project: {
      project_ref: projectRef,
      title: "First Light",
      description: "A Project workspace.",
      current_version_ref: null,
      candidate_count: 0,
      last_activity_at: "2026-09-04T18:00:00.000Z",
    },
    current_song_plan: null,
    open_version: null,
    latest_lyrics_draft: null,
    latest_mix_revision: null,
    active_tasks: [],
    revision_cursor: `workspace_${projectRef}`,
    observed_at: "2026-09-04T18:00:00.000Z",
  }
}
