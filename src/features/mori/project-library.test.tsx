import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriLibraryItem, MoriProject } from "@/lib/mori-api"
import { MoriAppProvider } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { LibraryPageContent } from "./library-list"
import type { PlayerMediaFactory } from "./player-media"
import { ProjectsPageContent } from "./project-list"

describe("Mori catalog surfaces", () => {
  it("makes project continuation information findable", () => {
    render(<ProjectsPageContent />)
    expect(screen.getByText("Continue in Studio")).toBeInTheDocument()
    expect(screen.getByText("Current version")).toBeInTheDocument()
    expect(screen.getByText("Active project")).toBeInTheDocument()
  })

  it("keeps Projects in its workspace route instead of duplicating them in Library", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )
    for (const label of ["All", "Versions", "Sources"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole("button", { name: "Projects" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open First Light project" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open First Light studio" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lyrics" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Exports" })).not.toBeInTheDocument()
    expect(screen.queryByText(/suno|tad/i)).not.toBeInTheDocument()
  })

  it("makes library filters change the visible shelf", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Versions" }))

    expect(screen.getByRole("button", { name: "Versions" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Saved versions" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Use Mira in Create" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Sources" }))
    expect(screen.getByRole("region", { name: "Creative source library" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open First Light studio" })).not.toBeInTheDocument()
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
    expect(screen.getAllByRole("article")).toHaveLength(8)
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

  it("searches reusable sources alongside saved Versions", () => {
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

  it("keeps lyrics and exports in their Project and Studio context instead of advertising empty shelves", () => {
    render(
      <MoriAppProvider>
        <LibraryPageContent />
      </MoriAppProvider>,
    )

    expect(screen.queryByRole("button", { name: "Export center" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Lyrics" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Exports" })).not.toBeInTheDocument()
  })

  it("does not turn a loaded Project projection into a duplicate Library row", async () => {
    const api = {
      listLibrary: async () => { throw new Error("library unavailable") },
      listProjects: async () => ({
        data: {
          projects: [{
            project_ref: "project_window_seat",
            title: "Window Seat",
            description: "A quiet, forward-moving sketch.",
            current_version_ref: null,
            candidate_count: 0,
            last_activity_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_projects_partial_library" },
      }),
    }

    render(<MoriAppProvider><LibraryPageContent api={api} /></MoriAppProvider>)

    await waitFor(() => expect(screen.getByRole("status", { name: "Library availability" })).toHaveTextContent("Versions are temporarily unavailable"))
    expect(screen.queryByText("Window Seat")).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Creative source library" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open First Light studio" })).not.toBeInTheDocument()
  })

  it("does not mix the preview Project into live Versions when the project projection fails", async () => {
    const item: MoriLibraryItem = {
      library_item_ref: "library_version_window_seat",
      kind: "version",
      project_ref: "project_window_seat",
      project_title: "Window Seat",
      version_ref: "version_window_seat_a",
      title: "Window Seat · Close",
      duration_seconds: 143,
      audio_asset_ref: "asset_window_seat_a",
      waveform_asset_ref: "waveform_window_seat_a",
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const api = {
      listLibrary: async () => ({ data: { items: [item], next_cursor: null }, meta: { request_id: "request_library_partial_projects" } }),
      listProjects: async () => { throw new Error("projects unavailable") },
    }

    render(<MoriAppProvider><LibraryPageContent api={api} /></MoriAppProvider>)

    await waitFor(() => expect(screen.getByText("Window Seat · Close")).toBeInTheDocument())
    expect(screen.getByRole("status", { name: "Library availability" })).toHaveTextContent("Current Version labels are temporarily unavailable")
    expect(screen.queryByRole("link", { name: "Open First Light project" })).not.toBeInTheDocument()
  })

  it("labels Current Version from the live Project projection rather than the preview Project", async () => {
    const item: MoriLibraryItem = {
      library_item_ref: "library_version_current_window_seat",
      kind: "version",
      project_ref: "project_window_seat",
      project_title: "Window Seat",
      version_ref: "version_window_seat_current",
      title: "Window Seat · Wide",
      duration_seconds: 148,
      audio_asset_ref: "asset_window_seat_current",
      waveform_asset_ref: "waveform_window_seat_current",
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const project: MoriProject = {
      project_ref: "project_window_seat",
      title: "Window Seat",
      description: "A quiet, forward-moving sketch.",
      current_version_ref: "version_window_seat_current",
      candidate_count: 1,
      last_activity_at: "2026-09-04T12:00:00.000Z",
    }
    const api = {
      listLibrary: async () => ({ data: { items: [item], next_cursor: null }, meta: { request_id: "request_library_current" } }),
      listProjects: async () => ({ data: { projects: [project], next_cursor: null }, meta: { request_id: "request_projects_current" } }),
    }

    render(<MoriAppProvider><LibraryPageContent api={api} /></MoriAppProvider>)

    await waitFor(() => expect(screen.getByText("Current version · Window Seat")).toBeInTheDocument())
    expect(screen.queryByText("Version · Window Seat")).not.toBeInTheDocument()
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

  it("keeps a live library audio reference when handing a Version to the global player", async () => {
    const libraryItem: MoriLibraryItem = {
      library_item_ref: "library_version_mori_audio",
      kind: "version",
      project_ref: "project_preview_first_light",
      project_title: "First Light",
      version_ref: "version_mori_audio",
      title: "First Light · Live audio",
      duration_seconds: 205,
      audio_asset_ref: "asset_mori_audio",
      waveform_asset_ref: "waveform_mori_audio",
      created_at: "2026-09-02T12:00:00.000Z",
    }
    let selectedAudioAssetRef: string | null = null
    const mediaFactory: PlayerMediaFactory = (callbacks) => ({
      setSource: (candidate) => { selectedAudioAssetRef = candidate?.audioAssetRef ?? null },
      play: async () => { callbacks.onTimeUpdate(1) },
      pause: () => {},
      seek: () => {},
      setMuted: () => {},
      dispose: () => {},
    })
    const api = {
      listLibrary: async () => ({ data: { items: [libraryItem], next_cursor: null }, meta: { request_id: "request_library_audio" } }),
    }

    render(
      <MoriAppProvider mediaFactory={mediaFactory}>
        <LibraryPageContent api={api} />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByText("First Light · Live audio")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Play First Light · Live audio" }))

    await waitFor(() => expect(selectedAudioAssetRef).toBe("asset_mori_audio"))
  })

  it("hydrates reusable creative sources from the live library projection", async () => {
    const sourceItem = {
      library_item_ref: "library_source_live_mira",
      kind: "source" as const,
      source_kind: "voice" as const,
      source_ref: "voice_live_mira",
      name: "Mira Live",
      description: "Warm alto · intimate phrasing",
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const api = {
      listLibrary: async () => ({ data: { items: [], next_cursor: null }, meta: { request_id: "request_library_source_1" } }),
      listCreativeSources: async () => ({
        data: {
          sources: [{
            source_kind: sourceItem.source_kind,
            source_ref: sourceItem.source_ref,
            name: sourceItem.name,
            description: sourceItem.description,
            created_at: sourceItem.created_at,
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_library_source_1" },
      }),
    }

    render(
      <MoriAppProvider>
        <LibraryPageContent api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Sources" }))

    await waitFor(() => expect(screen.getByText("Mira Live")).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "Use Mira Live in Create" })).toHaveAttribute("href", "/create?source_kind=voice&source_ref=voice_live_mira")
    expect(screen.queryByText("Mira")).not.toBeInTheDocument()
    expect(screen.queryByText("City Lights demo")).not.toBeInTheDocument()
  })

  it("loads the next creative source page without mixing or resetting the first page", async () => {
    const listCreativeSources = vi.fn(async (options: { limit?: number; cursor?: string | null } = {}) => {
      const secondPage = options.cursor === "source_cursor_2"
      return {
        data: {
          sources: [secondPage ? {
            source_kind: "inspiration" as const,
            source_ref: "style_live_afterglow",
            name: "Afterglow Live",
            description: "Soft pulse · intimate glow",
            style: "Dream pop · intimate · organic",
            created_at: "2026-09-04T12:00:00.000Z",
          } : {
            source_kind: "voice" as const,
            source_ref: "voice_live_mira",
            name: "Mira Live",
            description: "Warm alto · intimate phrasing",
            created_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: secondPage ? null : "source_cursor_2",
        },
        meta: { request_id: secondPage ? "request_library_source_page_2" : "request_library_source_page_1" },
      }
    })
    const api = {
      listLibrary: async () => ({ data: { items: [], next_cursor: null }, meta: { request_id: "request_library_versions" } }),
      listCreativeSources,
    }

    render(<MoriAppProvider><LibraryPageContent api={api} /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Sources" }))

    await waitFor(() => expect(screen.getByText("Mira Live")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Inspiration" }))
    expect(screen.queryByText("Mira Live")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Load more creative sources" }))

    await waitFor(() => expect(screen.getByText("Afterglow Live")).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "All sources" }))
    expect(screen.getByText("Mira Live")).toBeInTheDocument()
    expect(screen.getByText("Afterglow Live")).toBeInTheDocument()
    expect(listCreativeSources).toHaveBeenNthCalledWith(2, { limit: 20, cursor: "source_cursor_2" })
    expect(screen.queryByRole("button", { name: "Load more creative sources" })).not.toBeInTheDocument()
  })

  it("keeps the source cursor available when a page fails and offers a retry", async () => {
    let nextPageAttempts = 0
    const listCreativeSources = vi.fn(async (options: { limit?: number; cursor?: string | null } = {}) => {
      if (options.cursor !== undefined && options.cursor !== null) {
        nextPageAttempts += 1
        if (nextPageAttempts === 1) throw new Error("temporary source page failure")
        return {
          data: {
            sources: [{
              source_kind: "audio" as const,
              source_ref: "asset_live_room_tone",
              name: "Room Tone Live",
              description: "A quiet room tone for texture",
              duration_seconds: 18,
              created_at: "2026-09-04T12:00:00.000Z",
            }],
            next_cursor: null,
          },
          meta: { request_id: "request_library_source_retry_success" },
        }
      }
      return {
        data: {
          sources: [{
            source_kind: "voice" as const,
            source_ref: "voice_live_mira",
            name: "Mira Live",
            description: "Warm alto · intimate phrasing",
            created_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: "source_cursor_retry",
        },
        meta: { request_id: "request_library_source_retry_initial" },
      }
    })
    const api = {
      listLibrary: async () => ({ data: { items: [], next_cursor: null }, meta: { request_id: "request_library_versions" } }),
      listCreativeSources,
    }

    render(<MoriAppProvider><LibraryPageContent api={api} /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Sources" }))
    await waitFor(() => expect(screen.getByText("Mira Live")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "Load more creative sources" }))
    expect(await screen.findByText("The next page could not load.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => expect(screen.getByText("Room Tone Live")).toBeInTheDocument())
    expect(nextPageAttempts).toBe(2)
  })

  it("does not mix preview Sources into a live Version response when the Source projection fails", async () => {
    const api = {
      listLibrary: async () => ({ data: { items: [], next_cursor: null }, meta: { request_id: "request_library_versions_only" } }),
      listCreativeSources: async () => { throw new Error("creative sources unavailable") },
    }

    render(<MoriAppProvider><LibraryPageContent api={api} /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Sources" }))

    await waitFor(() => expect(screen.getByRole("status", { name: "Library availability" })).toHaveTextContent("Creative sources are temporarily unavailable"))
    expect(screen.queryByText("City Lights demo")).not.toBeInTheDocument()
    expect(screen.getByText("Creative sources are temporarily unavailable")).toBeInTheDocument()
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

  it("uses the Project projection only to enrich Versions", async () => {
    const project: MoriProject = {
      project_ref: "project_rain_room",
      title: "Rain Room",
      description: "A soft study in weather and distance.",
      current_version_ref: null,
      candidate_count: 0,
      last_activity_at: "2026-09-02T12:00:00.000Z",
    }
    const listProjects = vi.fn(async () => ({ data: { projects: [project], next_cursor: null }, meta: { request_id: "request_projects_library" } }))
    const api = {
      listLibrary: async () => ({ data: { items: [], next_cursor: null }, meta: { request_id: "request_library_projects" } }),
      listProjects,
    }

    render(
      <MoriAppProvider>
        <LibraryPageContent api={api} />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(listProjects).toHaveBeenCalledOnce())
    expect(screen.queryByText("Rain Room")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Projects" })).not.toBeInTheDocument()
  })

  it("keeps a preview version honest while opening its studio", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <LibraryPageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Play First Light" }))

    expect(screen.getByRole("button", { name: "Play First Light" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Preview audio is unavailable")
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("First Light")
    expect(screen.getByRole("link", { name: "Open First Light studio" })).toHaveAttribute("href", "/projects/project_preview_first_light/studio/version_preview_first_light_a")
  })
})
