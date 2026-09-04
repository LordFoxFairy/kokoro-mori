import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { ProjectWorkspaceSaveRun } from "../project-workspace-memory"
import {
  StudioLyricsEditor,
  type StudioLyricsRunState,
} from "./studio-lyrics-editor"

const idleRun: StudioLyricsRunState = {
  status: "idle",
  progress: 0,
  plan: null,
  suggestions: [],
  sourceDigest: null,
  message: null,
}

const savingDraftRun: ProjectWorkspaceSaveRun = {
  status: "saving",
  command: {
    kind: "lyrics_draft",
    projectRef: "project_first_light",
    versionRef: "version_first_light_a",
    input: { text: "Saved words", expected_revision: 4 },
    idempotencyKey: "lyrics-save-1",
  },
  message: null,
  retryable: false,
}

const savedDraftRun: ProjectWorkspaceSaveRun = {
  status: "saved",
  command: null,
  message: null,
  retryable: false,
}

describe("StudioLyricsEditor workspace states", () => {
  it("keeps a ready Version with no persisted lyric revision visibly new", () => {
    renderEditor({
      initialLyrics: "",
      baselineLyrics: "",
      draftSource: "workspace",
      draftRevision: null,
      canSaveDraft: true,
    })

    const editor = screen.getByRole("region", { name: "Lyrics editor" })
    const lyrics = within(editor).getByRole("textbox", { name: "Lyrics draft" })
    expect(within(editor).getAllByText("New draft")).toHaveLength(2)
    expect(
      within(editor).getByText(
        "No lyrics draft has been saved for this Version yet.",
      ),
    ).toBeInTheDocument()

    fireEvent.change(lyrics, { target: { value: "A new chorus begins here." } })
    expect(within(editor).getByText("Unsaved changes")).toBeInTheDocument()
    expect(
      within(editor).getByRole("button", { name: "Save draft" }),
    ).toBeEnabled()
  })

  it("locks the lyric text while the exact owner-confirmed save is in flight", () => {
    renderEditor({
      initialLyrics: "Saved words",
      baselineLyrics: "Saved words",
      draftSource: "workspace",
      draftRevision: 4,
      draftSaveRun: savingDraftRun,
      canSaveDraft: true,
    })

    const lyrics = screen.getByRole("textbox", { name: "Lyrics draft" })
    expect(lyrics).toHaveAttribute("aria-busy", "true")
    expect(lyrics).toHaveAttribute("readonly")
    fireEvent.change(lyrics, {
      target: { value: "This must not replace the pending save." },
    })
    expect(lyrics).toHaveValue("Saved words")
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled()
  })

  it("lets a fresh edit supersede an older saved indication", () => {
    const onSaveDraft = vi.fn()
    renderEditor({
      initialLyrics: "Saved words",
      baselineLyrics: "Saved words",
      draftSource: "workspace",
      draftRevision: 5,
      draftSaveRun: savedDraftRun,
      canSaveDraft: true,
      onSaveDraft,
    })

    fireEvent.change(screen.getByRole("textbox", { name: "Lyrics draft" }), {
      target: { value: "A later unsaved line." },
    })
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    const save = screen.getByRole("button", { name: "Save draft" })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    expect(onSaveDraft).toHaveBeenCalledWith("A later unsaved line.")
  })

  it("offers an explicit workspace retry when the initial projection is unavailable", () => {
    const onRefreshDraft = vi.fn()
    renderEditor({
      initialLyrics: "",
      baselineLyrics: "",
      draftSource: "unavailable",
      onRefreshDraft,
    })

    fireEvent.click(screen.getByRole("button", { name: "Retry workspace" }))
    expect(onRefreshDraft).toHaveBeenCalledOnce()
  })
})

function renderEditor(
  overrides: Partial<React.ComponentProps<typeof StudioLyricsEditor>> = {},
) {
  return render(
    <StudioLyricsEditor
      versionRef="version_first_light_a"
      run={idleRun}
      onGenerate={() => undefined}
      onCancel={() => undefined}
      onReset={() => undefined}
      {...overrides}
    />,
  )
}
