import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { StrictMode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { ArtworkGenerationInput, MoriApi, MoriExportInput, MoriProjectWorkspaceProjection, ReleaseDraftInput, StudioChangeGenerationInput, StudioRestyleGenerationSnapshot } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"
import { MoriAppProvider } from "./components/mori-app-provider"
import { previewCandidates } from "./preview-data"
import { readGenerationQueueState } from "./generation-queue-storage"
import { defaultStudioLyrics } from "./studio-lyrics"
import type { StemPlaybackFactory } from "./stem-playback"
import { StudioPageContent } from "./studio-page"

const createTestStemPlaybackController: StemPlaybackFactory = () => ({
  setTracks: () => undefined,
  play: async () => undefined,
  pause: () => undefined,
  seek: () => undefined,
  setMix: () => undefined,
  dispose: () => undefined,
})

describe("Mori studio page", () => {
  function renderStudio(api?: Partial<Pick<MoriApi, "createExport" | "getExport" | "getProject" | "getProjectWorkspace" | "putCurrentVersion" | "getCompositionRevision" | "listCandidates" | "listCreativeSources" | "createStudioChange" | "createCompositionRevision" | "getGeneration" | "getGenerationEvents" | "cancelGeneration" | "createLyricsRevision" | "getLyricsRevision" | "getLyricsRevisionEvents" | "cancelLyricsRevision" | "createStemSeparation" | "getStemSeparation" | "getStemSeparationEvents" | "cancelStemSeparation" | "createArtworkGeneration" | "getArtworkGeneration" | "getArtworkGenerationEvents" | "cancelArtworkGeneration" | "getReleaseDraft" | "putReleaseDraft" | "createMixRevision">>, studioCandidate = previewCandidates[0]) {
    return render(
      <MoriAppProvider>
        <StudioPageContent candidate={studioCandidate} api={api} stemPlaybackFactory={createTestStemPlaybackController} />
      </MoriAppProvider>,
    )
  }

  it("restores an active Studio change from the durable queue after refresh", async () => {
    localStorage.clear()
    const snapshot: StudioRestyleGenerationSnapshot = {
      generation_ref: "generation_restore_studio",
      generation_kind: "studio_change" as const,
      project_ref: "project_preview_first_light",
      song_plan_ref: null,
      mode: null,
      source_version_ref: "version_preview_first_light_a",
      operation: "transform" as const,
      intent: "restyle" as const,
      scope: { type: "time_range" as const, start_ms: 42_000, end_ms: 96_000 },
      instruction: "Open the chorus into a wide live-room performance.",
      preserve: ["melody", "lyrics"],
      reference_asset_refs: [],
      output_count: 2,
      status: "generating" as const,
      progress: 42,
      candidate_refs: [],
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const { emptyGenerationQueueState } = await import("./generation-queue")
    const { writeGenerationQueueState } = await import("./generation-queue-storage")
    writeGenerationQueueState({
      ...emptyGenerationQueueState(),
      active_generation_ref: snapshot.generation_ref,
      items: [{
        generation_ref: snapshot.generation_ref,
        project_ref: snapshot.project_ref,
        source_version_ref: snapshot.source_version_ref,
        kind: "studio_change",
        label: "Restyle · Selected section · Chorus",
        created_at: snapshot.created_at,
        status: snapshot.status,
        progress: snapshot.progress,
        candidate_refs: [],
        last_event_id: null,
      }],
    })

    const getGeneration = vi.fn(async () => ({ data: snapshot, meta: { request_id: "request_restore_studio" } }))
    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={snapshot.project_ref}
          versionRef={snapshot.source_version_ref}
          api={{ getGeneration, getGenerationEvents: async () => [] }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(snapshot.generation_ref))
    expect(await screen.findByText("Open the chorus into a wide live-room performance.")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Studio change progress" })).toHaveAttribute("aria-valuenow", "42")
    localStorage.clear()
  })

  it("restores an explicit Studio generation from its route without a local queue", async () => {
    localStorage.clear()
    const snapshot: StudioRestyleGenerationSnapshot = {
      generation_ref: "generation_route_only_studio",
      generation_kind: "studio_change",
      project_ref: "project_preview_first_light",
      song_plan_ref: null,
      mode: null,
      source_version_ref: "version_preview_first_light_a",
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Recover this Studio change from the route alone.",
      preserve: ["melody", "lyrics"],
      reference_asset_refs: [],
      output_count: 2,
      status: "generating",
      progress: 46,
      candidate_refs: [],
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: snapshot,
      meta: { request_id: "request_route_only_studio" },
    }))

    render(
      <StrictMode>
        <MoriAppProvider>
          <StudioPageContent
            candidate={previewCandidates[0]}
            projectRef={snapshot.project_ref}
            versionRef={snapshot.source_version_ref}
            initialGenerationRef={snapshot.generation_ref}
            api={{ getGeneration, getGenerationEvents: async () => [] }}
            stemPlaybackFactory={createTestStemPlaybackController}
          />
        </MoriAppProvider>
      </StrictMode>,
    )

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(snapshot.generation_ref))
    expect(screen.getByText(snapshot.instruction)).toBeInTheDocument()
    expect(readGenerationQueueState().items).toContainEqual(expect.objectContaining({
      generation_ref: snapshot.generation_ref,
      project_ref: snapshot.project_ref,
      source_version_ref: snapshot.source_version_ref,
      kind: "studio_change",
      status: "generating",
      progress: 46,
    }))
    expect(localStorage.getItem("mori-generation-queue-v1")).not.toContain(snapshot.instruction)
    expect(localStorage.getItem("mori-generation-queue-v1")).not.toContain("preserve")
    expect(getGeneration).toHaveBeenCalledTimes(1)
    localStorage.clear()
  })

  it("retries an explicit Studio route after a transient recovery failure", async () => {
    localStorage.clear()
    const snapshot: StudioRestyleGenerationSnapshot = {
      generation_ref: "generation_route_retry_studio",
      generation_kind: "studio_change",
      project_ref: "project_preview_first_light",
      song_plan_ref: null,
      mode: null,
      source_version_ref: "version_preview_first_light_a",
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Recover this Studio change after reconnecting.",
      preserve: ["melody"],
      reference_asset_refs: [],
      output_count: 2,
      status: "generating",
      progress: 31,
      candidate_refs: [],
      created_at: "2026-09-04T12:00:00.000Z",
    }
    let attempts = 0
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new TypeError("Failed to fetch")
      }
      return { data: snapshot, meta: { request_id: "request_route_retry_studio_2" } }
    })

    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={snapshot.project_ref}
          versionRef={snapshot.source_version_ref}
          initialGenerationRef={snapshot.generation_ref}
          api={{ getGeneration, getGenerationEvents: async () => [] }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(getGeneration.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 2_500 })
    expect(screen.getByText(snapshot.instruction)).toBeInTheDocument()
    localStorage.clear()
  })

  it("recovers when the mounted Studio surface gains an explicit generation route", async () => {
    localStorage.clear()
    const snapshot: StudioRestyleGenerationSnapshot = {
      generation_ref: "generation_route_transition_studio",
      generation_kind: "studio_change",
      project_ref: "project_preview_first_light",
      song_plan_ref: null,
      mode: null,
      source_version_ref: "version_preview_first_light_a",
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Recover after entering the explicit Studio route.",
      preserve: ["melody"],
      reference_asset_refs: [],
      output_count: 2,
      status: "generating",
      progress: 37,
      candidate_refs: [],
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: snapshot,
      meta: { request_id: "request_route_transition_studio" },
    }))
    const renderView = (generationRef: string | null) => (
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={snapshot.project_ref}
          versionRef={snapshot.source_version_ref}
          initialGenerationRef={generationRef}
          api={{ getGeneration, getGenerationEvents: async () => [] }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>
    )
    const view = render(renderView(null))

    view.rerender(renderView(snapshot.generation_ref))

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(snapshot.generation_ref))
    expect(await screen.findByText(snapshot.instruction)).toBeInTheDocument()
    localStorage.clear()
  })

  it("waits for the URL Version candidate before recovering a Studio generation", async () => {
    localStorage.clear()
    const nextCandidate = { ...previewCandidates[1], versionRef: "version_route_next" }
    let resolveNextCandidates: ((value: Awaited<ReturnType<MoriApi["listCandidates"]>>) => void) | undefined
    const nextCandidates = new Promise<Awaited<ReturnType<MoriApi["listCandidates"]>>>((resolve) => {
      resolveNextCandidates = resolve
    })
    const firstCandidatePage = {
      data: {
        candidates: [{
          candidate_ref: previewCandidates[0].candidateRef,
          generation_ref: previewCandidates[0].generationRef,
          version_ref: previewCandidates[0].versionRef,
          project_ref: "project_preview_first_light",
          title: previewCandidates[0].title,
          duration_seconds: previewCandidates[0].durationSeconds,
          audio_asset_ref: "asset_route_current",
          waveform_asset_ref: "waveform_route_current",
          style_tags: ["current"],
          created_at: "2026-09-04T12:00:00.000Z",
        }],
        next_cursor: null,
      },
      meta: { request_id: "request_route_current_candidates" },
    }
    const listCandidates = vi.fn<MoriApi["listCandidates"]>()
      .mockResolvedValueOnce(firstCandidatePage)
      .mockImplementationOnce(async () => nextCandidates)
    const snapshot: StudioRestyleGenerationSnapshot = {
      generation_ref: "generation_route_next_studio",
      generation_kind: "studio_change",
      project_ref: "project_preview_first_light",
      song_plan_ref: null,
      mode: null,
      source_version_ref: nextCandidate.versionRef,
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Only recover after the requested Version is active.",
      preserve: ["melody"],
      reference_asset_refs: [],
      output_count: 2,
      status: "generating",
      progress: 33,
      candidate_refs: [],
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: snapshot,
      meta: { request_id: "request_route_next_studio" },
    }))
    const renderView = (version: string, generationRef: string | null) => (
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={snapshot.project_ref}
          versionRef={version}
          initialGenerationRef={generationRef}
          api={{ getGeneration, getGenerationEvents: async () => [], listCandidates }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>
    )
    const view = render(renderView(previewCandidates[0].versionRef, null))
    await waitFor(() => expect(listCandidates).toHaveBeenCalledTimes(1))

    view.rerender(renderView(nextCandidate.versionRef, snapshot.generation_ref))
    await waitFor(() => expect(listCandidates).toHaveBeenCalledTimes(2))
    expect(getGeneration).not.toHaveBeenCalled()

    resolveNextCandidates?.({
      data: {
        candidates: [{
          candidate_ref: nextCandidate.candidateRef,
          generation_ref: nextCandidate.generationRef,
          version_ref: nextCandidate.versionRef,
          project_ref: snapshot.project_ref,
          title: nextCandidate.title,
          duration_seconds: nextCandidate.durationSeconds,
          audio_asset_ref: "asset_route_next",
          waveform_asset_ref: "waveform_route_next",
          style_tags: ["next"],
          created_at: "2026-09-04T12:00:00.000Z",
        }],
        next_cursor: null,
      },
      meta: { request_id: "request_route_next_candidates" },
    })

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(snapshot.generation_ref))
    expect(await screen.findByText(snapshot.instruction)).toBeInTheDocument()
    localStorage.clear()
  })

  it("restores the Studio run named by the route when another tab changed the global active run", async () => {
    const snapshot: StudioRestyleGenerationSnapshot = {
      generation_ref: "generation_route_studio",
      generation_kind: "studio_change",
      project_ref: "project_preview_first_light",
      song_plan_ref: null,
      mode: null,
      source_version_ref: "version_preview_first_light_a",
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Keep this exact route-selected Studio run.",
      preserve: ["melody"],
      reference_asset_refs: [],
      output_count: 2,
      status: "generating",
      progress: 58,
      candidate_refs: [],
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const { writeGenerationQueueState } = await import("./generation-queue-storage")
    writeGenerationQueueState({
      version: 1,
      active_generation_ref: "generation_other_studio_tab",
      items: [{
        generation_ref: "generation_other_studio_tab",
        project_ref: snapshot.project_ref,
        source_version_ref: snapshot.source_version_ref,
        kind: "studio_change",
        label: "Other tab run",
        created_at: "2026-09-04T12:01:00.000Z",
        status: "generating",
        progress: 20,
        candidate_refs: [],
        last_event_id: null,
      }, {
        generation_ref: snapshot.generation_ref,
        project_ref: snapshot.project_ref,
        source_version_ref: snapshot.source_version_ref,
        kind: "studio_change",
        label: "Route-selected run",
        created_at: snapshot.created_at,
        status: snapshot.status,
        progress: snapshot.progress,
        candidate_refs: [],
        last_event_id: null,
      }],
    })
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: snapshot,
      meta: { request_id: "request_route_studio" },
    }))

    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={snapshot.project_ref}
          versionRef={snapshot.source_version_ref}
          initialGenerationRef={snapshot.generation_ref}
          api={{ getGeneration, getGenerationEvents: async () => [] }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(snapshot.generation_ref))
    expect(screen.getByText("Keep this exact route-selected Studio run.")).toBeInTheDocument()
  })

  it("switches Studio recovery when only the route generation changes", async () => {
    const snapshot = (generationRef: string, instruction: string): StudioRestyleGenerationSnapshot => ({
      generation_ref: generationRef,
      generation_kind: "studio_change",
      project_ref: "project_preview_first_light",
      song_plan_ref: null,
      mode: null,
      source_version_ref: "version_preview_first_light_a",
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction,
      preserve: ["melody"],
      reference_asset_refs: [],
      output_count: 2,
      status: "generating",
      progress: 50,
      candidate_refs: [],
      created_at: "2026-09-04T12:00:00.000Z",
    })
    const first = snapshot("generation_route_first", "First route-selected Studio run.")
    const second = snapshot("generation_route_second", "Second route-selected Studio run.")
    const { writeGenerationQueueState } = await import("./generation-queue-storage")
    writeGenerationQueueState({
      version: 1,
      active_generation_ref: first.generation_ref,
      items: [first, second].map((item) => ({
        generation_ref: item.generation_ref,
        project_ref: item.project_ref,
        source_version_ref: item.source_version_ref,
        kind: "studio_change" as const,
        label: item.instruction,
        created_at: item.created_at,
        status: item.status,
        progress: item.progress,
        candidate_refs: [],
        last_event_id: null,
      })),
    })
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async (generationRef) => ({
      data: generationRef === second.generation_ref ? second : first,
      meta: { request_id: `request_${generationRef}` },
    }))
    const renderView = (generationRef: string) => (
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={first.project_ref}
          versionRef={first.source_version_ref}
          initialGenerationRef={generationRef}
          api={{ getGeneration, getGenerationEvents: async () => [] }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>
    )
    const view = render(renderView(first.generation_ref))
    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(first.generation_ref))
    expect(screen.getByText(first.instruction)).toBeInTheDocument()

    view.rerender(renderView(second.generation_ref))

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(second.generation_ref))
    expect(screen.getByText(second.instruction)).toBeInTheDocument()
  })

  it("keeps a terminal Studio snapshot visible when replay returns an older active event", async () => {
    const snapshot: StudioRestyleGenerationSnapshot = {
      generation_ref: "generation_terminal_studio",
      generation_kind: "studio_change",
      project_ref: "project_preview_first_light",
      song_plan_ref: null,
      mode: null,
      source_version_ref: "version_preview_first_light_a",
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Keep the completed Studio result terminal.",
      preserve: ["melody"],
      reference_asset_refs: [],
      output_count: 2,
      status: "succeeded",
      progress: 100,
      candidate_refs: [],
      created_at: "2026-09-04T12:00:00.000Z",
    }
    const { writeGenerationQueueState } = await import("./generation-queue-storage")
    writeGenerationQueueState({
      version: 1,
      active_generation_ref: snapshot.generation_ref,
      items: [{
        generation_ref: snapshot.generation_ref,
        project_ref: snapshot.project_ref,
        source_version_ref: snapshot.source_version_ref,
        kind: "studio_change",
        label: "Terminal Studio run",
        created_at: snapshot.created_at,
        status: snapshot.status,
        progress: snapshot.progress,
        candidate_refs: [],
        last_event_id: "event-terminal",
      }],
    })
    const getGenerationEvents = vi.fn<MoriApi["getGenerationEvents"]>(async () => [{
      id: "event-stale",
      event: "generation.progress",
      data: {
        generation_ref: snapshot.generation_ref,
        project_ref: snapshot.project_ref,
        status: "generating",
        progress: 72,
        candidate_refs: [],
      },
    }])

    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={snapshot.project_ref}
          versionRef={snapshot.source_version_ref}
          initialGenerationRef={snapshot.generation_ref}
          api={{
            getGeneration: async () => ({ data: snapshot, meta: { request_id: "request_terminal_studio" } }),
            getGenerationEvents,
            listCandidates: async () => ({
              data: {
                candidates: [{
                  candidate_ref: previewCandidates[0].candidateRef,
                  generation_ref: "generation_preview_first_light",
                  version_ref: previewCandidates[0].versionRef,
                  project_ref: snapshot.project_ref,
                  title: previewCandidates[0].title,
                  duration_seconds: previewCandidates[0].durationSeconds,
                  audio_asset_ref: "asset_terminal_studio",
                  waveform_asset_ref: "waveform_terminal_studio",
                  style_tags: ["gentle pulse", "intimate vocal"],
                  created_at: "2026-09-03T12:00:00.000Z",
                }],
                next_cursor: null,
              },
              meta: { request_id: "request_terminal_studio_candidates" },
            }),
          }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(getGenerationEvents).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole("progressbar", { name: "Studio change progress" })).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Retry change" })).toBeInTheDocument()
  })

  it("keeps mobile Studio actions discoverable by preserving action roles and labels", () => {
    renderStudio()

    expect(screen.getByRole("button", { name: "Copy link" })).toHaveAttribute("data-action", "copy")
    expect(screen.getByRole("button", { name: "Open version history" })).toHaveAttribute("data-action", "versions")
    expect(screen.getByRole("button", { name: "Compare takes (2)" })).toHaveAttribute("data-action", "compare-takes")
    expect(screen.getByRole("button", { name: "Finish" })).toHaveAttribute("data-action", "finish")
    expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute("data-action", "export")
  })

  it("makes the multi-take comparison surface reachable from the Studio header", () => {
    renderStudio()

    const takeLanes = screen.getByRole("region", { name: "Take lanes", hidden: true })
    expect(takeLanes).not.toHaveFocus()
    expect(screen.getByRole("button", { name: "Compare takes (2)" })).toHaveAttribute("aria-controls", "mori-take-lanes")

    fireEvent.click(screen.getByRole("button", { name: "Compare takes (2)" }))

    expect(takeLanes).toHaveFocus()
  })

  it("switches between arrangement, lyrics, and stems as one keyboard-accessible workspace", () => {
    renderStudio()

    const workspaceTabs = screen.getByRole("tablist", { name: "Studio workspace" })
    const arrangementTab = within(workspaceTabs).getByRole("tab", { name: "Arrangement" })
    expect(arrangementTab).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("region", { name: "Studio asset dock" })).toBeInTheDocument()
    expect(screen.getByText("Current · saved")).toBeInTheDocument()
    expect(screen.queryByText("version_preview_first_light_a")).not.toBeInTheDocument()

    fireEvent.keyDown(arrangementTab, { key: "ArrowDown" })
    const lyricsTab = within(workspaceTabs).getByRole("tab", { name: "Lyrics" })
    expect(lyricsTab).toHaveAttribute("aria-selected", "true")
    expect(lyricsTab).toHaveAttribute("aria-controls", "mori-studio-panel-lyrics")
    expect(lyricsTab).toHaveFocus()
    expect(screen.getByRole("tabpanel", { name: "Lyrics" })).toHaveAttribute("id", "mori-studio-panel-lyrics")
    expect(screen.getByRole("region", { name: "Lyrics editor" })).toBeInTheDocument()

    fireEvent.keyDown(lyricsTab, { key: "End" })
    const stemsTab = within(workspaceTabs).getByRole("tab", { name: "Voice & stems" })
    expect(stemsTab).toHaveAttribute("aria-selected", "true")
    expect(stemsTab).toHaveFocus()
    expect(screen.getByRole("region", { name: "Stems editor" })).toBeInTheDocument()
  })

  it("opens the Studio workspace selected by a project continuation", () => {
    render(
      <MoriAppProvider>
        <StudioPageContent candidate={previewCandidates[0]} initialSurface="lyrics" stemPlaybackFactory={createTestStemPlaybackController} />
      </MoriAppProvider>,
    )

    expect(screen.getByRole("tab", { name: "Lyrics" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("region", { name: "Lyrics editor" })).toBeInTheDocument()
  })

  it("opens Transform as a whole-song Studio intent", () => {
    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          initialSurface="arrangement"
          initialIntent="transform"
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    expect(within(aiChanges).getByRole("button", { name: "Transform" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByRole("button", { name: "Whole song" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByLabelText("Change context")).toHaveTextContent("Whole song")
  })

  it("opens Cover as a whole-song Studio intent", () => {
    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          initialSurface="arrangement"
          initialIntent="cover"
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    expect(within(aiChanges).getByRole("button", { name: "Transform" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByRole("button", { name: "Cover" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByRole("button", { name: "Vocal cover" })).toBeInTheDocument()
  })

  it("opens Finish directly from a project continuation", () => {
    render(
      <StrictMode>
        <MoriAppProvider>
          <StudioPageContent candidate={previewCandidates[0]} initialSurface="finish" stemPlaybackFactory={createTestStemPlaybackController} />
        </MoriAppProvider>
      </StrictMode>,
    )

    expect(screen.getByRole("dialog", { name: "Finish First Light" })).toBeInTheDocument()
  })

  it("opens projected Versions in a contextual drawer and restores its trigger on close", async () => {
    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef="project_drawer"
          api={{
            getProject: async () => ({
              data: {
                project_ref: "project_drawer",
                title: "Soft Landing",
                description: "One careful direction",
                current_version_ref: "version_drawer_a",
                candidate_count: 1,
                last_activity_at: "2026-09-04T10:00:00.000Z",
              },
              meta: { request_id: "request_project_drawer" },
            }),
            listCandidates: async () => ({
              data: {
                candidates: [{
                  candidate_ref: "candidate_drawer_a",
                  generation_ref: "generation_drawer",
                  version_ref: "version_drawer_a",
                  project_ref: "project_drawer",
                  title: "Soft Landing",
                  duration_seconds: 154,
                  audio_asset_ref: "asset_drawer_a",
                  waveform_asset_ref: "waveform_drawer_a",
                  style_tags: ["intimate", "acoustic"],
                  created_at: "2026-09-04T09:59:00.000Z",
                }],
                next_cursor: null,
              },
              meta: { request_id: "request_candidates_drawer" },
            }),
          }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    await screen.findByRole("heading", { name: "Soft Landing" })
    const trigger = screen.getByRole("button", { name: "Open version history" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveAttribute("aria-controls", "studio-version-history-drawer")
    trigger.focus()
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute("aria-expanded", "true")
    const drawer = screen.getByRole("dialog", { name: "Version history" })
    expect(within(drawer).getByRole("link", { name: "Soft Landing, Current, Open, 2:34" })).toHaveAttribute("href", "/projects/project_drawer/studio/version_drawer_a")

    fireEvent.click(within(drawer).getByRole("button", { name: "Close version history" }))
    expect(screen.queryByRole("dialog", { name: "Version history" })).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(trigger).toHaveFocus()
  })

  it("keeps the previous Current until the Use take command is confirmed", async () => {
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.history.replaceState({}, "", "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=arrangement")
    let releaseSelection: () => void = () => undefined
    const selectionGate = new Promise<void>((resolve) => { releaseSelection = resolve })
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async () => {
      await selectionGate
      return {
        data: {
          project_ref: "project_preview_first_light",
          current_version_ref: "version_preview_first_light_b",
          source_candidate_ref: "candidate_preview_first_light_b",
          previous_version_ref: "version_preview_first_light_a",
          selected_at: "2026-09-03T19:55:00.000Z",
        },
        meta: { request_id: "request_current_version_success" },
      }
    })
    renderStudio({ putCurrentVersion })

    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    const firstTake = within(takeLanes).getByRole("article", { name: "Take 1: First Light" })
    const secondTake = within(takeLanes).getByRole("article", { name: "Take 2: First Light · Afterglow" })

    expect(within(firstTake).getByText("Current version")).toBeInTheDocument()
    fireEvent.click(within(secondTake).getByRole("button", { name: "Use First Light · Afterglow as current" }))

    await waitFor(() => expect(putCurrentVersion).toHaveBeenCalledOnce())
    expect(within(firstTake).getByText("Current version")).toBeInTheDocument()
    expect(within(secondTake).queryByText("Current version")).not.toBeInTheDocument()
    expect(within(secondTake).getByRole("button", { name: "Using First Light · Afterglow as current" })).toBeDisabled()
    expect(putCurrentVersion.mock.calls[0]?.slice(0, 2)).toEqual([
      "project_preview_first_light",
      {
        candidate_ref: "candidate_preview_first_light_b",
        version_ref: "version_preview_first_light_b",
        expected_current_version_ref: "version_preview_first_light_a",
      },
    ])
    expect(putCurrentVersion.mock.calls[0]?.[2]).toMatch(/^mori-current-version-/u)

    releaseSelection()

    await waitFor(() => expect(within(screen.getByRole("article", { name: "Take 2: First Light · Afterglow" })).getByText("Current version")).toBeInTheDocument())
    expect(window.location.pathname).toBe("/projects/project_preview_first_light/studio/version_preview_first_light_b")
    expect(window.location.search).toBe("?surface=arrangement")
    expect(within(screen.getByRole("article", { name: "Take 1: First Light" })).getByRole("button", { name: "Use First Light as current" })).toBeInTheDocument()
    const history = screen.getByRole("complementary", { name: "Version history" })
    expect(within(history).getByRole("link", { name: /First Light · Afterglow, Current/u })).toHaveAttribute("aria-current", "page")
    expect(within(history).getByRole("link", { name: /^First Light, Draft/u })).not.toHaveAttribute("aria-current")

    fireEvent.click(screen.getByRole("button", { name: "Open version history" }))
    const drawer = screen.getByRole("dialog", { name: "Version history" })
    expect(within(drawer).getByRole("link", { name: "First Light · Afterglow, Current, Open, 3:16" })).toHaveAttribute("aria-current", "page")
    expect(within(drawer).getByRole("link", { name: "First Light, Draft, 3:02" })).not.toHaveAttribute("aria-current")
    window.history.replaceState({}, "", originalUrl)
  })

  it("keeps Current unchanged and safely reuses the command identity on retry", async () => {
    const idempotencyKeys: string[] = []
    let attempt = 0
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async (_projectRef, _input, idempotencyKey) => {
      idempotencyKeys.push(idempotencyKey)
      attempt += 1
      if (attempt === 1) throw new Error("temporary failure")
      return {
        data: {
          project_ref: "project_preview_first_light",
          current_version_ref: "version_preview_first_light_b",
          source_candidate_ref: "candidate_preview_first_light_b",
          previous_version_ref: "version_preview_first_light_a",
          selected_at: "2026-09-03T19:56:00.000Z",
        },
        meta: { request_id: "request_current_version_retry" },
      }
    })
    renderStudio({ putCurrentVersion })

    fireEvent.click(screen.getByRole("button", { name: "Use First Light · Afterglow as current" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Your previous Current is unchanged.")
    expect(screen.getByRole("article", { name: "Take 1: First Light" })).toHaveTextContent("Current version")
    fireEvent.click(within(alert).getByRole("button", { name: "Retry Use take" }))

    await waitFor(() => expect(putCurrentVersion).toHaveBeenCalledTimes(2))
    expect(idempotencyKeys[0]).toBe(idempotencyKeys[1])
    await waitFor(() => expect(screen.getByRole("article", { name: "Take 2: First Light · Afterglow" })).toHaveTextContent("Current version"))
  })

  it("explains a stale Current conflict without overwriting either Version", async () => {
    renderStudio({
      putCurrentVersion: async () => {
        throw new MoriApiRequestError({
          code: "current_version_conflict",
          message: "Current changed",
          retryable: false,
          details: null,
        }, "request_current_version_conflict", 409)
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Use First Light · Afterglow as current" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Current Version changed elsewhere. Refresh Studio before choosing again.")
    expect(within(alert).queryByRole("button", { name: "Retry Use take" })).not.toBeInTheDocument()
    expect(screen.getByRole("article", { name: "Take 1: First Light" })).toHaveTextContent("Current version")
    expect(screen.getByRole("article", { name: "Take 2: First Light · Afterglow" })).not.toHaveTextContent("Current version")
  })

  it("rejects a mismatched Current Version confirmation", async () => {
    renderStudio({
      putCurrentVersion: async () => ({
        data: {
          project_ref: "project_preview_first_light",
          current_version_ref: "version_preview_first_light_b",
          source_candidate_ref: "candidate_from_another_take",
          previous_version_ref: "version_preview_first_light_a",
          selected_at: "2026-09-03T19:57:00.000Z",
        },
        meta: { request_id: "request_current_version_mismatch" },
      }),
    })

    fireEvent.click(screen.getByRole("button", { name: "Use First Light · Afterglow as current" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("The confirmation did not match this Take. Your previous Current is unchanged.")
    expect(screen.getByRole("article", { name: "Take 1: First Light" })).toHaveTextContent("Current version")
  })

  it("turns a contextual AI instruction into a reviewable protected change plan", () => {
    renderStudio()

    const arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    fireEvent.click(within(arrangement).getByRole("button", { name: "Select Verse section" }))

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    expect(within(aiChanges).getByRole("button", { name: "Add part" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByRole("button", { name: "Replace section" })).toBeInTheDocument()
    expect(within(aiChanges).getByRole("button", { name: "Extend" })).toBeInTheDocument()
    expect(within(aiChanges).getByRole("button", { name: "Transform" })).toBeInTheDocument()

    fireEvent.click(within(aiChanges).getByRole("button", { name: "Replace section" }))
    expect(within(aiChanges).getByText("Selected section · Verse")).toBeInTheDocument()

    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Make the chorus wider, warmer, and more memorable." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))

    const changePlan = within(aiChanges).getByRole("region", { name: "AI change plan" })
    expect(within(changePlan).getByText("Replace section")).toBeInTheDocument()
    expect(within(changePlan).getByText("Make the chorus wider, warmer, and more memorable.")).toBeInTheDocument()
    expect(within(changePlan).getByText("Selected section · Verse")).toBeInTheDocument()
    expect(within(changePlan).getByText("2 alternatives · Take lanes")).toBeInTheDocument()
    expect(within(changePlan).getByText("Current version stays untouched.")).toBeInTheDocument()

    expect(within(changePlan).getByRole("button", { name: "Generate 2 takes" })).toBeInTheDocument()
    expect(within(changePlan).getByText("Review before rendering")).toBeInTheDocument()
  })

  it("keeps the user's instruction while changing timeline context before review", () => {
    renderStudio()

    const arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    const aiChanges = within(arrangement).getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Replace section" }))
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Make this section breathe before the lift." },
    })

    fireEvent.click(within(arrangement).getByRole("button", { name: "Select Verse section" }))

    const updatedAiChanges = within(arrangement).getByRole("region", { name: "Mori AI changes" })
    expect(within(updatedAiChanges).getByRole("button", { name: "Replace section" })).toHaveAttribute("aria-pressed", "true")
    expect(within(updatedAiChanges).getByRole("textbox", { name: "Tell Mori what to change" })).toHaveValue("Make this section breathe before the lift.")
    expect(within(updatedAiChanges).getByText("Selected section · Verse")).toBeInTheDocument()
  })

  it("reuses the Studio Change idempotency key when the create receipt is uncertain", async () => {
    const idempotencyKeys: string[] = []
    const submittedInputs: StudioChangeGenerationInput[] = []
    let attempts = 0
    renderStudio({
      createStudioChange: async (_versionRef, input, idempotencyKey) => {
        submittedInputs.push(input)
        idempotencyKeys.push(idempotencyKey)
        attempts += 1
        if (attempts === 1) throw new Error("temporary network failure")
        return { data: { generation_ref: "generation_idempotent_change", status: "queued" }, meta: { request_id: "request_idempotent_change" } }
      },
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_idempotent_change",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "add_part",
          scope: { type: "insertion_point", position_ms: 153_563 },
          instruction: "Add a restrained string lift.",
          preserve: ["melody", "lyrics", "vocal_identity"],
          reference_asset_refs: [],
          output_count: 2,
          status: "failed",
          progress: 12,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_idempotent_change_snapshot" },
      }),
      getGenerationEvents: async () => [],
    })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Add a restrained string lift." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 2 takes" }))

    const retry = await within(aiChanges).findByRole("button", { name: "Retry change" })
    fireEvent.click(retry)

    await waitFor(() => expect(idempotencyKeys).toHaveLength(2))
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0])
    expect(submittedInputs[1]).toEqual(submittedInputs[0])
  })

  it("links the Studio playhead to the global player and current timeline section", () => {
    renderStudio(undefined, { ...previewCandidates[0], audioAssetRef: "asset_studio_playhead" })

    const timeline = within(screen.getByRole("region", { name: "Arrangement editor" })).getByRole("region", { name: "Version timeline" })
    const playhead = within(timeline).getByRole("slider", { name: "Timeline playhead" })
    fireEvent.change(playhead, { target: { value: "72" } })

    expect(playhead).toHaveValue("72")
    expect(within(screen.getByRole("region", { name: "Global player" })).getByRole("slider", { name: "Seek through current version" })).toHaveValue("72")
    expect(within(timeline).getByText("Playhead · Lift")).toBeInTheDocument()
    expect(within(timeline).getByText("1:12 / 3:02")).toBeInTheDocument()
    expect(within(timeline).getByRole("button", { name: "Select Lift section" })).toHaveAttribute("data-playhead", "true")
  })

  it("turns a dragged custom timeline range into the Studio change scope", async () => {
    let submittedInput: StudioChangeGenerationInput | null = null
    renderStudio({
      createStudioChange: async (_versionRef, input) => {
        submittedInput = input
        return { data: { generation_ref: "generation_custom_range", status: "queued" }, meta: { request_id: "request_custom_range" } }
      },
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_custom_range",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "replace_section",
          scope: { type: "time_range", start_ms: 42_000, end_ms: 96_000 },
          instruction: "Let this passage breathe, then rebuild the lift.",
          preserve: ["melody", "lyrics", "vocal_identity"],
          reference_asset_refs: [],
          output_count: 2,
          status: "failed",
          progress: 12,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_custom_range_snapshot" },
      }),
      getGenerationEvents: async () => [],
    })

    const arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    const timeline = within(arrangement).getByRole("region", { name: "Version timeline" })
    fireEvent.change(within(timeline).getByRole("slider", { name: "Selection start" }), { target: { value: "42" } })
    fireEvent.change(within(timeline).getByRole("slider", { name: "Selection end" }), { target: { value: "96" } })

    expect(within(timeline).getByText("Custom range")).toBeInTheDocument()
    expect(within(timeline).getByText("0:42–1:36")).toBeInTheDocument()

    const aiChanges = within(arrangement).getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Replace section" }))
    expect(within(aiChanges).getByText("Selected range · 0:42–1:36")).toBeInTheDocument()
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Let this passage breathe, then rebuild the lift." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 2 takes" }))

    await waitFor(() => expect(submittedInput).toMatchObject({
      operation: "replace_section",
      scope: { type: "time_range", start_ms: 42_000, end_ms: 96_000 },
    }))
  })

  it("invalidates a reviewed change when its custom timeline range moves", () => {
    renderStudio()

    const arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    const timeline = within(arrangement).getByRole("region", { name: "Version timeline" })
    fireEvent.change(within(timeline).getByRole("slider", { name: "Selection start" }), { target: { value: "42" } })
    fireEvent.change(within(timeline).getByRole("slider", { name: "Selection end" }), { target: { value: "96" } })

    const aiChanges = within(arrangement).getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Replace section" }))
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Open the harmony around this passage." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    expect(within(aiChanges).getByRole("region", { name: "AI change plan" })).toBeInTheDocument()

    fireEvent.change(within(timeline).getByRole("slider", { name: "Selection end" }), { target: { value: "104" } })

    expect(within(aiChanges).queryByRole("region", { name: "AI change plan" })).not.toBeInTheDocument()
    expect(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" })).toHaveValue("Open the harmony around this passage.")
    expect(within(aiChanges).getByText("Selected range · 0:42–1:44")).toBeInTheDocument()
  })

  it("sends the reviewed scope, anchors, and alternative count as an explicit Restyle", async () => {
    let submittedInput: StudioChangeGenerationInput | null = null
    renderStudio({
      createStudioChange: async (_versionRef, input) => {
        submittedInput = input
        return { data: { generation_ref: "generation_transform_1", status: "queued" }, meta: { request_id: "request_transform_1" } }
      },
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_transform_1",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "transform",
          intent: "restyle",
          scope: { type: "whole_version" },
          instruction: "Turn this into an acoustic live-room performance.",
          preserve: ["melody", "vocal_identity", "tempo"],
          reference_asset_refs: [],
          output_count: 4,
          status: "failed",
          progress: 18,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_transform_snapshot_1" },
      }),
      getGenerationEvents: async () => [],
    })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Transform" }))
    fireEvent.click(within(aiChanges).getByText("Keep & compare"))

    const anchors = within(aiChanges).getByRole("group", { name: "Keep stable" })
    fireEvent.click(within(anchors).getByRole("button", { name: "Keep lyrics" }))
    fireEvent.click(within(anchors).getByRole("button", { name: "Keep tempo" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "4 takes" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Whole song" }))

    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Turn this into an acoustic live-room performance." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))

    const plan = within(aiChanges).getByRole("region", { name: "AI change plan" })
    expect(within(plan).getByText("Whole song")).toBeInTheDocument()
    expect(within(plan).getByText("Melody · Voice · Tempo")).toBeInTheDocument()
    expect(within(plan).getByText("4 alternatives · Take lanes")).toBeInTheDocument()
    fireEvent.click(within(plan).getByRole("button", { name: "Generate 4 takes" }))

    await waitFor(() => expect(submittedInput).toEqual({
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Turn this into an acoustic live-room performance.",
      preserve: ["melody", "vocal_identity", "tempo"],
      reference_asset_refs: [],
      output_count: 4,
    }))
  })

  it("submits a reviewed Restyle reference and attaches only candidates linked by the matching snapshot", async () => {
    const createStudioChange = vi.fn<MoriApi["createStudioChange"]>(async () => ({
      data: { generation_ref: "generation_restyle_reference", status: "queued" },
      meta: { request_id: "request_restyle_reference" },
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: {
        generation_ref: "generation_restyle_reference",
        generation_kind: "studio_change",
        project_ref: "project_preview_first_light",
        song_plan_ref: null,
        mode: null,
        source_version_ref: "version_preview_first_light_a",
        operation: "transform",
        intent: "restyle",
        scope: { type: "whole_version" },
        instruction: "Reframe the song around the City Lights pulse.",
        preserve: ["melody", "lyrics", "vocal_identity"],
        reference_asset_refs: ["asset_preview_city_lights"],
        output_count: 2,
        status: "succeeded",
        progress: 100,
        candidate_refs: ["candidate_restyle_reference_1", "candidate_restyle_reference_2"],
        created_at: "2026-09-03T12:00:00.000Z",
      },
      meta: { request_id: "request_restyle_reference_snapshot" },
    }))
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(async () => ({
      data: {
        candidates: [
          {
            candidate_ref: "candidate_restyle_reference_1",
            generation_ref: "generation_restyle_reference",
            version_ref: "version_restyle_reference_1",
            project_ref: "project_preview_first_light",
            title: "First Light · City Lights Restyle",
            duration_seconds: 182,
            audio_asset_ref: "asset_restyle_reference_1",
            waveform_asset_ref: "waveform_restyle_reference_1",
            style_tags: ["city pulse", "restyle"],
            created_at: "2026-09-03T12:01:00.000Z",
          },
          {
            candidate_ref: "candidate_restyle_reference_2",
            generation_ref: "generation_restyle_reference",
            version_ref: "version_restyle_reference_2",
            project_ref: "project_preview_first_light",
            title: "First Light · City Lights Afterglow",
            duration_seconds: 183,
            audio_asset_ref: "asset_restyle_reference_2",
            waveform_asset_ref: "waveform_restyle_reference_2",
            style_tags: ["soft pulse", "restyle"],
            created_at: "2026-09-03T12:01:01.000Z",
          },
          {
            candidate_ref: "candidate_restyle_unlinked",
            generation_ref: "generation_other",
            version_ref: "version_restyle_unlinked",
            project_ref: "project_preview_first_light",
            title: "First Light · Unlinked take",
            duration_seconds: 181,
            audio_asset_ref: "asset_restyle_unlinked",
            waveform_asset_ref: "waveform_restyle_unlinked",
            style_tags: ["unlinked"],
            created_at: "2026-09-03T12:01:02.000Z",
          },
        ],
        next_cursor: null,
      },
      meta: { request_id: "request_restyle_reference_candidates" },
    }))

    renderStudio({ createStudioChange, getGeneration, getGenerationEvents: async () => [], listCandidates })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Transform" }))
    fireEvent.click(within(aiChanges).getByText("Keep & compare"))

    const referenceAudio = within(aiChanges).getByRole("group", { name: "Reference audio" })
    const reference = within(referenceAudio).getByRole("button", { name: "Use City Lights demo as reference" })
    fireEvent.click(reference)
    expect(reference).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Whole song" }))
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Reframe the song around the City Lights pulse." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))

    const plan = within(aiChanges).getByRole("region", { name: "AI change plan" })
    expect(within(plan).getByText(/City Lights demo · 24 sec · soft city pulse/u)).toBeInTheDocument()
    expect(within(plan).getByText("Whole song")).toBeInTheDocument()
    fireEvent.click(within(plan).getByRole("button", { name: "Generate 2 takes" }))

    const expectedInput: StudioChangeGenerationInput = {
      operation: "transform",
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Reframe the song around the City Lights pulse.",
      preserve: ["melody", "lyrics", "vocal_identity"],
      reference_asset_refs: ["asset_preview_city_lights"],
      output_count: 2,
    }
    await waitFor(() => expect(createStudioChange).toHaveBeenCalledWith(
      "version_preview_first_light_a",
      expectedInput,
      expect.stringMatching(/^mori-studio-change-/u),
    ))
    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith("generation_restyle_reference"))
    await waitFor(() => expect(listCandidates).toHaveBeenCalledWith("project_preview_first_light", { generation_ref: "generation_restyle_reference" }))
    expect(localStorage.getItem("mori-generation-queue-v1")).toContain("generation_restyle_reference")
    expect(localStorage.getItem("mori-generation-queue-v1")).not.toContain("City Lights pulse")

    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    expect(await within(takeLanes).findByRole("article", { name: "Take 3: First Light · City Lights Restyle" })).toBeInTheDocument()
    expect(within(takeLanes).getByRole("article", { name: "Take 4: First Light · City Lights Afterglow" })).toBeInTheDocument()
    expect(within(takeLanes).queryByText("First Light · Unlinked take")).not.toBeInTheDocument()
    expect(within(takeLanes).getByRole("article", { name: "Take 1: First Light" })).toHaveTextContent("Current version")
  })

  it("loads the live Creative Source projection into the Studio composer", async () => {
    const listCreativeSources = vi.fn<MoriApi["listCreativeSources"]>(async () => ({
      data: {
        sources: [
          { source_kind: "audio", source_ref: "source_live_room", asset_ref: "asset_live_room", name: "Live room guide", description: "18 sec · brushed pulse", duration_seconds: 18, created_at: "2026-09-12T12:00:00.000Z" },
          { source_kind: "voice", source_ref: "voice_live_aria", name: "Aria", description: "Clear mezzo · close phrasing", created_at: "2026-09-12T12:00:01.000Z" },
        ],
        next_cursor: null,
      },
      meta: { request_id: "request_studio_sources" },
    }))
    renderStudio({ listCreativeSources })

    await waitFor(() => expect(listCreativeSources).toHaveBeenCalledWith({ limit: 20 }))
    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Transform" }))
    expect(within(aiChanges).getByRole("button", { name: "Use Live room guide as reference" })).toBeInTheDocument()
    expect(within(aiChanges).queryByRole("button", { name: "Use City Lights demo as reference" })).not.toBeInTheDocument()

    fireEvent.click(within(aiChanges).getByRole("button", { name: "Cover" }))
    expect(within(aiChanges).getByRole("option", { name: "Aria · Clear mezzo · close phrasing" })).toBeInTheDocument()
  })

  it("inserts a selected take into the chosen arrangement range", async () => {
    const createCompositionRevision = vi.fn<MoriApi["createCompositionRevision"]>(async (_versionRef, input) => ({
      data: { version_ref: "version_preview_first_light_a", revision: input.expected_revision + 1, tracks: [] },
      meta: { request_id: "request_insert_clip" },
    }))
    renderStudio({ createCompositionRevision })

    const timeline = screen.getByRole("region", { name: "Version timeline" })
    fireEvent.click(within(timeline).getByRole("button", { name: "Add clip" }))
    fireEvent.click(within(timeline).getByRole("button", { name: "Insert First Light · Afterglow into selected range" }))
    expect(within(timeline).getAllByRole("button", { name: /Main version clip/u })).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: "Save arrangement" }))
    await waitFor(() => expect(createCompositionRevision).toHaveBeenCalledWith(
      "version_preview_first_light_a",
      expect.objectContaining({
        expected_revision: 0,
        commands: [expect.objectContaining({ type: "insert_clip", track_ref: "version_preview_first_light_a:main", source_ref: "version_preview_first_light_b" })],
      }),
      expect.stringMatching(/^mori-composition-/u),
    ))
  })

  it("inserts Library Audio by source identity into the selected arrangement range", async () => {
    const createCompositionRevision = vi.fn<MoriApi["createCompositionRevision"]>(async (_versionRef, input) => ({
      data: { version_ref: "version_preview_first_light_a", revision: input.expected_revision + 1, tracks: [] },
      meta: { request_id: "request_insert_library_audio" },
    }))
    renderStudio({ createCompositionRevision })

    const arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    const dock = within(arrangement).getByRole("region", { name: "Studio asset dock" })
    fireEvent.click(within(dock).getByRole("button", { name: "Insert City Lights demo" }))
    expect(within(screen.getByRole("region", { name: "Version timeline" })).getByRole("button", { name: "Main version clip City Lights demo · 0:24" })).toBeInTheDocument()

    fireEvent.click(within(arrangement).getByRole("button", { name: "Save arrangement" }))
    await waitFor(() => expect(createCompositionRevision).toHaveBeenCalledWith(
      "version_preview_first_light_a",
      expect.objectContaining({
        commands: [expect.objectContaining({ type: "insert_clip", source_ref: "source_preview_city_lights" })],
      }),
      expect.stringMatching(/^mori-composition-/u),
    ))
  })

  it("removes a selected clip with Delete and makes the edit recoverable", () => {
    renderStudio()

    const timeline = screen.getByRole("region", { name: "Version timeline" })
    const clip = within(timeline).getByRole("button", { name: "Main version clip First Light · 3:02" })
    const undo = screen.getByRole("button", { name: "Undo arrangement change" })
    const redo = screen.getByRole("button", { name: "Redo arrangement change" })
    expect(undo).toBeDisabled()
    expect(redo).toBeDisabled()

    fireEvent.keyDown(clip, { key: "Delete" })
    expect(within(timeline).queryByRole("button", { name: "Main version clip First Light · 3:02" })).not.toBeInTheDocument()
    expect(undo).not.toBeDisabled()

    fireEvent.click(undo)
    expect(within(timeline).getByRole("button", { name: "Main version clip First Light · 3:02" })).toBeInTheDocument()
    expect(redo).not.toBeDisabled()

    fireEvent.keyDown(window, { key: "y", ctrlKey: true })
    expect(within(timeline).queryByRole("button", { name: "Main version clip First Light · 3:02" })).not.toBeInTheDocument()
  })

  it("loads a real multi-track composition projection before editing", async () => {
    const getCompositionRevision = vi.fn<MoriApi["getCompositionRevision"]>(async () => ({
      data: {
        version_ref: "version_preview_first_light_a",
        revision: 7,
        tracks: [
          { track_ref: "track_vocals", kind: "vocals", name: "Lead vocal", clips: [{ clip_ref: "clip_vocal", source_ref: "asset_vocal", start_ms: 0, duration_ms: 60_000, offset_ms: 0 }] },
          { track_ref: "track_keys", kind: "instrumental", name: "Keys", clips: [{ clip_ref: "clip_keys", source_ref: "asset_keys", start_ms: 0, duration_ms: 60_000, offset_ms: 0 }] },
        ],
      },
      meta: { request_id: "request_composition_projection" },
    }))
    renderStudio({ getCompositionRevision })
    await waitFor(() => expect(getCompositionRevision).toHaveBeenCalledWith("version_preview_first_light_a"))
    const timeline = screen.getByRole("region", { name: "Version timeline" })
    expect(within(timeline).getByText("Lead vocal")).toBeInTheDocument()
    expect(within(timeline).getByText("Keys")).toBeInTheDocument()
    expect(within(timeline).getByRole("button", { name: "Keys clip Keys audio · 1:00" })).toBeInTheDocument()
  })

  it("labels an empty composition projection instead of presenting it as a saved arrangement", async () => {
    const getCompositionRevision = vi.fn<MoriApi["getCompositionRevision"]>(async () => ({
      data: { version_ref: "version_preview_first_light_a", revision: 4, tracks: [] },
      meta: { request_id: "request_empty_composition" },
    }))

    renderStudio({ getCompositionRevision })

    await waitFor(() => expect(getCompositionRevision).toHaveBeenCalledWith("version_preview_first_light_a"))
    expect(await screen.findByText("No saved arrangement yet · using version baseline")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save arrangement" })).toBeDisabled()
  })

  it("creates a typed Vocal Cover as two new Takes without replacing Current", async () => {
    let submittedVersionRef = ""
    let submittedInput: StudioChangeGenerationInput | null = null
    renderStudio({
      createStudioChange: async (versionRef, input) => {
        submittedVersionRef = versionRef
        submittedInput = input
        return { data: { generation_ref: "generation_cover_ui_1", status: "queued" }, meta: { request_id: "request_cover_ui_1" } }
      },
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_cover_ui_1",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "transform",
          intent: "cover",
          scope: { type: "whole_version" },
          cover_mode: "vocal",
          voice_ref: "voice_preview_mira",
          instruction: "Re-perform this as a close acoustic duet.",
          preserve: ["melody", "lyrics", "structure"],
          reference_asset_refs: [],
          output_count: 2,
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_cover_ui_1", "candidate_cover_ui_2"],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_cover_snapshot_ui_1" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({
        data: {
          candidates: [
            {
              candidate_ref: "candidate_cover_ui_1",
              generation_ref: "generation_cover_ui_1",
              version_ref: "version_cover_ui_1",
              project_ref: "project_preview_first_light",
              title: "First Light · Acoustic Cover",
              duration_seconds: 184,
              audio_asset_ref: "asset_cover_ui_1",
              waveform_asset_ref: "waveform_cover_ui_1",
              style_tags: ["acoustic duet", "Mira"],
              created_at: "2026-09-03T12:01:00.000Z",
            },
            {
              candidate_ref: "candidate_cover_ui_2",
              generation_ref: "generation_cover_ui_1",
              version_ref: "version_cover_ui_2",
              project_ref: "project_preview_first_light",
              title: "First Light · Room Cover",
              duration_seconds: 183,
              audio_asset_ref: "asset_cover_ui_2",
              waveform_asset_ref: "waveform_cover_ui_2",
              style_tags: ["close room", "Mira"],
              created_at: "2026-09-03T12:01:01.000Z",
            },
          ],
          next_cursor: null,
        },
        meta: { request_id: "request_cover_candidates_ui_1" },
      }),
    })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Transform" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Cover" }))
    fireEvent.change(within(aiChanges).getByRole("combobox", { name: "Voice profile" }), { target: { value: "voice_preview_mira" } })
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Re-perform this as a close acoustic duet." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 2 takes" }))

    await waitFor(() => expect(submittedVersionRef).toBe("version_preview_first_light_a"))
    expect(submittedInput).toEqual({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      cover_mode: "vocal",
      voice_ref: "voice_preview_mira",
      instruction: "Re-perform this as a close acoustic duet.",
      preserve: ["melody", "lyrics", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })

    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    expect(await within(takeLanes).findByRole("article", { name: "Take 3: First Light · Acoustic Cover" })).toBeInTheDocument()
    expect(within(takeLanes).getByRole("article", { name: "Take 4: First Light · Room Cover" })).toBeInTheDocument()
    expect(within(within(takeLanes).getByRole("article", { name: "Take 1: First Light" })).getByText("Current version")).toBeInTheDocument()
  })

  it("submits an Instrumental Cover with fixed anchors and no voice or reference assets", async () => {
    let submittedInput: StudioChangeGenerationInput | null = null
    const createStudioChange = vi.fn<MoriApi["createStudioChange"]>(async (_versionRef, input) => {
      submittedInput = input
      return { data: { generation_ref: "generation_instrumental_cover", status: "queued" }, meta: { request_id: "request_instrumental_cover" } }
    })

    renderStudio({
      createStudioChange,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_instrumental_cover",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "transform",
          intent: "cover",
          scope: { type: "whole_version" },
          cover_mode: "instrumental",
          voice_ref: null,
          instruction: "Rebuild this as a felt piano instrumental.",
          preserve: ["melody", "structure"],
          reference_asset_refs: [],
          output_count: 2,
          status: "failed",
          progress: 12,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_instrumental_cover_snapshot" },
      }),
      getGenerationEvents: async () => [],
    })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Transform" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Cover" }))
    fireEvent.change(within(aiChanges).getByRole("combobox", { name: "Voice profile" }), { target: { value: "voice_preview_mira" } })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Instrumental cover" }))

    expect(within(aiChanges).getByRole("button", { name: "Instrumental cover" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).queryByRole("combobox", { name: "Voice profile" })).not.toBeInTheDocument()
    expect(within(aiChanges).queryByRole("group", { name: "Reference audio" })).not.toBeInTheDocument()

    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Rebuild this as a felt piano instrumental." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))

    const plan = within(aiChanges).getByRole("region", { name: "AI change plan" })
    expect(within(plan).getByText("Instrumental")).toBeInTheDocument()
    expect(within(plan).queryByText(/Mira/u)).not.toBeInTheDocument()
    fireEvent.click(within(plan).getByRole("button", { name: "Generate 2 takes" }))

    await waitFor(() => expect(createStudioChange).toHaveBeenCalledOnce())
    expect(submittedInput).toEqual({
      operation: "transform",
      intent: "cover",
      scope: { type: "whole_version" },
      cover_mode: "instrumental",
      voice_ref: null,
      instruction: "Rebuild this as a felt piano instrumental.",
      preserve: ["melody", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })
  })

  it("rejects a Restyle snapshot whose reviewed output context changed", async () => {
    renderStudio({
      createStudioChange: async () => ({
        data: { generation_ref: "generation_restyle_wrong", status: "queued" },
        meta: { request_id: "request_restyle_wrong" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_restyle_wrong",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "transform",
          intent: "restyle",
          scope: { type: "whole_version" },
          instruction: "Turn this into an acoustic live-room performance.",
          preserve: ["melody", "vocal_identity", "tempo"],
          reference_asset_refs: [],
          output_count: 2,
          status: "succeeded",
          progress: 100,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_restyle_wrong_snapshot" },
      }),
      getGenerationEvents: async () => [],
    })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Transform" }))
    fireEvent.click(within(aiChanges).getByText("Keep & compare"))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Keep lyrics" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Keep tempo" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "4 takes" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Whole song" }))
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Turn this into an acoustic live-room performance." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 4 takes" }))

    expect(await within(aiChanges).findByText("The returned Restyle did not match this scope or direction. Nothing was applied.")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Take lanes" })).queryByText(/wrong/u)).not.toBeInTheDocument()
    expect(readGenerationQueueState().items.find((item) => item.generation_ref === "generation_restyle_wrong")?.status).toBe("queued")
  })

  it("rejects a Cover snapshot whose Voice differs from the reviewed plan", async () => {
    renderStudio({
      createStudioChange: async () => ({
        data: { generation_ref: "generation_cover_wrong", status: "queued" },
        meta: { request_id: "request_cover_wrong" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_cover_wrong",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "transform",
          intent: "cover",
          scope: { type: "whole_version" },
          cover_mode: "vocal",
          voice_ref: "voice_preview_rowan",
          instruction: "Re-perform this as a close acoustic duet.",
          preserve: ["melody", "lyrics", "structure"],
          reference_asset_refs: [],
          output_count: 2,
          status: "succeeded",
          progress: 100,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_cover_wrong_snapshot" },
      }),
      getGenerationEvents: async () => [],
    })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Transform" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Cover" }))
    fireEvent.change(within(aiChanges).getByRole("combobox", { name: "Voice profile" }), { target: { value: "voice_preview_mira" } })
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Re-perform this as a close acoustic duet." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 2 takes" }))

    expect(await within(aiChanges).findByText("The returned Cover did not match this mode or Voice. Nothing was applied.")).toBeInTheDocument()
  })

  it("renders a reviewed Studio change into new take lanes without replacing the current version", async () => {
    let submittedVersionRef = ""
    let submittedInput: StudioChangeGenerationInput | null = null
    renderStudio({
      createStudioChange: async (versionRef, input) => {
        submittedVersionRef = versionRef
        submittedInput = input
        return { data: { generation_ref: "generation_change_1", status: "queued" }, meta: { request_id: "request_change_1" } }
      },
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_change_1",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "replace_section",
          scope: { type: "time_range", start_ms: 28_438, end_ms: 66_354 },
          instruction: "Keep the words and open up the chorus.",
          preserve: ["melody", "lyrics", "vocal_identity"],
          reference_asset_refs: [],
          output_count: 2,
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_change_1", "candidate_change_2"],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_change_snapshot_1" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({
        data: {
          candidates: [
            {
              candidate_ref: "candidate_change_1",
              generation_ref: "generation_change_1",
              version_ref: "version_change_1",
              project_ref: "project_preview_first_light",
              title: "First Light · Wider Chorus",
              duration_seconds: 184,
              audio_asset_ref: "asset_change_1",
              waveform_asset_ref: "waveform_change_1",
              style_tags: ["wide chorus", "warm vocal"],
              created_at: "2026-09-03T12:01:00.000Z",
            },
            {
              candidate_ref: "candidate_change_2",
              generation_ref: "generation_change_1",
              version_ref: "version_change_2",
              project_ref: "project_preview_first_light",
              title: "First Light · Open Chorus",
              duration_seconds: 183,
              audio_asset_ref: "asset_change_2",
              waveform_asset_ref: "waveform_change_2",
              style_tags: ["open chorus", "layered harmony"],
              created_at: "2026-09-03T12:01:01.000Z",
            },
          ],
          next_cursor: null,
        },
        meta: { request_id: "request_change_candidates_1" },
      }),
    })

    const arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    fireEvent.click(within(arrangement).getByRole("button", { name: "Select Verse section" }))
    const aiChanges = within(arrangement).getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Replace section" }))
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Keep the words and open up the chorus." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 2 takes" }))

    await waitFor(() => expect(submittedVersionRef).toBe("version_preview_first_light_a"))
    expect(submittedInput).toMatchObject({
      operation: "replace_section",
      scope: { type: "time_range", start_ms: 28_438, end_ms: 66_354 },
      instruction: "Keep the words and open up the chorus.",
      preserve: ["melody", "lyrics", "vocal_identity"],
      output_count: 2,
    })

    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    expect(await within(takeLanes).findByRole("article", { name: "Take 3: First Light · Wider Chorus" })).toBeInTheDocument()
    expect(within(takeLanes).getByRole("article", { name: "Take 4: First Light · Open Chorus" })).toBeInTheDocument()
    expect(within(within(takeLanes).getByRole("article", { name: "Take 1: First Light" })).getByText("Current version")).toBeInTheDocument()
    expect(within(aiChanges).getByText("2 new takes ready below")).toBeInTheDocument()
  })

  it("lets the user cancel an active Studio change and retry the reviewed plan", async () => {
    let cancelledGenerationRef = ""
    renderStudio({
      createStudioChange: async () => ({
        data: { generation_ref: "generation_change_active", status: "queued" },
        meta: { request_id: "request_change_active" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_change_active",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "add_part",
          scope: { type: "insertion_point", position_ms: 153_563 },
          instruction: "Add a short guitar answer.",
          preserve: ["melody", "lyrics", "vocal_identity"],
          reference_asset_refs: [],
          output_count: 2,
          status: "generating",
          progress: 42,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_change_active_snapshot" },
      }),
      getGenerationEvents: async () => [],
      cancelGeneration: async (generationRef) => {
        cancelledGenerationRef = generationRef
        return { data: { generation_ref: generationRef, status: "cancelled" }, meta: { request_id: "request_change_cancel" } }
      },
    })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Add a short guitar answer." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 2 takes" }))

    const cancel = await within(aiChanges).findByRole("button", { name: "Cancel change" })
    await waitFor(() => expect(within(aiChanges).getByRole("progressbar", { name: "Studio change progress" })).toHaveAttribute("aria-valuenow", "42"))
    fireEvent.click(cancel)

    await waitFor(() => expect(cancelledGenerationRef).toBe("generation_change_active"))
    expect(within(aiChanges).getByText("Change cancelled")).toBeInTheDocument()
    expect(within(aiChanges).getByRole("button", { name: "Retry change" })).toBeInTheDocument()
    expect(readGenerationQueueState().items.find((item) => item.generation_ref === "generation_change_active")).toMatchObject({
      status: "cancelled",
      progress: 42,
    })
  })

  it("keeps observing a Studio change when cancellation is only acknowledged", async () => {
    let cancellationAcknowledged = false
    renderStudio({
      createStudioChange: async () => ({
        data: { generation_ref: "generation_change_cancel_pending", status: "queued" },
        meta: { request_id: "request_change_cancel_pending" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_change_cancel_pending",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "add_part",
          scope: { type: "insertion_point", position_ms: 153_563 },
          instruction: "Add a short guitar answer.",
          preserve: ["melody", "lyrics", "vocal_identity"],
          reference_asset_refs: [],
          output_count: 2,
          status: cancellationAcknowledged ? "succeeded" : "generating",
          progress: cancellationAcknowledged ? 100 : 42,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_change_cancel_pending_status" },
      }),
      getGenerationEvents: async () => [],
      cancelGeneration: async (generationRef) => {
        cancellationAcknowledged = true
        return {
          data: { generation_ref: generationRef, status: "preparing" },
          meta: { request_id: "request_change_cancel_pending_ack" },
        }
      },
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: previewCandidates[0].candidateRef,
            generation_ref: "generation_preview_first_light",
            version_ref: previewCandidates[0].versionRef,
            project_ref: "project_preview_first_light",
            title: previewCandidates[0].title,
            duration_seconds: previewCandidates[0].durationSeconds,
            audio_asset_ref: "asset_change_cancel_pending",
            waveform_asset_ref: "waveform_change_cancel_pending",
            style_tags: ["gentle pulse", "intimate vocal"],
            created_at: "2026-09-03T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_change_cancel_pending_candidates" },
      }),
    })

    const aiChanges = screen.getByRole("region", { name: "Mori AI changes" })
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Add a short guitar answer." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 2 takes" }))
    const cancel = await within(aiChanges).findByRole("button", { name: "Cancel change" })
    fireEvent.click(cancel)

    await waitFor(() => expect(within(aiChanges).getByRole("button", { name: "Retry change" })).toBeInTheDocument())
    expect(within(aiChanges).queryByRole("progressbar", { name: "Studio change progress" })).not.toBeInTheDocument()
  })

  it("keeps an in-flight change context when moving between Studio tools", async () => {
    renderStudio({
      createStudioChange: async () => ({
        data: { generation_ref: "generation_change_context", status: "queued" },
        meta: { request_id: "request_change_context" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_change_context",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "replace_section",
          scope: { type: "time_range", start_ms: 28_438, end_ms: 66_354 },
          instruction: "Give this verse more space.",
          preserve: ["melody", "lyrics", "vocal_identity"],
          reference_asset_refs: [],
          output_count: 2,
          status: "generating",
          progress: 42,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_change_context_snapshot" },
      }),
      getGenerationEvents: async () => [],
    })

    let arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    fireEvent.click(within(arrangement).getByRole("button", { name: "Select Verse section" }))
    let aiChanges = within(arrangement).getByRole("region", { name: "Mori AI changes" })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Replace section" }))
    fireEvent.change(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Give this verse more space." },
    })
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Review change" }))
    fireEvent.click(within(aiChanges).getByRole("button", { name: "Generate 2 takes" }))
    await waitFor(() => expect(within(aiChanges).getByRole("progressbar", { name: "Studio change progress" })).toHaveAttribute("aria-valuenow", "42"))

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))

    arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    aiChanges = within(arrangement).getByRole("region", { name: "Mori AI changes" })
    expect(within(arrangement).getByRole("button", { name: "Select Verse section" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByRole("button", { name: "Replace section" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" })).toHaveValue("Give this verse more space.")
    expect(within(aiChanges).getByRole("button", { name: "Cancel change" })).toBeInTheDocument()
  })

  it("renders multiple section-aware lyric suggestions and applies only the selected draft", async () => {
    localStorage.clear()
    let submittedInput: Parameters<MoriApi["createLyricsRevision"]>[1] | null = null
    renderStudio({
      createLyricsRevision: async (_versionRef, input) => {
        submittedInput = input
        return {
          data: { lyrics_revision_ref: "lyrics_revision_ui_1", status: "queued" },
          meta: { request_id: "request_lyrics_ui_1" },
        }
      },
      getLyricsRevision: async () => ({
        data: {
          lyrics_revision_ref: "lyrics_revision_ui_1",
          version_ref: "version_preview_first_light_a",
          status: "succeeded",
          progress: 100,
          direction: "rewrite",
          scope: { type: "section", section_label: "Chorus", start_line: 2, end_line: 4 },
          instruction: "Make the image more vivid while keeping the same cadence.",
          constraints: ["meaning", "cadence"],
          output_count: 2,
          source_digest: "sha256:lyrics-ui-1",
          suggestions: [
            { suggestion_ref: "lyrics_suggestion_ui_1", text: "Every road becomes a rhythm.\nPulling open daylight into view." },
            { suggestion_ref: "lyrics_suggestion_ui_2", text: "Every mile releases morning.\nCarrying the sunlight through." },
          ],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_lyrics_snapshot_ui_1" },
      }),
      getLyricsRevisionEvents: async () => [],
    })

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    const lyricsEditor = screen.getByRole("region", { name: "Lyrics editor" })
    const draft = within(lyricsEditor).getByRole("textbox", { name: "Lyrics draft" })
    const originalDraft = (draft as HTMLTextAreaElement).value
    const lyricPartner = within(lyricsEditor).getByRole("region", { name: "Mori lyric partner" })

    expect(within(lyricPartner).getByRole("button", { name: "Rewrite" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Chorus" }))
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "Make the image more vivid while keeping the same cadence." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))

    const plan = within(lyricPartner).getByRole("region", { name: "Lyric direction plan" })
    expect(within(plan).getByText("Rewrite")).toBeInTheDocument()
    expect(within(plan).getByText("Chorus")).toBeInTheDocument()
    expect(within(plan).getByText("Original draft stays untouched.")).toBeInTheDocument()
    expect(draft).toHaveValue(originalDraft)

    fireEvent.click(within(plan).getByRole("button", { name: "Create 2 suggestions" }))

    await waitFor(() => expect(submittedInput).toEqual({
      direction: "rewrite",
      scope: {
        type: "section",
        section_label: "Chorus",
        start_line: 2,
        end_line: 4,
        source_text: "and every road became a reason\nto carry the morning through",
      },
      instruction: "Make the image more vivid while keeping the same cadence.",
      lyrics_context: originalDraft,
      constraints: ["meaning", "cadence"],
      output_count: 2,
    }))

    const suggestions = await within(lyricPartner).findByRole("region", { name: "Lyric suggestions" })
    expect(within(suggestions).getByRole("button", { name: "Suggestion 1" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(suggestions).getByRole("button", { name: "Suggestion 2" }))
    const suggestedLyrics = within(suggestions).getByRole("textbox", { name: "Suggested lyrics" })
    expect(suggestedLyrics).toHaveValue("Every mile releases morning.\nCarrying the sunlight through.")
    expect(draft).toHaveValue(originalDraft)

    fireEvent.change(suggestedLyrics, {
      target: { value: "We hold the morning in our hands.\nAnd let the open daylight land." },
    })
    fireEvent.click(within(suggestions).getByRole("button", { name: "Apply to draft" }))

    expect((draft as HTMLTextAreaElement).value).toContain("We hold the morning in our hands.")
    expect(within(lyricsEditor).getByText("Unsaved changes")).toBeInTheDocument()
    fireEvent.click(within(lyricsEditor).getByRole("button", { name: "Undo AI edit" }))
    expect(draft).toHaveValue(originalDraft)
    localStorage.clear()
  })

  it("keeps an in-flight lyric revision across Studio tools and lets the user cancel it", async () => {
    localStorage.clear()
    let cancelledRevisionRef = ""
    renderStudio({
      createLyricsRevision: async () => ({
        data: { lyrics_revision_ref: "lyrics_revision_active_1", status: "queued" },
        meta: { request_id: "request_lyrics_active_1" },
      }),
      getLyricsRevision: async () => ({
        data: {
          lyrics_revision_ref: "lyrics_revision_active_1",
          version_ref: "version_preview_first_light_a",
          status: "generating",
          progress: 54,
          direction: "rewrite",
          scope: { type: "section", section_label: "Chorus", start_line: 2, end_line: 4 },
          instruction: "Bring the sunrise closer without changing the cadence.",
          constraints: ["meaning", "cadence"],
          output_count: 2,
          source_digest: "sha256:lyrics-active-1",
          suggestions: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_lyrics_active_snapshot_1" },
      }),
      getLyricsRevisionEvents: async () => [],
      cancelLyricsRevision: async (lyricsRevisionRef) => {
        cancelledRevisionRef = lyricsRevisionRef
        return {
          data: { lyrics_revision_ref: lyricsRevisionRef, status: "cancelled" },
          meta: { request_id: "request_lyrics_active_cancel_1" },
        }
      },
    })

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    let lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Chorus" }))
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "Bring the sunrise closer without changing the cadence." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Create 2 suggestions" }))
    await waitFor(() => expect(within(lyricPartner).getByRole("progressbar", { name: "Lyrics revision progress" })).toHaveAttribute("aria-valuenow", "54"))

    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))

    lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    const plan = within(lyricPartner).getByRole("region", { name: "Lyric direction plan" })
    expect(within(plan).getByText("Bring the sunrise closer without changing the cadence.")).toBeInTheDocument()
    expect(within(plan).getByText("Chorus")).toBeInTheDocument()
    expect(within(plan).getByRole("progressbar", { name: "Lyrics revision progress" })).toHaveAttribute("aria-valuenow", "54")
    fireEvent.click(within(plan).getByRole("button", { name: "Cancel revision" }))

    await waitFor(() => expect(cancelledRevisionRef).toBe("lyrics_revision_active_1"))
    expect(within(plan).getByText("Cancelled")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Retry 2 suggestions" })).toBeInTheDocument()
    localStorage.clear()
  })

  it("does not project a lyric revision into a different open Version", async () => {
    let releaseSnapshot: () => void = () => undefined
    let markSnapshotReturned: () => void = () => undefined
    const snapshotGate = new Promise<void>((resolve) => { releaseSnapshot = resolve })
    const snapshotReturned = new Promise<void>((resolve) => { markSnapshotReturned = resolve })
    const createLyricsRevision = vi.fn(async () => ({
      data: { lyrics_revision_ref: "lyrics_revision_stale_version", status: "queued" as const },
      meta: { request_id: "request_lyrics_stale_version" },
    }))
    const getLyricsRevision = vi.fn(async () => {
      await snapshotGate
      markSnapshotReturned()
      return {
        data: {
          lyrics_revision_ref: "lyrics_revision_stale_version",
          version_ref: "version_preview_first_light_a",
          status: "succeeded" as const,
          progress: 100,
          direction: "rewrite" as const,
          scope: { type: "section" as const, section_label: "Chorus", start_line: 2, end_line: 4 },
          instruction: "Keep this result attached to the original Version.",
          constraints: ["meaning" as const],
          output_count: 2,
          source_digest: "sha256:lyrics-stale-version",
          suggestions: [
            { suggestion_ref: "lyrics_suggestion_stale_version", text: "This belongs to Version A only." },
          ],
          created_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_lyrics_stale_snapshot" },
      }
    })
    renderStudio({
      createLyricsRevision,
      getLyricsRevision,
      getLyricsRevisionEvents: async () => [],
    })

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    let lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Chorus" }))
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "Keep this result attached to the original Version." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Create 2 suggestions" }))
    await waitFor(() => expect(createLyricsRevision).toHaveBeenCalledOnce())
    await waitFor(() => expect(getLyricsRevision).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    expect(within(lyricPartner).queryByText("Keep this result attached to the original Version.")).not.toBeInTheDocument()

    releaseSnapshot()
    await snapshotReturned
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(within(lyricPartner).queryByText("This belongs to Version A only.")).not.toBeInTheDocument()
    expect(within(lyricPartner).queryByRole("region", { name: "Lyric suggestions" })).not.toBeInTheDocument()
  })

  it("lets the new Version start a lyric revision after an old event replay fails late", async () => {
    let releaseEvents: () => void = () => undefined
    let markEventsReturned: () => void = () => undefined
    let capturedEventSignal: AbortSignal | undefined
    const eventsGate = new Promise<void>((resolve) => { releaseEvents = resolve })
    const eventsReturned = new Promise<void>((resolve) => { markEventsReturned = resolve })
    const createLyricsRevision = vi.fn<MoriApi["createLyricsRevision"]>(async () => ({
      data: { lyrics_revision_ref: "lyrics_revision_late_events", status: "queued" as const },
      meta: { request_id: "request_lyrics_late_events" },
    }))
    const getLyricsRevisionEvents = vi.fn<MoriApi["getLyricsRevisionEvents"]>(async (_lyricsRevisionRef, _lastEventId, signal) => {
      capturedEventSignal = signal
      await eventsGate
      markEventsReturned()
      throw new Error("event replay unavailable")
    })
    renderStudio({
      createLyricsRevision,
      getLyricsRevision: async () => ({
        data: {
          lyrics_revision_ref: "lyrics_revision_late_events",
          version_ref: "version_preview_first_light_a",
          status: "generating",
          progress: 52,
          direction: "rewrite",
          scope: { type: "section", section_label: "Chorus", start_line: 2, end_line: 4 },
          instruction: "Keep the first revision on Version A.",
          constraints: ["meaning", "cadence"],
          output_count: 2,
          source_digest: "sha256:lyrics-late-events",
          suggestions: [],
          created_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_lyrics_late_events_snapshot" },
      }),
      getLyricsRevisionEvents,
    })

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    let lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Chorus" }))
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "Keep the first revision on Version A." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Create 2 suggestions" }))
    await waitFor(() => expect(getLyricsRevisionEvents).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))
    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    expect(capturedEventSignal?.aborted).toBe(true)

    releaseEvents()
    await eventsReturned
    await new Promise((resolve) => setTimeout(resolve, 0))

    lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "Start a separate revision for Version B." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Create 2 suggestions" }))

    await waitFor(() => expect(createLyricsRevision).toHaveBeenCalledTimes(2))
    expect(createLyricsRevision.mock.calls[1]?.[0]).toBe("version_preview_first_light_b")
  })

  it("ignores a delayed lyric create receipt after an A to B to A Version switch", async () => {
    let releaseCreate: () => void = () => undefined
    let markCreateReturned: () => void = () => undefined
    const createGate = new Promise<void>((resolve) => { releaseCreate = resolve })
    const createReturned = new Promise<void>((resolve) => { markCreateReturned = resolve })
    const createLyricsRevision = vi.fn(async () => {
      await createGate
      markCreateReturned()
      return {
        data: { lyrics_revision_ref: "lyrics_revision_stale_create", status: "queued" as const },
        meta: { request_id: "request_lyrics_stale_create" },
      }
    })
    const getLyricsRevision = vi.fn(async () => {
      throw new Error("stale receipt must not start observation")
    })
    renderStudio({ createLyricsRevision, getLyricsRevision, getLyricsRevisionEvents: async () => [] })

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    const lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "This create receipt must become stale." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Create 2 suggestions" }))
    await waitFor(() => expect(createLyricsRevision).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light take" })).toHaveAttribute("aria-pressed", "true"))

    releaseCreate()
    await createReturned
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getLyricsRevision).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    expect(screen.queryByText("This create receipt must become stale.")).not.toBeInTheDocument()
  })

  it("ignores a delayed lyric cancellation after an A to B to A Version switch", async () => {
    let releaseCancel: () => void = () => undefined
    let markCancelReturned: () => void = () => undefined
    const cancelGate = new Promise<void>((resolve) => { releaseCancel = resolve })
    const cancelReturned = new Promise<void>((resolve) => { markCancelReturned = resolve })
    const cancelLyricsRevision = vi.fn(async (lyricsRevisionRef: string) => {
      await cancelGate
      markCancelReturned()
      return {
        data: { lyrics_revision_ref: lyricsRevisionRef, status: "cancelled" as const },
        meta: { request_id: "request_lyrics_stale_cancel" },
      }
    })
    renderStudio({
      createLyricsRevision: async () => ({
        data: { lyrics_revision_ref: "lyrics_revision_stale_cancel", status: "queued" },
        meta: { request_id: "request_lyrics_stale_cancel_create" },
      }),
      getLyricsRevision: async () => ({
        data: {
          lyrics_revision_ref: "lyrics_revision_stale_cancel",
          version_ref: "version_preview_first_light_a",
          status: "generating",
          progress: 54,
          direction: "rewrite",
          scope: { type: "section", section_label: "Chorus", start_line: 2, end_line: 4 },
          instruction: "This cancellation must become stale.",
          constraints: ["meaning", "cadence"],
          output_count: 2,
          source_digest: "sha256:lyrics-stale-cancel",
          suggestions: [],
          created_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_lyrics_stale_cancel_snapshot" },
      }),
      getLyricsRevisionEvents: async () => [],
      cancelLyricsRevision,
    })

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    let lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Chorus" }))
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "This cancellation must become stale." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Create 2 suggestions" }))
    await waitFor(() => expect(within(lyricPartner).getByRole("progressbar", { name: "Lyrics revision progress" })).toHaveAttribute("aria-valuenow", "54"))
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Cancel revision" }))
    await waitFor(() => expect(cancelLyricsRevision).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light take" })).toHaveAttribute("aria-pressed", "true"))

    releaseCancel()
    await cancelReturned
    await new Promise((resolve) => setTimeout(resolve, 0))

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "A fresh revision after returning to Version A." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))
    expect(within(lyricPartner).getByRole("button", { name: "Create 2 suggestions" })).toBeInTheDocument()
    expect(within(lyricPartner).queryByText("Cancelled")).not.toBeInTheDocument()
  })

  it("keeps preview lyrics editable without presenting browser storage as a saved Project draft", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    const lyricsEditor = screen.getByRole("region", { name: "Lyrics editor" })
    const lyrics = within(lyricsEditor).getByRole("textbox", { name: "Lyrics draft" })

    fireEvent.change(lyrics, { target: { value: "A new line for the morning." } })
    const save = within(lyricsEditor).getByRole("button", { name: "Save draft" })

    expect(save).toBeDisabled()
    expect(within(lyricsEditor).getByText("Preview words are editable but are not a saved Project draft.")).toBeInTheDocument()
    expect(lyrics).toHaveValue("A new line for the morning.")
    expect(localStorage.getItem("mori.lyrics.version_preview_first_light_a")).toBeNull()
  })

  it("does not hydrate a legacy local lyric value as a saved Project draft", () => {
    localStorage.setItem("mori.lyrics.version_preview_first_light_a", "A legacy local line.")
    renderStudio()
    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))

    expect(screen.getByRole("textbox", { name: "Lyrics draft" })).toHaveValue(defaultStudioLyrics)
    expect(screen.getByText("Preview draft")).toBeInTheDocument()
    localStorage.clear()
  })

  it("keeps an unsaved lyric draft until the user explicitly stays or discards before opening another take", async () => {
    renderStudio()

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Lyrics draft" }), { target: { value: "Keep this line with the first take." } })
    await waitFor(() => expect(screen.getByText("Unsaved changes")).toBeInTheDocument())

    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    const dialog = await screen.findByRole("dialog", { name: "Save changes before opening another Version?" })
    expect(within(dialog).getByText("Save unavailable")).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole("button", { name: "Keep editing" }))
    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    expect(screen.getByRole("textbox", { name: "Lyrics draft" })).toHaveValue("Keep this line with the first take.")

    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    fireEvent.click(await screen.findByRole("button", { name: "Discard & open" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))
  })

  it("saves the active Version’s lyrics before opening the requested take", async () => {
    const projectRef = "project_switch_after_lyrics_save"
    const versionA = previewCandidates[0].versionRef
    const workspace = (revision: number, text: string) => ({
      project: {
        project_ref: projectRef,
        title: "First Light",
        description: "A project with two directions.",
        current_version_ref: versionA,
        candidate_count: 2,
        last_activity_at: "2026-09-04T18:00:00.000Z",
      },
      current_song_plan: null,
      open_version: {
        project_ref: projectRef,
        version_ref: versionA,
        revision: 1,
        updated_at: "2026-09-04T18:00:00.000Z",
      },
      latest_lyrics_draft: {
        lyrics_draft_ref: "lyrics_draft_switch_a",
        project_ref: projectRef,
        version_ref: versionA,
        revision,
        text,
        source_digest: `lyrics-switch-${revision}`,
        updated_at: "2026-09-04T18:00:00.000Z",
      },
      latest_mix_revision: null,
      active_tasks: [],
      revision_cursor: `workspace_switch_${revision}`,
      observed_at: "2026-09-04T18:00:00.000Z",
    })
    const putLyricsDraft = vi.fn<MoriApi["putLyricsDraft"]>(async (_versionRef, input) => ({
      data: workspace(2, input.text),
      meta: { request_id: "request_switch_lyrics_saved" },
    }))

    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={projectRef}
          versionRef={versionA}
          initialSurface="lyrics"
          api={{
            getProject: async () => ({
              data: workspace(1, "Saved words").project,
              meta: { request_id: "request_switch_project" },
            }),
            listCandidates: async () => ({
              data: {
                candidates: previewCandidates.map((candidate) => ({
                  candidate_ref: candidate.candidateRef,
                  generation_ref: candidate.generationRef,
                  version_ref: candidate.versionRef,
                  project_ref: projectRef,
                  title: candidate.title,
                  duration_seconds: candidate.durationSeconds,
                  audio_asset_ref: `asset_${candidate.versionRef}`,
                  waveform_asset_ref: `waveform_${candidate.versionRef}`,
                  style_tags: [candidate.mood.toLowerCase()],
                  created_at: "2026-09-04T18:00:00.000Z",
                })),
                next_cursor: null,
              },
              meta: { request_id: "request_switch_candidates" },
            }),
            getProjectWorkspace: async () => ({
              data: workspace(1, "Saved words"),
              meta: { request_id: "request_switch_workspace" },
            }),
            putLyricsDraft,
          }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    const lyrics = await screen.findByRole("textbox", { name: "Lyrics draft" })
    fireEvent.change(lyrics, { target: { value: "Save this before I compare another take." } })
    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    const dialog = await screen.findByRole("dialog", { name: "Save changes before opening another Version?" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save & open" }))

    await waitFor(() => expect(putLyricsDraft).toHaveBeenCalledWith(
      versionA,
      { text: "Save this before I compare another take.", expected_revision: 1 },
      expect.any(String),
    ))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))
    expect(screen.queryByRole("dialog", { name: "Save changes before opening another Version?" })).not.toBeInTheDocument()
  })

  it("hydrates and owner-confirms a Version-bound Lyrics Draft through the Project workspace", async () => {
    const projectRef = "project_workspace_lyrics"
    const versionRef = "version_workspace_lyrics_b"
    let resolveDraftSave: ((value: Awaited<ReturnType<MoriApi["putLyricsDraft"]>>) => void) | undefined
    const putLyricsDraft = vi.fn<MoriApi["putLyricsDraft"]>(() => new Promise((resolve) => {
      resolveDraftSave = resolve
    }))
    const workspace = (revision: number, text: string) => ({
      project: {
        project_ref: projectRef,
        title: "Window Seat",
        description: "A quiet, forward-moving sketch.",
        current_version_ref: "version_workspace_lyrics_a",
        candidate_count: 2,
        last_activity_at: "2026-09-04T18:00:00.000Z",
      },
      current_song_plan: null,
      open_version: {
        project_ref: projectRef,
        version_ref: versionRef,
        revision: 2,
        updated_at: "2026-09-04T18:01:00.000Z",
      },
      latest_lyrics_draft: {
        lyrics_draft_ref: "lyrics_draft_workspace_b",
        project_ref: projectRef,
        version_ref: versionRef,
        revision,
        text,
        source_digest: `lyrics-digest-${revision}`,
        updated_at: "2026-09-04T18:02:00.000Z",
      },
      latest_mix_revision: null,
      active_tasks: [],
      revision_cursor: `workspace_cursor_${revision}`,
      observed_at: "2026-09-04T18:03:00.000Z",
    })

    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={projectRef}
          versionRef={versionRef}
          initialSurface="lyrics"
          api={{
            getProject: async () => ({
              data: {
                project_ref: projectRef,
                title: "Window Seat",
                description: "A quiet, forward-moving sketch.",
                current_version_ref: "version_workspace_lyrics_a",
                candidate_count: 2,
                last_activity_at: "2026-09-04T18:00:00.000Z",
              },
              meta: { request_id: "request_project_workspace_lyrics" },
            }),
            listCandidates: async () => ({
              data: {
                candidates: [{
                  candidate_ref: "candidate_workspace_lyrics_b",
                  generation_ref: "generation_workspace_lyrics",
                  version_ref: versionRef,
                  project_ref: projectRef,
                  title: "Window Seat · Wide",
                  duration_seconds: 146,
                  audio_asset_ref: "asset_workspace_lyrics_b",
                  waveform_asset_ref: "waveform_workspace_lyrics_b",
                  style_tags: ["wide", "patient"],
                  created_at: "2026-09-04T18:00:00.000Z",
                }],
                next_cursor: null,
              },
              meta: { request_id: "request_candidates_workspace_lyrics" },
            }),
            getProjectWorkspace: async () => ({ data: workspace(4, "Meet me where the streetlights fade"), meta: { request_id: "request_workspace_lyrics" } }),
            putLyricsDraft,
          }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    const lyrics = await screen.findByRole("textbox", { name: "Lyrics draft" })
    expect(lyrics).toHaveValue("Meet me where the streetlights fade")
    expect(screen.getByText("Draft 04")).toBeInTheDocument()
    fireEvent.change(lyrics, { target: { value: "A saved line for the next take." } })
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }))

    await waitFor(() => expect(putLyricsDraft).toHaveBeenCalledWith(
      versionRef,
      { text: "A saved line for the next take.", expected_revision: 4 },
      expect.any(String),
    ))
    expect(screen.getByRole("status", { name: "Saving Project workspace" })).toBeInTheDocument()
    const savingLyrics = screen.getByRole("textbox", { name: "Lyrics draft" })
    expect(savingLyrics).toHaveAttribute("readonly")
    fireEvent.change(savingLyrics, { target: { value: "This cannot overwrite the pending save." } })
    expect(savingLyrics).toHaveValue("A saved line for the next take.")

    resolveDraftSave?.({ data: workspace(5, "A saved line for the next take."), meta: { request_id: "request_lyrics_saved" } })

    await waitFor(() => expect(screen.getByText("Draft 05")).toBeInTheDocument())
    expect(screen.getByRole("textbox", { name: "Lyrics draft" })).toHaveValue("A saved line for the next take.")
    await waitFor(() => expect(screen.getByRole("status", { name: "Project workspace saved" })).toBeInTheDocument())

    fireEvent.change(screen.getByRole("textbox", { name: "Lyrics draft" }), { target: { value: "A later unsaved lyric." } })
    await waitFor(() => expect(screen.queryByRole("status", { name: "Project workspace saved" })).not.toBeInTheDocument())
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
  })

  it("surfaces vocal removal as the default separation path and keeps other parts explicit", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    expect(within(stemsEditor).getByRole("button", { name: "Vocals or one part" })).toHaveAttribute("aria-pressed", "true")
    expect(within(stemsEditor).getByRole("combobox", { name: "Part to isolate" })).toHaveValue("vocals")
    expect(within(stemsEditor).getByText("Returns vocals and an instrumental version.")).toBeInTheDocument()

    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))
    let plan = within(stemsEditor).getByRole("region", { name: "Stem separation plan" })
    expect(within(plan).getByText("Vocals + instrumental")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Separate vocals" })).toBeInTheDocument()

    fireEvent.click(within(plan).getByRole("button", { name: "Edit" }))

    fireEvent.change(within(stemsEditor).getByRole("combobox", { name: "Part to isolate" }), { target: { value: "drums" } })
    fireEvent.click(within(stemsEditor).getByRole("checkbox", { name: "Export MIDI transcription" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))

    plan = within(stemsEditor).getByRole("region", { name: "Stem separation plan" })
    expect(within(plan).getByText("Vocals or one part")).toBeInTheDocument()
    expect(within(plan).getByText("Drums + mix without drums")).toBeInTheDocument()
    expect(within(plan).getByText("Drums")).toBeInTheDocument()
    expect(within(plan).getByText("MIDI included")).toBeInTheDocument()
    expect(within(plan).getByText("Current version stays untouched.")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Separate drums" })).toBeInTheDocument()
  })

  it("requires a meaningful multi-target selection for custom stems", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Choose parts" }))

    const review = within(stemsEditor).getByRole("button", { name: "Review separation" })
    expect(review).toBeDisabled()
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Drums" }))
    expect(review).toBeDisabled()
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Bass" }))
    expect(review).toBeEnabled()
    expect(within(stemsEditor).getByText("2 of 10 selected")).toBeInTheDocument()

    fireEvent.click(review)
    const plan = within(stemsEditor).getByRole("region", { name: "Stem separation plan" })
    expect(within(plan).getByText("Choose parts")).toBeInTheDocument()
    expect(within(plan).getByText("Drums · Bass")).toBeInTheDocument()
    expect(within(plan).getByText("Up to 2 selected stems")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Separate 2 selected stems" })).toBeInTheDocument()
  })

  it("keeps Add vocals and Add instrumental as contextual Stems workflows", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    expect(within(stemsEditor).getByRole("button", { name: "Separate mix" })).toHaveAttribute("aria-pressed", "true")
    expect(within(stemsEditor).getByRole("button", { name: "Add vocals" })).toBeInTheDocument()
    expect(within(stemsEditor).getByRole("button", { name: "Add instrumental" })).toBeInTheDocument()

    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Add vocals" }))
    const layerComposer = within(stemsEditor).getByRole("region", { name: "Add vocals workflow" })
    expect(within(layerComposer).getByText("Layer a vocal across this version.")).toBeInTheDocument()
    expect(within(layerComposer).getByRole("button", { name: "Review vocal layer" })).toBeDisabled()

    fireEvent.change(within(layerComposer).getByRole("textbox", { name: "Lyrics for vocal layer" }), {
      target: { value: "Meet me where the streetlights fade." },
    })
    fireEvent.change(within(layerComposer).getByRole("textbox", { name: "Vocal direction" }), {
      target: { value: "Keep the delivery close and unhurried." },
    })
    fireEvent.change(within(layerComposer).getByRole("combobox", { name: "Voice profile" }), {
      target: { value: "voice_preview_mira" },
    })
    const alternatives = within(layerComposer).getByRole("group", { name: "Alternatives" })
    fireEvent.click(within(alternatives).getByRole("button", { name: "4 takes" }))
    expect(within(alternatives).getByRole("button", { name: "4 takes" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(layerComposer).getByRole("button", { name: "Review vocal layer" }))

    const plan = within(layerComposer).getByRole("region", { name: "Studio layer plan" })
    expect(within(layerComposer).queryByRole("textbox", { name: "Lyrics for vocal layer" })).not.toBeInTheDocument()
    expect(within(plan).getByText("Add vocals")).toBeInTheDocument()
    expect(within(plan).getByText("Whole song")).toBeInTheDocument()
    expect(within(plan).getByText("Melody · Tempo · Structure")).toBeInTheDocument()
    expect(within(plan).getByText("4 alternatives · Take lanes")).toBeInTheDocument()
    expect(within(plan).getByText("Current version stays untouched.")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Generate 4 takes" })).toBeInTheDocument()

    fireEvent.click(within(plan).getByRole("button", { name: "Edit request" }))
    expect(within(layerComposer).getByRole("textbox", { name: "Lyrics for vocal layer" })).toHaveValue("Meet me where the streetlights fade.")
    expect(within(layerComposer).getByRole("textbox", { name: "Vocal direction" })).toHaveValue("Keep the delivery close and unhurried.")
    expect(within(layerComposer).queryByRole("region", { name: "Studio layer plan" })).not.toBeInTheDocument()
  })

  it("preserves an unsubmitted layer draft while comparing Stems workflows", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Add vocals" }))
    fireEvent.change(within(stemsEditor).getByRole("textbox", { name: "Lyrics for vocal layer" }), {
      target: { value: "A line worth keeping." },
    })
    fireEvent.change(within(stemsEditor).getByRole("textbox", { name: "Vocal direction" }), {
      target: { value: "A quiet close-mic lead." },
    })

    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Add instrumental" }))
    expect(within(stemsEditor).getByRole("region", { name: "Add instrumental workflow" })).toBeInTheDocument()
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Add vocals" }))

    expect(within(stemsEditor).getByRole("textbox", { name: "Lyrics for vocal layer" })).toHaveValue("A line worth keeping.")
    expect(within(stemsEditor).getByRole("textbox", { name: "Vocal direction" })).toHaveValue("A quiet close-mic lead.")
  })

  it("renders a reviewed vocal layer into Take Lanes without replacing the current version", async () => {
    let submittedVersionRef = ""
    let submittedInput: StudioChangeGenerationInput | null = null
    renderStudio({
      createStudioChange: async (versionRef, input) => {
        submittedVersionRef = versionRef
        submittedInput = input
        return { data: { generation_ref: "generation_vocal_layer_1", status: "queued" }, meta: { request_id: "request_vocal_layer_1" } }
      },
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_vocal_layer_1",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "add_part",
          scope: { type: "whole_version" },
          part_kind: "vocals",
          lyrics: "Meet me where the streetlights fade.",
          voice_ref: "voice_preview_mira",
          instruction: "Keep the delivery close and unhurried.",
          preserve: ["melody", "tempo", "structure"],
          reference_asset_refs: [],
          output_count: 2,
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_vocal_layer_1"],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_vocal_layer_snapshot_1" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_vocal_layer_1",
            generation_ref: "generation_vocal_layer_1",
            version_ref: "version_vocal_layer_1",
            project_ref: "project_preview_first_light",
            title: "First Light · New Vocal",
            duration_seconds: 182,
            audio_asset_ref: "asset_vocal_layer_1",
            waveform_asset_ref: "waveform_vocal_layer_1",
            style_tags: ["intimate vocal", "source music preserved"],
            created_at: "2026-09-03T12:01:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_vocal_layer_candidates_1" },
      }),
    })

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Add vocals" }))
    const layerComposer = within(stemsEditor).getByRole("region", { name: "Add vocals workflow" })
    fireEvent.change(within(layerComposer).getByRole("textbox", { name: "Lyrics for vocal layer" }), {
      target: { value: "Meet me where the streetlights fade." },
    })
    fireEvent.change(within(layerComposer).getByRole("textbox", { name: "Vocal direction" }), {
      target: { value: "Keep the delivery close and unhurried." },
    })
    fireEvent.change(within(layerComposer).getByRole("combobox", { name: "Voice profile" }), {
      target: { value: "voice_preview_mira" },
    })
    fireEvent.click(within(layerComposer).getByRole("button", { name: "Review vocal layer" }))
    fireEvent.click(within(layerComposer).getByRole("button", { name: "Generate 2 takes" }))

    await waitFor(() => expect(submittedVersionRef).toBe("version_preview_first_light_a"))
    expect(submittedInput).toEqual({
      operation: "add_part",
      scope: { type: "whole_version" },
      part_kind: "vocals",
      instruction: "Keep the delivery close and unhurried.",
      lyrics: "Meet me where the streetlights fade.",
      voice_ref: "voice_preview_mira",
      preserve: ["melody", "tempo", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })

    const reviewTakes = await within(layerComposer).findByRole("button", { name: "Review takes in Arrangement" })
    fireEvent.click(reviewTakes)
    expect(screen.getByRole("tab", { name: "Arrangement" })).toHaveAttribute("aria-selected", "true")
    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    expect(within(takeLanes).getByRole("article", { name: "Take 3: First Light · New Vocal" })).toBeInTheDocument()
    expect(within(within(takeLanes).getByRole("article", { name: "Take 1: First Light" })).getByText("Current version")).toBeInTheDocument()
  })

  it("keeps an active vocal layer reachable across Studio tools", async () => {
    let cancelledGenerationRef = ""
    let releaseCancel: () => void = () => undefined
    const cancelGate = new Promise<void>((resolve) => { releaseCancel = resolve })
    renderStudio({
      createStudioChange: async () => ({
        data: { generation_ref: "generation_vocal_layer_active", status: "queued" },
        meta: { request_id: "request_vocal_layer_active" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_vocal_layer_active",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "add_part",
          scope: { type: "whole_version" },
          part_kind: "vocals",
          lyrics: "Meet me where the streetlights fade.",
          voice_ref: null,
          instruction: "Keep the delivery close and unhurried.",
          preserve: ["melody", "tempo", "structure"],
          reference_asset_refs: [],
          output_count: 2,
          status: "generating",
          progress: 44,
          candidate_refs: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_vocal_layer_active_snapshot" },
      }),
      getGenerationEvents: async () => [],
      cancelGeneration: async (generationRef) => {
        cancelledGenerationRef = generationRef
        await cancelGate
        return {
          data: { generation_ref: generationRef, status: "cancelled" },
          meta: { request_id: "request_vocal_layer_cancel" },
        }
      },
    })

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    let stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Add vocals" }))
    let layerComposer = within(stemsEditor).getByRole("region", { name: "Add vocals workflow" })
    fireEvent.change(within(layerComposer).getByRole("textbox", { name: "Lyrics for vocal layer" }), {
      target: { value: "Meet me where the streetlights fade." },
    })
    fireEvent.change(within(layerComposer).getByRole("textbox", { name: "Vocal direction" }), {
      target: { value: "Keep the delivery close and unhurried." },
    })
    fireEvent.click(within(layerComposer).getByRole("button", { name: "Review vocal layer" }))
    fireEvent.click(within(layerComposer).getByRole("button", { name: "Generate 2 takes" }))
    await waitFor(() => expect(within(layerComposer).getByRole("progressbar", { name: "Studio layer progress" })).toHaveAttribute("aria-valuenow", "44"))

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))

    stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    expect(within(stemsEditor).getByRole("button", { name: "Add vocals" })).toHaveAttribute("aria-pressed", "true")
    layerComposer = within(stemsEditor).getByRole("region", { name: "Add vocals workflow" })
    fireEvent.click(within(layerComposer).getByRole("button", { name: "Cancel layer" }))
    expect(within(layerComposer).getByRole("button", { name: "Stopping…" })).toBeDisabled()
    releaseCancel()
    await waitFor(() => expect(cancelledGenerationRef).toBe("generation_vocal_layer_active"))
    expect(within(layerComposer).getByText("Layer cancelled")).toBeInTheDocument()
  })

  it("submits a stem separation and exposes only returned assets as mix controls", async () => {
    let submittedVersionRef = ""
    let submittedInput: Parameters<MoriApi["createStemSeparation"]>[1] | null = null
    let submittedMixVersionRef = ""
    const submittedMixInputs: Array<Parameters<MoriApi["createMixRevision"]>[1]> = []
    let releaseExportStatus: () => void = () => undefined
    let releaseMixSave: () => void = () => undefined
    const exportStatusGate = new Promise<void>((resolve) => { releaseExportStatus = resolve })
    const mixSaveGate = new Promise<void>((resolve) => { releaseMixSave = resolve })
    renderStudio({
      createStemSeparation: async (versionRef, input) => {
        submittedVersionRef = versionRef
        submittedInput = input
        return {
          data: { stem_separation_ref: "stem_separation_ui_1", status: "queued" },
          meta: { request_id: "request_stem_ui_1" },
        }
      },
      getStemSeparation: async () => ({
        data: {
          stem_separation_ref: "stem_separation_ui_1",
          version_ref: "version_preview_first_light_a",
          status: "succeeded",
          progress: 100,
          mode: "auto_stems",
          target_kinds: [],
          include_midi: true,
          source_audio_digest: "sha256:stem-source-ui-1",
          stems: [
            { stem_ref: "stem_ui_vocals", kind: "vocals", label: "Lead vocal", audio_asset_ref: "asset_ui_vocals", waveform_asset_ref: "waveform_ui_vocals", duration_seconds: 182 },
            { stem_ref: "stem_ui_backing", kind: "backing_vocals", label: "Backing vocals", audio_asset_ref: "asset_ui_backing", waveform_asset_ref: "waveform_ui_backing", duration_seconds: 182 },
            { stem_ref: "stem_ui_drums", kind: "drums", label: "Drums", audio_asset_ref: "asset_ui_drums", waveform_asset_ref: "waveform_ui_drums", duration_seconds: 182 },
            { stem_ref: "stem_ui_bass", kind: "bass", label: "Bass", audio_asset_ref: "asset_ui_bass", waveform_asset_ref: "waveform_ui_bass", duration_seconds: 182 },
            { stem_ref: "stem_ui_other", kind: "other", label: "Other", audio_asset_ref: "asset_ui_other", waveform_asset_ref: "waveform_ui_other", duration_seconds: 182 },
          ],
          midi_asset_ref: "asset_ui_midi",
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_stem_snapshot_ui_1" },
      }),
      getStemSeparationEvents: async () => [],
      createMixRevision: async (versionRef, input) => {
        submittedMixVersionRef = versionRef
        submittedMixInputs.push(input)
        await mixSaveGate
        return {
          data: {
            mix_revision_ref: "mix_revision_ui_1",
            version_ref: versionRef,
            source_stem_separation_ref: input.source_stem_separation_ref,
            name: input.name,
            revision: 1,
            tracks: input.tracks,
            created_at: "2026-09-03T12:01:00.000Z",
          },
          meta: { request_id: "request_mix_revision_ui_1" },
        }
      },
      createExport: async () => ({ data: { export_ref: "export_before_mix", status: "queued" }, meta: { request_id: "request_export_before_mix" } }),
      getExport: async () => {
        await exportStatusGate
        return {
          data: {
            export_ref: "export_before_mix",
            project_ref: "project_preview_first_light",
            version_ref: "version_preview_first_light_a",
            source: { type: "version" },
            scope: { type: "full_song" },
            format: "mp3",
            status: "failed",
            download_url: null,
            created_at: "2026-09-03T12:00:00.000Z",
          },
          meta: { request_id: "request_export_before_mix_failed" },
        }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    let exportDialog = screen.getByRole("dialog", { name: "Export First Light" })
    fireEvent.click(within(exportDialog).getByRole("button", { name: "Start export" }))
    expect(await within(exportDialog).findByRole("status")).toHaveTextContent("Waiting to render MP3")
    fireEvent.click(within(exportDialog).getByRole("button", { name: "Close export" }))

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Full stem split" }))
    fireEvent.click(within(stemsEditor).getByRole("checkbox", { name: "Export MIDI transcription" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Separate detected stems" }))

    await waitFor(() => expect(submittedVersionRef).toBe("version_preview_first_light_a"))
    expect(submittedInput).toEqual({ mode: "auto_stems", target_kinds: [], include_midi: true })
    const stemTracks = await within(stemsEditor).findByRole("region", { name: "Stem tracks" })
    expect(within(stemTracks).getAllByRole("article")).toHaveLength(5)
    expect(within(stemTracks).getByText("MIDI transcription ready")).toBeInTheDocument()
    const mixer = within(stemTracks).getByRole("region", { name: "Stem mixer" })
    expect(within(mixer).getByText("5 tracks · synchronized from this Version")).toBeInTheDocument()
    expect(within(mixer).getAllByRole("link", { name: /Download .+ stem/u })).toHaveLength(5)
    expect(within(mixer).getByText("Non-destructive · Saving creates a Mix Revision; the Current Version and source stems stay unchanged.")).toBeInTheDocument()

    const muteLead = within(stemTracks).getByRole("button", { name: "Mute Lead vocal" })
    fireEvent.click(muteLead)
    expect(within(stemTracks).getByRole("button", { name: "Unmute Lead vocal" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(within(stemTracks).getByRole("button", { name: "Solo Drums" }))
    expect(within(stemTracks).getByRole("button", { name: "Unsolo Drums" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.change(within(stemTracks).getByRole("slider", { name: "Volume Lead vocal" }), { target: { value: "48" } })
    fireEvent.click(within(stemTracks).getByRole("button", { name: "Save mix" }))
    await waitFor(() => expect(submittedMixVersionRef).toBe("version_preview_first_light_a"))
    releaseExportStatus()
    await waitFor(() => expect(screen.getByRole("button", { name: "Export needs attention" })).toHaveAttribute("data-export-status", "failed"))
    releaseMixSave()
    expect(submittedMixInputs[0]).toMatchObject({
      source_stem_separation_ref: "stem_separation_ui_1",
      name: "Stem mix",
    })
    expect(submittedMixInputs[0]?.tracks[0]).toEqual({ stem_ref: "stem_ui_vocals", gain: 0.48, muted: true, pan: 0 })
    expect(await within(stemTracks).findByText("Mix revision 1 saved")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    exportDialog = screen.getByRole("dialog", { name: "Export First Light" })
    expect(within(exportDialog).getByRole("radio", { name: /Mix revision 1/u })).toBeChecked()
    expect(within(exportDialog).queryByRole("alert")).not.toBeInTheDocument()
    expect(within(exportDialog).getByRole("button", { name: "Start export" })).toBeInTheDocument()
    fireEvent.click(within(exportDialog).getByRole("button", { name: "Close export" }))

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    const finishDialog = screen.getByRole("dialog", { name: "Finish First Light" })
    expect(within(finishDialog).getByRole("radio", { name: /Mix revision 1/u })).toBeChecked()
  }, 15_000)

  it("rehydrates the latest saved Mix Revision for Finish and Export after opening a Version", async () => {
    const projectRef = "project_mix_restore"
    const versionRef = "version_mix_restore"
    const mixRevisionRef = "mix_revision_restore_4"
    const workspace = {
      project: {
        project_ref: projectRef,
        title: "First Light",
        description: "A project with a saved mix.",
        current_version_ref: versionRef,
        candidate_count: 1,
        last_activity_at: "2026-09-12T12:00:00.000Z",
      },
      current_song_plan: null,
      open_version: {
        project_ref: projectRef,
        version_ref: versionRef,
        revision: 3,
        updated_at: "2026-09-12T12:00:00.000Z",
      },
      latest_lyrics_draft: null,
      latest_mix_revision: {
        mix_revision_ref: mixRevisionRef,
        version_ref: versionRef,
        revision: 4,
        name: "Wide chorus",
        track_count: 2,
        created_at: "2026-09-12T11:59:00.000Z",
      },
      active_tasks: [],
      revision_cursor: "workspace_mix_restore_4",
      observed_at: "2026-09-12T12:00:00.000Z",
    }
    const getMixRevision = vi.fn<MoriApi["getMixRevision"]>(async () => ({
      data: {
        mix_revision_ref: mixRevisionRef,
        version_ref: versionRef,
        source_stem_separation_ref: "stem_separation_restore",
        name: "Wide chorus",
        revision: 4,
        tracks: [
          { stem_ref: "stem_vocals", gain: 0.72, muted: false, pan: -0.2 },
          { stem_ref: "stem_drums", gain: 0.94, muted: false, pan: 0.18 },
        ],
        created_at: "2026-09-12T11:59:00.000Z",
      },
      meta: { request_id: "request_mix_restore_4" },
    }))

    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={projectRef}
          versionRef={versionRef}
          initialSurface="finish"
          api={{
            listCandidates: async () => ({
              data: {
                candidates: [{
                  candidate_ref: "candidate_mix_restore",
                  generation_ref: "generation_mix_restore",
                  version_ref: versionRef,
                  project_ref: projectRef,
                  title: "First Light",
                  duration_seconds: 182,
                  audio_asset_ref: "asset_mix_restore",
                  waveform_asset_ref: "waveform_mix_restore",
                  style_tags: ["warm", "wide"],
                  created_at: "2026-09-12T11:58:00.000Z",
                }],
                next_cursor: null,
              },
              meta: { request_id: "request_candidates_mix_restore" },
            }),
            getProjectWorkspace: async () => ({ data: workspace, meta: { request_id: "request_workspace_mix_restore" } }),
            getMixRevision,
          }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    const finishDialog = await screen.findByRole("dialog", { name: "Finish First Light" })
    await waitFor(() => expect(getMixRevision).toHaveBeenCalledWith(mixRevisionRef))
    expect(await within(finishDialog).findByRole("radio", { name: /Mix revision 4/u })).toBeChecked()

    fireEvent.click(within(finishDialog).getByRole("button", { name: "Close Finish" }))
    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    const exportDialog = screen.getByRole("dialog", { name: "Export First Light" })
    expect(within(exportDialog).getByRole("radio", { name: /Mix revision 4/u })).toBeChecked()
  })

  it("keeps an active stem separation across Studio tools and lets the user cancel it", async () => {
    let cancelledStemSeparationRef = ""
    renderStudio({
      createStemSeparation: async () => ({
        data: { stem_separation_ref: "stem_separation_active_1", status: "queued" },
        meta: { request_id: "request_stem_active_1" },
      }),
      getStemSeparation: async () => ({
        data: {
          stem_separation_ref: "stem_separation_active_1",
          version_ref: "version_preview_first_light_a",
          status: "separating",
          progress: 47,
          mode: "isolate_part",
          target_kinds: ["vocals"],
          include_midi: false,
          source_audio_digest: "sha256:stem-active-1",
          stems: [],
          midi_asset_ref: null,
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_stem_active_snapshot_1" },
      }),
      getStemSeparationEvents: async () => [],
      cancelStemSeparation: async (stemSeparationRef) => {
        cancelledStemSeparationRef = stemSeparationRef
        return {
          data: { stem_separation_ref: stemSeparationRef, status: "cancelled" },
          meta: { request_id: "request_stem_active_cancel_1" },
        }
      },
    })

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    let stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Separate vocals" }))
    await waitFor(() => expect(within(stemsEditor).getByRole("progressbar", { name: "Stem separation progress" })).toHaveAttribute("aria-valuenow", "47"))

    fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }))
    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))

    stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    const plan = within(stemsEditor).getByRole("region", { name: "Stem separation plan" })
    expect(within(plan).getByText("Vocals or one part")).toBeInTheDocument()
    expect(within(plan).getByRole("progressbar", { name: "Stem separation progress" })).toHaveAttribute("aria-valuenow", "47")
    fireEvent.click(within(plan).getByRole("button", { name: "Cancel separation" }))

    await waitFor(() => expect(cancelledStemSeparationRef).toBe("stem_separation_active_1"))
    expect(within(plan).getByText("Cancelled")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Retry separation" })).toBeInTheDocument()
  })

  it("ignores a stale stem event after cancellation", async () => {
    const eventResolvers: Array<(events: Awaited<ReturnType<MoriApi["getStemSeparationEvents"]>>) => void> = []
    renderStudio({
      createStemSeparation: async () => ({
        data: { stem_separation_ref: "stem_separation_stale_1", status: "queued" },
        meta: { request_id: "request_stem_stale_1" },
      }),
      getStemSeparation: async () => ({
        data: {
          stem_separation_ref: "stem_separation_stale_1",
          version_ref: "version_preview_first_light_a",
          status: "separating",
          progress: 41,
          mode: "isolate_part",
          target_kinds: ["vocals"],
          include_midi: false,
          source_audio_digest: "sha256:stem-stale-1",
          stems: [],
          midi_asset_ref: null,
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_stem_stale_snapshot_1" },
      }),
      getStemSeparationEvents: async () => new Promise((resolve) => { eventResolvers.push(resolve) }),
      cancelStemSeparation: async (stemSeparationRef) => ({
        data: { stem_separation_ref: stemSeparationRef, status: "cancelled" },
        meta: { request_id: "request_stem_stale_cancel_1" },
      }),
    })

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Separate vocals" }))
    await waitFor(() => expect(eventResolvers).toHaveLength(1))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Cancel separation" }))
    await waitFor(() => expect(within(stemsEditor).getByText("Cancelled")).toBeInTheDocument())

    const resolveEvents = eventResolvers[0]
    if (resolveEvents === undefined) throw new Error("stem event resolver was not registered")
    resolveEvents([{
      id: "stem_separation_stale_1:7",
      event: "stem_separation.separating",
      data: {
        stem_separation_ref: "stem_separation_stale_1",
        version_ref: "version_preview_first_light_a",
        status: "separating",
        progress: 73,
        stem_refs: [],
      },
    }])

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(within(stemsEditor).getByText("Cancelled")).toBeInTheDocument()
    expect(within(stemsEditor).queryByText("Separating")).not.toBeInTheDocument()
  })

  it("clears stem results when the current version changes", async () => {
    renderStudio({
      putCurrentVersion: async () => ({
        data: {
          project_ref: "project_preview_first_light",
          current_version_ref: "version_preview_first_light_b",
          source_candidate_ref: "candidate_preview_first_light_b",
          previous_version_ref: "version_preview_first_light_a",
          selected_at: "2026-09-03T20:00:00.000Z",
        },
        meta: { request_id: "request_current_version_stems" },
      }),
      createStemSeparation: async () => ({
        data: { stem_separation_ref: "stem_separation_version_1", status: "queued" },
        meta: { request_id: "request_stem_version_1" },
      }),
      getStemSeparation: async () => ({
        data: {
          stem_separation_ref: "stem_separation_version_1",
          version_ref: "version_preview_first_light_a",
          status: "succeeded",
          progress: 100,
          mode: "isolate_part",
          target_kinds: ["vocals"],
          include_midi: false,
          source_audio_digest: "sha256:stem-version-1",
          stems: [
            { stem_ref: "stem_version_vocals", kind: "vocals", label: "Version vocals", audio_asset_ref: "asset_version_vocals", waveform_asset_ref: "waveform_version_vocals", duration_seconds: 182 },
            { stem_ref: "stem_version_music", kind: "instrumental", label: "Version instrumental", audio_asset_ref: "asset_version_music", waveform_asset_ref: "waveform_version_music", duration_seconds: 182 },
          ],
          midi_asset_ref: null,
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_stem_version_snapshot_1" },
      }),
      getStemSeparationEvents: async () => [],
    })

    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))
    let stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Separate vocals" }))
    expect(await within(stemsEditor).findByText("Version vocals")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Use First Light · Afterglow as current" }))
    await waitFor(() => expect(screen.getByRole("article", { name: "Take 2: First Light · Afterglow" })).toHaveTextContent("Current version"))
    fireEvent.click(screen.getByRole("tab", { name: "Voice & stems" }))

    stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    await waitFor(() => expect(within(stemsEditor).getByRole("region", { name: "Stem separation setup" })).toBeInTheDocument())
    expect(within(stemsEditor).queryByText("Version vocals")).not.toBeInTheDocument()
  })

  it("keeps the global player honest when preview audio is unavailable", () => {
    renderStudio()

    const player = screen.getByRole("region", { name: "Global player" })
    expect(player).toHaveAttribute("data-player-state", "empty")
    expect(within(player).queryByRole("button", { name: "Play" })).not.toBeInTheDocument()
    expect(player).toHaveTextContent("Choose a version")
    expect(player).toHaveTextContent("Ready when you are")
  })

  it("keeps the selected Open Version, canonical URL, copied link, and browser history aligned", async () => {
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.history.replaceState({}, "", "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=arrangement&intent=transform")
    const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue()
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))

    expect(window.location.pathname).toBe("/projects/project_preview_first_light/studio/version_preview_first_light_b")
    expect(window.location.search).toBe("?surface=arrangement&intent=transform")
    expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    await screen.findByRole("button", { name: "Link copied" })
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/projects/project_preview_first_light/studio/version_preview_first_light_b?surface=arrangement&intent=transform`)

    window.history.replaceState({}, "", "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=arrangement&intent=transform")
    fireEvent.popState(window)

    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light take" })).toHaveAttribute("aria-pressed", "true"))
    window.history.replaceState({}, "", originalUrl)
  })

  it("confirms the Studio deep link only after the clipboard write succeeds", async () => {
    const originalUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    window.history.replaceState({}, "", "/projects/project_preview_first_light/studio/version_preview_first_light_b")
    const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue()
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    const copyingButton = screen.getByRole("button", { name: "Copying…" })
    expect(copyingButton).toBeDisabled()
    expect(copyingButton).toHaveAttribute("data-link-copy-status", "copying")
    expect(copyingButton.querySelector('[data-link-copy-icon="copying"]')).toBeInTheDocument()
    const copiedButton = await screen.findByRole("button", { name: "Link copied" })
    expect(copiedButton).toHaveAttribute("data-link-copy-status", "copied")
    expect(copiedButton.querySelector('[data-link-copy-icon="copied"]')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/projects/project_preview_first_light/studio/version_preview_first_light_a`)
    window.history.replaceState({}, "", originalUrl)
  })

  it("reports a failed Studio link copy without claiming success", async () => {
    const writeText = vi.fn<(value: string) => Promise<void>>().mockRejectedValue(new Error("clipboard denied"))
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    const failedButton = await screen.findByRole("button", { name: "Copy failed" })
    expect(failedButton).toHaveAttribute("data-link-copy-status", "failed")
    expect(failedButton.querySelector('[data-link-copy-icon="failed"]')).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Link copied" })).not.toBeInTheDocument()
  })

  it("creates a reviewed Remaster as new Takes without replacing Current", async () => {
    let submittedVersionRef = ""
    let submittedInput: StudioChangeGenerationInput | null = null
    renderStudio({
      createStudioChange: async (versionRef, input) => {
        submittedVersionRef = versionRef
        submittedInput = input
        return { data: { generation_ref: "generation_remaster_1", status: "queued" }, meta: { request_id: "request_remaster_1" } }
      },
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_remaster_1",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "transform",
          intent: "remaster",
          source: { type: "version" },
          variation_strength: "bold",
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_remaster_1", "candidate_remaster_2"],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_remaster_snapshot_1" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({
        data: {
          candidates: [
            {
              candidate_ref: "candidate_remaster_1",
              generation_ref: "generation_remaster_1",
              version_ref: "version_remaster_1",
              project_ref: "project_preview_first_light",
              title: "First Light · Clear Master",
              duration_seconds: 182,
              audio_asset_ref: "asset_remaster_1",
              waveform_asset_ref: "waveform_remaster_1",
              style_tags: ["clearer balance", "bold polish"],
              created_at: "2026-09-03T12:01:00.000Z",
            },
            {
              candidate_ref: "candidate_remaster_2",
              generation_ref: "generation_remaster_1",
              version_ref: "version_remaster_2",
              project_ref: "project_preview_first_light",
              title: "First Light · Wide Master",
              duration_seconds: 182,
              audio_asset_ref: "asset_remaster_2",
              waveform_asset_ref: "waveform_remaster_2",
              style_tags: ["wider image", "bold polish"],
              created_at: "2026-09-03T12:01:01.000Z",
            },
          ],
          next_cursor: null,
        },
        meta: { request_id: "request_remaster_candidates_1" },
      }),
    })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    const dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    expect(submittedVersionRef).toBe("")
    fireEvent.click(within(dialog).getByRole("radio", { name: /Bold/u }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Review remaster" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Create 2 remastered takes" }))

    await waitFor(() => expect(submittedVersionRef).toBe("version_preview_first_light_a"))
    expect(submittedInput).toEqual({
      operation: "transform",
      scope: { type: "whole_version" },
      intent: "remaster",
      source: { type: "version" },
      variation_strength: "bold",
      instruction: "Push clarity, impact, and spatial depth further while preserving the song's identity and structure.",
      preserve: ["melody", "lyrics", "vocal_identity", "tempo", "structure"],
      reference_asset_refs: [],
      output_count: 2,
    })

    expect(await within(dialog).findByText("2 remastered takes are ready.")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Review 2 takes" }))
    expect(screen.queryByRole("dialog", { name: "Finish First Light" })).not.toBeInTheDocument()
    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    expect(within(takeLanes).getByRole("article", { name: "Take 3: First Light · Clear Master" })).toBeInTheDocument()
    expect(within(takeLanes).getByRole("article", { name: "Take 4: First Light · Wide Master" })).toBeInTheDocument()
    expect(within(within(takeLanes).getByRole("article", { name: "Take 1: First Light" })).getByText("Current version")).toBeInTheDocument()
  })

  it("rejects a Remaster snapshot with a different source or strength", async () => {
    renderStudio({
      createStudioChange: async () => ({
        data: { generation_ref: "generation_remaster_wrong", status: "queued" },
        meta: { request_id: "request_remaster_wrong" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_remaster_wrong",
          generation_kind: "studio_change",
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: null,
          source_version_ref: "version_preview_first_light_a",
          operation: "transform",
          intent: "remaster",
          source: { type: "version" },
          variation_strength: "subtle",
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_wrong"],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_remaster_wrong_snapshot" },
      }),
      getGenerationEvents: async () => [],
    })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    const dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("radio", { name: /Bold/u }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Review remaster" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Create 2 remastered takes" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The returned Remaster did not match this source or strength. Nothing was applied.")
    expect(within(dialog).getByRole("button", { name: "Retry remaster" })).toBeInTheDocument()
  })

  it("creates artwork and saves a Version-bound release draft without changing audio Takes", async () => {
    let submittedArtworkVersion = ""
    let submittedArtworkInput: ArtworkGenerationInput | null = null
    let submittedReleaseVersion = ""
    let submittedReleaseInput: ReleaseDraftInput | null = null
    renderStudio({
      getReleaseDraft: async () => { throw new Error("release_draft_not_found") },
      createArtworkGeneration: async (versionRef, input) => {
        submittedArtworkVersion = versionRef
        submittedArtworkInput = input
        return { data: { artwork_generation_ref: "artwork_generation_release_1", status: "queued" }, meta: { request_id: "request_artwork_release_1" } }
      },
      getArtworkGeneration: async () => ({
        data: {
          artwork_generation_ref: "artwork_generation_release_1",
          version_ref: "version_preview_first_light_a",
          status: "succeeded",
          progress: 100,
          prompt: "Sunrise through a train window",
          style: "editorial",
          palette: "violet_night",
          aspect_ratio: "1:1",
          text_policy: "no_text",
          output_count: 4,
          candidates: Array.from({ length: 4 }, (_, index) => ({
            artwork_candidate_ref: `artwork_candidate_release_${index + 1}`,
            image_asset_ref: `asset_artwork_release_${index + 1}`,
            thumbnail_asset_ref: `asset_artwork_release_thumb_${index + 1}`,
            alt_text: `Release artwork concept ${index + 1}`,
          })),
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_artwork_release_snapshot_1" },
      }),
      getArtworkGenerationEvents: async () => [],
      putReleaseDraft: async (versionRef, input) => {
        submittedReleaseVersion = versionRef
        submittedReleaseInput = input
        return {
          data: {
            release_draft_ref: "release_draft_1",
            version_ref: versionRef,
            revision: 1,
            state: "draft",
            title: input.title,
            description: input.description,
            visibility: input.visibility,
            allow_remix: input.allow_remix,
            explicit_content: input.explicit_content,
            artwork: input.artwork,
            updated_at: "2026-09-03T12:01:00.000Z",
          },
          meta: { request_id: "request_release_save_1" },
        }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    const dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Release title" }), { target: { value: "First Light — Dawn Edition" } })
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Release note" }), { target: { value: "A quiet ride toward morning." } })
    fireEvent.click(within(dialog).getByRole("radio", { name: /Public/u }))
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Allow remixes/u }))
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Contains explicit content/u }))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Artwork brief" }), { target: { value: "Sunrise through a train window" } })
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Artwork style" }), { target: { value: "editorial" } })
    fireEvent.click(within(dialog).getByRole("radio", { name: "Violet night" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Review artwork" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Create 4 concepts" }))

    await waitFor(() => expect(submittedArtworkInput).toEqual({
      prompt: "Sunrise through a train window",
      style: "editorial",
      palette: "violet_night",
      aspect_ratio: "1:1",
      text_policy: "no_text",
      output_count: 4,
    }))
    expect(submittedArtworkVersion).toBe("version_preview_first_light_a")
    fireEvent.click(await within(dialog).findByRole("radio", { name: "Use artwork concept 2" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Save release draft" }))

    await waitFor(() => expect(submittedReleaseInput).toEqual({
      title: "First Light — Dawn Edition",
      description: "A quiet ride toward morning.",
      visibility: "public",
      allow_remix: true,
      explicit_content: true,
      artwork: { type: "artwork_candidate", artwork_candidate_ref: "artwork_candidate_release_2" },
      expected_revision: null,
    }))
    expect(submittedReleaseVersion).toBe("version_preview_first_light_a")
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Draft revision 1 saved")
    const takeLanes = document.querySelector<HTMLElement>('[aria-label="Take lanes"]')
    expect(takeLanes).not.toBeNull()
    const takeLanesRegion = takeLanes as HTMLElement
    expect(within(takeLanesRegion).getAllByRole("article", { hidden: true })).toHaveLength(2)
    expect(within(within(takeLanesRegion).getByRole("article", { name: "Take 1: First Light", hidden: true })).getByText("Current version")).toBeInTheDocument()
  })

  it("preserves an active artwork run across Finish close and supports cancel then retry", async () => {
    const createArtworkGeneration = vi.fn(async () => ({
      data: { artwork_generation_ref: "artwork_generation_active", status: "queued" as const },
      meta: { request_id: "request_artwork_active" },
    }))
    const cancelArtworkGeneration = vi.fn(async () => ({
      data: { artwork_generation_ref: "artwork_generation_active", status: "cancelled" as const },
      meta: { request_id: "request_artwork_cancel" },
    }))
    const view = renderStudio({
      getReleaseDraft: async () => { throw new Error("release_draft_not_found") },
      createArtworkGeneration,
      getArtworkGeneration: async () => ({
        data: {
          artwork_generation_ref: "artwork_generation_active",
          version_ref: "version_preview_first_light_a",
          status: "generating" as const,
          progress: 52,
          prompt: "Warm dawn reflected in rain",
          style: "abstract" as const,
          palette: "warm_dawn" as const,
          aspect_ratio: "1:1" as const,
          text_policy: "no_text" as const,
          output_count: 4 as const,
          candidates: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_artwork_active_snapshot" },
      }),
      getArtworkGenerationEvents: async () => [],
      cancelArtworkGeneration,
    })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    let dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Release note" }), { target: { value: "Keep this note while rendering." } })
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Artwork brief" }), { target: { value: "Warm dawn reflected in rain" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Review artwork" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Create 4 concepts" }))
    await waitFor(() => expect(within(dialog).getByRole("progressbar", { name: "Artwork progress" })).toHaveAttribute("aria-valuenow", "52"))

    fireEvent.click(within(dialog).getByRole("button", { name: "Close Finish" }))
    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    expect(within(dialog).getByRole("tab", { name: "Release" })).toHaveAttribute("aria-selected", "true")
    expect(within(dialog).getByRole("textbox", { name: "Release note" })).toHaveValue("Keep this note while rendering.")
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel artwork" }))
    await waitFor(() => expect(cancelArtworkGeneration).toHaveBeenCalledWith("artwork_generation_active", expect.any(String)))
    fireEvent.click(await within(dialog).findByRole("button", { name: "Retry artwork" }))
    await waitFor(() => expect(createArtworkGeneration).toHaveBeenCalledTimes(2))
    view.unmount()
  })

  it("rejects artwork snapshots from another Version or visual plan", async () => {
    renderStudio({
      getReleaseDraft: async () => { throw new Error("release_draft_not_found") },
      createArtworkGeneration: async () => ({ data: { artwork_generation_ref: "artwork_generation_wrong", status: "queued" }, meta: { request_id: "request_artwork_wrong" } }),
      getArtworkGeneration: async () => ({
        data: {
          artwork_generation_ref: "artwork_generation_wrong",
          version_ref: "version_preview_first_light_b",
          status: "succeeded",
          progress: 100,
          prompt: "Quiet violet horizon",
          style: "abstract",
          palette: "mint_haze",
          aspect_ratio: "1:1",
          text_policy: "no_text",
          output_count: 4,
          candidates: [],
          created_at: "2026-09-03T12:00:00.000Z",
        },
        meta: { request_id: "request_artwork_wrong_snapshot" },
      }),
      getArtworkGenerationEvents: async () => [],
    })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    const dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Artwork brief" }), { target: { value: "Quiet violet horizon" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Review artwork" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Create 4 concepts" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The returned artwork did not match this Version or visual plan. Nothing was attached.")
    expect(within(dialog).queryByRole("radiogroup", { name: "Generated artwork concepts" })).not.toBeInTheDocument()
    const takeLanes = document.querySelector<HTMLElement>('[aria-label="Take lanes"]')
    expect(takeLanes).not.toBeNull()
    expect(within(takeLanes as HTMLElement).getAllByRole("article", { hidden: true })).toHaveLength(2)
  })

  it("rejects a mismatched release save while preserving the user's choices", async () => {
    renderStudio({
      getReleaseDraft: async () => { throw new Error("release_draft_not_found") },
      putReleaseDraft: async (_versionRef, input) => ({
        data: {
          release_draft_ref: "release_draft_wrong",
          version_ref: "version_preview_first_light_b",
          revision: 1,
          state: "draft",
          title: input.title,
          description: input.description,
          visibility: input.visibility,
          allow_remix: input.allow_remix,
          explicit_content: input.explicit_content,
          artwork: input.artwork,
          updated_at: "2026-09-03T12:01:00.000Z",
        },
        meta: { request_id: "request_release_wrong" },
      }),
    })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    const dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Release title" }), { target: { value: "First Light — Private Mix" } })
    fireEvent.click(within(dialog).getByRole("radio", { name: /Link only/u }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Save release draft" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The saved draft did not match this Version or your latest choices. Your choices are still here.")
    expect(within(dialog).getByRole("textbox", { name: "Release title" })).toHaveValue("First Light — Private Mix")
    expect(within(dialog).getByRole("radio", { name: /Link only/u })).toBeChecked()
  })

  it("hydrates an existing release draft and saves against its current revision", async () => {
    let submittedInput: ReleaseDraftInput | null = null
    renderStudio({
      getReleaseDraft: async (versionRef) => ({
        data: {
          release_draft_ref: "release_draft_existing",
          version_ref: versionRef,
          revision: 4,
          state: "draft",
          title: "First Light — Existing Draft",
          description: "Existing release note.",
          visibility: "link_only",
          allow_remix: false,
          explicit_content: false,
          artwork: { type: "current" },
          updated_at: "2026-09-03T11:00:00.000Z",
        },
        meta: { request_id: "request_release_existing" },
      }),
      putReleaseDraft: async (versionRef, input) => {
        submittedInput = input
        return {
          data: {
            release_draft_ref: "release_draft_existing",
            version_ref: versionRef,
            revision: 5,
            state: "draft",
            title: input.title,
            description: input.description,
            visibility: input.visibility,
            allow_remix: input.allow_remix,
            explicit_content: input.explicit_content,
            artwork: input.artwork,
            updated_at: "2026-09-03T12:00:00.000Z",
          },
          meta: { request_id: "request_release_existing_save" },
        }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    const dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))
    await waitFor(() => expect(within(dialog).getByRole("textbox", { name: "Release title" })).toHaveValue("First Light — Existing Draft"))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Release note" }), { target: { value: "Updated release note." } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Save release draft" }))

    await waitFor(() => expect(submittedInput).toMatchObject({
      title: "First Light — Existing Draft",
      description: "Updated release note.",
      visibility: "link_only",
      expected_revision: 4,
    }))
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Draft revision 5 saved")
  })

  it("clears Version-bound Release state when the open Take changes", async () => {
    renderStudio({ getReleaseDraft: async () => { throw new Error("release_draft_not_found") } })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    let dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Release title" }), { target: { value: "Temporary title" } })
    fireEvent.click(within(dialog).getByRole("radio", { name: /Public/u }))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Artwork brief" }), { target: { value: "Temporary visual brief" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Close Finish" }))

    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))
    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    dialog = screen.getByRole("dialog", { name: "Finish First Light · Afterglow" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))

    expect(within(dialog).getByRole("textbox", { name: "Release title" })).toHaveValue("First Light · Afterglow")
    expect(within(dialog).getByRole("radio", { name: /Private/u })).toBeChecked()
    expect(within(dialog).getByRole("textbox", { name: "Artwork brief" })).toHaveValue("")
  })

  it("ignores an artwork receipt that returns after an A to B to A Version switch", async () => {
    let releaseCreate: () => void = () => undefined
    const createGate = new Promise<void>((resolve) => { releaseCreate = resolve })
    const createArtworkGeneration = vi.fn(async () => {
      await createGate
      return {
        data: { artwork_generation_ref: "artwork_generation_stale_aba", status: "queued" as const },
        meta: { request_id: "request_artwork_stale_aba" },
      }
    })
    renderStudio({
      getReleaseDraft: async () => { throw new Error("release_draft_not_found") },
      createArtworkGeneration,
    })

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    let dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Artwork brief" }), { target: { value: "This request must become stale" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Review artwork" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Create 4 concepts" }))
    await waitFor(() => expect(createArtworkGeneration).toHaveBeenCalledOnce())
    fireEvent.click(within(dialog).getByRole("button", { name: "Close Finish" }))

    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light take" })).toHaveAttribute("aria-pressed", "true"))
    releaseCreate()
    await new Promise((resolve) => setTimeout(resolve, 0))

    fireEvent.click(screen.getByRole("button", { name: "Finish" }))
    dialog = screen.getByRole("dialog", { name: "Finish First Light" })
    fireEvent.click(within(dialog).getByRole("tab", { name: "Release" }))
    expect(within(dialog).getByRole("textbox", { name: "Artwork brief" })).toHaveValue("")
    expect(within(dialog).queryByRole("progressbar", { name: "Artwork progress" })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("radiogroup", { name: "Generated artwork concepts" })).not.toBeInTheDocument()
  })

  it("reviews an explicit full-song export before queuing it", async () => {
    let exportedVersion = ""
    let exportedInput: MoriExportInput | null = null
    renderStudio({
      createExport: async (versionRef, input) => {
        exportedVersion = versionRef
        exportedInput = input
        return { data: { export_ref: "export_1", status: "queued" }, meta: { request_id: "request_export_1" } }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    expect(exportedVersion).toBe("")
    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    expect(within(dialog).getByText("Full song")).toBeInTheDocument()
    expect(within(dialog).getByRole("radio", { name: /Open version/u })).toBeChecked()
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))

    expect(exportedVersion).toBe("version_preview_first_light_a")
    expect(exportedInput).toEqual({ source: { type: "version" }, scope: { type: "full_song" }, format: "mp3" })
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Waiting to render MP3")
    const exportingButton = screen.getByRole("button", { name: "Exporting", hidden: true })
    expect(exportingButton).toHaveAttribute("data-export-status", "queued")
    expect(exportingButton.querySelector('[data-export-icon="queued"]')).toBeInTheDocument()
  })

  it("recovers an active export from the durable Project workspace", async () => {
    const exportSnapshot = {
      export_ref: "export_workspace_recovery",
      project_ref: "project_preview_first_light",
      version_ref: "version_preview_first_light_a",
      source: { type: "version" as const },
      scope: { type: "full_song" as const },
      format: "wav" as const,
      status: "processing" as const,
      download_url: null,
      created_at: "2026-09-12T12:00:00.000Z",
    }
    const workspace: MoriProjectWorkspaceProjection = {
      project: {
        project_ref: "project_preview_first_light",
        title: "First Light",
        description: "A bright, patient song about finding your way home.",
        current_version_ref: "version_preview_first_light_a",
        candidate_count: 2,
        last_activity_at: "2026-09-12T12:00:00.000Z",
      },
      current_song_plan: null,
      open_version: {
        project_ref: "project_preview_first_light",
        version_ref: "version_preview_first_light_a",
        revision: 1,
        updated_at: "2026-09-12T12:00:00.000Z",
      },
      latest_lyrics_draft: null,
      latest_mix_revision: null,
      active_tasks: [{
        task_ref: exportSnapshot.export_ref,
        kind: "export" as const,
        project_ref: exportSnapshot.project_ref,
        version_ref: exportSnapshot.version_ref,
        status: "running" as const,
        progress: 61,
        updated_at: exportSnapshot.created_at,
      }],
      revision_cursor: "workspace_export_recovery_1",
      observed_at: exportSnapshot.created_at,
    }
    const getExport = vi.fn<MoriApi["getExport"]>(async () => ({
      data: exportSnapshot,
      meta: { request_id: "request_export_workspace_recovery" },
    }))
    renderStudio({
      getProjectWorkspace: async () => ({ data: workspace, meta: { request_id: "request_workspace_export_recovery" } }),
      getExport,
    })

    await waitFor(() => expect(getExport).toHaveBeenCalledWith(exportSnapshot.export_ref))
    fireEvent.click(screen.getByRole("button", { name: "Exporting", hidden: true }))
    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    expect(within(dialog).getByRole("radio", { name: "WAV" })).toBeChecked()
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Rendering WAV")
  })

  it("carries the selected Arrangement range into the export request", async () => {
    let exportedInput: MoriExportInput | null = null
    renderStudio({
      createExport: async (_versionRef, input) => {
        exportedInput = input
        return { data: { export_ref: "export_range_1", status: "queued" }, meta: { request_id: "request_export_range_1" } }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Select Chorus section" }))
    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    const selectedRange = within(dialog).getByRole("radio", { name: /Selected range · Chorus/u })
    expect(selectedRange).not.toBeDisabled()
    fireEvent.click(selectedRange)
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))

    expect(exportedInput).toEqual({
      source: { type: "version" },
      scope: { type: "time_range", start_ms: 104_271, end_ms: 153_563 },
      format: "mp3",
    })
    expect(await within(dialog).findByRole("status")).toHaveTextContent("Waiting to render MP3")
  })

  it("exports the open Take without implying that it was promoted to Current", async () => {
    let exportedVersion = ""
    renderStudio({
      createExport: async (versionRef) => {
        exportedVersion = versionRef
        return { data: { export_ref: "export_open_take", status: "queued" }, meta: { request_id: "request_export_open_take" } }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    const dialog = screen.getByRole("dialog", { name: "Export First Light · Afterglow" })
    expect(within(dialog).getByRole("radio", { name: /Open version/u })).toBeChecked()
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))

    expect(exportedVersion).toBe("version_preview_first_light_b")
  })

  it("turns a completed WAV export into a download action without replacing Export", async () => {
    renderStudio({
      createExport: async () => ({ data: { export_ref: "export_1", status: "queued" }, meta: { request_id: "request_export_1" } }),
      getExport: async () => ({
        data: {
          export_ref: "export_1",
          project_ref: "project_preview_first_light",
          version_ref: "version_preview_first_light_a",
          source: { type: "version" },
          scope: { type: "full_song" },
          format: "wav",
          status: "succeeded",
          download_url: "https://download.kokoro.invalid/export_1.wav",
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_export_2" },
      }),
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    fireEvent.click(within(dialog).getByRole("radio", { name: "WAV" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))

    const download = await within(dialog).findByRole("link", { name: "Download WAV" })
    expect(download).toHaveAttribute("href", "https://download.kokoro.invalid/export_1.wav")
    const exportButton = screen.getByRole("button", { name: "Export ready", hidden: true })
    expect(exportButton).toHaveAttribute("data-export-status", "succeeded")
    expect(exportButton.querySelector('[data-export-icon="succeeded"]')).toBeInTheDocument()
    const statusDescriptionId = exportButton.getAttribute("aria-describedby")
    expect(statusDescriptionId).not.toBeNull()
    expect(document.getElementById(statusDescriptionId ?? "missing-export-status")).toHaveTextContent("Export ready to download")
  })

  it("preserves export choices for retry when creation fails", async () => {
    const submitted: MoriExportInput[] = []
    const idempotencyKeys: string[] = []
    renderStudio({
      createExport: async (_versionRef, input, idempotencyKey) => {
        submitted.push(input)
        idempotencyKeys.push(idempotencyKey)
        throw new Error("render unavailable")
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    fireEvent.click(within(dialog).getByRole("radio", { name: "WAV" }))
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Retry will safely resume the same request.")
    const failedExportButton = screen.getByRole("button", { name: "Export needs attention", hidden: true })
    expect(failedExportButton).toHaveAttribute("data-export-status", "failed")
    expect(failedExportButton.querySelector('[data-export-icon="failed"]')).toBeInTheDocument()
    expect(within(dialog).getByRole("radio", { name: "WAV" })).toBeChecked()
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry export" }))
    await waitFor(() => expect(submitted).toHaveLength(2))
    expect(submitted[0]).toEqual(submitted[1])
    expect(idempotencyKeys[0]).toBe(idempotencyKeys[1])
  })

  it("keeps tracking the same export through a transient status read failure", async () => {
    let statusReads = 0
    const createExport = vi.fn<MoriApi["createExport"]>(async () => ({
      data: { export_ref: "export_recovering", status: "queued" },
      meta: { request_id: "request_export_recovering" },
    }))
    renderStudio({
      createExport,
      getExport: async () => {
        statusReads += 1
        if (statusReads === 1) throw new Error("temporary network failure")
        return {
          data: {
            export_ref: "export_recovering",
            project_ref: "project_preview_first_light",
            version_ref: "version_preview_first_light_a",
            source: { type: "version" },
            scope: { type: "full_song" },
            format: "mp3",
            status: "succeeded",
            download_url: "https://download.kokoro.invalid/export_recovering.mp3",
            created_at: "2026-09-02T12:00:00.000Z",
          },
          meta: { request_id: "request_export_recovered" },
        }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))

    expect(await within(dialog).findByRole("link", { name: "Download MP3" })).toBeInTheDocument()
    expect(statusReads).toBe(2)
    expect(createExport).toHaveBeenCalledOnce()
  })

  it("ignores an export receipt that returns after an A to B to A Version switch", async () => {
    let releaseCreate: () => void = () => undefined
    const createGate = new Promise<void>((resolve) => { releaseCreate = resolve })
    let createStarted = false
    renderStudio({
      createExport: async () => {
        createStarted = true
        await createGate
        return { data: { export_ref: "export_stale_aba", status: "queued" }, meta: { request_id: "request_export_stale_aba" } }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    let dialog = screen.getByRole("dialog", { name: "Export First Light" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))
    await waitFor(() => expect(createStarted).toBe(true))
    fireEvent.click(within(dialog).getByRole("button", { name: "Close export" }))

    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light · Afterglow take" })).toHaveAttribute("aria-pressed", "true"))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light take" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Select First Light take" })).toHaveAttribute("aria-pressed", "true"))
    releaseCreate()
    await new Promise((resolve) => setTimeout(resolve, 0))

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    dialog = screen.getByRole("dialog", { name: "Export First Light" })
    expect(within(dialog).getByRole("button", { name: "Start export" })).toBeInTheDocument()
  })

  it("rejects an export snapshot from a different render context", async () => {
    renderStudio({
      createExport: async () => ({ data: { export_ref: "export_wrong", status: "queued" }, meta: { request_id: "request_export_wrong" } }),
      getExport: async () => ({
        data: {
          export_ref: "export_wrong",
          project_ref: "project_other",
          version_ref: "version_preview_first_light_a",
          source: { type: "version" },
          scope: { type: "full_song" },
          format: "mp3",
          status: "succeeded",
          download_url: "https://download.kokoro.invalid/export_wrong.mp3",
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_export_wrong_snapshot" },
      }),
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))
    const dialog = screen.getByRole("dialog", { name: "Export First Light" })
    fireEvent.click(within(dialog).getByRole("button", { name: "Start export" }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The export result did not match this Version. Your choices are still here.")
    expect(within(dialog).queryByRole("link", { name: /Download/u })).not.toBeInTheDocument()
  })

  it("keeps the open Version distinct from the projected Current Version", async () => {
    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef="project_live_current"
          api={{
            getProject: async () => ({
              data: {
                project_ref: "project_live_current",
                title: "Window Seat",
                description: "Two directions",
                current_version_ref: "version_live_b",
                candidate_count: 2,
                last_activity_at: "2026-09-03T20:00:00.000Z",
              },
              meta: { request_id: "request_project_current" },
            }),
            listCandidates: async () => ({
              data: {
                candidates: [
                  {
                    candidate_ref: "candidate_live_a",
                    generation_ref: "generation_live",
                    version_ref: "version_live_a",
                    project_ref: "project_live_current",
                    title: "Window Seat",
                    duration_seconds: 140,
                    audio_asset_ref: "asset_live_a",
                    waveform_asset_ref: "waveform_live_a",
                    style_tags: ["quiet"],
                    created_at: "2026-09-03T19:58:00.000Z",
                  },
                  {
                    candidate_ref: "candidate_live_b",
                    generation_ref: "generation_live",
                    version_ref: "version_live_b",
                    project_ref: "project_live_current",
                    title: "Window Seat · Wide",
                    duration_seconds: 146,
                    audio_asset_ref: "asset_live_b",
                    waveform_asset_ref: "waveform_live_b",
                    style_tags: ["wide"],
                    created_at: "2026-09-03T19:59:00.000Z",
                  },
                ],
                next_cursor: null,
              },
              meta: { request_id: "request_candidates_current" },
            }),
          }}
        />
      </MoriAppProvider>,
    )

    const history = await screen.findByRole("complementary", { name: "Version history" })
    await waitFor(() => expect(within(history).getByRole("link", { name: "Window Seat · Wide, Current, 2:26" })).not.toHaveAttribute("aria-current"))
    expect(within(history).getByRole("link", { name: "Window Seat, Draft, Open, 2:20" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByText("Open take")).toBeInTheDocument()
  })

  it("hydrates the studio version from the requested project projection", async () => {
    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef="project_live_1"
          api={{
            createExport: async () => ({ data: { export_ref: "export_1", status: "queued" as const }, meta: { request_id: "request_export_1" } }),
            listCandidates: async () => ({
              data: {
                candidates: [{
                  candidate_ref: "candidate_live_1",
                  generation_ref: "generation_live_1",
                  version_ref: "version_live_1",
                  project_ref: "project_live_1",
                  title: "Window Seat",
                  duration_seconds: 140,
                  audio_asset_ref: "asset_live_1",
                  waveform_asset_ref: "waveform_live_1",
                  style_tags: ["soft motion", "close vocal"],
                  created_at: "2026-09-02T12:00:00.000Z",
                }],
                next_cursor: null,
              },
              meta: { request_id: "request_candidates_1" },
            }),
          }}
        />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Window Seat" })).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/projects/project_live_1")
    expect(screen.getByRole("link", { name: /Window Seat/ })).toHaveAttribute("href", "/projects/project_live_1/studio/version_live_1")
    expect(screen.getAllByText("soft motion · close vocal").length).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Select Whole song section" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: "Select Chorus section" })).not.toBeInTheDocument()

    const lyricsSummary = screen.getByRole("region", { name: "Lyrics summary" })
    expect(within(lyricsSummary).getByText("No lyric draft attached")).toBeInTheDocument()
    fireEvent.click(within(lyricsSummary).getByRole("button", { name: "Open Lyrics" }))
    expect(screen.getByRole("tab", { name: "Lyrics" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("textbox", { name: "Lyrics draft" })).toHaveValue("")
    await waitFor(() => expect(screen.getByRole("tab", { name: "Lyrics" })).toHaveFocus())
  })

  it("shows an explicit unavailable state when the requested version is absent", async () => {
    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef="project_live_2"
          versionRef="version_live_2"
          api={{
            createExport: async () => ({ data: { export_ref: "export_empty", status: "queued" as const }, meta: { request_id: "request_empty_export" } }),
            listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_empty_studio" } }),
          }}
        />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("region", { name: "Studio version unavailable" })).toBeInTheDocument())
    expect(screen.getByText("This Version is not available")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "First Light" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/projects/project_live_2")
    expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/projects/project_live_2")
  })

  it("encodes the Project link when an opaque Project ref contains URL delimiters", async () => {
    const specialCandidate = {
      ...previewCandidates[0],
      projectRef: "project live / 01",
      versionRef: "version?take=2#wide",
    }
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(async () => ({
      data: {
        candidates: [{
          candidate_ref: "candidate_opaque_studio",
          generation_ref: "generation_opaque_studio",
          version_ref: specialCandidate.versionRef,
          project_ref: specialCandidate.projectRef,
          title: specialCandidate.title,
          duration_seconds: specialCandidate.durationSeconds,
          audio_asset_ref: specialCandidate.audioAssetRef ?? "asset_opaque_studio",
          waveform_asset_ref: "waveform_opaque_studio",
          style_tags: ["quiet", "close vocal"],
          created_at: "2026-09-04T12:00:00.000Z",
        }],
        next_cursor: null,
      },
      meta: { request_id: "request_opaque_studio" },
    }))

    render(
      <MoriAppProvider>
        <StudioPageContent
          candidate={previewCandidates[0]}
          projectRef={specialCandidate.projectRef}
          versionRef={specialCandidate.versionRef}
          api={{ listCandidates }}
          stemPlaybackFactory={createTestStemPlaybackController}
        />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: specialCandidate.title })).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute(
      "href",
      "/projects/project%20live%20%2F%2001",
    )
  })
})
