import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CompositionLane } from "./composition-lane"

describe("CompositionLane", () => {
  it("renders provider-neutral tracks and exposes clip selection", () => {
    const onSelect = vi.fn()
    const onEdit = vi.fn()
    const onDuplicate = vi.fn()
    const onDelete = vi.fn()
    render(<CompositionLane durationMs={10_000} onDeleteClip={onDelete} onDuplicateClip={onDuplicate} onEditClip={onEdit} onSelectClip={onSelect} selectedClipRef="clip_1" selectedTrackRef="track_1" tracks={[{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 2_000, durationMs: 4_000, offsetMs: 0 }] }]} />)
    expect(screen.getByRole("region", { name: "Composition tracks" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Lead clip Audio clip · 0:04" }))
    expect(onSelect).toHaveBeenCalledWith("clip_1", "track_1")
    fireEvent.click(screen.getByRole("button", { name: "Split" }))
    expect(onEdit).toHaveBeenCalledWith("split", "clip_1", "track_1")
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }))
    expect(onDuplicate).toHaveBeenCalledWith("clip_1", "track_1")
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(onDelete).toHaveBeenCalledWith("clip_1", "track_1")
    fireEvent.keyDown(screen.getByRole("button", { name: "Lead clip Audio clip · 0:04" }), { key: "Delete" })
    expect(onDelete).toHaveBeenCalledTimes(2)
  })

  it("disables editing while the timeline is busy", () => {
    const onEdit = vi.fn()
    const onSelect = vi.fn()
    render(<CompositionLane disabled durationMs={10_000} onEditClip={onEdit} onSelectClip={onSelect} selectedClipRef="clip_1" selectedTrackRef="track_1" tracks={[{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 4_000, offsetMs: 0 }] }]} />)
    expect(screen.getByRole("button", { name: "Split" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Lead clip Audio clip · 0:04" })).toBeDisabled()
  })

  it("inserts a selected source through the composition lane", () => {
    const onInsert = vi.fn()
    render(
      <CompositionLane
        durationMs={10_000}
        insertSources={[{ sourceRef: "version_take_2", label: "Afterglow take", description: "Open horizon", durationMs: 12_000 }]}
        onInsertClip={onInsert}
        selectedTrackRef="track_1"
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

  it("keeps selection scoped to the selected track when clip refs repeat", () => {
    render(<CompositionLane durationMs={10_000} selectedClipRef="clip_1" selectedTrackRef="track_2" tracks={[
      { trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 4_000, offsetMs: 0 }] },
      { trackRef: "track_2", kind: "instrumental", name: "Keys", clips: [{ clipRef: "clip_1", sourceRef: "asset_2", startMs: 0, durationMs: 4_000, offsetMs: 0 }] },
    ]} />)
    const clips = screen.getAllByRole("button", { name: /clip Audio clip/u })
    expect(clips[0]).toHaveAttribute("data-selected", "false")
    expect(clips[1]).toHaveAttribute("data-selected", "true")
  })

  it("renders a human-readable source label instead of exposing the clip ref", () => {
    render(<CompositionLane durationMs={10_000} resolveClipLabel={() => "Afterglow take"} tracks={[{ trackRef: "track_1", kind: "other", name: "Main", clips: [{ clipRef: "version_2:insert-1", sourceRef: "version_2", startMs: 0, durationMs: 4_000, offsetMs: 0 }] }]} />)
    expect(screen.getByRole("button", { name: "Main clip Afterglow take · 0:04" })).toHaveTextContent("Afterglow take")
    expect(screen.queryByText("version_2:insert-1")).not.toBeInTheDocument()
  })

  it("allows an empty track to become the insertion target", () => {
    const onSelectTrack = vi.fn()
    render(<CompositionLane durationMs={10_000} onSelectTrack={onSelectTrack} tracks={[{ trackRef: "track_1", kind: "other", name: "Main", clips: [] }, { trackRef: "track_2", kind: "vocals", name: "Backing vocal", clips: [] }]} />)
    fireEvent.click(screen.getByRole("button", { name: "Select Backing vocal track" }))
    expect(onSelectTrack).toHaveBeenCalledWith("track_2")
  })

  it("moves a clip when it is dropped onto its track timeline", () => {
    const onMove = vi.fn()
    const { container } = render(<CompositionLane durationMs={10_000} onMoveClip={onMove} tracks={[{ trackRef: "track_1", kind: "other", name: "Main", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 4_000, offsetMs: 0 }] }]} />)
    const rail = container.querySelector('[class*="clipRail"]')
    const clip = screen.getByRole("button", { name: "Main clip Audio clip · 0:04" })
    if (!(rail instanceof HTMLElement)) throw new Error("Expected a clip rail")
    Object.defineProperty(rail, "getBoundingClientRect", { value: () => ({ left: 10, width: 100 }) })
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "none",
      setData: vi.fn(),
      getData: vi.fn(() => JSON.stringify({ clipRef: "clip_1", trackRef: "track_1" })),
    }
    fireEvent.dragStart(clip, { dataTransfer })
    act(() => {
      const drop = new Event("drop", { bubbles: true })
      Object.defineProperties(drop, { clientX: { value: 50 }, dataTransfer: { value: dataTransfer } })
      rail.dispatchEvent(drop)
    })
    expect(dataTransfer.setData).toHaveBeenCalledWith("application/x-mori-composition-clip", JSON.stringify({ clipRef: "clip_1", trackRef: "track_1" }))
    expect(onMove).toHaveBeenCalledWith("clip_1", "track_1", 4_000)
  })

  it("moves a clip to another track when dropped on its timeline", () => {
    const onMove = vi.fn()
    const { container } = render(<CompositionLane durationMs={10_000} onMoveClip={onMove} tracks={[
      { trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 4_000, offsetMs: 0 }] },
      { trackRef: "track_2", kind: "instrumental", name: "Keys", clips: [] },
    ]} />)
    const rails = Array.from(container.querySelectorAll('[class*="clipRail"]'))
    const sourceClip = screen.getByRole("button", { name: "Lead clip Audio clip · 0:04" })
    const targetRail = rails[1]
    if (!(targetRail instanceof HTMLElement)) throw new Error("Expected a destination clip rail")
    Object.defineProperty(targetRail, "getBoundingClientRect", { value: () => ({ left: 10, width: 100 }) })
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "none",
      setData: vi.fn(),
      getData: vi.fn(() => JSON.stringify({ clipRef: "clip_1", trackRef: "track_1" })),
    }
    fireEvent.dragStart(sourceClip, { dataTransfer })
    fireEvent.dragOver(targetRail, { dataTransfer })
    expect(targetRail).toHaveAttribute("data-drop-target", "true")
    act(() => {
      const drop = new Event("drop", { bubbles: true })
      Object.defineProperties(drop, { clientX: { value: 50 }, dataTransfer: { value: dataTransfer } })
      targetRail.dispatchEvent(drop)
    })
    expect(onMove).toHaveBeenCalledWith("clip_1", "track_1", 4_000, "track_2")
    expect(targetRail).toHaveAttribute("data-drop-target", "false")
  })

  it("inserts an audio source at the dropped time and highlights the target track", () => {
    const onDropSource = vi.fn()
    const { container } = render(<CompositionLane durationMs={10_000} dropSources={[{ sourceRef: "source_room", label: "Room tone", description: "Brushed pulse", durationMs: 4_000 }]} onDropSource={onDropSource} tracks={[{ trackRef: "track_1", kind: "other", name: "Main", clips: [] }, { trackRef: "track_2", kind: "vocals", name: "Lead", clips: [] }]} />)
    const rails = Array.from(container.querySelectorAll('[class*="clipRail"]'))
    const targetRail = rails[1]
    if (!(targetRail instanceof HTMLElement)) throw new Error("Expected an audio drop target")
    Object.defineProperty(targetRail, "getBoundingClientRect", { value: () => ({ left: 10, width: 100 }) })
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "none",
      getData: vi.fn((type: string) => type === "application/x-mori-composition-source" ? JSON.stringify({ sourceRef: "source_room" }) : ""),
    }

    fireEvent.dragOver(targetRail, { dataTransfer })
    expect(targetRail).toHaveAttribute("data-drop-target", "true")
    expect(targetRail).toHaveAttribute("data-drop-kind", "source")
    act(() => {
      const drop = new Event("drop", { bubbles: true })
      Object.defineProperties(drop, { clientX: { value: 50 }, dataTransfer: { value: dataTransfer } })
      targetRail.dispatchEvent(drop)
    })

    expect(onDropSource).toHaveBeenCalledWith("source_room", "track_2", 4_000)
    expect(targetRail).toHaveAttribute("data-drop-target", "false")
  })
})
