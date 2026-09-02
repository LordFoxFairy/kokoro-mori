import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { MoriApi } from "@/lib/mori-api"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import { MoriWorkspace } from "./mori-workspace"

function renderWorkspace() {
  return render(
    <MoriAppProvider>
      <MoriWorkspace />
    </MoriAppProvider>,
  )
}

describe("Mori workspace", () => {
  it("starts in Smart Create mode without a permanent queue column", () => {
    renderWorkspace()
    expect(screen.getByRole("navigation", { name: "Mori" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /make something you can feel/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /smart/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("link", { name: "First Light" })).toHaveAttribute("href", "/projects/project_preview_first_light")
    expect(screen.queryByRole("region", { name: /generation queue/i })).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: /global player/i })).toBeInTheDocument()
  })

  it("reveals Custom controls without leaving Create", () => {
    renderWorkspace()
    fireEvent.click(screen.getByRole("tab", { name: /custom/i }))
    expect(screen.getByLabelText(/lyrics or instrumental/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/style/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reference audio/i })).toBeInTheDocument()
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
          project_ref: "project_preview_first_light",
          song_plan_ref: "song_plan_preview_first_light",
          mode: "smart" as const,
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

    fireEvent.click(screen.getByRole("button", { name: "Create from this plan" }))
    await waitFor(() => expect(createSongPlan).toHaveBeenCalledOnce())
    await waitFor(() => expect(createGeneration).toHaveBeenCalledOnce())
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

  it("turns creative shortcuts into visible draft actions", () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole("button", { name: "Start with lyrics" }))
    expect(screen.getByRole("tab", { name: /custom/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByLabelText("Lyrics or instrumental")).toHaveValue("lyrics")

    fireEvent.click(screen.getByRole("button", { name: "Add a reference" }))
    expect(screen.getByRole("button", { name: "Reference audio ready" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Browse moods" }))
    expect(screen.getByRole("listbox", { name: "Browse moods" })).toBeInTheDocument()
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
    expect(screen.queryByRole("region", { name: /generation queue/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /open generation queue/i }))

    expect(screen.getByRole("region", { name: /generation queue/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /close generation queue/i })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByRole("region", { name: /generation queue/i })).not.toBeInTheDocument()
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
          project_ref: "project_preview_first_light",
          song_plan_ref: "song_plan_preview_first_light",
          mode: "smart" as const,
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
})
