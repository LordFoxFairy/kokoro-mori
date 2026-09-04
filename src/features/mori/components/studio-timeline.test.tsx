import { render, screen, within } from "@testing-library/react"
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
})
