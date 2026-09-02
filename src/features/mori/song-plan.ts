import type { SongPlan, LyricsMode } from "./domain"
import type { SongPlanCreateInput } from "@/lib/mori-api"

export type SongPlanDraftInput = {
  prompt: string
  lyricsMode: LyricsMode
  style: string
  voice: string
  durationSeconds: number
}

export function buildSongPlan(projectRef: string, draft: SongPlanDraftInput): SongPlan {
  const prompt = draft.prompt.trim() || "An open-ended new musical direction."
  const styleParts = draft.style.split("·").map((part) => part.trim()).filter((part) => part !== "")
  const mood = styleParts[0] ?? (draft.lyricsMode === "instrumental" ? "Cinematic" : "Warm and expressive")
  const instruments = styleParts.slice(1).length > 0
    ? styleParts.slice(1, 4).map(capitalize)
    : draft.lyricsMode === "instrumental"
      ? ["Piano", "Warm bass", "Room percussion"]
      : ["Soft synth", "Muted guitar", "Brush drums"]
  const lowerPrompt = `${prompt} ${draft.style}`.toLocaleLowerCase()
  const tempoBpm = lowerPrompt.match(/quiet|slow|piano|late-night|night/u) !== null
    ? 82
    : lowerPrompt.match(/dance|upbeat|energy|club|bright/u) !== null
      ? 118
      : 102

  return {
    songPlanRef: `song_plan_draft_${projectRef}`,
    projectRef,
    prompt,
    mood,
    tempoBpm,
    structure: draft.lyricsMode === "instrumental"
      ? ["Intro", "Theme", "Lift", "Break", "Outro"]
      : ["Intro", "Verse", "Lift", "Chorus", "Outro"],
    instruments,
    vocalDirection: draft.lyricsMode === "instrumental"
      ? "Instrumental arrangement with a clear melodic arc"
      : `${draft.voice.trim() || "Natural lead"} with a focused lift in the chorus`,
    lyricsIntent: draft.lyricsMode === "instrumental"
      ? "A melodic arc shaped by the prompt"
      : `A lyrical thread shaped by: ${prompt}`,
  }
}

export function toSongPlanCreateInput(plan: SongPlan): SongPlanCreateInput {
  return {
    prompt: plan.prompt,
    mood: plan.mood,
    tempo_bpm: plan.tempoBpm,
    structure: plan.structure,
    instruments: plan.instruments,
    vocal_direction: plan.vocalDirection,
    lyrics_intent: plan.lyricsIntent,
  }
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toLocaleUpperCase()}${value.slice(1)}`
}
