import { describe, expect, it, vi } from "vitest"
import type { MoriStem } from "@/lib/mori-api"
import {
  createHtmlStemPlaybackController,
  type StemMediaChannel,
  type StemPlaybackCallbacks,
} from "./stem-playback"

const stems: MoriStem[] = [
  { stem_ref: "stem_vocal", kind: "vocals", label: "Lead vocal", audio_asset_ref: "asset/vocal", waveform_asset_ref: "wave_vocal", duration_seconds: 182 },
  { stem_ref: "stem_drums", kind: "drums", label: "Drums", audio_asset_ref: "asset/drums", waveform_asset_ref: "wave_drums", duration_seconds: 182 },
]

describe("HTML stem playback controller", () => {
  it("aligns returned tracks, drives one clock, and applies effective Mute/Solo/Level", async () => {
    const channels: FakeStemMediaChannel[] = []
    const urls: string[] = []
    const onPosition = vi.fn()
    const onEnded = vi.fn()
    const onError = vi.fn()
    const callbacks: StemPlaybackCallbacks = { onPosition, onEnded, onError }
    const controller = createHtmlStemPlaybackController(callbacks, (url) => {
      urls.push(url)
      const channel = new FakeStemMediaChannel()
      channels.push(channel)
      return channel
    })

    controller.setTracks(stems)
    expect(urls).toEqual([
      "/api/v1/mori/assets/asset%2Fvocal/content",
      "/api/v1/mori/assets/asset%2Fdrums/content",
    ])

    controller.setMix([
      { stemRef: "stem_vocal", gain: 0.75, muted: false, solo: true },
      { stemRef: "stem_drums", gain: 0.4, muted: false, solo: false },
    ])
    expect(channels.map((channel) => channel.volume)).toEqual([0.75, 0])

    await controller.play(18)
    expect(channels.map((channel) => channel.currentTime)).toEqual([18, 18])
    expect(channels.every((channel) => channel.play.mock.calls.length === 1)).toBe(true)

    channels[0]?.emit("timeupdate", 19.25)
    expect(onPosition).toHaveBeenLastCalledWith(19.25)
    expect(channels[1]?.currentTime).toBe(19.25)

    controller.seek(44)
    expect(channels.map((channel) => channel.currentTime)).toEqual([44, 44])

    channels[0]?.emit("ended")
    expect(onEnded).toHaveBeenCalledTimes(1)
    expect(channels.every((channel) => channel.pause.mock.calls.length > 0)).toBe(true)
  })

  it("stops every track on media failure and removes listeners on dispose", () => {
    const channels: FakeStemMediaChannel[] = []
    const onError = vi.fn()
    const controller = createHtmlStemPlaybackController(
      { onPosition: vi.fn(), onEnded: vi.fn(), onError },
      () => {
        const channel = new FakeStemMediaChannel()
        channels.push(channel)
        return channel
      },
    )

    controller.setTracks(stems)
    channels[1]?.emit("error")
    expect(onError).toHaveBeenCalledTimes(1)
    expect(channels.every((channel) => channel.pause.mock.calls.length === 1)).toBe(true)

    controller.dispose()
    expect(channels.every((channel) => channel.listenerCount() === 0)).toBe(true)
  })
})

class FakeStemMediaChannel implements StemMediaChannel {
  currentTime = 0
  volume = 1
  readonly play = vi.fn(async () => undefined)
  readonly pause = vi.fn()
  private readonly listeners = new Map<string, Set<() => void>>()

  on(event: "timeupdate" | "ended" | "error", listener: () => void): void {
    const listeners = this.listeners.get(event) ?? new Set<() => void>()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }

  off(event: "timeupdate" | "ended" | "error", listener: () => void): void {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: "timeupdate" | "ended" | "error", currentTime?: number): void {
    if (currentTime !== undefined) this.currentTime = currentTime
    this.listeners.get(event)?.forEach((listener) => listener())
  }

  listenerCount(): number {
    return [...this.listeners.values()].reduce((count, listeners) => count + listeners.size, 0)
  }
}
