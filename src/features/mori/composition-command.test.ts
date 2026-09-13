import { describe, expect, it } from "vitest"
import { compositionClipAt, compositionEditToCommand, createCompositionRevisionInput, replayCompositionCommands } from "./composition-command"

describe("composition revision command", () => {
  it("creates a stable snake_case revision input", () => {
    expect(createCompositionRevisionInput(3, [{ type: "set_fades", track_ref: "track_1", clip_ref: "clip_1", fade_in_ms: 250, fade_out_ms: 500 }])).toEqual({
      expected_revision: 3,
      commands: [{ type: "set_fades", track_ref: "track_1", clip_ref: "clip_1", fade_in_ms: 250, fade_out_ms: 500 }],
    })
  })
  it("rejects empty or invalid revisions", () => {
    expect(() => createCompositionRevisionInput(-1, [{ type: "move_clip", track_ref: "track_1", clip_ref: "clip_1", start_ms: 0 }])).toThrow("composition_revision_invalid")
    expect(() => createCompositionRevisionInput(0, [])).toThrow("composition_commands_empty")
  })
  it("keeps missing clip errors explicit", () => expect(() => compositionClipAt([], "clip_1")).toThrow("composition_clip_not_found"))
  it("serializes an editor edit without provider fields", () => expect(compositionEditToCommand({ operation: "move", trackRef: "track_1", clipRef: "clip_1", startMs: 1500 })).toEqual({ type: "move_clip", track_ref: "track_1", clip_ref: "clip_1", start_ms: 1500 }))
  it("serializes and replays a cross-track move", () => {
    const command = compositionEditToCommand({ operation: "move", trackRef: "track_1", targetTrackRef: "track_2", clipRef: "clip_1", startMs: 2_000 })
    expect(command).toEqual({ type: "move_clip", track_ref: "track_1", target_track_ref: "track_2", clip_ref: "clip_1", start_ms: 2_000 })
    const composition = replayCompositionCommands({ tracks: [
      { trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10_000, offsetMs: 0 }] },
      { trackRef: "track_2", kind: "instrumental", name: "Keys", clips: [] },
    ] }, [command])
    expect(composition.tracks[0]?.clips).toEqual([])
    expect(composition.tracks[1]?.clips[0]).toMatchObject({ clipRef: "clip_1", startMs: 2_000 })
  })
  it("serializes and replays a track mix edit", () => {
    const command = compositionEditToCommand({ operation: "mix", trackRef: "track_1", gain: 0.7, pan: -0.25, muted: true })
    expect(command).toEqual({ type: "set_track_mix", track_ref: "track_1", gain: 0.7, pan: -0.25, muted: true })
    expect(replayCompositionCommands({ tracks: [{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [] }] }, [command]).tracks[0]).toMatchObject({ gain: 0.7, pan: -0.25, muted: true })
  })
  it("serializes removal and replays it on a refreshed projection", () => {
    const command = compositionEditToCommand({ operation: "remove", trackRef: "track_1", clipRef: "clip_1" })
    expect(command).toEqual({ type: "remove_clip", track_ref: "track_1", clip_ref: "clip_1" })
    expect(replayCompositionCommands({ tracks: [{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10000, offsetMs: 0 }] }] }, [command]).tracks[0]?.clips).toEqual([])
  })
  it("replays pending commands on a refreshed projection", () => expect(replayCompositionCommands({ tracks: [{ trackRef: "track_1", kind: "vocals", name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10000, offsetMs: 0 }] }] }, [{ type: "move_clip", track_ref: "track_1", clip_ref: "clip_1", start_ms: 2000 }]).tracks[0]?.clips[0]?.startMs).toBe(2000))
})
