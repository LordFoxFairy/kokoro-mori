import type { MoriRef } from "@/features/mori/domain"
import { type Composition, type CompositionClip } from "./composition"
import { compositionTrackRefForEdit, type CompositionEdit } from "./composition-editor"
import { applyCompositionEdit } from "./composition-editor"
import { createCompositionHistory } from "./composition-history"

export type CompositionCommand =
  | { type: "move_clip"; track_ref: MoriRef; target_track_ref?: MoriRef; clip_ref: MoriRef; start_ms: number }
  | { type: "trim_clip"; track_ref: MoriRef; clip_ref: MoriRef; duration_ms: number }
  | { type: "crop_clip"; track_ref: MoriRef; clip_ref: MoriRef; start_offset_ms: number; end_offset_ms: number }
  | { type: "insert_clip"; track_ref: MoriRef; clip_ref: MoriRef; source_ref: MoriRef; start_ms: number; duration_ms: number; offset_ms: number }
  | { type: "split_clip"; track_ref: MoriRef; clip_ref: MoriRef; at_ms: number }
  | { type: "set_fades"; track_ref: MoriRef; clip_ref: MoriRef; fade_in_ms: number; fade_out_ms: number }
  | { type: "remove_clip"; track_ref: MoriRef; clip_ref: MoriRef }

export type CompositionRevisionInput = {
  expected_revision: number
  commands: CompositionCommand[]
}

export function compositionEditToCommand(edit: CompositionEdit, composition?: Composition): CompositionCommand {
  const trackRef = edit.trackRef ?? (composition === undefined ? "" : compositionTrackRefForEdit(composition, edit))
  if (trackRef === "") throw new Error("composition_track_required")
  if (edit.operation === "move") return { type: "move_clip", track_ref: trackRef, ...(edit.targetTrackRef === undefined ? {} : { target_track_ref: edit.targetTrackRef }), clip_ref: edit.clipRef, start_ms: edit.startMs }
  if (edit.operation === "trim") return { type: "trim_clip", track_ref: trackRef, clip_ref: edit.clipRef, duration_ms: edit.durationMs }
  if (edit.operation === "crop") return { type: "crop_clip", track_ref: trackRef, clip_ref: edit.clipRef, start_offset_ms: edit.startOffsetMs, end_offset_ms: edit.endOffsetMs }
  if (edit.operation === "insert") return { type: "insert_clip", track_ref: trackRef, clip_ref: edit.clip.clipRef, source_ref: edit.clip.sourceRef, start_ms: edit.clip.startMs, duration_ms: edit.clip.durationMs, offset_ms: edit.clip.offsetMs }
  if (edit.operation === "split") return { type: "split_clip", track_ref: trackRef, clip_ref: edit.clipRef, at_ms: edit.atMs }
  if (edit.operation === "remove") return { type: "remove_clip", track_ref: trackRef, clip_ref: edit.clipRef }
  return { type: "set_fades", track_ref: trackRef, clip_ref: edit.clipRef, fade_in_ms: edit.fadeInMs, fade_out_ms: edit.fadeOutMs }
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

export function replayCompositionCommands(composition: Composition, commands: readonly CompositionCommand[]): Composition {
  return commands.reduce((current, command) => {
    const edit: CompositionEdit = command.type === "move_clip"
      ? { operation: "move", trackRef: command.track_ref, ...(command.target_track_ref === undefined ? {} : { targetTrackRef: command.target_track_ref }), clipRef: command.clip_ref, startMs: command.start_ms }
      : command.type === "trim_clip"
        ? { operation: "trim", trackRef: command.track_ref, clipRef: command.clip_ref, durationMs: command.duration_ms }
        : command.type === "crop_clip"
          ? { operation: "crop", trackRef: command.track_ref, clipRef: command.clip_ref, startOffsetMs: command.start_offset_ms, endOffsetMs: command.end_offset_ms }
          : command.type === "insert_clip"
            ? { operation: "insert", trackRef: command.track_ref, clip: { clipRef: command.clip_ref, sourceRef: command.source_ref, startMs: command.start_ms, durationMs: command.duration_ms, offsetMs: command.offset_ms } }
            : command.type === "split_clip"
              ? { operation: "split", trackRef: command.track_ref, clipRef: command.clip_ref, atMs: command.at_ms }
              : command.type === "remove_clip"
                ? { operation: "remove", trackRef: command.track_ref, clipRef: command.clip_ref }
                : { operation: "fade", trackRef: command.track_ref, clipRef: command.clip_ref, fadeInMs: command.fade_in_ms, fadeOutMs: command.fade_out_ms }
    return applyCompositionEdit(createCompositionHistory({ tracks: current.tracks }), edit).present
  }, composition)
}
