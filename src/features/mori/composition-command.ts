import type { MoriRef } from "@/features/mori/domain"
import { cropClip, insertClip, moveClip, setClipFades, splitClip, trimClip, type CompositionClip, type CompositionTrack } from "./composition"
import type { CompositionEdit } from "./composition-editor"

export type CompositionCommand =
  | { type: "move_clip"; clip_ref: MoriRef; start_ms: number }
  | { type: "trim_clip"; clip_ref: MoriRef; duration_ms: number }
  | { type: "crop_clip"; clip_ref: MoriRef; start_offset_ms: number; end_offset_ms: number }
  | { type: "insert_clip"; clip_ref: MoriRef; source_ref: MoriRef; start_ms: number; duration_ms: number; offset_ms: number }
  | { type: "split_clip"; clip_ref: MoriRef; at_ms: number }
  | { type: "set_fades"; clip_ref: MoriRef; fade_in_ms: number; fade_out_ms: number }

export type CompositionRevisionInput = {
  expected_revision: number
  commands: CompositionCommand[]
}

export function compositionEditToCommand(edit: CompositionEdit): CompositionCommand {
  if (edit.operation === "move") return { type: "move_clip", clip_ref: edit.clipRef, start_ms: edit.startMs }
  if (edit.operation === "trim") return { type: "trim_clip", clip_ref: edit.clipRef, duration_ms: edit.durationMs }
  if (edit.operation === "crop") return { type: "crop_clip", clip_ref: edit.clipRef, start_offset_ms: edit.startOffsetMs, end_offset_ms: edit.endOffsetMs }
  if (edit.operation === "insert") return { type: "insert_clip", clip_ref: edit.clip.clipRef, source_ref: edit.clip.sourceRef, start_ms: edit.clip.startMs, duration_ms: edit.clip.durationMs, offset_ms: edit.clip.offsetMs }
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

export function replayCompositionCommands(track: CompositionTrack, commands: readonly CompositionCommand[]): CompositionTrack {
  return commands.reduce((current, command) => {
    if (command.type === "move_clip") return moveClip(current, command.clip_ref, command.start_ms)
    if (command.type === "trim_clip") return trimClip(current, command.clip_ref, command.duration_ms)
    if (command.type === "crop_clip") return cropClip(current, command.clip_ref, command.start_offset_ms, command.end_offset_ms)
    if (command.type === "insert_clip") return insertClip(current, { clipRef: command.clip_ref, sourceRef: command.source_ref, startMs: command.start_ms, durationMs: command.duration_ms, offsetMs: command.offset_ms })
    if (command.type === "split_clip") return splitClip(current, command.clip_ref, command.at_ms)
    return setClipFades(current, command.clip_ref, command.fade_in_ms, command.fade_out_ms)
  }, track)
}
