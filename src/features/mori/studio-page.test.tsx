import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MoriAppProvider } from "./components/mori-app-provider"
import { previewCandidates } from "./preview-data"
import { StudioPageContent } from "./studio-page"

describe("Mori studio page", () => {
  function renderStudio(api?: {
    createExport: (versionRef: string, format: "mp3" | "wav", idempotencyKey: string) => Promise<{ data: { export_ref: string; status: "queued" | "processing" }; meta: { request_id: string } }>
    getExport?: (exportRef: string) => Promise<{ data: { export_ref: string; project_ref: string; version_ref: string; format: "mp3" | "wav"; status: "queued" | "processing" | "succeeded" | "failed"; download_url: string | null; created_at: string }; meta: { request_id: string } }>
  }) {
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

  it("shows take lanes and lets a user make a direction current", () => {
    renderStudio()

    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    const firstTake = within(takeLanes).getByRole("article", { name: "Take 1: First Light" })
    const secondTake = within(takeLanes).getByRole("article", { name: "Take 2: First Light · Afterglow" })

    expect(within(firstTake).getByText("Current version")).toBeInTheDocument()
    fireEvent.click(within(secondTake).getByRole("button", { name: "Use First Light · Afterglow as current" }))

    expect(within(secondTake).getByText("Current version")).toBeInTheDocument()
    expect(within(firstTake).getByRole("button", { name: "Use First Light as current" })).toBeInTheDocument()
  })

  it("keeps lyrics editable with an explicit local save state", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    const lyricsEditor = screen.getByRole("region", { name: "Lyrics editor" })
    const lyrics = within(lyricsEditor).getByRole("textbox", { name: "Lyrics draft" })

    fireEvent.change(lyrics, { target: { value: "A new line for the morning." } })
    fireEvent.click(within(lyricsEditor).getByRole("button", { name: "Save draft" }))

    expect(within(lyricsEditor).getByText("Saved locally")).toBeInTheDocument()
    expect(lyrics).toHaveValue("A new line for the morning.")
  })

  it("provides explicit mute controls for the stem preview", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    const muteLead = within(stemsEditor).getByRole("button", { name: "Mute Lead vocal" })

    fireEvent.click(muteLead)

    expect(within(stemsEditor).getByRole("button", { name: "Unmute Lead vocal" })).toHaveAttribute("aria-pressed", "true")
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

  it("turns a completed export into a download action", async () => {
    renderStudio({
      createExport: async () => ({ data: { export_ref: "export_1", status: "queued" }, meta: { request_id: "request_export_1" } }),
      getExport: async () => ({
        data: {
          export_ref: "export_1",
          project_ref: "project_preview_first_light",
          version_ref: "version_preview_first_light_a",
          format: "mp3",
          status: "succeeded",
          download_url: "https://download.kokoro.invalid/export_1.mp3",
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_export_2" },
      }),
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))

    const download = await screen.findByRole("link", { name: "Download MP3" })
    expect(download).toHaveAttribute("href", "https://download.kokoro.invalid/export_1.mp3")
  })

  it("hydrates the studio version from the requested project projection", async () => {
    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef="project_live_1"
          api={{
            createExport: async () => ({ data: { export_ref: "export_1", status: "queued" as const }, meta: { request_id: "request_export_1" } }),
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
          }}
        />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Window Seat" })).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "First Light" })).toHaveAttribute("href", "/projects/project_live_1")
    expect(screen.getByRole("link", { name: /Window Seat/ })).toHaveAttribute("href", "/projects/project_live_1/studio/version_live_1")
    expect(screen.getAllByText("soft motion · close vocal").length).toBeGreaterThan(0)
  })
})
