import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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
    expect(screen.getByRole("link", { name: "Create first direction for Window Seat" })).toHaveAttribute("href", "/create?project_ref=project_live_1")
  })

  it("continues each Project from the next meaningful step", async () => {
    const api: Pick<MoriApi, "listProjects"> = {
      listProjects: async () => ({
        data: {
          projects: [
            {
              project_ref: "project_current",
              title: "First Light",
              description: "A current song.",
              current_version_ref: "version_current",
              candidate_count: 2,
              last_activity_at: "2026-09-04T12:00:00.000Z",
            },
            {
              project_ref: "project_review",
              title: "Blue Hour",
              description: "Directions waiting for a decision.",
              current_version_ref: null,
              candidate_count: 2,
              last_activity_at: "2026-09-04T11:00:00.000Z",
            },
            {
              project_ref: "project_empty",
              title: "Glasshouse",
              description: "An empty Project.",
              current_version_ref: null,
              candidate_count: 0,
              last_activity_at: "2026-09-04T10:00:00.000Z",
            },
          ],
          next_cursor: null,
        },
        meta: { request_id: "request_project_continuations" },
      }),
    }

    render(<ProjectsPageContent api={api} />)

    await waitFor(() => expect(screen.getByRole("heading", { name: "Glasshouse" })).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "Continue First Light in Studio" })).toHaveAttribute(
      "href",
      "/projects/project_current/studio/version_current",
    )
    expect(screen.getByRole("link", { name: "Review directions for Blue Hour" })).toHaveAttribute(
      "href",
      "/projects/project_review",
    )
    expect(screen.getByText("Awaiting choice")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Create first direction for Glasshouse" })).toHaveAttribute(
      "href",
      "/create?project_ref=project_empty",
    )
  })

  it("shows an empty state when the projection has no projects", async () => {
    const api: Pick<MoriApi, "listProjects"> = {
      listProjects: async () => ({
        data: { projects: [], next_cursor: null },
        meta: { request_id: "request_projects_empty" },
      }),
    }

    render(<ProjectsPageContent api={api} />)

    await waitFor(() => expect(screen.getByText("No projects yet")).toBeInTheDocument())
    expect(screen.queryByRole("heading", { name: "First Light" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Start a project" }))
    expect(screen.getByRole("dialog", { name: "Start a new project" })).toBeInTheDocument()
  })

  it("creates a project from the catalog without misrouting into the preview project", async () => {
    const createProject = vi.fn<MoriApi["createProject"]>(async (input) => ({
      data: {
        project_ref: "project_live_1",
        title: input.title,
        description: input.description,
        current_version_ref: null,
        candidate_count: 0,
        last_activity_at: "2026-09-02T12:00:00.000Z",
      },
      meta: { request_id: "request_project_create_1" },
    }))

    render(<ProjectsPageContent api={{ listProjects: async () => ({ data: { projects: [], next_cursor: null }, meta: { request_id: "request_projects_empty" } }), createProject }} />)

    fireEvent.click(screen.getByRole("button", { name: "New project" }))
    expect(screen.getByRole("dialog", { name: "Start a new project" })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.change(screen.getByRole("textbox", { name: "Project name" }), { target: { value: "Window Seat" } })
    fireEvent.change(screen.getByRole("textbox", { name: /description/i }), { target: { value: "A quiet, forward-moving sketch." } })
    fireEvent.click(screen.getByRole("button", { name: "Create project" }))

    await waitFor(() => expect(createProject).toHaveBeenCalledWith(
      { title: "Window Seat", description: "A quiet, forward-moving sketch." },
      expect.stringMatching(/^mori-project-/u),
    ))
    expect(await screen.findByText("Project created")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Start the first direction for Window Seat" })).toHaveAttribute("href", "/create?project_ref=project_live_1")
    fireEvent.click(screen.getByRole("button", { name: "Keep browsing" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe("")
  })
})
