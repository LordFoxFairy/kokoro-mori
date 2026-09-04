import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Candidate } from "./domain"
import { previewCandidates } from "./preview-data"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { MoriStudioShell } from "./components/mori-studio-shell"
import type { PlayerMediaFactory } from "./player-media"

const activeListen: Candidate = {
  ...previewCandidates[0],
  candidateRef: "candidate_studio_active",
  versionRef: "version_studio_active",
  title: "Studio Keeps Playing",
  audioAssetRef: "asset/studio-active",
}

describe("Mori studio shell", () => {
  it("keeps Studio inside the global navigation and player shell", () => {
    render(
      <MoriAppProvider>
        <MoriStudioShell>
          <div>Studio canvas</div>
        </MoriStudioShell>
      </MoriAppProvider>,
    )

    expect(screen.getByRole("navigation", { name: "Mori" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Studio" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Global player" })).toBeInTheDocument()
    expect(screen.getByText("Studio canvas")).toBeInTheDocument()
  })

  it("preserves the active global listen when the requested Studio Version is unavailable", async () => {
    const setSource = vi.fn()
    const mediaFactory: PlayerMediaFactory = () => ({
      setSource,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      seek: vi.fn(),
      setMuted: vi.fn(),
      dispose: vi.fn(),
    })

    function RouteHarness() {
      const [studioOpen, setStudioOpen] = useState(false)
      const { selectPlayerCandidate, setPlaying } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => {
            selectPlayerCandidate(activeListen, 40)
            setPlaying(true)
          }}>Start active listen</button>
          <button type="button" onClick={() => setStudioOpen(true)}>Open unavailable Studio</button>
          {studioOpen ? (
            <MoriStudioShell><div>Version unavailable</div></MoriStudioShell>
          ) : (
            <MoriCatalogShell activeKey="library" ariaLabel="Library"><div>Library</div></MoriCatalogShell>
          )}
        </>
      )
    }

    render(
      <MoriAppProvider mediaFactory={mediaFactory}>
        <RouteHarness />
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Start active listen" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Open unavailable Studio" }))

    await waitFor(() => expect(screen.getByText("Version unavailable")).toBeInTheDocument())
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Studio Keeps Playing")
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: "Seek through current version" })).toHaveValue("40")
    expect(setSource).toHaveBeenLastCalledWith(activeListen)
  })

  it("does not replace active playback just because a playable Studio Version opens", async () => {
    const setSource = vi.fn()
    const play = vi.fn(async () => undefined)
    const mediaFactory: PlayerMediaFactory = () => ({
      setSource,
      play,
      pause: vi.fn(),
      seek: vi.fn(),
      setMuted: vi.fn(),
      dispose: vi.fn(),
    })

    function RouteHarness() {
      const [studioOpen, setStudioOpen] = useState(false)
      const { selectPlayerCandidate, setPlaying } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => {
            selectPlayerCandidate(activeListen, 40)
            setPlaying(true)
          }}>Start active listen</button>
          <button type="button" onClick={() => setStudioOpen(true)}>Open another Studio</button>
          {studioOpen ? (
            <MoriStudioShell>
              <div>Playable Studio</div>
            </MoriStudioShell>
          ) : (
            <MoriCatalogShell activeKey="library" ariaLabel="Library"><div>Library</div></MoriCatalogShell>
          )}
        </>
      )
    }

    render(<MoriAppProvider mediaFactory={mediaFactory}><RouteHarness /></MoriAppProvider>)
    fireEvent.click(screen.getByRole("button", { name: "Start active listen" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "Open another Studio" }))

    await waitFor(() => expect(screen.getByText("Playable Studio")).toBeInTheDocument())
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Studio Keeps Playing")
    expect(screen.getByRole("slider", { name: "Seek through current version" })).toHaveValue("40")
    expect(setSource).toHaveBeenLastCalledWith(activeListen)
    expect(play).toHaveBeenCalledTimes(1)
  })
})
