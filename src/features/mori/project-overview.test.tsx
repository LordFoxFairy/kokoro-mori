import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriApi } from "@/lib/mori-api"
import type { Candidate } from "./domain"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import type { PlayerMediaFactory } from "./player-media"
import { ProjectOverviewPageContent } from "./project-overview"
import { previewProject } from "./preview-data"

const activeListen: Candidate = {
  candidateRef: "candidate_active_listen",
  versionRef: "version_active_listen",
  generationRef: "generation_active_listen",
  title: "Still Playing",
  subtitle: "Global listen",
  durationSeconds: 180,
  mood: "Focused",
  waveformSeed: 41,
  isCurrent: true,
  audioAssetRef: "asset/active-listen",
}

const queuedListenB: Candidate = {
  ...activeListen,
  candidateRef: "candidate_queued_b",
  versionRef: "version_queued_b",
  title: "Queue B",
  isCurrent: false,
  audioAssetRef: "asset/queue-b",
}

const queuedListenC: Candidate = {
  ...activeListen,
  candidateRef: "candidate_queued_c",
  versionRef: "version_queued_c",
  title: "Queue C",
  isCurrent: false,
  audioAssetRef: "asset/queue-c",
}

describe("Mori project overview", () => {
  it("continues the confirmed Current Version through project-scoped AI intents", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview" projectRef={previewProject.projectRef}>
          <ProjectOverviewPageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    const workspace = screen.getByRole("group", { name: "Project workspace" })
    expect(within(workspace).getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Latest directions",
      "Continue making",
    ])
    const continuation = screen.getByRole("region", { name: "Continue making" })
    expect(within(continuation).getByRole("link", { name: "Remix & edit" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=arrangement&intent=transform",
    )
    expect(within(continuation).getByRole("link", { name: "Cover" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=arrangement&intent=cover",
    )
    expect(within(continuation).getByRole("link", { name: "Lyrics" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=lyrics",
    )
    expect(within(continuation).getByRole("link", { name: "Voice & stems" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=stems",
    )
    expect(within(continuation).getByRole("link", { name: "Remaster & release" })).toHaveAttribute(
      "href",
      "/projects/project_preview_first_light/studio/version_preview_first_light_a?surface=finish",
    )
    expect(screen.getAllByText("Warm · hopeful")).toHaveLength(1)
    const songPlan = screen.getByRole("region", { name: "Song plan" })
    expect(within(songPlan).getByText("Preview plan")).toBeInTheDocument()
    expect(within(songPlan).queryByText("Revision 1 · saved")).not.toBeInTheDocument()
  })

  it("shows playable controls when a preview candidate is selected", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Play First Light" }))

    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("First Light")
    expect(screen.getByRole("region", { name: "Global player" })).not.toHaveTextContent("Preview audio is unavailable")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("hydrates the requested project and its latest candidates", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_live_1",
          title: "Window Seat",
          description: "A quiet, forward-moving sketch.",
          current_version_ref: "version_live_1",
          candidate_count: 1,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_1" },
      }),
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
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview" projectRef="project_live_1">
          <ProjectOverviewPageContent projectRef="project_live_1" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Window Seat" })).toBeInTheDocument())
    expect(screen.getByText("A quiet, forward-moving sketch.")).toBeInTheDocument()
    const currentProjectLink = screen.getByRole("link", { name: "Open recent project Window Seat" })
    expect(currentProjectLink).toHaveTextContent("1 directions")
    expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute("href", "/projects/project_live_1/studio/version_live_1")
    expect(screen.queryByText("Warm · hopeful")).not.toBeInTheDocument()
    const songPlan = screen.getByRole("region", { name: "Song plan" })
    expect(within(songPlan).getByText("Plan details not available")).toBeInTheDocument()
    expect(within(songPlan).queryByText("102 BPM")).not.toBeInTheDocument()
  })

  it("does not present an unavailable Project as active and reconnects on retry", async () => {
    let projectAttempt = 0
    const getProject = vi.fn<MoriApi["getProject"]>(async () => {
      projectAttempt += 1
      if (projectAttempt === 1) throw new Error("project projection unavailable")
      return {
        data: {
          project_ref: "project_reconnect",
          title: "Window Seat",
          description: "A project that reconnects after a short outage.",
          current_version_ref: "version_reconnect",
          candidate_count: 1,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: `request_project_reconnect_${projectAttempt}` },
      }
    })
    const api = {
      getProject,
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_reconnect",
            generation_ref: "generation_reconnect",
            version_ref: "version_reconnect",
            project_ref: "project_reconnect",
            title: "Window Seat",
            duration_seconds: 140,
            audio_asset_ref: "asset_reconnect",
            waveform_asset_ref: "waveform_reconnect",
            style_tags: ["soft motion"],
            created_at: "2026-09-02T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_candidates_reconnect" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_reconnect" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(await screen.findByRole("alert", { name: "Project projection" })).toHaveTextContent("Project details unavailable")
    expect(screen.queryByText("Active project")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open Studio" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Set Window Seat as current" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Play Window Seat" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry project" }))

    await waitFor(() => expect(screen.getByRole("heading", { name: "Window Seat" })).toBeInTheDocument())
    expect(screen.getByText("Active project")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute(
      "href",
      "/projects/project_reconnect/studio/version_reconnect",
    )
    expect(getProject).toHaveBeenCalledTimes(2)
  })

  it("opens a generation-scoped review without leaking directions from another run", async () => {
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(async (requestedProjectRef, options) => {
      expect(requestedProjectRef).toBe("project_generation_review")
      expect(options).toEqual({ generation_ref: "generation_review_1" })
      return {
        data: {
        candidates: [
          {
            candidate_ref: "candidate_generation_review",
            generation_ref: "generation_review_1",
            version_ref: "version_generation_review",
            project_ref: "project_generation_review",
            title: "Window Seat · Review",
            duration_seconds: 140,
            audio_asset_ref: "asset_generation_review",
            waveform_asset_ref: "waveform_generation_review",
            style_tags: ["soft motion"],
            created_at: "2026-09-02T12:00:00.000Z",
          },
          {
            candidate_ref: "candidate_other_generation",
            generation_ref: "generation_other",
            version_ref: "version_other_generation",
            project_ref: "project_generation_review",
            title: "Should stay hidden",
            duration_seconds: 140,
            audio_asset_ref: "asset_other_generation",
            waveform_asset_ref: "waveform_other_generation",
            style_tags: ["other"],
            created_at: "2026-09-02T12:00:00.000Z",
          },
        ],
        next_cursor: null,
        },
        meta: { request_id: "request_generation_review_candidates" },
      }
    })
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_generation_review",
          title: "Window Seat",
          description: "A quiet, forward-moving sketch.",
          current_version_ref: null,
          candidate_count: 2,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_generation_review_project" },
      }),
      listCandidates,
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_generation_review" generationRef="generation_review_1" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(await screen.findByRole("heading", { name: "Review this generation" })).toBeInTheDocument()
    expect(listCandidates).toHaveBeenCalledWith("project_generation_review", { generation_ref: "generation_review_1" })
    expect(screen.getByRole("button", { name: "Play Window Seat · Review" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Play Should stay hidden" })).not.toBeInTheDocument()
    expect(screen.getByText("1 candidate")).toBeInTheDocument()

    const review = screen.getByLabelText("Review Window Seat · Review")
    fireEvent.click(within(review).getByRole("button", { name: "Like Window Seat · Review" }))
    expect(within(review).getByRole("button", { name: "Like Window Seat · Review" })).toHaveAttribute("aria-pressed", "true")
    expect(within(review).getByText("Saved for this session · does not change Current")).toBeInTheDocument()

    fireEvent.click(within(review).getByRole("button", { name: "Dislike Window Seat · Review" }))
    fireEvent.click(within(review).getByRole("button", { name: "Timing feels off" }))
    expect(within(review).getByRole("button", { name: "Timing feels off" })).toHaveAttribute("aria-pressed", "true")
  })

  it("keeps a finished generation in sync state when its directions arrive later", async () => {
    let attempt = 0
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(async (requestedProjectRef, options) => {
      expect(requestedProjectRef).toBe("project_generation_sync")
      expect(options).toEqual({ generation_ref: "generation_sync" })
      attempt += 1
      return {
        data: {
          candidates: attempt === 1 ? [] : [{
            candidate_ref: "candidate_generation_sync",
            generation_ref: "generation_sync",
            version_ref: "version_generation_sync",
            project_ref: "project_generation_sync",
            title: "Window Seat · Synced",
            duration_seconds: 142,
            audio_asset_ref: "asset_generation_sync",
            waveform_asset_ref: "waveform_generation_sync",
            style_tags: ["soft motion"],
            created_at: "2026-09-02T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: `request_generation_sync_${attempt}` },
      }
    })
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_generation_sync",
          title: "Window Seat",
          description: "A direction that is still arriving.",
          current_version_ref: null,
          candidate_count: 1,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_generation_sync_project" },
      }),
      listCandidates,
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_generation_sync" generationRef="generation_sync" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    expect(await screen.findByText("Directions are still syncing")).toBeInTheDocument()
    expect(screen.getByText("This generation finished, but its playable directions are still arriving.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry this generation" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Try another direction" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry this generation" }))

    expect(await screen.findByRole("button", { name: "Play Window Seat · Synced" })).toBeInTheDocument()
    expect(listCandidates).toHaveBeenCalledTimes(2)
    expect(listCandidates).toHaveBeenLastCalledWith("project_generation_sync", { generation_ref: "generation_sync" })
  })

  it("recognizes the playing Version across Candidate projections without restarting it", async () => {
    const media = createMediaHarness()
    const api: Pick<MoriApi, "getProject" | "listCandidates"> = {
      getProject: async () => ({
        data: {
          project_ref: "project_same_version",
          title: "Same Version",
          description: "A projection identity check.",
          current_version_ref: activeListen.versionRef,
          candidate_count: 1,
          last_activity_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_same_version_project" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_same_version_projection",
            generation_ref: "generation_same_version_projection",
            version_ref: activeListen.versionRef,
            project_ref: "project_same_version",
            title: "Projected same Version",
            duration_seconds: activeListen.durationSeconds,
            audio_asset_ref: "asset/active-listen",
            waveform_asset_ref: "waveform_same_version_projection",
            style_tags: ["projection"],
            created_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_same_version_candidates" },
      }),
    }

    render(
      <MoriAppProvider mediaFactory={media.factory}>
        <ActiveListenHarness />
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_same_version" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("button", { name: "Play Projected same Version" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Start active listen" }))

    const projectedControl = screen.getByRole("button", { name: "Pause Projected same Version" })
    fireEvent.click(projectedControl)
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: "Seek through current version" })).toHaveValue("40")
    expect(media.setSource).toHaveBeenLastCalledWith(activeListen)
  })

  it("continues from the confirmed Current Version instead of the first projected direction", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_live_current",
          title: "Window Seat",
          description: "Two directions with one confirmed Current.",
          current_version_ref: "version_live_b",
          candidate_count: 2,
          last_activity_at: "2026-09-04T10:00:00.000Z",
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
              title: "Window Seat · First draft",
              duration_seconds: 140,
              audio_asset_ref: "asset_live_a",
              waveform_asset_ref: "waveform_live_a",
              style_tags: ["quiet"],
              created_at: "2026-09-04T09:58:00.000Z",
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
              created_at: "2026-09-04T09:59:00.000Z",
            },
          ],
          next_cursor: null,
        },
        meta: { request_id: "request_candidates_current" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_live_current" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute(
      "href",
      "/projects/project_live_current/studio/version_live_b",
    ))
    expect(screen.getByRole("article", { name: "Window Seat · Wide, current version" })).toHaveTextContent("Current")
    expect(screen.getByRole("article", { name: "Window Seat · First draft" })).not.toHaveTextContent("Current")
  })

  it("shows an empty state when a project has no directions", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_empty_1",
          title: "Rain Room",
          description: "A small room of reflected light.",
          current_version_ref: null,
          candidate_count: 0,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_empty" },
      }),
      listCandidates: async () => ({
        data: { candidates: [], next_cursor: null },
        meta: { request_id: "request_candidates_empty" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_empty_1" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Rain Room" })).toBeInTheDocument())
    expect(screen.getByText("No directions yet")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Create a direction" })).toHaveAttribute("href", "/create?project_ref=project_empty_1")
    expect(screen.queryByRole("link", { name: "Open Studio" })).not.toBeInTheDocument()
  })

  it("preserves the active global listen when the requested project has no directions", async () => {
    const media = createMediaHarness()
    let resolveCandidates: ((value: Awaited<ReturnType<MoriApi["listCandidates"]>>) => void) | undefined
    const candidateRequest = new Promise<Awaited<ReturnType<MoriApi["listCandidates"]>>>((resolve) => { resolveCandidates = resolve })
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(() => candidateRequest)
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_empty_playback",
          title: "Rain Room",
          description: "A small room of reflected light.",
          current_version_ref: null,
          candidate_count: 0,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_empty_playback" },
      }),
      listCandidates,
    }

    render(
      <MoriAppProvider mediaFactory={media.factory}>
        <ActiveListenHarness />
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_empty_playback" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Start active listen" }))
    await waitFor(() => expect(listCandidates).toHaveBeenCalled())
    await act(async () => {
      resolveCandidates?.({
        data: { candidates: [], next_cursor: null },
        meta: { request_id: "request_candidates_empty_playback" },
      })
      await candidateRequest
    })

    await waitFor(() => expect(screen.getByRole("heading", { name: "Rain Room" })).toBeInTheDocument())
    const player = screen.getByRole("region", { name: "Global player" })
    expect(player).toHaveTextContent("Still Playing")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: "Seek through current version" })).toHaveValue("40")
    expect(media.setSource).toHaveBeenLastCalledWith(activeListen)
  })

  it("does not rewrite the listening queue when another Project projection loads", async () => {
    const media = createMediaHarness()
    let releaseProjection: (() => void) | undefined
    const projectionGate = new Promise<void>((resolve) => { releaseProjection = resolve })
    const api: Pick<MoriApi, "getProject" | "listCandidates"> = {
      getProject: async () => ({
        data: {
          project_ref: "project_projection_only",
          title: "Projection only",
          description: "Browsing must not change listening intent.",
          current_version_ref: null,
          candidate_count: 1,
          last_activity_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_projection_only" },
      }),
      listCandidates: async () => {
        await projectionGate
        return {
          data: {
            candidates: [{
              candidate_ref: "candidate_surface_d",
              generation_ref: "generation_surface_d",
              version_ref: "version_surface_d",
              project_ref: "project_projection_only",
              title: "Surface D",
              duration_seconds: 150,
              audio_asset_ref: "asset/surface-d",
              waveform_asset_ref: "waveform_surface_d",
              style_tags: ["surface"],
              created_at: "2026-09-04T12:00:00.000Z",
            }],
            next_cursor: null,
          },
          meta: { request_id: "request_surface_candidates" },
        }
      },
    }

    render(
      <MoriAppProvider mediaFactory={media.factory}>
        <ActiveQueueHarness />
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_projection_only" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Build active listening queue" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument())
    await act(async () => { releaseProjection?.() })
    await waitFor(() => expect(screen.getByRole("button", { name: "Play Surface D" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Open playback queue" }))

    expect(screen.getAllByRole("button", { name: /from queue$/u }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Pause Still Playing from queue",
      "Play Queue B from queue",
      "Play Queue C from queue",
    ])
    expect(screen.queryByRole("button", { name: "Play Surface D from queue" })).not.toBeInTheDocument()
  })

  it("does not guess a continuation Version when candidates exist without a confirmed Current", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_unconfirmed_1",
          title: "Loose Ends",
          description: "Promising directions waiting for a decision.",
          current_version_ref: null,
          candidate_count: 1,
          last_activity_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_project_unconfirmed" },
      }),
      listCandidates: async () => ({
        data: {
          candidates: [{
            candidate_ref: "candidate_unconfirmed_1",
            generation_ref: "generation_unconfirmed_1",
            version_ref: "version_unconfirmed_1",
            project_ref: "project_unconfirmed_1",
            title: "Loose Ends · Draft",
            duration_seconds: 156,
            audio_asset_ref: "asset_unconfirmed_1",
            waveform_asset_ref: "waveform_unconfirmed_1",
            style_tags: ["patient", "open"],
            created_at: "2026-09-04T11:59:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_candidates_unconfirmed" },
      }),
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_unconfirmed_1" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Loose Ends" })).toBeInTheDocument())
    expect(screen.queryByRole("region", { name: "Continue making" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open Studio" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open Studio for Loose Ends · Draft" })).toHaveAttribute(
      "href",
      "/projects/project_unconfirmed_1/studio/version_unconfirmed_1",
    )
  })

  it("separates an unavailable candidate projection from a genuinely empty Project and retries it", async () => {
    let attempt = 0
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(async () => {
      attempt += 1
      if (attempt === 1) throw new Error("candidate projection unavailable")
      return {
        data: {
          candidates: [{
            candidate_ref: "candidate_live_recovered",
            generation_ref: "generation_live_recovered",
            version_ref: "version_live_recovered",
            project_ref: "project_live_partial",
            title: "Blue Hour · Recovered",
            duration_seconds: 148,
            audio_asset_ref: "asset_live_recovered",
            waveform_asset_ref: "waveform_live_recovered",
            style_tags: ["restrained", "electronic"],
            created_at: "2026-09-04T12:00:00.000Z",
          }],
          next_cursor: null,
        },
        meta: { request_id: "request_project_partial_recovered" },
      }
    })
    const api: Pick<MoriApi, "getProject" | "listCandidates"> = {
      getProject: async () => ({
        data: {
          project_ref: "project_live_partial",
          title: "Blue Hour",
          description: "A restrained electronic study.",
          current_version_ref: null,
          candidate_count: 2,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_partial" },
      }),
      listCandidates,
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_live_partial" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Blue Hour" })).toBeInTheDocument())
    expect(screen.getByText("A restrained electronic study.")).toBeInTheDocument()
    expect(await screen.findByText("Directions temporarily unavailable")).toBeInTheDocument()
    expect(screen.getByText("2 saved")).toBeInTheDocument()
    expect(screen.queryByText("No directions yet")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Create a direction" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Open Studio" })).not.toBeInTheDocument()
    const player = screen.getByRole("region", { name: "Global player" })
    expect(player).toHaveTextContent("Choose a version")
    expect(player).toHaveTextContent("Your next listen starts here")

    fireEvent.click(screen.getByRole("button", { name: "Retry directions" }))

    expect(await screen.findByRole("button", { name: "Play Blue Hour · Recovered" })).toBeInTheDocument()
    expect(listCandidates).toHaveBeenCalledTimes(2)
  })

  it("preserves the active global listen when the candidate projection fails", async () => {
    const media = createMediaHarness()
    let rejectCandidates: ((reason: Error) => void) | undefined
    const candidateRequest = new Promise<Awaited<ReturnType<MoriApi["listCandidates"]>>>((_, reject) => { rejectCandidates = reject })
    const listCandidates = vi.fn<MoriApi["listCandidates"]>(() => candidateRequest)
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_failed_playback",
          title: "Blue Hour",
          description: "A restrained electronic study.",
          current_version_ref: null,
          candidate_count: 1,
          last_activity_at: "2026-09-02T12:00:00.000Z",
        },
        meta: { request_id: "request_project_failed_playback" },
      }),
      listCandidates,
    }

    render(
      <MoriAppProvider mediaFactory={media.factory}>
        <ActiveListenHarness />
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_failed_playback" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Start active listen" }))
    await waitFor(() => expect(listCandidates).toHaveBeenCalled())
    await act(async () => {
      rejectCandidates?.(new Error("candidate projection unavailable"))
      await candidateRequest.catch(() => undefined)
    })

    await waitFor(() => expect(screen.getByRole("heading", { name: "Blue Hour" })).toBeInTheDocument())
    const player = screen.getByRole("region", { name: "Global player" })
    expect(player).toHaveTextContent("Still Playing")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: "Seek through current version" })).toHaveValue("40")
    expect(media.setSource).toHaveBeenLastCalledWith(activeListen)
  })

  it("keeps the confirmed Current Version actionable when the candidate projection is unavailable", async () => {
    const api = {
      getProject: async () => ({
        data: {
          project_ref: "project_live_current_partial",
          title: "Blue Hour",
          description: "A current song whose direction list is temporarily unavailable.",
          current_version_ref: "version_live_current",
          candidate_count: 2,
          last_activity_at: "2026-09-04T12:00:00.000Z",
        },
        meta: { request_id: "request_project_current_partial" },
      }),
      listCandidates: async () => {
        throw new Error("candidate projection unavailable")
      },
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_live_current_partial" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    await waitFor(() => expect(screen.getByRole("heading", { name: "Blue Hour" })).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute(
      "href",
      "/projects/project_live_current_partial/studio/version_live_current",
    )
    const continuation = screen.getByRole("region", { name: "Continue making" })
    expect(within(continuation).getByText("Current · Current Version")).toBeInTheDocument()
    expect(within(continuation).getByRole("link", { name: "Remix & edit" })).toHaveAttribute(
      "href",
      "/projects/project_live_current_partial/studio/version_live_current?surface=arrangement&intent=transform",
    )
    expect(within(continuation).getByRole("link", { name: "Cover" })).toHaveAttribute(
      "href",
      "/projects/project_live_current_partial/studio/version_live_current?surface=arrangement&intent=cover",
    )
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Choose a version")
  })
})

function ActiveListenHarness() {
  const { selectPlayerCandidate, setPlaying } = useMoriApp()
  return <button type="button" onClick={() => {
    selectPlayerCandidate(activeListen, 40)
    setPlaying(true)
  }}>Start active listen</button>
}

function ActiveQueueHarness() {
  const { selectPlayerCandidate, setPlaying } = useMoriApp()
  return <button type="button" onClick={() => {
    selectPlayerCandidate(activeListen)
    selectPlayerCandidate(queuedListenB)
    selectPlayerCandidate(queuedListenC)
    selectPlayerCandidate(activeListen, 40)
    setPlaying(true)
  }}>Build active listening queue</button>
}

function createMediaHarness(): { factory: PlayerMediaFactory; setSource: ReturnType<typeof vi.fn> } {
  const setSource = vi.fn()
  return {
    setSource,
    factory: () => ({
      setSource,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      seek: vi.fn(),
      setMuted: vi.fn(),
      dispose: vi.fn(),
    }),
  }
}
