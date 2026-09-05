import type { MoriRef } from "@/features/mori/domain"

export type CompositionClip = { clipRef: MoriRef; sourceRef: MoriRef; startMs: number; durationMs: number; offsetMs: number; fadeInMs?: number; fadeOutMs?: number }
export type CompositionTrack = { trackRef: MoriRef; kind: "vocals" | "instrumental" | "other"; name: string; clips: CompositionClip[] }

export function moveClip(track: CompositionTrack, clipRef: MoriRef, startMs: number): CompositionTrack {
  if (!Number.isSafeInteger(startMs) || startMs < 0) throw new Error("composition_start_invalid")
  const clip = track.clips.find((item) => item.clipRef === clipRef)
  if (clip === undefined) throw new Error("composition_clip_not_found")
  return { ...track, clips: track.clips.map((item) => item.clipRef === clipRef ? { ...item, startMs } : item).sort((left, right) => left.startMs - right.startMs) }
}

export function trimClip(track: CompositionTrack, clipRef: MoriRef, durationMs: number): CompositionTrack {
  if (!Number.isSafeInteger(durationMs) || durationMs < 1) throw new Error("composition_duration_invalid")
  const clip = track.clips.find((item) => item.clipRef === clipRef)
  if (clip === undefined) throw new Error("composition_clip_not_found")
  if (durationMs > clip.durationMs) throw new Error("composition_trim_exceeds_clip")
  return { ...track, clips: track.clips.map((item) => item.clipRef === clipRef ? { ...item, durationMs } : item) }
}

export function cropClip(track: CompositionTrack, clipRef: MoriRef, startOffsetMs: number, endOffsetMs: number): CompositionTrack {
  if (![startOffsetMs, endOffsetMs].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("composition_crop_invalid")
  const clip = track.clips.find((item) => item.clipRef === clipRef)
  if (clip === undefined) throw new Error("composition_clip_not_found")
  if (startOffsetMs + endOffsetMs >= clip.durationMs) throw new Error("composition_crop_exceeds_clip")
  return { ...track, clips: track.clips.map((item) => item.clipRef === clipRef ? { ...item, startMs: item.startMs + startOffsetMs, offsetMs: item.offsetMs + startOffsetMs, durationMs: item.durationMs - startOffsetMs - endOffsetMs } : item) }
}

export function splitClip(track: CompositionTrack, clipRef: MoriRef, atMs: number): CompositionTrack {
  const clip = track.clips.find((item) => item.clipRef === clipRef)
  if (clip === undefined) throw new Error("composition_clip_not_found")
  if (!Number.isSafeInteger(atMs) || atMs <= 0 || atMs >= clip.durationMs) throw new Error("composition_split_position_invalid")
  const index = track.clips.indexOf(clip)
  const left = { ...clip, clipRef: `${clip.clipRef}:a`, durationMs: atMs }
  const right = { ...clip, clipRef: `${clip.clipRef}:b`, startMs: clip.startMs + atMs, offsetMs: clip.offsetMs + atMs, durationMs: clip.durationMs - atMs }
  return { ...track, clips: [...track.clips.slice(0, index), left, right, ...track.clips.slice(index + 1)] }
}

export function setClipFades(track: CompositionTrack, clipRef: MoriRef, fadeInMs: number, fadeOutMs: number): CompositionTrack {
  if (![fadeInMs, fadeOutMs].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("composition_fade_invalid")
  const clip = track.clips.find((item) => item.clipRef === clipRef)
  if (clip === undefined) throw new Error("composition_clip_not_found")
  if (fadeInMs + fadeOutMs > clip.durationMs) throw new Error("composition_fade_exceeds_clip")
  return { ...track, clips: track.clips.map((item) => item.clipRef === clipRef ? { ...item, fadeInMs, fadeOutMs } : item) }
}
