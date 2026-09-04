import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { StudioChangePlan, StudioTimelineSection } from "../studio-change"
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

  it("reveals clear Restyle and Cover intents only inside Transform", () => {
    renderComposer()

    expect(screen.queryByRole("group", { name: "Transform intent" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Transform" }))

    const intents = screen.getByRole("group", { name: "Transform intent" })
    expect(within(intents).getByRole("button", { name: "Restyle" })).toHaveAttribute("aria-pressed", "true")
    expect(within(intents).getByText("Change genre, texture, or performance while choosing what stays.")).toBeInTheDocument()
    expect(within(intents).getByRole("button", { name: "Cover" })).toHaveAttribute("aria-pressed", "false")
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
