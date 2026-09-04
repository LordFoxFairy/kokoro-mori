import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { GenerationCreateInput, MoriApi } from "@/lib/mori-api"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import { CreateCanvas, type CreationDraft } from "./components/create-canvas"
import { MoriWorkspace } from "./mori-workspace"
import { previewCandidates, previewProject } from "./preview-data"

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
    const activeTrigger = screen.getByRole("button", { name: "Hide generation queue" })
    expect(activeTrigger).toHaveAttribute("data-generation-feedback", "active")
    expect(activeTrigger).toHaveTextContent("Generating")
    expect(activeTrigger.querySelector('[data-generation-icon="active"]')).toBeInTheDocument()
    fireEvent.click(activeTrigger)
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveAttribute("data-generation-feedback", "active")
    expect(screen.getByRole("link", { name: "Quiet piano song for the first train home" })).toHaveAttribute("href", "/projects/project_quiet_train")
    expect(window.location.pathname + window.location.search).toBe("/create?project_ref=project_quiet_train")
    await waitFor(() => expect(screen.getByRole("link", { name: "New creation" })).toHaveAttribute("href", "/create?project_ref=project_quiet_train"))
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings?return_to=%2Fcreate%3Fproject_ref%3Dproject_quiet_train")
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
    const createGeneration = vi.fn<MoriApi["createGeneration"]>(async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Hide generation queue" }))
    const failedTrigger = screen.getByRole("button", { name: "Open generation queue" })
    expect(failedTrigger).toHaveAttribute("data-generation-feedback", "attention")
    expect(failedTrigger).toHaveTextContent("Needs attention")
    expect(failedTrigger.querySelector('[data-generation-icon="attention"]')).toBeInTheDocument()
    fireEvent.click(failedTrigger)
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(2))
    expect(createProject).toHaveBeenCalledOnce()
    expect(createGeneration.mock.calls.every(([projectRef]) => projectRef === "project_retry_home")).toBe(true)
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
    expect(screen.getByText("Your controls go straight to the generation queue.")).toBeInTheDocument()
    expect(screen.queryByText(/Song Plan will map the mood/u)).not.toBeInTheDocument()
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
    expect(screen.getByText("Your controls go straight to the generation queue.")).toBeInTheDocument()

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
          initialCreativeSource={{ kind: "audio", ref: "asset_preview_city_lights" }}
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

  it("preserves the current audio reference when a replacement is rejected", () => {
    renderWorkspace()

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

    await waitFor(() => expect(screen.getByRole("link", { name: "Open Window Project" })).toBeInTheDocument())
    expect(screen.getByText("Current version")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Set as current" })).not.toBeInTheDocument()
  })

  it("lets a user cancel an active generation from the queue", async () => {
    const cancelGeneration = vi.fn(async () => ({
      data: { generation_ref: "generation_live_1", status: "cancelled" as const },
      meta: { request_id: "request_cancel_1" },
    }))
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
    expect(screen.getByText("Generation cancelled")).toBeInTheDocument()
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
