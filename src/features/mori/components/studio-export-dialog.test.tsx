import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriExportInput, MoriExportSnapshot, MoriMixRevision } from "@/lib/mori-api"
import { StudioExportDialog } from "./studio-export-dialog"

const mixRevision: MoriMixRevision = {
  mix_revision_ref: "mix_revision_7",
  version_ref: "version_1",
  source_stem_separation_ref: "stem_separation_1",
  name: "Close vocal mix",
  revision: 7,
  tracks: [
    { stem_ref: "stem_vocals", gain: 0.72, muted: false },
    { stem_ref: "stem_drums", gain: 1, muted: false },
  ],
  created_at: "2026-09-03T12:00:00.000Z",
}

describe("Studio export dialog", () => {
  it("mounts the modal layer at document body so global shell surfaces stay behind it", () => {
    render(
      <StudioExportDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={null}
        status="idle"
        activeInput={null}
        snapshot={null}
        message={null}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    expect(dialog.parentElement?.parentElement).toBe(document.body)
  })

  it("starts with the open Version, full song, and MP3 while keeping modal focus reversible", () => {
    const onClose = vi.fn()
    const onSubmit = vi.fn()
    const launcher = document.createElement("button")
    document.body.append(launcher)
    launcher.focus()

    const view = render(
      <StudioExportDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={null}
        status="idle"
        activeInput={null}
        snapshot={null}
        message={null}
        onClose={onClose}
        onReset={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    const versionSource = within(dialog).getByRole("radio", { name: /Open version/u })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(versionSource).toBeChecked()
    expect(versionSource).toHaveFocus()
    expect(within(dialog).getByText("First Light · 3:02")).toBeInTheDocument()
    expect(within(dialog).getByText("Base audio before saved mixer changes")).toBeInTheDocument()
    expect(within(dialog).queryByText("version_1")).not.toBeInTheDocument()
    expect(within(dialog).getByText("Full song")).toBeInTheDocument()
    expect(within(dialog).getByRole("radio", { name: "MP3" })).toBeChecked()

    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))
    expect(onSubmit).toHaveBeenCalledWith({
      source: { type: "version" },
      scope: { type: "full_song" },
      format: "mp3",
    })

    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(launcher).toHaveFocus()
    launcher.remove()
  })

  it("prefers the latest saved Mix Revision and lets the user choose WAV", () => {
    const onSubmit = vi.fn()
    render(
      <StudioExportDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={mixRevision}
        status="idle"
        activeInput={null}
        snapshot={null}
        message={null}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    expect(within(dialog).getByRole("radio", { name: /Mix revision 7/u })).toBeChecked()
    expect(within(dialog).getByText("Close vocal mix")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("radio", { name: "WAV" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))

    expect(onSubmit).toHaveBeenCalledWith({
      source: { type: "mix_revision", mix_revision_ref: "mix_revision_7" },
      scope: { type: "full_song" },
      format: "wav",
    })
  })

  it("keeps the selected source and format available for retry after failure", () => {
    const onSubmit = vi.fn()
    const activeInput: MoriExportInput = {
      source: { type: "mix_revision", mix_revision_ref: "mix_revision_7" },
      scope: { type: "full_song" },
      format: "wav",
    }
    const view = render(
      <StudioExportDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={mixRevision}
        status="failed"
        activeInput={activeInput}
        snapshot={null}
        message="The export did not finish. Your choices are still here."
        onClose={vi.fn()}
        onReset={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByRole("radio", { name: /Mix revision 7/u })).toBeChecked()
    expect(screen.getByRole("radio", { name: "WAV" })).toBeChecked()
    expect(screen.getByRole("alert")).toHaveTextContent("The export did not finish. Your choices are still here.")
    fireEvent.click(screen.getByRole("button", { name: "Retry export" }))
    expect(onSubmit).toHaveBeenCalledWith(activeInput)

    view.rerender(
      <StudioExportDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={mixRevision}
        status="processing"
        activeInput={activeInput}
        snapshot={null}
        message={null}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onSubmit={onSubmit}
      />,
    )
    const progress = screen.getByRole("status")
    expect(progress).toHaveTextContent("Rendering WAV")
    expect(screen.getByRole("dialog", { name: "Export First Light" })).toHaveFocus()
    expect(screen.getByRole("button", { name: /^Close$/u })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Exporting…" })).toBeDisabled()
  })

  it("exposes the completed render as a real download", () => {
    const input: MoriExportInput = {
      source: { type: "version" },
      scope: { type: "full_song" },
      format: "mp3",
    }
    const snapshot: MoriExportSnapshot = {
      export_ref: "export_1",
      project_ref: "project_1",
      version_ref: "version_1",
      source: input.source,
      scope: input.scope,
      format: input.format,
      status: "succeeded",
      download_url: "https://download.kokoro.invalid/export_1.mp3",
      created_at: "2026-09-03T12:05:00.000Z",
    }
    render(
      <StudioExportDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={null}
        status="succeeded"
        activeInput={input}
        snapshot={snapshot}
        message={null}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByText("Your full song is ready.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Download MP3" })).toHaveAttribute("href", snapshot.download_url)
  })
})
