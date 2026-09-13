import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { StudioChangePlan, StudioTimelineSection } from "../studio-change"
import type { MoriCreativeLibrarySource } from "../creative-assets"
import { StudioAiComposer, type StudioAiRunState } from "./studio-ai-composer"

const verse: StudioTimelineSection = {
  id: "verse-2",
  label: "Verse",
  startMs: 42_000,
  endMs: 96_000,
  weight: 1,
}

const idleRun: StudioAiRunState = {
  status: "idle",
  progress: 0,
  resultCount: 0,
  plan: null,
  message: null,
}

function renderComposer(onGenerate = vi.fn<(plan: StudioChangePlan) => void>()) {
  render(
    <StudioAiComposer
      selectedSection={verse}
      run={idleRun}
      onGenerate={onGenerate}
      onCancel={vi.fn()}
      onReset={vi.fn()}
    />,
  )
  return onGenerate
}

describe("Studio AI composer", () => {
  it("explains what each AI task does before the user writes an instruction", () => {
    renderComposer()

    expect(screen.getByText("Add a new layer after the selected section.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Transform" }))
    expect(screen.getByText("Change the expression while preserving the parts you choose.")).toBeInTheDocument()
  })

  it("shows clip context without silently changing the AI scope", () => {
    render(
      <StudioAiComposer
        selectedSection={verse}
        run={idleRun}
        selectedClipContext={{ trackName: "Lead vocal", label: "Afterglow take", startMs: 12_000, durationMs: 8_000 }}
        initialOperation="transform"
        onGenerate={vi.fn()}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    const context = screen.getByRole("region", { name: "Clip edit context" })
    expect(context).toHaveTextContent("Lead vocal · Afterglow take · 0:12–0:20")
    expect(context).toHaveTextContent("Clip selection does not change AI scope")
    expect(screen.getByRole("group", { name: "Change context" })).toHaveTextContent("Selected section · Verse")
  })

  it("keeps the compact command bar focused while leaving advanced controls available", () => {
    render(
      <StudioAiComposer
        selectedSection={verse}
        run={idleRun}
        compact
        initialOperation="transform"
        onGenerate={vi.fn()}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    const composer = screen.getByRole("region", { name: "Mori AI changes" })
    expect(composer).toHaveAttribute("data-ai-layout", "contextual")
    expect(within(composer).getByRole("group", { name: "Change type" })).toBeInTheDocument()
    expect(within(composer).getByRole("group", { name: "Change context" })).toHaveTextContent("Selected section · Verse")
    expect(within(composer).getByRole("textbox", { name: "Tell Mori what to change" })).toBeInTheDocument()
    const moreControls = within(composer).getByText("More controls").closest("summary")
    expect(moreControls).toBeInTheDocument()
    expect(moreControls?.parentElement).not.toHaveAttribute("open")

    fireEvent.click(moreControls as HTMLElement)
    expect(moreControls?.parentElement).toHaveAttribute("open")
    expect(within(composer).getByRole("group", { name: "Transform intent" })).toBeInTheDocument()
    expect(within(composer).getByRole("button", { name: "Restyle" })).toHaveAttribute("aria-pressed", "true")
  })

  it("offers operation-aware prompt starters without skipping plan review", () => {
    const onGenerate = renderComposer()

    const addStarters = screen.getByRole("group", { name: "Prompt starters" })
    expect(within(addStarters).getByRole("button", { name: "Add a restrained string lift" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Extend" }))
    const extendStarter = screen.getByRole("button", { name: "Continue into a gentle outro" })
    fireEvent.click(extendStarter)

    expect(screen.getByRole("textbox", { name: "Tell Mori what to change" })).toHaveValue("Continue into a gentle outro")
    expect(screen.getByRole("textbox", { name: "Tell Mori what to change" })).toHaveFocus()
    expect(screen.queryByRole("region", { name: "AI change plan" })).not.toBeInTheDocument()
    expect(onGenerate).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Review change" })).toBeEnabled()
  })

  it("clears an operation-specific instruction when the user switches the task", () => {
    renderComposer()

    fireEvent.click(screen.getByRole("button", { name: "Add a restrained string lift" }))
    expect(screen.getByRole("textbox", { name: "Tell Mori what to change" })).toHaveValue("Add a restrained string lift")

    fireEvent.click(screen.getByRole("button", { name: "Transform" }))

    expect(screen.getByRole("textbox", { name: "Tell Mori what to change" })).toHaveValue("")
  })

  it("reveals clear Restyle and Cover intents only inside Transform", () => {
    renderComposer()

    expect(screen.queryByRole("group", { name: "Transform intent" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Transform" }))

    const intents = screen.getByRole("group", { name: "Transform intent" })
    expect(within(intents).getByRole("button", { name: "Restyle" })).toHaveAttribute("aria-pressed", "true")
    expect(within(intents).getByText("Change genre, texture, or performance while choosing what stays.")).toBeInTheDocument()
    expect(within(intents).getByRole("button", { name: "Cover" })).toHaveAttribute("aria-pressed", "false")
  })

  it("lets Restyle use an audio reference without exposing it to Cover", () => {
    const onGenerate = renderComposer()
    fireEvent.click(screen.getByRole("button", { name: "Transform" }))
    expect(screen.getByRole("button", { name: "Use City Lights demo as reference" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Keep & compare"))

    const reference = screen.getByRole("button", { name: "Use City Lights demo as reference" })
    expect(reference).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(reference)
    expect(reference).toHaveAttribute("aria-pressed", "true")

    fireEvent.change(screen.getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Match the soft pulse of the reference." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review change" }))

    const plan = screen.getByRole("region", { name: "AI change plan" })
    expect(within(plan).getByText("City Lights demo · 24 sec · soft city pulse")).toBeInTheDocument()
    fireEvent.click(within(plan).getByRole("button", { name: "Generate 2 takes" }))
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      draft: expect.objectContaining({ referenceAssetRefs: ["asset_preview_city_lights"] }),
    }))

    fireEvent.click(screen.getByRole("button", { name: "Cover" }))
    expect(screen.queryByRole("button", { name: "Use City Lights demo as reference" })).not.toBeInTheDocument()
  })

  it("uses the injected Creative Source catalog for references and voices", () => {
    const sources: readonly MoriCreativeLibrarySource[] = [
      { sourceKind: "audio", ref: "source_live_room", assetRef: "asset_live_room", name: "Live room guide", description: "18 sec · brushed pulse", durationSeconds: 18 },
      { sourceKind: "voice", ref: "voice_live_aria", name: "Aria", description: "Clear mezzo · close phrasing" },
    ]
    const onGenerate = vi.fn<(plan: StudioChangePlan) => void>()
    render(
      <StudioAiComposer
        selectedSection={verse}
        run={idleRun}
        creativeSources={sources}
        onGenerate={onGenerate}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Transform" }))
    fireEvent.click(screen.getByText("Keep & compare"))
    expect(screen.getByRole("button", { name: "Use Live room guide as reference" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Use City Lights demo as reference" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Use Live room guide as reference" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Tell Mori what to change" }), { target: { value: "Match the live room pulse." } })
    fireEvent.click(screen.getByRole("button", { name: "Review change" }))
    fireEvent.click(within(screen.getByRole("region", { name: "AI change plan" })).getByRole("button", { name: "Generate 2 takes" }))
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      draft: expect.objectContaining({ referenceAssetRefs: ["asset_live_room"] }),
    }))

    fireEvent.click(screen.getByRole("button", { name: "Cover" }))
    fireEvent.change(screen.getByRole("combobox", { name: "Voice profile" }), { target: { value: "voice_live_aria" } })
    fireEvent.change(screen.getByRole("textbox", { name: "Tell Mori what to change" }), { target: { value: "Re-perform this with a close live vocal." } })
    fireEvent.click(screen.getByRole("button", { name: "Review change" }))

    const plan = screen.getByRole("region", { name: "AI change plan" })
    expect(within(plan).getByText("Aria · Clear mezzo · close phrasing")).toBeInTheDocument()
  })

  it("keeps unavailable live sources out of Transform and Cover", () => {
    render(
      <StudioAiComposer
        selectedSection={verse}
        run={idleRun}
        creativeSources={[]}
        creativeSourceStatus="unavailable"
        onGenerate={vi.fn()}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Transform" }))
    expect(screen.getByText("No audio references available yet.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cover" }))

    const voice = screen.getByRole("combobox", { name: "Voice profile" })
    expect(voice).toBeInTheDocument()
    expect(within(voice).queryByText(/Mira/u)).not.toBeInTheDocument()
    expect(voice).toHaveValue("")
  })

  it("reviews a Vocal Cover from the open Version and sends a protected two-Take plan", () => {
    const onGenerate = renderComposer()
    fireEvent.click(screen.getByRole("button", { name: "Transform" }))
    fireEvent.click(screen.getByRole("button", { name: "Cover" }))

    expect(screen.getByText("Audio cover, not release artwork.")).toBeInTheDocument()
    expect(screen.getByText("Uses the open Version · no re-upload")).toBeInTheDocument()
    const mode = screen.getByRole("group", { name: "Cover mode" })
    expect(within(mode).getByRole("button", { name: "Vocal cover" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("combobox", { name: "Voice profile" })).toBeInTheDocument()
    fireEvent.change(screen.getByRole("combobox", { name: "Voice profile" }), { target: { value: "voice_preview_mira" } })
    fireEvent.change(screen.getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Re-perform this as a close acoustic duet." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review change" }))

    const plan = screen.getByRole("region", { name: "AI change plan" })
    expect(within(plan).getByText("Cover")).toBeInTheDocument()
    expect(within(plan).getByText("Whole song · open Version")).toBeInTheDocument()
    expect(within(plan).getByText("Vocal")).toBeInTheDocument()
    expect(within(plan).getByText("Mira · Warm alto · intimate phrasing")).toBeInTheDocument()
    expect(within(plan).getByText("Melody · Lyrics · Structure")).toBeInTheDocument()
    expect(within(plan).getByText("2 alternatives · Take lanes")).toBeInTheDocument()

    fireEvent.click(within(plan).getByRole("button", { name: "Generate 2 takes" }))
    expect(onGenerate).toHaveBeenCalledWith(expect.objectContaining({
      operation: "transform",
      preserve: ["melody", "lyrics", "structure"],
      outputCount: 2,
      draft: {
        operation: "transform",
        intent: "cover",
        scope: { type: "whole_version" },
        coverMode: "vocal",
        voiceRef: "voice_preview_mira",
        instruction: "Re-perform this as a close acoustic duet.",
        preserve: ["melody", "lyrics", "structure"],
        referenceAssetRefs: [],
        outputCount: 2,
      },
    }))
  })

  it("switches to Instrumental Cover without exposing a stale Voice and invalidates review changes", () => {
    renderComposer()
    fireEvent.click(screen.getByRole("button", { name: "Transform" }))
    fireEvent.click(screen.getByRole("button", { name: "Cover" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Tell Mori what to change" }), {
      target: { value: "Reframe this around felt piano and chamber strings." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review change" }))
    expect(screen.getByRole("region", { name: "AI change plan" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Instrumental cover" }))
    expect(screen.queryByRole("combobox", { name: "Voice profile" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "AI change plan" })).not.toBeInTheDocument()
    expect(screen.getByText("Melody · Structure stay fixed")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Restyle" }))
    expect(screen.queryByText("Audio cover, not release artwork.")).not.toBeInTheDocument()
    expect(screen.getByText("Selected section · Verse")).toBeInTheDocument()
  })

  it("keeps a running Cover readable while disabling plan-changing controls", () => {
    const plan: StudioChangePlan = {
      operation: "transform",
      instruction: "Re-perform this as a close acoustic duet.",
      sectionId: verse.id,
      selection: verse,
      scopeLabel: "Whole song · open Version",
      preserve: ["melody", "lyrics", "structure"],
      outputCount: 2,
      draft: {
        operation: "transform",
        intent: "cover",
        scope: { type: "whole_version" },
        coverMode: "vocal",
        voiceRef: "voice_preview_mira",
        instruction: "Re-perform this as a close acoustic duet.",
        preserve: ["melody", "lyrics", "structure"],
        referenceAssetRefs: [],
        outputCount: 2,
      },
    }
    const onCancel = vi.fn()
    render(
      <StudioAiComposer
        selectedSection={verse}
        run={{ status: "generating", progress: 46, resultCount: 0, plan, message: null }}
        onGenerate={vi.fn()}
        onCancel={onCancel}
        onReset={vi.fn()}
      />,
    )

    expect(within(screen.getByRole("region", { name: "AI change plan" })).getByText("Cover")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Restyle" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Voice profile" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Cancel change" }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
