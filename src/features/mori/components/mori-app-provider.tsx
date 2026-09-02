"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { previewCandidates } from "../preview-data"
import type { Candidate } from "../domain"

type MoriAppContextValue = {
  railCollapsed: boolean
  toggleRail: () => void
  playerCandidate: Candidate
  playing: boolean
  togglePlaying: () => void
  setPlaying: (playing: boolean) => void
  selectPlayerCandidate: (candidate: Candidate) => void
}

const MoriAppContext = createContext<MoriAppContextValue | null>(null)

export function MoriAppProvider({ children }: { children: ReactNode }) {
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [playerCandidate, setPlayerCandidate] = useState(previewCandidates[0])
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (window.innerWidth <= 700) {
      const compactTimer = window.setTimeout(() => setRailCollapsed(true), 0)
      return () => window.clearTimeout(compactTimer)
    }
  }, [])

  const value = useMemo<MoriAppContextValue>(() => ({
    railCollapsed,
    toggleRail: () => setRailCollapsed((value) => !value),
    playerCandidate,
    playing,
    togglePlaying: () => setPlaying((value) => !value),
    setPlaying,
    selectPlayerCandidate: setPlayerCandidate,
  }), [playing, playerCandidate, railCollapsed])

  return <MoriAppContext.Provider value={value}>{children}</MoriAppContext.Provider>
}

export function useMoriApp(): MoriAppContextValue {
  const context = useContext(MoriAppContext)
  if (context === null) {
    throw new Error("MoriAppProvider is required")
  }
  return context
}
