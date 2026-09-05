import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useCompositionEditor } from "./use-composition-editor"

const track = { trackRef: "track_1", kind: "vocals" as const, name: "Lead", clips: [{ clipRef: "clip_1", sourceRef: "asset_1", startMs: 0, durationMs: 10_000, offsetMs: 0 }] }

describe("useCompositionEditor", () => {
  it("exposes edit, undo and redo state for the studio surface", () => {
    const { result } = renderHook(() => useCompositionEditor(track))
    act(() => result.current.edit({ operation: "move", clipRef: "clip_1", startMs: 2_000 }))
    expect(result.current.composition.clips[0]?.startMs).toBe(2_000)
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undo())
    expect(result.current.composition.clips[0]?.startMs).toBe(0)
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.redo())
    expect(result.current.composition.clips[0]?.startMs).toBe(2_000)
  })
  it("queues an edit and persists it through an injected owner seam", async () => {
    const save = async (input: { expected_revision: number; commands: unknown[] }) => { expect(input.commands).toHaveLength(1) }
    const { result } = renderHook(() => useCompositionEditor(track, save))
    act(() => result.current.editAndQueue({ operation: "split", clipRef: "clip_1", atMs: 2000 }))
    expect(result.current.saveState).toBe("unsaved")
    await act(async () => { await result.current.persist() })
    expect(result.current.saveState).toBe("saved")
  })
})
