import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ArtworkGenerationInput, MoriApi, MoriExportInput, ReleaseDraftInput, StudioChangeGenerationInput } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"
import { MoriAppProvider } from "./components/mori-app-provider"
import { previewCandidates } from "./preview-data"
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
  function renderStudio(api?: Partial<Pick<MoriApi, "createExport" | "getExport" | "getProject" | "putCurrentVersion" | "listCandidates" | "createStudioChange" | "getGeneration" | "getGenerationEvents" | "cancelGeneration" | "createLyricsRevision" | "getLyricsRevision" | "getLyricsRevisionEvents" | "cancelLyricsRevision" | "createStemSeparation" | "getStemSeparation" | "getStemSeparationEvents" | "cancelStemSeparation" | "createArtworkGeneration" | "getArtworkGeneration" | "getArtworkGenerationEvents" | "cancelArtworkGeneration" | "getReleaseDraft" | "putReleaseDraft" | "createMixRevision">>) {
    return render(
      <MoriAppProvider>
        <StudioPageContent candidate={previewCandidates[0]} api={api} stemPlaybackFactory={createTestStemPlaybackController} />
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

  it("keeps the previous Current until the Use take command is confirmed", async () => {
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

    await waitFor(() => expect(within(secondTake).getByText("Current version")).toBeInTheDocument())
    expect(within(firstTake).getByRole("button", { name: "Use First Light as current" })).toBeInTheDocument()
    const history = screen.getByRole("complementary", { name: "Version history" })
    expect(within(history).getByRole("link", { name: /First Light · Afterglow, Current/u })).toHaveAttribute("aria-current", "page")
    expect(within(history).getByRole("link", { name: /^First Light, Draft/u })).not.toHaveAttribute("aria-current")
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

  it("links the Studio playhead to the global player and current timeline section", () => {
    renderStudio()

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
      intent: "restyle",
      scope: { type: "whole_version" },
      instruction: "Turn this into an acoustic live-room performance.",
      preserve: ["melody", "vocal_identity", "tempo"],
      reference_asset_refs: [],
      output_count: 4,
    }))
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
    fireEvent.click(within(aiChanges).getByText("Direction controls"))
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

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    let lyricPartner = screen.getByRole("region", { name: "Mori lyric partner" })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Chorus" }))
    fireEvent.change(within(lyricPartner).getByRole("textbox", { name: "Describe the lyric direction" }), {
      target: { value: "Bring the sunrise closer without changing the cadence." },
    })
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Review direction" }))
    fireEvent.click(within(lyricPartner).getByRole("button", { name: "Create 2 suggestions" }))
    await waitFor(() => expect(within(lyricPartner).getByRole("progressbar", { name: "Lyrics revision progress" })).toHaveAttribute("aria-valuenow", "54"))

    fireEvent.click(screen.getByRole("button", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))

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

  it("defaults to a focused isolate-part plan and makes its requested part explicit", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    expect(within(stemsEditor).getByRole("button", { name: "Isolate a part" })).toHaveAttribute("aria-pressed", "true")
    expect(within(stemsEditor).getByRole("combobox", { name: "Part to isolate" })).toHaveValue("vocals")
    expect(within(stemsEditor).queryByText("Lead vocal")).not.toBeInTheDocument()

    fireEvent.change(within(stemsEditor).getByRole("combobox", { name: "Part to isolate" }), { target: { value: "drums" } })
    fireEvent.click(within(stemsEditor).getByRole("checkbox", { name: "Export MIDI transcription" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))

    const plan = within(stemsEditor).getByRole("region", { name: "Stem separation plan" })
    expect(within(plan).getByText("Isolate a part")).toBeInTheDocument()
    expect(within(plan).getByText("Drums + remaining mix")).toBeInTheDocument()
    expect(within(plan).getByText("Drums")).toBeInTheDocument()
    expect(within(plan).getByText("MIDI included")).toBeInTheDocument()
    expect(within(plan).getByText("Current version stays untouched.")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Isolate drums" })).toBeInTheDocument()
  })

  it("requires a meaningful multi-target selection for custom stems", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Custom stems" }))

    const review = within(stemsEditor).getByRole("button", { name: "Review separation" })
    expect(review).toBeDisabled()
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Drums" }))
    expect(review).toBeDisabled()
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Bass" }))
    expect(review).toBeEnabled()
    expect(within(stemsEditor).getByText("2 of 10 selected")).toBeInTheDocument()

    fireEvent.click(review)
    const plan = within(stemsEditor).getByRole("region", { name: "Stem separation plan" })
    expect(within(plan).getByText("Custom stems")).toBeInTheDocument()
    expect(within(plan).getByText("Drums · Bass")).toBeInTheDocument()
    expect(within(plan).getByText("Up to 2 selected stems")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Separate 2 selected stems" })).toBeInTheDocument()
  })

  it("keeps Add vocals and Add instrumental as contextual Stems workflows", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
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
    fireEvent.click(within(layerComposer).getByRole("button", { name: "Review vocal layer" }))

    const plan = within(layerComposer).getByRole("region", { name: "Studio layer plan" })
    expect(within(plan).getByText("Add vocals")).toBeInTheDocument()
    expect(within(plan).getByText("Whole song")).toBeInTheDocument()
    expect(within(plan).getByText("Melody · Tempo · Structure")).toBeInTheDocument()
    expect(within(plan).getByText("2 alternatives · Take lanes")).toBeInTheDocument()
    expect(within(plan).getByText("Current version stays untouched.")).toBeInTheDocument()
    expect(within(plan).getByRole("button", { name: "Generate 2 takes" })).toBeInTheDocument()
  })

  it("preserves an unsubmitted layer draft while comparing Stems workflows", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
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

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
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
    expect(screen.getByRole("button", { name: "Arrangement" })).toHaveAttribute("aria-pressed", "true")
    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    expect(within(takeLanes).getByRole("article", { name: "Take 3: First Light · New Vocal" })).toBeInTheDocument()
    expect(within(within(takeLanes).getByRole("article", { name: "Take 1: First Light" })).getByText("Current version")).toBeInTheDocument()
  })

  it("keeps an active vocal layer reachable across Studio tools", async () => {
    let cancelledGenerationRef = ""
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
        return {
          data: { generation_ref: generationRef, status: "cancelled" },
          meta: { request_id: "request_vocal_layer_cancel" },
        }
      },
    })

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
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

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    fireEvent.click(screen.getByRole("button", { name: "Stems" }))

    stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    expect(within(stemsEditor).getByRole("button", { name: "Add vocals" })).toHaveAttribute("aria-pressed", "true")
    layerComposer = within(stemsEditor).getByRole("region", { name: "Add vocals workflow" })
    fireEvent.click(within(layerComposer).getByRole("button", { name: "Cancel layer" }))
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

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Auto split" }))
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
    await waitFor(() => expect(screen.getByRole("button", { name: "Export" })).toHaveAttribute("data-export-status", "failed"))
    releaseMixSave()
    expect(submittedMixInputs[0]).toMatchObject({
      source_stem_separation_ref: "stem_separation_ui_1",
      name: "Stem mix",
    })
    expect(submittedMixInputs[0]?.tracks[0]).toEqual({ stem_ref: "stem_ui_vocals", gain: 0.48, muted: true })
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

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    let stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Isolate vocals" }))
    await waitFor(() => expect(within(stemsEditor).getByRole("progressbar", { name: "Stem separation progress" })).toHaveAttribute("aria-valuenow", "47"))

    fireEvent.click(screen.getByRole("button", { name: "Lyrics" }))
    fireEvent.click(screen.getByRole("button", { name: "Stems" }))

    stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    const plan = within(stemsEditor).getByRole("region", { name: "Stem separation plan" })
    expect(within(plan).getByText("Isolate a part")).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    const stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Isolate vocals" }))
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

    fireEvent.click(screen.getByRole("button", { name: "Stems" }))
    let stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Review separation" }))
    fireEvent.click(within(stemsEditor).getByRole("button", { name: "Isolate vocals" }))
    expect(await within(stemsEditor).findByText("Version vocals")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Arrangement" }))
    fireEvent.click(screen.getByRole("button", { name: "Use First Light · Afterglow as current" }))
    await waitFor(() => expect(screen.getByRole("article", { name: "Take 2: First Light · Afterglow" })).toHaveTextContent("Current version"))
    fireEvent.click(screen.getByRole("button", { name: "Stems" }))

    stemsEditor = screen.getByRole("region", { name: "Stems editor" })
    await waitFor(() => expect(within(stemsEditor).getByRole("region", { name: "Stem separation setup" })).toBeInTheDocument())
    expect(within(stemsEditor).queryByText("Version vocals")).not.toBeInTheDocument()
  })

  it("uses the global player for studio preview and gives share feedback", () => {
    renderStudio()

    fireEvent.click(screen.getByRole("button", { name: "Preview" }))
    expect(within(screen.getByRole("region", { name: "Global player" })).getByRole("button", { name: "Pause" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Share" }))
    expect(screen.getByText("Link copied")).toBeInTheDocument()
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
    const takeLanes = screen.getByRole("region", { name: "Take lanes" })
    expect(within(takeLanes).getAllByRole("article")).toHaveLength(2)
    expect(within(within(takeLanes).getByRole("article", { name: "Take 1: First Light" })).getByText("Current version")).toBeInTheDocument()
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
    expect(within(screen.getByRole("region", { name: "Take lanes" })).getAllByRole("article")).toHaveLength(2)
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
    const exportButton = screen.getByRole("button", { name: "Export" })
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
    expect(within(history).getByRole("link", { name: "Window Seat, Draft, 2:20" })).toHaveAttribute("aria-current", "page")
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
