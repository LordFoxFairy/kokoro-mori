import type { MoriCurrentSongPlanRevision } from "@/lib/mori-api"
import { previewSongPlan } from "./preview-data"

export const previewCurrentSongPlanRevision: MoriCurrentSongPlanRevision = {
  song_plan_ref: previewSongPlan.songPlanRef,
  project_ref: previewSongPlan.projectRef,
  revision: 1,
  prompt: previewSongPlan.prompt,
  mood: previewSongPlan.mood,
  tempo_bpm: previewSongPlan.tempoBpm,
  structure: previewSongPlan.structure,
  instruments: previewSongPlan.instruments,
  vocal_direction: previewSongPlan.vocalDirection,
  lyrics_intent: previewSongPlan.lyricsIntent,
  created_at: "2026-09-04T18:00:00.000Z",
}
