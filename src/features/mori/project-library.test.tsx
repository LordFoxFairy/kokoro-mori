import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { MoriLibraryItem } from "@/lib/mori-api"
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
    for (const label of ["All", "Projects", "Versions", "Lyrics", "Exports"]) {
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
