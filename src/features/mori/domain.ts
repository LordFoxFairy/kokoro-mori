import type { ActionState, ResourceState } from "@kokoro/web-core"

export type MoriRef = string
export type CreationMode = "smart" | "custom"
export type LyricsMode = "lyrics" | "instrumental"
export type GenerationStatus = "queued" | "preparing" | "generating" | "post_processing" | "succeeded" | "failed" | "cancelled" | "expired"

export type Project = {
  projectRef: MoriRef
  title: string
  description: string
  coverAccent: "lavender" | "peach" | "mint"
  currentVersionRef: MoriRef | null
  candidateCount: number
  lastActivity: string
}

export type SongPlan = {
  songPlanRef: MoriRef
  projectRef: MoriRef
  prompt: string
  mood: string
  tempo: string
  structure: string[]
  instruments: string[]
  vocalDirection: string
  lyricsIntent: string
}

export type Generation = {
  generationRef: MoriRef
  projectRef: MoriRef
  songPlanRef: MoriRef
  status: GenerationStatus
  progress: number
  label: string
  candidateRefs: MoriRef[]
  createdAt: string
}

export type Candidate = {
  candidateRef: MoriRef
  versionRef: MoriRef
  generationRef: MoriRef
  title: string
  subtitle: string
  durationSeconds: number
  mood: string
  waveformSeed: number
  isCurrent: boolean
}

export type Version = {
  versionRef: MoriRef
  projectRef: MoriRef
  sourceCandidateRef: MoriRef
  title: string
  durationSeconds: number
  createdAt: string
  status: "draft" | "current" | "archived"
}

export type LibraryItem =
  | {
      kind: "project"
      ref: MoriRef
      title: string
      subtitle: string
      accent: Project["coverAccent"]
    }
  | {
      kind: "version"
      ref: MoriRef
      title: string
      subtitle: string
      durationSeconds: number
      accent: Project["coverAccent"]
    }

export type PlayerState = {
  currentVersionRef: MoriRef | null
  isPlaying: boolean
  positionSeconds: number
  durationSeconds: number
}

export type GenerationResource = ResourceState<Generation>
export type GenerationAction = ActionState
