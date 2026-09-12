import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriApi } from "@/lib/mori-api"
import { MoriAppProvider } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { HomePageContent } from "./home-page"

describe("Mori home page", () => {
  it("labels the preview when the workspace projection is unavailable and retries it", async () => {
    const listProjects = vi.fn<MoriApi["listProjects"]>()
      .mockRejectedValueOnce(new Error("workspace unavailable"))
      .mockResolvedValueOnce({
        data: {
          projects: [{
            project_ref: "project_recovered_home",
            title: "Recovered Light",
            description: "A live project after retry.",
            current_version_ref: null,
            candidate_count: 0,
            last_activity_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_home_recovered" },
      })

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="home" ariaLabel="Home">
          <HomePageContent api={{ listProjects, listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_home_candidates_empty" } }) }} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(screen.getByText("Preview workspace")).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }))

    await waitFor(() => expect(screen.getByRole("heading", { name: "Recovered Light" })).toBeInTheDocument())
    expect(screen.queryByText("Preview workspace")).not.toBeInTheDocument()
    expect(listProjects).toHaveBeenCalledTimes(2)
  })

  it("carries a one-sentence idea into Create through a real form contract", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="home" ariaLabel="Home">
          <HomePageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    const quickStart = screen.getByRole("form", { name: "Start a new song" })
    expect(quickStart).toHaveAttribute("action", "/create")
    expect(quickStart).toHaveAttribute("method", "get")
    expect(within(quickStart).getByRole("textbox", { name: "Start with an idea" })).toHaveAttribute("name", "idea")
    expect(within(quickStart).getByRole("button", { name: "Shape this idea" })).toHaveAttribute("type", "submit")
  })

  it("shows playable controls when a preview direction is selected", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="home" ariaLabel="Home">
          <HomePageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Play First Light" }))

    const player = screen.getByRole("region", { name: "Global player" })
    expect(player).not.toHaveAttribute("data-player-state", "unavailable")
    expect(player).toHaveTextContent("First Light")
    expect(player).not.toHaveTextContent("Preview audio is unavailable")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("continues the latest live project from its confirmed Current Version", async () => {
    const api: Pick<MoriApi, "listProjects" | "listCandidates"> = {
      listProjects: async () => ({
        data: {
          projects: [{
            project_ref: "project_live_home",
            title: "Window Seat",
            description: "A quiet, forward-moving sketch.",
            current_version_ref: "version_live_b",
            candidate_count: 2,
            last_activity_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_home_projects" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [
            {
              candidate_ref: "candidate_live_a",
              generation_ref: "generation_live_home",
              version_ref: "version_live_a",
              project_ref: "project_live_home",
              title: "Window Seat · Close",
              duration_seconds: 140,
              audio_asset_ref: "asset_live_a",
              waveform_asset_ref: "waveform_live_a",
              style_tags: ["quiet", "close vocal"],
              created_at: "2026-09-04T11:58:00.000Z",
            },
            {
              candidate_ref: "candidate_live_b",
              generation_ref: "generation_live_home",
              version_ref: "version_live_b",
              project_ref: "project_live_home",
              title: "Window Seat · Wide",
              duration_seconds: 146,
              audio_asset_ref: "asset_live_b",
              waveform_asset_ref: "waveform_live_b",
              style_tags: ["wide", "patient"],
              created_at: "2026-09-04T11:59:00.000Z",
            },
          ],
          next_cursor: null,
        },
        meta: { request_id: "request_home_candidates" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="home" ariaLabel="Home">
          <HomePageContent api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    const continuation = await screen.findByRole("region", { name: "Window Seat" })
    expect(within(continuation).getByText("A quiet, forward-moving sketch.")).toBeInTheDocument()
    expect(within(continuation).getByRole("link", { name: "Continue in Studio" })).toHaveAttribute(
      "href",
      "/projects/project_live_home/studio/version_live_b",
    )

    const directions = screen.getByRole("region", { name: "Your latest directions" })
    expect(within(directions).getByText("Window Seat · Close")).toBeInTheDocument()
    expect(within(directions).getByText("Window Seat · Wide")).toBeInTheDocument()
    expect(within(directions).queryByText("First Light")).not.toBeInTheDocument()
    expect(within(directions).getByRole("link", { name: "Open Studio for Window Seat · Wide" })).toHaveAttribute(
      "href",
      "/projects/project_live_home/studio/version_live_b",
    )
  })

  it("encodes opaque Project and Version refs in continuity links", async () => {
    const projectRef = "project home / 01"
    const versionRef = "version?take=2#wide"
    const api: Pick<MoriApi, "listProjects" | "listCandidates"> = {
      listProjects: async () => ({
        data: {
          projects: [{
            project_ref: projectRef,
            title: "Window Seat",
            description: "A quiet, forward-moving sketch.",
            current_version_ref: versionRef,
            candidate_count: 1,
            last_activity_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_home_opaque_refs" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_opaque_home",
            generation_ref: "generation_opaque_home",
            version_ref: versionRef,
            project_ref: projectRef,
            title: "Window Seat · Wide",
            duration_seconds: 146,
            audio_asset_ref: "asset_opaque_home",
            waveform_asset_ref: "waveform_opaque_home",
            style_tags: ["wide", "patient"],
            created_at: "2026-09-04T11:59:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_home_opaque_candidates" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="home" ariaLabel="Home">
          <HomePageContent api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    const continuation = await screen.findByRole("region", { name: "Window Seat" })
    const encodedProjectRef = encodeURIComponent(projectRef)
    const encodedVersionRef = encodeURIComponent(versionRef)
    expect(within(continuation).getByRole("link", { name: "Continue in Studio" })).toHaveAttribute(
      "href",
      `/projects/${encodedProjectRef}/studio/${encodedVersionRef}`,
    )

    const directions = screen.getByRole("region", { name: "Your latest directions" })
    expect(within(directions).getByRole("link", { name: "Open Studio for Window Seat · Wide" })).toHaveAttribute(
      "href",
      `/projects/${encodedProjectRef}/studio/${encodedVersionRef}`,
    )
  })

  it("does not keep preview directions when a live project projection is incomplete", async () => {
    const api: Pick<MoriApi, "listProjects" | "listCandidates"> = {
      listProjects: async () => ({
        data: {
          projects: [{
            project_ref: "project_live_partial_home",
            title: "Blue Hour",
            description: "A restrained electronic study.",
            current_version_ref: null,
            candidate_count: 1,
            last_activity_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_home_partial" },
      }),
      listCandidates: async () => {
        throw new Error("candidate projection unavailable")
      },
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="home" ariaLabel="Home">
          <HomePageContent api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Blue Hour" })).toBeInTheDocument())
    const directions = screen.getByRole("region", { name: "Your latest directions" })
    expect(within(directions).getByText("Directions are temporarily unavailable")).toBeInTheDocument()
    expect(within(directions).queryByText("First Light")).not.toBeInTheDocument()
    expect(within(directions).getByRole("link", { name: "Open Blue Hour" })).toHaveAttribute(
      "href",
      "/projects/project_live_partial_home",
    )
  })
})
