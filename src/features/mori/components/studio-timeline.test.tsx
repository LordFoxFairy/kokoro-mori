import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { previewCandidates } from "../preview-data"
import { buildStudioTimelineSections } from "../studio-change"
import { StudioTimeline } from "./studio-timeline"

describe("Studio timeline", () => {
  it("exposes every arrangement section through an accessible horizontal scroll region", () => {
    const candidate = previewCandidates[0]
    const sections = buildStudioTimelineSections(["Intro", "Verse", "Lift", "Chorus", "Outro"], candidate.durationSeconds)
    const selection = sections[3]

    if (selection === undefined) throw new Error("Expected a chorus timeline section")

    render(
      <StudioTimeline
        candidate={candidate}
        sections={sections}
        selection={selection}
        positionSeconds={0}
        playing={false}
        disabled={false}
        onSeek={vi.fn()}
        onSelect={vi.fn()}
      />,
    )

    const timeline = screen.getByRole("region", { name: "Version timeline" })
    const sectionScroller = within(timeline).getByRole("region", { name: "Arrangement sections" })
    const sectionsHintId = sectionScroller.getAttribute("aria-describedby")

    expect(sectionScroller).toHaveAttribute("tabindex", "0")
    expect(sectionsHintId).not.toBeNull()
    if (sectionsHintId !== null) {
      expect(document.getElementById(sectionsHintId)).toHaveTextContent("Swipe horizontally to see all sections")
    }

    const sectionButtons = within(sectionScroller).getAllByRole("button")
    expect(sectionButtons).toHaveLength(5)
    expect(sectionButtons.at(-1)).toHaveAccessibleName("Select Outro section")
  })

  it("exposes the selected range preview without replacing the global transport", () => {
    const candidate = previewCandidates[0]
    const sections = buildStudioTimelineSections(["Intro", "Verse", "Lift", "Chorus", "Outro"], candidate.durationSeconds)
    const selection = sections[3]
    const onPreviewSelection = vi.fn()

    if (selection === undefined) throw new Error("Expected a chorus timeline section")

    render(
      <StudioTimeline
        candidate={candidate}
        sections={sections}
        selection={selection}
        positionSeconds={0}
        playing={false}
        disabled={false}
        onSeek={vi.fn()}
        onSelect={vi.fn()}
        onPreviewSelection={onPreviewSelection}
      />,
    )

    const preview = screen.getByRole("button", { name: "Preview selection" })
    fireEvent.click(preview)
    expect(onPreviewSelection).toHaveBeenCalledTimes(1)
  })

  it("lets the user start the canonical transport from the visible playhead", () => {
    const candidate = previewCandidates[0]
    const sections = buildStudioTimelineSections(["Intro", "Verse", "Lift", "Chorus", "Outro"], candidate.durationSeconds)
    const selection = sections[3]
    const onPreviewFromPlayhead = vi.fn()

    if (selection === undefined) throw new Error("Expected a chorus timeline section")

    render(
      <StudioTimeline
        candidate={candidate}
        sections={sections}
        selection={selection}
        positionSeconds={36}
        playing={false}
        disabled={false}
        onSeek={vi.fn()}
        onSelect={vi.fn()}
        onPreviewFromPlayhead={onPreviewFromPlayhead}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Play from playhead" }))
    expect(onPreviewFromPlayhead).toHaveBeenCalledTimes(1)
  })

  it("returns the canonical transport to the full-song start", () => {
    const candidate = previewCandidates[0]
    const sections = buildStudioTimelineSections(["Intro", "Verse", "Lift", "Chorus", "Outro"], candidate.durationSeconds)
    const selection = sections[3]
    const onBackToStart = vi.fn()

    if (selection === undefined) throw new Error("Expected a chorus timeline section")

    render(
      <StudioTimeline
        candidate={candidate}
        sections={sections}
        selection={selection}
        positionSeconds={36}
        playing={false}
        disabled={false}
        onSeek={vi.fn()}
        onSelect={vi.fn()}
        onBackToStart={onBackToStart}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Back to start" }))
    expect(onBackToStart).toHaveBeenCalledTimes(1)
  })

  it("offers zoom controls without changing the selected arrangement range", () => {
    const candidate = previewCandidates[0]
    const sections = buildStudioTimelineSections(["Intro", "Verse", "Lift", "Chorus", "Outro"], candidate.durationSeconds)
    const selection = sections[3]

    if (selection === undefined) throw new Error("Expected a chorus timeline section")

    render(
      <StudioTimeline
        candidate={candidate}
        sections={sections}
        selection={selection}
        positionSeconds={36}
        playing={false}
        disabled={false}
        onSeek={vi.fn()}
        onSelect={vi.fn()}
      />,
    )

    const timeline = screen.getByRole("region", { name: "Version timeline" })
    const zoom = within(timeline).getByRole("group", { name: "Timeline view" })
    expect(within(zoom).getByRole("status", { name: "Timeline zoom" })).toHaveTextContent("100%")
    expect(within(timeline).getByRole("button", { name: "Zoom out timeline" })).toBeDisabled()

    fireEvent.click(within(zoom).getByRole("button", { name: "Zoom in timeline" }))
    expect(within(zoom).getByRole("status", { name: "Timeline zoom" })).toHaveTextContent("150%")
    expect(within(timeline).getByRole("button", { name: "Select Chorus section" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(within(zoom).getByRole("button", { name: "Fit timeline" }))
    expect(within(zoom).getByRole("status", { name: "Timeline zoom" })).toHaveTextContent("100%")
  })

  it("keeps range looping beside the one-shot preview control", () => {
    const candidate = previewCandidates[0]
    const sections = buildStudioTimelineSections(["Intro", "Verse", "Lift", "Chorus", "Outro"], candidate.durationSeconds)
    const selection = sections[3]
    const onToggleLoopSelection = vi.fn()

    if (selection === undefined) throw new Error("Expected a chorus timeline section")

    render(
      <StudioTimeline
        candidate={candidate}
        sections={sections}
        selection={selection}
        positionSeconds={0}
        playing={false}
        disabled={false}
        onSeek={vi.fn()}
        onSelect={vi.fn()}
        onToggleLoopSelection={onToggleLoopSelection}
      />,
    )

    const loop = screen.getByRole("button", { name: "Loop selection" })
    expect(loop).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(loop)
    expect(onToggleLoopSelection).toHaveBeenCalledTimes(1)
  })
})
