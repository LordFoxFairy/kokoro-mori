import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useCompositionEditor } from "./use-composition-editor"

const track = { trackRef: "track_1", kind: "vocals" as const, name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10_000, offsetMs: 0 }] }

describe("useCompositionEditor", () => {
  it("exposes edit, undo and redo state for the studio surface", () => {
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }))
    act(() => result.current.edit({ operation: "move", clipRef: "clip_1", startMs: 2_000 }))
    expect(result.current.composition[0]?.clips[0]?.startMs).toBe(2_000)
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undo())
    expect(result.current.composition[0]?.clips[0]?.startMs).toBe(0)
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.redo())
    expect(result.current.composition[0]?.clips[0]?.startMs).toBe(2_000)
  })
  it("queues an edit and persists it through an injected owner seam", async () => {
    const save = async (input: { expected_revision: number; commands: unknown[] }) => { expect(input.expected_revision).toBe(4); expect(input.commands).toHaveLength(1) }
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 4))
    act(() => result.current.editAndQueue({ operation: "split", clipRef: "clip_1", atMs: 2000 }))
    expect(result.current.saveState).toBe("unsaved")
    await act(async () => { await result.current.persist() })
    expect(result.current.saveState).toBe("saved")
  })
  it("rebases pending edits on a refreshed projection", () => {
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 2000 }))
    act(() => result.current.rebase({ tracks: [{ ...track, clips: [{ ...track.clips[0], startMs: 1000 }] }] }, 6))
    expect(result.current.composition[0]?.clips[0]?.startMs).toBe(2000)
    expect(result.current.saveState).toBe("unsaved")
  })
  it("keeps rebased commands available for the next save", async () => {
    const requests: { expected_revision: number; commands: unknown[] }[] = []
    const save = async (input: { expected_revision: number; commands: unknown[] }) => { requests.push(input); return { revision: 7 } }
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 4))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 2_000 }))
    act(() => result.current.rebase({ tracks: [{ ...track, clips: [{ ...track.clips[0], startMs: 1_000 }] }] }, 6))
    await act(async () => { await result.current.persist() })
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ expected_revision: 6, commands: [{ type: "move_clip", start_ms: 2_000 }] })
    expect(result.current.saveState).toBe("saved")
  })
  it("keeps the queued command log aligned with undo and redo", async () => {
    const requests: { commands: unknown[] }[] = []
    const save = async (input: { commands: unknown[] }) => { requests.push(input); return { revision: 2 } }
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 1))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 2_000 }))
    act(() => result.current.undo())
    expect(result.current.saveState).toBe("saved")
    await act(async () => { await result.current.persist() })
    expect(requests).toHaveLength(0)
    act(() => result.current.redo())
    await act(async () => { await result.current.persist() })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.commands).toEqual([expect.objectContaining({ type: "move_clip", start_ms: 2_000 })])
  })
  it("redos queued edits in dependency order", () => {
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }))
    act(() => result.current.editAndQueue({ operation: "split", clipRef: "clip_1", atMs: 2_000 }))
    act(() => result.current.editAndQueue({ operation: "move", trackRef: "track_1", clipRef: "clip_1:a", startMs: 3_000 }))
    act(() => { result.current.undo(); result.current.undo() })
    act(() => result.current.redo())
    expect(result.current.composition[0]?.clips).toHaveLength(2)
    act(() => result.current.redo())
    expect(result.current.composition[0]?.clips.find((clip) => clip.clipRef === "clip_1:a")?.startMs).toBe(3_000)
  })
  it("advances the revision cursor after a successful save", async () => {
    const revisions: number[] = []
    const save = async (input: { expected_revision: number; commands: unknown[] }) => { revisions.push(input.expected_revision) }
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 4))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 1000 }))
    await act(async () => { await result.current.persist() })
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 2000 }))
    await act(async () => { await result.current.persist() })
    expect(revisions).toEqual([4, 5])
  })
  it("adopts the owner revision returned by a save", async () => {
    const revisions: number[] = []
    const save = async (input: { expected_revision: number; commands: unknown[] }) => {
      revisions.push(input.expected_revision)
      return { revision: 12 }
    }
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 4))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 1000 }))
    await act(async () => { await result.current.persist() })
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 2000 }))
    await act(async () => { await result.current.persist() })
    expect(revisions).toEqual([4, 12])
  })
  it("adopts a normalized owner composition after a successful save", async () => {
    const ownerComposition = { tracks: [{ ...track, clips: [{ ...track.clips[0], startMs: 1_250 }] }] }
    const save = async () => ({ revision: 9, composition: ownerComposition })
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 4))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 2_000 }))
    await act(async () => { await result.current.persist() })
    expect(result.current.composition[0]?.clips[0]?.startMs).toBe(1_250)
    expect(result.current.canUndo).toBe(false)
  })
  it("reuses an idempotency key when a save fails before confirmation", async () => {
    const keys: string[] = []
    let attempts = 0
    const save = async (_input: { commands: unknown[] }, key: string) => {
      keys.push(key)
      attempts += 1
      if (attempts === 1) throw new Error("network")
      return { revision: 5 }
    }
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 4))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 1_000 }))
    await act(async () => { await result.current.persist() })
    expect(result.current.saveState).toBe("failed")
    await act(async () => { await result.current.persist() })
    expect(result.current.saveState).toBe("saved")
    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })
  it("surfaces a revision conflict instead of presenting a retry as successful", async () => {
    const save = async () => { throw new Error("composition_conflict") }
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 4))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 1000 }))
    await act(async () => { await result.current.persist() })
    expect(result.current.saveState).toBe("conflict")
  })
  it("discards queued edits back to the last saved owner composition", () => {
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 2_000 }))
    act(() => result.current.discard())
    expect(result.current.composition[0]?.clips[0]?.startMs).toBe(0)
    expect(result.current.saveState).toBe("saved")
    expect(result.current.canUndo).toBe(false)
  })
})
