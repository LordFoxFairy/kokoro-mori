"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { previewCandidates } from "../preview-data"
import type { Candidate, CreationMode, LyricsMode } from "../domain"

export type MoriPreferences = {
  reduceMotion: boolean
  autoplay: boolean
  endBehavior: "stop" | "next"
  defaultMode: CreationMode
  lyricsMode: LyricsMode
  durationSeconds: number
}

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
  playerCandidate: Candidate
  playing: boolean
  muted: boolean
  positionSeconds: number
  togglePlaying: () => void
  toggleMuted: () => void
  setPlaying: (playing: boolean) => void
  seekPlayer: (positionSeconds: number) => void
  selectPlayerCandidate: (candidate: Candidate) => void
  previousPlayerCandidate: () => void
  nextPlayerCandidate: () => void
  preferences: MoriPreferences
  updatePreferences: (patch: Partial<MoriPreferences>) => void
}

const MoriAppContext = createContext<MoriAppContextValue | null>(null)

export function MoriAppProvider({ children }: { children: ReactNode }) {
  const [railCollapsed, setRailCollapsedState] = useState(false)
  const [preferences, setPreferences] = useState<MoriPreferences>(defaultPreferences)
  const [playerCandidate, setPlayerCandidate] = useState(previewCandidates[0])
  const [playerCandidates, setPlayerCandidates] = useState(previewCandidates)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [positionSeconds, setPositionSeconds] = useState(0)
  const playbackRef = useRef({ candidate: playerCandidate, candidates: playerCandidates, positionSeconds, endBehavior: preferences.endBehavior })

  const setRailCollapsed = useCallback((collapsed: boolean) => setRailCollapsedState(collapsed), [])
  const toggleRail = useCallback(() => setRailCollapsedState((value) => !value), [])
  const togglePlaying = useCallback(() => setPlaying((value) => !value), [])
  const toggleMuted = useCallback(() => setMuted((value) => !value), [])
  const seekPlayer = useCallback((position: number) => {
    if (!Number.isFinite(position)) return
    setPositionSeconds(Math.max(0, Math.min(playerCandidate.durationSeconds, Math.round(position))))
  }, [playerCandidate.durationSeconds])
  const updatePreferences = useCallback((patch: Partial<MoriPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }))
  }, [])

  const selectPlayerCandidate = useCallback((candidate: Candidate) => {
    setPlayerCandidate(candidate)
    setPositionSeconds(0)
    setPlayerCandidates((items) => items.some((item) => item.candidateRef === candidate.candidateRef) ? items : [...items, candidate])
  }, [])

  const previousPlayerCandidate = useCallback(() => {
    setPlayerCandidate((candidate) => stepCandidate(candidate, playerCandidates, -1))
    setPositionSeconds(0)
  }, [playerCandidates])

  const nextPlayerCandidate = useCallback(() => {
    setPlayerCandidate((candidate) => stepCandidate(candidate, playerCandidates, 1))
    setPositionSeconds(0)
  }, [playerCandidates])

  useEffect(() => {
    playbackRef.current = { candidate: playerCandidate, candidates: playerCandidates, positionSeconds, endBehavior: preferences.endBehavior }
  }, [playerCandidate, playerCandidates, positionSeconds, preferences.endBehavior])

  useEffect(() => {
    if (window.innerWidth <= 700) {
      const compactTimer = window.setTimeout(() => setRailCollapsed(true), 0)
      return () => window.clearTimeout(compactTimer)
    }
  }, [setRailCollapsed])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      const current = playbackRef.current
      const nextPosition = current.positionSeconds + 1
      if (nextPosition < current.candidate.durationSeconds) {
        current.positionSeconds = nextPosition
        setPositionSeconds(nextPosition)
        return
      }

      current.positionSeconds = 0
      setPositionSeconds(0)
      if (current.endBehavior === "next" && current.candidates.length > 1) {
        const nextCandidate = stepCandidate(current.candidate, current.candidates, 1)
        current.candidate = nextCandidate
        setPlayerCandidate(nextCandidate)
        return
      }
      setPlaying(false)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playing])

  const value = useMemo<MoriAppContextValue>(() => ({
    railCollapsed,
    toggleRail,
    setRailCollapsed,
    playerCandidate,
    playing,
    muted,
    positionSeconds,
    togglePlaying,
    setPlaying,
    toggleMuted,
    seekPlayer,
    selectPlayerCandidate,
    previousPlayerCandidate,
    nextPlayerCandidate,
    preferences,
    updatePreferences,
  }), [muted, nextPlayerCandidate, playerCandidate, playing, positionSeconds, preferences, previousPlayerCandidate, railCollapsed, seekPlayer, selectPlayerCandidate, setRailCollapsed, toggleMuted, togglePlaying, toggleRail, updatePreferences])

  return <MoriAppContext.Provider value={value}>{children}</MoriAppContext.Provider>
}

function stepCandidate(candidate: Candidate, candidates: Candidate[], direction: -1 | 1): Candidate {
  const currentIndex = candidates.findIndex((item) => item.candidateRef === candidate.candidateRef)
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + direction + candidates.length) % candidates.length
  return candidates[nextIndex] ?? candidates[0] ?? previewCandidates[0]
}

export function useMoriApp(): MoriAppContextValue {
  const context = useContext(MoriAppContext)
  if (context === null) {
    throw new Error("MoriAppProvider is required")
  }
  return context
}
