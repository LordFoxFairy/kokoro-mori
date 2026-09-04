import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriAppProvider } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { ProjectOverviewPageContent } from "./project-overview"

describe("Mori project overview", () => {
  it("continues the confirmed Current Version through project-scoped AI intents", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    const continuation = screen.getByRole("region", { name: "Continue making" })
    expect(within(continuation).getByRole("link", { name: "Transform song" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=arrangement&intent=transform",
    )
    expect(within(continuation).getByRole("link", { name: "Write lyrics" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=lyrics",
    )
    expect(within(continuation).getByRole("link", { name: "Voice and stems" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=stems",
    )
    expect(within(continuation).getByRole("link", { name: "Finish song" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=finish",
    )
  })

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
    expect(screen.queryByText("Warm · hopeful")).not.toBeInTheDocument()
    const songPlan = screen.getByRole("region", { name: "Song plan" })
    expect(within(songPlan).getByText("Plan details not available")).toBeInTheDocument()
    expect(within(songPlan).queryByText("102 BPM")).not.toBeInTheDocument()
  })

  it("continues from the confirmed Current Version instead of the first projected direction", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_live_current",
          title: "Window Seat",
          description: "Two directions with one confirmed Current.",
          current_version_ref: "version_live_b",
          candidate_count: 2,
          last_activity_at: "2026-09-04T10:00:00.000Z",
        },
        meta: { request_id: "request_project_current" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [
            {
              candidate_ref: "candidate_live_a",
              generation_ref: "generation_live",
              version_ref: "version_live_a",
              project_ref: "project_live_current",
              title: "Window Seat · First draft",
              duration_seconds: 140,
              audio_asset_ref: "asset_live_a",
              waveform_asset_ref: "waveform_live_a",
              style_tags: ["quiet"],
              created_at: "2026-09-04T09:58:00.000Z",
            },
            {
              candidate_ref: "candidate_live_b",
              generation_ref: "generation_live",
              version_ref: "version_live_b",
              project_ref: "project_live_current",
              title: "Window Seat · Wide",
              duration_seconds: 146,
              audio_asset_ref: "asset_live_b",
              waveform_asset_ref: "waveform_live_b",
              style_tags: ["wide"],
              created_at: "2026-09-04T09:59:00.000Z",
            },
          ],
          next_cursor: null,
        },
        meta: { request_id: "request_candidates_current" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_live_current" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute(
      "href",
      "/projects/project_live_current/studio/version_live_b",
    ))
    expect(screen.getByRole("article", { name: "Window Seat · Wide, current version" })).toHaveTextContent("Current")
    expect(screen.getByRole("article", { name: "Window Seat · First draft" })).not.toHaveTextContent("Current")
  })

  it("shows an empty state when a project has no directions", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_empty_1",
          title: "Rain Room",
          description: "A small room of reflected light.",
          current_version_ref: null,
          candidate_count: 0,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_empty" },
      }),
      listCandidates: async () => ({
        data: { candidates: [], next_cursor: null },
        meta: { request_id: "request_candidates_empty" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_empty_1" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Rain Room" })).toBeInTheDocument())
    expect(screen.getByText("No directions yet")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Create a direction" })).toHaveAttribute("href", "/create?project_ref=project_empty_1")
    expect(screen.queryByRole("link", { name: "Open Studio" })).not.toBeInTheDocument()
  })

  it("does not guess a continuation Version when candidates exist without a confirmed Current", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_unconfirmed_1",
          title: "Loose Ends",
          description: "Promising directions waiting for a decision.",
          current_version_ref: null,
          candidate_count: 1,
          last_activity_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_project_unconfirmed" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_unconfirmed_1",
            generation_ref: "generation_unconfirmed_1",
            version_ref: "version_unconfirmed_1",
            project_ref: "project_unconfirmed_1",
            title: "Loose Ends · Draft",
            duration_seconds: 156,
            audio_asset_ref: "asset_unconfirmed_1",
            waveform_asset_ref: "waveform_unconfirmed_1",
            style_tags: ["patient", "open"],
            created_at: "2026-09-04T11:59:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_candidates_unconfirmed" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_unconfirmed_1" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Loose Ends" })).toBeInTheDocument())
    expect(screen.queryByRole("region", { name: "Continue making" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open Studio" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Studio for Loose Ends · Draft" })).toHaveAttribute(
      "href",
      "/projects/project_unconfirmed_1/studio/version_unconfirmed_1",
    )
  })

  it("keeps the live project when its candidate projection is temporarily unavailable", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_live_partial",
          title: "Blue Hour",
          description: "A restrained electronic study.",
          current_version_ref: null,
          candidate_count: 0,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_partial" },
      }),
      listCandidates: async () => {
        throw new Error("candidate projection unavailable")
      },
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_live_partial" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Blue Hour" })).toBeInTheDocument())
    expect(screen.getByText("A restrained electronic study.")).toBeInTheDocument()
    expect(screen.getByText("No directions yet")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open Studio" })).not.toBeInTheDocument()
    const player = screen.getByRole("region", { name: "Global player" })
    expect(player).toHaveTextContent("Nothing playing")
    expect(player).toHaveTextContent("No version selected")
  })
})
