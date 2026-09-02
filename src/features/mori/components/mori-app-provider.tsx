"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { previewCandidates } from "../preview-data"
import type { Candidate } from "../domain"

type MoriAppContextValue = {
  railCollapsed: boolean
  toggleRail: () => void
  playerCandidate: Candidate
  playing: boolean
  muted: boolean
  positionSeconds: number
  togglePlaying: () => void
  toggleMuted: () => void
  setPlaying: (playing: boolean) => void
  selectPlayerCandidate: (candidate: Candidate) => void
  previousPlayerCandidate: () => void
  nextPlayerCandidate: () => void
}

const MoriAppContext = createContext<MoriAppContextValue | null>(null)

export function MoriAppProvider({ children }: { children: ReactNode }) {
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [playerCandidate, setPlayerCandidate] = useState(previewCandidates[0])
  const [playerCandidates, setPlayerCandidates] = useState(previewCandidates)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [positionSeconds, setPositionSeconds] = useState(0)

  useEffect(() => {
    if (window.innerWidth <= 700) {
      const compactTimer = window.setTimeout(() => setRailCollapsed(true), 0)
      return () => window.clearTimeout(compactTimer)
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setPositionSeconds((position) => {
        if (position + 1 >= playerCandidate.durationSeconds) {
          setPlaying(false)
          return 0
        }
        return position + 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playing, playerCandidate.durationSeconds])

  const value = useMemo<MoriAppContextValue>(() => ({
    railCollapsed,
    toggleRail: () => setRailCollapsed((value) => !value),
    playerCandidate,
    playing,
    muted,
    positionSeconds,
    togglePlaying: () => setPlaying((value) => !value),
    setPlaying,
    toggleMuted: () => setMuted((value) => !value),
    selectPlayerCandidate: (candidate) => {
      setPlayerCandidate(candidate)
      setPositionSeconds(0)
      setPlayerCandidates((items) => items.some((item) => item.candidateRef === candidate.candidateRef) ? items : [...items, candidate])
    },
    previousPlayerCandidate: () => setPlayerCandidate((candidate) => {
      setPositionSeconds(0)
      return stepCandidate(candidate, playerCandidates, -1)
    }),
    nextPlayerCandidate: () => setPlayerCandidate((candidate) => {
      setPositionSeconds(0)
      return stepCandidate(candidate, playerCandidates, 1)
    }),
  }), [muted, playerCandidate, playerCandidates, playing, positionSeconds, railCollapsed])

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
