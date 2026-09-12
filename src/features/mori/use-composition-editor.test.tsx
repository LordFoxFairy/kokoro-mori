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
  it("surfaces a revision conflict instead of presenting a retry as successful", async () => {
    const save = async () => { throw new Error("composition_conflict") }
    const { result } = renderHook(() => useCompositionEditor({ tracks: [track] }, save, 4))
    act(() => result.current.editAndQueue({ operation: "move", clipRef: "clip_1", startMs: 1000 }))
    await act(async () => { await result.current.persist() })
    expect(result.current.saveState).toBe("conflict")
  })
})
