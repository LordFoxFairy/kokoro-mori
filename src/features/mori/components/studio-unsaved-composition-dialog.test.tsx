import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { StudioUnsavedCompositionDialog } from "./studio-unsaved-composition-dialog"

describe("StudioUnsavedCompositionDialog", () => {
  it("keeps the arrangement, discards it, or saves it before leaving", () => {
    const onStay = vi.fn()
    const onDiscard = vi.fn()
    const onSave = vi.fn()
    renderDialog({ onStay, onDiscard, onSave })

    const dialog = screen.getByRole("dialog", { name: "Save changes before Lyrics?" })
    expect(within(dialog).getByRole("button", { name: "Keep editing" })).toHaveFocus()
    fireEvent.click(within(dialog).getByRole("button", { name: "Save & continue" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Discard & continue" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(onStay).toHaveBeenCalledOnce()
  })

  it("requires a refresh after a composition conflict", () => {
    const onRefresh = vi.fn()
    renderDialog({ saveState: "conflict", onRefresh })
    const dialog = screen.getByRole("dialog", { name: "Save changes before Lyrics?" })
    expect(within(dialog).getByText(/owner projection changed/u)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Refresh arrangement" })).toBeEnabled()
    expect(within(dialog).queryByRole("button", { name: "Save & continue" })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Refresh arrangement" }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})

function renderDialog(overrides: Partial<React.ComponentProps<typeof StudioUnsavedCompositionDialog>> = {}) {
  return render(
    <StudioUnsavedCompositionDialog
      currentVersionTitle="First Light"
      destinationLabel="Lyrics"
      saveState="unsaved"
      onStay={() => undefined}
      onDiscard={() => undefined}
      onSave={() => undefined}
      onRefresh={() => undefined}
      {...overrides}
    />,
  )
}
