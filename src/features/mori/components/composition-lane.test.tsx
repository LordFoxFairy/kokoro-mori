import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CompositionLane } from "./composition-lane"

describe("CompositionLane", () => {
  it("renders provider-neutral tracks and exposes clip selection", () => {
    const onSelect = vi.fn()
    const onEdit = vi.fn()
    const onDuplicate = vi.fn()
    render(<CompositionLane durationMs={10_000} onDuplicateClip={onDuplicate} onEditClip={onEdit} onSelectClip={onSelect} selectedClipRef="clip_1" tracks={[{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 2_000, durationMs: 4_000, offsetMs: 0 }] }]} />)
    expect(screen.getByRole("region", { name: "Composition tracks" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Lead clip clip_1" }))
    expect(onSelect).toHaveBeenCalledWith("clip_1", "track_1")
    fireEvent.click(screen.getByRole("button", { name: "Split" }))
    expect(onEdit).toHaveBeenCalledWith("split", "clip_1", "track_1")
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }))
    expect(onDuplicate).toHaveBeenCalledWith("clip_1", "track_1")
  })

  it("disables editing while the timeline is busy", () => {
    const onEdit = vi.fn()
    const onSelect = vi.fn()
    render(<CompositionLane disabled durationMs={10_000} onEditClip={onEdit} onSelectClip={onSelect} selectedClipRef="clip_1" tracks={[{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 4_000, offsetMs: 0 }] }]} />)
    expect(screen.getByRole("button", { name: "Split" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Lead clip clip_1" })).toBeDisabled()
  })

  it("inserts a selected source through the composition lane", () => {
    const onInsert = vi.fn()
    render(
      <CompositionLane
        durationMs={10_000}
        insertSources={[{ sourceRef: "version_take_2", label: "Afterglow take", description: "Open horizon", durationMs: 12_000 }]}
        onInsertClip={onInsert}
        tracks={[{ trackRef: "track_1", kind: "other", name: "Main", clips: [] }]}
      />,
    )

    const addClip = screen.getByRole("button", { name: "Add clip" })
    expect(addClip).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(addClip)
    expect(addClip).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(screen.getByRole("button", { name: "Insert Afterglow take into selected range" }))
    expect(onInsert).toHaveBeenCalledWith("version_take_2", "track_1")
    expect(addClip).toHaveAttribute("aria-expanded", "false")
  })
})
