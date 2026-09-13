import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { GenerationCreateInput, MoriApi, MoriProjectWorkspaceProjection } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"
import type { Candidate } from "./domain"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import { CreateCanvas, type CreationDraft } from "./components/create-canvas"
import { createGenerationQueueState } from "./generation-queue"
import { MoriWorkspace } from "./mori-workspace"
import type { PlayerMediaFactory } from "./player-media"
import { previewCandidates, previewProject } from "./preview-data"
import { generationQueueStorageKey, readGenerationQueueState, writeGenerationQueueState } from "./generation-queue-storage"

type WorkspaceApi = Pick<MoriApi, "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration">
  & Partial<Pick<MoriApi, "createProject" | "getProject" | "putCurrentVersion">>

function createWorkspaceApi(overrides: Partial<WorkspaceApi> = {}): WorkspaceApi {
  return {
    createSongPlan: async () => { throw new Error("unexpected createSongPlan") },
    createGeneration: async () => { throw new Error("unexpected createGeneration") },
    getGeneration: async () => { throw new Error("unexpected getGeneration") },
    getGenerationEvents: async () => [],
    listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_empty_candidates" } }),
    cancelGeneration: async () => { throw new Error("unexpected cancelGeneration") },
    ...overrides,
  }
}

function renderWorkspace() {
  return render(
    <MoriAppProvider>
      <MoriWorkspace />
    </MoriAppProvider>,
  )
}

function ModalShortcutHarness() {
  const { playing, selectPlayerCandidate } = useMoriApp()
  return <>
    <button type="button" onClick={() => selectPlayerCandidate(previewCandidates[0])}>Load player</button>
    <span role="status">{playing ? "playing" : "paused"}</span>
    <section role="dialog" aria-modal="true" aria-label="Test modal" tabIndex={-1}>Modal</section>
  </>
}

const outsideListen: Candidate = {
  candidateRef: "candidate_outside_listen",
  versionRef: "version_outside_listen",
  generationRef: "generation_outside_listen",
  title: "Outside listen",
  subtitle: "Keep this playing",
  durationSeconds: 180,
  mood: "Focused",
  waveformSeed: 73,
  isCurrent: false,
  audioAssetRef: "asset/outside-listen",
}

const silentMediaFactory: PlayerMediaFactory = () => ({
  setSource: vi.fn(),
  play: vi.fn(async () => undefined),
  pause: vi.fn(),
  seek: vi.fn(),
  setMuted: vi.fn(),
  dispose: vi.fn(),
})

class CreateFakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true)
  state: RecordingState = "inactive"
  mimeType = "audio/webm"
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onerror: (() => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    void stream
    void options
  }

  start() {
    this.state = "recording"
    this.ondataavailable?.({ data: new Blob(["recorded reference"], { type: "audio/webm" }) })
  }

  stop() {
    this.state = "inactive"
    this.onstop?.()
  }
}

function ActivePlayerHarness() {
  const { playbackQueue, playerCandidate, playing, positionSeconds, selectPlayerCandidate, setPlaying } = useMoriApp()
  return <>
    <button type="button" onClick={() => {
      selectPlayerCandidate(outsideListen, 40)
      setPlaying(true)
    }}>Start outside listen</button>
    <output aria-label="global listening state">{[
      playerCandidate?.versionRef ?? "none",
      playing ? "playing" : "paused",
      String(positionSeconds),
      playbackQueue.map((candidate) => candidate.versionRef).join(","),
    ].join("|")}</output>
  </>
}

describe("Mori workspace", () => {
  it("keeps the desktop Generation queue beside the editable Create canvas", () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })

    try {
      renderWorkspace()
      expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveTextContent("Generations")
      fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))

      expect(screen.getByRole("complementary", { name: "Generation queue" })).toBeInTheDocument()
      expect(screen.queryByRole("dialog", { name: "Generation queue" })).not.toBeInTheDocument()
      expect(screen.getByRole("textbox", { name: "Song idea" })).toBeEnabled()
      expect(document.body.style.overflow).toBe("")
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("uses a modal Generation queue drawer on compact screens", () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 900 })

    try {
      renderWorkspace()
      fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))

      expect(screen.getByRole("dialog", { name: "Generation queue" })).toHaveAttribute("aria-modal", "true")
      expect(screen.queryByRole("complementary", { name: "Generation queue" })).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Dismiss generation queue" })).toBeInTheDocument()
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
    }
  })

  it("does not trigger global playback shortcuts from an active modal", () => {
    render(<MoriAppProvider><ModalShortcutHarness /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Load player" }))

    const modal = screen.getByRole("dialog", { name: "Test modal" })
    fireEvent.keyDown(modal, { code: "Space" })

    expect(screen.getByRole("status")).toHaveTextContent("paused")
  })

  it("starts an unscoped creation as a new Project without preview work in its queue", () => {
    renderWorkspace()
    expect(screen.getByRole("navigation", { name: "Mori" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /make something you can feel/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /smart/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("New project", { selector: "strong" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "First Light" })).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: /generation queue/i })).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: /global player/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /open generation queue/i }))
    expect(screen.getByText("No generations yet")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Song plan" })).not.toBeInTheDocument()
  })

  it("offers a random starting idea without changing the creation mode", () => {
    renderWorkspace()
    const idea = screen.getByRole("textbox", { name: "Song idea" })
    fireEvent.change(idea, { target: { value: "My own starting idea" } })
    fireEvent.click(screen.getByRole("button", { name: "Surprise me" }))

    expect(idea).not.toHaveValue("My own starting idea")
    expect((idea as HTMLTextAreaElement).value).toMatch(/\.$/u)
    expect(screen.getByRole("tab", { name: /smart/i })).toHaveAttribute("aria-selected", "true")
  })

  it("restores the active generation reference after a refresh without restoring prompt contents", async () => {
    localStorage.setItem("mori-generation-queue-v1", JSON.stringify({
      version: 1,
      active_generation_ref: "generation_restored",
      items: [{
        generation_ref: "generation_restored",
        project_ref: "project_restored",
        source_version_ref: null,
        kind: "create",
        label: "Restored direction",
        created_at: "2026-09-04T12:00:00.000Z",
        status: "generating",
        progress: 42,
        candidate_refs: [],
        last_event_id: null,
      }],
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: {
        generation_ref: "generation_restored",
        generation_kind: "new_song",
        project_ref: "project_restored",
        song_plan_ref: null,
        mode: "custom",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "generating",
        progress: 42,
        candidate_refs: [],
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_generation_restored" },
    }))

    render(<MoriAppProvider><MoriWorkspace api={createWorkspaceApi({ getGeneration })} /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith("generation_restored"))
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "active")
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    expect(screen.getAllByText("Generating").length).toBeGreaterThan(0)
    expect(localStorage.getItem("mori-generation-queue-v1")).not.toContain("prompt")
  })

  it("restores an explicit Create generation from its route without a local queue", async () => {
    localStorage.clear()
    const generationRef = "generation_route_only_create"
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_route_only_create",
        song_plan_ref: "song_plan_route_only_create",
        mode: "smart",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "generating",
        progress: 47,
        candidate_refs: [],
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_route_only_create" },
    }))

    render(<MoriAppProvider><MoriWorkspace
      projectRef="project_route_only_create"
      generationRef={generationRef}
      api={createWorkspaceApi({ getGeneration })}
    /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(generationRef))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "active")
      expect(readGenerationQueueState().items).toContainEqual(expect.objectContaining({
        generation_ref: generationRef,
        project_ref: "project_route_only_create",
        kind: "create",
        status: "generating",
        progress: 47,
      }))
    })
    expect(localStorage.getItem("mori-generation-queue-v1")).not.toContain("song_plan_route_only_create")
    expect(getGeneration).toHaveBeenCalledTimes(1)
    localStorage.clear()
  })

  it("does not offer retry for a recovered generation without its original draft", async () => {
    localStorage.clear()
    const generationRef = "generation_route_failed_without_draft"
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_route_failed_without_draft",
        song_plan_ref: "song_plan_route_failed_without_draft",
        mode: "smart",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "failed",
        progress: 0,
        candidate_refs: [],
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_route_failed_without_draft" },
    }))

    render(<MoriAppProvider><MoriWorkspace
      projectRef="project_route_failed_without_draft"
      generationRef={generationRef}
      api={createWorkspaceApi({ getGeneration })}
    /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(generationRef))
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
    localStorage.clear()
  })

  it("retries an explicit Create route after a transient recovery failure", async () => {
    localStorage.clear()
    const generationRef = "generation_route_retry_create"
    let attempts = 0
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => {
      attempts += 1
      if (attempts === 1) {
        throw new TypeError("Failed to fetch")
      }
      return {
        data: {
          generation_ref: generationRef,
          generation_kind: "new_song",
          project_ref: "project_route_retry_create",
          song_plan_ref: null,
          mode: "custom",
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "generating",
          progress: 28,
          candidate_refs: [],
          created_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_route_retry_create_2" },
      }
    })

    render(<MoriAppProvider><MoriWorkspace
      projectRef="project_route_retry_create"
      generationRef={generationRef}
      api={createWorkspaceApi({ getGeneration })}
    /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 2_500 })
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "active")
    localStorage.clear()
  })

  it("recovers when the mounted Create surface gains an explicit generation route", async () => {
    localStorage.clear()
    const generationRef = "generation_route_transition_create"
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_route_transition_create",
        song_plan_ref: null,
        mode: "custom",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "generating",
        progress: 39,
        candidate_refs: [],
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_route_transition_create" },
    }))
    const renderView = (routeGenerationRef?: string) => (
      <MoriAppProvider>
        <MoriWorkspace
          projectRef="project_route_transition_create"
          generationRef={routeGenerationRef}
          api={createWorkspaceApi({ getGeneration })}
        />
      </MoriAppProvider>
    )
    const view = render(renderView())
    await waitFor(() => expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "idle"))

    view.rerender(renderView(generationRef))

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(generationRef))
    await waitFor(() => expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "active"))
    localStorage.clear()
  })

  it("clears the previous Project projection before attaching a cross-Project generation route", async () => {
    localStorage.clear()
    const generationRef = "generation_cross_project_create"
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(() => new Promise(() => undefined))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_cross_project_create",
        song_plan_ref: null,
        mode: "custom",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "succeeded",
        progress: 100,
        candidate_refs: ["candidate_cross_project_create"],
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_cross_project_create" },
    }))
    const renderView = (projectRef: string, routeGenerationRef?: string) => (
      <MoriAppProvider>
        <MoriWorkspace
          projectRef={projectRef}
          generationRef={routeGenerationRef}
          api={createWorkspaceApi({ getGeneration, listCandidates })}
        />
      </MoriAppProvider>
    )
    const view = render(renderView(previewProject.projectRef))
    expect(screen.getAllByText(previewCandidates[0].title).length).toBeGreaterThan(0)

    view.rerender(renderView("project_cross_project_create", generationRef))

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(generationRef))
    await waitFor(() => expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "ready"))
    await waitFor(() => expect(listCandidates).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    expect(screen.queryByText(previewCandidates[0].title)).not.toBeInTheDocument()
    localStorage.clear()
  })

  it("does not attach an explicit Create route when its owner snapshot has the wrong context", async () => {
    const generationRef = "generation_wrong_context_create"
    writeGenerationQueueState(createGenerationQueueState({
      active_generation_ref: generationRef,
      items: [{
        generation_ref: generationRef,
        project_ref: "project_expected_create",
        source_version_ref: null,
        kind: "create",
        label: "Unverified local direction",
        created_at: "2026-09-04T12:00:00.000Z",
        status: "generating",
        progress: 61,
        candidate_refs: [],
        last_event_id: null,
      }],
    }))
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(async () => ({
      data: { candidates: [], next_cursor: null },
      meta: { request_id: "request_wrong_context_candidates" },
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_other_create",
        song_plan_ref: null,
        mode: "custom",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "succeeded",
        progress: 100,
        candidate_refs: ["candidate_wrong_context_create"],
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_wrong_context_create" },
    }))

    render(<MoriAppProvider><MoriWorkspace
      projectRef="project_expected_create"
      generationRef={generationRef}
      api={createWorkspaceApi({ getGeneration, listCandidates })}
    /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(generationRef))
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "idle")
    expect(listCandidates).not.toHaveBeenCalled()
    localStorage.clear()
  })

  it("restores the generation selected by the route instead of another tab's global active task", async () => {
    const item = (generationRef: string, createdAt: string) => ({
      generation_ref: generationRef,
      project_ref: "project_route_queue",
      source_version_ref: null,
      kind: "create",
      label: generationRef,
      created_at: createdAt,
      status: "generating",
      progress: 40,
      candidate_refs: [],
      last_event_id: null,
    })
    localStorage.setItem("mori-generation-queue-v1", JSON.stringify({
      version: 1,
      active_generation_ref: "generation_other_tab",
      items: [
        item("generation_other_tab", "2026-09-04T12:01:00.000Z"),
        item("generation_route_selected", "2026-09-04T12:00:00.000Z"),
      ],
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async (generationRef) => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_route_queue",
        song_plan_ref: null,
        mode: "custom",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "generating",
        progress: 40,
        candidate_refs: [],
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: `request_${generationRef}` },
    }))

    render(<MoriAppProvider><MoriWorkspace projectRef="project_route_queue" generationRef="generation_route_selected" api={createWorkspaceApi({ getGeneration })} /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith("generation_route_selected"))
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    expect(screen.getByRole("button", { name: /generation_route_selected.*Generating/u })).toHaveAttribute("aria-current", "true")
  })

  it("restores the user's active task before another newer task when the route has no generation", async () => {
    const item = (generationRef: string, createdAt: string) => ({
      generation_ref: generationRef,
      project_ref: "project_active_queue",
      source_version_ref: null,
      kind: "create",
      label: generationRef,
      created_at: createdAt,
      status: "generating",
      progress: 40,
      candidate_refs: [],
      last_event_id: null,
    })
    localStorage.setItem("mori-generation-queue-v1", JSON.stringify({
      version: 1,
      active_generation_ref: "generation_user_active",
      items: [
        item("generation_newer_background", "2026-09-04T12:02:00.000Z"),
        item("generation_user_active", "2026-09-04T12:01:00.000Z"),
      ],
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async (generationRef) => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_active_queue",
        song_plan_ref: null,
        mode: "custom",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "generating",
        progress: 40,
        candidate_refs: [],
        created_at: "2026-09-04T12:01:00.000Z",
      },
      meta: { request_id: `request_${generationRef}` },
    }))

    render(<MoriAppProvider><MoriWorkspace projectRef="project_active_queue" api={createWorkspaceApi({ getGeneration })} /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    expect(screen.getByRole("button", { name: /generation_user_active.*Generating/u })).toHaveAttribute("aria-current", "true")
  })

  it("does not substitute another active task when an explicit generation route is missing", async () => {
    const fallbackGenerationRef = "generation_wrong_fallback"
    writeGenerationQueueState(createGenerationQueueState({
      items: [{
        generation_ref: fallbackGenerationRef,
        project_ref: "project_strict_route",
        source_version_ref: null,
        kind: "create",
        label: "Another active direction",
        created_at: "2026-09-04T12:00:00.000Z",
        status: "generating",
        progress: 44,
        candidate_refs: [],
        last_event_id: null,
      }],
      active_generation_ref: fallbackGenerationRef,
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async (generationRef) => {
      if (generationRef === "generation_missing_route") {
        throw new MoriApiRequestError({
          code: "generation_not_found",
          message: "Generation not found",
          retryable: false,
          details: null,
        }, "request_generation_missing_route", 404)
      }
      return {
        data: {
          generation_ref: generationRef,
          generation_kind: "new_song",
          project_ref: "project_strict_route",
          song_plan_ref: null,
          mode: "custom",
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "generating",
          progress: 44,
          candidate_refs: [],
          created_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: `request_${generationRef}` },
      }
    })

    render(<MoriAppProvider><MoriWorkspace
      projectRef="project_strict_route"
      generationRef="generation_missing_route"
      api={createWorkspaceApi({ getGeneration })}
    /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith("generation_missing_route"))
    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(fallbackGenerationRef))
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "idle")
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    expect(screen.getByRole("button", { name: /Another active direction.*Generating/u })).not.toHaveAttribute("aria-current")
  })

  it("keeps multiple generation tasks selectable while polling background work", async () => {
    const queueItem = (generationRef: string, label: string, status: "generating" | "succeeded", progress: number) => ({
      generation_ref: generationRef,
      project_ref: "project_multi_queue",
      source_version_ref: null,
      kind: "create",
      label,
      created_at: status === "generating" ? "2026-09-04T12:02:00.000Z" : "2026-09-04T12:01:00.000Z",
      status,
      progress,
      candidate_refs: [],
      last_event_id: null,
    })
    localStorage.setItem("mori-generation-queue-v1", JSON.stringify({
      version: 1,
      active_generation_ref: "generation_multi_active",
      items: [
        queueItem("generation_multi_active", "Active direction", "generating", 30),
        queueItem("generation_multi_ready", "Ready direction", "succeeded", 100),
      ],
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async (generationRef) => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_multi_queue",
        song_plan_ref: null,
        mode: "custom",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: generationRef === "generation_multi_active" ? "generating" : "succeeded",
        progress: generationRef === "generation_multi_active" ? 30 : 100,
        candidate_refs: [],
        created_at: "2026-09-04T12:02:00.000Z",
      },
      meta: { request_id: `request_${generationRef}` },
    }))

    render(<MoriAppProvider><MoriWorkspace api={createWorkspaceApi({ getGeneration })} /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith("generation_multi_active"))
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    expect(screen.getByRole("heading", { name: "Recent runs" })).toBeInTheDocument()
    expect(screen.getByText("2 tasks")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Ready direction.*Ready.*100%/u }))
    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith("generation_multi_ready"))
  })

  it("starts background recovery when another tab adds an active task", async () => {
    const queueItem = (generationRef: string, createdAt: string) => ({
      generation_ref: generationRef,
      project_ref: "project_cross_tab_queue",
      source_version_ref: null,
      kind: "create" as const,
      label: generationRef,
      created_at: createdAt,
      status: "generating" as const,
      progress: 35,
      candidate_refs: [],
      last_event_id: null,
    })
    const foreground = queueItem("generation_foreground", "2026-09-04T12:00:00.000Z")
    const background = queueItem("generation_new_tab", "2026-09-04T12:01:00.000Z")
    writeGenerationQueueState(createGenerationQueueState({
      items: [foreground],
      active_generation_ref: foreground.generation_ref,
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async (generationRef) => ({
      data: {
        generation_ref: generationRef,
        generation_kind: "new_song",
        project_ref: "project_cross_tab_queue",
        song_plan_ref: null,
        mode: "custom",
        source_version_ref: null,
        operation: null,
        output_count: 2 as const,
        status: "generating",
        progress: 35,
        candidate_refs: [],
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: `request_${generationRef}` },
    }))

    render(<MoriAppProvider><MoriWorkspace projectRef="project_cross_tab_queue" api={createWorkspaceApi({ getGeneration })} /></MoriAppProvider>)
    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(foreground.generation_ref))

    writeGenerationQueueState(createGenerationQueueState({
      items: [background, foreground],
      active_generation_ref: foreground.generation_ref,
    }))

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(background.generation_ref))
  })

  it("keeps a background Studio Change task current while Create is open", async () => {
    const background = {
      generation_ref: "generation_background_studio",
      project_ref: "project_background_studio",
      source_version_ref: "version_background_studio",
      kind: "studio_change" as const,
      label: "Restyle section",
      created_at: "2026-09-04T12:02:00.000Z",
      status: "generating" as const,
      progress: 35,
      candidate_refs: [],
      last_event_id: null,
    }
    writeGenerationQueueState(createGenerationQueueState({
      items: [background],
      active_generation_ref: background.generation_ref,
    }))
    const getGeneration = vi.fn<MoriApi["getGeneration"]>(async () => ({
      data: {
        generation_ref: background.generation_ref,
        generation_kind: "studio_change" as const,
        project_ref: background.project_ref,
        song_plan_ref: null,
        mode: null,
        source_version_ref: background.source_version_ref,
        operation: "replace_section" as const,
        scope: { type: "time_range" as const, start_ms: 68_000, end_ms: 96_000 },
        instruction: "Continue the reviewed Studio change.",
        preserve: ["melody"],
        reference_asset_refs: [],
        output_count: 2 as const,
        status: "succeeded" as const,
        progress: 100,
        candidate_refs: ["candidate_background_studio"],
        created_at: background.created_at,
      },
      meta: { request_id: "request_background_studio" },
    }))

    render(<MoriAppProvider><MoriWorkspace projectRef={background.project_ref} api={createWorkspaceApi({ getGeneration })} /></MoriAppProvider>)

    await waitFor(() => expect(getGeneration).toHaveBeenCalledWith(background.generation_ref))
    await waitFor(() => expect(readGenerationQueueState().items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        generation_ref: background.generation_ref,
        status: "succeeded",
        progress: 100,
        candidate_refs: ["candidate_background_studio"],
      }),
    ])))
    localStorage.clear()
  })

  it("does not let stale event replay move the visible generation back from a terminal snapshot", async () => {
    const generationRef = "generation_terminal_snapshot"
    writeGenerationQueueState(createGenerationQueueState({
      items: [{
        generation_ref: generationRef,
        project_ref: "project_terminal_snapshot",
        source_version_ref: null,
        kind: "create",
        label: "Finished direction",
        created_at: "2026-09-04T12:00:00.000Z",
        status: "succeeded",
        progress: 100,
        candidate_refs: [],
        last_event_id: "event-terminal",
      }],
      active_generation_ref: generationRef,
    }))
    const getGenerationEvents = vi.fn<MoriApi["getGenerationEvents"]>(async () => [{
      id: "event-stale",
      event: "generation.progress",
      data: {
        generation_ref: generationRef,
        project_ref: "project_terminal_snapshot",
        status: "generating",
        progress: 76,
        candidate_refs: [],
      },
    }])

    render(<MoriAppProvider><MoriWorkspace
      projectRef="project_terminal_snapshot"
      generationRef={generationRef}
      api={createWorkspaceApi({
        getGeneration: async () => ({
          data: {
            generation_ref: generationRef,
            generation_kind: "new_song",
            project_ref: "project_terminal_snapshot",
            song_plan_ref: null,
            mode: "custom",
            source_version_ref: null,
            operation: null,
            output_count: 2 as const,
            status: "succeeded",
            progress: 100,
            candidate_refs: [],
            created_at: "2026-09-04T12:00:00.000Z",
          },
          meta: { request_id: "request_terminal_snapshot" },
        }),
        getGenerationEvents,
      })}
    /></MoriAppProvider>)

    await waitFor(() => expect(getGenerationEvents).toHaveBeenCalled())
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "ready")
  })

  it("creates a Project from the first idea before starting an unscoped generation", async () => {
    const originalUrl = window.location.href
    window.history.replaceState({}, "", "/create?idea=A+quiet+piano+song")
    const createProject = vi.fn<MoriApi["createProject"]>(async (input) => ({
      data: {
        project_ref: "project_quiet_train",
        title: input.title,
        description: input.description,
        current_version_ref: null,
        candidate_count: 0,
        last_activity_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_project_quiet_train" },
    }))
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async () => ({
      data: { generation_ref: "generation_quiet_train", status: "queued" as const },
      meta: { request_id: "request_generation_quiet_train" },
    }))
    const api: Pick<MoriApi, "createProject" | "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration"> = {
      createProject,
      createSongPlan: async (projectRef, input) => ({
        data: { ...input, song_plan_ref: "song_plan_quiet_train", project_ref: projectRef, created_at: "2026-09-04T12:00:00.000Z" },
        meta: { request_id: "request_plan_quiet_train" },
      }),
      createGeneration,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_quiet_train",
          generation_kind: "new_song" as const,
          project_ref: "project_quiet_train",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_generation_quiet_train_status" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_quiet_train_candidates" } }),
      cancelGeneration: async () => ({ data: { generation_ref: "generation_quiet_train", status: "cancelled" as const }, meta: { request_id: "request_quiet_train_cancel" } }),
    }

    render(
      <MoriAppProvider>
        <MoriWorkspace api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.change(screen.getByRole("textbox", { name: "Song idea" }), { target: { value: "A quiet piano song for the first train home." } })
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(createProject).toHaveBeenCalledOnce())
    expect(createProject).toHaveBeenCalledWith(
      {
        title: "Quiet piano song for the first train home",
        description: "A quiet piano song for the first train home.",
      },
      expect.stringMatching(/^mori-project-/u),
    )
    await waitFor(() => expect(createGeneration).toHaveBeenCalledOnce())
    expect(createGeneration).toHaveBeenCalledWith("project_quiet_train", expect.anything(), expect.stringMatching(/^mori-create-/u))
    const activeTrigger = screen.getByRole("button", { name: "Hide generation queue", hidden: true })
    expect(activeTrigger).toHaveAttribute("data-generation-feedback", "active")
    expect(activeTrigger).toHaveTextContent("Generating")
    expect(activeTrigger.querySelector('[data-generation-icon="active"]')).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close generation queue" }))
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "active")
    expect(screen.getByRole("link", { name: "Quiet piano song for the first train home" })).toHaveAttribute("href", "/projects/project_quiet_train")
    expect(window.location.pathname + window.location.search).toBe("/create?project_ref=project_quiet_train&generation_ref=generation_quiet_train")
    await waitFor(() => expect(screen.getByRole("link", { name: "New creation" })).toHaveAttribute("href", "/create?project_ref=project_quiet_train"))
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings?return_to=%2Fcreate%3Fproject_ref%3Dproject_quiet_train%26generation_ref%3Dgeneration_quiet_train")
    window.history.replaceState({}, "", originalUrl)
  })

  it("reuses the automatically created Project when a generation is retried", async () => {
    const createProject = vi.fn<MoriApi["createProject"]>(async () => ({
      data: {
        project_ref: "project_retry_home",
        title: "Glasshouse",
        description: "Glasshouse",
        current_version_ref: null,
        candidate_count: 0,
        last_activity_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_project_retry_home" },
    }))
    const generationIdempotencyKeys: string[] = []
    const generationInputs: GenerationCreateInput[] = []
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async (_projectRef, input, idempotencyKey) => {
      generationIdempotencyKeys.push(idempotencyKey)
      generationInputs.push({ ...input, reference_asset_refs: [...input.reference_asset_refs] })
      throw new Error("provider unavailable")
    })
    const api: Pick<MoriApi, "createProject" | "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration"> = {
      createProject,
      createSongPlan: async (projectRef, input) => ({
        data: { ...input, song_plan_ref: "song_plan_retry_home", project_ref: projectRef, created_at: "2026-09-04T12:00:00.000Z" },
        meta: { request_id: "request_plan_retry_home" },
      }),
      createGeneration,
      getGeneration: async () => { throw new Error("not reached") },
      getGenerationEvents: async () => [],
      listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_retry_home_candidates" } }),
      cancelGeneration: async () => ({ data: { generation_ref: "generation_retry_home", status: "cancelled" as const }, meta: { request_id: "request_retry_home_cancel" } }),
    }

    render(<MoriAppProvider><MoriWorkspace api={api} /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.change(screen.getByRole("textbox", { name: "Song idea" }), { target: { value: "Glasshouse" } })
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Hide generation queue", hidden: true }))
    const failedTrigger = screen.getByRole("button", { name: "Open generation queue" })
    expect(failedTrigger).toHaveAttribute("data-generation-feedback", "attention")
    expect(failedTrigger).toHaveTextContent("Needs attention")
    expect(failedTrigger.querySelector('[data-generation-icon="attention"]')).toBeInTheDocument()
    fireEvent.click(failedTrigger)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(2))
    expect(createProject).toHaveBeenCalledOnce()
    expect(createGeneration.mock.calls.every(([projectRef]) => projectRef === "project_retry_home")).toBe(true)
    expect(generationIdempotencyKeys[0]).toBe(generationIdempotencyKeys[1])
    expect(generationInputs[1]).toEqual(generationInputs[0])
  })

  it("keeps a stale accepted receipt in the queue without stealing a newer active task", async () => {
    let resolveFirst: (value: Awaited<ReturnType<MoriApi["createGeneration"]>>) => void = () => undefined
    const firstResponse = new Promise<Awaited<ReturnType<MoriApi["createGeneration"]>>>((resolve) => { resolveFirst = resolve })
    const generationPrompts: string[] = []
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async (_projectRef, input) => {
      generationPrompts.push(input.prompt)
      if (generationPrompts.length === 1) return firstResponse
      return { data: { generation_ref: "generation_second_receipt", status: "queued" }, meta: { request_id: "request_second_receipt" } }
    })
    const api = createWorkspaceApi({
      createGeneration,
      getGeneration: async (generationRef) => ({
        data: {
          generation_ref: generationRef,
          generation_kind: "new_song" as const,
          project_ref: "project_stale_receipt",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-05T14:25:00.000Z",
        },
        meta: { request_id: `request_${generationRef}` },
      }),
    })

    render(<MoriAppProvider><MoriWorkspace projectRef="project_stale_receipt" api={api} /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    const idea = screen.getByRole("textbox", { name: "Song idea" })
    fireEvent.change(idea, { target: { value: "First direction" } })
    fireEvent.submit(idea.closest("form") as HTMLFormElement)
    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(1))

    fireEvent.change(idea, { target: { value: "Second direction" } })
    fireEvent.submit(idea.closest("form") as HTMLFormElement)
    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(readGenerationQueueState().active_generation_ref).toBe("generation_second_receipt"))

    resolveFirst({ data: { generation_ref: "generation_first_receipt", status: "queued" }, meta: { request_id: "request_first_receipt" } })
    await waitFor(() => expect(readGenerationQueueState().items.map((item) => item.generation_ref)).toEqual(expect.arrayContaining([
      "generation_second_receipt",
      "generation_first_receipt",
    ])))
    expect(readGenerationQueueState().items).toHaveLength(2)
    expect(readGenerationQueueState().active_generation_ref).toBe("generation_second_receipt")
    localStorage.clear()
  })

  it("keeps a stale accepted command recoverable when its queue receipt cannot be persisted", async () => {
    localStorage.clear()
    let resolveFirst: (value: Awaited<ReturnType<MoriApi["createGeneration"]>>) => void = () => undefined
    const firstResponse = new Promise<Awaited<ReturnType<MoriApi["createGeneration"]>>>((resolve) => { resolveFirst = resolve })
    const generationKeys: string[] = []
    let generationAttempt = 0
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async (_projectRef, _input, idempotencyKey) => {
      generationKeys.push(idempotencyKey)
      generationAttempt += 1
      if (generationAttempt === 1) return firstResponse
      return {
        data: { generation_ref: generationAttempt === 2 ? "generation_storage_newer" : "generation_storage_stale", status: "queued" },
        meta: { request_id: `request_storage_${generationAttempt}` },
      }
    })
    const api = createWorkspaceApi({
      createGeneration,
      getGeneration: async (generationRef) => ({
        data: {
          generation_ref: generationRef,
          generation_kind: "new_song" as const,
          project_ref: "project_stale_storage",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: generationRef === "generation_storage_stale" ? "failed" as const : "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-05T14:35:00.000Z",
        },
        meta: { request_id: `request_status_${generationRef}` },
      }),
    })
    const originalSetItem = Storage.prototype.setItem
    let failQueuePersistence = false
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (failQueuePersistence && key === generationQueueStorageKey) throw new Error("storage is full")
      originalSetItem.call(this, key, value)
    })

    try {
      render(<MoriAppProvider><MoriWorkspace projectRef="project_stale_storage" api={api} /></MoriAppProvider>)
      fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
      const idea = screen.getByRole("textbox", { name: "Song idea" })
      fireEvent.change(idea, { target: { value: "First storage direction" } })
      fireEvent.submit(idea.closest("form") as HTMLFormElement)
      await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(1))

      fireEvent.change(idea, { target: { value: "Second storage direction" } })
      fireEvent.submit(idea.closest("form") as HTMLFormElement)
      await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(readGenerationQueueState().active_generation_ref).toBe("generation_storage_newer"))

      failQueuePersistence = true
      resolveFirst({ data: { generation_ref: "generation_storage_stale", status: "queued" }, meta: { request_id: "request_storage_stale" } })
      await waitFor(() => expect(screen.getByText("2 tasks")).toBeInTheDocument())
      expect(readGenerationQueueState().active_generation_ref).toBe("generation_storage_newer")
      failQueuePersistence = false

      const allTasks = screen.getAllByRole("button", { name: /Custom direction/u })
      expect(allTasks).toHaveLength(2)
      const staleTask = allTasks.find((task) => task.getAttribute("aria-current") !== "true")
      expect(staleTask).toBeDefined()
      fireEvent.click(staleTask as HTMLElement)
      await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument())
      fireEvent.click(screen.getByRole("button", { name: "Try again" }))
      await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(3))
      expect(generationKeys[2]).toBe(generationKeys[0])
    } finally {
      failQueuePersistence = false
      setItem.mockRestore()
      localStorage.clear()
    }
  })

  it("keeps the accepted generation key when the browser cannot persist its queue receipt", async () => {
    localStorage.clear()
    const generationIdempotencyKeys: string[] = []
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async (_projectRef, _input, idempotencyKey) => {
      generationIdempotencyKeys.push(idempotencyKey)
      return { data: { generation_ref: "generation_queue_storage_retry", status: "queued" }, meta: { request_id: "request_queue_storage_retry" } }
    })
    const api = createWorkspaceApi({
      createGeneration,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_queue_storage_retry",
          generation_kind: "new_song" as const,
          project_ref: "project_queue_storage_retry",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-05T14:30:00.000Z",
        },
        meta: { request_id: "request_queue_storage_retry_status" },
      }),
    })
    const originalSetItem = Storage.prototype.setItem
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === generationQueueStorageKey) throw new Error("storage is full")
      originalSetItem.call(this, key, value)
    })

    try {
      render(<MoriAppProvider><MoriWorkspace projectRef="project_queue_storage_retry" api={api} /></MoriAppProvider>)
      fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
      fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

      const queueSyncAlert = await screen.findByText("Queue sync needs attention")
      expect(queueSyncAlert).toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    } finally {
      setItem.mockRestore()
    }

    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(2))
    expect(generationIdempotencyKeys[0]).toBe(generationIdempotencyKeys[1])
    localStorage.clear()
  })

  it("keeps generation commands inside the requested project", async () => {
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async (projectRef) => ({
      data: { generation_ref: "generation_project_context", status: "queued" as const },
      meta: { request_id: `request_${projectRef}` },
    }))
    const api: Pick<MoriApi, "getProject" | "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration"> = {
      getProject: async () => ({
        data: {
          project_ref: "project_live_1",
          title: "Window Seat",
          description: "A quiet, forward-moving sketch.",
          current_version_ref: null,
          candidate_count: 0,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_context" },
      }),
      createSongPlan: async (projectRef, input) => ({
        data: { ...input, song_plan_ref: "song_plan_project_context", project_ref: projectRef, created_at: "2026-09-02T12:00:00.000Z" },
        meta: { request_id: "request_project_context_plan" },
      }),
      createGeneration,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_project_context",
          generation_kind: "new_song" as const,
          project_ref: "project_live_1",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_context_status" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_project_context_candidates" } }),
      cancelGeneration: async () => ({ data: { generation_ref: "generation_project_context", status: "cancelled" as const }, meta: { request_id: "request_project_context_cancel" } }),
    }

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef="project_live_1" api={api} />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("link", { name: "Window Seat" })).toHaveAttribute("href", "/projects/project_live_1"))
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(createGeneration).toHaveBeenCalledOnce())
    expect(createGeneration).toHaveBeenCalledWith("project_live_1", expect.anything(), expect.stringMatching(/^mori-create-/u))
  })

  it("reveals Custom controls without leaving Create", () => {
    renderWorkspace()
    const outputType = screen.getByRole("group", { name: "Output type" })
    expect(within(outputType).getByRole("button", { name: "Song with lyrics" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    expect(screen.getByLabelText(/style/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/duration/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^lyrics$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/vocal direction/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add audio reference" })).toBeInTheDocument()
    expect(screen.getByText(/Your controls go straight to the generation queue/u)).toBeInTheDocument()
    expect(screen.queryByText(/Song Plan will map the mood/u)).not.toBeInTheDocument()
  })

  it("prevents duplicate Custom submissions while queueing", async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    const onGenerate = vi.fn<(draft: CreationDraft) => Promise<void>>(() => gate)

    render(
      <MoriAppProvider>
        <CreateCanvas
          projectRef="project_duplicate_submission"
          mode="custom"
          onModeChange={() => undefined}
          onGenerate={onGenerate}
        />
      </MoriAppProvider>,
    )

    const form = screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(onGenerate).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "Queueing…" })).toBeDisabled()
    release()
    await waitFor(() => expect(screen.getByRole("button", { name: "Generate" })).toBeEnabled())
  })

  it("puts required Custom controls before optional creative sources", () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))

    const style = screen.getByLabelText("Style")
    const sources = screen.getByRole("region", { name: "Creative sources" })
    expect(style.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("keeps audio, voice, and inspiration as optional contextual sources", () => {
    renderWorkspace()

    const sources = screen.getByRole("region", { name: "Creative sources" })
    expect(within(sources).getByRole("button", { name: "Add audio reference" })).toBeInTheDocument()
    expect(within(sources).getByRole("button", { name: "Record audio reference" })).toBeInTheDocument()
    expect(within(sources).getByRole("button", { name: "Choose voice profile" })).toBeInTheDocument()
    expect(within(sources).getByRole("button", { name: "Choose inspiration" })).toBeInTheDocument()
    expect(within(sources).getByText("Audio reference")).toBeInTheDocument()
    expect(within(sources).getByText("Voice profile")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Voice profiles" })).not.toBeInTheDocument()

    fireEvent.click(within(sources).getByRole("button", { name: "Choose voice profile" }))
    const voices = screen.getByRole("region", { name: "Voice profiles" })
    fireEvent.click(within(voices).getByRole("button", { name: "Use Mira voice" }))
    expect(within(sources).getByRole("button", { name: "Change voice profile Mira" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Voice profiles" })).not.toBeInTheDocument()

    fireEvent.click(within(sources).getByRole("button", { name: "Choose inspiration" }))
    const inspirations = screen.getByRole("region", { name: "Inspiration presets" })
    fireEvent.click(within(inspirations).getByRole("button", { name: "Use Open Road inspiration" }))
    expect(within(sources).getByRole("button", { name: "Change inspiration Open Road" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.change(screen.getByLabelText("Style"), { target: { value: "Hand-built chamber pop" } })
    expect(within(sources).getByRole("button", { name: "Choose inspiration" })).toBeInTheDocument()
  })

  it("supports keyboard navigation between creation modes", () => {
    renderWorkspace()

    const smart = screen.getByRole("tab", { name: /smart/i })
    const custom = screen.getByRole("tab", { name: /custom/i })
    smart.focus()
    fireEvent.keyDown(smart, { key: "ArrowRight" })
    expect(custom).toHaveAttribute("aria-selected", "true")
    expect(custom).toHaveFocus()

    fireEvent.keyDown(custom, { key: "Home" })
    expect(smart).toHaveAttribute("aria-selected", "true")
    expect(smart).toHaveFocus()
  })

  it("reviews a Smart song plan before sending a generation command", async () => {
    const createSongPlan = vi.fn(async (_projectRef: string, input: Parameters<MoriApi["createSongPlan"]>[1], idempotencyKey: string) => ({
      data: {
        ...input,
        song_plan_ref: `song_plan_${idempotencyKey}`,
        project_ref: "project_preview_first_light",
        created_at: "2026-09-02T12:00:00.000Z",
      },
      meta: { request_id: "request_plan_create" },
    }))
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async () => ({
      data: { generation_ref: "generation_plan_review", status: "queued" as const },
      meta: { request_id: "request_plan_review" },
    }))
    const api = {
      createSongPlan,
      createGeneration,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_plan_review",
          generation_kind: "new_song" as const,
          project_ref: "project_preview_first_light",
          song_plan_ref: "song_plan_preview_first_light",
          mode: "smart" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_plan_status" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_plan_candidates" } }),
      cancelGeneration: async () => ({ data: { generation_ref: "generation_plan_review", status: "cancelled" as const }, meta: { request_id: "request_plan_cancel" } }),
    }

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef={previewProject.projectRef} api={api} />
      </MoriAppProvider>,
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Song idea" }), { target: { value: "A quiet piano song for the first train home." } })
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    const planPreview = screen.getByRole("region", { name: "Song plan preview" })
    expect(planPreview).toBeInTheDocument()
    await waitFor(() => expect(planPreview).toHaveFocus())
    expect(within(planPreview).getByText("A quiet piano song for the first train home.")).toBeInTheDocument()
    expect(createGeneration).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Create from this plan" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Song idea" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Creative sources" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Song Plan will map the mood/u)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Back to idea" }))
    expect(screen.getByRole("textbox", { name: "Song idea" })).toHaveValue("A quiet piano song for the first train home.")
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Song idea" })).toHaveFocus())
    expect(screen.queryByRole("region", { name: "Song plan preview" })).not.toBeInTheDocument()

    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Plan mood" }), { target: { value: "Quiet folk" } })
    fireEvent.change(screen.getByRole("spinbutton", { name: "Plan tempo" }), { target: { value: "84" } })
    fireEvent.change(screen.getByRole("textbox", { name: "Vocal direction" }), { target: { value: "Natural lead, close and unhurried" } })
    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))
    await waitFor(() => expect(createSongPlan).toHaveBeenCalledOnce())
    await waitFor(() => expect(createGeneration).toHaveBeenCalledOnce())
    expect(createSongPlan).toHaveBeenCalledWith(
      "project_preview_first_light",
      expect.objectContaining({
        mood: "Quiet folk",
        tempo_bpm: 84,
        vocal_direction: "Natural lead, close and unhurried",
      }),
      expect.stringMatching(/^mori-plan-/u),
    )
    expect(createGeneration.mock.calls[0]?.[1].song_plan_ref).toMatch(/^song_plan_mori-plan-/u)
  })

  it("persists a reviewed Smart plan through Project Workspace before starting generation", async () => {
    const order: string[] = []
    const createSongPlan = vi.fn<MoriApi["createSongPlan"]>(async () => {
      throw new Error("preview Song Plan endpoint must not be used for a live workspace")
    })
    const getProjectWorkspace = vi.fn<MoriApi["getProjectWorkspace"]>(async () => ({
      data: workspaceProjectionForPlan("project_live_plan"),
      meta: { request_id: "request_live_plan_workspace" },
    }))
    const putCurrentSongPlan = vi.fn<MoriApi["putCurrentSongPlan"]>(async (_projectRef, input, idempotencyKey) => {
      order.push("song_plan")
      return {
        data: workspaceProjectionForPlan("project_live_plan", {
          song_plan_ref: "song_plan_live_revision_1",
          project_ref: "project_live_plan",
          revision: 1,
          prompt: input.prompt,
          mood: input.mood,
          tempo_bpm: input.tempo_bpm,
          structure: input.structure,
          instruments: input.instruments,
          vocal_direction: input.vocal_direction,
          lyrics_intent: input.lyrics_intent,
          created_at: "2026-09-05T14:00:00.000Z",
        }),
        meta: { request_id: `request_live_plan_save_${idempotencyKey}` },
      }
    })
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async (_projectRef, input) => {
      order.push("generation")
      expect(input.song_plan_ref).toBe("song_plan_live_revision_1")
      return { data: { generation_ref: "generation_live_plan", status: "queued" }, meta: { request_id: "request_live_plan_generation" } }
    })
    const api = {
      ...createWorkspaceApi({ createSongPlan, createGeneration }),
      getProjectWorkspace,
      putCurrentSongPlan,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_live_plan",
          generation_kind: "new_song" as const,
          project_ref: "project_live_plan",
          song_plan_ref: "song_plan_live_revision_1",
          mode: "smart" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-05T14:00:00.000Z",
        },
        meta: { request_id: "request_live_plan_status" },
      }),
    }

    render(<MoriAppProvider><MoriWorkspace projectRef="project_live_plan" api={api} /></MoriAppProvider>)
    fireEvent.change(screen.getByRole("textbox", { name: "Song idea" }), { target: { value: "A quiet piano song for the first train home." } })
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Plan mood" }), { target: { value: "Quiet folk" } })
    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))

    await waitFor(() => expect(createGeneration).toHaveBeenCalledOnce())
    expect(getProjectWorkspace).toHaveBeenCalledWith("project_live_plan")
    expect(putCurrentSongPlan).toHaveBeenCalledWith(
      "project_live_plan",
      expect.objectContaining({ mood: "Quiet folk", expected_revision: null }),
      expect.stringMatching(/^mori-workspace-plan-/u),
    )
    expect(createSongPlan).not.toHaveBeenCalled()
    expect(order).toEqual(["song_plan", "generation"])
    expect(screen.getByText("Saved to project")).toBeInTheDocument()
  })

  it("keeps the reviewed plan and reuses its workspace command identity after a transient save failure", async () => {
    const idempotencyKeys: string[] = []
    let saveAttempt = 0
    const putCurrentSongPlan = vi.fn<MoriApi["putCurrentSongPlan"]>(async (_projectRef, input, idempotencyKey) => {
      idempotencyKeys.push(idempotencyKey)
      saveAttempt += 1
      if (saveAttempt === 1) throw new TypeError("Failed to fetch")
      return {
        data: workspaceProjectionForPlan("project_live_plan_retry", {
          song_plan_ref: "song_plan_live_retry_1",
          project_ref: "project_live_plan_retry",
          revision: 1,
          prompt: input.prompt,
          mood: input.mood,
          tempo_bpm: input.tempo_bpm,
          structure: input.structure,
          instruments: input.instruments,
          vocal_direction: input.vocal_direction,
          lyrics_intent: input.lyrics_intent,
          created_at: "2026-09-05T14:05:00.000Z",
        }),
        meta: { request_id: "request_live_plan_retry_save" },
      }
    })
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async () => ({
      data: { generation_ref: "generation_live_plan_retry", status: "queued" },
      meta: { request_id: "request_live_plan_retry_generation" },
    }))
    const api = {
      ...createWorkspaceApi({ createGeneration }),
      getProjectWorkspace: async () => ({ data: workspaceProjectionForPlan("project_live_plan_retry"), meta: { request_id: "request_live_plan_retry_workspace" } }),
      putCurrentSongPlan,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_live_plan_retry",
          generation_kind: "new_song" as const,
          project_ref: "project_live_plan_retry",
          song_plan_ref: "song_plan_live_retry_1",
          mode: "smart" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-05T14:05:00.000Z",
        },
        meta: { request_id: "request_live_plan_retry_status" },
      }),
    }

    render(<MoriAppProvider><MoriWorkspace projectRef="project_live_plan_retry" api={api} /></MoriAppProvider>)
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Mori could not confirm this save. Retry when ready.")
    expect(within(alert).getByRole("button", { name: "Retry save" })).toBeInTheDocument()
    expect(createGeneration).not.toHaveBeenCalled()

    fireEvent.click(within(alert).getByRole("button", { name: "Retry save" }))
    await waitFor(() => expect(createGeneration).toHaveBeenCalledOnce())
    expect(idempotencyKeys).toHaveLength(2)
    expect(idempotencyKeys[0]).toBe(idempotencyKeys[1])
  })

  it("keeps generation idle while a Project plan is blocked, then reloads the remote plan on refresh", async () => {
    let workspaceRead = 0
    const getProjectWorkspace = vi.fn<MoriApi["getProjectWorkspace"]>(async () => {
      workspaceRead += 1
      return {
        data: workspaceRead === 1
          ? workspaceProjectionForPlan("project_live_plan_conflict")
          : workspaceProjectionForPlan("project_live_plan_conflict", {
            song_plan_ref: "song_plan_remote_revision_2",
            project_ref: "project_live_plan_conflict",
            revision: 2,
            prompt: "A different remote direction.",
            mood: "Remote · steady",
            tempo_bpm: 96,
            structure: ["Intro", "Verse", "Chorus", "Outro"],
            instruments: ["Piano", "Cello"],
            vocal_direction: "Close and restrained",
            lyrics_intent: "A clear landing after the storm",
            created_at: "2026-09-05T14:10:00.000Z",
          }),
        meta: { request_id: `request_plan_conflict_workspace_${workspaceRead}` },
      }
    })
    const putCurrentSongPlan = vi.fn<MoriApi["putCurrentSongPlan"]>(async () => {
      throw new MoriApiRequestError({ code: "song_plan_conflict", message: "The Project changed", retryable: false, details: null }, "request_plan_conflict", 409)
    })
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async () => ({
      data: { generation_ref: "generation_should_not_start", status: "queued" },
      meta: { request_id: "request_generation_should_not_start" },
    }))
    const api = {
      ...createWorkspaceApi({ createGeneration }),
      getProjectWorkspace,
      putCurrentSongPlan,
    }

    render(<MoriAppProvider><MoriWorkspace projectRef="project_live_plan_conflict" api={api} /></MoriAppProvider>)
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("This project changed elsewhere. Refresh before saving again.")
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "idle")
    expect(createGeneration).not.toHaveBeenCalled()

    fireEvent.click(within(alert).getByRole("button", { name: "Refresh workspace" }))
    await waitFor(() => expect(getProjectWorkspace).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Remote · steady")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("does not write a second Song Plan when generation retries after a confirmed save", async () => {
    const putCurrentSongPlan = vi.fn<MoriApi["putCurrentSongPlan"]>(async (_projectRef, input) => ({
      data: workspaceProjectionForPlan("project_live_generation_retry", {
        song_plan_ref: "song_plan_live_generation_retry",
        project_ref: "project_live_generation_retry",
        revision: 1,
        prompt: input.prompt,
        mood: input.mood,
        tempo_bpm: input.tempo_bpm,
        structure: input.structure,
        instruments: input.instruments,
        vocal_direction: input.vocal_direction,
        lyrics_intent: input.lyrics_intent,
        created_at: "2026-09-05T14:15:00.000Z",
      }),
      meta: { request_id: "request_generation_retry_plan" },
    }))
    let generationAttempt = 0
    const generationIdempotencyKeys: string[] = []
    const generationInputs: GenerationCreateInput[] = []
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async (_projectRef, input, idempotencyKey) => {
      generationIdempotencyKeys.push(idempotencyKey)
      generationInputs.push({ ...input, reference_asset_refs: [...input.reference_asset_refs] })
      generationAttempt += 1
      if (generationAttempt === 1) throw new Error("provider unavailable")
      return { data: { generation_ref: "generation_retry_after_plan", status: "queued" }, meta: { request_id: `request_generation_retry_${generationAttempt}` } }
    })
    const api = {
      ...createWorkspaceApi({ createGeneration }),
      getProjectWorkspace: async () => ({ data: workspaceProjectionForPlan("project_live_generation_retry"), meta: { request_id: "request_generation_retry_workspace" } }),
      putCurrentSongPlan,
    }

    render(<MoriAppProvider><MoriWorkspace projectRef="project_live_generation_retry" api={api} /></MoriAppProvider>)
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))

    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(2))
    expect(putCurrentSongPlan).toHaveBeenCalledOnce()
    expect(generationIdempotencyKeys[0]).toBe(generationIdempotencyKeys[1])
    expect(generationInputs[1]).toEqual(generationInputs[0])
  })

  it("uses a new generation command identity after a definitive request failure", async () => {
    const generationIdempotencyKeys: string[] = []
    let generationAttempt = 0
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async (_projectRef, _input, idempotencyKey) => {
      generationIdempotencyKeys.push(idempotencyKey)
      generationAttempt += 1
      if (generationAttempt === 1) {
        throw new MoriApiRequestError({ code: "generation_rejected", message: "The request is not valid", retryable: false, details: null }, "request_generation_rejected", 422)
      }
      return { data: { generation_ref: "generation_after_definitive_failure", status: "queued" }, meta: { request_id: "request_generation_after_definitive_failure" } }
    })
    const api = createWorkspaceApi({
      createGeneration,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_after_definitive_failure",
          generation_kind: "new_song" as const,
          project_ref: "project_definitive_failure",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-05T14:20:00.000Z",
        },
        meta: { request_id: "request_generation_after_definitive_failure_status" },
      }),
    })

    render(<MoriAppProvider><MoriWorkspace projectRef="project_definitive_failure" api={api} /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(2))
    expect(generationIdempotencyKeys[0]).not.toBe(generationIdempotencyKeys[1])
  })

  it("does not fall back to the legacy Song Plan endpoint for a live Project", async () => {
    const createSongPlan = vi.fn<MoriApi["createSongPlan"]>(async () => {
      throw new Error("legacy endpoint must not be used")
    })
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async () => ({
      data: { generation_ref: "generation_without_workspace", status: "queued" },
      meta: { request_id: "request_generation_without_workspace" },
    }))
    const api = createWorkspaceApi({ createSongPlan, createGeneration })

    render(<MoriAppProvider><MoriWorkspace projectRef="project_live_without_workspace" api={api} /></MoriAppProvider>)
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Project workspace saving is not connected.")
    expect(createSongPlan).not.toHaveBeenCalled()
    expect(createGeneration).not.toHaveBeenCalled()
  })

  it("validates a reviewed Song Plan before sending a creation command", () => {
    const onGenerate = vi.fn<(draft: CreationDraft) => void>()
    render(<MoriAppProvider><CreateCanvas projectRef="project_preview_first_light" mode="smart" onModeChange={() => undefined} onGenerate={onGenerate} /></MoriAppProvider>)
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Plan mood" }), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))

    expect(screen.getByRole("alert")).toHaveTextContent("Add a mood so Mori can shape the direction.")
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it("opens Create with the defaults chosen in Mori settings", () => {
    function DefaultWorkspaceHarness() {
      const { updatePreferences } = useMoriApp()
      const [open, setOpen] = useState(false)

      return (
        <>
          <button type="button" onClick={() => {
            updatePreferences({ defaultMode: "custom", lyricsMode: "instrumental", durationSeconds: 240 })
            setOpen(true)
          }}>Open customized Create</button>
          {open ? <MoriWorkspace /> : null}
        </>
      )
    }

    render(
      <MoriAppProvider>
        <DefaultWorkspaceHarness />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Open customized Create" }))

    expect(screen.getByRole("tab", { name: /custom/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("button", { name: "Instrumental" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByLabelText("Duration")).toHaveValue("240")
  })

  it("hydrates persisted creation defaults before the canvas is used", async () => {
    window.localStorage.setItem("mori.preferences.v1", JSON.stringify({
      reduceMotion: false,
      autoplay: false,
      endBehavior: "stop",
      defaultMode: "custom",
      lyricsMode: "instrumental",
      durationSeconds: 240,
    }))

    try {
      renderWorkspace()

      await waitFor(() => expect(screen.getByRole("tab", { name: /custom/i })).toHaveAttribute("aria-selected", "true"))
      expect(screen.getByRole("button", { name: "Instrumental" })).toHaveAttribute("aria-pressed", "true")
      expect(screen.getByLabelText("Duration")).toHaveValue("240")
    } finally {
      window.localStorage.removeItem("mori.preferences.v1")
    }
  })

  it("keeps output type explicit and hides vocal-only controls for instrumental work", () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole("button", { name: "Choose voice profile" }))
    fireEvent.click(screen.getByRole("button", { name: "Use Mira voice" }))
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.click(screen.getByRole("button", { name: "Instrumental" }))

    expect(screen.getByRole("button", { name: "Instrumental" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("button", { name: /voice profile/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^lyrics$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/vocal direction/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText("Style")).toBeInTheDocument()
    expect(screen.getByLabelText("Duration")).toBeInTheDocument()
    expect(screen.getByText(/Your controls go straight to the generation queue/u)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Song with lyrics" }))
    expect(screen.getByRole("button", { name: "Change voice profile Mira" })).toBeInTheDocument()
    expect(screen.getByLabelText(/^lyrics$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/vocal direction/i)).toBeInTheDocument()
  })

  it("does not send a stale Voice or Lyrics with an instrumental direction", () => {
    const onGenerate = vi.fn<(draft: CreationDraft) => void>()

    render(
      <MoriAppProvider>
        <CreateCanvas projectRef="project_preview_first_light" mode="custom" onModeChange={() => undefined} onGenerate={onGenerate} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Choose voice profile" }))
    fireEvent.click(screen.getByRole("button", { name: "Use Mira voice" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Lyrics" }), { target: { value: "Keep this draft for later." } })
    fireEvent.click(screen.getByRole("button", { name: "Instrumental" }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    expect(onGenerate).toHaveBeenCalledOnce()
    expect(onGenerate.mock.calls[0]?.[0]).toMatchObject({ lyricsMode: "instrumental" })
    expect(onGenerate.mock.calls[0]?.[0]).not.toHaveProperty("voiceRef")
    expect(onGenerate.mock.calls[0]?.[0]).not.toHaveProperty("lyrics")
  })

  it("reviews an instrumental Song Plan with arrangement language", () => {
    render(
      <MoriAppProvider>
        <CreateCanvas projectRef="project_preview_first_light" mode="smart" onModeChange={() => undefined} onGenerate={() => undefined} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Instrumental" }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    fireEvent.click(screen.getByRole("button", { name: "Edit plan" }))

    expect(screen.getByRole("textbox", { name: "Arrangement direction" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Creative intent" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Vocal direction" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Lyrics intent" })).not.toBeInTheDocument()
  })

  it("keeps stable asset refs separate from human-readable creative direction", () => {
    const onGenerate = vi.fn<(draft: CreationDraft) => void>()

    render(
      <MoriAppProvider>
        <CreateCanvas projectRef="project_preview_first_light" mode="custom" onModeChange={() => undefined} onGenerate={onGenerate} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Choose voice profile" }))
    fireEvent.click(screen.getByRole("button", { name: "Use Mira voice" }))
    fireEvent.click(screen.getByRole("button", { name: "Choose inspiration" }))
    fireEvent.click(screen.getByRole("button", { name: "Use Open Road inspiration" }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    expect(onGenerate).toHaveBeenCalledOnce()
    expect(onGenerate.mock.calls[0]?.[0]).toMatchObject({
      voice: "Natural lead",
      voiceRef: "voice_preview_mira",
      style: "Cinematic folk · open horizon · strings",
    })
  })

  it("hydrates a reusable voice selected from Library into a vocal output", async () => {
    window.localStorage.setItem("mori.preferences.v1", JSON.stringify({
      reduceMotion: false,
      autoplay: false,
      endBehavior: "stop",
      defaultMode: "smart",
      lyricsMode: "instrumental",
      durationSeconds: 180,
    }))

    try {
      render(
        <MoriAppProvider>
          <CreateCanvas
            projectRef="project_preview_first_light"
            mode="smart"
            initialCreativeSource={{ kind: "voice", ref: "voice_preview_mira" }}
            onModeChange={() => undefined}
            onGenerate={() => undefined}
          />
        </MoriAppProvider>,
      )

      await waitFor(() => expect(screen.getByRole("button", { name: "Song with lyrics" })).toHaveAttribute("aria-pressed", "true"))
      expect(screen.getByRole("button", { name: "Change voice profile Mira" })).toBeInTheDocument()
    } finally {
      window.localStorage.removeItem("mori.preferences.v1")
    }
  })

  it("hydrates editable inspiration selected from Library", () => {
    render(
      <MoriAppProvider>
        <CreateCanvas
          projectRef="project_preview_first_light"
          mode="custom"
          initialCreativeSource={{ kind: "inspiration", ref: "style_preview_open_road" }}
          onModeChange={() => undefined}
          onGenerate={() => undefined}
        />
      </MoriAppProvider>,
    )

    expect(screen.getByRole("button", { name: "Change inspiration Open Road" })).toBeInTheDocument()
    expect(screen.getByLabelText("Style")).toHaveValue("Cinematic folk · open horizon · strings")
  })

  it("hydrates a reusable audio reference selected from Library", () => {
    const onGenerate = vi.fn<(draft: CreationDraft) => void>()

    render(
      <MoriAppProvider>
        <CreateCanvas
          projectRef="project_preview_first_light"
          mode="custom"
          initialCreativeSource={{ kind: "audio", ref: "source_preview_city_lights" }}
          onModeChange={() => undefined}
          onGenerate={onGenerate}
        />
      </MoriAppProvider>,
    )

    expect(screen.getByRole("button", { name: "Replace reference audio City Lights demo" })).toBeInTheDocument()
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    expect(onGenerate.mock.calls[0]?.[0].referenceAssetRefs).toEqual(["asset_preview_city_lights"])
  })

  it("hydrates a live Voice deep link through the source detail projection", async () => {
    const getCreativeSource = vi.fn<MoriApi["getCreativeSource"]>(async () => ({
      data: {
        source_kind: "voice",
        source_ref: "voice_live_mira",
        name: "Mira Live",
        description: "Warm alto · intimate phrasing",
        created_at: "2026-09-04T12:00:00.000Z",
      },
      meta: { request_id: "request_live_voice" },
    }))
    const api = {
      ...createWorkspaceApi(),
      getCreativeSource,
    }

    render(
      <MoriAppProvider>
        <MoriWorkspace api={api} initialCreativeSource={{ kind: "voice", ref: "voice_live_mira" }} />
      </MoriAppProvider>,
    )

    await waitFor(() => expect(getCreativeSource).toHaveBeenCalledWith("voice", "voice_live_mira"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Change voice profile Mira Live" })).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Song with lyrics" })).toHaveAttribute("aria-pressed", "true")
  })

  it("uses the live Source catalog for Create pickers", async () => {
    const listCreativeSources = vi.fn<MoriApi["listCreativeSources"]>(async () => ({
      data: {
        sources: [{
          source_kind: "inspiration",
          source_ref: "style_live_night_drive",
          name: "Night Drive",
          description: "Nocturnal rhythm · glassy motion",
          style: "Future garage · nocturnal · glassy motion",
          created_at: "2026-09-04T12:00:00.000Z",
        }],
        next_cursor: null,
      },
      meta: { request_id: "request_live_sources" },
    }))
    const api = {
      ...createWorkspaceApi(),
      listCreativeSources,
    }

    render(<MoriAppProvider><MoriWorkspace api={api} /></MoriAppProvider>)

    await waitFor(() => expect(listCreativeSources).toHaveBeenCalledWith({ limit: 20 }))
    fireEvent.click(screen.getByRole("tab", { name: "Custom" }))
    fireEvent.click(screen.getByRole("button", { name: "Choose inspiration" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Use Night Drive inspiration" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Use Night Drive inspiration" }))
    expect(screen.getByLabelText("Style")).toHaveValue("Future garage · nocturnal · glassy motion")
  })

  it("carries selected creative asset refs into the generation command", async () => {
    let request: GenerationCreateInput | null = null
    const api: Pick<MoriApi, "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration"> = {
      createSongPlan: async (projectRef, input) => ({
        data: { ...input, song_plan_ref: "song_plan_reference", project_ref: projectRef, created_at: "2026-09-02T12:00:00.000Z" },
        meta: { request_id: "request_reference_plan" },
      }),
      createGeneration: async (_projectRef, input) => {
        request = input
        return { data: { generation_ref: "generation_reference", status: "queued" as const }, meta: { request_id: "request_reference_create" } }
      },
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_reference",
          generation_kind: "new_song" as const,
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "queued" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_reference_status" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_reference_candidates" } }),
      cancelGeneration: async () => ({ data: { generation_ref: "generation_reference", status: "cancelled" as const }, meta: { request_id: "request_reference_cancel" } }),
    }

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef={previewProject.projectRef} api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.click(screen.getByRole("button", { name: "Choose voice profile" }))
    fireEvent.click(screen.getByRole("button", { name: "Use Mira voice" }))
    fireEvent.change(screen.getByLabelText("Reference audio file"), { target: { files: [new File(["audio"], "first-light.mp3", { type: "audio/mpeg" })] } })
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => {
      expect(request).not.toBeNull()
      expect(request?.reference_asset_refs).toEqual(["asset_preview_reference"])
      expect(request?.voice_ref).toBe("voice_preview_mira")
    })
  })

  it("rejects a non-audio reference before generation", () => {
    const onGenerate = vi.fn<(draft: CreationDraft) => void>()

    render(
      <MoriAppProvider>
        <CreateCanvas projectRef="project_preview_first_light" mode="smart" onModeChange={() => undefined} onGenerate={onGenerate} />
      </MoriAppProvider>,
    )

    fireEvent.change(screen.getByLabelText("Reference audio file"), { target: { files: [new File(["notes"], "notes.txt", { type: "text/plain" })] } })

    expect(screen.getByRole("alert")).toHaveTextContent("Choose an MP3, WAV, M4A, FLAC, AAC, or OGG audio file.")
    expect(screen.getByRole("button", { name: "Add audio reference" })).toBeInTheDocument()
    expect(onGenerate).not.toHaveBeenCalled()
  })

  it("does not substitute a preview asset when a live upload seam is unavailable", () => {
    const onGenerate = vi.fn<(draft: CreationDraft) => void>()

    render(
      <MoriAppProvider>
        <CreateCanvas projectRef="project_live_1" mode="custom" onModeChange={() => undefined} onGenerate={onGenerate} />
      </MoriAppProvider>,
    )

    fireEvent.change(screen.getByLabelText("Reference audio file"), { target: { files: [new File(["audio"], "guide.wav", { type: "audio/wav" })] } })

    expect(screen.getByRole("alert")).toHaveTextContent("Reference audio upload is not connected right now")
    expect(screen.getByRole("button", { name: "Add audio reference" })).toBeInTheDocument()
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    expect(onGenerate).toHaveBeenCalledOnce()
    expect(onGenerate.mock.calls[0]?.[0].referenceAssetRefs).toEqual([])
  })

  it("reuses the upload session and idempotency key when retrying the same failed file", async () => {
    const createUpload = vi.fn<MoriApi["createCreativeSourceUpload"]>(async (_input, idempotencyKey) => ({
      data: { upload_ref: "upload_retry_1", status: "creating", expires_at: "2026-09-06T00:00:00Z" },
      meta: { request_id: idempotencyKey },
    }))
    const uploadContent = vi.fn<MoriApi["uploadCreativeSourceContent"]>()
      .mockRejectedValueOnce(new Error("network lost"))
      .mockResolvedValueOnce({
        data: { upload_ref: "upload_retry_1", source_kind: "audio", status: "ready", bytes_received: 4, byte_size: 4, asset_ref: "asset_retry_1", source_ref: "source_retry_1", error: null, created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:02Z", expires_at: "2026-09-06T00:00:00Z" },
        meta: { request_id: "upload_retry_ready" },
      })
    const api: Partial<MoriApi> = { createCreativeSourceUpload: createUpload, uploadCreativeSourceContent: uploadContent }
    const file = new File(["test"], "guide.wav", { type: "audio/wav" })

    render(<MoriAppProvider><CreateCanvas projectRef="project_live_1" mode="custom" api={api} onModeChange={() => undefined} onGenerate={() => undefined} /></MoriAppProvider>)
    const input = screen.getByLabelText("Reference audio file")
    fireEvent.change(input, { target: { files: [file] } })
    expect(await screen.findByRole("alert")).toHaveTextContent("Audio reference upload failed")

    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByRole("button", { name: "Replace reference audio guide.wav" })).toBeInTheDocument())

    expect(createUpload).toHaveBeenCalledOnce()
    expect(createUpload.mock.calls[0]?.[1]).toMatch(/^mori-upload-/)
    expect(uploadContent).toHaveBeenCalledTimes(2)
  })

  it("restores an interrupted upload session and lets the user continue with the same file", async () => {
    const projectRef = "project_recovered_upload"
    const recoveryKey = `mori-creative-upload-recovery-v1:${encodeURIComponent(projectRef)}`
    localStorage.setItem(recoveryKey, JSON.stringify({
      projectRef,
      fileName: "guide.wav",
      contentType: "audio/wav",
      byteSize: 4,
      idempotencyKey: "mori-upload-recovered-key",
      uploadRef: "upload_recovered_1",
    }))
    const createUpload = vi.fn<MoriApi["createCreativeSourceUpload"]>()
    const getUpload = vi.fn<MoriApi["getCreativeSourceUpload"]>(async () => ({
      data: { upload_ref: "upload_recovered_1", source_kind: "audio", status: "failed", bytes_received: 4, byte_size: 4, asset_ref: null, source_ref: null, error: { code: "upload_interrupted", message: "Upload interrupted", retryable: true, details: null }, created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:02Z", expires_at: "2026-09-06T00:00:00Z" },
      meta: { request_id: "upload_recovered_status" },
    }))
    const uploadContent = vi.fn<MoriApi["uploadCreativeSourceContent"]>(async () => ({
      data: { upload_ref: "upload_recovered_1", source_kind: "audio", status: "ready", bytes_received: 4, byte_size: 4, asset_ref: "asset_recovered_1", source_ref: "source_recovered_1", error: null, created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:03Z", expires_at: "2026-09-06T00:00:00Z" },
      meta: { request_id: "upload_recovered_ready" },
    }))
    const api: Partial<MoriApi> = { createCreativeSourceUpload: createUpload, getCreativeSourceUpload: getUpload, uploadCreativeSourceContent: uploadContent }

    render(<MoriAppProvider><CreateCanvas projectRef={projectRef} mode="custom" api={api} onModeChange={() => undefined} onGenerate={() => undefined} /></MoriAppProvider>)

    expect(await screen.findByRole("alert")).toHaveTextContent("Upload interrupted")
    expect(screen.getByRole("button", { name: "Continue reference audio guide.wav" })).toBeEnabled()
    fireEvent.change(screen.getByLabelText("Reference audio file"), { target: { files: [new File(["test"], "guide.wav", { type: "audio/wav" })] } })

    await waitFor(() => expect(screen.getByRole("button", { name: "Replace reference audio guide.wav" })).toBeInTheDocument())
    expect(getUpload).toHaveBeenCalledOnce()
    expect(createUpload).not.toHaveBeenCalled()
    expect(uploadContent).toHaveBeenCalledOnce()
    expect(uploadContent.mock.calls[0]?.[0]).toBe("upload_recovered_1")
    expect(localStorage.getItem(recoveryKey)).toBeNull()
  })

  it("shows processing and only exposes a ready uploaded reference", async () => {
    let resolveUploadStatus: (value: Awaited<ReturnType<MoriApi["getCreativeSourceUpload"]>>) => void = () => undefined
    const uploadContent = vi.fn<MoriApi["uploadCreativeSourceContent"]>(async () => ({
      data: { upload_ref: "upload_live_1", source_kind: "audio", status: "processing", bytes_received: 4, byte_size: 4, asset_ref: null, source_ref: null, error: null, created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:01Z", expires_at: "2026-09-06T00:00:00Z" },
      meta: { request_id: "upload_content_live_1" },
    }))
    const getUpload = vi.fn<MoriApi["getCreativeSourceUpload"]>(() => new Promise((resolve) => { resolveUploadStatus = resolve }))
    const api: Partial<MoriApi> = {
      createCreativeSourceUpload: async () => ({ data: { upload_ref: "upload_live_1", status: "creating", expires_at: "2026-09-06T00:00:00Z" }, meta: { request_id: "upload_create_live_1" } }),
      uploadCreativeSourceContent: uploadContent,
      getCreativeSourceUpload: getUpload,
    }

    render(<MoriAppProvider><CreateCanvas projectRef="project_live_1" mode="custom" api={api} onModeChange={() => undefined} onGenerate={() => undefined} /></MoriAppProvider>)
    fireEvent.change(screen.getByLabelText("Reference audio file"), { target: { files: [new File(["test"], "guide.wav", { type: "audio/wav" })] } })
    expect(await screen.findByText("processing · preparing your reference")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled()

    await waitFor(() => expect(getUpload).toHaveBeenCalledOnce())
    resolveUploadStatus({
      data: { upload_ref: "upload_live_1", source_kind: "audio", status: "ready", bytes_received: 4, byte_size: 4, asset_ref: "asset_live_1", source_ref: "source_live_1", error: null, created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:02Z", expires_at: "2026-09-06T00:00:00Z" },
      meta: { request_id: "upload_status_live_1" },
    })
    await waitFor(() => expect(screen.getByRole("button", { name: "Replace reference audio guide.wav" })).toBeInTheDocument())
    expect(uploadContent).toHaveBeenCalledOnce()
  })

  it("sends a recorded reference through the existing upload session", async () => {
    const createUpload = vi.fn<MoriApi["createCreativeSourceUpload"]>(async (input) => ({
      data: { upload_ref: "upload_recorded_1", status: "creating", expires_at: "2026-09-06T00:00:00Z" },
      meta: { request_id: `upload_create_${input.file_name}` },
    }))
    const uploadContent = vi.fn<MoriApi["uploadCreativeSourceContent"]>(async (_uploadRef, content, contentType) => {
      expect(content).toBeInstanceOf(Blob)
      expect(contentType).toBe("audio/webm")
      const byteSize = content instanceof Blob ? content.size : 0
      return {
        data: { upload_ref: "upload_recorded_1", source_kind: "audio", status: "ready", bytes_received: byteSize, byte_size: byteSize, asset_ref: "asset_recorded_1", source_ref: "source_recorded_1", error: null, created_at: "2026-09-05T00:00:00Z", updated_at: "2026-09-05T00:00:02Z", expires_at: "2026-09-06T00:00:00Z" },
        meta: { request_id: "upload_recorded_ready" },
      }
    })
    const stopTrack = vi.fn()
    vi.stubGlobal("MediaRecorder", CreateFakeMediaRecorder)
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) } })

    try {
      const api: Partial<MoriApi> = { createCreativeSourceUpload: createUpload, uploadCreativeSourceContent: uploadContent }
      render(<MoriAppProvider><CreateCanvas projectRef="project_live_1" mode="custom" api={api} onModeChange={() => undefined} onGenerate={() => undefined} /></MoriAppProvider>)

      fireEvent.click(screen.getByRole("button", { name: "Record audio reference" }))
      await waitFor(() => expect(screen.getByRole("button", { name: "Stop recording audio reference" })).toBeInTheDocument())
      expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled()

      fireEvent.click(screen.getByRole("button", { name: "Stop recording audio reference" }))
      await waitFor(() => expect(screen.getByRole("button", { name: /^Replace reference audio mori-recording-/u })).toBeInTheDocument())
      expect(createUpload).toHaveBeenCalledOnce()
      expect(createUpload.mock.calls[0]?.[0]).toMatchObject({ source_kind: "audio", content_type: "audio/webm" })
      expect(uploadContent).toHaveBeenCalledOnce()
      expect(stopTrack).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("preserves the current audio reference when a replacement is rejected", () => {
    render(<MoriAppProvider><CreateCanvas projectRef={previewProject.projectRef} mode="custom" onModeChange={() => undefined} onGenerate={() => undefined} /></MoriAppProvider>)

    const referenceInput = screen.getByLabelText("Reference audio file")
    fireEvent.change(referenceInput, { target: { files: [new File(["audio"], "kept.wav", { type: "audio/wav" })] } })
    fireEvent.change(referenceInput, { target: { files: [new File(["notes"], "notes.txt", { type: "text/plain" })] } })

    expect(screen.getByRole("alert")).toHaveTextContent("Choose an MP3, WAV, M4A, FLAC, AAC, or OGG audio file.")
    expect(screen.getByRole("button", { name: "Replace reference audio kept.wav" })).toBeInTheDocument()
  })

  it("keeps optional user lyrics in the custom creation draft", () => {
    const onGenerate = vi.fn<(draft: CreationDraft) => void>()

    render(
      <MoriAppProvider>
        <CreateCanvas projectRef="project_preview_first_light" mode="custom" onModeChange={() => undefined} onGenerate={onGenerate} />
      </MoriAppProvider>,
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Lyrics" }), { target: { value: "  Hold the light until the morning comes.  " } })
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    expect(onGenerate).toHaveBeenCalledOnce()
    expect(onGenerate.mock.calls[0]?.[0].lyrics).toBe("Hold the light until the morning comes.")
  })

  it("keeps the Create header focused on generation instead of exposing a dead share action", () => {
    renderWorkspace()

    expect(screen.getByRole("button", { name: "Open generation queue" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /share|copy link/iu })).not.toBeInTheDocument()
  })

  it("keeps the sidebar state at the application shell level", () => {
    renderWorkspace()
    const navigation = screen.getByRole("navigation", { name: "Mori" })

    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }))

    expect(navigation).toHaveAttribute("aria-label", "Mori")
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toHaveAttribute("aria-expanded", "false")
  })

  it("opens the generation queue as a contextual drawer", () => {
    renderWorkspace()
    expect(screen.queryByRole("dialog", { name: /generation queue/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /open generation queue/i }))

    expect(screen.getByRole("dialog", { name: /generation queue/i })).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: /generation queue/i }).closest('[data-mori-portal-host="true"]')).not.toBeNull()
    expect(screen.getByRole("button", { name: /close generation queue/i })).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: /generation queue/i })).toHaveFocus()
    expect(document.body.style.overflow).toBe("hidden")

    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("dialog", { name: /generation queue/i })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe("")
  })

  it("keeps the previous Current until the queue selection is confirmed", async () => {
    let releaseSelection: () => void = () => undefined
    const selectionGate = new Promise<void>((resolve) => { releaseSelection = resolve })
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async () => {
      await selectionGate
      return {
        data: {
          project_ref: previewProject.projectRef,
          current_version_ref: previewCandidates[1].versionRef,
          source_candidate_ref: previewCandidates[1].candidateRef,
          previous_version_ref: previewCandidates[0].versionRef,
          selected_at: "2026-09-04T13:00:00.000Z",
        },
        meta: { request_id: "request_queue_current_success" },
      }
    })

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef={previewProject.projectRef} api={createWorkspaceApi({ putCurrentVersion })} />
      </MoriAppProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    const queue = screen.getByRole("dialog", { name: "Generation queue" })
    const currentCard = within(queue).getByRole("button", { name: "Select First Light direction" }).closest("article") as HTMLElement
    const nextCard = within(queue).getByRole("button", { name: "Select First Light · Afterglow direction" }).closest("article") as HTMLElement

    fireEvent.click(within(nextCard).getByRole("button", { name: "Set as current" }))

    await waitFor(() => expect(putCurrentVersion).toHaveBeenCalledOnce())
    expect(within(currentCard).getByText("Current version")).toBeInTheDocument()
    expect(within(nextCard).queryByText("Current version")).not.toBeInTheDocument()
    expect(within(nextCard).getByRole("button", { name: "Setting First Light · Afterglow as current" })).toBeDisabled()
    expect(putCurrentVersion.mock.calls[0]?.slice(0, 2)).toEqual([
      previewProject.projectRef,
      {
        candidate_ref: previewCandidates[1].candidateRef,
        version_ref: previewCandidates[1].versionRef,
        expected_current_version_ref: previewCandidates[0].versionRef,
      },
    ])
    expect(putCurrentVersion.mock.calls[0]?.[2]).toMatch(/^mori-current-version-/u)

    releaseSelection()

    await waitFor(() => expect(within(nextCard).getByText("Current version")).toBeInTheDocument())
    expect(within(currentCard).queryByText("Current version")).not.toBeInTheDocument()
    expect(within(queue).getByRole("status")).toHaveTextContent("Current Version updated")
  })

  it("keeps global listening intent unchanged when a Direction is only selected", () => {
    render(
      <MoriAppProvider mediaFactory={silentMediaFactory}>
        <ActivePlayerHarness />
        <MoriWorkspace projectRef={previewProject.projectRef} />
      </MoriAppProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Start outside listen" }))
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    fireEvent.click(screen.getByRole("button", { name: "Select First Light · Afterglow direction" }))

    expect(screen.getByLabelText("global listening state")).toHaveTextContent("version_outside_listen|playing|40|version_outside_listen")
    expect(screen.getByRole("button", { name: "Play First Light · Afterglow" })).toHaveTextContent("Preview")
  })

  it("keeps global listening intent while a new direction enters the queue", async () => {
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async () => ({
      data: { generation_ref: "generation_background_listen", status: "queued" as const },
      meta: { request_id: "request_background_listen" },
    }))

    render(
      <MoriAppProvider mediaFactory={silentMediaFactory}>
        <ActivePlayerHarness />
        <MoriWorkspace projectRef={previewProject.projectRef} api={createWorkspaceApi({ createGeneration })} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Start outside listen" }))
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(createGeneration).toHaveBeenCalledOnce())
    expect(screen.getByLabelText("global listening state")).toHaveTextContent("version_outside_listen|playing|40|version_outside_listen")
  })

  it("keeps global listening intent unchanged when a Direction becomes Current", async () => {
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async () => ({
      data: {
        project_ref: previewProject.projectRef,
        current_version_ref: previewCandidates[1].versionRef,
        source_candidate_ref: previewCandidates[1].candidateRef,
        previous_version_ref: previewCandidates[0].versionRef,
        selected_at: "2026-09-04T13:00:00.000Z",
      },
      meta: { request_id: "request_current_preserves_listen" },
    }))

    render(
      <MoriAppProvider mediaFactory={silentMediaFactory}>
        <ActivePlayerHarness />
        <MoriWorkspace projectRef={previewProject.projectRef} api={createWorkspaceApi({ putCurrentVersion })} />
      </MoriAppProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Start outside listen" }))
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    fireEvent.click(screen.getByRole("button", { name: "Set as current" }))

    await waitFor(() => expect(screen.getByText("Current Version updated")).toBeInTheDocument())
    expect(screen.getByLabelText("global listening state")).toHaveTextContent("version_outside_listen|playing|40|version_outside_listen")
    expect(screen.getByRole("button", { name: "Play First Light · Afterglow" })).toHaveTextContent("Preview")
  })

  it("keeps the queue Current unchanged and reuses its command identity on retry", async () => {
    const idempotencyKeys: string[] = []
    let attempt = 0
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async (_projectRef, _input, idempotencyKey) => {
      idempotencyKeys.push(idempotencyKey)
      attempt += 1
      if (attempt === 1) throw new Error("temporary failure")
      return {
        data: {
          project_ref: previewProject.projectRef,
          current_version_ref: previewCandidates[1].versionRef,
          source_candidate_ref: previewCandidates[1].candidateRef,
          previous_version_ref: previewCandidates[0].versionRef,
          selected_at: "2026-09-04T13:01:00.000Z",
        },
        meta: { request_id: "request_queue_current_retry" },
      }
    })

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef={previewProject.projectRef} api={createWorkspaceApi({ putCurrentVersion })} />
      </MoriAppProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    fireEvent.click(screen.getByRole("button", { name: "Set as current" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Your previous Current is unchanged.")
    expect(screen.getByText("Current version")).toBeInTheDocument()
    fireEvent.click(within(alert).getByRole("button", { name: "Retry Set as current" }))

    await waitFor(() => expect(putCurrentVersion).toHaveBeenCalledTimes(2))
    expect(idempotencyKeys[0]).toBe(idempotencyKeys[1])
    await waitFor(() => expect(screen.getByText("Current Version updated")).toBeInTheDocument())
  })

  it("uses the Project projection as the queue command's expected Current", async () => {
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async () => ({
      data: {
        project_ref: "project_live_queue",
        current_version_ref: "version_live_queue_b",
        source_candidate_ref: "candidate_live_queue_b",
        previous_version_ref: "version_live_queue_a",
        selected_at: "2026-09-04T13:02:00.000Z",
      },
      meta: { request_id: "request_live_queue_current" },
    }))
    const api = createWorkspaceApi({
      getProject: async () => ({
        data: {
          project_ref: "project_live_queue",
          title: "Window Seat",
          description: "A quiet, forward-moving sketch.",
          current_version_ref: "version_live_queue_a",
          candidate_count: 1,
          last_activity_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_live_queue_project" },
      }),
      createGeneration: async () => ({
        data: { generation_ref: "generation_live_queue", status: "queued" },
        meta: { request_id: "request_live_queue_generation" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_live_queue",
          generation_kind: "new_song",
          project_ref: "project_live_queue",
          song_plan_ref: null,
          mode: "custom",
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_live_queue_b"],
          created_at: "2026-09-04T13:02:00.000Z",
        },
        meta: { request_id: "request_live_queue_snapshot" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_live_queue_b",
            version_ref: "version_live_queue_b",
            generation_ref: "generation_live_queue",
            project_ref: "project_live_queue",
            title: "Window Seat · Dawn",
            duration_seconds: 188,
            audio_asset_ref: "asset_live_queue_b",
            waveform_asset_ref: "waveform_live_queue_b",
            style_tags: ["quiet", "forward-moving"],
            created_at: "2026-09-04T13:02:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_live_queue_candidates" },
      }),
      putCurrentVersion,
    })

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef="project_live_queue" api={api} />
      </MoriAppProvider>,
    )
    await waitFor(() => expect(screen.getByRole("link", { name: "Window Seat" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("tab", { name: "Custom" }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    await waitFor(() => expect(screen.getByRole("button", { name: "Set as current" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Set as current" }))

    await waitFor(() => expect(putCurrentVersion).toHaveBeenCalledOnce())
    expect(putCurrentVersion.mock.calls[0]?.[1].expected_current_version_ref).toBe("version_live_queue_a")
  })

  it("does not let a stale Project projection overwrite a confirmed queue selection", async () => {
    let releaseProject: (project: Awaited<ReturnType<MoriApi["getProject"]>>) => void = () => undefined
    const projectGate = new Promise<Awaited<ReturnType<MoriApi["getProject"]>>>((resolve) => { releaseProject = resolve })
    const api = createWorkspaceApi({
      getProject: async () => projectGate,
      createGeneration: async () => ({
        data: { generation_ref: "generation_projection_race", status: "queued" },
        meta: { request_id: "request_projection_race_generation" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_projection_race",
          generation_kind: "new_song",
          project_ref: "project_projection_race",
          song_plan_ref: null,
          mode: "custom",
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_projection_race_b"],
          created_at: "2026-09-04T13:03:00.000Z",
        },
        meta: { request_id: "request_projection_race_snapshot" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_projection_race_b",
            version_ref: "version_projection_race_b",
            generation_ref: "generation_projection_race",
            project_ref: "project_projection_race",
            title: "Open Window",
            duration_seconds: 184,
            audio_asset_ref: "asset_projection_race_b",
            waveform_asset_ref: "waveform_projection_race_b",
            style_tags: ["open", "quiet"],
            created_at: "2026-09-04T13:03:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_projection_race_candidates" },
      }),
      putCurrentVersion: async () => ({
        data: {
          project_ref: "project_projection_race",
          current_version_ref: "version_projection_race_b",
          source_candidate_ref: "candidate_projection_race_b",
          previous_version_ref: null,
          selected_at: "2026-09-04T13:03:30.000Z",
        },
        meta: { request_id: "request_projection_race_current" },
      }),
    })

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef="project_projection_race" api={api} />
      </MoriAppProvider>,
    )
    fireEvent.click(screen.getByRole("tab", { name: "Custom" }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    await waitFor(() => expect(screen.getByRole("button", { name: "Set as current" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Set as current" }))
    await waitFor(() => expect(screen.getByText("Current version")).toBeInTheDocument())

    releaseProject({
      data: {
        project_ref: "project_projection_race",
        title: "Open Window Project",
        description: "A quiet sketch.",
        current_version_ref: null,
        candidate_count: 0,
        last_activity_at: "2026-09-04T13:00:00.000Z",
      },
      meta: { request_id: "request_projection_race_project" },
    })

    await waitFor(() => expect(screen.getByRole("link", { name: "Open Window Project", hidden: true })).toBeInTheDocument())
    expect(screen.getByText("Current version")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Set as current" })).not.toBeInTheDocument()
  })

  it("lets a user cancel an active generation from the queue", async () => {
    let resolveCancellation: ((value: Awaited<ReturnType<MoriApi["cancelGeneration"]>>) => void) | undefined
    const cancellation = new Promise<Awaited<ReturnType<MoriApi["cancelGeneration"]>>>((resolve) => {
      resolveCancellation = resolve
    })
    const cancelGeneration = vi.fn<MoriApi["cancelGeneration"]>(async () => cancellation)
    const api: Pick<MoriApi, "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration"> = {
      createSongPlan: async (projectRef, input, idempotencyKey) => ({
        data: {
          ...input,
          song_plan_ref: `song_plan_${idempotencyKey}`,
          project_ref: projectRef,
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_plan_create" },
      }),
      createGeneration: async () => ({
        data: { generation_ref: "generation_live_1", status: "queued" as const },
        meta: { request_id: "request_create_1" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_live_1",
          generation_kind: "new_song" as const,
          project_ref: "project_preview_first_light",
          song_plan_ref: "song_plan_preview_first_light",
          mode: "smart" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "generating" as const,
          progress: 52,
          candidate_refs: [],
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_status_1" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({
        data: { candidates: [], next_cursor: null },
        meta: { request_id: "request_candidates_1" },
      }),
      cancelGeneration,
    }

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef={previewProject.projectRef} api={api} />
      </MoriAppProvider>,
    )

    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel generation" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Cancel generation" }))

    await waitFor(() => expect(cancelGeneration).toHaveBeenCalledOnce())
    expect(screen.getByRole("button", { name: "Stopping…" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Stopping…" }))
    expect(cancelGeneration).toHaveBeenCalledOnce()
    resolveCancellation?.({
      data: { generation_ref: "generation_live_1", status: "cancelled" },
      meta: { request_id: "request_cancel_1" },
    })
    await waitFor(() => expect(screen.getByText("Generation cancelled")).toBeInTheDocument())
  })

  it("keeps observing when cancellation is acknowledged before the generation reaches a terminal state", async () => {
    let cancellationAcknowledged = false
    const api = createWorkspaceApi({
      createSongPlan: async (projectRef, input) => ({
        data: { ...input, song_plan_ref: "song_plan_cancel_pending", project_ref: projectRef, created_at: "2026-09-04T12:00:00.000Z" },
        meta: { request_id: "request_cancel_pending_plan" },
      }),
      createGeneration: async () => ({
        data: { generation_ref: "generation_cancel_pending", status: "queued" },
        meta: { request_id: "request_cancel_pending_create" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_cancel_pending",
          generation_kind: "new_song",
          project_ref: previewProject.projectRef,
          song_plan_ref: "song_plan_cancel_pending",
          mode: "custom",
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: cancellationAcknowledged ? "succeeded" : "generating",
          progress: cancellationAcknowledged ? 100 : 42,
          candidate_refs: [],
          created_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_cancel_pending_status" },
      }),
      cancelGeneration: async (generationRef) => {
        cancellationAcknowledged = true
        return {
          data: { generation_ref: generationRef, status: "preparing" },
          meta: { request_id: "request_cancel_pending_ack" },
        }
      },
    })

    render(<MoriAppProvider><MoriWorkspace projectRef={previewProject.projectRef} api={api} /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel generation" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Cancel generation" }))

    await waitFor(() => expect(screen.getByText("No playable directions yet")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Hide generation queue", hidden: true })).toHaveAttribute("data-generation-feedback", "ready")
  })

  it("offers a human retry path when generation fails", async () => {
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async () => {
      throw new Error("provider unavailable")
    })
    const api: Pick<MoriApi, "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration"> = {
      createSongPlan: async (projectRef, input) => ({
        data: {
          ...input,
          song_plan_ref: "song_plan_retry",
          project_ref: projectRef,
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_retry_plan" },
      }),
      createGeneration,
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_retry",
          generation_kind: "new_song" as const,
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "failed" as const,
          progress: 0,
          candidate_refs: [],
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_retry_status" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_retry_candidates" } }),
      cancelGeneration: async () => ({ data: { generation_ref: "generation_retry", status: "cancelled" as const }, meta: { request_id: "request_retry_cancel" } }),
    }

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef={previewProject.projectRef} api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(screen.getByText("We couldn't start this direction. Try again.")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(2))
  })

  it("keeps the server queue state intact while status observation reconnects", async () => {
    const api = createWorkspaceApi({
      createSongPlan: async (projectRef, input) => ({
        data: {
          ...input,
          song_plan_ref: "song_plan_status_failure",
          project_ref: projectRef,
          created_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_status_failure_plan" },
      }),
      createGeneration: async () => ({
        data: { generation_ref: "generation_status_failure", status: "queued" },
        meta: { request_id: "request_status_failure_create" },
      }),
      getGeneration: async () => { throw new Error("status unavailable") },
    })

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef={previewProject.projectRef} api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(screen.getByText("Mori status is unavailable. Retrying…")).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Hide generation queue", hidden: true })).toHaveAttribute("data-generation-feedback", "active")
    expect(readGenerationQueueState().items.find((item) => item.generation_ref === "generation_status_failure")?.status).toBe("queued")
  })

  it("clears preview directions when a completed generation has no candidates", async () => {
    const api: Pick<MoriApi, "createSongPlan" | "createGeneration" | "getGeneration" | "getGenerationEvents" | "listCandidates" | "cancelGeneration"> = {
      createSongPlan: async (projectRef, input) => ({
        data: {
          ...input,
          song_plan_ref: "song_plan_empty_result",
          project_ref: projectRef,
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_empty_result_plan" },
      }),
      createGeneration: async () => ({
        data: { generation_ref: "generation_empty_result", status: "queued" as const },
        meta: { request_id: "request_empty_result_create" },
      }),
      getGeneration: async () => ({
        data: {
          generation_ref: "generation_empty_result",
          generation_kind: "new_song" as const,
          project_ref: "project_preview_first_light",
          song_plan_ref: null,
          mode: "custom" as const,
          source_version_ref: null,
          operation: null,
          output_count: 2 as const,
          status: "succeeded" as const,
          progress: 100,
          candidate_refs: [],
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_empty_result_status" },
      }),
      getGenerationEvents: async () => [],
      listCandidates: async () => ({ data: { candidates: [], next_cursor: null }, meta: { request_id: "request_empty_result_candidates" } }),
      cancelGeneration: async () => ({ data: { generation_ref: "generation_empty_result", status: "cancelled" as const }, meta: { request_id: "request_empty_result_cancel" } }),
    }

    render(
      <MoriAppProvider>
        <MoriWorkspace projectRef={previewProject.projectRef} api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(screen.getByText("No playable directions yet")).toBeInTheDocument())
    expect(screen.getByText("0 directions")).toBeInTheDocument()
  })
})

function workspaceProjectionForPlan(
  projectRef: string,
  currentSongPlan: NonNullable<MoriProjectWorkspaceProjection["current_song_plan"]> | null = null,
): MoriProjectWorkspaceProjection {
  return {
    project: {
      project_ref: projectRef,
      title: "Window Seat",
      description: "A quiet, forward-moving sketch.",
      current_version_ref: null,
      candidate_count: 0,
      last_activity_at: "2026-09-05T14:00:00.000Z",
    },
    current_song_plan: currentSongPlan,
    open_version: null,
    latest_lyrics_draft: null,
    latest_mix_revision: null,
    active_tasks: [],
    revision_cursor: `workspace_${projectRef}`,
    observed_at: "2026-09-05T14:00:00.000Z",
  }
}
