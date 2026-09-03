import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { MoriStem } from "@/lib/mori-api"
import type { StemPlaybackCallbacks, StemPlaybackController, StemPlaybackFactory } from "../stem-playback"
import { StudioStemMixer } from "./studio-stem-mixer"

const stems: MoriStem[] = [
  { stem_ref: "stem_vocal", kind: "vocals", label: "Lead vocal", audio_asset_ref: "asset/vocal", waveform_asset_ref: "wave_vocal", duration_seconds: 182 },
  { stem_ref: "stem_drums", kind: "drums", label: "Drums", audio_asset_ref: "asset/drums", waveform_asset_ref: "wave_drums", duration_seconds: 182 },
]

describe("Studio stem mixer", () => {
  it("auditions only returned assets with one transport and direct track controls", async () => {
    const harness = createPlaybackHarness()
    const onPlaybackStart = vi.fn()
    const view = render(
      <StudioStemMixer stems={stems} externalPlaybackActive={false} onPlaybackStart={onPlaybackStart} playbackFactory={harness.factory} />,
    )

    expect(harness.controller.setTracks).toHaveBeenCalledWith(stems)
    expect(screen.getByRole("region", { name: "Stem mixer" })).toHaveTextContent("2 tracks")
    expect(screen.getByRole("link", { name: "Download Lead vocal stem" })).toHaveAttribute(
      "href",
      "/api/v1/mori/assets/asset%2Fvocal/content?disposition=attachment",
    )

    fireEvent.click(screen.getByRole("button", { name: "Play stem mix" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause stem mix" })).toBeInTheDocument())
    expect(onPlaybackStart).toHaveBeenCalledTimes(1)
    expect(harness.controller.play).toHaveBeenCalledWith(0)

    fireEvent.change(screen.getByRole("slider", { name: "Volume Lead vocal" }), { target: { value: "35" } })
    fireEvent.click(screen.getByRole("button", { name: "Mute Drums" }))
    fireEvent.click(screen.getByRole("button", { name: "Solo Lead vocal" }))
    const latestMix = harness.controller.setMix.mock.calls.at(-1)?.[0]
    expect(latestMix).toEqual([
      { stemRef: "stem_vocal", gain: 0.35, muted: false, solo: true },
      { stemRef: "stem_drums", gain: 1, muted: true, solo: false },
    ])

    fireEvent.change(screen.getByRole("slider", { name: "Seek stem mix" }), { target: { value: "44" } })
    expect(harness.controller.seek).toHaveBeenCalledWith(44)

    act(() => harness.callbacks.onPosition(21))
    expect(screen.getByRole("region", { name: "Stem mixer" })).toHaveTextContent("0:21 / 3:02")

    view.rerender(
      <StudioStemMixer stems={stems} externalPlaybackActive onPlaybackStart={onPlaybackStart} playbackFactory={harness.factory} />,
    )
    expect(harness.controller.pause).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole("button", { name: "Play stem mix" })).toBeInTheDocument())

    view.unmount()
    expect(harness.controller.dispose).toHaveBeenCalledTimes(1)
  })

  it("reports a real playback failure without replacing the audio", async () => {
    const harness = createPlaybackHarness(new Error("media unavailable"))
    render(<StudioStemMixer stems={stems} externalPlaybackActive={false} onPlaybackStart={vi.fn()} playbackFactory={harness.factory} />)

    fireEvent.click(screen.getByRole("button", { name: "Play stem mix" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Stem audio is unavailable right now. Check the connection and try again.")
    expect(screen.getByRole("button", { name: "Play stem mix" })).toBeInTheDocument()
  })

  it("keeps mixer rows readable as independent tracks", () => {
    const harness = createPlaybackHarness()
    render(<StudioStemMixer stems={stems} externalPlaybackActive={false} onPlaybackStart={vi.fn()} playbackFactory={harness.factory} />)

    const vocalTrack = screen.getByRole("article", { name: "Lead vocal stem" })
    expect(within(vocalTrack).getByText("Lead vocal")).toBeInTheDocument()
    expect(within(vocalTrack).getByText("3:02")).toBeInTheDocument()
    expect(within(vocalTrack).getByRole("slider", { name: "Volume Lead vocal" })).toHaveValue("100")
  })
})

function createPlaybackHarness(playError?: Error): {
  callbacks: StemPlaybackCallbacks
  controller: {
    [K in keyof StemPlaybackController]: ReturnType<typeof vi.fn>
  }
  factory: StemPlaybackFactory
} {
  let callbacks: StemPlaybackCallbacks = { onPosition: () => undefined, onEnded: () => undefined, onError: () => undefined }
  const controller = {
    setTracks: vi.fn(),
    play: vi.fn(async () => {
      if (playError !== undefined) throw playError
    }),
    pause: vi.fn(),
    seek: vi.fn(),
    setMix: vi.fn(),
    dispose: vi.fn(),
  }
  const factory: StemPlaybackFactory = (nextCallbacks) => {
    callbacks = nextCallbacks
    return controller
  }
  return { get callbacks() { return callbacks }, controller, factory }
}
