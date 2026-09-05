import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CompositionLane } from "./composition-lane"

describe("CompositionLane", () => {
  it("renders provider-neutral tracks and exposes clip selection", () => {
    const onSelect = vi.fn()
    render(<CompositionLane durationMs={10_000} onSelectClip={onSelect} tracks={[{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 2_000, durationMs: 4_000, offsetMs: 0 }] }]} />)
    expect(screen.getByRole("region", { name: "Composition tracks" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Lead clip clip_1" }))
    expect(onSelect).toHaveBeenCalledWith("clip_1")
  })
})
