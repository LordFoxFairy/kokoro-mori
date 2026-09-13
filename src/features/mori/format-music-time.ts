export type MusicTimeRounding = "floor" | "round"

/** Format a media duration without exposing floating-point transport values. */
export function formatMusicTime(seconds: number, rounding: MusicTimeRounding = "round"): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const totalSeconds = rounding === "floor" ? Math.floor(safeSeconds) : Math.round(safeSeconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remaining = String(totalSeconds % 60).padStart(2, "0")
  return `${minutes}:${remaining}`
}

/** Recording controls use a clock-like, two-digit minute display. */
export function formatRecordingTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const totalSeconds = Math.floor(safeSeconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remaining = String(totalSeconds % 60).padStart(2, "0")
  return `${String(minutes).padStart(2, "0")}:${remaining}`
}
