import type {
  ArtworkGenerationInput,
  ArtworkGenerationSnapshot,
  ArtworkGenerationStatus,
  ArtworkPalette,
  ArtworkStyle,
  MoriArtworkCandidate,
  MoriReleaseDraft,
  ReleaseDraftInput,
  ReleaseVisibility,
} from "@/lib/mori-api"

export type StudioArtworkPlan = {
  prompt: string
  style: ArtworkStyle
  palette: ArtworkPalette
  aspectRatio: "1:1"
  textPolicy: "no_text"
  outputCount: 4
}

export type StudioArtworkDraft = {
  prompt: string
  style: ArtworkStyle
  palette: ArtworkPalette
}

export type StudioReleaseArtwork =
  | { type: "current" }
  | { type: "artwork_candidate"; artworkCandidateRef: string }

export type StudioReleaseDraft = {
  title: string
  description: string
  visibility: ReleaseVisibility
  allowRemix: boolean
  explicitContent: boolean
  artwork: StudioReleaseArtwork
}

export type StudioArtworkRunState = {
  status: "idle" | "preparing" | ArtworkGenerationStatus
  artworkGenerationRef: string | null
  progress: number
  plan: StudioArtworkPlan | null
  candidates: MoriArtworkCandidate[]
  message: string | null
}

export type StudioReleaseSaveState = {
  status: "idle" | "saving" | "saved" | "failed"
  snapshot: MoriReleaseDraft | null
  message: string | null
}

export type TrackedArtworkGeneration = {
  artworkGenerationRef: string
  sourceVersionRef: string
  plan: StudioArtworkPlan
}

export const idleStudioArtworkRun: StudioArtworkRunState = {
  status: "idle",
  artworkGenerationRef: null,
  progress: 0,
  plan: null,
  candidates: [],
  message: null,
}

export const idleStudioReleaseSave: StudioReleaseSaveState = {
  status: "idle",
  snapshot: null,
  message: null,
}

export function createInitialStudioReleaseDraft(versionTitle: string): StudioReleaseDraft {
  return {
    title: versionTitle.trim(),
    description: "",
    visibility: "private",
    allowRemix: false,
    explicitContent: false,
    artwork: { type: "current" },
  }
}

export function buildStudioArtworkPlan(input: {
  prompt: string
  style: ArtworkStyle
  palette: ArtworkPalette
}): StudioArtworkPlan {
  const prompt = input.prompt.trim()
  if (prompt === "") throw new Error("artwork_prompt_required")
  if (prompt.length > 400) throw new Error("artwork_prompt_too_long")
  return {
    prompt,
    style: input.style,
    palette: input.palette,
    aspectRatio: "1:1",
    textPolicy: "no_text",
    outputCount: 4,
  }
}

export function createArtworkGenerationRequest(plan: StudioArtworkPlan): ArtworkGenerationInput {
  return {
    prompt: plan.prompt,
    style: plan.style,
    palette: plan.palette,
    aspect_ratio: plan.aspectRatio,
    text_policy: plan.textPolicy,
    output_count: plan.outputCount,
  }
}

export function createReleaseDraftRequest(draft: StudioReleaseDraft, expectedRevision: number | null): ReleaseDraftInput {
  const title = draft.title.trim()
  const description = draft.description.trim()
  if (title === "") throw new Error("release_title_required")
  if (title.length > 120) throw new Error("release_title_too_long")
  if (description.length > 500) throw new Error("release_description_too_long")
  if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
    throw new Error("release_expected_revision_invalid")
  }

  const artwork = draft.artwork.type === "current"
    ? { type: "current" as const }
    : {
        type: "artwork_candidate" as const,
        artwork_candidate_ref: requiredArtworkCandidateRef(draft.artwork.artworkCandidateRef),
      }
  return {
    title,
    description,
    visibility: draft.visibility,
    allow_remix: draft.allowRemix,
    explicit_content: draft.explicitContent,
    artwork,
    expected_revision: expectedRevision,
  }
}

export function studioReleaseDraftFromSnapshot(snapshot: MoriReleaseDraft): StudioReleaseDraft {
  return {
    title: snapshot.title,
    description: snapshot.description,
    visibility: snapshot.visibility,
    allowRemix: snapshot.allow_remix,
    explicitContent: snapshot.explicit_content,
    artwork: snapshot.artwork.type === "current"
      ? { type: "current" }
      : { type: "artwork_candidate", artworkCandidateRef: snapshot.artwork.artwork_candidate_ref },
  }
}

export function artworkSnapshotMatchesPlan(snapshot: ArtworkGenerationSnapshot, tracked: TrackedArtworkGeneration): boolean {
  return snapshot.artwork_generation_ref === tracked.artworkGenerationRef
    && snapshot.version_ref === tracked.sourceVersionRef
    && snapshot.prompt === tracked.plan.prompt
    && snapshot.style === tracked.plan.style
    && snapshot.palette === tracked.plan.palette
    && snapshot.aspect_ratio === tracked.plan.aspectRatio
    && snapshot.text_policy === tracked.plan.textPolicy
    && snapshot.output_count === tracked.plan.outputCount
}

export function releaseDraftMatchesInput(snapshot: MoriReleaseDraft, versionRef: string, input: ReleaseDraftInput): boolean {
  if (
    snapshot.version_ref !== versionRef
    || snapshot.state !== "draft"
    || snapshot.revision !== (input.expected_revision ?? 0) + 1
    || snapshot.title !== input.title
    || snapshot.description !== input.description
    || snapshot.visibility !== input.visibility
    || snapshot.allow_remix !== input.allow_remix
    || snapshot.explicit_content !== input.explicit_content
  ) return false
  return releaseArtworkMatches(snapshot.artwork, input.artwork)
}

export function isActiveArtworkGenerationStatus(status: StudioArtworkRunState["status"]): boolean {
  return status === "preparing" || status === "queued" || status === "generating" || status === "post_processing"
}

function requiredArtworkCandidateRef(value: string): string {
  const normalized = value.trim()
  if (normalized === "") throw new Error("release_artwork_candidate_required")
  return normalized
}

function releaseArtworkMatches(left: MoriReleaseDraft["artwork"], right: ReleaseDraftInput["artwork"]): boolean {
  if (left.type !== right.type) return false
  return left.type === "current"
    || (right.type === "artwork_candidate" && left.artwork_candidate_ref === right.artwork_candidate_ref)
}
