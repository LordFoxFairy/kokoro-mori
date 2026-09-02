"use client"

import { useEffect, type ReactNode } from "react"
import type { Candidate } from "../domain"
import { useMoriApp } from "./mori-app-provider"
import { MoriAppShell } from "./mori-app-shell"
import styles from "../mori-workspace.module.css"

type MoriStudioShellProps = {
  candidate: Candidate | null
  children: ReactNode
}

export function MoriStudioShell({ candidate, children }: MoriStudioShellProps) {
  const { clearPlayerCandidate, selectPlayerCandidate } = useMoriApp()

  useEffect(() => {
    const selectionTimer = window.setTimeout(() => {
      if (candidate === null) clearPlayerCandidate()
      else selectPlayerCandidate(candidate)
    }, 0)
    return () => window.clearTimeout(selectionTimer)
  }, [candidate, clearPlayerCandidate, selectPlayerCandidate])

  return (
    <MoriAppShell
      activeKey="projects"
      ariaLabel="Studio"
    >
      <div className={styles.studioPage}>{children}</div>
    </MoriAppShell>
  )
}
