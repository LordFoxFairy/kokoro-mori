import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriApi } from "@/lib/mori-api"
import { ProjectsPageContent } from "./project-list"

describe("Mori projects", () => {
  it("labels the preview when live projects are unavailable and retries the projection", async () => {
    const listProjects = vi.fn<MoriApi["listProjects"]>()
      .mockRejectedValueOnce(new Error("projects unavailable"))
      .mockResolvedValueOnce({
        data: {
          projects: [{
            project_ref: "project_recovered",
            title: "Recovered Project",
            description: "Loaded after retry.",
            current_version_ref: null,
            candidate_count: 0,
            last_activity_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_projects_recovered" },
      })

    render(<ProjectsPageContent api={{ listProjects }} />)

    expect(screen.getByText("Preview workspace")).toBeInTheDocument()
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }))

    await waitFor(() => expect(screen.getByRole("heading", { name: "Recovered Project" })).toBeInTheDocument())
    expect(screen.queryByText("Preview workspace")).not.toBeInTheDocument()
    expect(listProjects).toHaveBeenCalledTimes(2)
  })

  it("appends the next project page and deduplicates by project ref", async () => {
    const listProjects = vi.fn(async (options: { limit?: number; cursor?: string | null } = {}) => {
      if (options.cursor === "projects_cursor_2") {
        return {
          data: {
            projects: [
              {
                project_ref: "project_live_1",
                title: "Window Seat (duplicate)",
                description: "The duplicate should not be appended.",
                current_version_ref: null,
                candidate_count: 0,
                last_activity_at: "2026-09-02T12:00:00.000Z",
              },
              {
                project_ref: "project_live_2",
                title: "Second Light",
                description: "A second direction.",
                current_version_ref: null,
                candidate_count: 1,
                last_activity_at: "2026-09-03T12:00:00.000Z",
              },
            ],
            next_cursor: null,
          },
          meta: { request_id: "request_projects_2" },
        }
      }
      return {
        data: {
          projects: [{
            project_ref: "project_live_1",
            title: "Window Seat",
            description: "A quiet, forward-moving sketch.",
            current_version_ref: null,
            candidate_count: 0,
            last_activity_at: "2026-09-02T12:00:00.000Z",
          }],
          next_cursor: "projects_cursor_2",
        },
        meta: { request_id: "request_projects_1" },
      }
    })

    render(<ProjectsPageContent api={{ listProjects }} />)

    await screen.findByRole("heading", { name: "Window Seat" })
    fireEvent.click(screen.getByRole("button", { name: "Load more projects" }))

    await waitFor(() => expect(screen.getByRole("heading", { name: "Second Light" })).toBeInTheDocument())
    expect(listProjects).toHaveBeenNthCalledWith(1, { limit: 20 })
    expect(listProjects).toHaveBeenNthCalledWith(2, { limit: 20, cursor: "projects_cursor_2" })
    expect(screen.getAllByRole("heading", { name: "Window Seat" })).toHaveLength(1)
    expect(screen.queryByRole("heading", { name: "Window Seat (duplicate)" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Load more projects" })).not.toBeInTheDocument()
  })

  it("does not show the load more entry when there is no next cursor", async () => {
    const api: Pick<MoriApi, "listProjects"> = {
      listProjects: async () => ({
        data: {
          projects: [],
          next_cursor: null,
        },
        meta: { request_id: "request_projects_without_cursor" },
      }),
    }

    render(<ProjectsPageContent api={api} />)

    await waitFor(() => expect(screen.getByText("No projects yet")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: "Load more projects" })).not.toBeInTheDocument()
  })

  it("keeps the cursor after a page failure and retries the request", async () => {
    let nextPageAttempts = 0
    const listProjects = vi.fn(async (options: { limit?: number; cursor?: string | null } = {}) => {
      if (options.cursor === "projects_cursor_retry") {
        nextPageAttempts += 1
        if (nextPageAttempts === 1) throw new Error("temporary project page failure")
        return {
          data: {
            projects: [{
              project_ref: "project_live_retry",
              title: "Retry Result",
              description: "Loaded after retry.",
              current_version_ref: null,
              candidate_count: 0,
              last_activity_at: "2026-09-04T12:00:00.000Z",
            }],
            next_cursor: null,
          },
          meta: { request_id: "request_projects_retry_success" },
        }
      }
      return {
        data: {
          projects: [{
            project_ref: "project_live_initial",
            title: "Initial Project",
            description: "The first page.",
            current_version_ref: null,
            candidate_count: 0,
            last_activity_at: "2026-09-04T11:00:00.000Z",
          }],
          next_cursor: "projects_cursor_retry",
        },
        meta: { request_id: "request_projects_retry_initial" },
      }
    })

    render(<ProjectsPageContent api={{ listProjects }} />)

    await screen.findByRole("heading", { name: "Initial Project" })
    fireEvent.click(screen.getByRole("button", { name: "Load more projects" }))
    expect(await screen.findByText("The next page could not load.")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => expect(screen.getByRole("heading", { name: "Retry Result" })).toBeInTheDocument())
    expect(nextPageAttempts).toBe(2)
    expect(screen.queryByRole("button", { name: "Load more projects" })).not.toBeInTheDocument()
  })

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

    const heading = await screen.findByRole("heading", { name: "Window Seat" })
    expect(screen.getByText("A quiet, forward-moving sketch.")).toBeInTheDocument()
    const continuation = screen.getByRole("link", { name: "Create first direction for Window Seat" })
    expect(continuation).toHaveAttribute("href", "/create?project_ref=project_live_1")
    expect(within(continuation).getByRole("heading", { name: "Window Seat" })).toBe(heading)
    expect(screen.getAllByRole("button", { name: "New project" })).toHaveLength(1)
    expect(screen.queryByRole("button", { name: "Create another project" })).not.toBeInTheDocument()
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
