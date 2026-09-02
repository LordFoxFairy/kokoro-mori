import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriAppProvider } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { ProjectOverviewPageContent } from "./project-overview"

describe("Mori project overview", () => {
  it("uses the global player when a candidate is played", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Play First Light" }))

    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("First Light")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("hydrates the requested project and its latest candidates", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_live_1",
          title: "Window Seat",
          description: "A quiet, forward-moving sketch.",
          current_version_ref: "version_live_1",
          candidate_count: 1,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_1" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_live_1",
            generation_ref: "generation_live_1",
            version_ref: "version_live_1",
            project_ref: "project_live_1",
            title: "Window Seat",
            duration_seconds: 140,
            audio_asset_ref: "asset_live_1",
            waveform_asset_ref: "waveform_live_1",
            style_tags: ["soft motion", "close vocal"],
            created_at: "2026-09-02T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_candidates_1" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_live_1" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Window Seat" })).toBeInTheDocument())
    expect(screen.getByText("A quiet, forward-moving sketch.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute("href", "/projects/project_live_1/studio/version_live_1")
  })
})
