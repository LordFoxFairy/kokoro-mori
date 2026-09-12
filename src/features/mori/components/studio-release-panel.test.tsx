import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { MoriArtworkCandidate } from "@/lib/mori-api"
import {
  createInitialStudioReleaseDraft,
  idleStudioArtworkRun,
  idleStudioReleaseSave,
  type StudioArtworkDraft,
  type StudioArtworkPlan,
  type StudioArtworkRunState,
  type StudioReleaseDraft,
  type StudioReleaseSaveState,
  type StudioReleasePublishState,
  type StudioReleaseShareState,
} from "../studio-release"
import { StudioReleasePanel } from "./studio-release-panel"

const artworkCandidates: MoriArtworkCandidate[] = Array.from({ length: 4 }, (_, index) => ({
  artwork_candidate_ref: `artwork_candidate_${index + 1}`,
  image_asset_ref: `asset_artwork_${index + 1}`,
  thumbnail_asset_ref: `asset_artwork_thumb_${index + 1}`,
  alt_text: `Warm dawn artwork concept ${index + 1}`,
}))

describe("Studio Release panel", () => {
  it("keeps release intent explicit and saves a draft rather than publishing", () => {
    const onSave = vi.fn<(draft: StudioReleaseDraft) => void>()
    render(<ReleaseHarness onSave={onSave} />)

    expect(screen.getByRole("radio", { name: /Private/u })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Allow remixes/u })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Save release draft" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: /^Publish/u })).not.toBeInTheDocument()
    expect(screen.queryByText("version_1")).not.toBeInTheDocument()
    expect(screen.getByText("Save the draft first. Sharing and publishing are separate choices.")).toBeInTheDocument()

    fireEvent.change(screen.getByRole("textbox", { name: "Release title" }), { target: { value: "Morning Lines" } })
    fireEvent.change(screen.getByRole("textbox", { name: "Release note" }), { target: { value: "A quiet ride toward morning." } })
    fireEvent.click(screen.getByRole("radio", { name: /Public/u }))
    expect(screen.getByRole("checkbox", { name: /Allow remixes/u })).not.toBeChecked()
    fireEvent.click(screen.getByRole("checkbox", { name: /Contains explicit content/u }))
    fireEvent.click(screen.getByRole("button", { name: "Save release draft" }))

    expect(onSave).toHaveBeenCalledWith({
      title: "Morning Lines",
      description: "A quiet ride toward morning.",
      visibility: "public",
      allowRemix: false,
      explicitContent: true,
      artwork: { type: "current" },
    })
    expect(screen.getByText(/Saving this draft does not publish/u)).toBeInTheDocument()
  })

  it("copies only the published public link", async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    render(<ReleaseHarness saveState={{ status: "saved", snapshot: null, message: null }} publishState={{ status: "published", releaseRef: "release_1", publicUrl: "https://mori.local/release/release_1", message: null }} />)
    expect(screen.getByRole("button", { name: "Copy public link" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Copy public link" }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://mori.local/release/release_1"))
  })

  it("keeps link-only sharing separate from public publishing", () => {
    const onCreateShare = vi.fn<() => void>()
    render(<ReleaseHarness initialVisibility="link_only" saveState={{ status: "saved", snapshot: null, message: null }} onCreateShare={onCreateShare} />)

    expect(screen.getByRole("button", { name: "Create share link" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: "Publish release" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Create share link" }))
    expect(onCreateShare).toHaveBeenCalledTimes(1)
  })

  it("copies and revokes an active link-only share", async () => {
    const writeText = vi.fn(async () => undefined)
    const onRevokeShare = vi.fn<() => void>()
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    render(<ReleaseHarness
      initialVisibility="link_only"
      saveState={{ status: "saved", snapshot: null, message: null }}
      shareState={{ status: "active", shareRef: "share_1", shareUrl: "https://mori.local/share/share_1", message: null }}
      onRevokeShare={onRevokeShare}
    />)

    fireEvent.click(screen.getByRole("button", { name: "Copy share link" }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://mori.local/share/share_1"))
    fireEvent.click(screen.getByRole("button", { name: "Revoke link" }))
    expect(onRevokeShare).toHaveBeenCalledTimes(1)
  })

  it("reviews a fixed four-concept artwork plan before generation", () => {
    const onGenerateArtwork = vi.fn<(plan: StudioArtworkPlan) => void>()
    render(<ReleaseHarness onGenerateArtwork={onGenerateArtwork} />)

    fireEvent.change(screen.getByRole("textbox", { name: "Artwork brief" }), { target: { value: "  sunrise through a train window  " } })
    fireEvent.change(screen.getByRole("combobox", { name: "Artwork style" }), { target: { value: "editorial" } })
    fireEvent.click(screen.getByRole("radio", { name: /Violet night/u }))
    fireEvent.click(screen.getByRole("button", { name: "Review artwork" }))

    expect(onGenerateArtwork).not.toHaveBeenCalled()
    const plan = screen.getByRole("region", { name: "Artwork plan" })
    expect(within(plan).getByText("Square · no typography")).toBeInTheDocument()
    expect(within(plan).getByText("4 concepts")).toBeInTheDocument()
    fireEvent.click(within(plan).getByRole("button", { name: "Create 4 concepts" }))

    expect(onGenerateArtwork).toHaveBeenCalledWith({
      prompt: "sunrise through a train window",
      style: "editorial",
      palette: "violet_night",
      aspectRatio: "1:1",
      textPolicy: "no_text",
      outputCount: 4,
    })
  })

  it("keeps artwork cancellable, retryable, and selectable through opaque asset URLs", () => {
    const onCancelArtwork = vi.fn<() => void>()
    const onGenerateArtwork = vi.fn<(plan: StudioArtworkPlan) => void>()
    const plan = {
      prompt: "Sunrise through a train window",
      style: "editorial" as const,
      palette: "warm_dawn" as const,
      aspectRatio: "1:1" as const,
      textPolicy: "no_text" as const,
      outputCount: 4 as const,
    }
    const view = render(
      <ReleaseHarness
        artworkRun={{ status: "generating", artworkGenerationRef: "artwork_generation_1", progress: 62, plan, candidates: [], message: null }}
        onCancelArtwork={onCancelArtwork}
      />,
    )
    expect(screen.getByRole("progressbar", { name: "Artwork progress" })).toHaveAttribute("aria-valuenow", "62")
    fireEvent.click(screen.getByRole("button", { name: "Cancel artwork" }))
    expect(onCancelArtwork).toHaveBeenCalledTimes(1)

    view.rerender(
      <ReleaseHarness
        artworkRun={{ status: "failed", artworkGenerationRef: "artwork_generation_1", progress: 62, plan, candidates: [], message: "Artwork needs another try." }}
        onGenerateArtwork={onGenerateArtwork}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Retry artwork" }))
    expect(onGenerateArtwork).toHaveBeenCalledWith(plan)

    view.rerender(
      <ReleaseHarness
        artworkRun={{ status: "succeeded", artworkGenerationRef: "artwork_generation_1", progress: 100, plan, candidates: artworkCandidates, message: null }}
      />,
    )
    const concept = screen.getByRole("radio", { name: "Use artwork concept 2" })
    const image = within(concept).getByRole("img", { name: "Warm dawn artwork concept 2" })
    expect(image).toHaveAttribute("src", "/api/v1/mori/assets/asset_artwork_thumb_2/content")
    fireEvent.click(concept)
    expect(concept).toHaveAttribute("aria-checked", "true")
  })

  it("shows saved revision feedback and blocks an empty release title", () => {
    const saved: StudioReleaseSaveState = {
      status: "saved",
      snapshot: {
        release_draft_ref: "release_draft_1",
        version_ref: "version_1",
        revision: 3,
        state: "draft",
        title: "First Light",
        description: "",
        visibility: "private",
        allow_remix: false,
        explicit_content: false,
        artwork: { type: "current" },
        updated_at: "2026-09-03T12:00:00.000Z",
      },
      message: null,
    }
    const view = render(<ReleaseHarness saveState={saved} />)
    expect(screen.getByRole("status")).toHaveTextContent("Draft revision 3 saved")

    view.rerender(<ReleaseHarness key="empty-title" initialTitle="" />)
    expect(screen.getByRole("button", { name: "Save release draft" })).toBeDisabled()
  })
})

type ReleaseHarnessProps = {
  initialTitle?: string
  initialVisibility?: StudioReleaseDraft["visibility"]
  artworkRun?: StudioArtworkRunState
  saveState?: StudioReleaseSaveState
  onGenerateArtwork?: (plan: StudioArtworkPlan) => void
  onCancelArtwork?: () => void
  onSave?: (draft: StudioReleaseDraft) => void
  publishState?: StudioReleasePublishState
  shareState?: StudioReleaseShareState
  onCreateShare?: () => void
  onRevokeShare?: () => void
}

function ReleaseHarness({
  initialTitle = "First Light",
  initialVisibility = "private",
  artworkRun = idleStudioArtworkRun,
  saveState = idleStudioReleaseSave,
  onGenerateArtwork = vi.fn(),
  onCancelArtwork = vi.fn(),
  onSave = vi.fn(),
  publishState,
  shareState,
  onCreateShare = vi.fn(),
  onRevokeShare = vi.fn(),
}: ReleaseHarnessProps) {
  const [draft, setDraft] = useState<StudioReleaseDraft>(() => ({ ...createInitialStudioReleaseDraft(initialTitle), visibility: initialVisibility }))
  const [artworkDraft, setArtworkDraft] = useState<StudioArtworkDraft>({ prompt: "", style: "abstract", palette: "warm_dawn" })
  return (
    <StudioReleasePanel
      versionRef="version_1"
      draft={draft}
      artworkDraft={artworkDraft}
      artworkRun={artworkRun}
      saveState={saveState}
      onDraftChange={setDraft}
      onArtworkDraftChange={setArtworkDraft}
      onGenerateArtwork={onGenerateArtwork}
      onCancelArtwork={onCancelArtwork}
      onResetArtwork={vi.fn()}
      onSave={onSave}
      publishState={publishState}
      shareState={shareState}
      onCreateShare={onCreateShare}
      onRevokeShare={onRevokeShare}
    />
  )
}
