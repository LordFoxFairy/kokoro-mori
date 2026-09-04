import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ProjectWorkspaceSaveRun } from "../project-workspace-memory"
import { StudioUnsavedLyricsDialog } from "./studio-unsaved-lyrics-dialog"

const idleRun: ProjectWorkspaceSaveRun = {
  status: "idle",
  command: null,
  message: null,
  retryable: false,
}

describe("StudioUnsavedLyricsDialog", () => {
  it("offers Stay, Discard, and an owner-confirmed save before changing Versions", () => {
    const onStay = vi.fn()
    const onDiscard = vi.fn()
    const onSave = vi.fn()
    renderDialog({ onStay, onDiscard, onSave })

    const dialog = screen.getByRole("dialog", {
      name: "Save changes before opening another Version?",
    })
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    ).toHaveFocus()
    fireEvent.click(within(dialog).getByRole("button", { name: "Save & open" }))
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Discard & open" }),
    )
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Keep editing" }),
    )
    expect(onSave).toHaveBeenCalledOnce()
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(onStay).toHaveBeenCalledOnce()
  })

  it("changes the only recovery action to refresh after a non-retryable save conflict", () => {
    const onRefresh = vi.fn()
    renderDialog({
      saveRun: {
        status: "failed",
        command: null,
        message: "This project changed elsewhere. Refresh before saving again.",
        retryable: false,
      },
      onRefresh,
    })

    const dialog = screen.getByRole("dialog", {
      name: "Save changes before opening another Version?",
    })
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "This project changed elsewhere",
    )
    expect(
      within(dialog).getByRole("button", { name: "Refresh workspace" }),
    ).toBeEnabled()
    expect(
      within(dialog).queryByRole("button", { name: "Save & open" }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Refresh workspace" }),
    )
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it("offers a workspace refresh instead of a disabled save when no initial projection is available", () => {
    const onRefresh = vi.fn()
    renderDialog({ canSave: false, canRefreshWorkspace: true, onRefresh })

    const dialog = screen.getByRole("dialog", {
      name: "Save changes before opening another Version?",
    })
    expect(
      within(dialog).getByRole("button", { name: "Refresh workspace" }),
    ).toBeEnabled()
    expect(
      within(dialog).getByText(/Refresh it before saving these local changes/u),
    ).toBeInTheDocument()
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Refresh workspace" }),
    )
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})

function renderDialog(
  overrides: Partial<
    React.ComponentProps<typeof StudioUnsavedLyricsDialog>
  > = {},
) {
  return render(
    <StudioUnsavedLyricsDialog
      currentVersionTitle="First Light"
      targetVersionTitle="First Light · Afterglow"
      canSave
      canRefreshWorkspace={false}
      saveRun={idleRun}
      onStay={() => undefined}
      onDiscard={() => undefined}
      onSave={() => undefined}
      onRefresh={() => undefined}
      {...overrides}
    />,
  )
}
