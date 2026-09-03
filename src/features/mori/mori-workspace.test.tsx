import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { GenerationCreateInput, MoriApi } from "@/lib/mori-api"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import { CreateCanvas, type CreationDraft } from "./components/create-canvas"
import { MoriWorkspace } from "./mori-workspace"
import { previewCandidates } from "./preview-data"

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
  it("does not trigger global playback shortcuts from an active modal", () => {
    render(<MoriAppProvider><ModalShortcutHarness /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Load player" }))

    const modal = screen.getByRole("dialog", { name: "Test modal" })
    fireEvent.keyDown(modal, { code: "Space" })

    expect(screen.getByRole("status")).toHaveTextContent("paused")
  })

  it("starts in Smart Create mode without a permanent queue column", () => {
    renderWorkspace()
    expect(screen.getByRole("navigation", { name: "Mori" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /make something you can feel/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /smart/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("link", { name: "First Light" })).toHaveAttribute("href", "/projects/project_preview_first_light")
    expect(screen.queryByRole("dialog", { name: /generation queue/i })).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: /global player/i })).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    expect(screen.getByLabelText(/lyrics or instrumental/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/style/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add audio reference" })).toBeInTheDocument()
  })

  it("keeps audio, voice, and inspiration as optional contextual sources", () => {
    renderWorkspace()

    const sources = screen.getByRole("region", { name: "Creative sources" })
    expect(within(sources).getByRole("button", { name: "Add audio reference" })).toBeInTheDocument()
    expect(within(sources).getByRole("button", { name: "Choose voice profile" })).toBeInTheDocument()
    expect(within(sources).getByRole("button", { name: "Choose inspiration" })).toBeInTheDocument()
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
        <MoriWorkspace api={api} />
      </MoriAppProvider>,
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Song idea" }), { target: { value: "A quiet piano song for the first train home." } })
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    expect(screen.getByRole("region", { name: "Song plan preview" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Song plan preview" })).getByText("A quiet piano song for the first train home.")).toBeInTheDocument()
    expect(createGeneration).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Create from this plan" })).toBeInTheDocument()

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
    expect(screen.getByLabelText("Lyrics or instrumental")).toHaveValue("instrumental")
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
      expect(screen.getByLabelText("Lyrics or instrumental")).toHaveValue("instrumental")
      expect(screen.getByLabelText("Duration")).toHaveValue("240")
    } finally {
      window.localStorage.removeItem("mori.preferences.v1")
    }
  })

  it("turns creative shortcuts into visible draft actions", () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole("button", { name: "Start with lyrics" }))
    expect(screen.getByRole("tab", { name: /custom/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByLabelText("Lyrics or instrumental")).toHaveValue("lyrics")

    const referenceInput = screen.getByLabelText("Reference audio file")
    const openPicker = vi.spyOn(referenceInput, "click")
    fireEvent.click(screen.getByRole("button", { name: "Add audio reference" }))
    expect(openPicker).toHaveBeenCalledOnce()

    fireEvent.change(referenceInput, { target: { files: [new File([new Uint8Array(2048)], "night-drive.wav", { type: "audio/wav" })] } })
    expect(screen.getByRole("button", { name: "Replace reference audio night-drive.wav" })).toBeInTheDocument()
    expect(screen.getByText("2 KB · selected for this direction")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Start instrumental" }))
    expect(screen.getByLabelText("Lyrics or instrumental")).toHaveValue("instrumental")
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

  it("hydrates a reusable voice selected from Library", () => {
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

    expect(screen.getByRole("button", { name: "Change voice profile Mira" })).toBeInTheDocument()
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
        <MoriWorkspace api={api} />
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

  it("gives Create share feedback instead of leaving a dead action", () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    expect(screen.getByRole("button", { name: "Link copied" })).toBeInTheDocument()
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
        <MoriWorkspace api={api} />
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
        <MoriWorkspace api={api} />
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
        <MoriWorkspace api={api} />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    fireEvent.submit(screen.getByRole("textbox", { name: "Song idea" }).closest("form") as HTMLFormElement)

    await waitFor(() => expect(screen.getByText("No playable directions yet")).toBeInTheDocument())
    expect(screen.getByText("0 directions")).toBeInTheDocument()
  })
})
