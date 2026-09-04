"use client"

import { useEffect, type ReactNode } from "react"
import type { Candidate } from "../domain"
import { isPlayableCandidate } from "../player-media"
import { useMoriApp } from "./mori-app-provider"
import { MoriAppShell } from "./mori-app-shell"
import styles from "../mori-workspace.module.css"

type MoriStudioShellProps = {
  candidate: Candidate | null
  playerCandidates?: Candidate[]
  children: ReactNode
}

export function MoriStudioShell({ candidate, playerCandidates, children }: MoriStudioShellProps) {
  const { clearPlayerCandidate, replacePlayerCandidates, selectPlayerCandidate } = useMoriApp()

  useEffect(() => {
    const selectionTimer = window.setTimeout(() => {
      const candidateCollection = playerCandidates ?? (candidate === null ? [] : [candidate])
      if (candidate === null || !isPlayableCandidate(candidate)) {
        clearPlayerCandidate()
        replacePlayerCandidates(candidateCollection)
      } else {
        replacePlayerCandidates(candidateCollection)
        selectPlayerCandidate(candidate)
      }
    }, 0)
    return () => window.clearTimeout(selectionTimer)
  }, [candidate, clearPlayerCandidate, playerCandidates, replacePlayerCandidates, selectPlayerCandidate])

  return (
    <MoriAppShell
      activeKey="projects"
      ariaLabel="Studio"
    >
      <div className={styles.studioPage}>{children}</div>
    </MoriAppShell>
  )
}
