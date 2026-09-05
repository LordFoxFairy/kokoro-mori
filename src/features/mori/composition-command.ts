import type { MoriRef } from "@/features/mori/domain"
import type { CompositionClip } from "./composition"
import type { CompositionEdit } from "./composition-editor"

export type CompositionCommand =
  | { type: "move_clip"; clip_ref: MoriRef; start_ms: number }
  | { type: "trim_clip"; clip_ref: MoriRef; duration_ms: number }
  | { type: "split_clip"; clip_ref: MoriRef; at_ms: number }
  | { type: "set_fades"; clip_ref: MoriRef; fade_in_ms: number; fade_out_ms: number }

export type CompositionRevisionInput = {
  expected_revision: number
  commands: CompositionCommand[]
}

export function compositionEditToCommand(edit: CompositionEdit): CompositionCommand {
  if (edit.operation === "move") return { type: "move_clip", clip_ref: edit.clipRef, start_ms: edit.startMs }
  if (edit.operation === "trim") return { type: "trim_clip", clip_ref: edit.clipRef, duration_ms: edit.durationMs }
  if (edit.operation === "split") return { type: "split_clip", clip_ref: edit.clipRef, at_ms: edit.atMs }
  return { type: "set_fades", clip_ref: edit.clipRef, fade_in_ms: edit.fadeInMs, fade_out_ms: edit.fadeOutMs }
}

export function createCompositionRevisionInput(expectedRevision: number, commands: CompositionCommand[]): CompositionRevisionInput {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("composition_revision_invalid")
  if (commands.length === 0) throw new Error("composition_commands_empty")
  return { expected_revision: expectedRevision, commands: commands.map((command) => ({ ...command })) }
}

export function compositionClipAt(clips: readonly CompositionClip[], clipRef: MoriRef): CompositionClip {
  const clip = clips.find((item) => item.clipRef === clipRef)
  if (clip === undefined) throw new Error("composition_clip_not_found")
  return clip
}
