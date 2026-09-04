import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriApi } from "@/lib/mori-api"
import { MoriApiRequestError } from "@/lib/mori-api-client"
import type { Candidate } from "./domain"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import type { PlayerMediaFactory } from "./player-media"
import { ProjectOverviewPageContent } from "./project-overview"

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

describe("Mori Project Current Version", () => {
  it("promotes a Project direction to Current only after its compare-and-set confirmation", async () => {
    const media = createMediaHarness()
    let releaseSelection: () => void = () => undefined
    const selectionGate = new Promise<void>((resolve) => { releaseSelection = resolve })
    let releaseProjectProjection: () => void = () => undefined
    const projectProjectionGate = new Promise<void>((resolve) => { releaseProjectProjection = resolve })
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async () => {
      await selectionGate
      return {
        data: {
          project_ref: "project_unconfirmed_2",
          current_version_ref: "version_unconfirmed_2_b",
          source_candidate_ref: "candidate_unconfirmed_2_b",
          previous_version_ref: null,
          selected_at: "2026-09-04T14:00:00.000Z",
        },
        meta: { request_id: "request_project_overview_current" },
      }
    })
    const api: Pick<MoriApi, "getProject" | "listCandidates" | "putCurrentVersion"> = {
      getProject: async () => {
        await projectProjectionGate
        return {
          data: {
            project_ref: "project_unconfirmed_2",
            title: "Loose Ends",
            description: "Two directions waiting for a decision.",
            current_version_ref: null,
            candidate_count: 2,
            last_activity_at: "2026-09-04T12:00:00.000Z",
          },
          meta: { request_id: "request_project_unconfirmed_2" },
        }
      },
      listCandidates: async () => ({
        data: {
          candidates: [
            {
              candidate_ref: "candidate_unconfirmed_2_a",
              generation_ref: "generation_unconfirmed_2",
              version_ref: "version_unconfirmed_2_a",
              project_ref: "project_unconfirmed_2",
              title: "Loose Ends · First pass",
              duration_seconds: 152,
              audio_asset_ref: "asset_unconfirmed_2_a",
              waveform_asset_ref: "waveform_unconfirmed_2_a",
              style_tags: ["patient", "open"],
              created_at: "2026-09-04T11:58:00.000Z",
            },
            {
              candidate_ref: "candidate_unconfirmed_2_b",
              generation_ref: "generation_unconfirmed_2",
              version_ref: "version_unconfirmed_2_b",
              project_ref: "project_unconfirmed_2",
              title: "Loose Ends · Wide",
              duration_seconds: 156,
              audio_asset_ref: "asset_unconfirmed_2_b",
              waveform_asset_ref: "waveform_unconfirmed_2_b",
              style_tags: ["wide", "warm"],
              created_at: "2026-09-04T11:59:00.000Z",
            },
          ],
          next_cursor: null,
        },
        meta: { request_id: "request_candidates_unconfirmed_2" },
      }),
      putCurrentVersion,
    }

    render(
      <MoriAppProvider mediaFactory={media.factory}>
        <ActiveListenHarness />
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent projectRef="project_unconfirmed_2" api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    const target = await screen.findByRole("article", { name: "Loose Ends · Wide" })
    fireEvent.click(screen.getByRole("button", { name: "Start active listen" }))
    fireEvent.click(within(target).getByRole("button", { name: "Set Loose Ends · Wide as current" }))

    await waitFor(() => expect(putCurrentVersion).toHaveBeenCalledOnce())
    expect(putCurrentVersion.mock.calls[0]?.slice(0, 2)).toEqual([
      "project_unconfirmed_2",
      {
        candidate_ref: "candidate_unconfirmed_2_b",
        version_ref: "version_unconfirmed_2_b",
        expected_current_version_ref: null,
      },
    ])
    expect(putCurrentVersion.mock.calls[0]?.[2]).toMatch(/^mori-current-version-/u)
    expect(within(target).getByRole("button", { name: "Setting Loose Ends · Wide as current" })).toBeDisabled()
    expect(screen.queryByRole("region", { name: "Continue making" })).not.toBeInTheDocument()

    await act(async () => { releaseSelection() })
    await act(async () => { releaseProjectProjection() })

    expect(await screen.findByText("Current Version updated")).toBeInTheDocument()
    expect(screen.getByRole("article", { name: "Loose Ends · Wide, current version" })).toHaveTextContent("Current")
    expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute(
      "href",
      "/projects/project_unconfirmed_2/studio/version_unconfirmed_2_b",
    )
    expect(screen.getByRole("region", { name: "Continue making" })).toHaveTextContent("Current · Loose Ends · Wide")
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Still Playing")
    expect(media.setSource).toHaveBeenLastCalledWith(activeListen)
  })

  it("keeps the confirmed Project Current when another client commits first", async () => {
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async () => {
      throw new MoriApiRequestError({
        code: "current_version_conflict",
        message: "Current changed",
        retryable: false,
        details: null,
      }, "request_project_current_conflict", 409)
    })
    const api: Pick<MoriApi, "getProject" | "listCandidates" | "putCurrentVersion"> = {
      getProject: async () => { throw new Error("Preview Project stays visible") },
      listCandidates: async () => { throw new Error("Preview candidates stay visible") },
      putCurrentVersion,
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Set First Light · Afterglow as current" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Current Version changed elsewhere. Refresh Project before choosing again.")
    expect(within(alert).queryByRole("button", { name: "Retry Set as current" })).not.toBeInTheDocument()
    expect(screen.getByRole("article", { name: "First Light, current version" })).toHaveTextContent("Current")
    expect(screen.getByRole("article", { name: "First Light · Afterglow" })).not.toHaveTextContent("Current")
    expect(screen.getByRole("region", { name: "Continue making" })).toHaveTextContent("Current · First Light")
  })

  it("retries a Project Current choice with the original idempotency identity", async () => {
    const idempotencyKeys: string[] = []
    let attempt = 0
    const putCurrentVersion = vi.fn<MoriApi["putCurrentVersion"]>(async (_projectRef, _input, idempotencyKey) => {
      idempotencyKeys.push(idempotencyKey)
      attempt += 1
      if (attempt === 1) throw new Error("temporary network interruption")
      return {
        data: {
          project_ref: "project_preview_first_light",
          current_version_ref: "version_preview_first_light_b",
          source_candidate_ref: "candidate_preview_first_light_b",
          previous_version_ref: "version_preview_first_light_a",
          selected_at: "2026-09-04T14:10:00.000Z",
        },
        meta: { request_id: "request_project_current_retry" },
      }
    })
    const api: Pick<MoriApi, "getProject" | "listCandidates" | "putCurrentVersion"> = {
      getProject: async () => { throw new Error("Preview Project stays visible") },
      listCandidates: async () => { throw new Error("Preview candidates stay visible") },
      putCurrentVersion,
    }

    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="projects" ariaLabel="Project overview">
          <ProjectOverviewPageContent api={api} />
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Set First Light · Afterglow as current" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Mori couldn't make this direction Current. Your previous Current is unchanged.")
    fireEvent.click(within(alert).getByRole("button", { name: "Retry Set as current" }))

    expect(await screen.findByText("Current Version updated")).toBeInTheDocument()
    expect(idempotencyKeys).toHaveLength(2)
    expect(idempotencyKeys[1]).toBe(idempotencyKeys[0])
    expect(screen.getByRole("article", { name: "First Light · Afterglow, current version" })).toHaveTextContent("Current")
  })

})

function ActiveListenHarness() {
  const { selectPlayerCandidate, setPlaying } = useMoriApp()
  return <button type="button" onClick={() => {
    selectPlayerCandidate(activeListen, 40)
    setPlaying(true)
  }}>Start active listen</button>
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
