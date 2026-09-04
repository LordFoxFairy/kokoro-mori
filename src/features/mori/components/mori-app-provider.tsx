"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { previewCandidates } from "../preview-data"
import type { Candidate, CreationMode, LyricsMode } from "../domain"
import { createHtmlPlayerMediaController, isPlayableCandidate, type PlayerMediaFactory } from "../player-media"

export type MoriPreferences = {
  reduceMotion: boolean
  autoplay: boolean
  endBehavior: "stop" | "next"
  defaultMode: CreationMode
  lyricsMode: LyricsMode
  durationSeconds: number
}

const preferencesStorageKey = "mori.preferences.v1"
const railStorageKey = "mori.rail.v1"

const defaultPreferences: MoriPreferences = {
  reduceMotion: false,
  autoplay: false,
  endBehavior: "stop",
  defaultMode: "smart",
  lyricsMode: "lyrics",
  durationSeconds: 180,
}

type MoriAppContextValue = {
  railCollapsed: boolean
  toggleRail: () => void
  setRailCollapsed: (collapsed: boolean) => void
  playerCandidate: Candidate | null
  playerCandidates: Candidate[]
  clearPlayerCandidate: () => void
  playing: boolean
  playerMediaStatus: PlayerMediaStatus
  playerMediaMessage: string | null
  muted: boolean
  positionSeconds: number
  togglePlaying: () => void
  retryPlayerPlayback: () => void
  toggleMuted: () => void
  setPlaying: (playing: boolean) => void
  seekPlayer: (positionSeconds: number) => void
  selectPlayerCandidate: (candidate: Candidate, positionSeconds?: number) => void
  replacePlayerCandidates: (candidates: Candidate[]) => void
  previousPlayerCandidate: () => void
  nextPlayerCandidate: () => void
  preferences: MoriPreferences
  updatePreferences: (patch: Partial<MoriPreferences>) => void
}

export type PlayerMediaStatus = "ready" | "loading" | "unavailable" | "error"

const MoriAppContext = createContext<MoriAppContextValue | null>(null)

export function MoriAppProvider({ children, mediaFactory = createHtmlPlayerMediaController }: { children: ReactNode; mediaFactory?: PlayerMediaFactory }) {
  const [railCollapsed, setRailCollapsedState] = useState(false)
  const [railLoaded, setRailLoaded] = useState(false)
  const [preferences, setPreferences] = useState<MoriPreferences>(defaultPreferences)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [playerCandidate, setPlayerCandidate] = useState<Candidate | null>(previewCandidates[0])
  const [playerCandidates, setPlayerCandidates] = useState(previewCandidates)
  const [playing, setPlayingState] = useState(false)
  const [playerMediaStatus, setPlayerMediaStatus] = useState<PlayerMediaStatus>(isPlayableCandidate(playerCandidate) ? "ready" : "unavailable")
  const [playerMediaMessage, setPlayerMediaMessage] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [positionSeconds, setPositionSeconds] = useState(0)
  const playbackRef = useRef({ candidate: playerCandidate, candidates: playerCandidates, positionSeconds, endBehavior: preferences.endBehavior })
  const playerSelectionRef = useRef<Candidate | null>(playerCandidate)
  const mediaRef = useRef<ReturnType<PlayerMediaFactory> | null>(null)

  const setRailCollapsed = useCallback((collapsed: boolean) => setRailCollapsedState(collapsed), [])
  const toggleRail = useCallback(() => setRailCollapsedState((value) => !value), [])
  const setPlayingForApp = useCallback((nextPlaying: boolean) => {
    if (nextPlaying && !isPlayableCandidate(playerSelectionRef.current)) {
      setPlayingState(false)
      setPlayerMediaStatus("unavailable")
      setPlayerMediaMessage(null)
      return
    }
    if (nextPlaying) {
      setPlayerMediaStatus("loading")
      setPlayerMediaMessage(null)
    }
    setPlayingState(nextPlaying)
  }, [])
  const togglePlaying = useCallback(() => {
    if (!isPlayableCandidate(playerSelectionRef.current)) {
      setPlayingState(false)
      setPlayerMediaStatus("unavailable")
      setPlayerMediaMessage(null)
      return
    }
    setPlayingForApp(!playing)
  }, [playing, setPlayingForApp])
  const toggleMuted = useCallback(() => setMuted((value) => !value), [])
  const seekPlayer = useCallback((position: number) => {
    if (!Number.isFinite(position)) return
    if (playerCandidate === null) return
    const nextPosition = Math.max(0, Math.min(playerCandidate.durationSeconds, position))
    setPositionSeconds(nextPosition)
    mediaRef.current?.seek(nextPosition)
  }, [playerCandidate])
  const updatePreferences = useCallback((patch: Partial<MoriPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }))
  }, [])
  const clearPlayerCandidate = useCallback(() => {
    playerSelectionRef.current = null
    setPlayerCandidate(null)
    setPlayerCandidates([])
    setPlayingState(false)
    setPositionSeconds(0)
  }, [])

  const retryPlayerPlayback = useCallback(() => {
    if (!isPlayableCandidate(playerSelectionRef.current)) {
      setPlayingState(false)
      setPlayerMediaStatus("unavailable")
      return
    }
    setPlayingForApp(true)
  }, [setPlayingForApp])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedRailState = readStoredRailState()
      if (storedRailState !== null && window.innerWidth > 700) setRailCollapsedState(storedRailState)
      setRailLoaded(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!railLoaded) return
    try {
      window.localStorage.setItem(railStorageKey, railCollapsed ? "collapsed" : "expanded")
    } catch {
      // Rail state remains available for the current session when storage is unavailable.
    }
  }, [railCollapsed, railLoaded])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedPreferences = readStoredPreferences()
      if (storedPreferences !== null) setPreferences(storedPreferences)
      setPreferencesLoaded(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!preferencesLoaded) return
    try {
      window.localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences))
    } catch {
      // Preference state remains available for the current session when storage is unavailable.
    }
  }, [preferences, preferencesLoaded])

  const selectPlayerCandidate = useCallback((candidate: Candidate, initialPositionSeconds = 0) => {
    playerSelectionRef.current = candidate
    setPlayerCandidate(candidate)
    setPositionSeconds(Math.max(0, Math.min(candidate.durationSeconds, Math.round(initialPositionSeconds))))
    setPlayerCandidates((items) => items.some((item) => item.candidateRef === candidate.candidateRef) ? items : [...items, candidate])
  }, [])

  const replacePlayerCandidates = useCallback((candidates: Candidate[]) => {
    const uniqueCandidates = candidates.filter((candidate, index, items) => items.findIndex((item) => item.candidateRef === candidate.candidateRef) === index)
    setPlayerCandidates(uniqueCandidates)
  }, [])

  const previousPlayerCandidate = useCallback(() => {
    const nextCandidate = playerCandidate === null ? null : stepCandidate(playerCandidate, playerCandidates, -1)
    playerSelectionRef.current = nextCandidate
    setPlayerCandidate(nextCandidate)
    setPositionSeconds(0)
  }, [playerCandidate, playerCandidates])

  const nextPlayerCandidate = useCallback(() => {
    const nextCandidate = playerCandidate === null ? null : stepCandidate(playerCandidate, playerCandidates, 1)
    playerSelectionRef.current = nextCandidate
    setPlayerCandidate(nextCandidate)
    setPositionSeconds(0)
  }, [playerCandidate, playerCandidates])

  useEffect(() => {
    playbackRef.current = { candidate: playerCandidate, candidates: playerCandidates, positionSeconds, endBehavior: preferences.endBehavior }
  }, [playerCandidate, playerCandidates, positionSeconds, preferences.endBehavior])

  useEffect(() => {
    const controller = mediaFactory({
      onTimeUpdate: (nextPosition) => {
        const currentCandidate = playbackRef.current.candidate
        if (currentCandidate === null || !Number.isFinite(nextPosition)) return
        const clampedPosition = Math.max(0, Math.min(currentCandidate.durationSeconds, nextPosition))
        playbackRef.current.positionSeconds = clampedPosition
        setPositionSeconds(clampedPosition)
      },
      onEnded: () => {
        const current = playbackRef.current
        setPositionSeconds(0)
        if (current.endBehavior === "next" && current.candidates.length > 1 && current.candidate !== null) {
          const nextCandidate = stepCandidate(current.candidate, current.candidates, 1)
          current.candidate = nextCandidate
          current.positionSeconds = 0
          playerSelectionRef.current = nextCandidate
          setPlayerCandidate(nextCandidate)
          setPlayingForApp(true)
          return
        }
        setPlayingState(false)
      },
      onError: () => {
        setPlayingState(false)
        setPlayerMediaStatus("error")
        setPlayerMediaMessage("Audio could not be loaded.")
      },
    })
    mediaRef.current = controller
    return () => {
      controller.dispose()
      if (mediaRef.current === controller) mediaRef.current = null
    }
  }, [mediaFactory, setPlayingForApp])

  useEffect(() => {
    const controller = mediaRef.current
    if (controller === null) return
    controller.setSource(playerCandidate)
    setPlayerMediaMessage(null)
    setPlayerMediaStatus(isPlayableCandidate(playerCandidate) ? "ready" : "unavailable")
  }, [mediaFactory, playerCandidate])

  useEffect(() => {
    const controller = mediaRef.current
    if (controller === null) return
    if (!playing) {
      controller.pause()
      return
    }
    if (!isPlayableCandidate(playerCandidate)) {
      return
    }

    let active = true
    void controller.play().then(() => {
      if (active) setPlayerMediaStatus("ready")
    }).catch(() => {
      if (!active) return
      setPlayingState(false)
      setPlayerMediaStatus("error")
      setPlayerMediaMessage("Audio could not be loaded.")
    })
    return () => {
      active = false
    }
  }, [mediaFactory, playerCandidate, playing])

  useEffect(() => {
    mediaRef.current?.setMuted(muted)
  }, [mediaFactory, muted])

  useEffect(() => {
    const keepMobileRailCompact = () => {
      if (window.innerWidth <= 700) setRailCollapsedState(true)
    }

    keepMobileRailCompact()
    window.addEventListener("resize", keepMobileRailCompact)
    return () => window.removeEventListener("resize", keepMobileRailCompact)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !isPlayableCandidate(playerCandidate)) return
      if (document.querySelector('[aria-modal="true"]') !== null) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))) return
      event.preventDefault()
      setPlayingState((value) => !value)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [playerCandidate])

  const value = useMemo<MoriAppContextValue>(() => ({
    railCollapsed,
    toggleRail,
    setRailCollapsed,
    playerCandidate,
    playerCandidates,
    clearPlayerCandidate,
    playing,
    playerMediaStatus,
    playerMediaMessage,
    muted,
    positionSeconds,
    togglePlaying,
    retryPlayerPlayback,
    setPlaying: setPlayingForApp,
    toggleMuted,
    seekPlayer,
    selectPlayerCandidate,
    replacePlayerCandidates,
    previousPlayerCandidate,
    nextPlayerCandidate,
    preferences,
    updatePreferences,
  }), [clearPlayerCandidate, muted, nextPlayerCandidate, playerCandidate, playerCandidates, playerMediaMessage, playerMediaStatus, playing, positionSeconds, preferences, previousPlayerCandidate, railCollapsed, replacePlayerCandidates, retryPlayerPlayback, seekPlayer, selectPlayerCandidate, setPlayingForApp, setRailCollapsed, toggleMuted, togglePlaying, toggleRail, updatePreferences])

  return <MoriAppContext.Provider value={value}>{children}</MoriAppContext.Provider>
}

function stepCandidate(candidate: Candidate, candidates: Candidate[], direction: -1 | 1): Candidate {
  if (candidates.length === 0) return candidate
  const currentIndex = candidates.findIndex((item) => item.candidateRef === candidate.candidateRef)
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + direction + candidates.length) % candidates.length
  return candidates[nextIndex] ?? candidates[0] ?? candidate
}

export function useMoriApp(): MoriAppContextValue {
  const context = useContext(MoriAppContext)
  if (context === null) {
    throw new Error("MoriAppProvider is required")
  }
  return context
}

function readStoredPreferences(): MoriPreferences | null {
  try {
    const raw = window.localStorage.getItem(preferencesStorageKey)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null

    const { reduceMotion, autoplay, endBehavior, defaultMode, lyricsMode, durationSeconds } = parsed
    if (
      typeof reduceMotion !== "boolean" ||
      typeof autoplay !== "boolean" ||
      !isOneOf(endBehavior, ["stop", "next"]) ||
      !isOneOf(defaultMode, ["smart", "custom"]) ||
      !isOneOf(lyricsMode, ["lyrics", "instrumental"]) ||
      !isOneOf(durationSeconds, [120, 180, 240, 300])
    ) return null

    return { reduceMotion, autoplay, endBehavior, defaultMode, lyricsMode, durationSeconds }
  } catch {
    return null
  }
}

function readStoredRailState(): boolean | null {
  try {
    const stored = window.localStorage.getItem(railStorageKey)
    if (stored === "collapsed") return true
    if (stored === "expanded") return false
  } catch {
    return null
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isOneOf<T extends string | number>(value: unknown, values: readonly T[]): value is T {
  return values.some((item) => item === value)
}
