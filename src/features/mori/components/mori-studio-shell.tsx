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
  const { selectPlayerCandidate } = useMoriApp()

  useEffect(() => {
    if (candidate === null) return
    const selectionTimer = window.setTimeout(() => selectPlayerCandidate(candidate), 0)
    return () => window.clearTimeout(selectionTimer)
  }, [candidate, selectPlayerCandidate])

  return (
    <MoriAppShell
      activeKey="projects"
      ariaLabel="Studio"
    >
      <div className={styles.studioPage}>{children}</div>
    </MoriAppShell>
  )
}
