import { describe, expect, it } from "vitest"
import { moveClip, setClipFades, splitClip, trimClip, type CompositionTrack } from "./composition"

const track: CompositionTrack = { trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10000, offsetMs: 0 }] }

describe("composition primitives", () => {
  it("moves and sorts a clip without changing source identity", () => {
    const moved = moveClip(track, "clip_1", 2500)
    expect(moved.clips[0]).toMatchObject({ clipRef: "clip_1", sourceRef: "asset_1", startMs: 2500 })
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
})
