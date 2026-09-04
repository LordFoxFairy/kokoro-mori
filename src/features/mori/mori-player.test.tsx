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

    fireEvent.change(screen.getByRole("slider", { name: "Seek through current version" }), { target: { value: "91" } })
    expect(harness.controller.seek).toHaveBeenCalledWith(91)

    fireEvent.click(screen.getByRole("button", { name: "Mute" }))
    expect(harness.controller.setMuted).toHaveBeenCalledWith(true)
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(harness.controller.pause).toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument()
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
      const { replacePlayerCandidates, selectPlayerCandidate, updatePreferences } = useMoriApp()
      return (
        <>
          <button type="button" onClick={() => replacePlayerCandidates([firstCandidate, secondCandidate])}>Use live queue</button>
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
    expect(harness.controller.setSource).toHaveBeenLastCalledWith(secondCandidate)
    expect(harness.controller.play).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument()
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
