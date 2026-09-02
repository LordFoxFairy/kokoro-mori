import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { MoriApi } from "@/lib/mori-api"
import { ProjectsPageContent } from "./project-list"

describe("Mori projects", () => {
  it("renders projects returned by the provider-neutral projection", async () => {
    const api: Pick<MoriApi, "listProjects"> = {
      listProjects: async () => ({
        data: {
          projects: [{
            project_ref: "project_live_1",
            title: "Window Seat",
            description: "A quiet, forward-moving sketch.",
            current_version_ref: null,
            candidate_count: 0,
            last_activity_at: "2026-09-02T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_projects_1" },
      }),
    }

    render(<ProjectsPageContent api={api} />)

    await waitFor(() => expect(screen.getByRole("heading", { name: "Window Seat" })).toBeInTheDocument())
    expect(screen.getByText("A quiet, forward-moving sketch.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Continue creating" })).toHaveAttribute("href", "/projects/project_live_1")
  })
})
