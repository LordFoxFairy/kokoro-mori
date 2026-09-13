import { describe, expect, it, vi } from "vitest"
import type { Candidate } from "./domain"
import type { PlayerMediaCallbacks, PlayerMediaChannel, PlayerMediaController, PlayerMediaFactory } from "./player-media"
import { createHtmlPlayerMediaController } from "./player-media"

const candidate: Candidate = {
  candidateRef: "candidate_media",
  versionRef: "version_media",
  generationRef: "generation_media",
  title: "Media version",
  subtitle: "Connected audio",
  durationSeconds: 182,
  mood: "Focused",
  waveformSeed: 7,
  isCurrent: false,
  audioAssetRef: "asset/media one",
}

describe("Mori player media controller", () => {
  it("loads an opaque asset through the same-origin media route and forwards media events", async () => {
    const channel = createChannel()
    const callbacks = createCallbacks()
    const createChannelMock = vi.fn((url: string) => {
      channel.url = url
      return channel
    })
    const controller = createHtmlPlayerMediaController(callbacks, createChannelMock)

    controller.setSource(candidate)
    expect(channel).toHaveProperty("url", "/api/v1/mori/assets/asset%2Fmedia%20one/content")

    await controller.play()
    expect(channel.play).toHaveBeenCalledTimes(1)

    channel.currentTime = 47.25
    channel.emit("timeupdate")
    expect(callbacks.onTimeUpdate).toHaveBeenCalledWith(47.25)

    controller.seek(200)
    expect(channel.currentTime).toBe(182)
    controller.setMuted(true)
    expect(channel.muted).toBe(true)

    channel.emit("ended")
    expect(callbacks.onEnded).toHaveBeenCalledTimes(1)
  })

  it("maps local preview refs to playable static fixtures without changing live asset routing", () => {
    const channel = createChannel()
    const createChannelMock = vi.fn(() => channel)
    const controller = createHtmlPlayerMediaController(createCallbacks(), createChannelMock)

    controller.setSource({ ...candidate, audioAssetRef: "preview:first-light:a" })

    expect(createChannelMock).toHaveBeenCalledWith("/audio/mori-preview-first-light-a.mp3")
  })

  it("passes local recording Blob URLs through without treating them as API asset refs", () => {
    const channel = createChannel()
    const createChannelMock = vi.fn(() => channel)
    const controller = createHtmlPlayerMediaController(createCallbacks(), createChannelMock)

    controller.setSource({ ...candidate, audioAssetRef: "blob:http://localhost/mori-recording" })

    expect(createChannelMock).toHaveBeenCalledWith("blob:http://localhost/mori-recording")
  })

  it("releases the previous source and does not retain its event listeners", () => {
    const first = createChannel()
    const second = createChannel()
    const callbacks = createCallbacks()
    const createChannelMock = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
    const controller = createHtmlPlayerMediaController(callbacks, createChannelMock)

    controller.setSource(candidate)
    controller.setSource({ ...candidate, candidateRef: "candidate_media_2", audioAssetRef: "asset/media two" })

    expect(first.pause).toHaveBeenCalledTimes(1)
    expect(first.listenerCount("timeupdate")).toBe(0)
    expect(first.listenerCount("ended")).toBe(0)
    expect(createChannelMock).toHaveBeenNthCalledWith(2, "/api/v1/mori/assets/asset%2Fmedia%20two/content")
  })

  it("keeps an explicitly unavailable candidate from creating a browser channel", async () => {
    const callbacks = createCallbacks()
    const createChannelMock = vi.fn()
    const controller = createHtmlPlayerMediaController(callbacks, createChannelMock)

    controller.setSource({ ...candidate, audioAssetRef: null })

    await expect(controller.play()).rejects.toThrow("player_audio_unavailable")
    expect(createChannelMock).not.toHaveBeenCalled()
    expect(callbacks.onError).toHaveBeenCalledTimes(1)
  })

  it("reports an asynchronous play rejection and pauses the failed channel", async () => {
    const callbacks = createCallbacks()
    const channel = createChannel(new Error("autoplay blocked"))
    const controller = createHtmlPlayerMediaController(callbacks, () => channel)
    controller.setSource(candidate)

    await expect(controller.play()).rejects.toThrow("autoplay blocked")
    expect(channel.pause).toHaveBeenCalledTimes(1)
    expect(callbacks.onError).toHaveBeenCalledTimes(1)
  })
})

describe("Mori player media factory seam", () => {
  it("keeps the factory narrow enough for provider tests", () => {
    const factory: PlayerMediaFactory = () => createController()
    const callbacks = createCallbacks()

    expect(factory(callbacks)).toMatchObject({
      setSource: expect.any(Function),
      play: expect.any(Function),
      pause: expect.any(Function),
      seek: expect.any(Function),
      setMuted: expect.any(Function),
      dispose: expect.any(Function),
    })
  })
})

function createCallbacks(): PlayerMediaCallbacks {
  return {
    onTimeUpdate: vi.fn(),
    onEnded: vi.fn(),
    onError: vi.fn(),
  }
}

function createChannel(playError?: Error): PlayerMediaChannel & {
  url: string
  emit: (event: "timeupdate" | "ended" | "error") => void
  listenerCount: (event: "timeupdate" | "ended" | "error") => number
} {
  const listeners = new Map<"timeupdate" | "ended" | "error", Set<() => void>>()
  const channel = {
    url: "fixture://audio",
    currentTime: 0,
    muted: false,
    play: vi.fn(async () => {
      if (playError !== undefined) throw playError
    }),
    pause: vi.fn(),
    on: vi.fn((event: "timeupdate" | "ended" | "error", listener: () => void) => {
      const eventListeners = listeners.get(event) ?? new Set<() => void>()
      eventListeners.add(listener)
      listeners.set(event, eventListeners)
    }),
    off: vi.fn((event: "timeupdate" | "ended" | "error", listener: () => void) => {
      listeners.get(event)?.delete(listener)
    }),
    emit: (event: "timeupdate" | "ended" | "error") => {
      listeners.get(event)?.forEach((listener) => listener())
    },
    listenerCount: (event: "timeupdate" | "ended" | "error") => listeners.get(event)?.size ?? 0,
  }
  return channel
}

function createController(): PlayerMediaController {
  return {
    setSource: () => undefined,
    play: async () => undefined,
    pause: () => undefined,
    seek: () => undefined,
    setMuted: () => undefined,
    dispose: () => undefined,
  }
}
