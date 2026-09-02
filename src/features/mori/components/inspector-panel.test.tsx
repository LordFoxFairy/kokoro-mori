import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { previewCandidates, previewGeneration, previewSongPlan } from "../preview-data"
import { InspectorPanel } from "./inspector-panel"

describe("Mori generation queue", () => {
  it("exposes cancellation while a generation is active", () => {
    const onCancel = vi.fn()

    render(
      <InspectorPanel
        generation={{ ...previewGeneration, status: "generating", progress: 52 }}
        candidates={previewCandidates}
        songPlan={previewSongPlan}
        selectedCandidateRef={previewCandidates[0].candidateRef}
        playing={false}
        onSelect={vi.fn()}
        onPromote={vi.fn()}
        onPlay={vi.fn()}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Cancel generation" }))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("explains a completed run with no playable directions", () => {
    const onRetry = vi.fn()

    render(
      <InspectorPanel
        generation={{ ...previewGeneration, status: "succeeded", progress: 100 }}
        candidates={[]}
        songPlan={previewSongPlan}
        selectedCandidateRef=""
        playing={false}
        onSelect={vi.fn()}
        onPromote={vi.fn()}
        onPlay={vi.fn()}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText("No playable directions yet")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
