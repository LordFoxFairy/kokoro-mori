"use client"

import type { ReactNode } from "react"
import { MoriAppShell } from "./mori-app-shell"
import styles from "../mori-workspace.module.css"

type MoriStudioShellProps = {
  projectRef?: string | null
  children: ReactNode
}

export function MoriStudioShell({ projectRef, children }: MoriStudioShellProps) {
  return (
    <MoriAppShell
      activeKey="projects"
      ariaLabel="Studio"
      projectRef={projectRef}
    >
      <div className={styles.studioPage}>{children}</div>
    </MoriAppShell>
  )
}
