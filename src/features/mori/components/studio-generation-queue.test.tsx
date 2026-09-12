import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { emptyGenerationQueueState, type GenerationQueueItem } from "../generation-queue"
import { writeGenerationQueueState } from "../generation-queue-storage"
import { MoriCatalogShell } from "./mori-catalog-shell"
import { MoriAppProvider } from "./mori-app-provider"
import { StudioGenerationQueue } from "./studio-generation-queue"

function queueItem(overrides: Partial<GenerationQueueItem> = {}): GenerationQueueItem {
  return {
    generation_ref: "generation_queue_studio",
    project_ref: "project_queue_studio",
    source_version_ref: "version_queue_studio",
    kind: "studio_change",
    label: "Add part · Chorus",
    created_at: "2026-09-04T12:00:00.000Z",
    status: "generating",
    progress: 46,
    candidate_refs: [],
    last_event_id: null,
    ...overrides,
  }
}

describe("Studio generation queue", () => {
  it("shows project runs with the right destination", async () => {
    writeGenerationQueueState({
      ...emptyGenerationQueueState(),
      active_generation_ref: "generation_queue_studio",
      items: [
        queueItem(),
        queueItem({
          generation_ref: "generation_queue_create",
          source_version_ref: null,
          kind: "create",
          label: "Smart direction",
          status: "succeeded",
          progress: 100,
          candidate_refs: ["candidate_1", "candidate_2"],
          created_at: "2026-09-04T11:00:00.000Z",
        }),
        queueItem({ generation_ref: "generation_other_project", project_ref: "project_other" }),
      ],
    })

    render(<StudioGenerationQueue projectRef="project_queue_studio" activeVersionRef="version_queue_studio" />)
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))

    const queue = await screen.findByRole("dialog", { name: "Generation queue" })
    expect(queue).toHaveTextContent("2 runs")
    expect(queue).toHaveTextContent("Add part · Chorus")
    expect(queue).toHaveTextContent("Smart direction")
    expect(queue).not.toHaveTextContent("generation_other_project")
    expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute(
      "href",
      "/projects/project_queue_studio/studio/version_queue_studio?generation_ref=generation_queue_studio",
    )
    expect(screen.getByRole("link", { name: "Open Create" })).toHaveAttribute(
      "href",
      "/create?project_ref=project_queue_studio&generation_ref=generation_queue_create",
    )
  })

  it("refreshes when another Mori surface writes the shared queue", async () => {
    render(<StudioGenerationQueue projectRef="project_queue_studio" activeVersionRef={null} />)
    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))
    expect(await screen.findByText("No runs for this project yet")).toBeInTheDocument()

    writeGenerationQueueState({
      ...emptyGenerationQueueState(),
      active_generation_ref: "generation_queue_studio",
      items: [queueItem({ status: "succeeded", progress: 100, candidate_refs: ["candidate_1"] })],
    })

    await waitFor(() => expect(screen.getByText("Add part · Chorus")).toBeInTheDocument())
    expect(screen.getByText("1 run")).toBeInTheDocument()
  })

  it("closes on Escape and returns focus to the opener", async () => {
    render(<StudioGenerationQueue projectRef="project_queue_studio" activeVersionRef={null} />)
    const opener = screen.getByRole("button", { name: "Open generation queue" })
    fireEvent.click(opener)
    const queue = await screen.findByRole("dialog", { name: "Generation queue" })
    await waitFor(() => expect(queue).toHaveFocus())

    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Generation queue" })).not.toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Open generation queue" })).toHaveFocus()
  })

  it("mounts inside the application shell when hosted by Studio", async () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Studio">
          <StudioGenerationQueue projectRef="project_queue_studio" activeVersionRef="version_queue_studio" />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Open generation queue" }))

    const queue = await screen.findByRole("dialog", { name: "Generation queue" })
    expect(queue.closest('[data-mori-portal-host="true"]')).not.toBeNull()
  })
})
