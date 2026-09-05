import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CompositionEditPanel } from "./composition-edit-panel"

describe("CompositionEditPanel", () => {
  it("creates a typed edit from the numeric control", () => {
    const onApply = vi.fn()
    render(<CompositionEditPanel clipRef="clip_1" operation="trim" onApply={onApply} />)
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "4000" } })
    fireEvent.click(screen.getByRole("button", { name: "Apply trim" }))
    expect(onApply).toHaveBeenCalledWith({ operation: "trim", clipRef: "clip_1", durationMs: 4000 })
  })
})
