import { render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriAppProvider } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { ProjectOverviewPageContent } from "./project-overview"
import type { MoriProjectWorkspaceProjection } from "@/lib/mori-api"

describe("Project Overview durable workspace projection", () => {
  it("shows the saved Song Plan from the coherent workspace projection instead of a preview plan", async () => {
    const api = {
      getProject: async () => projectResponse(),
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_live_b",
            generation_ref: "generation_live_b",
            version_ref: "version_live_b",
            project_ref: "project_live_memory",
            title: "Window Seat · Wide",
            duration_seconds: 146,
            audio_asset_ref: "asset_live_b",
            waveform_asset_ref: "waveform_live_b",
            style_tags: ["wide", "patient"],
            created_at: "2026-09-04T18:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_candidates_live_memory" },
      }),
      getProjectWorkspace: async () => ({
        data: {
          project: projectResponse().data,
          current_song_plan: {
            song_plan_ref: "song_plan_live_memory",
            project_ref: "project_live_memory",
            revision: 3,
            prompt: "A quiet rail journey opening into a clear morning.",
            mood: "Boreal · patient",
            tempo_bpm: 88,
            structure: ["Intro", "Verse", "Chorus", "Coda"],
            instruments: ["Felt piano", "Soft strings"],
            vocal_direction: "A close voice, gradually widening at the chorus",
            lyrics_intent: "A remembered conversation becoming a new beginning",
            created_at: "2026-09-04T18:03:00.000Z",
          },
          open_version: {
            project_ref: "project_live_memory",
            version_ref: "version_live_b",
            revision: 2,
            updated_at: "2026-09-04T18:04:00.000Z",
          },
          latest_lyrics_draft: null,
          latest_mix_revision: null,
          active_tasks: liveActiveTasks(),
          revision_cursor: "workspace_cursor_live_memory_3",
          observed_at: "2026-09-04T18:05:00.000Z",
        },
        meta: { request_id: "request_workspace_live_memory" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_live_memory" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Window Seat" })).toBeInTheDocument())
    const songPlan = screen.getByRole("region", { name: "Song plan" })
    await within(songPlan).findByText("Boreal · patient")
    expect(within(songPlan).getByText("88 BPM")).toBeInTheDocument()
    expect(within(songPlan).getByText("Revision 3 · saved")).toBeInTheDocument()
    expect(within(songPlan).getByText("Felt piano · Soft strings")).toBeInTheDocument()
    expect(within(songPlan).queryByText("Warm · hopeful")).not.toBeInTheDocument()
    const activeWork = screen.getByRole("region", { name: "In progress" })
    expect(within(activeWork).getByRole("link", { name: "Resume Generate directions" })).toHaveAttribute(
      "href",
      "/create?project_ref=project_live_memory&generation_ref=generation_live_memory",
    )
    expect(within(activeWork).getByRole("link", { name: "Resume Rewrite lyrics" })).toHaveAttribute(
      "href",
      "/projects/project_live_memory/studio/version_live_b?surface=lyrics",
    )
    expect(within(activeWork).getByRole("progressbar", { name: "Generate directions progress" })).toHaveAttribute("aria-valuenow", "32")
  })
})

function projectResponse() {
  return {
    data: {
      project_ref: "project_live_memory",
      title: "Window Seat",
      description: "A quiet, forward-moving sketch.",
      current_version_ref: "version_live_b",
      candidate_count: 1,
      last_activity_at: "2026-09-04T18:00:00.000Z",
    },
    meta: { request_id: "request_project_live_memory" },
  }
}

function liveActiveTasks(): MoriProjectWorkspaceProjection["active_tasks"] {
  return [
    {
      task_ref: "generation_live_memory",
      kind: "generation",
      project_ref: "project_live_memory",
      version_ref: null,
      status: "running",
      progress: 32,
      updated_at: "2026-09-04T18:04:30.000Z",
    },
    {
      task_ref: "lyrics_revision_live_memory",
      kind: "lyrics_revision",
      project_ref: "project_live_memory",
      version_ref: "version_live_b",
      status: "queued",
      progress: 0,
      updated_at: "2026-09-04T18:04:45.000Z",
    },
  ]
}
