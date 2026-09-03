import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { MoriApi, StudioChangeGenerationInput } from "@/lib/mori-api"
import { MoriAppProvider } from "./components/mori-app-provider"
import { previewCandidates } from "./preview-data"
import { StudioPageContent } from "./studio-page"

describe("Mori studio page", () => {
  function renderStudio(api?: Partial<Pick<MoriApi, "createExport" | "getExport" | "getProject" | "listCandidates" | "createStudioChange" | "getGeneration" | "getGenerationEvents" | "cancelGeneration">>) {
    return render(
      <MoriAppProvider>
        <StudioPageContent candidate={previewCandidates[0]} api={api} />
      </MoriAppProvider>,
    )
  }

  it("switches between arrangement, lyrics, and stems tools", () => {
    renderStudio()

    expect(screen.getByRole("button", { name: "Arrangement" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    expect(screen.getByRole("button", { name: "Lyrics" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Lyrics editor" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    expect(screen.getByRole("button", { name: "Stems" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Stems editor" })).toBeInTheDocument()
  })

  it("shows take lanes and lets a user make a direction current", () => {
    renderStudio()

    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    const firstTake = within(takeLanes).getByRole("article", { name: "Take 1: First Light" })
    const secondTake = within(takeLanes).getByRole("article", { name: "Take 2: First Light · Afterglow" })

    expect(within(firstTake).getByText("Current version")).toBeInTheDocument()
    fireEvent.click(within(secondTake).getByRole("button", { name: "Use First Light · Afterglow as current" }))

    expect(within(secondTake).getByText("Current version")).toBeInTheDocument()
    expect(within(firstTake).getByRole("button", { name: "Use First Light as current" })).toBeInTheDocument()
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

  it("lets the user control Transform scope, preserved anchors, and alternative count", async () => {
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
    fireEvent.click(within(aiChanges).getByText("Direction controls"))

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
      scope: { type: "whole_version" },
      instruction: "Turn this into an acoustic live-room performance.",
      preserve: ["melody", "vocal_identity", "tempo"],
      reference_asset_refs: [],
      output_count: 4,
    }))
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

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    fireEvent.click(screen.getByRole("button", { name: "Arrangement" }))

    arrangement = screen.getByRole("region", { name: "Arrangement editor" })
    aiChanges = within(arrangement).getByRole("region", { name: "Mori AI changes" })
    expect(within(arrangement).getByRole("button", { name: "Select Verse section" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByRole("button", { name: "Replace section" })).toHaveAttribute("aria-pressed", "true")
    expect(within(aiChanges).getByRole("textbox", { name: "Tell Mori what to change" })).toHaveValue("Give this verse more space.")
    expect(within(aiChanges).getByRole("button", { name: "Cancel change" })).toBeInTheDocument()
  })

  it("stages and explicitly applies a section-aware Mori lyric suggestion", () => {
    localStorage.clear()
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
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

    fireEvent.click(within(plan).getByRole("button", { name: "Create suggestion" }))
    const suggestion = within(lyricPartner).getByRole("region", { name: "Lyric suggestion" })
    const suggestedLyrics = within(suggestion).getByRole("textbox", { name: "Suggested lyrics" })
    expect(suggestedLyrics).not.toHaveValue("")
    expect(draft).toHaveValue(originalDraft)

    fireEvent.change(suggestedLyrics, {
      target: { value: "We hold the morning in our hands.\nAnd let the open daylight land." },
    })
    fireEvent.click(within(suggestion).getByRole("button", { name: "Apply to draft" }))

    expect((draft as HTMLTextAreaElement).value).toContain("We hold the morning in our hands.")
    expect(within(lyricsEditor).getByText("Unsaved changes")).toBeInTheDocument()
    fireEvent.click(within(lyricsEditor).getByRole("button", { name: "Undo AI edit" }))
    expect(draft).toHaveValue(originalDraft)
    localStorage.clear()
  })

  it("keeps lyrics editable with an explicit local save state", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    const lyricsEditor = screen.getByRole("region", { name: "Lyrics editor" })
    const lyrics = within(lyricsEditor).getByRole("textbox", { name: "Lyrics draft" })

    fireEvent.change(lyrics, { target: { value: "A new line for the morning." } })
    fireEvent.click(within(lyricsEditor).getByRole("button", { name: "Save draft" }))

    expect(within(lyricsEditor).getByText("Saved locally")).toBeInTheDocument()
    expect(lyrics).toHaveValue("A new line for the morning.")
  })

  it("restores a saved lyric draft for the same version", () => {
    localStorage.clear()
    const firstRender = renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    const lyricsEditor = screen.getByRole("region", { name: "Lyrics editor" })
    const lyrics = within(lyricsEditor).getByRole("textbox", { name: "Lyrics draft" })
    fireEvent.change(lyrics, { target: { value: "A saved line for the next take." } })
    fireEvent.click(within(lyricsEditor).getByRole("button", { name: "Save draft" }))

    firstRender.unmount()
    renderStudio()
    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))

    expect(screen.getByRole("textbox", { name: "Lyrics draft" })).toHaveValue("A saved line for the next take.")
    localStorage.clear()
  })

  it("provides explicit mute controls for the stem preview", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    const muteLead = within(stemsEditor).getByRole("button", { name: "Mute Lead vocal" })

    fireEvent.click(muteLead)

    expect(within(stemsEditor).getByRole("button", { name: "Unmute Lead vocal" })).toHaveAttribute("aria-pressed", "true")
  })

  it("uses the global player for studio preview and gives share feedback", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    expect(within(screen.getByRole("region", { name: "Global player" })).getByRole("button", { name: "Pause" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    expect(screen.getByText("Link copied")).toBeInTheDocument()
  })

  it("queues an mp3 export from the studio", async () => {
    let exportedVersion = ""
    renderStudio({
      createExport: async (versionRef) => {
        exportedVersion = versionRef
        return { data: { export_ref: "export_1", status: "queued" }, meta: { request_id: "request_export_1" } }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))

    expect(exportedVersion).toBe("version_preview_first_light_a")
    expect(await screen.findByText("Export queued")).toBeInTheDocument()
  })

  it("turns a completed export into a download action", async () => {
    renderStudio({
      createExport: async () => ({ data: { export_ref: "export_1", status: "queued" }, meta: { request_id: "request_export_1" } }),
      getExport: async () => ({
        data: {
          export_ref: "export_1",
          project_ref: "project_preview_first_light",
          version_ref: "version_preview_first_light_a",
          format: "mp3",
          status: "succeeded",
          download_url: "https://download.kokoro.invalid/export_1.mp3",
          created_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_export_2" },
      }),
    })

    fireEvent.click(screen.getByRole("button", { name: "Export" }))

    const download = await screen.findByRole("link", { name: "Download MP3" })
    expect(download).toHaveAttribute("href", "https://download.kokoro.invalid/export_1.mp3")
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
    expect(screen.getByText("This version is not available yet")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "First Light" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Project" })).toHaveAttribute("href", "/projects/project_live_2")
    expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/projects/project_live_2")
  })
})
