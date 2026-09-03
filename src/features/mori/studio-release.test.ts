import { describe, expect, it } from "vitest"
import type { ArtworkGenerationSnapshot, MoriReleaseDraft } from "@/lib/mori-api"
import {
  artworkSnapshotMatchesPlan,
  buildStudioArtworkPlan,
  createArtworkGenerationRequest,
  createInitialStudioReleaseDraft,
  createReleaseDraftRequest,
  releaseDraftMatchesInput,
} from "./studio-release"

describe("Mori Studio release plans", () => {
  it("starts private with current artwork and independent release controls", () => {
    expect(createInitialStudioReleaseDraft(" First Light ")).toEqual({
      title: "First Light",
      description: "",
      visibility: "private",
      allowRemix: false,
      explicitContent: false,
      artwork: { type: "current" },
    })
  })

  it("turns a visual brief into a fixed square four-concept plan", () => {
    const plan = buildStudioArtworkPlan({
      prompt: "  sunrise through a train window, soft grain  ",
      style: "editorial",
      palette: "warm_dawn",
    })

    expect(plan).toEqual({
      prompt: "sunrise through a train window, soft grain",
      style: "editorial",
      palette: "warm_dawn",
      aspectRatio: "1:1",
      textPolicy: "no_text",
      outputCount: 4,
    })
    expect(createArtworkGenerationRequest(plan)).toEqual({
      prompt: "sunrise through a train window, soft grain",
      style: "editorial",
      palette: "warm_dawn",
      aspect_ratio: "1:1",
      text_policy: "no_text",
      output_count: 4,
    })
  })

  it("rejects missing or oversized visual briefs", () => {
    expect(() => buildStudioArtworkPlan({ prompt: "   ", style: "abstract", palette: "mint_haze" })).toThrow("artwork_prompt_required")
    expect(() => buildStudioArtworkPlan({ prompt: "x".repeat(401), style: "abstract", palette: "mint_haze" })).toThrow("artwork_prompt_too_long")
  })

  it("normalizes a release draft without coupling public visibility to remix permission", () => {
    expect(createReleaseDraftRequest({
      title: "  First Light  ",
      description: "  A quiet ride toward morning.  ",
      visibility: "public",
      allowRemix: false,
      explicitContent: true,
      artwork: { type: "artwork_candidate", artworkCandidateRef: "  artwork_candidate_2  " },
    }, 3)).toEqual({
      title: "First Light",
      description: "A quiet ride toward morning.",
      visibility: "public",
      allow_remix: false,
      explicit_content: true,
      artwork: { type: "artwork_candidate", artwork_candidate_ref: "artwork_candidate_2" },
      expected_revision: 3,
    })
  })

  it("rejects invalid release fields and revision tokens", () => {
    const draft = createInitialStudioReleaseDraft("First Light")
    expect(() => createReleaseDraftRequest({ ...draft, title: " " }, null)).toThrow("release_title_required")
    expect(() => createReleaseDraftRequest({ ...draft, description: "x".repeat(501) }, null)).toThrow("release_description_too_long")
    expect(() => createReleaseDraftRequest(draft, 0)).toThrow("release_expected_revision_invalid")
    expect(() => createReleaseDraftRequest({ ...draft, artwork: { type: "artwork_candidate", artworkCandidateRef: " " } }, null)).toThrow("release_artwork_candidate_required")
  })

  it("accepts only artwork snapshots that echo the exact tracked context", () => {
    const plan = buildStudioArtworkPlan({ prompt: "Dawn reflected in rain", style: "illustrated", palette: "violet_night" })
    const snapshot: ArtworkGenerationSnapshot = {
      artwork_generation_ref: "artwork_generation_1",
      version_ref: "version_1",
      status: "succeeded",
      progress: 100,
      prompt: plan.prompt,
      style: plan.style,
      palette: plan.palette,
      aspect_ratio: "1:1",
      text_policy: "no_text",
      output_count: 4,
      candidates: [],
      created_at: "2026-09-03T12:00:00.000Z",
    }
    const tracked = { artworkGenerationRef: "artwork_generation_1", sourceVersionRef: "version_1", plan }

    expect(artworkSnapshotMatchesPlan(snapshot, tracked)).toBe(true)
    expect(artworkSnapshotMatchesPlan({ ...snapshot, palette: "mint_haze" }, tracked)).toBe(false)
    expect(artworkSnapshotMatchesPlan({ ...snapshot, version_ref: "version_2" }, tracked)).toBe(false)
  })

  it("accepts only the next matching release revision", () => {
    const input = createReleaseDraftRequest({
      ...createInitialStudioReleaseDraft("First Light"),
      artwork: { type: "artwork_candidate", artworkCandidateRef: "artwork_candidate_2" },
    }, 2)
    const release: MoriReleaseDraft = {
      release_draft_ref: "release_draft_1",
      version_ref: "version_1",
      revision: 3,
      state: "draft",
      title: input.title,
      description: input.description,
      visibility: input.visibility,
      allow_remix: input.allow_remix,
      explicit_content: input.explicit_content,
      artwork: input.artwork,
      updated_at: "2026-09-03T12:00:00.000Z",
    }

    expect(releaseDraftMatchesInput(release, "version_1", input)).toBe(true)
    expect(releaseDraftMatchesInput({ ...release, revision: 4 }, "version_1", input)).toBe(false)
    expect(releaseDraftMatchesInput({ ...release, allow_remix: true }, "version_1", input)).toBe(false)
  })
})
