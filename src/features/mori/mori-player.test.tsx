import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Candidate } from "./domain"
import { MoriCatalogShell } from "./components/mori-catalog-shell"
import { MoriAppProvider, useMoriApp } from "./components/mori-app-provider"
import type { PlayerMediaCallbacks, PlayerMediaController, PlayerMediaFactory } from "./player-media"

const firstCandidate: Candidate = {
  candidateRef: "candidate_live_first",
  versionRef: "version_live_first",
  generationRef: "generation_live",
  title: "Live first",
  subtitle: "Connected source",
  durationSeconds: 182,
  mood: "Focused",
  waveformSeed: 11,
  isCurrent: true,
  audioAssetRef: "asset/live-first",
}

const secondCandidate: Candidate = {
  ...firstCandidate,
  candidateRef: "candidate_live_second",
  versionRef: "version_live_second",
  title: "Live second",
  audioAssetRef: "asset/live-second",
  isCurrent: false,
}

const thirdCandidate: Candidate = {
  ...firstCandidate,
  candidateRef: "candidate_live_third",
  versionRef: "version_live_third",
  title: "Live third",
  audioAssetRef: "asset/live-third",
  isCurrent: false,
}

const unavailableCandidate: Candidate = {
  ...firstCandidate,
  candidateRef: "candidate_unavailable",
  versionRef: "version_unavailable",
  title: "Unavailable Version",
  audioAssetRef: null,
  isCurrent: false,
}

describe("Mori global player media integration", () => {
  it("uses the injected media seam for play, pause, seek, mute, and timeupdate", async () => {
    const harness = createMediaHarness()

    function CandidateHarness() {
      const { selectPlayerCandidate } = useMoriApp()
      return <button type="button" onClick={() => selectPlayerCandidate(firstCandidate)}>Select live audio</button>
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Select live audio" }))
    expect(harness.controller.setSource).toHaveBeenCalledWith(firstCandidate)

    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument())
    expect(harness.controller.play).toHaveBeenCalledTimes(1)

    harness.callbacks.onTimeUpdate(47.25)
    await waitFor(() => expect(screen.getByRole("slider", { name: "Seek through current version" })).toHaveValue("47.25"))
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("0:47")
    expect(screen.getByRole("region", { name: "Global player" })).not.toHaveTextContent("0:47.25")

    fireEvent.change(screen.getByRole("slider", { name: "Seek through current version" }), { target: { value: "91" } })
    expect(harness.controller.seek).toHaveBeenCalledWith(91)

    fireEvent.click(screen.getByRole("button", { name: "Mute" }))
    expect(harness.controller.setMuted).toHaveBeenCalledWith(true)
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(harness.controller.pause).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
  })

  it("seeks the real media source when a new Version is selected at a timeline position", () => {
    const harness = createMediaHarness()

    function CandidateHarness() {
      const { selectPlayerCandidate } = useMoriApp()
      return <button type="button" onClick={() => selectPlayerCandidate(secondCandidate, 72)}>Select Version at 1:12</button>
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Select Version at 1:12" }))

    expect(harness.controller.setSource).toHaveBeenLastCalledWith(secondCandidate)
    expect(harness.controller.seek).toHaveBeenLastCalledWith(72)
    expect(screen.getByRole("slider", { name: "Seek through current version" })).toHaveValue("72")
  })

  it("auditions a selected range through the same global transport and stops at its boundary", async () => {
    const harness = createMediaHarness()
    const auditionScope = {
      kind: "range" as const,
      label: "Chorus",
      trackName: "Arrangement",
      startSeconds: 30,
      endSeconds: 35,
    }

    function CandidateHarness() {
      const { selectPlayerCandidate } = useMoriApp()
      return <button type="button" onClick={() => selectPlayerCandidate(firstCandidate, auditionScope.startSeconds, auditionScope)}>Preview Chorus</button>
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Preview Chorus" }))
    expect(harness.controller.setSource).toHaveBeenLastCalledWith(firstCandidate)
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: "Seek through current audition" })).toHaveAttribute("min", "30")
    expect(screen.getByRole("slider", { name: "Seek through current audition" })).toHaveAttribute("max", "35")
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Range audition · 0:30–0:35")

    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument())
    harness.callbacks.onTimeUpdate(33)
    await waitFor(() => expect(screen.getByRole("slider", { name: "Seek through current audition" })).toHaveValue("33"))
    harness.callbacks.onTimeUpdate(35)

    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument())
    expect(harness.controller.pause).toHaveBeenCalled()
    expect(harness.controller.seek).toHaveBeenLastCalledWith(30)
    expect(screen.getByRole("slider", { name: "Seek through current audition" })).toHaveValue("30")
  })

  it("loops a selected range without creating a second transport", async () => {
    const harness = createMediaHarness()
    const auditionScope = {
      kind: "range" as const,
      label: "Chorus",
      trackName: "Arrangement",
      startSeconds: 30,
      endSeconds: 35,
    }

    function CandidateHarness() {
      const { selectPlayerCandidate } = useMoriApp()
      return <button type="button" onClick={() => selectPlayerCandidate(firstCandidate, auditionScope.startSeconds, auditionScope)}>Preview Chorus</button>
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Preview Chorus" }))
    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "Loop current selection" }))
    expect(screen.getByRole("button", { name: "Stop looping selection" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Looping · 0:30–0:35")

    harness.controller.pause.mockClear()
    harness.callbacks.onTimeUpdate(35)
    await waitFor(() => expect(screen.getByRole("slider", { name: "Seek through current audition" })).toHaveValue("30"))
    expect(harness.controller.pause).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()

    harness.callbacks.onEnded()
    await waitFor(() => expect(harness.controller.play).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Stop looping selection" }))
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Range audition · 0:30–0:35")
  })

  it("offers the same loop control for a selected clip audition", async () => {
    const harness = createMediaHarness()
    const auditionScope = {
      kind: "clip" as const,
      label: "Afterglow",
      trackName: "Main version",
      startSeconds: 8,
      endSeconds: 16,
    }

    function CandidateHarness() {
      const { selectPlayerCandidate } = useMoriApp()
      return <button type="button" onClick={() => selectPlayerCandidate(firstCandidate, auditionScope.startSeconds, auditionScope)}>Preview clip</button>
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Preview clip" }))
    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument())
    expect(screen.getByRole("button", { name: "Loop current clip" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Loop current clip" }))
    expect(screen.getByRole("button", { name: "Stop looping clip" })).toHaveAttribute("aria-pressed", "true")
    harness.controller.pause.mockClear()
    harness.callbacks.onTimeUpdate(16)
    await waitFor(() => expect(screen.getByRole("slider", { name: "Seek through current audition" })).toHaveValue("8"))
    expect(harness.controller.pause).not.toHaveBeenCalled()
  })

  it("keeps playing when the active Version changes audition scope", async () => {
    const harness = createMediaHarness()
    const chorus = {
      kind: "range" as const,
      label: "Chorus",
      trackName: "Arrangement",
      startSeconds: 30,
      endSeconds: 35,
    }
    const verse = {
      kind: "range" as const,
      label: "Verse",
      trackName: "Arrangement",
      startSeconds: 12,
      endSeconds: 20,
    }

    function CandidateHarness() {
      const { selectPlayerCandidate, setPlaying } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => selectPlayerCandidate(firstCandidate, chorus.startSeconds, chorus)}>Preview Chorus</button>
          <button type="button" onClick={() => selectPlayerCandidate(firstCandidate, verse.startSeconds, verse)}>Preview Verse</button>
          <button type="button" onClick={() => setPlaying(true)}>Start playback</button>
        </>
      )
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Preview Chorus" }))
    fireEvent.click(screen.getByRole("button", { name: "Start playback" }))
    await waitFor(() => expect(harness.controller.play).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: "Preview Verse" }))

    await waitFor(() => expect(harness.controller.play).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Range audition · 0:12–0:20")
  })

  it("does not fake playback for preview candidates without media", () => {
    render(
      <MoriAppProvider>
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    const player = screen.getByRole("region", { name: "Global player" })
    expect(player).toHaveAttribute("data-player-state", "empty")
    expect(player).toHaveTextContent("Choose a version")
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument()
    fireEvent.keyDown(window, { code: "Space", key: " " })
    expect(player).toHaveAttribute("data-player-state", "empty")
  })

  it("clears Playing when the media play promise rejects and exposes retry", async () => {
    const harness = createMediaHarness(new Error("media unavailable"))

    function CandidateHarness() {
      const { selectPlayerCandidate } = useMoriApp()
      return <button type="button" onClick={() => selectPlayerCandidate(firstCandidate)}>Select live audio</button>
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Select live audio" }))
    fireEvent.click(screen.getByRole("button", { name: "Play" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be loaded")
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry playback" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry playback" }))
    expect(harness.controller.play).toHaveBeenCalledTimes(2)
  })

  it("starts the next candidate from the media ended event when end behavior is next", async () => {
    const harness = createMediaHarness()

    function CandidateHarness() {
      const { selectPlayerCandidate, updatePreferences } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => {
            selectPlayerCandidate(firstCandidate)
            selectPlayerCandidate(secondCandidate)
          }}>Use live queue</button>
          <button type="button" onClick={() => selectPlayerCandidate(firstCandidate)}>Select live audio</button>
          <button type="button" onClick={() => updatePreferences({ endBehavior: "next" })}>Play next at end</button>
        </>
      )
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Use live queue" }))
    fireEvent.click(screen.getByRole("button", { name: "Play next at end" }))
    fireEvent.click(screen.getByRole("button", { name: "Select live audio" }))
    fireEvent.click(screen.getByRole("button", { name: "Play" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument())

    harness.callbacks.onEnded()

    await waitFor(() => expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Live second"))
    await waitFor(() => expect(harness.controller.setSource).toHaveBeenLastCalledWith(secondCandidate))
    await waitFor(() => expect(harness.controller.play).toHaveBeenCalledTimes(2))
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
  })

  it("disables queue navigation until there is another Version to visit", () => {
    const harness = createMediaHarness()

    function CandidateHarness() {
      const { selectPlayerCandidate } = useMoriApp()
      return <button type="button" onClick={() => selectPlayerCandidate(firstCandidate)}>Select only Version</button>
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Select only Version" }))

    expect(screen.getByRole("button", { name: "Previous version" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next version" })).toBeDisabled()
  })

  it("does not wrap the global queue after its final Version", async () => {
    const harness = createMediaHarness()

    function CandidateHarness() {
      const { selectPlayerCandidate, setPlaying, updatePreferences } = useMoriApp()
      return <button type="button" onClick={() => {
        selectPlayerCandidate(firstCandidate)
        selectPlayerCandidate(secondCandidate)
        setPlaying(true)
        updatePreferences({ endBehavior: "next" })
      }}>Prepare final Version</button>
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Prepare final Version" }))
    await waitFor(() => expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Live second"))
    expect(screen.getByRole("button", { name: "Next version" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Previous version" })).not.toBeDisabled()

    harness.callbacks.onEnded()
    await waitFor(() => expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument())
    expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Live second")
  })

  it("ignores an ended event from the previous source while a new Version is being selected", async () => {
    const harness = createMediaHarness()

    function CandidateHarness() {
      const { selectPlayerCandidate, updatePreferences } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => {
            selectPlayerCandidate(firstCandidate)
            selectPlayerCandidate(thirdCandidate)
            selectPlayerCandidate(firstCandidate)
            updatePreferences({ endBehavior: "next" })
          }}>Prepare old queue</button>
          <button type="button" onClick={() => {
            selectPlayerCandidate(secondCandidate)
            harness.callbacks.onEnded()
          }}>Choose new Version as old source ends</button>
        </>
      )
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Prepare old queue" }))
    await waitFor(() => expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Live first"))

    fireEvent.click(screen.getByRole("button", { name: "Choose new Version as old source ends" }))

    await waitFor(() => expect(screen.getByRole("region", { name: "Global player" })).toHaveTextContent("Live second"))
    expect(harness.controller.setSource).toHaveBeenLastCalledWith(secondCandidate)
  })

  it("stops Playing when queue navigation reaches a Version without audio", async () => {
    const harness = createMediaHarness()

    function QueueHarness() {
      const { nextPlayerCandidate, playerCandidate, playing, selectPlayerCandidate, setPlaying } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => {
            selectPlayerCandidate(firstCandidate)
            selectPlayerCandidate(unavailableCandidate)
            selectPlayerCandidate(firstCandidate)
            setPlaying(true)
          }}>Prepare playable then unavailable</button>
          <button type="button" onClick={nextPlayerCandidate}>Visit next Version</button>
          <output aria-label="Player state">{playerCandidate?.versionRef ?? "none"}|{playing ? "playing" : "paused"}</output>
        </>
      )
    }

    render(<MoriAppProvider mediaFactory={harness.factory}><QueueHarness /></MoriAppProvider>)

    fireEvent.click(screen.getByRole("button", { name: "Prepare playable then unavailable" }))
    await waitFor(() => expect(screen.getByRole("status", { name: "Player state" })).toHaveTextContent("version_live_first|playing"))

    fireEvent.click(screen.getByRole("button", { name: "Visit next Version" }))

    expect(screen.getByRole("status", { name: "Player state" })).toHaveTextContent("version_unavailable|paused")
  })

  it("keeps one queue item when the same Version is selected from another projection", () => {
    const harness = createMediaHarness()
    const sameVersionFromLibrary: Candidate = {
      ...firstCandidate,
      candidateRef: "candidate_library_projection",
      title: "Live first · Library",
    }

    function CandidateHarness() {
      const { selectPlayerCandidate } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => selectPlayerCandidate(firstCandidate)}>Choose Project projection</button>
          <button type="button" onClick={() => selectPlayerCandidate(sameVersionFromLibrary)}>Choose Library projection</button>
        </>
      )
    }

    render(
      <MoriAppProvider mediaFactory={harness.factory}>
        <CandidateHarness />
        <MoriCatalogShell activeKey="library" ariaLabel="Library">
          <div>Library content</div>
        </MoriCatalogShell>
      </MoriAppProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Choose Project projection" }))
    fireEvent.click(screen.getByRole("button", { name: "Choose Library projection" }))
    fireEvent.click(screen.getByRole("button", { name: "Open playback queue" }))

    expect(screen.getAllByRole("button", { name: /from queue$/u })).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Play Live first · Library from queue" })).toBeInTheDocument()
    expect(harness.controller.setSource).toHaveBeenLastCalledWith(sameVersionFromLibrary)
  })
})

function createMediaHarness(playError?: Error): {
  callbacks: PlayerMediaCallbacks
  controller: {
    [K in keyof PlayerMediaController]: ReturnType<typeof vi.fn>
  }
  factory: PlayerMediaFactory
} {
  const callbacks: PlayerMediaCallbacks = {
    onTimeUpdate: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
  }
  const controller = {
    setSource: vi.fn(),
    play: vi.fn(async () => {
      if (playError !== undefined) throw playError
    }),
    pause: vi.fn(),
    seek: vi.fn(),
    setMuted: vi.fn(),
    dispose: vi.fn(),
  }
  const factory: PlayerMediaFactory = (providerCallbacks) => {
    callbacks.onTimeUpdate = providerCallbacks.onTimeUpdate
    callbacks.onEnded = providerCallbacks.onEnded
    callbacks.onError = providerCallbacks.onError
    return {
      ...controller,
      play: async () => {
        try {
          await controller.play()
        } catch (error) {
          callbacks.onError()
          throw error
        }
      },
    }
  }
  return { callbacks, controller, factory }
}
