import type { MoriStem } from "@/lib/mori-api"
import { buildMoriAssetContentUrl } from "@/lib/mori-media"

export type StemMixTrack = {
  stemRef: string
  gain: number
  muted: boolean
  solo: boolean
  pan?: number
}

export type StemPlaybackCallbacks = {
  onPosition: (positionSeconds: number) => void
  onEnded: () => void
  onError: () => void
}

export type StemPlaybackController = {
  setTracks: (stems: readonly MoriStem[]) => void
  play: (positionSeconds: number) => Promise<void>
  pause: () => void
  seek: (positionSeconds: number) => void
  setMix: (tracks: readonly StemMixTrack[]) => void
  dispose: () => void
}

export type StemPlaybackFactory = (callbacks: StemPlaybackCallbacks) => StemPlaybackController

type StemMediaEvent = "timeupdate" | "ended" | "error"

export type StemMediaChannel = {
  currentTime: number
  volume: number
  pan: number
  play: () => Promise<void>
  pause: () => void
  on: (event: StemMediaEvent, listener: () => void) => void
  off: (event: StemMediaEvent, listener: () => void) => void
  dispose?: () => void
}

export type StemMediaChannelFactory = (url: string) => StemMediaChannel

type LoadedChannel = {
  stemRef: string
  channel: StemMediaChannel
  listeners: Array<{ event: StemMediaEvent; listener: () => void }>
}

const driftToleranceSeconds = 0.12

export function createHtmlStemPlaybackController(
  callbacks: StemPlaybackCallbacks,
  createChannel: StemMediaChannelFactory = createBrowserStemMediaChannel,
): StemPlaybackController {
  let loadedChannels: LoadedChannel[] = []
  let failed = false

  const pause = () => {
    loadedChannels.forEach(({ channel }) => channel.pause())
  }

  const reportError = () => {
    if (failed) return
    failed = true
    pause()
    callbacks.onError()
  }

  const releaseChannels = () => {
    pause()
    loadedChannels.forEach(({ channel, listeners }) => {
      listeners.forEach(({ event, listener }) => channel.off(event, listener))
      channel.dispose?.()
    })
    loadedChannels = []
  }

  const setTracks = (stems: readonly MoriStem[]) => {
    releaseChannels()
    failed = false
    loadedChannels = stems.map((stem) => ({
      stemRef: stem.stem_ref,
      channel: createChannel(buildMoriAssetContentUrl(stem.audio_asset_ref)),
      listeners: [],
    }))

    const clock = loadedChannels[0]
    if (clock === undefined) return

    const updatePosition = () => {
      const position = finitePosition(clock.channel.currentTime)
      loadedChannels.slice(1).forEach(({ channel }) => {
        if (Math.abs(finitePosition(channel.currentTime) - position) > driftToleranceSeconds) channel.currentTime = position
      })
      callbacks.onPosition(position)
    }
    const finish = () => {
      pause()
      callbacks.onEnded()
    }
    register(clock, "timeupdate", updatePosition)
    register(clock, "ended", finish)
    loadedChannels.forEach((entry) => register(entry, "error", reportError))
  }

  const play = async (positionSeconds: number) => {
    if (loadedChannels.length === 0) {
      reportError()
      throw new Error("stem_audio_unavailable")
    }
    failed = false
    const position = finitePosition(positionSeconds)
    loadedChannels.forEach(({ channel }) => { channel.currentTime = position })
    try {
      await Promise.all(loadedChannels.map(({ channel }) => channel.play()))
    } catch (error) {
      reportError()
      throw error
    }
  }

  const seek = (positionSeconds: number) => {
    const position = finitePosition(positionSeconds)
    loadedChannels.forEach(({ channel }) => { channel.currentTime = position })
  }

  const setMix = (tracks: readonly StemMixTrack[]) => {
    const trackSettings = new Map(tracks.map((track) => [track.stemRef, track]))
    const hasSolo = tracks.some((track) => track.solo)
    loadedChannels.forEach(({ stemRef, channel }) => {
      const track = trackSettings.get(stemRef)
      if (track === undefined || track.muted || (hasSolo && !track.solo)) {
        channel.volume = 0
        channel.pan = 0
        return
      }
      channel.volume = clamp(track.gain, 0, 1)
      channel.pan = clamp(track.pan ?? 0, -1, 1)
    })
  }

  return { setTracks, play, pause, seek, setMix, dispose: releaseChannels }

  function register(entry: LoadedChannel, event: StemMediaEvent, listener: () => void): void {
    entry.channel.on(event, listener)
    entry.listeners.push({ event, listener })
  }
}

function createBrowserStemMediaChannel(url: string): StemMediaChannel {
  const audio = new Audio(url)
  audio.preload = "metadata"
  let context: AudioContext | null = null
  let panner: StereoPannerNode | null = null
  let source: MediaElementAudioSourceNode | null = null

  try {
    const audioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (audioContextConstructor !== undefined) {
      context = new audioContextConstructor()
      source = context.createMediaElementSource(audio)
      panner = context.createStereoPanner()
      source.connect(panner)
      panner.connect(context.destination)
    }
  } catch {
    source?.disconnect()
    panner?.disconnect()
    context = null
    panner = null
    source = null
  }

  return {
    get currentTime() { return audio.currentTime },
    set currentTime(value: number) { audio.currentTime = value },
    get volume() { return audio.volume },
    set volume(value: number) { audio.volume = value },
    get pan() { return panner?.pan.value ?? 0 },
    set pan(value: number) { if (panner !== null) panner.pan.value = clamp(value, -1, 1) },
    play: async () => {
      if (context?.state === "suspended") await context.resume()
      return audio.play()
    },
    pause: () => audio.pause(),
    on: (event, listener) => audio.addEventListener(event, listener),
    off: (event, listener) => audio.removeEventListener(event, listener),
    dispose: () => {
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
      source?.disconnect()
      panner?.disconnect()
      void context?.close()
    },
  }
}

function finitePosition(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
