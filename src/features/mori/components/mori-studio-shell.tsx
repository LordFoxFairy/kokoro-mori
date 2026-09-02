"use client"

import { useState, type ReactNode } from "react"
import type { Candidate } from "../domain"
import { MoriAppShell } from "./mori-app-shell"
import { PersistentPlayer } from "./persistent-player"
import styles from "../mori-workspace.module.css"

type MoriStudioShellProps = {
  candidate: Candidate
  children: ReactNode
}

export function MoriStudioShell({ candidate, children }: MoriStudioShellProps) {
  const [playing, setPlaying] = useState(false)

  return (
    <MoriAppShell
      activeKey="projects"
      ariaLabel="Studio"
      player={<PersistentPlayer candidate={candidate} playing={playing} onToggle={() => setPlaying((value) => !value)} />}
    >
      <div className={styles.studioPage}>{children}</div>
    </MoriAppShell>
  )
}
