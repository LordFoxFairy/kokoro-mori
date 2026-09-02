import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriAppProvider } from "./components/mori-app-provider"
import { previewCandidates } from "./preview-data"
import { StudioPageContent } from "./studio-page"

describe("Mori studio page", () => {
  function renderStudio(api?: { createExport: (versionRef: string, format: "mp3" | "wav", idempotencyKey: string) => Promise<{ data: { export_ref: string; status: "queued" | "processing" }; meta: { request_id: string } }> }) {
    render(
      <MoriAppProvider>
        <StudioPageContent candidate={previewCandidates[0]} api={api} />
      </MoriAppProvider>,
    )
  }

  it("switches between arrangement, lyrics, and stems tools", () => {
    renderStudio()

    expect(screen.getByRole("button", { name: "Arrangement" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    expect(screen.getByRole("button", { name: "Lyrics" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Lyrics editor" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    expect(screen.getByRole("button", { name: "Stems" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Stems editor" })).toBeInTheDocument()
  })

  it("uses the global player for studio preview and gives share feedback", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    expect(within(screen.getByRole("region", { name: "Global player" })).getByRole("button", { name: "Pause" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    expect(screen.getByText("Link copied")).toBeInTheDocument()
  })

  it("queues an mp3 export from the studio", async () => {
    let exportedVersion = ""
    renderStudio({
      createExport: async (versionRef) => {
        exportedVersion = versionRef
        return { data: { export_ref: "export_1", status: "queued" }, meta: { request_id: "request_export_1" } }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))

    expect(exportedVersion).toBe("version_preview_first_light_a")
    expect(await screen.findByText("Export queued")).toBeInTheDocument()
  })
})
