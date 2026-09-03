import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { MoriLibraryItem, MoriProject } from "@/lib/mori-api"
import { MoriAppProvider } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { LibraryPageContent } from "./library-list"
import { ProjectsPageContent } from "./project-list"

describe("Mori catalog surfaces", () => {
  it("makes project continuation information findable", () => {
    render(<ProjectsPageContent />)
    expect(screen.getByText("Continue creating")).toBeInTheDocument()
    expect(screen.getByText("Current version")).toBeInTheDocument()
    expect(screen.getByText("Active project")).toBeInTheDocument()
  })

  it("keeps library filters local and provider-neutral", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )
    for (const label of ["All", "Projects", "Versions", "Sources", "Lyrics", "Exports"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByText(/suno|tad/i)).not.toBeInTheDocument()
  })

  it("makes library filters change the visible shelf", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Versions" }))

    expect(screen.queryByText("2 versions · Updated just now")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Versions" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    expect(screen.getByText("No lyrics saved yet")).toBeInTheDocument()
  })

  it("filters library items by title", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    fireEvent.change(screen.getByRole("searchbox", { name: "Search library" }), {
      target: { value: "First Light · Afterglow" },
    })

    expect(screen.getAllByRole("article")).toHaveLength(1)
    expect(screen.getByText("First Light · Afterglow")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("1 result")
  })

  it("offers a clear recovery action when library search has no matches", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    fireEvent.change(screen.getByRole("searchbox", { name: "Search library" }), {
      target: { value: "Midnight rain" },
    })

    expect(screen.getByText("No matches for “Midnight rain”")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear library search" }))
    expect(screen.getAllByRole("article")).toHaveLength(9)
  })

  it("keeps reusable creative sources in a progressive Library shelf", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Sources" }))

    const sourceShelf = screen.getByRole("region", { name: "Creative source library" })
    expect(sourceShelf).toHaveTextContent("City Lights demo")
    expect(sourceShelf).toHaveTextContent("Mira")
    expect(sourceShelf).toHaveTextContent("Open Road")
    expect(screen.getByRole("link", { name: "Use Mira in Create" })).toHaveAttribute("href", "/create?source_kind=voice&source_ref=voice_preview_mira")

    fireEvent.click(screen.getByRole("button", { name: "Voices" }))
    expect(screen.getByRole("button", { name: "Voices" })).toHaveAttribute("aria-pressed", "true")
    expect(sourceShelf).toHaveTextContent("Mira")
    expect(sourceShelf).toHaveTextContent("Rowan")
    expect(sourceShelf).not.toHaveTextContent("City Lights demo")
    expect(sourceShelf).not.toHaveTextContent("Open Road")
  })

  it("opens the complete source shelf from the All view", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Sources" }))
    fireEvent.click(screen.getByRole("button", { name: "Voices" }))
    fireEvent.click(screen.getByRole("button", { name: "All" }))
    fireEvent.click(screen.getByRole("button", { name: "Browse all sources" }))

    expect(screen.getByRole("button", { name: "All sources" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Creative source library" })).toHaveTextContent("City Lights demo")
  })

  it("searches reusable sources alongside projects and versions", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    fireEvent.change(screen.getByRole("searchbox", { name: "Search library" }), {
      target: { value: "Rowan" },
    })

    expect(screen.getAllByRole("article")).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Use Rowan in Create" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("1 result")
  })

  it("routes the export center action to the exports shelf", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Export center" }))

    expect(screen.getByRole("button", { name: "Exports" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("No exports yet")).toBeInTheDocument()
  })

  it("hydrates the shelf from the Mori library projection", async () => {
    const libraryItem: MoriLibraryItem = {
      library_item_ref: "library_version_mori_1",
      kind: "version",
      project_ref: "project_preview_first_light",
      project_title: "First Light",
      version_ref: "version_mori_1",
      title: "First Light · Sunrise",
      duration_seconds: 205,
      audio_asset_ref: "asset_mori_1",
      waveform_asset_ref: "waveform_mori_1",
      created_at: "2026-09-02T12:00:00.000Z",
    }
    const api = {
      listLibrary: async () => ({ data: { items: [libraryItem], next_cursor: null }, meta: { request_id: "request_library_1" } }),
    }

    render(
      <MoriAppProvider>
        <LibraryPageContent api={api} />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByText("First Light · Sunrise")).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "Open First Light · Sunrise studio" })).toHaveAttribute("href", "/projects/project_preview_first_light/studio/version_mori_1")
  })

  it("renders a clear empty state for an empty version projection", async () => {
    const api = {
      listLibrary: async () => ({ data: { items: [], next_cursor: null }, meta: { request_id: "request_library_empty" } }),
    }

    render(
      <MoriAppProvider>
        <LibraryPageContent api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Versions" }))

    await waitFor(() => expect(screen.getByText("No versions yet")).toBeInTheDocument())
    expect(screen.getByText("Generate a direction and keep the version you want to return to.")).toBeInTheDocument()
  })

  it("keeps projects visible from the separate project projection", async () => {
    const project: MoriProject = {
      project_ref: "project_rain_room",
      title: "Rain Room",
      description: "A soft study in weather and distance.",
      current_version_ref: null,
      candidate_count: 0,
      last_activity_at: "2026-09-02T12:00:00.000Z",
    }
    const api = {
      listLibrary: async () => ({ data: { items: [], next_cursor: null }, meta: { request_id: "request_library_projects" } }),
      listProjects: async () => ({ data: { projects: [project], next_cursor: null }, meta: { request_id: "request_projects_library" } }),
    }

    render(
      <MoriAppProvider>
        <LibraryPageContent api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Projects" }))

    await waitFor(() => expect(screen.getByText("Rain Room")).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "Open Rain Room project" })).toHaveAttribute("href", "/projects/project_rain_room")
  })

  it("lets a library version start playback and open its studio", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <LibraryPageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Play First Light" }))

    expect(screen.getByRole("button", { name: "Pause First Light" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("First Light")
    expect(screen.getByRole("link", { name: "Open First Light studio" })).toHaveAttribute("href", "/projects/project_preview_first_light/studio/version_preview_first_light_a")
  })
})
