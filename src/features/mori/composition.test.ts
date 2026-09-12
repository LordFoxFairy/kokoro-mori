import { describe, expect, it } from "vitest"
import { createCompositionPlacementRef, cropClip, insertClip, moveClip, moveClipToTrack, removeClip, setClipFades, splitClip, trimClip, type CompositionTrack } from "./composition"

const track: CompositionTrack = { trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10000, offsetMs: 0 }] }

describe("composition placement identity", () => {
  it("creates a unique opaque ref under the requested namespace", () => {
    const first = createCompositionPlacementRef("version_1:track_1")
    const second = createCompositionPlacementRef("version_1:track_1")
    expect(first).toMatch(/^version_1:track_1:placement-/u)
    expect(second).toMatch(/^version_1:track_1:placement-/u)
    expect(second).not.toBe(first)
  })

  it("rejects an empty placement namespace", () => {
    expect(() => createCompositionPlacementRef("  ")).toThrow("composition_placement_namespace_required")
  })
})

describe("composition primitives", () => {
  it("moves and sorts a clip without changing source identity", () => {
    const moved = moveClip(track, "clip_1", 2500)
    expect(moved.clips[0]).toMatchObject({ clipRef: "clip_1", sourceRef: "asset_1", startMs: 2500 })
  })
  it("moves a clip between tracks without changing its source or offset", () => {
    const target: CompositionTrack = { trackRef: "track_2", kind: "instrumental", name: "Keys", clips: [] }
    const moved = moveClipToTrack({ tracks: [track, target] }, "track_1", "track_2", "clip_1", 2500)
    expect(moved.tracks[0]?.clips).toEqual([])
    expect(moved.tracks[1]?.clips[0]).toMatchObject({ clipRef: "clip_1", sourceRef: "asset_1", startMs: 2500, offsetMs: 0 })
  })
  it("trims within the existing clip duration", () => expect(trimClip(track, "clip_1", 4000).clips[0]?.durationMs).toBe(4000))
  it("splits into two placements with continuous offsets", () => {
    expect(splitClip(track, "clip_1", 4000).clips).toEqual([
      { ...track.clips[0], clipRef: "clip_1:a", durationMs: 4000 },
      { ...track.clips[0], clipRef: "clip_1:b", startMs: 4000, offsetMs: 4000, durationMs: 6000 },
    ])
  })
  it("rejects an invalid split boundary", () => expect(() => splitClip(track, "clip_1", 10000)).toThrow("composition_split_position_invalid"))
  it("sets fades without allowing them to consume the clip", () => {
    expect(setClipFades(track, "clip_1", 500, 750).clips[0]).toMatchObject({ fadeInMs: 500, fadeOutMs: 750 })
    expect(() => setClipFades(track, "clip_1", 6000, 5000)).toThrow("composition_fade_exceeds_clip")
  })
  it("crops both edges while preserving source offset", () => {
    expect(cropClip(track, "clip_1", 1000, 2000).clips[0]).toMatchObject({ startMs: 1000, offsetMs: 1000, durationMs: 7000 })
  })
  it("inserts a new clip in timeline order", () => {
    expect(insertClip(track, { clipRef: "clip_2", sourceRef: "asset_2", startMs: 12000, durationMs: 1000, offsetMs: 0 }).clips.at(-1)?.clipRef).toBe("clip_2")
    expect(() => insertClip(track, { clipRef: "clip_1", sourceRef: "asset_2", startMs: 1, durationMs: 1, offsetMs: 0 })).toThrow("composition_clip_exists")
  })
  it("removes a clip while leaving the rest of the track intact", () => {
    expect(removeClip({ ...track, clips: [...track.clips, { clipRef: "clip_2", sourceRef: "asset_2", startMs: 12_000, durationMs: 1_000, offsetMs: 0 }] }, "clip_1").clips).toEqual([{ clipRef: "clip_2", sourceRef: "asset_2", startMs: 12_000, durationMs: 1_000, offsetMs: 0 }])
    expect(() => removeClip(track, "missing")).toThrow("composition_clip_not_found")
  })
})
