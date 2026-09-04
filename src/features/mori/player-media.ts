import { buildMoriAssetContentUrl } from "@/lib/mori-media"
import type { Candidate } from "./domain"

export type PlayerMediaCallbacks = {
  onTimeUpdate: (positionSeconds: number) => void
  onEnded: () => void
  onError: () => void
}

export type PlayerMediaChannel = {
  currentTime: number
  muted: boolean
  play: () => Promise<void>
  pause: () => void
  on: (event: PlayerMediaEvent, listener: () => void) => void
  off: (event: PlayerMediaEvent, listener: () => void) => void
}

export type PlayerMediaController = {
  setSource: (candidate: Candidate | null) => void
  play: () => Promise<void>
  pause: () => void
  seek: (positionSeconds: number) => void
  setMuted: (muted: boolean) => void
  dispose: () => void
}

export type PlayerMediaFactory = (callbacks: PlayerMediaCallbacks) => PlayerMediaController

export type PlayerMediaEvent = "timeupdate" | "ended" | "error"

export function isPlayableCandidate(candidate: Candidate | null): boolean {
  const assetRef = candidate?.audioAssetRef
  return assetRef !== undefined && assetRef !== null && assetRef.trim().length > 0
}

type LoadedSource = {
  candidate: Candidate
  channel: PlayerMediaChannel
  listeners: Array<{ event: PlayerMediaEvent; listener: () => void }>
}

export function createHtmlPlayerMediaController(
  callbacks: PlayerMediaCallbacks,
  createChannel: PlayerMediaChannelFactory = createBrowserPlayerMediaChannel,
): PlayerMediaController {
  let loaded: LoadedSource | null = null
  let muted = false
  let failed = false

  const pause = () => {
    loaded?.channel.pause()
  }

  const reportError = (source?: LoadedSource) => {
    if (source !== undefined && loaded !== source) return
    if (failed) return
    failed = true
    pause()
    callbacks.onError()
  }

  const releaseSource = () => {
    pause()
    const source = loaded
    if (source === null) return
    source.listeners.forEach(({ event, listener }) => source.channel.off(event, listener))
    loaded = null
  }

  const setSource = (candidate: Candidate | null) => {
    releaseSource()
    failed = false
    if (candidate === null) return

    const assetRef = candidate.audioAssetRef
    if (assetRef === undefined || assetRef === null || assetRef.trim().length === 0) return
    const channel = createChannel(buildMoriAssetContentUrl(assetRef))
    channel.muted = muted
    const source: LoadedSource = { candidate, channel, listeners: [] }
    loaded = source
    register(source, "timeupdate", () => callbacks.onTimeUpdate(finitePosition(channel.currentTime)))
    register(source, "ended", callbacks.onEnded)
    register(source, "error", () => reportError(source))
  }

  const play = async () => {
    const source = loaded
    if (source === null) {
      reportError()
      throw new Error("player_audio_unavailable")
    }

    failed = false
    try {
      await source.channel.play()
    } catch (error) {
      reportError(source)
      throw error
    }
  }

  const seek = (positionSeconds: number) => {
    if (loaded === null || !Number.isFinite(positionSeconds)) return
    loaded.channel.currentTime = Math.min(loaded.candidate.durationSeconds, Math.max(0, positionSeconds))
  }

  const setMuted = (nextMuted: boolean) => {
    muted = nextMuted
    if (loaded !== null) loaded.channel.muted = nextMuted
  }

  return { setSource, play, pause, seek, setMuted, dispose: releaseSource }

  function register(source: LoadedSource, event: PlayerMediaEvent, listener: () => void): void {
    source.channel.on(event, listener)
    source.listeners.push({ event, listener })
  }
}

export type PlayerMediaChannelFactory = (url: string) => PlayerMediaChannel

function createBrowserPlayerMediaChannel(url: string): PlayerMediaChannel {
  const audio = new Audio(url)
  audio.preload = "metadata"
  return {
    get currentTime() { return audio.currentTime },
    set currentTime(value: number) { audio.currentTime = value },
    get muted() { return audio.muted },
    set muted(value: boolean) { audio.muted = value },
    play: () => audio.play(),
    pause: () => {
      if (!audio.paused) audio.pause()
    },
    on: (event, listener) => audio.addEventListener(event, listener),
    off: (event, listener) => audio.removeEventListener(event, listener),
  }
}

function finitePosition(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}
