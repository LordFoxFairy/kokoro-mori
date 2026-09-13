import type { MoriRef } from "@/features/mori/domain"

export type CompositionClip = { clipRef: MoriRef; sourceRef: MoriRef; startMs: number; durationMs: number; offsetMs: number; fadeInMs?: number; fadeOutMs?: number }
export type CompositionTrackMix = { gain: number; pan: number; muted: boolean }
export type CompositionTrack = { trackRef: MoriRef; kind: "vocals" | "instrumental" | "other"; name: string; clips: CompositionClip[]; gain?: number; pan?: number; muted?: boolean }
export type Composition = { tracks: CompositionTrack[] }

export function compositionTrackMix(track: CompositionTrack): CompositionTrackMix {
  return { gain: track.gain ?? 1, pan: track.pan ?? 0, muted: track.muted ?? false }
}

/** Generate an opaque identity for a new timeline placement. Existing placements keep their clipRef across edits. */
export function createCompositionPlacementRef(namespace: string): MoriRef {
  const normalizedNamespace = namespace.trim()
  if (normalizedNamespace === "") throw new Error("composition_placement_namespace_required")
  const randomUuid = globalThis.crypto?.randomUUID?.()
  const entropy = randomUuid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${normalizedNamespace}:placement-${entropy}`
}

export function insertClip(track: CompositionTrack, clip: CompositionClip): CompositionTrack {
  if (clip.startMs < 0 || clip.durationMs < 1 || clip.offsetMs < 0) throw new Error("composition_clip_invalid")
  if (track.clips.some((item) => item.clipRef === clip.clipRef)) throw new Error("composition_clip_exists")
  return { ...track, clips: [...track.clips, { ...clip }].sort((left, right) => left.startMs - right.startMs) }
}

export function removeClip(track: CompositionTrack, clipRef: MoriRef): CompositionTrack {
  if (!track.clips.some((clip) => clip.clipRef === clipRef)) throw new Error("composition_clip_not_found")
  return { ...track, clips: track.clips.filter((clip) => clip.clipRef !== clipRef) }
}

export function setTrackMix(track: CompositionTrack, mix: CompositionTrackMix): CompositionTrack {
  if (!Number.isFinite(mix.gain) || mix.gain < 0 || mix.gain > 1) throw new Error("composition_gain_invalid")
  if (!Number.isFinite(mix.pan) || mix.pan < -1 || mix.pan > 1) throw new Error("composition_pan_invalid")
  if (typeof mix.muted !== "boolean") throw new Error("composition_mute_invalid")
  return { ...track, gain: mix.gain, pan: mix.pan, muted: mix.muted }
}

export function moveClip(track: CompositionTrack, clipRef: MoriRef, startMs: number): CompositionTrack {
  if (!Number.isSafeInteger(startMs) || startMs < 0) throw new Error("composition_start_invalid")
  const clip = track.clips.find((item) => item.clipRef === clipRef)
  if (clip === undefined) throw new Error("composition_clip_not_found")
  return { ...track, clips: track.clips.map((item) => item.clipRef === clipRef ? { ...item, startMs } : item).sort((left, right) => left.startMs - right.startMs) }
}

export function moveClipToTrack(composition: Composition, sourceTrackRef: MoriRef, targetTrackRef: MoriRef, clipRef: MoriRef, startMs: number): Composition {
  if (sourceTrackRef === targetTrackRef) {
    return { tracks: composition.tracks.map((track) => track.trackRef === sourceTrackRef ? moveClip(track, clipRef, startMs) : track) }
  }
  const sourceTrack = composition.tracks.find((track) => track.trackRef === sourceTrackRef)
  const targetTrack = composition.tracks.find((track) => track.trackRef === targetTrackRef)
  if (sourceTrack === undefined || targetTrack === undefined) throw new Error("composition_track_not_found")
  const clip = sourceTrack.clips.find((item) => item.clipRef === clipRef)
  if (clip === undefined) throw new Error("composition_clip_not_found")
  if (targetTrack.clips.some((item) => item.clipRef === clipRef)) throw new Error("composition_clip_exists")
  const movedClip = { ...clip, startMs }
  return {
    tracks: composition.tracks.map((track) => track.trackRef === sourceTrackRef
      ? { ...track, clips: track.clips.filter((item) => item.clipRef !== clipRef) }
      : track.trackRef === targetTrackRef
        ? insertClip(track, movedClip)
        : track),
  }
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
