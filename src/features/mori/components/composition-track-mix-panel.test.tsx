import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CompositionTrackMixPanel } from "./composition-track-mix-panel"

describe("CompositionTrackMixPanel", () => {
  it("keeps track controls folded until requested and applies a normalized mix", () => {
    const onApply = vi.fn()
    render(<CompositionTrackMixPanel track={{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [] }} onApply={onApply} />)
    const summary = screen.getByText("Track controls")
    expect(summary.closest("details")).not.toHaveAttribute("open")
    fireEvent.click(summary)
    fireEvent.change(screen.getByRole("slider", { name: "Level Lead" }), { target: { value: "65" } })
    fireEvent.change(screen.getByRole("slider", { name: "Pan Lead" }), { target: { value: "-30" } })
    fireEvent.click(screen.getByRole("button", { name: "Mute Lead" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply track mix" }))
    expect(onApply).toHaveBeenCalledWith({ gain: 0.65, pan: -0.3, muted: true })
  })

  it("resets draft controls when a different track projection arrives", () => {
    const onApply = vi.fn()
    const { rerender } = render(<CompositionTrackMixPanel track={{ trackRef: "track_1", kind: "vocals", name: "Lead", gain: 0.5, pan: 0, muted: false, clips: [] }} onApply={onApply} />)
    fireEvent.click(screen.getByText("Track controls"))
    fireEvent.change(screen.getByRole("slider", { name: "Level Lead" }), { target: { value: "25" } })
    rerender(<CompositionTrackMixPanel key="track_2" track={{ trackRef: "track_2", kind: "instrumental", name: "Keys", gain: 0.8, pan: 0.2, muted: true, clips: [] }} onApply={onApply} />)
    expect(screen.getByRole("slider", { name: "Level Keys" })).toHaveValue("80")
    expect(screen.getByRole("slider", { name: "Pan Keys" })).toHaveValue("20")
    expect(screen.getByRole("button", { name: "Unmute Keys" })).toHaveAttribute("aria-pressed", "true")
  })

  it("labels a non-persisted arrangement baseline as preview only", () => {
    render(<CompositionTrackMixPanel compositionPersisted={false} track={{ trackRef: "track_1", kind: "other", name: "Main", clips: [] }} onApply={vi.fn()} />)

    fireEvent.click(screen.getByText("Track controls"))

    expect(screen.getByText("Preview only")).toBeInTheDocument()
  })

  it("reflects the parent arrangement save state", () => {
    render(<CompositionTrackMixPanel compositionSaveState="saving" track={{ trackRef: "track_1", kind: "other", name: "Main", clips: [] }} onApply={vi.fn()} />)

    fireEvent.click(screen.getByText("Track controls"))

    expect(screen.getByText("Saving…")).toBeInTheDocument()
  })
})
