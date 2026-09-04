import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { previewCandidates, previewGeneration, previewSongPlan } from "../preview-data"
import { InspectorPanel } from "./inspector-panel"

describe("Mori generation queue", () => {
  it("keeps every generated direction connected to its Studio context", () => {
    render(
      <InspectorPanel
        projectRef="project_queue_1"
        generation={{ ...previewGeneration, status: "succeeded", progress: 100 }}
        candidates={previewCandidates}
        songPlan={previewSongPlan}
        selectedCandidateRef={previewCandidates[0].candidateRef}
        playing={false}
        onSelect={vi.fn()}
        onPromote={vi.fn()}
        onPlay={vi.fn()}
      />,
    )

    expect(screen.getByRole("link", { name: "Open Studio for First Light" })).toHaveAttribute(
      "href",
      "/projects/project_queue_1/studio/version_preview_first_light_a",
    )
    expect(screen.getByRole("link", { name: "Open Studio for First Light · Afterglow" })).toHaveAttribute(
      "href",
      "/projects/project_queue_1/studio/version_preview_first_light_b",
    )
  })

  it("exposes cancellation while a generation is active", () => {
    const onCancel = vi.fn()

    render(
      <InspectorPanel
        projectRef="project_preview_first_light"
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
        projectRef="project_preview_first_light"
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

  it("keeps keyboard focus inside the queue and restores the opener", async () => {
    const opener = document.createElement("button")
    opener.type = "button"
    opener.textContent = "Open queue"
    document.body.appendChild(opener)
    opener.focus()

    const { unmount } = render(
      <InspectorPanel
        projectRef="project_preview_first_light"
        generation={{ ...previewGeneration, status: "succeeded", progress: 100 }}
        candidates={previewCandidates}
        songPlan={previewSongPlan}
        selectedCandidateRef={previewCandidates[0].candidateRef}
        playing={false}
        onSelect={vi.fn()}
        onPromote={vi.fn()}
        onPlay={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole("dialog", { name: "Generation queue" })).toHaveAttribute("aria-modal", "true")
    const queue = screen.getByRole("dialog", { name: "Generation queue" })
    await waitFor(() => expect(queue).toHaveFocus())
    const close = screen.getByRole("button", { name: "Close generation queue" })
    const lastControl = screen.getByRole("button", { name: "Set as current" })

    close.focus()
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true })
    expect(lastControl).toHaveFocus()

    lastControl.focus()
    fireEvent.keyDown(window, { key: "Tab" })
    expect(close).toHaveFocus()

    unmount()
    expect(opener).toHaveFocus()
    opener.remove()
  })
})
