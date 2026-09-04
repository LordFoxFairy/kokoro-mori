import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { previewCandidates, previewGeneration, previewSongPlan } from "../preview-data"
import { InspectorPanel } from "./inspector-panel"

describe("Mori generation queue", () => {
  it("stays non-modal and leaves focus in Create when used as a desktop pane", () => {
    const createInput = document.createElement("textarea")
    document.body.appendChild(createInput)
    createInput.focus()

    const { unmount } = render(
      <InspectorPanel
        presentation="pane"
        projectRef={null}
        generation={null}
        candidates={[]}
        songPlan={null}
        selectedCandidateRef=""
        playing={false}
        onSelect={vi.fn()}
        onPromote={vi.fn()}
        onPlay={vi.fn()}
      />,
    )

    expect(screen.getByRole("complementary", { name: "Generation queue" })).not.toHaveAttribute("aria-modal")
    expect(createInput).toHaveFocus()

    unmount()
    createInput.remove()
  })

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

  it("routes Studio changes back to Studio instead of switching Create context", () => {
    const onSelectGeneration = vi.fn()
    render(
      <InspectorPanel
        projectRef="project_queue_1"
        generation={null}
        queueItems={[{
          generation_ref: "generation_studio_queue",
          project_ref: "project_queue_1",
          source_version_ref: "version_queue_1",
          kind: "studio_change",
          label: "Restyle · Whole song",
          created_at: "2026-09-04T12:00:00.000Z",
          status: "generating",
          progress: 44,
          candidate_refs: [],
          last_event_id: null,
        }]}
        activeGenerationRef={null}
        candidates={[]}
        songPlan={null}
        selectedCandidateRef=""
        playing={false}
        onSelect={vi.fn()}
        onPromote={vi.fn()}
        onPlay={vi.fn()}
        onSelectGeneration={onSelectGeneration}
      />,
    )

    const studioLink = screen.getByRole("link", { name: "Open Studio run Restyle · Whole song" })
    expect(studioLink).toHaveAttribute("href", "/projects/project_queue_1/studio/version_queue_1?generation_ref=generation_studio_queue")
    expect(onSelectGeneration).not.toHaveBeenCalled()
  })

  it("makes the paused direction selection explicit and keyboard reachable", () => {
    const onSelect = vi.fn()

    render(
      <InspectorPanel
        projectRef="project_queue_1"
        generation={{ ...previewGeneration, status: "succeeded", progress: 100 }}
        candidates={previewCandidates}
        songPlan={previewSongPlan}
        selectedCandidateRef={previewCandidates[0].candidateRef}
        playing={false}
        onSelect={onSelect}
        onPromote={vi.fn()}
        onPlay={vi.fn()}
      />,
    )

    const selectedDirection = screen.getByRole("button", { name: "Select First Light direction" })
    const nextDirection = screen.getByRole("button", { name: "Select First Light · Afterglow direction" })
    expect(selectedDirection).toHaveAttribute("aria-pressed", "true")
    expect(selectedDirection.closest("article")).toHaveAttribute("data-selected", "true")
    expect(nextDirection).toHaveAttribute("aria-pressed", "false")
    expect(nextDirection.closest("article")).toHaveAttribute("data-selected", "false")

    fireEvent.click(nextDirection)
    expect(onSelect).toHaveBeenCalledWith(previewCandidates[1])
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
