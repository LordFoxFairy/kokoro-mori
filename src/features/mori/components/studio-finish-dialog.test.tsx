import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriMixRevision } from "@/lib/mori-api"
import { createInitialStudioReleaseDraft, idleStudioArtworkRun, idleStudioReleaseSave } from "../studio-release"
import { buildStudioRemasterPlan } from "../studio-remaster"
import type { StudioAiRunState } from "./studio-ai-composer"
import { StudioFinishDialog } from "./studio-finish-dialog"

const idleRun: StudioAiRunState = {
  status: "idle",
  progress: 0,
  resultCount: 0,
  plan: null,
  message: null,
}

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

describe("Studio Finish dialog", () => {
  it("keeps Remaster and Release as contextual Finish views", () => {
    const onViewChange = vi.fn()
    render(
      <StudioFinishDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={null}
        run={idleRun}
        view="remaster"
        onViewChange={onViewChange}
        release={{
          versionRef: "version_1",
          draft: createInitialStudioReleaseDraft("First Light"),
          artworkDraft: { prompt: "", style: "abstract", palette: "warm_dawn" },
          artworkRun: idleStudioArtworkRun,
          saveState: idleStudioReleaseSave,
          onDraftChange: vi.fn(),
          onArtworkDraftChange: vi.fn(),
          onGenerateArtwork: vi.fn(),
          onCancelArtwork: vi.fn(),
          onResetArtwork: vi.fn(),
          onSave: vi.fn(),
        }}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onReviewTakes={vi.fn()}
      />,
    )

    const tabs = screen.getByRole("tablist", { name: "Finish workflow" })
    expect(within(tabs).getByRole("tab", { name: "Remaster" })).toHaveAttribute("aria-selected", "true")
    fireEvent.click(within(tabs).getByRole("tab", { name: "Release" }))
    expect(onViewChange).toHaveBeenCalledWith("release")
  })

  it("reviews a mix-aware strength choice before creating two protected Takes", () => {
    const onSubmit = vi.fn()
    render(
      <StudioFinishDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={mixRevision}
        run={idleRun}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        onReviewTakes={vi.fn()}
      />,
    )

    const dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(within(dialog).getByRole("radio", { name: /Mix revision 7/u })).toBeChecked()
    expect(within(dialog).getByRole("radio", { name: /Balanced/u })).toBeChecked()

    fireEvent.click(within(dialog).getByRole("radio", { name: /Subtle/u }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Review remaster" }))

    const plan = within(dialog).getByRole("region", { name: "Remaster plan" })
    expect(within(plan).getByText("Subtle")).toBeInTheDocument()
    expect(within(plan).getByText("Mix revision 7 · Close vocal mix")).toBeInTheDocument()
    expect(within(plan).getByText("Melody · Lyrics · Voice · Tempo · Structure")).toBeInTheDocument()
    expect(within(plan).getByText("2 alternatives · Take lanes")).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.click(within(plan).getByRole("button", { name: "Create 2 remastered takes" }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      intent: "remaster",
      source: { type: "mix_revision", mixRevisionRef: "mix_revision_7" },
      variationStrength: "subtle",
      operation: "transform",
      outputCount: 2,
      preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
      draft: expect.objectContaining({
        intent: "remaster",
        source: { type: "mix_revision", mixRevisionRef: "mix_revision_7" },
        variationStrength: "subtle",
      }),
    }))
  })

  it("traps focus, closes on Escape, and restores the launcher", () => {
    const onClose = vi.fn()
    const launcher = document.createElement("button")
    document.body.append(launcher)
    launcher.focus()
    const view = render(
      <StudioFinishDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={null}
        run={idleRun}
        onClose={onClose}
        onReset={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onReviewTakes={vi.fn()}
      />,
    )

    const versionSource = screen.getByRole("radio", { name: /Open version/u })
    expect(versionSource).toHaveFocus()
    expect(screen.getByText("First Light · 3:02")).toBeInTheDocument()
    expect(screen.getByText("Base audio before saved mixer changes")).toBeInTheDocument()
    expect(screen.queryByText("version_1")).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe("hidden")
    screen.getByRole("button", { name: "Close Finish" }).focus()
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true })
    expect(screen.getByRole("button", { name: "Review remaster" })).toHaveFocus()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(launcher).toHaveFocus()
    expect(document.body.style.overflow).toBe("")
    launcher.remove()
  })

  it("keeps a running Remaster visible and cancellable after the dialog is reopened", () => {
    const onCancel = vi.fn()
    const plan = buildStudioRemasterPlan({
      source: { type: "version" },
      variationStrength: "bold",
      durationSeconds: 182,
    })
    render(
      <StudioFinishDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={null}
        run={{ status: "generating", progress: 46, resultCount: 0, plan, message: null }}
        onClose={vi.fn()}
        onReset={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        onReviewTakes={vi.fn()}
      />,
    )

    const remasterPlan = screen.getByRole("region", { name: "Remaster plan" })
    expect(within(remasterPlan).getByText("Bold")).toBeInTheDocument()
    expect(within(remasterPlan).getByRole("progressbar", { name: "Remaster progress" })).toHaveAttribute("aria-valuenow", "46")
    expect(within(remasterPlan).getByText("Polishing two takes")).toBeInTheDocument()
    fireEvent.click(within(remasterPlan).getByRole("button", { name: "Cancel remaster" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it("preserves a failed plan for retry and opens successful Takes for comparison", () => {
    const plan = buildStudioRemasterPlan({
      source: { type: "version" },
      variationStrength: "balanced",
      durationSeconds: 182,
    })
    const onSubmit = vi.fn()
    const onReset = vi.fn()
    const onReviewTakes = vi.fn()
    const view = render(
      <StudioFinishDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={null}
        run={{ status: "failed", progress: 0, resultCount: 0, plan, message: "The Remaster did not finish. Your plan is ready to retry." }}
        onClose={vi.fn()}
        onReset={onReset}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        onReviewTakes={onReviewTakes}
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Your plan is ready to retry")
    fireEvent.click(screen.getByRole("button", { name: "Retry remaster" }))
    expect(onSubmit).toHaveBeenCalledWith(plan)
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }))
    expect(onReset).toHaveBeenCalledTimes(1)

    view.rerender(
      <StudioFinishDialog
        versionTitle="First Light"
        durationSeconds={182}
        latestMixRevision={null}
        run={{ status: "succeeded", progress: 100, resultCount: 2, plan, message: null }}
        onClose={vi.fn()}
        onReset={onReset}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        onReviewTakes={onReviewTakes}
      />,
    )

    expect(screen.getByText("2 remastered takes are ready.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Review 2 takes" }))
    expect(onReviewTakes).toHaveBeenCalledTimes(1)
  })
})
