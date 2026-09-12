import type { Candidate, Generation, LibraryItem, PlayerState, Project, SongPlan, Version } from "./domain"

export const previewProject: Project = {
  projectRef: "project_preview_first_light",
  title: "First Light",
  description: "A bright, patient song about finding your way home.",
  coverAccent: "lavender",
  currentVersionRef: "version_preview_first_light_a",
  candidateCount: 2,
  lastActivity: "Just now",
}

export const previewSongPlan: SongPlan = {
  songPlanRef: "song_plan_preview_first_light",
  projectRef: previewProject.projectRef,
  prompt: "A warm, late-night track for the drive home, slowly opening into sunrise.",
  mood: "Warm · hopeful",
  tempoBpm: 102,
  structure: ["Intro", "Verse", "Lift", "Chorus", "Outro"],
  instruments: ["Soft synth", "Muted guitar", "Brush drums"],
  vocalDirection: "Intimate lead vocal with a gentle lift in the chorus",
  lyricsIntent: "Small moments becoming a reason to keep going",
}

export const previewGeneration: Generation = {
  generationRef: "generation_preview_first_light",
  projectRef: previewProject.projectRef,
  songPlanRef: previewSongPlan.songPlanRef,
  status: "succeeded",
  progress: 100,
  label: "Two new directions",
  candidateRefs: ["candidate_preview_first_light_a", "candidate_preview_first_light_b"],
  createdAt: "Just now",
}

export const previewCandidates: Candidate[] = [
  {
    candidateRef: "candidate_preview_first_light_a",
    versionRef: "version_preview_first_light_a",
    generationRef: previewGeneration.generationRef,
    title: "First Light",
    subtitle: "Gentle pulse · intimate vocal",
    durationSeconds: 182,
    mood: "Warm",
    waveformSeed: 11,
    isCurrent: true,
    audioAssetRef: "preview:first-light:a",
  },
  {
    candidateRef: "candidate_preview_first_light_b",
    versionRef: "version_preview_first_light_b",
    generationRef: previewGeneration.generationRef,
    title: "First Light · Afterglow",
    subtitle: "Open horizon · layered chorus",
    durationSeconds: 196,
    mood: "Hopeful",
    waveformSeed: 27,
    isCurrent: false,
    audioAssetRef: "preview:first-light:b",
  },
]

export const previewVersions: Version[] = previewCandidates.map((candidate, index) => ({
  versionRef: candidate.versionRef,
  projectRef: previewProject.projectRef,
  sourceCandidateRef: candidate.candidateRef,
  title: candidate.title,
  durationSeconds: candidate.durationSeconds,
  createdAt: index === 0 ? "Just now" : "2 min ago",
  status: index === 0 ? "current" : "draft",
}))

export const previewLibrary: LibraryItem[] = [
  {
    kind: "project",
    ref: previewProject.projectRef,
    title: previewProject.title,
    subtitle: "2 versions · Updated just now",
    accent: previewProject.coverAccent,
  },
  ...previewVersions.map((version, index) => ({
    kind: "version" as const,
    ref: version.versionRef,
    projectRef: version.projectRef,
    title: version.title,
    subtitle: index === 0 ? "Current version · First Light" : "Draft version · First Light",
    durationSeconds: version.durationSeconds,
    accent: index === 0 ? "lavender" as const : "peach" as const,
  })),
]

export const previewPlayer: PlayerState = {
  currentVersionRef: previewProject.currentVersionRef,
  isPlaying: false,
  positionSeconds: 36,
  durationSeconds: previewCandidates[0].durationSeconds,
}
